// Ref: plan-fase7-puesta-al-dia.md P-1 (F-C1 completa + D7); referencia-api-v1.md §1 (notas del 2026-10-25: contraseña,
// desactivación, perfil y recuperación) y §2 (reactivación). Cada rama con aserciones negativas de las otras (2.5).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import * as session from '../src/lib/auth/session';
import {
  changePassword, confirmPasswordReset, deactivateAccount, fetchAccount, fetchProfile, initialsOf, requestPasswordReset,
  updateProfile,
} from '../src/lib/api/account';
import { reactivateAccount } from '../src/lib/api/organization';
import { captureResetToken, clearResetToken, getResetToken } from '../src/lib/auth/resetToken';
import { SecurityCard, DEACTIVATE_TEXT } from '../src/components/account/SecurityCard';
import { NameGate } from '../src/components/access/NameGate';
import { RecoverScreen, RESET_DONE_TEXT, RESET_SENT_TEXT, RESET_TOKEN_INVALID_TEXT } from '../src/screens/RecoverScreen';
import { LoginScreen } from '../src/screens/LoginScreen';
import { PlatformScreen } from '../src/screens/PlatformScreen';
import { classifyRoute } from '../src/lib/routing/classifier';

const replace = vi.fn();
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }), usePathname: () => '/recuperar' }));
vi.mock('../src/lib/routing/surfaces', () => ({ isSurfaceEnabled: () => true }));

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});
const fetchMock = vi.fn();
const authOf = (call: number) => (fetchMock.mock.calls[call][1].headers as Record<string, string>).Authorization;

beforeEach(() => {
  session._resetForTest();
  clearResetToken();
  replace.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock as any;
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
});
afterEach(() => vi.unstubAllEnvs());

