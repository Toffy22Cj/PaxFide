// Ref: plan-fase7-puesta-al-dia.md Anexo 1, P-6 (verificación del correo); ADR-050 Enmienda 2; referencia-api-v1.md §1,
// nota del 2026-10-29. Cada rama con su negativa.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as session from '../src/lib/auth/session';
import { confirmEmailVerification, fetchAccount, requestEmailVerification } from '../src/lib/api/account';
import { login } from '../src/lib/api/identity';
import { ResendVerification, RESEND_TEXT } from '../src/components/access/ResendVerification';
import { VerifyEmailScreen, VERIFIED_TEXT, VERIFY_INVALID_TEXT } from '../src/screens/VerifyEmailScreen';
import { LoginScreen } from '../src/screens/LoginScreen';
import { RegisterScreen } from '../src/screens/RegisterScreen';
import { classifyRoute } from '../src/lib/routing/classifier';

const replace = vi.fn();
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }), usePathname: () => '/login' }));
vi.mock('../src/lib/routing/surfaces', () => ({ isSurfaceEnabled: () => true }));

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});
const fetchMock = vi.fn();
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });

beforeEach(() => {
  session._resetForTest();
  replace.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock as any;
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
});
afterEach(() => vi.unstubAllEnvs());

describe('P-6 · contrato', () => {
  it('login: 403 EmailNotVerified → email-not-verified; 403 AcceptanceRequired sigue igual; 401 sin cambios', async () => {
    fetchMock.mockResolvedValueOnce(res(403, { title: 'EmailNotVerified', status: 403 }));
    expect(await login('a@b.co', 'x')).toEqual({ kind: 'email-not-verified' });
    fetchMock.mockResolvedValueOnce(res(403, { title: 'AcceptanceRequired', status: 403, pendingTermsVersion: 'v1' }));
    expect(await login('a@b.co', 'x')).toEqual({ kind: 'acceptance-required', pendingTermsVersion: 'v1' });
    fetchMock.mockResolvedValueOnce(res(401, { title: 'Unauthorized', status: 401 }));
    expect(await login('a@b.co', 'x')).toEqual({ kind: 'invalid-credentials' });
  });

  it('POST /auth/email-verification {email}: 202 → ok; el correo solo en el cuerpo', async () => {
    fetchMock.mockResolvedValueOnce(res(202));
    expect(await requestEmailVerification('a@b.co')).toEqual({ kind: 'ok' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/auth/email-verification');
    expect(String(url)).not.toContain('a@b.co');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.co' });
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('POST /auth/email-verification/confirm: 204 → ok; 400 EmailVerificationTokenInvalid → token-invalid; el token solo en el cuerpo', async () => {
    fetchMock.mockResolvedValueOnce(res(204));
    expect(await confirmEmailVerification('vrf-secreto')).toEqual({ kind: 'ok' });
    expect(fetchMock.mock.calls[0][0]).not.toContain('vrf-secreto');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: 'vrf-secreto' });
    fetchMock.mockResolvedValueOnce(res(400, { title: 'EmailVerificationTokenInvalid', status: 400 }));
    expect(await confirmEmailVerification('x')).toEqual({ kind: 'token-invalid' });
  });

  it('GET /account trae emailVerified (y sin el campo no se inventa)', async () => {
    session.login('jwt');
    fetchMock.mockResolvedValueOnce(res(200, { email: 'a@b.co', emailVerified: false }));
    expect(await fetchAccount()).toEqual({ kind: 'ok', account: { accountId: '', email: 'a@b.co', emailVerified: false } });
    fetchMock.mockResolvedValueOnce(res(200, { email: 'a@b.co' }));
    expect(await fetchAccount()).toEqual({ kind: 'ok', account: { accountId: '', email: 'a@b.co' } });
  });

  it('/verificar-correo es una ruta pública', () => {
    expect(classifyRoute('/verificar-correo')).toBe('PUBLIC');
    expect(classifyRoute('/verificar-correo/x')).toBe('NOT_APPROVED');
  });
});

describe('P-6 · "Reenviar"', () => {
  it.each(['ok', 'bad-request', 'error'] as const)('%s → siempre el mismo texto (exista o no la cuenta)', async (kind) => {
    const client = vi.fn().mockResolvedValue({ kind });
    render(<ResendVerification email="a@b.co" client={client} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar' }));
    expect(await screen.findByTestId('resend-sent')).toHaveTextContent(RESEND_TEXT);
    expect(client).toHaveBeenCalledWith('a@b.co');
  });

  it('fallo de red: texto de conexión, nunca el de enviado (negativa)', async () => {
    render(<ResendVerification email="a@b.co" client={vi.fn().mockResolvedValue({ kind: 'network' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar');
    expect(screen.queryByTestId('resend-sent')).toBeNull();
  });

  it('sin correo conocido pide el campo y no envía vacío', async () => {
    const client = vi.fn().mockResolvedValue({ kind: 'ok' });
    render(<ResendVerification client={client} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar' }));
    expect(await screen.findByText('Este campo es obligatorio.')).toBeInTheDocument();
    expect(client).not.toHaveBeenCalled();
  });
});

describe('P-6 · registro y login', () => {
  it('tras registrarse: "Revisa tu correo" con el correo y "Reenviar"', async () => {
    const resend = vi.fn().mockResolvedValue({ kind: 'ok' });
    render(<RegisterScreen client={async () => ({ kind: 'ok' })} resendClient={resend} />);
    fill('Correo electrónico', ' nueva@demo.test ');
    fill('Contraseña', 'clave-de-12-car');
    fill('Repite la contraseña', 'clave-de-12-car');
    for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeInTheDocument();
    expect(screen.getByTestId('check-email-address')).toHaveTextContent('nueva@demo.test');
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar' }));
    expect(await screen.findByTestId('resend-sent')).toHaveTextContent(RESEND_TEXT);
    expect(resend).toHaveBeenCalledWith('nueva@demo.test');
  });

  it('login con 403 EmailNotVerified: "Antes de entrar, confirma tu correo" con "Reenviar"; la contraseña no queda en el DOM', async () => {
    const resend = vi.fn().mockResolvedValue({ kind: 'ok' });
    render(<LoginScreen loginClient={async () => ({ kind: 'email-not-verified' })} resendClient={resend} />);
    fill('Correo electrónico', 'nueva@demo.test');
    fill('Contraseña', 'clave-secreta-123');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Antes de entrar, confirma tu correo' })).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('clave-secreta-123');
    expect(screen.queryByTestId('acceptance-required')).toBeNull();
    expect(session.getState()).toBe('LOGGED_OUT');
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar' }));
    expect(await screen.findByTestId('resend-sent')).toHaveTextContent(RESEND_TEXT);
    expect(resend).toHaveBeenCalledWith('nueva@demo.test');
    // "Volver": el formulario con la contraseña vacía
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect((screen.getByLabelText('Contraseña', { exact: true }) as HTMLInputElement).value).toBe('');
  });

  it('negativa: el 401 de una contraseña errónea sigue con su texto único y no menciona la verificación', async () => {
    render(<LoginScreen loginClient={async () => ({ kind: 'invalid-credentials' })} />);
    fill('Correo electrónico', 'a@b.co');
    fill('Contraseña', 'mala');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/confirma tu correo|correo sin verificar|Reenviar/i);
    expect(screen.queryByTestId('email-not-verified')).toBeNull();
  });
});

describe('P-6 · /verificar-correo', () => {
  it('tras cargar, el token ya no está en location.href (antes de la respuesta); 204 → al login con el aviso y sin sesión', async () => {
    window.history.replaceState(null, '', '/verificar-correo#token=vrf-secreto');
    let resolve!: (v: { kind: 'ok' }) => void;
    const client = vi.fn(() => new Promise<{ kind: 'ok' }>((r) => { resolve = r; }));
    render(<VerifyEmailScreen confirmClient={client} />);
    await waitFor(() => expect(client).toHaveBeenCalledWith('vrf-secreto'));
    expect(window.location.href).not.toContain('vrf-secreto');
    expect(window.location.hash).toBe('');
    resolve({ kind: 'ok' });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(session.peekLoginNotice()).toBe(VERIFIED_TEXT);
    // Negativa: confirmar no deja ninguna sesión
    expect(session.getState()).toBe('LOGGED_OUT');
    expect(session.getJwt()).toBeNull();
    expect(client).toHaveBeenCalledTimes(1);
  });

  it('400 → "El enlace no es válido o caducó" con "Reenviar"; no navega', async () => {
    window.history.replaceState(null, '', '/verificar-correo#token=vrf-viejo');
    const resend = vi.fn().mockResolvedValue({ kind: 'ok' });
    render(<VerifyEmailScreen confirmClient={vi.fn().mockResolvedValue({ kind: 'token-invalid' })} resendClient={resend} />);
    expect(await screen.findByTestId('verify-invalid')).toHaveTextContent(VERIFY_INVALID_TEXT);
    expect(replace).not.toHaveBeenCalled();
    fill('Correo electrónico', 'a@b.co');
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar' }));
    expect(await screen.findByTestId('resend-sent')).toHaveTextContent(RESEND_TEXT);
    expect(window.location.href).not.toContain('vrf-viejo');
  });

  it('sin token: no confirma nada y ofrece "Reenviar"', async () => {
    window.history.replaceState(null, '', '/verificar-correo');
    const client = vi.fn();
    render(<VerifyEmailScreen confirmClient={client} />);
    expect(await screen.findByRole('button', { name: 'Reenviar' })).toBeInTheDocument();
    expect(client).not.toHaveBeenCalled();
  });
});

describe('P-6 · aviso en el Perfil', () => {
  async function profile(emailVerified?: boolean) {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as never;
    const { ProfileScreen } = await import('../src/screens/ProfileScreen');
    render(<ProfileScreen client={async () => ({ kind: 'ok', account: { accountId: '', email: 'a@b.co', ...(emailVerified === undefined ? {} : { emailVerified }) } })}
      profileClients={{ fetch: async () => ({ kind: 'ok', profile: { email: 'a@b.co' } }), update: async () => ({ kind: 'error' }) }}
      impactClient={async () => ({ kind: 'error' })} />);
    await screen.findByTestId('profile-screen');
  }
  it('emailVerified: false → aviso con "Reenviar" (fuera del bloque de color)', async () => {
    await profile(false);
    const notice = screen.getByTestId('email-unverified-notice');
    expect(notice).toHaveTextContent('Confirma tu correo');
    const colored = notice.querySelector('[role="status"]')!;
    expect(colored.querySelector('button')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reenviar' })).toBeInTheDocument();
  });
  it.each([true, undefined])('emailVerified: %s → sin aviso (negativa)', async (v) => {
    await profile(v);
    expect(screen.queryByTestId('email-unverified-notice')).toBeNull();
  });
});
