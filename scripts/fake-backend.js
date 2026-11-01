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
  // Cuentas con dominio demo.paxfide.local (como en la semilla del backend real y credenciales-locales.md)
  'representante@demo.paxfide.local': { password: 'demo-local-password', accountId: 'acc-rep', organizationId: 'org-1', roles: ['REPRESENTATIVE'] },
  'administrador@demo.paxfide.local': { password: 'demo-local-password', accountId: 'acc-admin', organizationId: 'org-1', roles: ['ADMINISTRATOR'] },
  'empleado@demo.paxfide.local': { password: 'demo-local-password', accountId: 'acc-employee', organizationId: 'org-1', roles: ['EMPLOYEE'] },
  'empleado1@demo.paxfide.local': { password: 'demo-local-password', accountId: 'acc-employee', organizationId: 'org-1', roles: ['EMPLOYEE'] },
  'empleado2@demo.paxfide.local': { password: 'demo-local-password', accountId: 'acc-employee-2', organizationId: 'org-1', roles: ['EMPLOYEE'] },
  'donante@demo.paxfide.local': { password: 'demo-local-password', accountId: 'acc-donor', roles: [] },
  'plataforma@demo.paxfide.local': { password: 'demo-local-password', accountId: 'acc-platform', roles: [], platformAuthority: 'ADMINISTRATOR' },
  // Para probar el backend real de hoy, que todavía no expone /me (S-01): para esta cuenta /me responde 404
  'sin-me@demo.test': { password: 'demo-sin-me', accountId: 'acc-no-me', organizationId: 'org-1', roles: ['ADMINISTRATOR'], noMe: true },
};

accounts['legacy@demo.test'] = { password: null, accountId: 'acc-legacy', organizationId: 'org-1', roles: ['ADMINISTRATOR', 'EMPLOYEE'] };
// Tokens de los tests existentes (W-4): cuenta de la organización con los dos roles
const tokens = new Map([
  ['fake-jwt-token', 'legacy@demo.test'],
  ['fake-jwt-token-for-security', 'legacy@demo.test'],
]);

// referencia-api-v1.md §1, nota R-5 (plan-fase7-puesta-al-dia.md §1.2): versiones legales vigentes. Las cuentas de
// siempre ya las aceptaron (los E2E existentes no cambian); `/__test/acceptance-pending` deja una cuenta pendiente,
// como las de la semilla del backend real tras desplegar D3.
const LEGAL = 'v1-2026-10';
for (const acc of Object.values(accounts)) { acc.acceptedTermsVersion = LEGAL; acc.acceptedDataPolicyVersion = LEGAL; }
// ADR-050 Enmienda 2 (referencia-api-v1.md §1, nota del 2026-10-29): las cuentas de la semilla nacen verificadas; las
// registradas, sin verificar, con un enlace de un solo uso (24 h) a /verificar-correo#token=…
for (const acc of Object.values(accounts)) acc.emailVerified = true;
const verifyTokens = new Map(); // token -> { email, used, superseded, at }
const verifyMails = [];
const verifyCooldown = new Map(); // email -> ms de la última petición que envió correo
function sendVerification(email) {
  for (const v of verifyTokens.values()) if (v.email === email) v.superseded = true;
  verifyTokens.set('vrf-' + crypto.randomBytes(24).toString('base64url'), { email, used: false, superseded: false, at: Date.now() });
  verifyCooldown.set(email, Date.now());
  verifyMails.push(email);
}
// ADR-051 T4: fotos de entrega subidas (`evidenceRef` → organización y activo al que quedaron vinculadas)
const evidences = new Map();
const EVIDENCE_MAX = 5 * 1024 * 1024;
const evidenceFailures = [];
// P-1 (referencia-api-v1.md §1, notas del 2026-10-25): recuperación, revocación y perfil
const resetTokens = new Map(); // token -> { email, used, superseded, at }
const resetMails = [];
const resetCooldown = new Map(); // email -> ms de la última petición que envió correo
const passwordChange500 = new Set();
// Anexo 6 (ADR-050 D9): los idToken de prueba son `fake-google.<sub>.<correo>`; nunca un token real de Google.
// `googleUnavailable` hace que la siguiente llamada a Google responda 503 GoogleSignInUnavailable.
let googleUnavailable = 0;
let gsiLoads = 0;
function googleIdentity(idToken) {
  const m = /^fake-google\.([A-Za-z0-9_-]+)\.(.+@.+)$/.exec(String(idToken || ''));
  return m ? { sub: m[1], email: m[2].toLowerCase() } : null;
}

/** Revocación (ADR-050 D4): ningún token anterior de esa cuenta vale (todas sus direcciones). */
function revokeTokensOf(acc) {
  for (const [t, e] of [...tokens.entries()]) if (accounts[e] && accounts[e].accountId === acc.accountId) tokens.delete(t);
}

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
  organizationLogo: true,
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
/** Invitaciones (ADR-049): id → {organizationId, email, role, token, status, createdAt, expiresAt}. */
const invitations = new Map();
/** Estado de verificación de las organizaciones del doble (plataforma, DD-48). */
const organizationStatus = new Map([['org-1', 'VERIFIED'], ['org-2', 'PENDING_VERIFICATION'], ['org-3', 'PENDING_VERIFICATION']]);
/** Ficha de las organizaciones del doble (cola de verificación, DD-69): nombre, tipo, petición de información y orden. */
const organizations = new Map([
  ['org-1', { name: 'Fundación Demo', type: 'FOUNDATION', profile: {
    description: 'Fundación de demostración del servidor falso.', website: 'https://fundacion-demo.example',
    location: { departmentCode: '05', municipalityCode: '05001' }, contactEmail: 'contacto@fundacion-demo.example',
    legalName: 'Fundación Demo S.A.S. (prueba)', nit: '900123456', nitCheckDigit: '8', specialTaxRegime: true, contactPhone: '3001234567' } }],
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

/** Transiciones sin ubicación: su `locationZone` llega null (referencia-api-v1.md §8, TR-03). */
const NO_ZONE_EVENTS = new Set(['ASSET_DISPATCHED', 'ASSET_SPLIT', 'ASSET_CUSTODY_TRANSFERRED', 'ASSET_SPLIT_COMPENSATED', 'ASSET_DEPLETED']);

const campaignByRef = (ref) => [...campaigns.values()].find((c) => c.campaignRef === ref);

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
  // Notas del 2026-10-18 y del 2026-10-21 (referencia-api-v1.md §5): verificación siempre presente; logo solo si hay
  out.organizationVerified = organizationStatus.get(c.organizationRef) === 'VERIFIED';
  if (c.organizationLogo || orgLogos.has(c.organizationRef)) out.organizationLogoUrl = `/api/v1/public/campaigns/${c.publicCode}/organization-logo`;
  // U-6 (nota del 2026-10-25, Tarea 3): la portada, solo si la tiene
  if (covers.has(c.publicCode)) out.coverImageUrl = `/api/v1/public/campaigns/${c.publicCode}/cover`;
  // Ficha R-7: lo público del perfil de la organización
  const op = publicOrganizationProfile(c.organizationRef);
  if (op) out.organizationProfile = op;
  return out;
}

// ----- Ficha R-7 (referencia-api-v1.md §3, nota del 2026-10-31): perfil de la organización -----
// CATÁLOGO DE PRUEBA, reducido: NO es el DIVIPOLA del DANE. La web nunca incluye el catálogo; lo pide a
// GET /public/locations, y en el backend real viene de divipola.json (DIVIPOLA-2026-09).
const TEST_LOCATIONS = {
  catalogVersion: 'PRUEBA-NO-DIVIPOLA',
  departments: [
    { code: '05', name: 'Antioquia (prueba)', municipalities: [{ code: '05001', name: 'Medellín (prueba)' }, { code: '05266', name: 'Envigado (prueba)' }] },
    { code: '11', name: 'Bogotá, D.C. (prueba)', municipalities: [{ code: '11001', name: 'Bogotá, D.C. (prueba)' }] },
    { code: '23', name: 'Córdoba (prueba)', municipalities: [{ code: '23001', name: 'Montería (prueba)' }] },
  ],
};
const PROFILE_FIELDS = ['description', 'website', 'location', 'contactEmail', 'legalName', 'nit', 'nitCheckDigit', 'specialTaxRegime', 'contactPhone'];
function nitDigit(n) {
  const W = [3, 7, 13, 17, 19, 23, 29, 37, 41];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(n[8 - i]) * W[i];
  const r = sum % 11;
  return r <= 1 ? r : 11 - r;
}
/** Como OrganizationProfile.from: devuelve el perfil limpio o el nombre del primer campo inválido. */
function parseProfile(b, type) {
  const cp = (v) => Array.from(v).length;
  const out = {};
  const text = (k, max) => {
    if (b[k] === undefined || b[k] === null) return true;
    if (typeof b[k] !== 'string') return false;
    const t = b[k].trim();
    if (cp(t) < 1 || cp(t) > max) return false;
    out[k] = t; return true;
  };
  if (!text('description', 500) || (out.description && /[<>]/.test(out.description))) return { field: 'description' };
  if (b.website != null) {
    let ok = typeof b.website === 'string';
    try { const u = new URL(b.website.trim()); ok = ok && u.protocol === 'https:' && !!u.hostname && !u.username && b.website.trim().length <= 200; } catch { ok = false; }
    if (!ok) return { field: 'website' };
    out.website = b.website.trim();
  }
  if (b.location != null) {
    const l = b.location;
    const dep = l && TEST_LOCATIONS.departments.find((d) => d.code === l.departmentCode);
    if (!dep || !dep.municipalities.some((m) => m.code === l.municipalityCode)) return { field: 'location' };
    out.location = { departmentCode: l.departmentCode, municipalityCode: l.municipalityCode };
  }
  if (b.contactEmail != null) {
    if (typeof b.contactEmail !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.contactEmail.trim())) return { field: 'contactEmail' };
    out.contactEmail = b.contactEmail.trim().toLowerCase();
  }
  if (!text('legalName', 200)) return { field: 'legalName' };
  if (b.nit != null || b.nitCheckDigit != null) {
    if (typeof b.nit !== 'string' || !/^\d{9}$/.test(b.nit)) return { field: 'nit' };
    if (typeof b.nitCheckDigit !== 'string' || !/^\d$/.test(b.nitCheckDigit) || Number(b.nitCheckDigit) !== nitDigit(b.nit)) return { field: 'nitCheckDigit' };
    out.nit = b.nit; out.nitCheckDigit = b.nitCheckDigit;
  }
  if (b.specialTaxRegime != null) {
    if (typeof b.specialTaxRegime !== 'boolean' || (b.specialTaxRegime && type !== 'FOUNDATION')) return { field: 'specialTaxRegime' };
    out.specialTaxRegime = b.specialTaxRegime;
  }
  if (b.contactPhone != null) {
    if (typeof b.contactPhone !== 'string' || !/^(3\d{9}|60\d{8})$/.test(b.contactPhone)) return { field: 'contactPhone' };
    out.contactPhone = b.contactPhone;
  }
  return { profile: out };
}
const nitTaken = (nit, exceptId) => [...organizations.entries()].some(([id, o]) => id !== exceptId && o.profile && o.profile.nit === nit);
/** Lo público del perfil para CV-07, con los nombres del catálogo; nunca NIT, razón social, teléfono ni régimen. */
function publicOrganizationProfile(orgId) {
  const o = organizations.get(orgId);
  const pr = o && o.profile;
  if (!pr) return undefined;
  const out = {};
  if (pr.description) out.description = pr.description;
  if (pr.website) out.website = pr.website;
  if (pr.location) {
    const dep = TEST_LOCATIONS.departments.find((d) => d.code === pr.location.departmentCode);
    const mun = dep && dep.municipalities.find((m) => m.code === pr.location.municipalityCode);
    if (dep && mun) out.location = { departmentName: dep.name, municipalityName: mun.name };
  }
  if (pr.contactEmail) out.contactEmail = pr.contactEmail;
  // Solo para la prueba negativa de la web: el doble mete datos privados si se le pide (/__test/leak-private-profile)
  if (o.leakPrivate) Object.assign(out, { nit: pr.nit, legalName: pr.legalName, contactPhone: pr.contactPhone, specialTaxRegime: pr.specialTaxRegime });
  return Object.keys(out).length ? out : undefined;
}