describe('Cliente de cuenta (P-1)', () => {
  it('POST /account/password: 200 con token; 400 CurrentPasswordIncorrect / PasswordTooShort; 500 = cambió sin token', async () => {
    session.login('jwt-viejo');
    fetchMock.mockResolvedValueOnce(res(200, { token: 'jwt-nuevo' }));
    expect(await changePassword('actual', 'nueva-de-12-car')).toEqual({ kind: 'ok', token: 'jwt-nuevo' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ currentPassword: 'actual', newPassword: 'nueva-de-12-car' });
    expect(fetchMock.mock.calls[0][1].headers['Command-Id']).toBeUndefined();
    fetchMock.mockResolvedValueOnce(res(400, { title: 'CurrentPasswordIncorrect' }));
    expect((await changePassword('x', 'y')).kind).toBe('current-incorrect');
    fetchMock.mockResolvedValueOnce(res(400, { title: 'PasswordTooShort' }));
    expect((await changePassword('x', 'y')).kind).toBe('too-short');
    fetchMock.mockResolvedValueOnce(res(400, { title: 'BadRequest' }));
    expect((await changePassword('x', 'y')).kind).toBe('bad-request');
    fetchMock.mockResolvedValueOnce(res(500, { title: 'InternalServerError' }));
    expect((await changePassword('x', 'y')).kind).toBe('changed-without-token');
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect((await changePassword('x', 'y')).kind).toBe('network');
    // Ningún 400 cerró la sesión (ADR-043 T-1: nunca 401)
    expect(session.getState()).toBe('AUTHENTICATED');
  });

  it('POST /account/deactivate: 204; cada 409 con su tipo; 400 CurrentPasswordIncorrect', async () => {
    session.login('jwt');
    fetchMock.mockResolvedValueOnce(res(204));
    expect((await deactivateAccount('p')).kind).toBe('ok');
    for (const [title, kind] of [
      ['PlatformAdministratorDeactivation', 'platform-administrator'],
      ['RepresentativeTransferRequired', 'representative'],
      ['ActiveCampaignResponsible', 'campaign-responsible'],
    ]) {
      fetchMock.mockResolvedValueOnce(res(409, { title }));
      expect((await deactivateAccount('p')).kind).toBe(kind);
    }
    fetchMock.mockResolvedValueOnce(res(409, { title: 'Otra' }));
    expect((await deactivateAccount('p')).kind).toBe('error');
    fetchMock.mockResolvedValueOnce(res(400, { title: 'CurrentPasswordIncorrect' }));
    expect((await deactivateAccount('p')).kind).toBe('current-incorrect');
  });

  it('perfil: GET lee el nombre; PUT envía null para borrar y recorta; 400 = invalid', async () => {
    session.login('jwt');
    fetchMock.mockResolvedValueOnce(res(200, { email: 'a@b.co', givenName: 'Ana' }));
    expect(await fetchProfile()).toEqual({ kind: 'ok', profile: { email: 'a@b.co', givenName: 'Ana', familyName: undefined } });
    fetchMock.mockResolvedValueOnce(res(200, { email: 'a@b.co', givenName: 'Ana' }));
    await updateProfile('  Ana ', '   ');
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.paxfide.test/api/v1/account/profile');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ givenName: 'Ana', familyName: null });
    fetchMock.mockResolvedValueOnce(res(400, { title: 'BadRequest' }));
    expect((await updateProfile('x', '')).kind).toBe('invalid');
  });

  it('el nombre no viaja en GET /account (solo /account/profile)', async () => {
    session.login('jwt');
    fetchMock.mockResolvedValueOnce(res(200, { accountId: 'acc', email: 'a@b.co', givenName: 'Ana' }));
    const r = await fetchAccount();
    expect(r).toEqual({ kind: 'ok', account: { accountId: 'acc', email: 'a@b.co' } });
  });

  it('iniciales del boceto: solo con nombre; primera letra del nombre y del apellido', () => {
    expect(initialsOf({ email: 'x', givenName: 'ana', familyName: 'ruiz' })).toBe('AR');
    expect(initialsOf({ email: 'x', givenName: 'Ana' })).toBe('A');
    expect(initialsOf({ email: 'x', familyName: 'Ruiz' })).toBeNull();
    expect(initialsOf(null)).toBeNull();
  });

  it('recuperación: password-reset siempre 202 → ok; confirm 204; PasswordResetTokenInvalid; PasswordTooShort', async () => {
    fetchMock.mockResolvedValueOnce(res(202));
    expect((await requestPasswordReset('a@b.co')).kind).toBe('ok');
    // Pública: sin Authorization aunque haya sesión
    session.login('jwt-de-otra-sesion');
    fetchMock.mockResolvedValueOnce(res(204));
    expect((await confirmPasswordReset('tok', 'nueva-de-12-car')).kind).toBe('ok');
    expect(authOf(1)).toBeUndefined();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ token: 'tok', newPassword: 'nueva-de-12-car' });
    fetchMock.mockResolvedValueOnce(res(400, { title: 'PasswordResetTokenInvalid' }));
    expect((await confirmPasswordReset('t', 'p')).kind).toBe('token-invalid');
    fetchMock.mockResolvedValueOnce(res(400, { title: 'PasswordTooShort' }));
    expect((await confirmPasswordReset('t', 'p')).kind).toBe('too-short');
  });

  it('reactivar: 200 ACTIVE → ok; 404 → not-found; 403 → forbidden', async () => {
    session.login('jwt');
    fetchMock.mockResolvedValueOnce(res(200, { accountId: 'acc-1', status: 'ACTIVE' }));
    expect((await reactivateAccount('acc-1')).kind).toBe('ok');
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.paxfide.test/api/v1/platform/accounts/acc-1/reactivate');
    fetchMock.mockResolvedValueOnce(res(404, { title: 'NotFound' }));
    expect((await reactivateAccount('nope')).kind).toBe('not-found');
    fetchMock.mockResolvedValueOnce(res(403, { title: 'Forbidden' }));
    expect((await reactivateAccount('x')).kind).toBe('forbidden');
  });
});

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('Tarjeta "Seguridad": cambiar contraseña', () => {
  const fillChange = (current = 'actual-de-12c', next = 'nueva-de-12-car', repeat = next) => {
    fill('Contraseña actual', current);
    fill('Contraseña nueva', next);
    fill('Repite la contraseña nueva', repeat);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
  };

  it('éxito: el token de la respuesta sustituye al de la sesión y la siguiente petición lo lleva en la cabecera', async () => {
    session.login('jwt-viejo');
    fetchMock.mockResolvedValueOnce(res(200, { token: 'jwt-nuevo' }));
    render(<SecurityCard />);
    fillChange();
    expect(await screen.findByText('Cambiamos tu contraseña. Cerramos tus otras sesiones.')).toBeInTheDocument();
    expect(authOf(0)).toBe('Bearer jwt-viejo');
    fetchMock.mockResolvedValueOnce(res(200, { accountId: 'a', email: 'a@b.co' }));
    await fetchAccount();
    expect(authOf(1)).toBe('Bearer jwt-nuevo');
    // Negativas: la sesión sigue, los campos se vacían, sin aviso ambiguo ni de error
    expect(session.getState()).toBe('AUTHENTICATED');
    expect((screen.getByLabelText('Contraseña actual') as HTMLInputElement).value).toBe('');
    expect(screen.queryByTestId('status-notice-ambiguous')).toBeNull();
    expect(screen.queryByTestId('status-notice-rejected')).toBeNull();
  });

  it('rechazo: CurrentPasswordIncorrect va en el campo y NO cierra la sesión ni cambia el token', async () => {
    session.login('jwt-viejo');
    fetchMock.mockResolvedValueOnce(res(400, { title: 'CurrentPasswordIncorrect' }));
    render(<SecurityCard />);
    fillChange();
    expect(await screen.findByText('La contraseña actual no es correcta.')).toBeInTheDocument();
    expect(session.getState()).toBe('AUTHENTICATED');
    expect(session.getJwt()).toBe('jwt-viejo');
    expect(screen.queryByText('Cambiamos tu contraseña. Cerramos tus otras sesiones.')).toBeNull();
  });

  it('antes de enviar: menos de 12 caracteres o no coinciden → no sale la petición', async () => {
    session.login('jwt');
    render(<SecurityCard />);
    fillChange('actual', 'corta');
    expect(await screen.findByText('La contraseña debe tener al menos 12 caracteres.')).toBeInTheDocument();
    fillChange('actual', 'nueva-de-12-car', 'otra-de-12-car');
    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fallo: un 500 tras confirmar cierra la sesión y el login dice que la contraseña cambió', async () => {
    session.login('jwt-viejo');
    fetchMock.mockResolvedValueOnce(res(500, { title: 'InternalServerError' }));
    render(<SecurityCard />);
    fillChange();
    await waitFor(() => expect(session.getState()).toBe('LOGGED_OUT'));
    expect(session.getLastLogoutReason()).toBe('PASSWORD_CHANGED');
    expect(session.getJwt()).toBeNull();
    render(<LoginScreen loginClient={vi.fn()} />);
    expect(screen.getByText('Tu contraseña cambió; vuelve a iniciar sesión.')).toBeInTheDocument();
  });

  it('sin respuesta: aviso amarillo, sin reintento automático, y la sesión no se toca', async () => {
    session.login('jwt-viejo');
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<SecurityCard />);
    fillChange();
    expect(await screen.findByTestId('status-notice-ambiguous')).toHaveTextContent('No sabemos si tu contraseña cambió');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(session.getJwt()).toBe('jwt-viejo');
    expect(screen.queryByText('Cambiamos tu contraseña. Cerramos tus otras sesiones.')).toBeNull();
  });
});

