import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as session from '../src/lib/auth/session';
import { apiRequest } from '../src/lib/api/http';
import { rejectionMessage } from '../src/lib/api/messages';

function response(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
    headers: { get: (k: string) => headers[k] ?? null },
  };
}

describe('Cliente HTTP único', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    session._resetForTest();
    global.fetch = fetchMock as any;
    fetchMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1/');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('con JWT: Authorization Bearer, sin credenciales del navegador ni Referer', async () => {
    session.login('jwt-1');
    fetchMock.mockResolvedValue(response(200, { ok: true }));
    const r = await apiRequest({ path: '/me', auth: 'required' });
    expect(r).toEqual({ kind: 'ok', status: 200, data: { ok: true }, location: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/me');
    expect(init.headers.Authorization).toBe('Bearer jwt-1');
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
  });

  it("auth 'none' nunca envía el JWT aunque exista", async () => {
    session.login('jwt-1');
    fetchMock.mockResolvedValue(response(200, {}));
    await apiRequest({ path: '/public/campaigns/x', auth: 'none' });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('401 con JWT → T-1 (LOGGED_OUT, motivo EXPIRED)', async () => {
    session.login('jwt-1');
    fetchMock.mockResolvedValue(response(401, { title: 'Unauthorized' }));
    const r = await apiRequest({ path: '/me', auth: 'required' });
    expect(r.kind).toBe('error');
    expect(session.getState()).toBe('LOGGED_OUT');
    expect(session.getLastLogoutReason()).toBe('EXPIRED');
  });

  it("aserción negativa: un 401 de una ruta 'none' (seguimiento) nunca toca la sesión", async () => {
    session.login('jwt-1');
    fetchMock.mockResolvedValue(response(401, { title: 'Unauthorized' }));
    await apiRequest({ path: '/donations/tracking', auth: 'none', headers: { Authorization: 'Bearer tc' } });
    expect(session.getState()).toBe('AUTHENTICATED');
    expect(session.getJwt()).toBe('jwt-1');
  });

  it('del ProblemDetail solo conserva el title; nunca el detail', async () => {
    fetchMock.mockResolvedValue(response(409, { title: 'CampaignClosed', detail: 'interno: campaign abc', status: 409 }));
    const r = await apiRequest({ path: '/x', auth: 'none' });
    expect(r).toEqual({ kind: 'error', status: 409, problem: { title: 'CampaignClosed' } });
    expect(JSON.stringify(r)).not.toContain('interno');
  });

  it('error de red → network', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await apiRequest({ path: '/x', auth: 'none' })).toEqual({ kind: 'network' });
  });

  it('expone la cabecera Location de un 2xx', async () => {
    fetchMock.mockResolvedValue(response(202, { status: 'PENDING' }, { Location: '/api/v1/physical-assets/a/splits/b' }));
    const r = await apiRequest({ path: '/x', method: 'POST', body: {}, auth: 'required' });
    expect(r.kind === 'ok' && r.location).toBe('/api/v1/physical-assets/a/splits/b');
  });

  it('mensajes de rechazo: por title conocido, si no por código, y nunca el detail', () => {
    expect(rejectionMessage(409, { title: 'CampaignClosed' })).toMatch(/cerrada/);
    expect(rejectionMessage(409, {})).toBe('La operación no es compatible con el estado actual del recurso.');
    expect(rejectionMessage(403, { title: 'Forbidden' })).toBe('No tienes acceso a esta operación.');
    expect(rejectionMessage(418, {})).toBe('La operación fue rechazada.');
  });
});