/** Logo de demostración: un PNG de 1×1 (los bytes no importan al front, solo que sea una imagen del backend). */
// P-4 (ADR-051 F6, F7, F8): logos subidos por organización y portadas por convocatoria, con sus bytes
const orgLogos = new Map();
const covers = new Map();
/** JPEG o PNG por el contenido (como el backend), nunca por el nombre ni el tipo declarado. */
const isImage = (b) => (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const imageType = (b) => (b[0] === 0xff ? 'image/jpeg' : 'image/png');
const IMAGE_MAX = 2 * 1024 * 1024;

const DEMO_LOGO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

/** Fallos forzados por los tests: el siguiente POST cuya ruta empiece por `prefix` falla con `mode`. */
const failures = [];
const delays = [];

const sha256Hex = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
/** Árbol de Merkle de E1.3: padre = SHA-256 del texto hexadecimal izquierdo + derecho; el último impar consigo mismo. */
function merkleLevels(leaves) {
  const levels = [leaves];
  while (levels[levels.length - 1].length > 1) {
    const l = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < l.length; i += 2) next.push(sha256Hex(l[i] + (l[i + 1] ?? l[i])));
    levels.push(next);
  }
  return levels;
}
const merkleRoot = (leaves) => { const lv = merkleLevels(leaves); return lv[lv.length - 1][0]; };
function merklePath(leaves, index) {
  const path = [];
  let i = index;
  for (const l of merkleLevels(leaves).slice(0, -1)) {
    if (i % 2 === 0) path.push({ side: 'RIGHT', hash: l[i + 1] ?? l[i] });
    else path.push({ side: 'LEFT', hash: l[i - 1] });
    i = Math.floor(i / 2);
  }
  return path;
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : null); } catch { resolve(undefined); }
    });
  });
}

function readRaw(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/** El primer archivo de un `multipart/form-data` con el campo `name` (suficiente para el navegador de los tests). */
function multipartFile(req, raw, name) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/.exec(req.headers['content-type'] || '');
  if (!m) return null;
  const boundary = Buffer.from('--' + (m[1] || m[2]).trim());
  let start = raw.indexOf(boundary);
  while (start >= 0) {
    const next = raw.indexOf(boundary, start + boundary.length);
    if (next < 0) break;
    const part = raw.subarray(start + boundary.length + 2, next - 2);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd >= 0) {
      const head = part.subarray(0, headerEnd).toString('utf8');
      if (new RegExp(`name="${name}"`).test(head)) return part.subarray(headerEnd + 4);
    }
    start = next;
  }
  return null;
}

function accountOf(req) {
  const h = req.headers['authorization'];
  if (!h || !h.startsWith('Bearer ')) return null;
  const email = tokens.get(h.slice(7));
  const acc = email ? accounts[email] : null;
  return acc && acc.status !== 'INACTIVE' ? acc : null;
}