describe('Tarjeta "Seguridad": desactivar la cuenta', () => {
  const confirm = (password = 'actual-de-12c') => {
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar mi cuenta' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Contraseña actual'), { target: { value: password } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
  };

  it('pide confirmación (sin diálogo del navegador): sin confirmar no sale nada', () => {
    session.login('jwt');
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<SecurityCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar mi cuenta' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('¿Desactivar tu cuenta?');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('éxito: 204 cierra la sesión con su motivo', async () => {
    session.login('jwt');
    fetchMock.mockResolvedValueOnce(res(204));
    render(<SecurityCard />);
    confirm();
    await waitFor(() => expect(session.getState()).toBe('LOGGED_OUT'));
    expect(session.getLastLogoutReason()).toBe('DEACTIVATED');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ currentPassword: 'actual-de-12c' });
  });

  it.each([
    ['RepresentativeTransferRequired', 'representative'],
    ['ActiveCampaignResponsible', 'campaign-responsible'],
    ['PlatformAdministratorDeactivation', 'platform-administrator'],
  ] as const)('rechazo 409 %s: texto propio y la sesión sigue', async (title, kind) => {
    session.login('jwt');
    fetchMock.mockResolvedValueOnce(res(409, { title }));
    render(<SecurityCard />);
    confirm();
    expect(await screen.findByText(DEACTIVATE_TEXT[kind])).toBeInTheDocument();
    for (const other of Object.keys(DEACTIVATE_TEXT) as (keyof typeof DEACTIVATE_TEXT)[]) {
      if (other !== kind) expect(screen.queryByText(DEACTIVATE_TEXT[other])).toBeNull();
    }
    expect(session.getState()).toBe('AUTHENTICATED');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('rechazo: contraseña incorrecta en el campo, el diálogo sigue abierto y la sesión también', async () => {
    session.login('jwt');
    fetchMock.mockResolvedValueOnce(res(400, { title: 'CurrentPasswordIncorrect' }));
    render(<SecurityCard />);
    confirm();
    expect(await within(screen.getByRole('dialog')).findByText('La contraseña actual no es correcta.')).toBeInTheDocument();
    expect(session.getState()).toBe('AUTHENTICATED');
  });

  it('sin respuesta: aviso amarillo y la sesión no se cierra desde aquí', async () => {
    session.login('jwt');
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<SecurityCard />);
    confirm();
    expect(await screen.findByTestId('status-notice-ambiguous')).toHaveTextContent('No sabemos si tu cuenta se desactivó');
    expect(session.getState()).toBe('AUTHENTICATED');
  });
});

