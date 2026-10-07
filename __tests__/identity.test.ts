import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as session from '../src/lib/auth/session';
import { fetchMe, login, parsePrincipal } from '../src/lib/api/identity';

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});

describe('Identidad: login (ID-01) y /me (ficha N1)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    session._resetForTest();
    global.fetch = fetchMock as any;
    fetchMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('login: 200 {token} → ok; el cuerpo enviado es {email, password} sin JWT', async () => {
    fetchMock.mockResolvedValue(res(200, { token: 't' }));
    expect(await login('a@b.co', 'p')).toEqual({ kind: 'ok', token: 't' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/auth/login');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.co', password: 'p' });
  });

  it('login: 401, 400, 500 y red se distinguen', async () => {
    fetchMock.mockResolvedValueOnce(res(401));
    expect((await login('a', 'b')).kind).toBe('invalid-credentials');
    fetchMock.mockResolvedValueOnce(res(400));
    expect((await login('a', 'b')).kind).toBe('bad-request');
    fetchMock.mockResolvedValueOnce(res(500));
    expect((await login('a', 'b')).kind).toBe('server-error');
    fetchMock.mockRejectedValueOnce(new Error('x'));
    expect((await login('a', 'b')).kind).toBe('network');
  });

  it('parsePrincipal: solo los cuatro campos; descarta extras (p. ej. email)', () => {
    expect(parsePrincipal({ accountId: 'a', organizationId: 'o', roles: ['ADMINISTRATOR'], email: 'x@y' }))
      .toEqual({ accountId: 'a', organizationId: 'o', roles: ['ADMINISTRATOR'] });
    expect(parsePrincipal({ accountId: 'a', roles: [], platformAuthority: 'ADMINISTRATOR' }))
      .toEqual({ accountId: 'a', roles: [], platformAuthority: 'ADMINISTRATOR' });
  });

  it('parsePrincipal: una respuesta que viola la ficha no se completa por inferencia', () => {
    expect(parsePrincipal({ accountId: 'a' })).toBeNull();
    expect(parsePrincipal({ accountId: 'a', roles: 'ADMINISTRATOR' })).toBeNull();
    expect(parsePrincipal({ accountId: 'a', roles: ['ADMINISTRATOR'] })).toBeNull();
    expect(parsePrincipal({ accountId: 'a', organizationId: 'o', roles: ['DIOS'] })).toBeNull();
  });

  it('/me: 200, 404 (no disponible), 401, 5xx y red', async () => {
    session.login('jwt');
    fetchMock.mockResolvedValueOnce(res(200, { accountId: 'a', organizationId: 'o', roles: ['EMPLOYEE'] }));
    expect((await fetchMe()).kind).toBe('ok');
    fetchMock.mockResolvedValueOnce(res(404));
    expect((await fetchMe()).kind).toBe('unavailable');
    fetchMock.mockResolvedValueOnce(res(503));
    expect((await fetchMe()).kind).toBe('error');
    fetchMock.mockRejectedValueOnce(new Error('x'));
    expect((await fetchMe()).kind).toBe('error');
    fetchMock.mockResolvedValueOnce(res(401));
    expect((await fetchMe()).kind).toBe('unauthorized');
    expect(session.getState()).toBe('LOGGED_OUT');
  });

  it('el principal en memoria se descarta en LOGGED_OUT', () => {
    session.login('jwt');
    session.setLastPrincipal({ accountId: 'a', roles: [] });
    expect(session.getLastPrincipal()).not.toBeNull();
    session.logout();
    expect(session.getLastPrincipal()).toBeNull();
  });
});
