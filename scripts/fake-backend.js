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
  'donante@demo.test': { password: 'demo-donante', accountId: 'acc-donor', roles: [] },
  // Para probar el backend real de hoy, que todavía no expone /me (S-01): para esta cuenta /me responde 404
  'sin-me@demo.test': { password: 'demo-sin-me', accountId: 'acc-no-me', organizationId: 'org-1', roles: ['ADMINISTRATOR'], noMe: true },
};

// Tokens de los tests existentes (W-4): equivalen a la cuenta administradora
const tokens = new Map([
  ['fake-jwt-token', 'admin@demo.test'],
  ['fake-jwt-token-for-security', 'admin@demo.test'],
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
  acceptedPaymentMethods: ['GATEWAY', 'BANK_TRANSFER'], currency: 'COP', targetAmount: '500000000', clearedAmount: '125000000',
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
/** Activos por fondo: la logística del seguimiento (TR-01) y su historial (TR-03). */
const assets = new Map();
const narrativeCalls = new Map();

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
          quantity: a.quantity, locationZone: 'Zona centro', custodianCategory: 'LOCAL_ALLY',
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
    send(res, 200, me, { 'Cache-Control': 'no-store' });
    return;
  }

  // B6-c — GET /physical-assets/{assetRef} (OperationalResponse)
  const assetMatch = p.match(/^\/physical-assets\/([^/]+)$/);
  if (assetMatch && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    send(res, 200, {
      assetRef: decodeURIComponent(assetMatch[1]), lifecycleStatus: 'REGISTERED', currentCustodianRef: 'CUST-1',
      currentLocation: 'LOC-1', quantity: '1', unitOfMeasure: 'EA', campaignRef: 'CAMP-1',
    });
    return;
  }

  problem(res, 404, 'NotFound');
});

server.listen(PORT, () => {
  // Solo el puerto: nunca rutas, cabeceras ni cuerpos (secretos bearer)
  process.stdout.write(`Fake backend listening on port ${PORT}\n`);
});
