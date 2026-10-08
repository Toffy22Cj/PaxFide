import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});
const PLATFORM = async () => ({ kind: 'ok' as const, principal: { accountId: 'acc-p', roles: [] as any, platformAuthority: 'ADMINISTRATOR' } });
// Datos de PRUEBA de los tests (no son del backend)
const ORG_A = { organizationId: 'org-a', name: 'Fundación Uno', type: 'FOUNDATION', verificationStatus: 'PENDING_VERIFICATION' };
const ORG_B = { organizationId: 'org-b', type: 'COMPANY', verificationStatus: 'NEEDS_MORE_INFORMATION', informationRequest: 'Falta el RUT.' };
const ADMINS = async () => ({ kind: 'ok' as const, items: [{ accountId: 'acc-p', status: 'ACTIVE' }, { accountId: 'acc-q', status: 'ACTIVE' }] });

const S = ['/panel/platform', '/panel/organization', 'action:platform-verify', 'action:platform-reject',
  'action:platform-request-information', 'action:platform-grant-admin', 'action:platform-revoke-admin', 'action:create-organization'];

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(S));
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  const session = await import('../src/lib/auth/session');
  session.login('jwt-test');
  return {
    ...(await import('../src/screens/PlatformScreen')),
    ...(await import('../src/screens/OrganizationScreen')),
    ...(await import('../src/screens/PanelHomeScreen')),
    ...(await import('../src/lib/api/organization')),
  };
}