describe('/recuperar', () => {
  it('es pública (como /invitaciones)', () => {
    expect(classifyRoute('/recuperar')).toBe('PUBLIC');
    expect(classifyRoute('/recuperar/x')).toBe('NOT_APPROVED');
  });

  it('el token sale de la barra antes de cualquier petición y solo viaja en el cuerpo de confirm', async () => {
    window.history.replaceState(null, '', '/recuperar#token=tok-secreto');
    let hrefAtFirstFetch: string | null = null;
    fetchMock.mockImplementationOnce(async () => { hrefAtFirstFetch = window.location.href; return res(204); });
    render(<RecoverScreen />);
    expect(window.location.href).not.toContain('tok-secreto');
    expect(window.location.hash).toBe('');
    fill('Contraseña nueva', 'nueva-de-12-car');
    fill('Repite la contraseña', 'nueva-de-12-car');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(hrefAtFirstFetch).not.toContain('tok-secreto');
    expect(fetchMock.mock.calls[0][0]).not.toContain('tok-secreto');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).token).toBe('tok-secreto');
    expect(getResetToken()).toBeNull();
    // Al login con el aviso
    render(<LoginScreen loginClient={vi.fn()} />);
    expect(screen.getByTestId('login-notice')).toHaveTextContent(RESET_DONE_TEXT);
  });

  it('PasswordTooShort no consume el token: se corrige y se reenvía con el mismo', async () => {
    window.history.replaceState(null, '', '/recuperar#token=tok-1');
    const client = vi.fn().mockResolvedValueOnce({ kind: 'too-short' }).mockResolvedValueOnce({ kind: 'ok' });
    render(<RecoverScreen confirmClient={client} />);
    // El backend decide (p. ej. otra regla de longitud): aquí 12 caracteres pasan la comprobación previa
    fill('Contraseña nueva', 'nueva-de-12-car');
    fill('Repite la contraseña', 'nueva-de-12-car');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('La contraseña debe tener al menos 12 caracteres.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    fill('Contraseña nueva', 'otra-nueva-de-14');
    fill('Repite la contraseña', 'otra-nueva-de-14');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(client.mock.calls.map((c) => c[0])).toEqual(['tok-1', 'tok-1']);
  });

  it('PasswordResetTokenInvalid: un único texto y se puede pedir otro enlace; nunca al login', async () => {
    window.history.replaceState(null, '', '/recuperar#token=tok-usado');
    const client = vi.fn().mockResolvedValue({ kind: 'token-invalid' });
    render(<RecoverScreen confirmClient={client} />);
    fill('Contraseña nueva', 'nueva-de-12-car');
    fill('Repite la contraseña', 'nueva-de-12-car');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText(RESET_TOKEN_INVALID_TEXT)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(getResetToken()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir un enlace nuevo' }));
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
  });

  it('sin token: pide el correo y siempre muestra el mismo mensaje (incluye "vuelve a pedirlo en 5 minutos")', async () => {
    window.history.replaceState(null, '', '/recuperar');
    const client = vi.fn().mockResolvedValue({ kind: 'ok' });
    render(<RecoverScreen requestClient={client} />);
    expect(screen.queryByLabelText('Contraseña nueva')).toBeNull();
    fill('Correo electrónico', ' a@b.co ');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByTestId('reset-sent')).toHaveTextContent(RESET_SENT_TEXT);
    expect(RESET_SENT_TEXT).toContain('si no llega, vuelve a pedirlo en 5 minutos'.replace('si', 'Si'));
    expect(client).toHaveBeenCalledWith('a@b.co');
  });

  it('sin token y fallo de red: texto de conexión, nunca el mensaje de enviado', async () => {
    window.history.replaceState(null, '', '/recuperar');
    render(<RecoverScreen requestClient={vi.fn().mockResolvedValue({ kind: 'network' })} />);
    fill('Correo electrónico', 'a@b.co');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByText('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.')).toBeInTheDocument();
    expect(screen.queryByTestId('reset-sent')).toBeNull();
  });

  it('captureResetToken borra el fragmento aunque el token no sea válido', () => {
    window.history.replaceState(null, '', '/recuperar#otra=cosa');
    expect(captureResetToken()).toBe(false);
    expect(window.location.hash).toBe('');
  });
});

