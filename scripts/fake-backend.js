/*
 * Backend simulado para Playwright (niveles 3–4 de `front-fase2` §11). Sigue LITERALMENTE los contratos del backend
 * (`Toffy22Cj/Donaciones`, develop 8dc48eb): rutas, cuerpos, códigos y `ProblemDetail` con `title` fijo. No inventa
 * campos. Las únicas rutas que no existen en el backend real son las de control de los tests, bajo `/__test/`.
 *
 * Fuentes por ruta: LoginController (ID-01), ficha N1 (`/me`, CONGELADA, todavía sin implementar en el backend),
 * PhysicalAssetController/PhysicalAssetDtos (B6-c).
 */
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.FAKE_BACKEND_PORT || 3002);
const BASE = '/api/v1';

const accounts = {
  'admin@demo.test': { password: 'demo-admin', accountId: 'acc-admin', organizationId: 'org-1', roles: ['ADMINISTRATOR'] },
  'empleado@demo.test': { password: 'demo-empleado', accountId: 'acc-employee', organizationId: 'org-1', roles: ['EMPLOYEE'] },
  'empleado2@demo.test': { password: 'demo-empleado2', accountId: 'acc-employee-2', organizationId: 'org-1', roles: ['EMPLOYEE'] },
  'empleado3@demo.test': { password: 'demo-empleado3', accountId: 'acc-employee-3', organizationId: 'org-1', roles: ['EMPLOYEE'] },
  'plataforma@demo.test': { password: 'demo-plataforma', accountId: 'acc-platform', roles: [], platformAuthority: 'ADMINISTRATOR' },
  'plataforma2@demo.test': { password: 'demo-plataforma2', accountId: 'acc-platform-2', roles: [] },
  'representante@demo.test': { password: 'demo-representante', accountId: 'acc-rep', organizationId: 'org-1', roles: ['REPRESENTATIVE'] },
  'admin-sin-verificar@demo.test': { password: 'demo-admin2', accountId: 'acc-admin-2', organizationId: 'org-2', roles: ['ADMINISTRATOR'] },
  'donante@demo.test': { password: 'demo-donante', accountId: 'acc-donor', roles: [] },
  // Para probar el backend real de hoy, que todavía no expone /me (S-01): para esta cuenta /me responde 404
  'sin-me@demo.test': { password: 'demo-sin-me', accountId: 'acc-no-me', organizationId: 'org-1', roles: ['ADMINISTRATOR'], noMe: true },
};

accounts['legacy@demo.test'] = { password: null, accountId: 'acc-legacy', organizationId: 'org-1', roles: ['ADMINISTRATOR', 'EMPLOYEE'] };
// Tokens de los tests existentes (W-4): cuenta de la organización con los dos roles
const tokens = new Map([
  ['fake-jwt-token', 'legacy@demo.test'],
  ['fake-jwt-token-for-security', 'legacy@demo.test'],
]);

function send(res, status, body, extra = {}) {
  const headers = { ...extra };
  if (body !== undefined) headers['Content-Type'] = status >= 400 ? 'application/problem+json' : 'application/json';
  res.writeHead(status, headers);
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

const DETAILS = {
  400: 'The request is not valid.', 401: 'Authentication is required.',
  403: 'You are not allowed to perform this operation.', 404: 'The resource was not found.',
  409: 'The operation conflicts with the current state of the resource.',
};

/** Forma de ApiExceptionHandler (B6-0): type, title fijo, status, detail fijo; sin `instance`. */
function problem(res, status, title) {
  send(res, status, { type: 'about:blank', title, status, detail: DETAILS[status] || 'The request could not be processed.' });
}

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Como CommandIdArgumentResolver (B6-0): UUID canónico obligatorio, en minúsculas; si no, 400. */
function commandIdOf(req) {
  const v = req.headers['command-id'];
  return typeof v === 'string' && UUID.test(v) ? v.toLowerCase() : null;
}

/** Reclamos de Command-Id: el mismo id en otro tipo de comando → 409 (IdempotentCommandExecutor / B6-c). */
const claims = new Map();
function claim(res, commandId, type, onFirst) {
  const prev = claims.get(commandId);
  if (prev && prev.type !== type) {
    problem(res, 409, type.startsWith('ASSET') ? 'CommandIdReused' : 'CommandIdReusedForDifferentCommand');
    return null;
  }
  if (prev) return { duplicate: true, value: prev.value };
  const value = onFirst();
  if (value === null) return null;
  claims.set(commandId, { type, value });
  return { duplicate: false, value };
}

// --- Datos de la demo simulada (no son parte del contrato) ---
const campaigns = new Map();
function addCampaign(publicCode, c) { campaigns.set(publicCode, { publicCode, ...c }); }
addCampaign('01JDEMOPUBLICC0DEMONETARY1', {
  campaignRef: 'camp-demo-1', organizationRef: 'org-1', organizationName: 'Fundación Demo', title: 'Mercados para adultos mayores',
  description: 'Recaudamos fondos para entregar mercados a adultos mayores del barrio.', status: 'OPEN',
  startDate: '2026-10-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z', acceptedDonationTypes: ['MONETARY'],
  acceptedPaymentMethods: ['GATEWAY', 'BANK_TRANSFER'], currency: 'COP', targetAmount: '500000000', clearedAmount: '125000000', targetPolicy: 'FLEXIBLE',
});
addCampaign('01JDEMOPUBLICC0DECLOSED001', {
  campaignRef: 'camp-demo-2', organizationRef: 'org-1', organizationName: 'Fundación Demo', title: 'Kits escolares 2025',
  status: 'CLOSED', startDate: '2025-01-01T00:00:00Z', endDate: '2025-03-01T00:00:00Z', acceptedDonationTypes: ['MONETARY'],
  acceptedPaymentMethods: ['GATEWAY'], currency: 'COP', targetAmount: '100000000', clearedAmount: '100000000',
});
addCampaign('01JDEMOPUBLICC0DEINKIND01', {
  campaignRef: 'camp-demo-3', organizationRef: 'org-1', title: 'Ropa de abrigo', status: 'OPEN',
  startDate: '2026-10-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z', acceptedDonationTypes: ['IN_KIND'], acceptedPaymentMethods: [],
});

const intents = new Map();
const verifiedOrganizations = new Set(['org-1']);
/** Estado de verificación de las organizaciones del doble (plataforma, DD-48). */
const organizationStatus = new Map([['org-1', 'VERIFIED'], ['org-2', 'PENDING_VERIFICATION'], ['org-3', 'PENDING_VERIFICATION']]);
/** Ficha de las organizaciones del doble (cola de verificación, DD-69): nombre, tipo, petición de información y orden. */
const organizations = new Map([
  ['org-1', { name: 'Fundación Demo', type: 'FOUNDATION' }],
  ['org-2', { name: 'Fundación Sin Verificar', type: 'FOUNDATION' }],
  ['org-3', { name: 'Empresa Pendiente', type: 'COMPANY' }],
]);
/** Asignaciones por fondo (camino A): fundId → [{allocationId, amount, status}]. */
const fundAllocations = new Map();
const assignments = new Map([['camp-demo-1:acc-admin', { assignmentId: 'asg-demo-1', actingRole: 'ADMINISTRATOR' }]]);
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function newPublicCode() {
  return [...crypto.randomBytes(26)].map((b) => CROCKFORD[b % 32]).join('');
}
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;
const oneOf = (v, xs) => v === undefined || v === null || xs.includes(v);
/** Activos por fondo: la logística del seguimiento (TR-01) y su historial (TR-03). */
const assets = new Map();
const narrativeCalls = new Map();
const splits = new Map();

function newAsset(a) {
  const assetRef = a.assetRef || crypto.randomUUID();
  const asset = { assetRef, lifecycleStatus: 'REGISTERED', history: [{ eventType: 'ASSET_REGISTERED', timestamp: new Date().toISOString(), status: 'REGISTERED' }], ...a, assetRef };
  assets.set(assetRef, asset);
  return asset;
}
newAsset({ assetRef: 'ASSET-123', organizationRef: 'org-1', assetType: 'Mercado', quantity: '1', unitOfMeasure: 'EA',
  currentCustodianRef: 'CUST-1', currentLocation: 'LOC-1', campaignRef: 'CAMP-1' });

/** Matriz P7 (ADR-032): EMPLOYEE; REPRESENTATIVE como respaldo solo en registrar y dividir. */
function canOperate(actor, backup) {
  return actor.roles.includes('EMPLOYEE') || (backup && actor.roles.includes('REPRESENTATIVE'));
}
const QTY = /^[0-9]{1,15}(\.[0-9]{1,4})?$/;
/** Cantidades con escala 4, como el backend real (D-07): `"6"` → `"6.0000"`. */
const scale4 = (q) => (q === undefined || q === null ? q : Number(q).toFixed(4));
const text = (v) => typeof v === 'string' && v.trim() !== '' && v.length <= 256;

function intentByTrackingCode(req) {
  const h = req.headers['authorization'];
  if (!h || !h.startsWith('Bearer ')) return null;
  const code = h.slice(7);
  for (const i of intents.values()) if (i.trackingCode && i.trackingCode === code) return i;
  return null;
}

/** CV-07: exactamente los campos de PublicCampaignResponse, nulos omitidos. */
function publicView(c) {
  const out = {};
  for (const k of ['organizationName', 'title', 'description', 'status', 'startDate', 'endDate', 'acceptedDonationTypes',
    'acceptedPaymentMethods', 'currency', 'targetAmount', 'clearedAmount']) {
    if (c[k] !== undefined && c[k] !== null) out[k] = c[k];
  }
  return out;
}

/** Fallos forzados por los tests: el siguiente POST cuya ruta empiece por `prefix` falla con `mode`. */
const failures = [];

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : null); } catch { resolve(undefined); }
    });
  });
}

