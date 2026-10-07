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

  if (!path.startsWith(BASE)) { send(res, 404); return; }
  const p = path.slice(BASE.length);

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