const fetchMock = vi.fn();
beforeEach(() => { global.fetch = fetchMock as any; fetchMock.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe('/panel/platform — cola de verificación', () => {
  it('cliente: filtro y cursor en la query; 403', async () => {
    const m = await load();
    fetchMock.mockResolvedValueOnce(res(200, { items: [ORG_A], nextCursor: 'c2' }));
    expect(await m.fetchVerificationQueue({ status: 'PENDING_VERIFICATION', cursor: 'c1' })).toEqual({ kind: 'ok', items: [ORG_A], nextCursor: 'c2' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.paxfide.test/api/v1/platform/organizations?status=PENDING_VERIFICATION&cursor=c1');
    fetchMock.mockResolvedValueOnce(res(403, { title: 'Forbidden' }));
    expect(await m.fetchVerificationQueue()).toEqual({ kind: 'forbidden' });
  });

  it('sin autoridad de plataforma: nada', async () => {
    const { PlatformScreen } = await load();
    const queue = vi.fn();
    render(<PlatformScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['ADMINISTRATOR'] } })}
      queueClient={queue} adminsClient={ADMINS} />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(queue).not.toHaveBeenCalled();
  });

  it('cargando / vacía / error / 403', async () => {
    const { PlatformScreen } = await load();
    const r1 = render(<PlatformScreen meClient={PLATFORM} queueClient={() => new Promise(() => {})} adminsClient={ADMINS} />);
    await waitFor(() => expect(screen.getAllByText('Cargando…').length).toBeGreaterThan(0));
    r1.unmount();
    const r2 = render(<PlatformScreen meClient={PLATFORM} queueClient={async () => ({ kind: 'ok', items: [] })} adminsClient={ADMINS} />);
    expect(await screen.findByText('No hay organizaciones pendientes.')).toBeInTheDocument();
    r2.unmount();
    const r3 = render(<PlatformScreen meClient={PLATFORM} queueClient={async () => ({ kind: 'error' })} adminsClient={ADMINS} />);
    expect(await screen.findByText('Reintentar')).toBeInTheDocument();
    r3.unmount();
    render(<PlatformScreen meClient={PLATFORM} queueClient={async () => ({ kind: 'forbidden' })} adminsClient={ADMINS} />);
    expect(await screen.findByText('No tienes acceso a este recurso.')).toBeInTheDocument();
  });

  it('lista con nombre, tipo, estado e información pedida; "Cargar más" añade la página siguiente; el filtro pide de nuevo', async () => {
    const { PlatformScreen } = await load();
    const queue = vi.fn()
      .mockResolvedValueOnce({ kind: 'ok', items: [ORG_A], nextCursor: 'c2' })
      .mockResolvedValueOnce({ kind: 'ok', items: [ORG_B] })
      .mockResolvedValueOnce({ kind: 'ok', items: [ORG_B] });
    render(<PlatformScreen meClient={PLATFORM} queueClient={queue} adminsClient={ADMINS} />);
    expect(await screen.findByText('Fundación Uno')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(screen.getAllByTestId('queue-item')).toHaveLength(2));
    expect(queue).toHaveBeenLastCalledWith({ status: undefined, cursor: 'c2' });
    const b = screen.getAllByTestId('queue-item')[1];
    expect(b).toHaveTextContent('Organización sin nombre');
    expect(b).toHaveTextContent('Empresa');
    expect(b).toHaveTextContent('Se pidió más información');
    expect(b).toHaveTextContent('Falta el RUT.');
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'NEEDS_MORE_INFORMATION' } });
    await waitFor(() => expect(queue).toHaveBeenLastCalledWith({ status: 'NEEDS_MORE_INFORMATION', cursor: undefined }));
    // Ningún campo para escribir identificadores
    expect(screen.queryByLabelText('Identificador de la organización')).toBeNull();
  });

  it('verificar desde la fila: confirmación, POST sin cuerpo, resultado y la cola se relee', async () => {
    const { PlatformScreen } = await load();
    const queue = vi.fn().mockResolvedValue({ kind: 'ok', items: [ORG_A] });
    render(<PlatformScreen meClient={PLATFORM} queueClient={queue} adminsClient={ADMINS} />);
    const row = await screen.findByTestId('queue-item');
    fireEvent.click(within(row).getByRole('button', { name: 'Verificar' }));
    expect(screen.getByText(/Verificar o rechazar es definitivo/)).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(res(200, { organizationId: 'org-a', verificationStatus: 'VERIFIED' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Verificar organización' }));
    expect(await screen.findByText('Decisión registrada')).toBeInTheDocument();
    expect(screen.getByText('Fundación Uno: Verificada.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/platform/organizations/org-a/verify');
    expect(init.body).toBeUndefined();
    expect(queue).toHaveBeenCalledTimes(2);
  });

  it('pedir información: mensaje obligatorio y en el cuerpo; 409 con su texto', async () => {
    const { PlatformScreen } = await load();
    render(<PlatformScreen meClient={PLATFORM} queueClient={async () => ({ kind: 'ok', items: [ORG_A] })} adminsClient={ADMINS} />);
    fireEvent.click(within(await screen.findByTestId('queue-item')).getByRole('button', { name: 'Pedir más información' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pedir más información' }));
    expect(within(dialog).getByText('Este campo es obligatorio.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Mensaje para la organización'), { target: { value: 'Falta el RUT.' } });
    fetchMock.mockResolvedValueOnce(res(409, { title: 'InvalidVerificationTransition' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Pedir más información' }));
    expect(await within(dialog).findByText('La organización no está en un estado que permita esta operación.')).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ message: 'Falta el RUT.' });
  });
});

describe('/panel/platform — administradores', () => {
  it('lista (con "tú"), añadir por cuenta y retirar; 409 con su texto', async () => {
    const { PlatformScreen } = await load();
    const admins = vi.fn().mockImplementation(ADMINS);
    render(<PlatformScreen meClient={PLATFORM} queueClient={async () => ({ kind: 'ok', items: [] })} adminsClient={admins} />);
    const rows = await screen.findAllByTestId('platform-admin');
    expect(rows[0]).toHaveTextContent('acc-p (tú)');
    fireEvent.click(screen.getByRole('button', { name: 'Añadir administrador' }));
    let dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Cuenta (identificador)'), { target: { value: 'acc-q' } });
    fetchMock.mockResolvedValueOnce(res(409, { title: 'PlatformAuthorityAlreadyGranted' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Añadir administrador' }));
    expect(await within(dialog).findByText('Esa cuenta ya es administradora de la plataforma.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.paxfide.test/api/v1/platform/administrators');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ accountId: 'acc-q' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Retirar' }));
    dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('eres tú');
    fetchMock.mockResolvedValueOnce(res(409, { title: 'LastPlatformAdministrator' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirar' }));
    expect(await within(dialog).findByText('Es el último administrador de la plataforma: no se puede retirar.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.paxfide.test/api/v1/platform/administrators/acc-p/revoke');
    expect(fetchMock.mock.calls[1][1].body).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('/panel/organization — crear organización', () => {
  it('sin organización: crea con {type, name}; muestra "Pendiente de verificación" y relee /me', async () => {
    const { OrganizationScreen } = await load();
    const me = vi.fn()
      .mockResolvedValueOnce({ kind: 'ok', principal: { accountId: 'a', roles: [] } })
      .mockResolvedValueOnce({ kind: 'ok', principal: { accountId: 'a', organizationId: 'org-new', roles: ['REPRESENTATIVE'] } });
    render(<OrganizationScreen meClient={me} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Crear organización' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear organización' }));
    expect(within(dialog).getAllByText('Este campo es obligatorio.')).toHaveLength(2);
    fireEvent.change(within(dialog).getByLabelText('Tipo'), { target: { value: 'FOUNDATION' } });
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Fundación Nueva' } });
    fetchMock.mockResolvedValueOnce(res(201, { organizationId: 'org-new', verificationStatus: 'PENDING_VERIFICATION' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear organización' }));
    expect(await screen.findByText('Organización creada')).toBeInTheDocument();
    expect(screen.getByTestId('organization-status')).toHaveTextContent('Pendiente de verificación');
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.paxfide.test/api/v1/organizations');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ type: 'FOUNDATION', name: 'Fundación Nueva' });
    expect(await screen.findByTestId('organization-roles')).toHaveTextContent('Representante');
    expect(me).toHaveBeenCalledTimes(2);
  });

  it('409 AccountAlreadyBelongsToOrganization con su texto', async () => {
    const { OrganizationScreen } = await load();
    render(<OrganizationScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', roles: [] } })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Crear organización' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Tipo'), { target: { value: 'COMPANY' } });
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Empresa' } });
    fetchMock.mockResolvedValueOnce(res(409, { title: 'AccountAlreadyBelongsToOrganization' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear organización' }));
    expect(await within(dialog).findByText('Tu cuenta ya pertenece a una organización.')).toBeInTheDocument();
  });

  it('con organización: papeles y estado de verificación "No disponible" (sin lectura)', async () => {
    const { OrganizationScreen } = await load();
    render(<OrganizationScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['ADMINISTRATOR', 'EMPLOYEE'] } })} />);
    expect(await screen.findByTestId('organization-roles')).toHaveTextContent('Administrador, Empleado');
    expect(screen.getByTestId('unavailable-state')).toHaveTextContent('El estado de verificación de tu organización');
    expect(screen.queryByRole('button', { name: 'Crear organización' })).toBeNull();
  });

  it('entrada del panel: "Crear organización" sin organización, "Mi organización" con ella', async () => {
    const { panelEntries } = await load();
    expect(panelEntries({ accountId: 'a', roles: [] }).find((e) => e.id === 'organization')?.label).toBe('Crear organización');
    expect(panelEntries({ accountId: 'a', organizationId: 'o', roles: ['EMPLOYEE'] }).find((e) => e.id === 'organization')?.label).toBe('Mi organización');
    expect(panelEntries(null).find((e) => e.id === 'organization')).toBeUndefined();
  });
});