function emailOf(req) {
  return tokens.get(String(req.headers['authorization'] || '').slice(7));
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Command-Id, Intent-Token, x-test-delay-ms');
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
  // P-1: el buzón de la recuperación (como Mailpit): el enlace del último correo de recuperación a una dirección
  if (path === '/__test/password-reset/last' && req.method === 'GET') {
    const email = (url.searchParams.get('email') || '').toLowerCase();
    const r = [...resetTokens.entries()].filter(([, v]) => v.email === email).pop();
    send(res, r ? 200 : 404, r ? { link: `/recuperar#token=${r[0]}`, sent: resetMails.filter((m) => m === email).length } : { ok: false });
    return;
  }
  // P-1: el próximo cambio de contraseña de esa cuenta se aplica y responde 500 (nota ADR-038 #7)
  // P-6: el buzón de la verificación (como Mailpit): el enlace del último correo de verificación a una dirección
  if (path === '/__test/email-verification/last' && req.method === 'GET') {
    const email = (url.searchParams.get('email') || '').toLowerCase();
    const r = [...verifyTokens.entries()].filter(([, v]) => v.email === email).pop();
    send(res, r ? 200 : 404, r ? { link: `/verificar-correo#token=${r[0]}`, sent: verifyMails.filter((m) => m === email).length } : { ok: false });
    return;
  }
  // P-6: una cuenta pasa a "sin verificar" con su sesión abierta (cuentas anteriores a la Enmienda 2, Q2 (a))
  if (path === '/__test/unverify' && req.method === 'POST') {
    const body = await readBody(req);
    const acc = body && accounts[String(body.email || '').toLowerCase()];
    if (!acc) { send(res, 404, { ok: false }); return; }
    acc.emailVerified = false;
    send(res, 200, { ok: true });
    return;
  }
  // Anexo 6: el doble de Google Identity Services (https://accounts.google.com/gsi/client) para los E2E. El botón entrega
  // como credential lo que el test deje en window.__gisNextCredential; cuenta las cargas en window.__gisLoads
  if (path === '/__test/gsi-client.js' && req.method === 'GET') {
    gsiLoads += 1;
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`(function(){
  window.__gisLoads = (window.__gisLoads || 0) + 1;
  var cfg = null;
  window.google = { accounts: { id: {
    initialize: function (c) { cfg = c; },
    renderButton: function (el, opts) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-testid', 'gis-stub-button');
      b.setAttribute('data-gis-theme', (opts && opts.theme) || '');
      b.textContent = 'Google (doble de prueba)';
      b.onclick = function () { if (cfg) cfg.callback({ credential: window.__gisNextCredential || '' }); };
      el.appendChild(b);
    }
  } } };
})();`);
    return;
  }
  if (path === '/__test/gsi-client/loads' && req.method === 'GET') { send(res, 200, { loads: gsiLoads }); return; }
  // Anexo 6: la siguiente llamada que verifica un idToken responde 503 GoogleSignInUnavailable
  if (path === '/__test/google-unavailable' && req.method === 'POST') {
    googleUnavailable += 1;
    send(res, 200, { ok: true });
    return;
  }
  // P-15: la prueba negativa de CV-07 pide al doble que meta datos privados del perfil en la respuesta pública
  if (path === '/__test/leak-private-profile' && req.method === 'POST') {
    const body = await readBody(req);
    const o = body && organizations.get(body.organizationId);
    if (!o) { send(res, 404, { ok: false }); return; }
    o.leakPrivate = true;
    send(res, 200, { ok: true });
    return;
  }
  if (path === '/__test/password-change-500' && req.method === 'POST') {
    const body = await readBody(req);
    passwordChange500.add(String((body && body.email) || '').toLowerCase());
    send(res, 200, { ok: true });
    return;
  }
  // La cuenta pasa a tener las versiones legales pendientes (cuentas anteriores a R-5 y semilla tras D3)
  if (path === '/__test/acceptance-pending' && req.method === 'POST') {
    const body = await readBody(req);
    const acc = body && accounts[String(body.email || '').toLowerCase()];
    if (!acc) { send(res, 404, { ok: false }); return; }
    if (body.terms !== false) delete acc.acceptedTermsVersion;
    if (body.dataPolicy !== false) delete acc.acceptedDataPolicyVersion;
    send(res, 200, { ok: true });
    return;
  }
  // La siguiente subida de evidencia responde con este estado (410 EvidenceRemoved, 503, 413, 415)
  if (path === '/__test/evidence-fail' && req.method === 'POST') {
    const body = await readBody(req);
    evidenceFailures.push(Number(body.status));
    send(res, 200, { ok: true });
    return;
  }
  // Cuántas fotos de evidencia se subieron (para comprobar que un reintento no vuelve a subir)
  if (path === '/__test/evidence/count' && req.method === 'GET') {
    send(res, 200, { uploads: evidences.__uploads || 0 });
    return;
  }
  if (path === '/__test/delay' && req.method === 'POST') {

    const body = await readBody(req);
    delays.push({ prefix: body.prefix, ms: Number(body.ms) });
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
      intent.confirmedAt = new Date().toISOString();
      intent.clearedAt = intent.confirmedAt; // G-2: un solo FUNDS_CLEARED (primero y último iguales)
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
  // El test hace de buzón de correo (como Mailpit en la demo real): el enlace de la última invitación a un correo
  if (path === '/__test/invitations/last' && req.method === 'GET') {
    const email = (url.searchParams.get('email') || '').toLowerCase();
    const inv = [...invitations.values()].filter((i) => i.email === email).pop();
    send(res, inv ? 200 : 404, inv ? { link: `/invitaciones#token=${inv.token}` } : { ok: false });
    return;
  }

  if (path === '/__test/campaigns' && req.method === 'POST') {
    const body = (await readBody(req)) || {};
    const code = '01JT' + crypto.randomBytes(16).toString('hex').toUpperCase().slice(0, 22);
    addCampaign(code, {
      campaignRef: 'camp-' + crypto.randomUUID(), organizationRef: 'org-1', organizationName: 'Fundación Demo',
      title: body.title || 'Convocatoria de prueba', status: 'OPEN', startDate: '2026-10-01T00:00:00Z',
      endDate: '2026-12-31T23:59:59Z', acceptedDonationTypes: ['MONETARY'], acceptedPaymentMethods: ['GATEWAY', 'BANK_TRANSFER'],
      currency: 'COP', targetAmount: '100000000', clearedAmount: '0',
      ...(body.visibility === 'PRIVATE_LINK' ? { visibility: 'PRIVATE_LINK' } : {}),
      // P-12: fechas y tipos a medida para probar el orden y el filtro de la ficha R-1
      ...(body.startDate ? { startDate: body.startDate } : {}),
      ...(body.endDate ? { endDate: body.endDate } : {}),
      ...(body.acceptedDonationTypes ? { acceptedDonationTypes: body.acceptedDonationTypes } : {}),
      ...(body.status === 'CLOSED' ? { status: 'CLOSED' } : {}),
    });
    send(res, 200, { publicCode: code });
    return;
  }

  if (!path.startsWith(BASE)) { send(res, 404); return; }
  const p = path.slice(BASE.length);

  const testDelay = Number(req.headers['x-test-delay-ms'] || 0);
  if (testDelay > 0) {
    await new Promise((r) => setTimeout(r, testDelay));
  }

  const dIdx = delays.findIndex((d) => p.startsWith(d.prefix));
  if (dIdx >= 0) {
    const d = delays.splice(dIdx, 1)[0];
    await new Promise((r) => setTimeout(r, d.ms));
  }

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
    // R-5: las dos versiones vigentes, o 400 BadRequest sin cuenta creada
    if (body.acceptedTermsVersion !== LEGAL || body.acceptedDataPolicyVersion !== LEGAL) { problem(res, 400, 'BadRequest'); return; }
    if (accounts[body.email]) { problem(res, 409, 'DuplicateEmail'); return; }
    const accountId = crypto.randomUUID();
    accounts[body.email] = { password: body.password, accountId, roles: [], acceptedTermsVersion: LEGAL, acceptedDataPolicyVersion: LEGAL, emailVerified: false };
    // Enmienda 2: la cuenta nace sin verificar y se envía el enlace; la respuesta no espera al envío
    sendVerification(String(body.email).toLowerCase());
    send(res, 201, { accountId, status: 'ACTIVE' });
    return;
  }

  // ID-01 — POST /auth/login
  if (p === '/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.email || !body.password) { problem(res, 400, 'Bad Request'); return; }
    const acc = accounts[body.email];
    // Una cuenta que cambió o recuperó la contraseña solo entra con la suya (sin los atajos de las cuentas de la demo)
    const passwordMatches = acc && acc.status !== 'INACTIVE' && (acc.passwordChanged ? acc.password === body.password : (
      acc.password === body.password ||
      (body.password === 'demo-local-password' && acc.password) ||
      (acc.password === 'demo-local-password' && (body.password === 'demo-representante' || body.password === 'demo-admin' || body.password === 'demo-empleado'))
    ));
    if (!acc || !passwordMatches) { problem(res, 401, 'Unauthorized'); return; }
    // Enmienda 2 (E2-3): con la contraseña correcta y el correo sin verificar, 403 EmailNotVerified sin token; va antes
    // que AcceptanceRequired
    if (acc.emailVerified === false) {
      send(res, 403, { type: 'about:blank', title: 'EmailNotVerified', status: 403, detail: 'The email must be verified' });
      return;
    }
    // D3: con la contraseña correcta, las versiones que falten tienen que venir EXACTAMENTE en el cuerpo; si no, 403
    const missingTerms = acc.acceptedTermsVersion !== LEGAL;
    const missingData = acc.acceptedDataPolicyVersion !== LEGAL;
    if ((missingTerms && body.acceptedTermsVersion !== LEGAL) || (missingData && body.acceptedDataPolicyVersion !== LEGAL)) {
      const pending = {};
      if (missingTerms) pending.pendingTermsVersion = LEGAL;
      if (missingData) pending.pendingDataPolicyVersion = LEGAL;
      send(res, 403, { type: 'about:blank', title: 'AcceptanceRequired', status: 403, detail: DETAILS[403], ...pending });
      return;
    }
    if (missingTerms) acc.acceptedTermsVersion = LEGAL;
    if (missingData) acc.acceptedDataPolicyVersion = LEGAL;
    const token = 'tok-' + crypto.randomUUID();
    tokens.set(token, body.email);
    send(res, 200, { token });
    return;
  }

  // ADR-050 D9 — POST /auth/google, como GoogleSignInController: 400 sin idToken; el mismo 401 sin motivo (token
  // inválido, sin vínculo o INACTIVE); 403 EmailNotVerified; 403 AcceptanceRequired; 503 si Google no responde
  if (p === '/auth/google' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.idToken) { problem(res, 400, 'Bad Request'); return; }
    if (googleUnavailable > 0) { googleUnavailable -= 1; problem(res, 503, 'GoogleSignInUnavailable'); return; }
    const g = googleIdentity(body.idToken);
    const entry = g && Object.entries(accounts).find(([, a]) => a.googleSubject === g.sub);
    if (!entry || entry[1].status === 'INACTIVE') { problem(res, 401, 'Unauthorized'); return; }
    const [email, acc] = entry;
    if (acc.emailVerified === false) {
      send(res, 403, { type: 'about:blank', title: 'EmailNotVerified', status: 403, detail: 'The email must be verified' });
      return;
    }
    const missingTerms = acc.acceptedTermsVersion !== LEGAL;
    const missingData = acc.acceptedDataPolicyVersion !== LEGAL;
    if ((missingTerms && body.acceptedTermsVersion !== LEGAL) || (missingData && body.acceptedDataPolicyVersion !== LEGAL)) {
      const pending = {};
      if (missingTerms) pending.pendingTermsVersion = LEGAL;
      if (missingData) pending.pendingDataPolicyVersion = LEGAL;
      send(res, 403, { type: 'about:blank', title: 'AcceptanceRequired', status: 403, detail: DETAILS[403], ...pending });
      return;
    }
    if (missingTerms) acc.acceptedTermsVersion = LEGAL;
    if (missingData) acc.acceptedDataPolicyVersion = LEGAL;
    const token = 'tok-' + crypto.randomUUID();
    tokens.set(token, email);
    send(res, 200, { token });
    return;
  }

  const actor = accountOf(req);

  // ADR-050 D9 — POST y DELETE /account/google/link, como GoogleLinkController: la contraseña primero (400
  // CurrentPasswordIncorrect, también ausente), después el idToken (400 GoogleIdTokenInvalid), los dos 409 y el 503.
  // Repetir la misma vinculación o desvincular sin vínculo → 204 sin cambios. Mismo correo → la cuenta queda verificada
  if (p === '/account/google/link' && (req.method === 'POST' || req.method === 'DELETE')) {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const body = (await readBody(req)) || {};
    if (!body.currentPassword || body.currentPassword !== actor.password) { problem(res, 400, 'CurrentPasswordIncorrect'); return; }
    if (req.method === 'DELETE') {
      delete actor.googleSubject;
      res.writeHead(204); res.end();
      return;
    }
    if (googleUnavailable > 0) { googleUnavailable -= 1; problem(res, 503, 'GoogleSignInUnavailable'); return; }
    const g = googleIdentity(body.idToken);
    if (!g) { problem(res, 400, 'GoogleIdTokenInvalid'); return; }
    const other = Object.values(accounts).find((a) => a !== actor && a.googleSubject === g.sub);
    if (other) { problem(res, 409, 'GoogleAccountAlreadyLinked'); return; }
    if (actor.googleSubject && actor.googleSubject !== g.sub) { problem(res, 409, 'AccountAlreadyLinkedToGoogle'); return; }
    actor.googleSubject = g.sub;
    if (g.email === String(emailOf(req) || '').toLowerCase()) actor.emailVerified = true;
    res.writeHead(204); res.end();
    return;
  }

  // GET /public/campaigns?cursor= (PublicCampaignDiscoveryController): solo PUBLIC y OPEN, 20 por página, cursor opaco
  // Ficha R-1 (referencia-api-v1.md §5, nota del 2026-10-29), como PublicCampaignDiscoveryController: q (2..100 puntos
  // de código tras recortar, subcadena del título sin mayúsculas ni tildes), donationType, sort y cursor v2 con los
  // filtros dentro; se valida en ese orden y cualquier fallo es el mismo 400 BadRequest
  if (p === '/public/campaigns' && req.method === 'GET') {
    const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const sp = url.searchParams;
    const bad = () => problem(res, 400, 'BadRequest');
    let q = null;
    if (sp.has('q')) {
      const t = sp.get('q').trim();
      const n = Array.from(t).length;
      if (n < 2 || n > 100) { bad(); return; }
      q = norm(t);
    }
    const type = sp.get('donationType');
    if (type !== null && !['MONETARY', 'IN_KIND'].includes(type)) { bad(); return; }
    const sort = sp.get('sort');
    if (sort !== null && !['ending_soon', 'recent'].includes(sort)) { bad(); return; }
    let all = [...campaigns.values()].filter((c) => c.status === 'OPEN' && (c.visibility || 'PUBLIC') === 'PUBLIC')
      .filter((c) => q === null || norm(c.title).includes(q))
      .filter((c) => type === null || (c.acceptedDonationTypes || []).includes(type));
    const byCode = (a, b) => (a.publicCode < b.publicCode ? -1 : a.publicCode > b.publicCode ? 1 : 0);
    if (sort === 'ending_soon') all.sort((a, b) => (a.endDate || '').localeCompare(b.endDate || '') || byCode(a, b));
    else if (sort === 'recent') all.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '') || byCode(a, b));
    else all.sort(byCode);
    let start = 0;
    const cursor = sp.get('cursor');
    if (cursor !== null) {
      let c;
      try { c = JSON.parse(Buffer.from(cursor, 'base64url').toString()); } catch { c = null; }
      // v1 (un publicCode a secas) solo sin filtros ni orden; v2 lleva {v:2, q, type, sort, after}
      if (c === null && q === null && type === null && sort === null) {
        const after = Buffer.from(cursor, 'base64url').toString();
        if (!campaigns.has(after)) { bad(); return; }
        start = all.findIndex((x) => x.publicCode > after);
      } else if (c && c.v === 2 && c.q === q && c.type === type && c.sort === sort) {
        start = all.findIndex((x) => x.publicCode === c.after) + 1;
        if (start === 0) { bad(); return; }
      } else { bad(); return; }
      if (start < 0) start = all.length;
    }
    const page = all.slice(start, start + 20);
    const out = { items: page.map((c) => { const v = publicView(c); delete v.description; delete v.acceptedPaymentMethods; return { publicCode: c.publicCode, ...v }; }) };
    if (start + 20 < all.length) {
      out.nextCursor = Buffer.from(JSON.stringify({ v: 2, q, type, sort, after: page[page.length - 1].publicCode })).toString('base64url');
    }
    send(res, 200, out);
    return;
  }

  // GET /public/campaigns/{publicCode}/organization-logo (ADR-051 Tarea 2): bytes del logo o 404, siempre el mismo
  const logoMatch = p.match(/^\/public\/campaigns\/([^/]+)\/organization-logo$/);
  if (logoMatch && req.method === 'GET') {
    const c = campaigns.get(decodeURIComponent(logoMatch[1]));
    const uploaded = c && orgLogos.get(c.organizationRef);
    if (!c || (!c.organizationLogo && !uploaded)) { problem(res, 404, 'NotFound'); return; }
    res.writeHead(200, { 'Content-Type': uploaded ? imageType(uploaded) : 'image/png', 'Cache-Control': 'public, max-age=3600' });
    res.end(uploaded || DEMO_LOGO);
    return;
  }
  // GET /public/campaigns/{publicCode}/cover (Tarea 3): pública; 404 igual sin portada
  const coverGet = p.match(/^\/public\/campaigns\/([^/]+)\/cover$/);
  if (coverGet && req.method === 'GET') {
    const bytes = covers.get(decodeURIComponent(coverGet[1]));
    if (!bytes) { problem(res, 404, 'NotFound'); return; }
    res.writeHead(200, { 'Content-Type': imageType(bytes), 'Cache-Control': 'public, max-age=3600' });
    res.end(bytes);
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
        createdAt: new Date().toISOString(), organizationName: c.organizationName,
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
        startDate: c.startDate, endDate: c.endDate,
        responsibles, assignedEmployeeCount: responsibles.filter((r) => r.actingRole === 'EMPLOYEE').length,
      };
    });
    send(res, 200, { items });
    return;
  }

  // S-18: GET /organizations/{organizationId} (solo ADMINISTRATOR o REPRESENTATIVE, el resto 403)
  // Ficha R-7 — GET /public/locations: el catálogo (aquí, el de PRUEBA)
  if (p === '/public/locations' && req.method === 'GET') {
    send(res, 200, TEST_LOCATIONS, { 'Cache-Control': 'public, max-age=86400' });
    return;
  }
  // Ficha R-7 — PUT /organizations/{id}/profile: REPRESENTATIVE o ADMINISTRATOR; todos los campos, ausente o null borra;
  // verificada → nombre, razón social, NIT y dígito no cambian (409 OrganizationProfileLocked)
  const profileMatch = p.match(/^\/organizations\/([^/]+)\/profile$/);
  if (profileMatch && req.method === 'PUT') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(profileMatch[1]);
    const o = organizations.get(orgId);
    if (!o || actor.organizationId !== orgId || !actor.roles.some((r) => r === 'REPRESENTATIVE' || r === 'ADMINISTRATOR')) { problem(res, 403, 'Forbidden'); return; }
    const b = (await readBody(req)) || {};
    if (typeof b.name !== 'string' || !b.name.trim() || Array.from(b.name.trim()).length > 200) { problem(res, 400, 'BadRequest'); return; }
    const parsed = parseProfile(b, o.type);
    if (parsed.field) { problem(res, 400, 'BadRequest'); return; }
    const before = o.profile || {};
    if (organizationStatus.get(orgId) === 'VERIFIED' && (b.name.trim() !== o.name || before.legalName !== parsed.profile.legalName
      || before.nit !== parsed.profile.nit || before.nitCheckDigit !== parsed.profile.nitCheckDigit)) {
      problem(res, 409, 'OrganizationProfileLocked'); return;
    }
    if (parsed.profile.nit && nitTaken(parsed.profile.nit, orgId)) { problem(res, 409, 'OrganizationNitAlreadyRegistered'); return; }
    o.name = b.name.trim();
    o.profile = parsed.profile;
    send(res, 200, { name: o.name, ...o.profile }, { 'Cache-Control': 'no-store' });
    return;
  }
  // Ficha R-7 — POST /organizations/{id}/verification/resubmit: solo desde NEEDS_MORE_INFORMATION
  const resubmitMatch = p.match(/^\/organizations\/([^/]+)\/verification\/resubmit$/);
  if (resubmitMatch && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(resubmitMatch[1]);
    if (!organizations.has(orgId) || actor.organizationId !== orgId || !actor.roles.some((r) => r === 'REPRESENTATIVE' || r === 'ADMINISTRATOR')) { problem(res, 403, 'Forbidden'); return; }
    if (organizationStatus.get(orgId) !== 'NEEDS_MORE_INFORMATION') { problem(res, 409, 'VerificationResubmitNotAllowed'); return; }
    organizationStatus.set(orgId, 'PENDING_VERIFICATION');
    delete organizations.get(orgId).informationRequest;
    send(res, 200, { verificationStatus: 'PENDING_VERIFICATION' }, { 'Cache-Control': 'no-store' });
    return;
  }

  const singleOrgMatch = p.match(/^\/organizations\/([^/]+)$/);
  if (singleOrgMatch && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(singleOrgMatch[1]);
    if (actor.organizationId !== orgId || (!actor.roles.includes('ADMINISTRATOR') && !actor.roles.includes('REPRESENTATIVE'))) {
      problem(res, 403, 'Forbidden'); return;
    }
    const o = organizations.get(orgId);
    if (!o) { problem(res, 404, 'NotFound'); return; }
    const out = {
      organizationId: orgId,
      name: o.name,
      type: o.type,
      verificationStatus: organizationStatus.get(orgId) || 'PENDING_VERIFICATION',
      informationRequest: o.informationRequest,
      logoUrl: o.logoUrl,
      ...(o.profile || {}),
    };
    send(res, 200, out, { 'Cache-Control': 'no-store' });
    return;
  }

  // Invitaciones (§3.3, ADR-049): ADMINISTRATOR o REPRESENTATIVE
  const invMatch = p.match(/^\/organizations\/([^/]+)\/invitations(?:\/([^/]+)\/revoke)?$/);
  if (invMatch) {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(invMatch[1]);
    if (actor.organizationId !== orgId || !actor.roles.some((r) => r === 'ADMINISTRATOR' || r === 'REPRESENTATIVE')) { problem(res, 403, 'Forbidden'); return; }
    if (req.method === 'GET' && !invMatch[2]) {
      const now = Date.now();
      const items = [...invitations.entries()].filter(([, i]) => i.organizationId === orgId && i.status === 'PENDING' && Date.parse(i.expiresAt) > now)
        .map(([id, i]) => ({ invitationId: id, emailMasked: i.email[0] + '***' + i.email.slice(i.email.indexOf('@')), role: i.role,
          createdAt: i.createdAt, expiresAt: i.expiresAt, delivery: 'SENT' }));
      send(res, 200, { items }, { 'Cache-Control': 'no-store' });
      return;
    }
    if (req.method === 'POST' && invMatch[2]) {
      const inv = invitations.get(decodeURIComponent(invMatch[2]));
      if (!inv || inv.organizationId !== orgId) { problem(res, 403, 'Forbidden'); return; }
      if (inv.status !== 'PENDING') { problem(res, 409, 'InvitationNotPending'); return; }
      inv.status = 'REVOKED';
      send(res, 200, { invitationId: decodeURIComponent(invMatch[2]), status: 'REVOKED' });
      return;
    }
    if (req.method === 'POST') {
      const b = await readBody(req);
      if (!b || !['ADMINISTRATOR', 'EMPLOYEE'].includes(b.role)) { problem(res, 400, 'InvalidMemberRole'); return; }
      if (typeof b.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)) { problem(res, 400, 'InvalidEmailFormat'); return; }
      const invitationId = 'inv-' + crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
      invitations.set(invitationId, { organizationId: orgId, email: b.email.toLowerCase(), role: b.role,
        token: crypto.randomBytes(24).toString('base64url'), status: 'PENDING', createdAt, expiresAt });
      send(res, 202, { invitationId, role: b.role, expiresAt });
      return;
    }
  }

  // Cambiar papel y quitar miembro (DD-66): ADMINISTRATOR o REPRESENTATIVE
  const memberMatch = p.match(/^\/organizations\/([^/]+)\/members\/([^/]+)\/(role|remove)$/);
  if (memberMatch && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(memberMatch[1]);
    if (actor.organizationId !== orgId || !actor.roles.some((r) => r === 'ADMINISTRATOR' || r === 'REPRESENTATIVE')) { problem(res, 403, 'Forbidden'); return; }
    const target = Object.values(accounts).find((a) => a.accountId === decodeURIComponent(memberMatch[2]) && a.organizationId === orgId);
    if (!target) { problem(res, 403, 'Forbidden'); return; }
    const responsible = [...assignments.entries()].some(([k, v]) => k.endsWith(':' + target.accountId)
      && campaignByRef(k.slice(0, k.length - target.accountId.length - 1))?.status === 'OPEN' && v);
    if (memberMatch[3] === 'remove') {
      if (target.roles.includes('REPRESENTATIVE')) { problem(res, 409, 'RepresentativeTransferRequired'); return; }
      if (responsible) { problem(res, 409, 'ActiveCampaignResponsible'); return; }
      delete target.organizationId;
      target.roles = [];
      send(res, 200, { accountId: target.accountId, removed: true });
      return;
    }
    const b = await readBody(req);
    if (!b || !['ADMINISTRATOR', 'EMPLOYEE'].includes(b.role)) { problem(res, 400, 'InvalidMemberRole'); return; }
    if (target.roles.includes('REPRESENTATIVE') && target !== actor) { problem(res, 403, 'Forbidden'); return; }
    if (b.role === 'ADMINISTRATOR') {
      if (target.roles.includes('ADMINISTRATOR')) { problem(res, 409, 'MemberAlreadyHasRole'); return; }
      target.roles = [...target.roles, 'ADMINISTRATOR'];
    } else {
      if (target.roles.includes('EMPLOYEE') && !target.roles.includes('ADMINISTRATOR')) { problem(res, 409, 'MemberAlreadyHasRole'); return; }
      target.roles = [...new Set([...target.roles.filter((r) => r !== 'ADMINISTRATOR'), 'EMPLOYEE'])];
    }
    send(res, 200, { accountId: target.accountId, roles: [...target.roles].sort() });
    return;
  }

  // Aceptar invitación (ADR-049 D4): token en el CUERPO; en la URL, el mismo 403
  if (p === '/invitations/accept' && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    if (url.search.includes('token')) { problem(res, 403, 'InvitationNotAcceptable'); return; }
    const b = await readBody(req);
    const inv = b && typeof b.token === 'string' ? [...invitations.values()].find((i) => i.token === b.token) : null;
    const email = Object.keys(accounts).find((e) => accounts[e] === actor);
    if (!inv || inv.status !== 'PENDING' || Date.parse(inv.expiresAt) <= Date.now() || (email || '').toLowerCase() !== inv.email) {
      problem(res, 403, 'InvitationNotAcceptable'); return;
    }
    if (actor.organizationId) { problem(res, 409, 'AccountAlreadyBelongsToOrganization'); return; }
    inv.status = 'ACCEPTED';
    actor.organizationId = inv.organizationId;
    actor.roles = [inv.role];
    send(res, 200, { organizationId: inv.organizationId, roles: [inv.role] });
    return;
  }

  // Mis convocatorias (§3.4; DD-72): asignaciones activas de quien llama, también de convocatorias cerradas
  if (p === '/me/campaigns' && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const items = [...assignments.entries()].filter(([k]) => k.endsWith(':' + actor.accountId)).map(([k, v]) => {
      const c = campaignByRef(k.slice(0, k.length - actor.accountId.length - 1));
      return c && c.organizationRef === actor.organizationId ? {
        campaignRef: c.campaignRef, publicCode: c.publicCode, title: c.title, status: c.status, actingRole: v.actingRole,
        assignedAt: v.assignedAt || '2026-10-01T00:00:00Z',
      } : null;
    }).filter(Boolean);
    send(res, 200, { items }, { 'Cache-Control': 'no-store' });
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

  // GET /organizations/{id}/campaigns/{ref}/prediction/history (S-17, backend d169dda): cortes 0.15/0.25/0.50; el doble
  // está al 30 % del tiempo, así que el corte del 50 % es futuro (sin cifra). Cifras de PRUEBA, no del modelo.
  const histMatch = p.match(/^\/organizations\/([^/]+)\/campaigns\/([^/]+)\/prediction\/history$/);
  if (histMatch && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(histMatch[1]);
    const c = [...campaigns.values()].find((x) => x.campaignRef === decodeURIComponent(histMatch[2]));
    if (!c || c.organizationRef !== orgId || actor.organizationId !== orgId
      || !actor.roles.some((r) => r === 'ADMINISTRATOR' || r === 'REPRESENTATIVE')) { problem(res, 403, 'Forbidden'); return; }
    const warning = 'Estimación de un modelo entrenado con datos sintéticos.';
    const base = { kind: 'ESTIMATE', modelVersion: 'fake-1', warning, basis: 'EVENT_STORE', asOf: new Date().toISOString() };
    const headers = { 'Cache-Control': 'no-store' };
    if (c.targetPolicy === 'STRICT') {
      send(res, 200, { ...base, available: false, unavailableReason: 'STRICT_POLICY_EXCLUDED', unavailableText: 'Las convocatorias con meta estricta no se estiman.', cuts: [], warnings: [warning] }, headers);
      return;
    }
    const day = 24 * 3600 * 1000;
    const start = Date.parse('2026-09-01T00:00:00Z');
    send(res, 200, { ...base, available: true, warnings: [warning, 'En los cortes pasados la tasa de fallos es 0: los pagos fallidos no están en el Event Store'], cuts: [
      { t: 0.15, cutAt: new Date(start + 9 * day).toISOString(), available: true, probabilityReachTarget: 0.41, estimatedFinalPctOfTarget: 0.82, pctRaisedAtCut: 0.12 },
      { t: 0.25, cutAt: new Date(start + 15 * day).toISOString(), available: true, probabilityReachTarget: 0.55, estimatedFinalPctOfTarget: 0.97, pctRaisedAtCut: 0.21 },
      { t: 0.5, cutAt: new Date(start + 30 * day).toISOString(), available: false, unavailableReason: 'FUTURE_CUT', unavailableText: 'Este corte aún no ha llegado' },
    ] }, headers);
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
      assetType: a.assetType,
      // G-9: el último evento por orden (aquí, el último del historial)
      ...(a.history && a.history.length ? { lastEventAt: a.history[a.history.length - 1].timestamp } : {}),
    }));
    send(res, 200, { items });
    return;
  }

  // P-3 — G-6, G-7 y G-8 (ficha R-6, Bloques B y D; referencia-api-v1.md §3). Valores del doble, por la organización
  const timeMatch = p.match(/^\/organizations\/([^/]+)\/(funds\/monthly|integrity|activity)$/);
  if (timeMatch && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(timeMatch[1]);
    const what = timeMatch[2];
    const allowed = { 'funds/monthly': ['ADMINISTRATOR', 'EMPLOYEE'], integrity: ['ADMINISTRATOR', 'REPRESENTATIVE'], activity: ['ADMINISTRATOR', 'EMPLOYEE', 'REPRESENTATIVE'] }[what];
    if (actor.organizationId !== orgId || !actor.roles.some((r) => allowed.includes(r))) { problem(res, 403, 'Forbidden'); return; }
    const funds = [...intents.values()].filter((i) => i.fundId && campaigns.get(i.publicCode)?.organizationRef === orgId);
    const orgAssets = [...assets.values()].filter((a) => a.organizationRef === orgId);
    if (what === 'funds/monthly') {
      const n = url.searchParams.has('months') ? Number(url.searchParams.get('months')) : 6;
      if (!Number.isInteger(n) || n < 1 || n > 12) { problem(res, 400, 'BadRequest'); return; }
      const bogota = (iso) => new Date(Date.parse(iso) - 5 * 3600 * 1000).toISOString().slice(0, 7);
      const now = new Date(Date.now() - 5 * 3600 * 1000);
      const months = [];
      for (let k = n - 1; k >= 0; k--) months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1)).toISOString().slice(0, 7));
      const currencies = [...new Set(funds.map((f) => f.currency || 'COP'))];
      const items = [];
      for (const c of currencies) for (const m of months) {
        const sum = funds.filter((f) => (f.currency || 'COP') === c && f.clearedAt && bogota(f.clearedAt) === m).reduce((t, f) => t + BigInt(f.amount), BigInt(0));
        items.push({ month: m, currency: c, clearedAmount: String(sum) });
      }
      send(res, 200, { timezone: 'America/Bogota', items }, { 'Cache-Control': 'no-store' });
      return;
    }
    if (what === 'integrity') {
      const events = orgAssets.reduce((t, a) => t + (a.history ? a.history.length : 0), 0) + funds.length;
      send(res, 200, { unanchoredEvents: Math.max(0, events - 2), inPendingBatches: 0, underReviewEvents: 0, lastAnchoredAt: '2026-10-08T10:00:00Z', truncated: false, checkedAt: new Date().toISOString() }, { 'Cache-Control': 'no-store' });
      return;
    }
    // activity: de lo más reciente a lo más antiguo, 20 por página, cursor opaco de esta organización
    const all = [];
    for (const a of orgAssets) for (const h of a.history || []) {
      const it = { type: h.eventType, occurredAt: h.timestamp, subject: { kind: 'ASSET', ref: a.assetRef } };
      if (h.eventType === 'ASSET_REGISTERED' || h.eventType === 'ASSET_SPLIT') { it.quantity = scale4(a.quantity); it.unitOfMeasure = a.unitOfMeasure; }
      if (['ASSET_REGISTERED', 'ASSET_RECEIVED', 'ASSET_DELIVERED'].includes(h.eventType)) it.locationZone = 'Zona centro';
      if (['ASSET_REGISTERED', 'ASSET_DISPATCHED', 'ASSET_RECEIVED', 'ASSET_DELIVERED', 'ASSET_SPLIT'].includes(h.eventType)) all.push(it);
    }
    for (const f of funds) if (f.clearedAt) all.push({ type: 'FUNDS_CLEARED', occurredAt: f.clearedAt, subject: { kind: 'FUND', ref: f.fundId } });
    all.push({ type: 'BATCH_ANCHORED', occurredAt: '2026-10-08T10:00:00Z', eventCount: 2 });
    all.sort((x, y) => (x.occurredAt < y.occurredAt ? 1 : -1));
    const cursor = url.searchParams.get('cursor');
    let start = 0;
    if (cursor !== null) {
      const m = /^([^:]+):(\d+)$/.exec(Buffer.from(cursor, 'base64url').toString());
      if (!m || m[1] !== orgId) { problem(res, 400, 'BadRequest'); return; }
      start = Number(m[2]);
    }
    const out = { items: all.slice(start, start + 20), truncated: false };
    if (start + 20 < all.length) out.nextCursor = Buffer.from(`${orgId}:${start + 20}`).toString('base64url');
    send(res, 200, out, { 'Cache-Control': 'no-store' });
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
      Object.assign(item, o.profile || {});
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
    const seen = new Set();
    const items = [];
    for (const a of Object.values(accounts)) {
      if (a.platformAuthority && !seen.has(a.accountId)) {
        seen.add(a.accountId);
        items.push({ accountId: a.accountId, status: 'ACTIVE' });
      }
    }
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
    // R-5: la versión vigente de los términos de organización, o 400 sin organización
    if (b.acceptedOrganizationTermsVersion !== LEGAL) { problem(res, 400, 'BadRequest'); return; }
    if (actor.organizationId) { problem(res, 409, 'AccountAlreadyBelongsToOrganization'); return; }
    // Ficha R-7: el perfil, todo opcional; un campo inválido → 400; un NIT repetido → 409 sin organización
    const parsed = parseProfile(b, b.type);
    if (parsed.field) { problem(res, 400, 'BadRequest'); return; }
    if (parsed.profile.nit && nitTaken(parsed.profile.nit)) { problem(res, 409, 'OrganizationNitAlreadyRegistered'); return; }
    const organizationId = 'org-' + crypto.randomUUID();
    organizations.set(organizationId, { name: b.name.trim(), type: b.type, profile: parsed.profile });
    organizationStatus.set(organizationId, 'PENDING_VERIFICATION');
    actor.organizationId = organizationId;
    actor.roles = ['REPRESENTATIVE'];
    send(res, 201, { organizationId, verificationStatus: 'PENDING_VERIFICATION' });
    return;
  }

  // P-4 — logo (ADR-051 F6 y F8, Tarea 2): PUT y DELETE para REPRESENTATIVE o ADMINISTRATOR (403 antes de mirar el
  // tamaño); GET para cualquier miembro o la plataforma, con no-store y private; 404 sin logo
  const logoOrg = p.match(/^\/organizations\/([^/]+)\/logo$/);
  if (logoOrg && ['PUT', 'DELETE', 'GET'].includes(req.method)) {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(logoOrg[1]);
    const o = organizations.get(orgId);
    if (req.method === 'GET') {
      if (!(actor.organizationId === orgId || actor.platformAuthority) || !o) { problem(res, 403, 'Forbidden'); return; }
      const bytes = orgLogos.get(orgId) || (o.logoUrl ? DEMO_LOGO : null);
      if (!bytes) { problem(res, 404, 'NotFound'); return; }
      res.writeHead(200, { 'Content-Type': imageType(bytes), 'Cache-Control': 'no-store, private' });
      res.end(bytes);
      return;
    }
    if (actor.organizationId !== orgId || !actor.roles.some((r) => r === 'ADMINISTRATOR' || r === 'REPRESENTATIVE') || !o) { problem(res, 403, 'Forbidden'); return; }
    if (req.method === 'DELETE') { orgLogos.delete(orgId); delete o.logoUrl; res.writeHead(204); res.end(); return; }
    const raw = await readRaw(req);
    const file = multipartFile(req, raw, 'file');
    if (!file) { problem(res, 400, 'BadRequest'); return; }
    if (file.length > IMAGE_MAX) { problem(res, 413, 'ImageTooLarge'); return; }
    if (!isImage(file)) { problem(res, 415, 'UnsupportedImageFormat'); return; }
    orgLogos.set(orgId, file);
    o.logoUrl = `/api/v1/organizations/${orgId}/logo`;
    send(res, 200, { logoUrl: o.logoUrl });
    return;
  }
  // P-4 — portada (Tarea 3): solo ADMINISTRATOR de la organización de la convocatoria, nunca el REPRESENTATIVE
  const coverOrg = p.match(/^\/organizations\/([^/]+)\/campaigns\/([^/]+)\/cover$/);
  if (coverOrg && (req.method === 'PUT' || req.method === 'DELETE')) {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(coverOrg[1]);
    const c = campaignByRef(decodeURIComponent(coverOrg[2]));
    if (actor.organizationId !== orgId || !actor.roles.includes('ADMINISTRATOR') || !c || c.organizationRef !== orgId) { problem(res, 403, 'Forbidden'); return; }
    if (req.method === 'DELETE') { covers.delete(c.publicCode); res.writeHead(204); res.end(); return; }
    const raw = await readRaw(req);
    const file = multipartFile(req, raw, 'file');
    if (!file) { problem(res, 400, 'BadRequest'); return; }
    if (file.length > IMAGE_MAX) { problem(res, 413, 'ImageTooLarge'); return; }
    if (!isImage(file)) { problem(res, 415, 'UnsupportedImageFormat'); return; }
    covers.set(c.publicCode, file);
    send(res, 200, { coverImageUrl: `/api/v1/public/campaigns/${c.publicCode}/cover` });
    return;
  }
  // P-4 — retirar una foto (ADR-051 F7): plataforma; 403 antes de validar el cuerpo; 204 también si ya no estaba
  const removeMatch = p.match(/^\/platform\/organizations\/([^/]+)\/media\/remove$/);
  if (removeMatch && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    if (!actor.platformAuthority) { problem(res, 403, 'Forbidden'); return; }
    const orgId = decodeURIComponent(removeMatch[1]);
    const b = (await readBody(req)) || {};
    if (typeof b.reason !== 'string' || !b.reason.trim() || b.reason.length > 500) { problem(res, 400, 'BadRequest'); return; }
    if (b.purpose === 'ORGANIZATION_LOGO') {
      if (b.ref !== undefined) { problem(res, 400, 'BadRequest'); return; }
      orgLogos.delete(orgId); const o = organizations.get(orgId); if (o) delete o.logoUrl;
    } else if (b.purpose === 'CAMPAIGN_COVER') {
      const c = typeof b.ref === 'string' ? campaignByRef(b.ref) : null;
      if (!c) { problem(res, 400, 'BadRequest'); return; }
      if (c.organizationRef === orgId) covers.delete(c.publicCode);
    } else if (b.purpose === 'DELIVERY_EVIDENCE') {
      if (typeof b.ref !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(b.ref)) { problem(res, 400, 'BadRequest'); return; }
      const ev = evidences.get(b.ref);
      if (!ev || ev.organizationId !== orgId) { problem(res, 404, 'NotFound'); return; }
      ev.removed = true; delete ev.bytes;
    } else { problem(res, 400, 'BadRequest'); return; }
    res.writeHead(204); res.end();
    return;
  }

  // ADR-051 T4 (referencia-api-v1.md §6): subir la foto de una entrega. Multipart `file`, JPEG o PNG por contenido,
  // ≤ 5 MB binarios; solo EMPLOYEE de esa organización (403 antes de leer el archivo); sin Command-Id
  const evMatch = p.match(/^\/organizations\/([^/]+)\/delivery-evidence$/);
  if (evMatch && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const orgId = decodeURIComponent(evMatch[1]);
    if (actor.organizationId !== orgId || !(actor.roles || []).includes('EMPLOYEE')) { problem(res, 403, 'Forbidden'); return; }
    const raw = await readRaw(req);
    const forced = evidenceFailures.shift();
    if (forced === 410) { send(res, 410, { type: 'about:blank', title: 'EvidenceRemoved', status: 410, detail: 'The resource was removed.' }); return; }
    if (forced === 503) { problem(res, 503, 'MediaStorageUnavailable'); return; }
    const file = multipartFile(req, raw, 'file');
    if (!file) { problem(res, 400, 'BadRequest'); return; }
    if (forced === 413 || file.length > EVIDENCE_MAX) { problem(res, 413, 'ImageTooLarge'); return; }
    const jpeg = file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff;
    const png = file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (forced === 415 || !(jpeg || png)) { problem(res, 415, 'UnsupportedImageFormat'); return; }
    const evidenceRef = 'sha256:' + crypto.createHash('sha256').update(file).digest('hex');
    if (!evidences.has(evidenceRef)) evidences.set(evidenceRef, { organizationId: orgId, assetRef: null, bytes: file });
    evidences.__uploads = (evidences.__uploads || 0) + 1;
    send(res, 201, { evidenceRef });
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
    // Ficha R-7 (P2 (b)): verificar exige la razón social y el NIT
    const prof = (organizations.get(orgId) || {}).profile || {};
    if (decision === 'verify' && (!prof.legalName || !prof.nit)) { problem(res, 409, 'VerificationDataMissing'); return; }
    const next = { verify: 'VERIFIED', reject: 'REJECTED', 'request-information': 'NEEDS_MORE_INFORMATION' }[decision];
    organizationStatus.set(orgId, next);
    if (decision === 'request-information' && organizations.has(orgId)) organizations.get(orgId).informationRequest = b.message;
    if (next === 'VERIFIED') verifiedOrganizations.add(orgId);
    send(res, 200, { organizationId: orgId, verificationStatus: next });
    return;
  }

  // Configuración (Enmienda 4 de ADR-037; DD-73): versión, edición directa sin donaciones, solicitudes con aprobación ajena
  const cfgMatch = p.match(/^\/campaigns\/([^/]+)\/(configuration|configuration-change-requests)(?:\/([^/]+)\/(approve|reject))?$/);
  if (cfgMatch) {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const c = campaignByRef(decodeURIComponent(cfgMatch[1]));
    const manager = actor.roles.includes('ADMINISTRATOR') || actor.roles.includes('REPRESENTATIVE');
    if (!c || c.organizationRef !== actor.organizationId || !manager) { problem(res, 403, 'Forbidden'); return; }
    c.configurationVersion = c.configurationVersion || 1;
    c.changeRequests = c.changeRequests || [];
    const config = () => ({ acceptedDonationTypes: [...(c.acceptedDonationTypes || [])].sort(), acceptedPaymentMethods: [...(c.acceptedPaymentMethods || [])].sort(),
      currency: c.currency, targetAmount: c.targetAmount, targetPolicy: c.targetPolicy, onTargetReached: c.onTargetReached });
    const monetaryTerms = (x) => JSON.stringify([x.currency, x.targetAmount, x.targetPolicy, x.onTargetReached || undefined]);
    const hasIntents = () => [...intents.values()].some((i) => i.publicCode === c.publicCode);
    const validate = (b) => {
      const k = b && b.configuration;
      if (!b || !Number.isInteger(b.expectedConfigurationVersion) || b.expectedConfigurationVersion < 1 || !k
        || !Array.isArray(k.acceptedDonationTypes) || k.acceptedDonationTypes.length === 0) { problem(res, 400, 'InvalidRequestField'); return null; }
      if (c.status === 'CLOSED') { problem(res, 409, 'ConfigurationChangeOnClosedCampaign'); return null; }
      if (b.expectedConfigurationVersion !== c.configurationVersion) { problem(res, 409, 'ConfigurationVersionConflict'); return null; }
      const had = (c.acceptedDonationTypes || []).includes('MONETARY');
      const has = k.acceptedDonationTypes.includes('MONETARY');
      if (had && has && monetaryTerms(k) !== monetaryTerms(config())) { problem(res, 409, 'MonetaryTermsChangeNotSupported'); return null; }
      if (had && !has && hasIntents()) { problem(res, 409, 'MonetaryRemovalNotAllowed'); return null; }
      return k;
    };
    const apply = (k) => {
      Object.assign(c, { acceptedDonationTypes: k.acceptedDonationTypes, acceptedPaymentMethods: k.acceptedPaymentMethods || [],
        currency: k.currency, targetAmount: k.targetAmount, targetPolicy: k.targetPolicy, onTargetReached: k.onTargetReached });
      c.configurationVersion += 1;
      return c.configurationVersion;
    };
    if (cfgMatch[2] === 'configuration' && req.method === 'POST') {
      if (!actor.roles.includes('ADMINISTRATOR')) { problem(res, 403, 'Forbidden'); return; }
      const b = await readBody(req);
      if (hasIntents()) { problem(res, 409, 'CampaignAlreadyHasDonations'); return; }
      const k = validate(b);
      if (!k) return;
      send(res, 200, { campaignRef: c.campaignRef, configurationVersion: apply(k) });
      return;
    }
    if (cfgMatch[2] === 'configuration-change-requests' && !cfgMatch[3] && req.method === 'GET') {
      send(res, 200, { items: c.changeRequests.slice(-50) }, { 'Cache-Control': 'no-store' });
      return;
    }
    if (cfgMatch[2] === 'configuration-change-requests' && !cfgMatch[3] && req.method === 'POST') {
      if (!actor.roles.includes('ADMINISTRATOR')) { problem(res, 403, 'Forbidden'); return; }
      const b = await readBody(req);
      if (c.changeRequests.some((r) => r.status === 'PENDING')) { problem(res, 409, 'ConfigurationChangeRequestAlreadyPending'); return; }
      const k = validate(b);
      if (!k) return;
      const requestId = 'req-' + crypto.randomUUID();
      c.changeRequests.push({ requestId, status: 'PENDING', baseConfigurationVersion: c.configurationVersion,
        proposedConfiguration: { ...k, acceptedDonationTypes: [...k.acceptedDonationTypes].sort(), acceptedPaymentMethods: [...(k.acceptedPaymentMethods || [])].sort() },
        requestedBy: actor.accountId, requestedAt: new Date().toISOString() });
      send(res, 201, { requestId, status: 'PENDING', baseConfigurationVersion: c.configurationVersion });
      return;
    }
    if (cfgMatch[3] && req.method === 'POST') {
      const r = c.changeRequests.find((x) => x.requestId === decodeURIComponent(cfgMatch[3]));
      if (!r) { problem(res, 403, 'Forbidden'); return; }
      if (r.status !== 'PENDING') { problem(res, 409, 'ConfigurationChangeRequestNotPending'); return; }
      if (cfgMatch[4] === 'approve') {
        if (r.requestedBy === actor.accountId) { problem(res, 403, 'SelfApprovalNotAllowed'); return; }
        if (r.baseConfigurationVersion !== c.configurationVersion) { problem(res, 409, 'ConfigurationVersionConflict'); return; }
        const v = apply(r.proposedConfiguration);
        Object.assign(r, { status: 'APPROVED', decidedBy: actor.accountId, decidedAt: new Date().toISOString(), resultingConfigurationVersion: v });
        send(res, 200, { requestId: r.requestId, status: 'APPROVED', configurationVersion: v });
        return;
      }
      Object.assign(r, { status: 'REJECTED', decidedBy: actor.accountId, decidedAt: new Date().toISOString() });
      send(res, 200, { requestId: r.requestId, status: 'REJECTED' });
      return;
    }
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
        assignments.set(campaignRef + ':' + b.administratorRef, { assignmentId, actingRole: 'ADMINISTRATOR', assignedAt: new Date().toISOString() });
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
      assignments.set(campaignRef + ':' + b.employeeRef, { assignmentId, actingRole: 'EMPLOYEE', assignedAt: new Date().toISOString() });
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
          // G-2 (nota del 2026-10-23, §8)
          ...(intent.clearedAt ? { firstClearedAt: intent.clearedAt, lastClearedAt: intent.clearedAt } : {}),
        },
        campaignRef: c.campaignRef,
        // G-1 (nota del 2026-10-21, §8): título y organización de la convocatoria
        campaignTitle: c.title, ...(c.organizationName ? { organizationName: c.organizationName } : {}),
        logistics: items.map((a) => ({
          assetRef: a.assetRef, lifecycleStatus: a.lifecycleStatus, assetType: a.assetType, unitOfMeasure: a.unitOfMeasure,
          // `locationZone` llega null si el activo no tiene ubicación (despachado)
          quantity: scale4(a.quantity), locationZone: a.lifecycleStatus === 'DISPATCHED' ? null : 'Zona centro', custodianCategory: 'LOCAL_ALLY',
          // G-4 (nota del 2026-10-25, §8): solo si el padre está en la misma respuesta
          ...(a.parentAssetRef && items.some((x) => x.assetRef === a.parentAssetRef) ? { parentAssetRef: a.parentAssetRef } : {}),
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
    // S-22 (backend d169dda): un lote anclado que coincide y un evento aún sin anclar. Valores de PRUEBA del doble
    if (p === '/donations/tracking/integrity') {
      send(res, 200, {
        batches: [{
          anchorStatus: 'ANCHORED', merkleRoot: '0x' + 'ab'.repeat(32), transactionHash: '0x' + 'cd'.repeat(32), network: 'ganache-local',
          anchoredAt: '2026-10-08T10:00:00Z', confirmedBlockNumber: 42, eventsOfThisDonation: 2, verification: { result: 'MATCH' },
        }],
        unanchoredEvents: 1, checkedAt: new Date().toISOString(),
      }, { 'Cache-Control': 'no-store' });
      return;
    }
    const hist = p.match(/^\/donations\/tracking\/assets\/([^/]+)\/history$/);
    if (hist) {
      const a = assets.get(decodeURIComponent(hist[1]));
      if (!a || a.fundId !== intent.fundId) { send(res, 401, { type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Invalid or missing token' }); return; }
      // G-3 y E1 (nota del 2026-10-25, §8): huella por paso; los dos primeros eventos de cada activo forman un lote
      // ANCHORED con su prueba de Merkle (algoritmo E1.3), el resto espera anclaje. Valores de PRUEBA del doble
      const hashes = a.history.map((h, i) => sha256Hex(`${a.assetRef}:${i}:${h.eventType}`));
      const batch = hashes.slice(0, 2);
      send(res, 200, { history: a.history.map((h, i) => {
        const out = { eventType: h.eventType, timestamp: h.timestamp, locationZone: NO_ZONE_EVENTS.has(h.eventType) ? null : 'Zona centro', custodianCategory: 'LOCAL_ALLY', status: h.status, eventHash: hashes[i] };
        if (i < batch.length) {
          out.anchorStatus = 'ANCHORED';
          out.anchorProof = { merkleRoot: merkleRoot(batch), leafIndex: i, path: merklePath(batch, i), transactionHash: '0x' + sha256Hex(a.assetRef + ':tx'), network: 'sepolia', anchoredAt: h.timestamp };
        } else {
          out.anchorStatus = 'PENDING';
        }
        // ADR-051 F6: la huella de la foto, nunca la imagen
        if (h.eventType === 'ASSET_DELIVERED') {
          out.evidenceRegistered = !!a.evidenceRef;
          if (a.evidenceRef && /^sha256:[0-9a-f]{64}$/.test(a.evidenceRef)) out.evidenceRef = a.evidenceRef;
        }
        return out;
      }) });
      return;
    }
    problem(res, 404, 'NotFound');
    return;
  }

  // P-1 — POST /auth/password-reset (ADR-050 D8): siempre el mismo 202; solo una cuenta ACTIVE fuera del
  // enfriamiento de 5 minutos recibe correo; pedir otro sustituye al anterior
  if (p === '/auth/password-reset' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || typeof body.email !== 'string' || !body.email.trim()) { problem(res, 400, 'BadRequest'); return; }
    const email = body.email.trim().toLowerCase();
    const acc = accounts[email];
    const last = resetCooldown.get(email) || 0;
    if (acc && acc.status !== 'INACTIVE' && Date.now() - last >= 5 * 60 * 1000) {
      for (const v of resetTokens.values()) if (v.email === email) v.superseded = true;
      resetTokens.set('rst-' + crypto.randomBytes(24).toString('base64url'), { email, used: false, superseded: false, at: Date.now() });
      resetCooldown.set(email, Date.now());
      resetMails.push(email);
    }
    res.writeHead(202, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  // P-1 — POST /auth/password-reset/confirm: 204 sin iniciar sesión; el mismo 400 para cualquier token que no sirve;
  // PasswordTooShort no consume el token
  if (p === '/auth/password-reset/confirm' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || !body.token || !body.newPassword) { problem(res, 400, 'BadRequest'); return; }
    const t = resetTokens.get(String(body.token));
    const acc = t && accounts[t.email];
    if (!t || t.used || t.superseded || Date.now() - t.at > 30 * 60 * 1000 || !acc || acc.status === 'INACTIVE') {
      problem(res, 400, 'PasswordResetTokenInvalid'); return;
    }
    if (String(body.newPassword).length < 12) { problem(res, 400, 'PasswordTooShort'); return; }
    t.used = true;
    acc.password = String(body.newPassword);
    acc.passwordChanged = true;
    // Enmienda 2: confirmar una recuperación también verifica el correo
    acc.emailVerified = true;
    revokeTokensOf(acc);
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  // Enmienda 2 — POST /auth/email-verification {email}: siempre el mismo 202 sin cuerpo; solo una cuenta ACTIVE sin
  // verificar, fuera del enfriamiento de 5 minutos, recibe un correo nuevo (el anterior queda sustituido)
  if (p === '/auth/email-verification' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || typeof body.email !== 'string' || !body.email.trim()) { problem(res, 400, 'BadRequest'); return; }
    const email = body.email.trim().toLowerCase();
    const acc = accounts[email];
    const last = verifyCooldown.get(email) || 0;
    if (acc && acc.status !== 'INACTIVE' && acc.emailVerified === false && Date.now() - last >= 5 * 60 * 1000) sendVerification(email);
    res.writeHead(202, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  // Enmienda 2 — POST /auth/email-verification/confirm {token}: 204 sin iniciar sesión; el mismo 400
  // EmailVerificationTokenInvalid para un token desconocido, caducado, usado, sustituido o de una cuenta inactiva
  if (p === '/auth/email-verification/confirm' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || typeof body.token !== 'string' || !body.token) { problem(res, 400, 'BadRequest'); return; }
    const t = verifyTokens.get(body.token);
    const acc = t && accounts[t.email];
    if (!t || t.used || t.superseded || Date.now() - t.at > 24 * 60 * 60 * 1000 || !acc || acc.status === 'INACTIVE') {
      problem(res, 400, 'EmailVerificationTokenInvalid'); return;
    }
    t.used = true;
    acc.emailVerified = true;
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  // P-1 — POST /account/password (ADR-050 D5): 200 {token}; la sesión sigue con el token nuevo y las demás se revocan
  if (p === '/account/password' && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const body = await readBody(req);
    if (!body || !body.currentPassword || !body.newPassword) { problem(res, 400, 'BadRequest'); return; }
    if (body.currentPassword !== actor.password) { problem(res, 400, 'CurrentPasswordIncorrect'); return; }
    if (String(body.newPassword).length < 12) { problem(res, 400, 'PasswordTooShort'); return; }
    const email = emailOf(req);
    actor.password = String(body.newPassword);
    actor.passwordChanged = true;
    revokeTokensOf(actor);
    if (passwordChange500.delete(email)) { problem(res, 500, 'InternalServerError'); return; }
    const token = 'tok-' + crypto.randomUUID();
    tokens.set(token, email);
    send(res, 200, { token }, { 'Cache-Control': 'no-store' });
    return;
  }

  // P-1 — POST /account/deactivate (ADR-050 D6): orden contraseña, administrador, representante, responsable
  if (p === '/account/deactivate' && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const body = await readBody(req);
    if (!body || !body.currentPassword) { problem(res, 400, 'BadRequest'); return; }
    if (body.currentPassword !== actor.password) { problem(res, 400, 'CurrentPasswordIncorrect'); return; }
    if (actor.platformAuthority) { problem(res, 409, 'PlatformAdministratorDeactivation'); return; }
    if ((actor.roles || []).includes('REPRESENTATIVE')) { problem(res, 409, 'RepresentativeTransferRequired'); return; }
    const responsible = [...assignments.entries()].some(([k, v]) => k.endsWith(':' + actor.accountId)
      && campaignByRef(k.slice(0, k.length - actor.accountId.length - 1))?.status === 'OPEN' && v);
    if (responsible) { problem(res, 409, 'ActiveCampaignResponsible'); return; }
    actor.status = 'INACTIVE';
    revokeTokensOf(actor);
    res.writeHead(204);
    res.end();
    return;
  }

  // P-1 — GET y PUT /account/profile (ADR-050 D1): el nombre es privado; vacío tras recortar o > 100 puntos de código → 400
  if (p === '/account/profile' && (req.method === 'GET' || req.method === 'PUT')) {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    if (req.method === 'PUT') {
      const body = (await readBody(req)) || {};
      const next = {};
      for (const f of ['givenName', 'familyName']) {
        const v = body[f];
        if (v === null || v === undefined) { next[f] = undefined; continue; }
        if (typeof v !== 'string' || !v.trim() || Array.from(v.trim()).length > 100) { problem(res, 400, 'BadRequest'); return; }
        next[f] = v.trim();
      }
      actor.givenName = next.givenName;
      actor.familyName = next.familyName;
    }
    const out = { email: emailOf(req) };
    if (actor.givenName) out.givenName = actor.givenName;
    if (actor.familyName) out.familyName = actor.familyName;
    send(res, 200, out, { 'Cache-Control': 'no-store' });
    return;
  }

  // P-1 / U-7 — POST /platform/accounts/{accountId}/reactivate (ADR-050 D7): 403 uniforme antes de leer la cuenta
  const reactivateMatch = p.match(/^\/platform\/accounts\/([^/]+)\/reactivate$/);
  if (reactivateMatch && req.method === 'POST') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    if (!actor.platformAuthority) { problem(res, 403, 'Forbidden'); return; }
    const id = decodeURIComponent(reactivateMatch[1]);
    const targets = Object.values(accounts).filter((a) => a.accountId === id);
    if (targets.length === 0) { problem(res, 404, 'NotFound'); return; }
    for (const a of targets) a.status = 'ACTIVE';
    send(res, 200, { accountId: id, status: 'ACTIVE' }, { 'Cache-Control': 'no-store' });
    return;
  }

  // GET /account — JWT obligatorio; datos básicos de la cuenta (D-F9)
  if (p === '/account' && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const email = tokens.get(req.headers['authorization'].slice(7));
    // Enmienda 2: gana emailVerified (el accountId de este doble no está en el contrato; la web no lo exige)
    send(res, 200, { accountId: actor.accountId, email, emailVerified: actor.emailVerified !== false }, { 'Cache-Control': 'no-store' });
    return;
  }

  // M-21 — GET /account/impact (referencia-api-v1.md §1, nota del 2026-10-25): las 100 donaciones CONFIRMED más
  // recientes; totales por moneda y unidades entregadas por unidad de medida, como texto; nunca se mezclan monedas
  if (p === '/account/impact' && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const confirmed = [...intents.values()].filter((i) => i.donorAccount === actor.accountId && i.status === 'CONFIRMED')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const counted = confirmed.slice(0, 100);
    const totals = new Map();
    for (const i of counted) totals.set(i.currency, (totals.get(i.currency) || BigInt(0)) + BigInt(i.amount));
    const funds = new Set(counted.map((i) => i.fundId).filter(Boolean));
    const units = new Map();
    for (const a of assets.values()) {
      if (a.lifecycleStatus !== 'DELIVERED' || !a.fundId || !funds.has(a.fundId)) continue;
      units.set(a.unitOfMeasure, (units.get(a.unitOfMeasure) || 0) + Number(a.quantity));
    }
    send(res, 200, {
      donationsCount: counted.length,
      totals: [...totals.entries()].map(([currency, amount]) => ({ currency, amount: String(amount) })),
      campaignsSupported: new Set(counted.map((i) => i.publicCode)).size,
      deliveredUnits: [...units.entries()].map(([unitOfMeasure, q]) => ({ unitOfMeasure, quantity: scale4(q) })),
      truncated: confirmed.length > 100,
    }, { 'Cache-Control': 'private, no-store' });
    return;
  }

  // GET /account/donations — JWT obligatorio; sin seudónimo ni donorRef
  if (p === '/account/donations' && req.method === 'GET') {
    if (!actor) { problem(res, 401, 'Unauthorized'); return; }
    const items = [...intents.values()].filter((i) => i.donorAccount === actor.accountId).map((i) => {
      const out = { intentId: i.intentId, campaignTitle: i.campaignTitle, amount: i.amount, currency: i.currency, status: i.status };
      if (i.status === 'CONFIRMED' && i.trackingCode) out.trackingCode = i.trackingCode;
      // Nota del 2026-10-22 (referencia-api-v1.md §1, Enmienda 5 de ADR-037): fechas, organización, medio y publicCode
      // solo si la convocatoria es PUBLIC al leer
      out.paymentMethod = i.paymentMethod;
      if (i.createdAt) out.createdAt = i.createdAt;
      if (i.confirmedAt && (i.status === 'CONFIRMED' || i.status === 'FUNDING_REJECTED')) out.confirmedAt = i.confirmedAt;
      if (i.organizationName) out.organizationName = i.organizationName;
      const c = campaigns.get(i.publicCode);
      if (c && (c.visibility || 'PUBLIC') === 'PUBLIC') out.publicCode = i.publicCode;
      return out;
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
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
    // P-4 / U-8 — GET /physical-assets/{ref}/evidence (Tarea 5): miembros de la organización del activo o la plataforma;
    // 404 sin entrega o sin foto; 410 EvidenceRemoved si la plataforma la retiró
    const evRead = p.match(/^\/physical-assets\/([^/]+)\/evidence$/);
    if (evRead && req.method === 'GET') {
      const a = assets.get(decodeURIComponent(evRead[1]));
      if (!a || !(actor.organizationId === a.organizationRef || actor.platformAuthority)) { problem(res, 403, 'Forbidden'); return; }
      const ev = a.evidenceRef && evidences.get(a.evidenceRef);
      if (ev && ev.removed) { send(res, 410, { type: 'about:blank', title: 'EvidenceRemoved', status: 410, detail: 'The resource was removed.' }); return; }
      if (!ev || !ev.bytes) { problem(res, 404, 'NotFound'); return; }
      res.writeHead(200, { 'Content-Type': imageType(ev.bytes), 'Cache-Control': 'private, no-store' });
      res.end(ev.bytes);
      return;
    }
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
        newAsset({ ...asset, assetRef: childRef, parentAssetRef: asset.assetRef, quantity: sp.quantity, lifecycleStatus: 'REGISTERED',
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
      // ADR-051 T4: `evidenceRef` = `sha256:` + 64 hex en minúscula, antes de consumir el Command-Id ni mirar el activo
      if (action === 'deliver' && !/^sha256:[0-9a-f]{64}$/.test(b.evidenceRef)) { problem(res, 400, 'InvalidEvidenceRef'); return; }
      if (!allowed) { problem(res, 403, 'Forbidden'); return; }
      if (action === 'deliver') {
        const ev = evidences.get(b.evidenceRef);
        if (!ev || ev.organizationId !== asset.organizationRef) { problem(res, 400, 'EvidenceNotFound'); return; }
        if (ev.assetRef && ev.assetRef !== asset.assetRef) { problem(res, 409, 'EvidenceAlreadyBound'); return; }
      }
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
        if (action === 'deliver') { asset.currentCustodianRef = b.finalCustodianRef; asset.evidenceRef = b.evidenceRef; evidences.get(b.evidenceRef).assetRef = asset.assetRef; }
        asset.history.push({ eventType: 'ASSET_' + status, timestamp: now, status });
        return { assetRef: asset.assetRef, status };
      });
      if (!r) return;
      // Ambiguo real (como en la donación): el comando quedó aplicado y la respuesta se pierde
      if (res.__failAfter) { res.__failAfter === 'drop' ? req.socket.destroy() : problem(res, 503, 'ServiceUnavailable'); return; }
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