describe('Login: "¿Olvidaste tu contraseña?"', () => {
  it('dentro de la tarjeta, enlaza a /recuperar; el aviso de otra pantalla se muestra una sola vez', () => {
    session.setLoginNotice(RESET_DONE_TEXT);
    const { unmount } = render(<LoginScreen loginClient={vi.fn()} />);
    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute('href', '/recuperar');
    expect(screen.getByTestId('login-notice')).toHaveTextContent(RESET_DONE_TEXT);
    unmount();
    render(<LoginScreen loginClient={vi.fn()} />);
    expect(screen.queryByTestId('login-notice')).toBeNull();
  });
});

describe('"¿Cómo te llamamos?"', () => {
  it('guarda nombre y apellido con PUT /account/profile y continúa', async () => {
    const update = vi.fn().mockResolvedValue({ kind: 'ok', profile: { email: 'a@b.co', givenName: 'Ana' } });
    const onDone = vi.fn();
    render(<NameGate clients={{ fetch: vi.fn().mockResolvedValue({ kind: 'ok', profile: { email: 'a@b.co' } }), update }} onDone={onDone} />);
    expect(await screen.findByDisplayValue('a@b.co')).toHaveAttribute('readonly');
    fill('Nombre', 'Ana');
    fill('Apellido', 'Ruiz');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith('Ana', 'Ruiz');
  });

  it('más de 100 caracteres: aviso sin enviar; un 400 del backend no continúa', async () => {
    const update = vi.fn().mockResolvedValue({ kind: 'invalid' });
    const onDone = vi.fn();
    render(<NameGate clients={{ fetch: vi.fn().mockResolvedValue({ kind: 'error' }), update }} onDone={onDone} />);
    fill('Nombre', 'a'.repeat(101));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    expect(await screen.findByText('Escribe como máximo 100 caracteres.')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    // 100 emojis son 100 puntos de código: pasan
    fill('Nombre', '😀'.repeat(100));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    expect(await screen.findByText('Revisa los datos: cada campo admite de 1 a 100 caracteres.')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('sin escribir nada, "Guardar y continuar" pide el nombre y no envía (como el boceto)', async () => {
    const update = vi.fn();
    const onDone = vi.fn();
    render(<NameGate clients={{ fetch: vi.fn().mockResolvedValue({ kind: 'error' }), update }} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
    expect(await screen.findByText('Escribe al menos tu nombre, o elige "Más tarde".')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('"Más tarde" continúa sin enviar nada', () => {
    const update = vi.fn();
    const onDone = vi.fn();
    render(<NameGate clients={{ fetch: vi.fn().mockResolvedValue({ kind: 'error' }), update }} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Más tarde' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('Plataforma: "Reactivar una cuenta" (U-7)', () => {
  const me = vi.fn().mockResolvedValue({ kind: 'ok', principal: { accountId: 'acc-p', roles: [], platformAuthority: 'ADMINISTRATOR' } });
  const props = {
    meClient: me as any,
    queueClient: vi.fn().mockResolvedValue({ kind: 'ok', items: [] }) as any,
    adminsClient: vi.fn().mockResolvedValue({ kind: 'ok', items: [] }) as any,
  };
  const submit = async (id: string) => {
    const form = await screen.findByTestId('reactivate-form');
    fireEvent.change(within(form).getByLabelText(/Cuenta \(identificador\)/), { target: { value: id } });
    fireEvent.click(within(form).getByRole('button', { name: 'Reactivar' }));
  };

  it('200 → "Cuenta activa"; nunca "No existe esa cuenta"', async () => {
    const client = vi.fn().mockResolvedValue({ kind: 'ok' });
    render(<PlatformScreen {...props} reactivateClient={client} />);
    await submit(' acc-1 ');
    expect(await screen.findByText('Cuenta activa')).toBeInTheDocument();
    expect(screen.queryByText('No existe esa cuenta.')).toBeNull();
    expect(client).toHaveBeenCalledWith('acc-1');
  });

  it('404 → "No existe esa cuenta"; nunca "Cuenta activa"', async () => {
    render(<PlatformScreen {...props} reactivateClient={vi.fn().mockResolvedValue({ kind: 'not-found' })} />);
    await submit('nope');
    expect(await screen.findByText('No existe esa cuenta.')).toBeInTheDocument();
    expect(screen.queryByText('Cuenta activa')).toBeNull();
  });

  it('vacío: no se envía', async () => {
    const client = vi.fn();
    render(<PlatformScreen {...props} reactivateClient={client} />);
    await submit('  ');
    expect(await screen.findByText('Este campo es obligatorio.')).toBeInTheDocument();
    expect(client).not.toHaveBeenCalled();
  });
});
