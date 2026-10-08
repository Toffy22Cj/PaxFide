import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});
// Datos de PRUEBA de los tests (no son del backend)
const TOKEN = 'inv-token-de-prueba-123';
const S = ['/invitaciones', '/register', '/panel/members', '/panel/my-campaigns', '/c/:publicCode',
  'action:member-invite', 'action:invitation-revoke', 'action:member-change-role', 'action:member-remove'];

async function load(loggedIn: boolean) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(S));
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  const session = await import('../src/lib/auth/session');
  session._resetForTest();
  if (loggedIn) session.login('jwt-test');
  return {
    session,
    ...(await import('../src/screens/InvitationScreen')),
    ...(await import('../src/screens/MembersScreen')),
    ...(await import('../src/screens/MyCampaignsScreen')),
    ...(await import('../src/lib/invitations/token')),
  };
}

const fetchMock = vi.fn();
beforeEach(() => {
  global.fetch = fetchMock as any; fetchMock.mockReset(); push.mockReset();
  window.history.replaceState(null, '', '/invitaciones');
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('/invitaciones — token del fragmento', () => {
  it('al cargar: lee el token, lo borra de la barra con replaceState y lo guarda solo en memoria', async () => {
    window.history.replaceState(null, '', `/invitaciones#token=${TOKEN}`);
    const m = await load(true);
    const replace = vi.spyOn(window.history, 'replaceState');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<m.InvitationScreen />);
    await screen.findByRole('button', { name: 'Aceptar invitación' });
    expect(replace).toHaveBeenCalledWith(null, '', '/invitaciones');
    expect(window.location.href).not.toContain(TOKEN);
    expect(window.location.hash).toBe('');
    expect(m.getInvitationToken()).toBe(TOKEN);
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain(TOKEN);
    expect(document.body.innerHTML).not.toContain(TOKEN);
  });

  it('con sesión: aceptar envía el token en el cuerpo (nunca en la URL); éxito → papeles y el token se descarta', async () => {
    window.history.replaceState(null, '', `/invitaciones#token=${TOKEN}`);
    const m = await load(true);
    const log = vi.spyOn(console, 'log');
    fetchMock.mockResolvedValueOnce(res(200, { organizationId: 'org-1', roles: ['EMPLOYEE'] }));
    render(<m.InvitationScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar invitación' }));
    expect(await screen.findByText('Invitación aceptada')).toBeInTheDocument();
    expect(screen.getByText(/como empleado/)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/invitations/accept');
    expect(url).not.toContain(TOKEN);
    expect(JSON.parse(init.body)).toEqual({ token: TOKEN });
    expect(init.headers.Authorization).toBe('Bearer jwt-test');
    expect(m.getInvitationToken()).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });

  it('403 InvitationNotAcceptable y 409: su texto y el token se descarta', async () => {
    window.history.replaceState(null, '', `/invitaciones#token=${TOKEN}`);
    const m = await load(true);
    fetchMock.mockResolvedValueOnce(res(403, { title: 'InvitationNotAcceptable' }));
    const r1 = render(<m.InvitationScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar invitación' }));
    expect(await screen.findByText(/no es válida para tu cuenta/)).toBeInTheDocument();
    expect(m.getInvitationToken()).toBeNull();
    r1.unmount();
    window.history.replaceState(null, '', `/invitaciones#token=${TOKEN}`);
    const m2 = await load(true);
    fetchMock.mockResolvedValueOnce(res(409, { title: 'AccountAlreadyBelongsToOrganization' }));
    render(<m2.InvitationScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar invitación' }));
    expect(await screen.findByText(/ya pertenece a una organización/)).toBeInTheDocument();
  });

  it('error de red: se puede reintentar con el mismo token', async () => {
    window.history.replaceState(null, '', `/invitaciones#token=${TOKEN}`);
    const m = await load(true);
    fetchMock.mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(res(200, { organizationId: 'o', roles: ['ADMINISTRATOR'] }));
    render(<m.InvitationScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar invitación' }));
    expect(await screen.findByText('No pudimos aceptar la invitación. Inténtalo de nuevo.')).toBeInTheDocument();
    expect(m.getInvitationToken()).toBe(TOKEN);
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar invitación' }));
    expect(await screen.findByText('Invitación aceptada')).toBeInTheDocument();
  });

  it('sin sesión: pide iniciar sesión o crear cuenta y guarda /invitaciones como destino; no llama al backend', async () => {
    window.history.replaceState(null, '', `/invitaciones#token=${TOKEN}`);
    const m = await load(false);
    render(<m.InvitationScreen />);
    expect(await screen.findByText(/inicia sesión con la cuenta del correo/)).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(push).toHaveBeenCalledWith('/login');
    expect(m.session.consumePostLoginDestination()).toBe('/invitaciones');
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(push).toHaveBeenLastCalledWith('/register');
    expect(fetchMock).not.toHaveBeenCalled();
    // Tras iniciar sesión (navegación de cliente: el módulo sigue vivo), el token sigue en memoria
    act(() => m.session.login('jwt-test'));
    expect(await screen.findByRole('button', { name: 'Aceptar invitación' })).toBeInTheDocument();
  });

  it('cerrar sesión descarta el token; sin token, un aviso', async () => {
    window.history.replaceState(null, '', `/invitaciones#token=${TOKEN}`);
    const m = await load(true);
    render(<m.InvitationScreen />);
    await screen.findByRole('button', { name: 'Aceptar invitación' });
    act(() => m.session.logout());
    expect(m.getInvitationToken()).toBeNull();
    expect(await screen.findByText(/No hay ninguna invitación en esta página/)).toBeInTheDocument();
  });

  it('con la página ya abierta, un enlace nuevo (solo cambia el fragmento) también se lee y se borra', async () => {
    const m = await load(true);
    render(<m.InvitationScreen />);
    expect(await screen.findByText(/No hay ninguna invitación en esta página/)).toBeInTheDocument();
    act(() => {
      window.history.replaceState(null, '', `/invitaciones#token=${TOKEN}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByRole('button', { name: 'Aceptar invitación' })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(m.getInvitationToken()).toBe(TOKEN);
  });

  it('un fragmento sin token también se borra y no guarda nada', async () => {
    window.history.replaceState(null, '', '/invitaciones#otra=cosa');
    const m = await load(true);
    render(<m.InvitationScreen />);
    expect(await screen.findByText(/No hay ninguna invitación en esta página/)).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(m.getInvitationToken()).toBeNull();
  });
});

const ME = (roles: string[], accountId = 'acc-admin') => async () => ({ kind: 'ok' as const, principal: { accountId, organizationId: 'org-1', roles: roles as any } });
const MEMBERS = async () => ({ kind: 'ok' as const, items: [
  { accountId: 'acc-rep', roles: ['REPRESENTATIVE'], status: 'ACTIVE' },
  { accountId: 'acc-admin', roles: ['ADMINISTRATOR', 'EMPLOYEE'], status: 'ACTIVE' },
  { accountId: 'acc-emp', roles: ['EMPLOYEE'], status: 'ACTIVE' },
] });
const INVITATIONS = async () => ({ kind: 'ok' as const, items: [
  { invitationId: 'inv-1', emailMasked: 'a***@demo.test', role: 'EMPLOYEE', expiresAt: '2030-01-01T00:00:00Z', delivery: 'SENT' },
] });

describe('/panel/members', () => {
  it('estados de las dos listas y sin papel de gestión', async () => {
    const m = await load(true);
    const r1 = render(<m.MembersScreen meClient={ME(['ADMINISTRATOR'])} membersClient={async () => ({ kind: 'forbidden' })} invitationsClient={async () => ({ kind: 'ok', items: [] })} />);
    expect(await screen.findByText('No tienes acceso a este recurso.')).toBeInTheDocument();
    expect(screen.getByText('No hay invitaciones pendientes.')).toBeInTheDocument();
    r1.unmount();
    const r2 = render(<m.MembersScreen meClient={ME(['ADMINISTRATOR'])} membersClient={async () => ({ kind: 'error' })} invitationsClient={() => new Promise(() => {})} />);
    expect(await screen.findByText('Reintentar')).toBeInTheDocument();
    r2.unmount();
    const client = vi.fn();
    render(<m.MembersScreen meClient={ME(['EMPLOYEE'])} membersClient={client} invitationsClient={client} />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(client).not.toHaveBeenCalled();
  });

  it('miembros con papeles; el representante (no tú) sin acciones; tú sin "Quitar"; invitación con correo enmascarado', async () => {
    const m = await load(true);
    render(<m.MembersScreen meClient={ME(['ADMINISTRATOR', 'EMPLOYEE'])} membersClient={MEMBERS} invitationsClient={INVITATIONS} />);
    const rows = await screen.findAllByTestId('member');
    expect(rows[0]).toHaveTextContent('acc-rep · Representante · Activa');
    expect(within(rows[0]).queryByRole('button')).toBeNull();
    expect(rows[1]).toHaveTextContent('acc-admin (tú)');
    expect(within(rows[1]).getByRole('button', { name: 'Dejar solo como empleado' })).toBeInTheDocument();
    expect(within(rows[1]).queryByRole('button', { name: 'Quitar de la organización' })).toBeNull();
    expect(within(rows[2]).getByRole('button', { name: 'Hacer administrador' })).toBeInTheDocument();
    const inv = screen.getByTestId('invitation');
    expect(inv).toHaveTextContent('a***@demo.test');
    expect(inv).toHaveTextContent('Empleado');
    expect(inv).toHaveTextContent('Enviado');
  });

  it('invitar: correo validado en local; cuerpo {email, role}; 202 → aviso y se releen las listas', async () => {
    const m = await load(true);
    const invitations = vi.fn().mockImplementation(INVITATIONS);
    render(<m.MembersScreen meClient={ME(['REPRESENTATIVE'], 'acc-rep')} membersClient={MEMBERS} invitationsClient={invitations} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Invitar' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Correo electrónico'), { target: { value: 'no-es-correo' } });
    fireEvent.change(within(dialog).getByLabelText('Papel'), { target: { value: 'ADMINISTRATOR' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar invitación' }));
    expect(within(dialog).getByText('El correo no es válido.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Correo electrónico'), { target: { value: 'nueva@demo.test' } });
    fetchMock.mockResolvedValueOnce(res(202, { invitationId: 'inv-2', role: 'ADMINISTRATOR', expiresAt: '2030-01-01T00:00:00Z' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar invitación' }));
    expect(await screen.findByText('Invitación enviada.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/organizations/org-1/invitations');
    expect(JSON.parse(init.body)).toEqual({ email: 'nueva@demo.test', role: 'ADMINISTRATOR' });
    expect(invitations).toHaveBeenCalledTimes(2);
  });

  it('revocar, hacer administrador y quitar; 409 ActiveCampaignResponsible con su texto', async () => {
    const m = await load(true);
    render(<m.MembersScreen meClient={ME(['ADMINISTRATOR', 'EMPLOYEE'])} membersClient={MEMBERS} invitationsClient={INVITATIONS} />);
    fireEvent.click(await within(await screen.findByTestId('invitation')).findByRole('button', { name: 'Revocar' }));
    fetchMock.mockResolvedValueOnce(res(200, { invitationId: 'inv-1', status: 'REVOKED' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Revocar' }));
    expect(await screen.findByText('Invitación revocada.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.paxfide.test/api/v1/organizations/org-1/invitations/inv-1/revoke');

    const emp = (await screen.findAllByTestId('member'))[2];
    fireEvent.click(within(emp).getByRole('button', { name: 'Hacer administrador' }));
    fetchMock.mockResolvedValueOnce(res(200, { accountId: 'acc-emp', roles: ['ADMINISTRATOR', 'EMPLOYEE'] }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hacer administrador' }));
    expect(await screen.findByText('Papel cambiado.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.paxfide.test/api/v1/organizations/org-1/members/acc-emp/role');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ role: 'ADMINISTRATOR' });

    fireEvent.click(within((await screen.findAllByTestId('member'))[2]).getByRole('button', { name: 'Quitar de la organización' }));
    fetchMock.mockResolvedValueOnce(res(409, { title: 'ActiveCampaignResponsible' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Quitar' }));
    expect(await within(screen.getByRole('dialog')).findByText(/responsable de una convocatoria activa/)).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe('http://api.paxfide.test/api/v1/organizations/org-1/members/acc-emp/remove');
    expect(fetchMock.mock.calls[2][1].body).toBeUndefined();
  });
});

describe('/panel/my-campaigns', () => {
  it('estados y listado con papel y enlace público', async () => {
    const m = await load(true);
    const r1 = render(<m.MyCampaignsScreen client={() => new Promise(() => {})} />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    r1.unmount();
    const r2 = render(<m.MyCampaignsScreen client={async () => ({ kind: 'ok', items: [] })} />);
    expect(await screen.findByText('No eres responsable de ninguna convocatoria.')).toBeInTheDocument();
    r2.unmount();
    const r3 = render(<m.MyCampaignsScreen client={async () => ({ kind: 'error' })} />);
    expect(await screen.findByText('Reintentar')).toBeInTheDocument();
    r3.unmount();
    render(<m.MyCampaignsScreen client={async () => ({ kind: 'ok', items: [
      { campaignRef: 'c1', publicCode: 'PC 1', title: 'Agua', status: 'CLOSED', actingRole: 'EMPLOYEE', assignedAt: '2026-10-01T10:00:00Z' },
    ] })} />);
    const item = await screen.findByTestId('my-campaign');
    expect(item).toHaveTextContent('Agua');
    expect(item).toHaveTextContent('Cerrada');
    expect(item).toHaveTextContent('Empleado');
    expect(within(item).getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/c/PC%201');
  });

  it('cliente: GET /me/campaigns con JWT', async () => {
    const m = await load(true);
    const { fetchMyCampaigns } = await import('../src/lib/api/members');
    fetchMock.mockResolvedValueOnce(res(200, { items: [] }));
    expect(await fetchMyCampaigns()).toEqual({ kind: 'ok', items: [] });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.paxfide.test/api/v1/me/campaigns');
    void m;
  });
});
