// Ref: plan-fase7-puesta-al-dia.md Anexo 6 (G-W1 a G-W9), tests de A6.2; referencia-api-v1.md, nota del 2026-10-31
// (ADR-050 D9). Google Identity Services se sustituye por un doble: los tests nunca cargan el script real.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import * as session from '../src/lib/auth/session';
import { googleSignIn, login } from '../src/lib/api/identity';
import { linkGoogle, unlinkGoogle } from '../src/lib/api/account';
import { GIS_SCRIPT_URL, loadGoogleIdentity, _resetGoogleIdentityForTest, type GoogleIdApi } from '../src/lib/google/gis';
import { GoogleButton } from '../src/components/access/GoogleButton';
import { LoginScreen, GOOGLE_401, GOOGLE_503 } from '../src/screens/LoginScreen';
import { RegisterScreen } from '../src/screens/RegisterScreen';
import { SecurityCard, GOOGLE_LINK_TEXT } from '../src/components/account/SecurityCard';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/login' }));
vi.mock('../src/lib/routing/surfaces', () => ({ isSurfaceEnabled: () => true }));

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});
const fetchMock = vi.fn();
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
/** Dentro del diálogo abierto (la tarjeta tiene otro "Contraseña actual" para cambiarla). */
const dialog = () => within(screen.getByRole('dialog'));
const fillDialog = (value: string) => fireEvent.change(dialog().getByLabelText('Contraseña actual', { exact: true }), { target: { value } });

/** Un doble de `google.accounts.id`: el botón entrega el credential que el test elija. */
function fakeGis() {
  let callback: ((r: { credential?: string }) => void) | null = null;
  const api: GoogleIdApi & { initialize: ReturnType<typeof vi.fn>; renderButton: ReturnType<typeof vi.fn> } = {
    initialize: vi.fn((c) => { callback = c.callback; }),
    renderButton: vi.fn((el: HTMLElement) => {
      const b = document.createElement('span');
      b.setAttribute('data-testid', 'gis-button');
      el.appendChild(b);
    }),
  };
  return {
    api,
    loader: vi.fn(async () => api),
    emit: (credential: string) => act(() => { callback?.({ credential }); }),
  };
}

beforeEach(() => {
  session._resetForTest();
  fetchMock.mockReset();
  global.fetch = fetchMock as any;
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  _resetGoogleIdentityForTest();
  document.head.querySelectorAll('script').forEach((n) => n.remove());
  delete (window as any).google;
});
afterEach(() => vi.unstubAllEnvs());

describe('P-16 · contrato', () => {
  it('POST /auth/google {idToken, versiones?}: 200, 401, los dos 403, 503 GoogleSignInUnavailable, 400 y sin red', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { token: 'tok-g' }));
    expect(await googleSignIn('id-tok', { acceptedTermsVersion: 'v1-2026-10' })).toEqual({ kind: 'ok', token: 'tok-g' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/auth/google');
    expect(JSON.parse(init.body)).toEqual({ idToken: 'id-tok', acceptedTermsVersion: 'v1-2026-10' });
    expect(init.headers.Authorization).toBeUndefined();
    fetchMock.mockResolvedValueOnce(res(401, { title: 'Unauthorized' }));
    expect(await googleSignIn('x')).toEqual({ kind: 'invalid-credentials' });
    fetchMock.mockResolvedValueOnce(res(403, { title: 'EmailNotVerified' }));
    expect(await googleSignIn('x')).toEqual({ kind: 'email-not-verified' });
    fetchMock.mockResolvedValueOnce(res(403, { title: 'AcceptanceRequired', pendingDataPolicyVersion: 'v1-2026-10' }));
    expect(await googleSignIn('x')).toEqual({ kind: 'acceptance-required', pendingDataPolicyVersion: 'v1-2026-10' });
    fetchMock.mockResolvedValueOnce(res(503, { title: 'GoogleSignInUnavailable' }));
    expect(await googleSignIn('x')).toEqual({ kind: 'google-unavailable' });
    fetchMock.mockResolvedValueOnce(res(400, { title: 'Bad Request' }));
    expect(await googleSignIn('x')).toEqual({ kind: 'bad-request' });
    fetchMock.mockRejectedValueOnce(new TypeError('net'));
    expect(await googleSignIn('x')).toEqual({ kind: 'network' });
  });

  it('el login con contraseña no cambia: un 503 sigue siendo server-error (negativa)', async () => {
    fetchMock.mockResolvedValueOnce(res(503, { title: 'GoogleSignInUnavailable' }));
    expect(await login('a@b.co', 'x')).toEqual({ kind: 'server-error' });
  });

  it('POST /account/google/link {idToken, currentPassword} con JWT: 204 y cada 400, 409 y 503', async () => {
    session.login('tok-1');
    const cases: Array<[number, string | undefined, string]> = [
      [204, undefined, 'ok'],
      [400, 'CurrentPasswordIncorrect', 'current-incorrect'],
      [400, 'GoogleIdTokenInvalid', 'google-invalid'],
      [409, 'GoogleAccountAlreadyLinked', 'google-taken'],
      [409, 'AccountAlreadyLinkedToGoogle', 'already-linked'],
      [503, 'GoogleSignInUnavailable', 'google-unavailable'],
      [500, undefined, 'error'],
    ];
    for (const [status, title, kind] of cases) {
      fetchMock.mockResolvedValueOnce(res(status, title ? { title } : undefined));
      expect(await linkGoogle('id-tok', 'clave-actual')).toEqual({ kind });
    }
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/account/google/link');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-1');
    expect(init.headers['Command-Id']).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ idToken: 'id-tok', currentPassword: 'clave-actual' });
  });

  it('DELETE /account/google/link {currentPassword}: 204, 400 CurrentPasswordIncorrect y sin red', async () => {
    session.login('tok-1');
    fetchMock.mockResolvedValueOnce(res(204));
    expect(await unlinkGoogle('clave')).toEqual({ kind: 'ok' });
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ currentPassword: 'clave' });
    fetchMock.mockResolvedValueOnce(res(400, { title: 'CurrentPasswordIncorrect' }));
    expect(await unlinkGoogle('mal')).toEqual({ kind: 'current-incorrect' });
    fetchMock.mockRejectedValueOnce(new TypeError('net'));
    expect(await unlinkGoogle('clave')).toEqual({ kind: 'network' });
  });
});