function accountOf(req) {
  const h = req.headers['authorization'];
  if (!h || !h.startsWith('Bearer ')) return null;
  const email = tokens.get(h.slice(7));
  return email ? accounts[email] : null;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Command-Id, Intent-Token');
  res.setHeader('Access-Control-Expose-Headers', 'Location');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (path === '/') { res.writeHead(200); res.end('OK'); return; }

  // --- Control de los tests (no existe en el backend real) ---
  if (path === '/__test/fail-next' && req.method === 'POST') {
    const body = await readBody(req);
    failures.push({ prefix: body.prefix, mode: body.mode, applyThenFail: !!body.applyThenFail });
    send(res, 200, { ok: true });
    return;
  }
  // Hace de proveedor de pago: confirma (o falla) la intención y aplica los fondos, como el webhook firmado real
  if (path === '/__test/payments' && req.method === 'POST') {
    const body = await readBody(req);
    const intent = intents.get(body.intentId);
    if (!intent) { send(res, 404, { ok: false }); return; }
    if (body.outcome === 'failed') {
      if (intent.status === 'PENDING') intent.status = 'FAILED';
    } else if (intent.status === 'PENDING') {
      intent.status = 'CONFIRMED';
      if (!body.withoutApplying) {
        intent.trackingCode = 'TRK.' + crypto.randomBytes(24).toString('base64url');
        intent.fundId = 'fund-' + crypto.randomUUID();
        const c = campaigns.get(intent.publicCode);
        c.clearedAmount = String(BigInt(c.clearedAmount || '0') + BigInt(intent.amount));
      }
    }
    send(res, 200, { ok: true });
    return;
  }
  // El test hace de operador con acceso a los datos: el fundId de una intención (la web no tiene de dónde leerlo, S-04)
  const fundMatch = path.match(/^\/__test\/intents\/([^/]+)\/fund$/);
  if (fundMatch && req.method === 'GET') {
    const intent = intents.get(decodeURIComponent(fundMatch[1]));
    send(res, intent && intent.fundId ? 200 : 404, intent && intent.fundId ? { fundId: intent.fundId } : { ok: false });
    return;
  }
  // Datos de prueba: crea una convocatoria pública abierta y devuelve su publicCode
  if (path === '/__test/campaigns' && req.method === 'POST') {
    const body = (await readBody(req)) || {};
    const code = '01JT' + crypto.randomBytes(16).toString('hex').toUpperCase().slice(0, 22);
    addCampaign(code, {
      campaignRef: 'camp-' + crypto.randomUUID(), organizationRef: 'org-1', organizationName: 'Fundación Demo',
      title: body.title || 'Convocatoria de prueba', status: 'OPEN', startDate: '2026-10-01T00:00:00Z',
      endDate: '2026-12-31T23:59:59Z', acceptedDonationTypes: ['MONETARY'], acceptedPaymentMethods: ['GATEWAY', 'BANK_TRANSFER'],
      currency: 'COP', targetAmount: '100000000', clearedAmount: '0',
    });
    send(res, 200, { publicCode: code });
    return;
  }

  if (!path.startsWith(BASE)) { send(res, 404); return; }
  const p = path.slice(BASE.length);

  if (req.method === 'POST') {
    const i = failures.findIndex((f) => p.startsWith(f.prefix));
    if (i >= 0) {
      const f = failures.splice(i, 1)[0];
      if (!f.applyThenFail) {
        if (f.mode === 'drop') { req.socket.destroy(); return; }
        problem(res, 503, 'ServiceUnavailable');
        return;
      }
      // Aplica el comando y luego "pierde" la respuesta: el caso ambiguo real
      res.__failAfter = f.mode;
    }
  }

  // POST /auth/register (AccountRegistrationController): 201 {accountId, status}; 409 DuplicateEmail
  if (p === '/auth/register' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.email || !String(body.email).trim()) { problem(res, 400, 'InvalidRequestField'); return; }
    if (!body.password) { problem(res, 400, 'InvalidRequestField'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) { problem(res, 400, 'InvalidEmailFormat'); return; }
    // H-P2-1 del backend: al menos 12 caracteres
    if (String(body.password).length < 12) { problem(res, 400, 'PasswordTooShort'); return; }
    if (accounts[body.email]) { problem(res, 409, 'DuplicateEmail'); return; }
    const accountId = crypto.randomUUID();
    accounts[body.email] = { password: body.password, accountId, roles: [] };
    send(res, 201, { accountId, status: 'ACTIVE' });
    return;
  }

  // ID-01 — POST /auth/login
  if (p === '/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.email || !body.password) { problem(res, 400, 'Bad Request'); return; }
    const acc = accounts[body.email];
    if (!acc || acc.password !== body.password) { problem(res, 401, 'Unauthorized'); return; }
    const token = 'tok-' + crypto.randomUUID();
    tokens.set(token, body.email);
    send(res, 200, { token });
    return;
  }

  const actor = accountOf(req);

  // GET /public/campaigns?cursor= (PublicCampaignDiscoveryController): solo PUBLIC y OPEN, 20 por página, cursor opaco
  if (p === '/public/campaigns' && req.method === 'GET') {
    const all = [...campaigns.values()].filter((c) => c.status === 'OPEN' && (c.visibility || 'PUBLIC') === 'PUBLIC')
      .sort((a, b) => (a.publicCode < b.publicCode ? -1 : 1));
    let start = 0;
    const cursor = url.searchParams.get('cursor');
    if (cursor !== null) {
      let after;
      try { after = Buffer.from(cursor, 'base64url').toString(); } catch { after = null; }
      if (!after || !campaigns.has(after)) { problem(res, 400, 'InvalidRequestField'); return; }
      start = all.findIndex((c) => c.publicCode > after);
      if (start < 0) start = all.length;
    }
    const page = all.slice(start, start + 20);
    const out = { items: page.map((c) => { const v = publicView(c); delete v.description; delete v.acceptedPaymentMethods; return { publicCode: c.publicCode, ...v }; }) };
    if (start + 20 < all.length) out.nextCursor = Buffer.from(page[page.length - 1].publicCode).toString('base64url');
    send(res, 200, out);
    return;
  }

  // GET /public/campaigns/{publicCode}/narrative (PublicCampaignNarrativeController): 202 PENDING la primera vez
  const narrMatch = p.match(/^\/public\/campaigns\/([^/]+)\/narrative$/);
  if (narrMatch && req.method === 'GET') {
    const c = campaigns.get(decodeURIComponent(narrMatch[1]));
    if (!c) { problem(res, 404, 'NotFound'); return; }
    const facts = { status: c.status, unitsDelivered: '0', distinctRecipients: 0 };
    if (c.currency) { facts.currency = c.currency; facts.targetAmount = c.targetAmount; facts.clearedAmount = c.clearedAmount; }
    c.narrativeCalls = (c.narrativeCalls || 0) + 1;
    if (c.narrativeCalls === 1) { send(res, 202, { status: 'PENDING', content: null, source: null, facts }); return; }
    send(res, 200, { status: 'AVAILABLE', content: 'La convocatoria avanza con aportes de la comunidad.', source: 'LLM_GENERATED', facts });
    return;
  }

  // CV-07 — GET /public/campaigns/{publicCode}
  const publicMatch = p.match(/^\/public\/campaigns\/([^/]+)$/);
  if (publicMatch && req.method === 'GET') {
    const c = campaigns.get(decodeURIComponent(publicMatch[1]));
    if (!c) { problem(res, 404, 'NotFound'); return; }
    send(res, 200, publicView(c));
    return;
  }

  // CV-11 — POST /public/campaigns/{publicCode}/donation-intents (JWT opcional, Command-Id obligatorio)
  const intentMatch = p.match(/^\/public\/campaigns\/([^/]+)\/donation-intents$/);
  if (intentMatch && req.method === 'POST') {
    if (req.headers['authorization'] && !actor) { problem(res, 401, 'Unauthorized'); return; }
    const commandId = commandIdOf(req);
    if (!commandId) { problem(res, 400, 'BadRequest'); return; }
    const body = await readBody(req);
    if (!body) { problem(res, 400, 'BadRequest'); return; }
    const c = campaigns.get(decodeURIComponent(intentMatch[1]));
    if (!c) { problem(res, 404, 'NotFound'); return; }
    if (typeof body.amount !== 'string' || !/^[0-9]{1,18}$/.test(body.amount)) { problem(res, 400, 'BadRequest'); return; }
    if (typeof body.currency !== 'string' || !body.currency.trim() || body.currency.length > 3) { problem(res, 400, 'BadRequest'); return; }
    if (!['GATEWAY', 'BANK_TRANSFER', 'CASH'].includes(body.paymentMethod)) { problem(res, 400, 'BadRequest'); return; }
    if (c.status === 'CLOSED') { problem(res, 409, 'CampaignClosed'); return; }
    if (!c.acceptedDonationTypes.includes('MONETARY')) { problem(res, 409, 'DonationTypeNotAccepted'); return; }
    if (body.paymentMethod === 'CASH') { problem(res, 409, 'CashDonationIntentNotSupported'); return; }
    if (!c.acceptedPaymentMethods.includes(body.paymentMethod)) { problem(res, 409, 'PaymentMethodNotAccepted'); return; }
    if (body.currency !== c.currency) { problem(res, 409, 'DonationCurrencyMismatch'); return; }
    const r = claim(res, commandId, 'CREATE_DONATION_INTENT', () => {
      const intentId = crypto.randomUUID();
      intents.set(intentId, {
        intentId, publicCode: c.publicCode, campaignTitle: c.title, amount: body.amount, currency: body.currency,
        paymentMethod: body.paymentMethod, status: 'PENDING', donorAccount: actor ? actor.accountId : null,
        redirect: body.paymentMethod === 'GATEWAY' ? '/demo/checkout/sim_' + crypto.randomUUID() : null,
      });
      return intentId;
    });
    if (!r) return;
    const intent = intents.get(r.value);
    // DD-18 sustituida: cada respuesta (también la de un duplicado) emite un statusToken nuevo y anula el anterior
    intent.token = crypto.randomBytes(32).toString('base64url');
    const out = { intentId: intent.intentId, statusToken: intent.token };
    if (intent.redirect) out.paymentRedirectUrl = intent.redirect;
    if (res.__failAfter) { res.__failAfter === 'drop' ? req.socket.destroy() : problem(res, 503, 'ServiceUnavailable'); return; }
    send(res, 201, out);
    return;
  }

  // CV-01 — POST /organizations/{organizationId}/campaigns (CampaignAdministrationController)
  const createMatch = p.match(/^\/organizations\/([^/]+)\/campaigns$/);
  if (createMatch && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const commandId = commandIdOf(req);
    if (!commandId) { problem(res, 400, 'BadRequest'); return; }
    const b = await readBody(req);
    const c = b && b.configuration;
    if (!b || !c) { problem(res, 400, 'BadRequest'); return; }
    const types = c.acceptedDonationTypes || [];
    const methods = c.acceptedPaymentMethods || [];
    if (!types.every((t) => ['MONETARY', 'IN_KIND'].includes(t)) || !methods.every((m) => ['GATEWAY', 'BANK_TRANSFER', 'CASH'].includes(m))
      || !oneOf(c.targetPolicy, ['FLEXIBLE', 'STRICT', 'CLOSE_ON_TARGET']) || !oneOf(c.onTargetReached, ['CLOSE', 'REJECT_EXCESS', 'ACCEPT_EXCESS'])
      || !oneOf(b.visibility, ['PUBLIC', 'PRIVATE_LINK']) || (c.targetAmount != null && !/^[0-9]{1,19}$/.test(c.targetAmount))
      || typeof b.startDate !== 'string' || !UTC.test(b.startDate) || typeof b.endDate !== 'string' || !UTC.test(b.endDate)) {
      problem(res, 400, 'BadRequest'); return;
    }
    const orgId = decodeURIComponent(createMatch[1]);
    if (actor.organizationId !== orgId) { problem(res, 403, 'Forbidden'); return; }
    if (!actor.roles.includes('ADMINISTRATOR')) { problem(res, 403, 'Forbidden'); return; }
    if (!b.title || !String(b.title).trim()) { problem(res, 400, 'CampaignTitleRequired'); return; }
    if (b.title.length > 200) { problem(res, 400, 'CampaignTitleTooLong'); return; }
    if (!b.visibility) { problem(res, 400, 'CampaignVisibilityRequired'); return; }
    if (b.startDate >= b.endDate) { problem(res, 400, 'InvalidCampaignDateRange'); return; }
    if (new Date(b.startDate).getTime() < Date.now() - 5 * 60 * 1000) { problem(res, 400, 'CampaignDateInPast'); return; }
    if (types.length === 0) { problem(res, 400, 'EmptyAcceptedDonationTypes'); return; }
    const monetary = types.includes('MONETARY');
    if (monetary && (methods.length === 0 || !c.targetAmount || !c.targetPolicy)) { problem(res, 400, 'IncompleteMonetaryConfiguration'); return; }
    if (monetary && !c.currency) { problem(res, 400, 'MissingCampaignCurrency'); return; }
    if (monetary && !/^[A-Z]{3}$/.test(c.currency)) { problem(res, 400, 'InvalidCampaignCurrency'); return; }
    if (monetary && BigInt(c.targetAmount) <= BigInt(0)) { problem(res, 400, 'InvalidTargetAmount'); return; }
    if ((c.targetPolicy === 'CLOSE_ON_TARGET') !== (c.onTargetReached != null)) { problem(res, 400, 'InvalidOnTargetReached'); return; }
    if (!monetary && (c.currency || c.targetAmount || c.targetPolicy || c.onTargetReached)) { problem(res, 400, 'MonetaryTermsWithoutMonetaryDonationType'); return; }
    if (!verifiedOrganizations.has(orgId)) { problem(res, 409, 'OrganizationNotVerified'); return; }
    const r = claim(res, commandId, 'CREATE_CONVOCATORIA', () => {
      const publicCode = newPublicCode();
      const campaignRef = crypto.randomUUID();
      addCampaign(publicCode, {
        campaignRef, organizationRef: orgId, organizationName: 'Fundación Demo', title: b.title, description: b.description, visibility: b.visibility,
        status: 'OPEN', startDate: b.startDate, endDate: b.endDate, acceptedDonationTypes: types, acceptedPaymentMethods: methods,
        currency: monetary ? c.currency : undefined, targetAmount: monetary ? c.targetAmount : undefined,
        clearedAmount: monetary ? '0' : undefined, targetPolicy: c.targetPolicy,
      });
      return { campaignRef, publicCode };
    });
    if (!r) return;
    send(res, 201, r.value);
    return;
  }

  // GET /organizations/{id}/campaigns (OrganizationCampaignsController, DD-49): solo ADMINISTRATOR de la organización
  const orgListMatch = p.match(/^\/organizations\/([^/]+)\/campaigns$/);
  if (orgListMatch && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(orgListMatch[1]);
    if (actor.organizationId !== orgId || !actor.roles.includes('ADMINISTRATOR')) { problem(res, 403, 'Forbidden'); return; }
    const items = [...campaigns.values()].filter((c) => c.organizationRef === orgId).slice(0, 100).map((c) => {
      const responsibles = [...assignments.entries()].filter(([k]) => k.startsWith(c.campaignRef + ':'))
        .map(([k, v]) => ({ accountId: k.slice(c.campaignRef.length + 1), actingRole: v.actingRole }));
      return {
        campaignRef: c.campaignRef, publicCode: c.publicCode, title: c.title, status: c.status, visibility: c.visibility || 'PUBLIC',
        currency: c.currency, targetAmount: c.targetAmount, targetPolicy: c.targetPolicy, clearedAmount: c.clearedAmount,
        responsibles, assignedEmployeeCount: responsibles.filter((r) => r.actingRole === 'EMPLOYEE').length,
      };
    });
    send(res, 200, { items });
    return;
  }

  // GET /organizations/{id}/members (DD-55): ADMINISTRATOR o REPRESENTATIVE; sin email
  const membersMatch = p.match(/^\/organizations\/([^/]+)\/members$/);
  if (membersMatch && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(membersMatch[1]);
    if (actor.organizationId !== orgId || !actor.roles.some((r) => r === 'ADMINISTRATOR' || r === 'REPRESENTATIVE')) { problem(res, 403, 'Forbidden'); return; }
    const items = Object.values(accounts).filter((a) => a.organizationId === orgId && !a.noMe && a.password !== null)
      .map((a) => ({ accountId: a.accountId, roles: a.roles, status: 'ACTIVE' }));
    send(res, 200, { items });
    return;
  }

  // GET /organizations/{id}/campaigns/{ref}/prediction (CampaignPredictionController): ADMINISTRATOR o REPRESENTATIVE.
  // Cifras de PRUEBA deterministas del doble (no son del modelo).
  const predMatch = p.match(/^\/organizations\/([^/]+)\/campaigns\/([^/]+)\/prediction$/);
  if (predMatch && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(predMatch[1]);
    const c = [...campaigns.values()].find((x) => x.campaignRef === decodeURIComponent(predMatch[2]));
    if (!c || c.organizationRef !== orgId || actor.organizationId !== orgId
      || !actor.roles.some((r) => r === 'ADMINISTRATOR' || r === 'REPRESENTATIVE')) { problem(res, 403, 'Forbidden'); return; }
    const base = { kind: 'ESTIMATE', modelVersion: 'fake-1', warning: 'Estimación de un modelo entrenado con datos sintéticos.', asOf: new Date().toISOString() };
    const unavailable = (reason, text) => send(res, 200, { ...base, available: false, unavailableReason: reason, unavailableText: text }, { 'Cache-Control': 'no-store' });
    if (c.targetPolicy === 'STRICT') { unavailable('STRICT_POLICY_EXCLUDED', 'Las convocatorias con meta estricta no se estiman.'); return; }
    if (!c.targetAmount) { unavailable('NO_MONETARY_TARGET', 'La convocatoria no tiene meta monetaria.'); return; }
    if (c.status === 'CLOSED') { unavailable('CAMPAIGN_ENDED', 'La convocatoria ya terminó.'); return; }
    send(res, 200, { ...base, available: true, probabilityReachTarget: 0.62, estimatedFinalPctOfTarget: 1.04, pctTimeElapsed: 0.3,
      warnings: ['Estimación de un modelo entrenado con datos sintéticos.'] }, { 'Cache-Control': 'no-store' });
    return;
  }

  // GET /organizations/{id}/funds (DD-31): ADMINISTRATOR o EMPLOYEE. Un fondo por donación con fondos aplicados
  const fundsMatch = p.match(/^\/organizations\/([^/]+)\/funds$/);
  if (fundsMatch && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(fundsMatch[1]);
    if (actor.organizationId !== orgId || !actor.roles.some((r) => r === 'ADMINISTRATOR' || r === 'EMPLOYEE')) { problem(res, 403, 'Forbidden'); return; }
    const items = [...intents.values()].filter((i) => i.fundId && campaigns.get(i.publicCode)?.organizationRef === orgId).map((i) => {
      const allocations = fundAllocations.get(i.fundId) || [];
      const used = allocations.reduce((n, a) => n + BigInt(a.amount), BigInt(0));
      return { fundId: i.fundId, campaignRef: campaigns.get(i.publicCode).campaignRef, currency: i.currency || 'COP',
        clearedAmount: String(i.amount), availableAmount: String(BigInt(i.amount) - used), allocations };
    });
    send(res, 200, { items });
    return;
  }

  // GET /organizations/{id}/physical-assets (DD-54): ADMINISTRATOR o EMPLOYEE; sin donorRef
  const orgAssetsMatch = p.match(/^\/organizations\/([^/]+)\/physical-assets$/);
  if (orgAssetsMatch && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(orgAssetsMatch[1]);
    if (actor.organizationId !== orgId || !actor.roles.some((r) => r === 'ADMINISTRATOR' || r === 'EMPLOYEE')) { problem(res, 403, 'Forbidden'); return; }
    const items = [...assets.values()].filter((a) => a.organizationRef === orgId).slice(0, 200).map((a) => ({
      assetRef: a.assetRef, lifecycleStatus: a.lifecycleStatus, currentCustodianRef: a.currentCustodianRef,
      currentLocation: a.currentLocation, quantity: scale4(a.quantity), unitOfMeasure: a.unitOfMeasure, campaignRef: a.campaignRef,
    }));
    send(res, 200, { items });
    return;
  }

  // POST /funds/{fundId}/allocations y .../{allocationId}/confirm (ADMINISTRATOR, Command-Id; DD-29, DD-30, DD-32)
  const allocMatch = p.match(/^\/funds\/([^/]+)\/allocations(?:\/([^/]+)\/confirm)?$/);
  if (allocMatch && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const commandId = commandIdOf(req);
    if (!commandId) { problem(res, 400, 'BadRequest'); return; }
    const fundId = decodeURIComponent(allocMatch[1]);
    const intent = [...intents.values()].find((i) => i.fundId === fundId);
    // Fondo inexistente o ajeno: el mismo 403 (DD-30)
    if (!intent || campaigns.get(intent.publicCode)?.organizationRef !== actor.organizationId || !actor.roles.includes('ADMINISTRATOR')) {
      problem(res, 403, 'Forbidden'); return;
    }
    const list = fundAllocations.get(fundId) || [];
    if (allocMatch[2]) {
      const allocationId = decodeURIComponent(allocMatch[2]);
      const a = list.find((x) => x.allocationId === allocationId);
      if (!a) { problem(res, 403, 'Forbidden'); return; }
      const r = claim(res, commandId, 'CONFIRM_ALLOCATION:' + allocationId, () => { a.status = 'CONFIRMED'; return { allocationId, status: 'CONFIRMED' }; });
      if (r) send(res, 200, r.value);
      return;
    }
    const b = await readBody(req);
    if (!b || typeof b.amount !== 'string' || !/^[0-9]{1,19}$/.test(b.amount) || BigInt(b.amount) <= BigInt(0)) { problem(res, 400, 'BadRequest'); return; }
    const used = list.reduce((n, a) => n + BigInt(a.amount), BigInt(0));
    if (!claims.get(commandId) && BigInt(b.amount) > BigInt(intent.amount) - used) { problem(res, 409, 'InsufficientAvailableFunds'); return; }
    const r = claim(res, commandId, 'REQUEST_ALLOCATION:' + fundId, () => {
      const a = { allocationId: 'alloc-' + crypto.randomUUID(), amount: b.amount, status: 'REQUESTED' };
      list.push(a);
      fundAllocations.set(fundId, list);
      return { allocationId: a.allocationId, status: 'REQUESTED' };
    });
    if (r) send(res, 201, r.value);
    return;
  }

  // Cola de verificación (DD-69): 20 por página, por orden de creación, cursor opaco; filtro opcional por estado
  if (p === '/platform/organizations' && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    if (!actor.platformAuthority) { problem(res, 403, 'Forbidden'); return; }
    const status = url.searchParams.get('status');
    if (status && !['PENDING_VERIFICATION', 'NEEDS_MORE_INFORMATION'].includes(status)) { problem(res, 400, 'InvalidRequestField'); return; }
    // Orden de creación = orden de alta en `organizations`; el cursor es la última de la página anterior
    const all = [...organizations.keys()];
    const inQueue = (id) => {
      const st = organizationStatus.get(id);
      return status ? st === status : st === 'PENDING_VERIFICATION' || st === 'NEEDS_MORE_INFORMATION';
    };
    const cursor = url.searchParams.get('cursor');
    let from = 0;
    if (cursor) {
      const pos = all.indexOf(Buffer.from(cursor, 'base64url').toString());
      if (pos < 0) { problem(res, 400, 'InvalidRequestField'); return; }
      from = pos + 1;
    }
    const rest = all.slice(from).filter(inQueue);
    const page = rest.slice(0, 20);
    const items = page.map((id) => {
      const o = organizations.get(id) || { type: 'FOUNDATION' };
      const item = { organizationId: id, type: o.type, verificationStatus: organizationStatus.get(id) };
      if (o.name) item.name = o.name;
      if (o.informationRequest) item.informationRequest = o.informationRequest;
      return item;
    });
    const out = { items };
    if (rest.length > 20) out.nextCursor = Buffer.from(page[page.length - 1]).toString('base64url');
    send(res, 200, out, { 'Cache-Control': 'no-store' });
    return;
  }

  // Administradores de plataforma (§3.2; DD-70): nunca sin administradores
  if (p === '/platform/administrators' && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    if (!actor.platformAuthority) { problem(res, 403, 'Forbidden'); return; }
    const items = Object.values(accounts).filter((a) => a.platformAuthority).map((a) => ({ accountId: a.accountId, status: 'ACTIVE' }));
    send(res, 200, { items }, { 'Cache-Control': 'no-store' });
    return;
  }
  const platAdminMatch = p.match(/^\/platform\/administrators(?:\/([^/]+)\/revoke)?$/);
  if (platAdminMatch && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    if (!actor.platformAuthority) { problem(res, 403, 'Forbidden'); return; }
    if (platAdminMatch[1]) {
      const target = Object.values(accounts).find((a) => a.accountId === decodeURIComponent(platAdminMatch[1]));
      if (!target) { problem(res, 404, 'NotFound'); return; }
      if (!target.platformAuthority) { problem(res, 409, 'PlatformAuthorityNotHeld'); return; }
      if (Object.values(accounts).filter((a) => a.platformAuthority).length === 1) { problem(res, 409, 'LastPlatformAdministrator'); return; }
      delete target.platformAuthority;
      send(res, 200, { accountId: target.accountId });
      return;
    }
    const b = await readBody(req);
    if (!b || typeof b.accountId !== 'string' || !b.accountId.trim()) { problem(res, 400, 'InvalidRequestField'); return; }
    const target = Object.values(accounts).find((a) => a.accountId === b.accountId);
    if (!target) { problem(res, 404, 'NotFound'); return; }
    if (target.platformAuthority) { problem(res, 409, 'PlatformAuthorityAlreadyGranted'); return; }
    target.platformAuthority = 'ADMINISTRATOR';
    send(res, 201, { accountId: target.accountId, platformAuthority: 'ADMINISTRATOR' });
    return;
  }

  // Crear organización (R9; DD-68): cuenta sin organización → REPRESENTATIVE, PENDING_VERIFICATION
  if (p === '/organizations' && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const b = await readBody(req);
    if (!b || !['FOUNDATION', 'COMPANY'].includes(b.type)) { problem(res, 400, 'InvalidRequestField'); return; }
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 200) { problem(res, 400, 'InvalidRequestField'); return; }
    if (actor.organizationId) { problem(res, 409, 'AccountAlreadyBelongsToOrganization'); return; }
    const organizationId = 'org-' + crypto.randomUUID();
    organizations.set(organizationId, { name: b.name.trim(), type: b.type });
    organizationStatus.set(organizationId, 'PENDING_VERIFICATION');
    actor.organizationId = organizationId;
    actor.roles = ['REPRESENTATIVE'];
    send(res, 201, { organizationId, verificationStatus: 'PENDING_VERIFICATION' });
    return;
  }

  // Plataforma (DD-48): verify / reject / request-information; 404 inexistente; 409 si ya está resuelta
  const platformMatch = p.match(/^\/platform\/organizations\/([^/]+)\/(verify|reject|request-information)$/);
  if (platformMatch && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    if (!actor.platformAuthority) { problem(res, 403, 'Forbidden'); return; }
    const orgId = decodeURIComponent(platformMatch[1]);
    const decision = platformMatch[2];
    const b = await readBody(req);
    if (decision === 'request-information' && (!b || typeof b.message !== 'string' || !b.message.trim() || b.message.length > 2000)) {
      problem(res, 400, 'InvalidInformationRequestMessage'); return;
    }
    const current = organizationStatus.get(orgId);
    if (!current) { problem(res, 404, 'NotFound'); return; }
    if (current === 'VERIFIED' || current === 'REJECTED') { problem(res, 409, 'InvalidVerificationTransition'); return; }
    const next = { verify: 'VERIFIED', reject: 'REJECTED', 'request-information': 'NEEDS_MORE_INFORMATION' }[decision];
    organizationStatus.set(orgId, next);
    if (decision === 'request-information' && organizations.has(orgId)) organizations.get(orgId).informationRequest = b.message;
    if (next === 'VERIFIED') verifiedOrganizations.add(orgId);
    send(res, 200, { organizationId: orgId, verificationStatus: next });
    return;
  }

  // CV-03, retirar responsable (DD-50) y cerrar: mismas reglas de acceso que CV-02
  const adminMatch = p.match(/^\/campaigns\/([^/]+)\/(administrators|close|responsibles\/([^/]+)\/remove)$/);
  if (adminMatch && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const commandId = commandIdOf(req);
    if (!commandId) { problem(res, 400, 'BadRequest'); return; }
    const b = await readBody(req);
    const campaignRef = decodeURIComponent(adminMatch[1]);
    const c = [...campaigns.values()].find((x) => x.campaignRef === campaignRef);
    if (!c || c.organizationRef !== actor.organizationId || !actor.roles.includes('ADMINISTRATOR')) { problem(res, 403, 'Forbidden'); return; }
    const prev = claims.get(commandId);
    if (adminMatch[2] === 'close') {
      if (!prev && c.status === 'CLOSED') { problem(res, 409, 'CampaignAlreadyClosed'); return; }
      const r = claim(res, commandId, 'CLOSE_CONVOCATORIA', () => { c.status = 'CLOSED'; return { campaignRef, status: 'CLOSED' }; });
      if (r) send(res, 200, r.value);
      return;
    }
    if (c.status === 'CLOSED' && !prev) { problem(res, 409, 'ResponsibleAssignmentOnClosedCampaign'); return; }
    const recipientOk = (ref, role) => {
      const a = Object.values(accounts).find((x) => x.accountId === ref);
      return a && a.organizationId === c.organizationRef && a.roles.includes(role);
    };
    if (adminMatch[2] === 'administrators') {
      if (!b || !b.administratorRef) { problem(res, 400, 'BadRequest'); return; }
      if (!prev) {
        if (!recipientOk(b.administratorRef, 'ADMINISTRATOR')) { problem(res, 409, 'InvalidResponsibleRecipient'); return; }
        if (assignments.has(campaignRef + ':' + b.administratorRef)) { problem(res, 409, 'ResponsibleAlreadyActiveInCampaign'); return; }
      }
      const r = claim(res, commandId, 'DESIGNATE_ADMINISTRATOR', () => {
        const assignmentId = crypto.randomUUID();
        assignments.set(campaignRef + ':' + b.administratorRef, { assignmentId, actingRole: 'ADMINISTRATOR' });
        return { assignmentId };
      });
      if (r) send(res, 201, r.value);
      return;
    }
    const responsibleRef = decodeURIComponent(adminMatch[3]);
    const replacementRef = b && b.replacementRef;
    const role = b && b.replacementActingRole;
    if (replacementRef && !role) { problem(res, 400, 'ReplacementActingRoleRequired'); return; }
    if (role && !['EMPLOYEE', 'ADMINISTRATOR'].includes(role)) { problem(res, 400, 'BadRequest'); return; }
    if (!prev) {
      const current = assignments.get(campaignRef + ':' + responsibleRef);
      if (!current) { problem(res, 409, 'ResponsibleAssignmentNotFound'); return; }
      const count = [...assignments.keys()].filter((k) => k.startsWith(campaignRef + ':')).length;
      if (count === 1 && !replacementRef) { problem(res, 409, 'LastResponsibleRemovalWithoutReplacement'); return; }
      if (replacementRef && !recipientOk(replacementRef, role)) { problem(res, 409, 'InvalidResponsibleRecipient'); return; }
    }
    const r = claim(res, commandId, 'REMOVE_RESPONSIBLE', () => {
      const removed = assignments.get(campaignRef + ':' + responsibleRef);
      assignments.delete(campaignRef + ':' + responsibleRef);
      const out = { removedAssignmentId: removed.assignmentId };
      if (replacementRef) {
        out.replacementAssignmentId = crypto.randomUUID();
        assignments.set(campaignRef + ':' + replacementRef, { assignmentId: out.replacementAssignmentId, actingRole: role });
      }
      return out;
    });
    if (r) send(res, 200, r.value);
    return;
  }

  // CV-02 — POST /campaigns/{campaignRef}/employees
  const assignMatch = p.match(/^\/campaigns\/([^/]+)\/employees$/);
  if (assignMatch && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const commandId = commandIdOf(req);
    if (!commandId) { problem(res, 400, 'BadRequest'); return; }
    const b = await readBody(req);
    if (!b || !b.employeeRef) { problem(res, 400, 'BadRequest'); return; }
    const campaignRef = decodeURIComponent(assignMatch[1]);
    const c = [...campaigns.values()].find((x) => x.campaignRef === campaignRef);
    // Convocatoria inexistente, ajena o actor sin rol: el mismo 403
    if (!c || c.organizationRef !== actor.organizationId || !actor.roles.includes('ADMINISTRATOR')) { problem(res, 403, 'Forbidden'); return; }
    if (c.status === 'CLOSED') { problem(res, 409, 'ResponsibleAssignmentOnClosedCampaign'); return; }
    const prev = claims.get(commandId);
    if (!prev) {
      if (b.employeeRef === actor.accountId) { problem(res, 409, 'EmployeeSelfAssignmentNotAllowed'); return; }
      const employee = Object.values(accounts).find((a) => a.accountId === b.employeeRef);
      if (!employee || employee.organizationId !== c.organizationRef) { problem(res, 409, 'InvalidResponsibleRecipient'); return; }
      if (assignments.has(campaignRef + ':' + b.employeeRef)) { problem(res, 409, 'ResponsibleAlreadyActiveInCampaign'); return; }
      // Como el backend real (índice único parcial): un EMPLOYEE solo es responsable activo de una convocatoria; cerrar
      // la convocatoria no libera la asignación (D-06 de solicitudes-backend.md)
      if ([...assignments.entries()].some(([k, v]) => k.endsWith(':' + b.employeeRef) && v.actingRole === 'EMPLOYEE')) {
        problem(res, 409, 'EmployeeAlreadyAssigned'); return;
      }
    }
    const r = claim(res, commandId, 'ASSIGN_EMPLOYEE', () => {
      const assignmentId = crypto.randomUUID();
      assignments.set(campaignRef + ':' + b.employeeRef, { assignmentId, actingRole: 'EMPLOYEE' });
      return { assignmentId };
    });
    if (!r) return;
    send(res, 201, r.value);
    return;
  }

  // TR-01 a TR-03 — seguimiento con Authorization: Bearer <trackingCode> (TrackingCodeAuthFilter); nunca JWT
  if (p.startsWith('/donations/tracking') && req.method === 'GET') {
    const intent = intentByTrackingCode(req);
    if (!intent) { send(res, 401, { type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Invalid or missing tracking code' }); return; }
    if (p === '/donations/tracking') {
      const c = campaigns.get(intent.publicCode);
      const items = [...assets.values()].filter((a) => a.fundId === intent.fundId);
      send(res, 200, {
        financialSnapshot: {
          currency: intent.currency, originalAmount: Number(intent.amount), clearedAmount: Number(intent.amount),
          pendingAllocationAmount: 0, confirmedAllocationAmount: items.length ? Number(intent.amount) : 0, refundedAmount: 0,
        },
        campaignRef: c.campaignRef,
        logistics: items.map((a) => ({
          assetRef: a.assetRef, lifecycleStatus: a.lifecycleStatus, assetType: a.assetType, unitOfMeasure: a.unitOfMeasure,
          quantity: scale4(a.quantity), locationZone: 'Zona centro', custodianCategory: 'LOCAL_ALLY',
        })),
        status: items.length ? 'EN_PROCESO' : 'ACTIVA',
      });
      return;
    }
    if (p === '/donations/tracking/narrative') {
      const n = (narrativeCalls.get(intent.intentId) || 0) + 1;
      narrativeCalls.set(intent.intentId, n);
      if (n === 1) { send(res, 202, { status: 'PENDING' }); return; }
      send(res, 200, { status: 'AVAILABLE', content: 'Tu donación fue recibida y aplicada a la convocatoria.', source: 'FALLBACK_TEMPLATE' });
      return;
    }
    const hist = p.match(/^\/donations\/tracking\/assets\/([^/]+)\/history$/);
    if (hist) {
      const a = assets.get(decodeURIComponent(hist[1]));
      if (!a || a.fundId !== intent.fundId) { send(res, 401, { type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Invalid or missing token' }); return; }
      send(res, 200, { history: a.history.map((h) => ({ eventType: h.eventType, timestamp: h.timestamp, locationZone: 'Zona centro', custodianCategory: 'LOCAL_ALLY', status: h.status })) });
      return;
    }
    problem(res, 404, 'NotFound');
    return;
  }

  // GET /account/donations — JWT obligatorio; sin seudónimo ni donorRef
  if (p === '/account/donations' && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const items = [...intents.values()].filter((i) => i.donorAccount === actor.accountId).map((i) => {
      const out = { intentId: i.intentId, campaignTitle: i.campaignTitle, amount: i.amount, currency: i.currency, status: i.status };
      if (i.status === 'CONFIRMED' && i.trackingCode) out.trackingCode = i.trackingCode;
      return out;
    });
    send(res, 200, { items });
    return;
  }

  // Consulta de la intención — GET /public/donation-intents/{intentId}, cabecera Intent-Token
  const statusMatch = p.match(/^\/public\/donation-intents\/([^/]+)$/);
  if (statusMatch && req.method === 'GET') {
    const intent = intents.get(decodeURIComponent(statusMatch[1]));
    const token = req.headers['intent-token'];
    // El token en la URL no sirve: el mismo 404 que una intención inexistente
    if (!intent || !token || token !== intent.token || url.search.includes(intent.token)) { problem(res, 404, 'NotFound'); return; }
    const out = { status: intent.status };
    if (intent.status === 'CONFIRMED' && intent.trackingCode) out.trackingCode = intent.trackingCode;
    send(res, 200, out);
    return;
  }

  // Ficha N1 — GET /me (CONGELADA; el backend real aún no la expone: S-01)
  if (p === '/me' && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    if (actor.noMe) { problem(res, 404, 'NotFound'); return; }
    const me = { accountId: actor.accountId, roles: actor.roles };
    if (actor.organizationId) me.organizationId = actor.organizationId;
    if (actor.platformAuthority) me.platformAuthority = actor.platformAuthority;
    send(res, 200, me, { 'Cache-Control': 'no-store' });
    return;
  }

  // B6-c — activos (PhysicalAssetController)
  if (p.startsWith('/physical-assets')) {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const registerMatch = p === '/physical-assets/register' || p === '/physical-assets/from-donation';
    if (registerMatch && req.method === 'POST') {
      const commandId = commandIdOf(req);
      if (!commandId) { problem(res, 400, 'BadRequest'); return; }
      const b = await readBody(req);
      if (!b) { problem(res, 400, 'BadRequest'); return; }
      const pathA = p.endsWith('/register');
      const required = ['assetType', 'unitOfMeasure', 'custodianRef', 'currentLocation'].concat(pathA ? ['fundId', 'allocationId'] : []);
      if (!required.every((k) => text(b[k])) || typeof b.quantity !== 'string' || !QTY.test(b.quantity) || Number(b.quantity) <= 0) {
        problem(res, 400, 'BadRequest'); return;
      }
      if (!actor.organizationId || !canOperate(actor, true)) { problem(res, 403, 'Forbidden'); return; }
      let fund = null;
      if (pathA) {
        fund = [...intents.values()].find((i) => i.fundId === b.fundId);
        if (!fund) { problem(res, 404, 'NotFound'); return; }
      }
      const r = claim(res, commandId, pathA ? 'ASSET_REGISTER' : 'ASSET_REGISTER_FROM_DONATION', () => {
        const c = pathA ? campaigns.get(fund.publicCode) : null;
        const a = newAsset({
          organizationRef: actor.organizationId, assetType: b.assetType, quantity: b.quantity, unitOfMeasure: b.unitOfMeasure,
          currentCustodianRef: b.custodianRef, currentLocation: b.currentLocation,
          campaignRef: pathA ? c.campaignRef : (b.campaignRef || undefined), fundId: pathA ? b.fundId : undefined,
        });
        const out = { assetRef: a.assetRef, status: 'REGISTERED' };
        if (!pathA) out.donationRef = 'don-' + crypto.randomUUID();
        if (a.campaignRef) out.campaignRef = a.campaignRef;
        return out;
      });
      if (!r) return;
      send(res, 201, r.value);
      return;
    }

    const m = p.match(/^\/physical-assets\/([^/]+)(?:\/(split|dispatch|receive|deliver)|\/splits\/([^/]+))?$/);
    if (!m) { problem(res, 404, 'NotFound'); return; }
    const asset = assets.get(decodeURIComponent(m[1]));
    const action = m[2];
    const childRef = m[3] && decodeURIComponent(m[3]);
    const backup = action === 'split';
    // Inexistente u otra organización: el mismo 403 (DD-12)
    const allowed = asset && asset.organizationRef === actor.organizationId && canOperate(actor, backup);

    if (!action && !childRef && req.method === 'GET') {
      if (!allowed) { problem(res, 403, 'Forbidden'); return; }
      const out = { assetRef: asset.assetRef, lifecycleStatus: asset.lifecycleStatus, quantity: scale4(asset.quantity), unitOfMeasure: asset.unitOfMeasure };
      if (asset.currentCustodianRef) out.currentCustodianRef = asset.currentCustodianRef;
      if (asset.currentLocation) out.currentLocation = asset.currentLocation;
      if (asset.campaignRef) out.campaignRef = asset.campaignRef;
      send(res, 200, out);
      return;
    }
    if (childRef && req.method === 'GET') {
      if (!allowed) { problem(res, 403, 'Forbidden'); return; }
      const sp = splits.get(childRef);
      if (!sp || sp.parent !== asset.assetRef) { problem(res, 404, 'NotFound'); return; }
      sp.polls++;
      // La saga crea el hijo de forma asíncrona: PENDING en las dos primeras consultas
      if (sp.polls > 2 && sp.status === 'PENDING') {
        sp.status = 'CHILD_CREATED';
        newAsset({ ...asset, assetRef: childRef, quantity: sp.quantity, lifecycleStatus: 'REGISTERED',
          history: [{ eventType: 'ASSET_REGISTERED', timestamp: new Date().toISOString(), status: 'REGISTERED' }] });
      }
      send(res, 200, { status: sp.status });
      return;
    }
    if (action && req.method === 'POST') {
      const commandId = commandIdOf(req);
      if (!commandId) { problem(res, 400, 'BadRequest'); return; }
      const b = await readBody(req);
      if (!b) { problem(res, 400, 'BadRequest'); return; }
      const fields = { split: [], dispatch: ['carrierRef'], receive: ['facilityLocation', 'receiverRef'], deliver: ['finalCustodianRef', 'beneficiaryRef', 'locationRef', 'evidenceRef'] }[action];
      if (!fields.every((k) => text(b[k])) || (action === 'split' && (typeof b.quantity !== 'string' || !QTY.test(b.quantity) || Number(b.quantity) <= 0))) {
        problem(res, 400, 'BadRequest'); return;
      }
      if (!allowed) { problem(res, 403, 'Forbidden'); return; }
      const prev = claims.get(commandId);
      if (!prev) {
        if (asset.lifecycleStatus === 'DELIVERED') { problem(res, 409, 'AssetTerminalState'); return; }
        const next = { dispatch: ['REGISTERED', 'RECEIVED'], receive: ['DISPATCHED'], deliver: ['DISPATCHED', 'RECEIVED'], split: ['REGISTERED', 'DISPATCHED', 'RECEIVED'] }[action];
        if (!next.includes(asset.lifecycleStatus)) { problem(res, 409, 'InvalidAssetTransition'); return; }
        if (action === 'split' && Number(b.quantity) >= Number(asset.quantity)) { problem(res, 409, 'InsufficientQuantity'); return; }
      }
      const r = claim(res, commandId, 'ASSET_' + action.toUpperCase() + ':' + asset.assetRef, () => {
        const now = new Date().toISOString();
        if (action === 'split') {
          const child = crypto.randomUUID();
          splits.set(child, { parent: asset.assetRef, quantity: b.quantity, status: 'PENDING', polls: 0 });
          asset.quantity = String(Number(asset.quantity) - Number(b.quantity));
          asset.history.push({ eventType: 'ASSET_SPLIT', timestamp: now, status: asset.lifecycleStatus });
          return { parentAssetRef: asset.assetRef, childAssetRef: child, status: 'PENDING' };
        }
        const status = { dispatch: 'DISPATCHED', receive: 'RECEIVED', deliver: 'DELIVERED' }[action];
        asset.lifecycleStatus = status;
        if (action === 'receive') asset.currentLocation = b.facilityLocation;
        if (action === 'deliver') asset.currentCustodianRef = b.finalCustodianRef;
        asset.history.push({ eventType: 'ASSET_' + status, timestamp: now, status });
        return { assetRef: asset.assetRef, status };
      });
      if (!r) return;
      if (action === 'split') {
        send(res, 202, r.value, { Location: `${BASE}/physical-assets/${asset.assetRef}/splits/${r.value.childAssetRef}` });
      } else send(res, 200, r.value);
      return;
    }
    problem(res, 404, 'NotFound');
    return;
  }

  problem(res, 404, 'NotFound');
});

server.listen(PORT, () => {
  // Solo el puerto: nunca rutas, cabeceras ni cuerpos (secretos bearer)
  process.stdout.write(`Fake backend listening on port ${PORT}\n`);
});