describe('P-16 · el script de Google (G-W1 y G-W2)', () => {
  it('sin NEXT_PUBLIC_GOOGLE_CLIENT_ID: ni botón en el acceso ni script (negativa)', async () => {
    const gis = fakeGis();
    render(<LoginScreen googleLoader={gis.loader} />);
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeTruthy();
    expect(screen.queryByTestId('google-sign-in')).toBeNull();
    expect(gis.loader).not.toHaveBeenCalled();
    expect(document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`)).toBeNull();
  });

  it('con el ID de cliente: el botón oficial se pinta con ese ID, en ventana emergente, sin One Tap', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'client-web-test');
    const gis = fakeGis();
    render(<LoginScreen googleLoader={gis.loader} />);
    await screen.findByTestId('gis-button');
    expect(gis.api.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'client-web-test', ux_mode: 'popup', auto_select: false }));
    expect(gis.api.renderButton.mock.calls[0][1]).toEqual(expect.objectContaining({ text: 'continue_with', locale: 'es', theme: 'outline' }));
    expect((gis.api as any).prompt).toBeUndefined();
  });

  it('con un contenedor oscuro, el botón usa el tema oscuro de Google', async () => {
    const gis = fakeGis();
    render(<div data-theme="dark"><GoogleButton clientId="client-web-test" loader={gis.loader} onCredential={() => {}} /></div>);
    await screen.findByTestId('gis-button');
    expect(gis.api.renderButton.mock.calls[0][1].theme).toBe('filled_black');
  });

  it('el script se pide una sola vez por pestaña, aunque haya varios botones', async () => {
    const p1 = loadGoogleIdentity();
    const p2 = loadGoogleIdentity();
    expect(p1).toBe(p2);
    const scripts = document.head.querySelectorAll(`script[src="${GIS_SCRIPT_URL}"]`);
    expect(scripts.length).toBe(1);
    (window as any).google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };
    (scripts[0] as HTMLScriptElement).onload?.(new Event('load'));
    await expect(p1).resolves.toBeTruthy();
    await loadGoogleIdentity();
    expect(document.head.querySelectorAll(`script[src="${GIS_SCRIPT_URL}"]`).length).toBe(1);
  });

  it('si el script falla: "No pudimos cargar el botón de Google" con Reintentar, que vuelve a intentarlo', async () => {
    const gis = fakeGis();
    const loader = vi.fn().mockRejectedValueOnce(new Error('bloqueado')).mockImplementation(gis.loader);
    render(<GoogleButton clientId="client-web-test" loader={loader} onCredential={() => {}} />);
    await screen.findByText('No pudimos cargar el botón de Google.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByTestId('gis-button');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('"Crear cuenta" no tiene Google (G-W4, negativa)', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'client-web-test');
    render(<RegisterScreen />);
    expect(screen.queryByTestId('google-button')).toBeNull();
    expect(screen.queryByText(/Google/)).toBeNull();
  });
});

describe('P-16 · "Continuar con Google" (G-W3)', () => {
  const setup = (client: ReturnType<typeof vi.fn>) => {
    const gis = fakeGis();
    render(<LoginScreen googleClient={client as any} googleLoader={gis.loader} googleClientId="client-web-test" />);
    return gis;
  };

  it('200 → entra con el token de Google', async () => {
    const client = vi.fn().mockResolvedValue({ kind: 'ok', token: 'tok-g' });
    const gis = setup(client);
    await screen.findByTestId('gis-button');
    gis.emit('id-tok');
    await waitFor(() => expect(session.getJwt()).toBe('tok-g'));
    expect(client).toHaveBeenCalledWith('id-tok', undefined);
  });

  it('401 → un único texto que no revela el motivo y apunta a vincular en Seguridad', async () => {
    const gis = setup(vi.fn().mockResolvedValue({ kind: 'invalid-credentials' }));
    await screen.findByTestId('gis-button');
    gis.emit('id-tok');
    expect((await screen.findByRole('alert')).textContent).toBe(GOOGLE_401);
    expect(session.getJwt()).toBeNull();
  });

  it('503 → "Google no responde ahora" y el formulario sigue', async () => {
    const gis = setup(vi.fn().mockResolvedValue({ kind: 'google-unavailable' }));
    await screen.findByTestId('gis-button');
    gis.emit('id-tok');
    expect((await screen.findByRole('alert')).textContent).toBe(GOOGLE_503);
    expect(screen.getByLabelText('Correo electrónico')).toBeTruthy();
  });

  it('403 AcceptanceRequired → "Aceptar y entrar" repite con el MISMO idToken y las versiones', async () => {
    const client = vi.fn()
      .mockResolvedValueOnce({ kind: 'acceptance-required', pendingTermsVersion: 'v1-2026-10' })
      .mockResolvedValueOnce({ kind: 'ok', token: 'tok-g' });
    const loginClient = vi.fn();
    const gis = fakeGis();
    render(<LoginScreen loginClient={loginClient} googleClient={client} googleLoader={gis.loader} googleClientId="client-web-test" />);
    await screen.findByTestId('gis-button');
    gis.emit('id-tok-1');
    await screen.findByTestId('acceptance-required');
    expect(screen.queryByTestId('google-sign-in')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar y entrar' }));
    await waitFor(() => expect(session.getJwt()).toBe('tok-g'));
    expect(client).toHaveBeenNthCalledWith(2, 'id-tok-1', { acceptedTermsVersion: 'v1-2026-10' });
    expect(loginClient).not.toHaveBeenCalled();
  });

  it('403 EmailNotVerified con Google → "confirma tu correo" sin Reenviar (la web no sabe el correo)', async () => {
    const gis = setup(vi.fn().mockResolvedValue({ kind: 'email-not-verified' }));
    await screen.findByTestId('gis-button');
    gis.emit('id-tok');
    await screen.findByTestId('email-not-verified');
    expect(screen.getByText(/entra con tu correo y contraseña para pedir otro/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Reenviar/ })).toBeNull();
  });

  it('después de un intento con Google, el formulario vuelve a usar la contraseña (negativa)', async () => {
    const client = vi.fn().mockResolvedValue({ kind: 'invalid-credentials' });
    const loginClient = vi.fn().mockResolvedValue({ kind: 'invalid-credentials' });
    const gis = fakeGis();
    render(<LoginScreen loginClient={loginClient} googleClient={client} googleLoader={gis.loader} googleClientId="client-web-test" />);
    await screen.findByTestId('gis-button');
    gis.emit('id-tok');
    await screen.findByRole('alert');
    fill('Correo electrónico', 'a@b.co');
    fill('Contraseña', 'clave');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(loginClient).toHaveBeenCalledWith('a@b.co', 'clave', undefined));
    expect(client).toHaveBeenCalledTimes(1);
    expect((await screen.findByRole('alert')).textContent).toBe('Correo o contraseña incorrectos.');
  });
});

describe('P-16 · Seguridad › Cuenta de Google (G-W5 a G-W7)', () => {
  const base = { changePassword: vi.fn(), deactivate: vi.fn() };

  it('sin ID de cliente no hay bloque de Google (negativa)', () => {
    render(<SecurityCard clients={{ ...base, googleClientId: null }} />);
    expect(screen.queryByTestId('google-link-block')).toBeNull();
  });

  it('vincular: el botón de Google solo aparece con la contraseña escrita; envía idToken y contraseña', async () => {
    const link = vi.fn().mockResolvedValue({ kind: 'ok' });
    const gis = fakeGis();
    render(<SecurityCard clients={{ ...base, linkGoogle: link, unlinkGoogle: vi.fn(), googleLoader: gis.loader, googleClientId: 'client-web-test' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vincular Google' }));
    expect(screen.getByTestId('google-link-needs-password')).toBeTruthy();
    expect(screen.queryByTestId('gis-button')).toBeNull();
    expect(gis.loader).not.toHaveBeenCalled();
    fillDialog('clave-actual');
    await screen.findByTestId('gis-button');
    expect(gis.api.renderButton.mock.calls[0][1].text).toBe('signin_with');
    gis.emit('id-tok');
    await screen.findByText('Vinculamos tu cuenta de Google. Ya puedes entrar con ella.');
    expect(link).toHaveBeenCalledWith('id-tok', 'clave-actual');
    expect(screen.queryByTestId('google-link-form')).toBeNull();
  });

  it('vincular con la contraseña incorrecta: el error va en el campo, que se vacía, y el diálogo sigue', async () => {
    const gis = fakeGis();
    render(<SecurityCard clients={{ ...base, linkGoogle: vi.fn().mockResolvedValue({ kind: 'current-incorrect' }), unlinkGoogle: vi.fn(), googleLoader: gis.loader, googleClientId: 'client-web-test' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vincular Google' }));
    fillDialog('mal');
    await screen.findByTestId('gis-button');
    gis.emit('id-tok');
    await screen.findByText('La contraseña actual no es correcta.');
    expect((dialog().getByLabelText('Contraseña actual', { exact: true }) as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('google-link-form')).toBeTruthy();
  });

  for (const kind of ['google-invalid', 'google-taken', 'already-linked', 'google-unavailable'] as const) {
    it(`vincular → ${kind}: su texto`, async () => {
      const gis = fakeGis();
      render(<SecurityCard clients={{ ...base, linkGoogle: vi.fn().mockResolvedValue({ kind }), unlinkGoogle: vi.fn(), googleLoader: gis.loader, googleClientId: 'client-web-test' }} />);
      fireEvent.click(screen.getByRole('button', { name: 'Vincular Google' }));
      fillDialog('clave');
      await screen.findByTestId('gis-button');
      gis.emit('id-tok');
      await screen.findByText(GOOGLE_LINK_TEXT[kind]);
    });
  }

  it('vincular sin respuesta → aviso en amarillo que dice que repetir es seguro', async () => {
    const gis = fakeGis();
    render(<SecurityCard clients={{ ...base, linkGoogle: vi.fn().mockResolvedValue({ kind: 'network' }), unlinkGoogle: vi.fn(), googleLoader: gis.loader, googleClientId: 'client-web-test' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vincular Google' }));
    fillDialog('clave');
    await screen.findByTestId('gis-button');
    gis.emit('id-tok');
    await screen.findByText('No sabemos si se vinculó');
    expect(screen.getByText(/si ya quedó vinculada, no cambia nada/)).toBeTruthy();
  });

  it('desvincular: pide la contraseña, envía DELETE y no afirma que hubiera un vínculo', async () => {
    const unlink = vi.fn().mockResolvedValueOnce({ kind: 'current-incorrect' }).mockResolvedValueOnce({ kind: 'ok' });
    render(<SecurityCard clients={{ ...base, linkGoogle: vi.fn(), unlinkGoogle: unlink, googleClientId: 'client-web-test' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular Google' }));
    fireEvent.click(dialog().getByRole('button', { name: 'Desvincular' }));
    expect(await screen.findByText('Este campo es obligatorio.')).toBeTruthy();
    expect(unlink).not.toHaveBeenCalled();
    fillDialog('mal');
    fireEvent.click(dialog().getByRole('button', { name: 'Desvincular' }));
    await screen.findByText('La contraseña actual no es correcta.');
    fillDialog('clave');
    fireEvent.click(dialog().getByRole('button', { name: 'Desvincular' }));
    await screen.findByText('Listo. Si tenías una cuenta de Google vinculada, ya no podrás entrar con ella.');
    expect(unlink).toHaveBeenLastCalledWith('clave');
  });
});
