import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});
const ADMIN = { kind: 'ok' as const, principal: { accountId: 'acc-admin', organizationId: 'org 1', roles: ['ADMINISTRATOR' as const] } };
// Datos de PRUEBA de los tests (no son del backend)
const CAMP = {
  campaignRef: 'camp-1', publicCode: 'PUB1', title: 'Agua', status: 'OPEN', visibility: 'PUBLIC', currency: 'COP',
  targetAmount: '100000', clearedAmount: '5000', responsibles: [{ accountId: 'acc-emp', actingRole: 'EMPLOYEE' }], assignedEmployeeCount: 1,
};
const MEMBERS = [
  { accountId: 'acc-emp', roles: ['EMPLOYEE'], status: 'ACTIVE' },
  { accountId: 'acc-emp2', roles: ['EMPLOYEE'], status: 'ACTIVE' },
  { accountId: 'acc-admin', roles: ['ADMINISTRATOR', 'EMPLOYEE'], status: 'ACTIVE' },
];
const LIST = vi.fn(async () => ({ kind: 'ok' as const, items: [CAMP] }));
const NO_LIST = async () => ({ kind: 'ok' as const, items: [] });
const MEMBERS_OK = async () => ({ kind: 'ok' as const, items: MEMBERS });

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/panel/campaigns', 'action:create-campaign', 'action:assign-employee', 'action:designate-administrator',
    'action:remove-responsible', 'action:close-campaign', '/c/:publicCode']));
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  const session = await import('../src/lib/auth/session');
  session.login('jwt-admin');
  const mod = await import('../src/screens/CampaignsScreen');
  return { ...mod, session };
}

function fillCampaign() {
  fireEvent.click(screen.getByRole('button', { name: 'Crear convocatoria' }));
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Mercados' } });
  fireEvent.change(screen.getByLabelText(/Visibilidad/), { target: { value: 'PRIVATE_LINK' } });
  fireEvent.change(screen.getByLabelText(/^Inicio/), { target: { value: '2030-01-01T09:00' } });
  fireEvent.change(screen.getByLabelText(/^Fin/), { target: { value: '2030-02-01T09:00' } });
  fireEvent.click(screen.getByLabelText('Especie (bienes)'));
  fireEvent.click(screen.getAllByRole('button', { name: 'Crear convocatoria' }).at(-1)!);
}

describe('/panel/campaigns', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { global.fetch = fetchMock as any; fetchMock.mockReset(); });
  afterEach(() => vi.unstubAllEnvs());

  it('cargando / error / no disponible / sin organización / sin rol de administrador', async () => {
    const { CampaignsScreen } = await load();
    const { unmount } = render(<CampaignsScreen meClient={() => new Promise(() => {})} />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    unmount();
    const r2 = render(<CampaignsScreen meClient={async () => ({ kind: 'error' })} />);
    expect(await screen.findByText('Reintentar')).toBeInTheDocument();
    r2.unmount();
    const r3 = render(<CampaignsScreen meClient={async () => ({ kind: 'unavailable' })} />);
    expect(await screen.findByTestId('unavailable-state')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear convocatoria' })).toBeNull();
    r3.unmount();
    const r4 = render(<CampaignsScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', roles: [] } })} />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    r4.unmount();
    render(<CampaignsScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['EMPLOYEE'] } })} />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('crear: POST con Command-Id al organizationId de /me; luego enlace público y "creadas en esta sesión"', async () => {
    const { CampaignsScreen } = await load();
    fetchMock.mockResolvedValueOnce(res(201, { campaignRef: 'camp-1', publicCode: 'PUB CODE' }));
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={NO_LIST} membersClient={MEMBERS_OK} />);
    await screen.findByRole('button', { name: 'Crear convocatoria' });
    fillCampaign();
    expect(await screen.findByText('Convocatoria creada')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/organizations/org%201/campaigns');
    expect(init.headers['Command-Id']).toMatch(/^[0-9a-f-]{36}$/);
    const body = JSON.parse(init.body);
    expect(body.visibility).toBe('PRIVATE_LINK');
    expect(body.configuration).toEqual({ acceptedDonationTypes: ['IN_KIND'], acceptedPaymentMethods: [] });
    expect(screen.getByTestId('created-public-link')).toHaveAttribute('href', '/c/PUB%20CODE');
  });

  it('409 OrganizationNotVerified y 403 → rechazo con su texto, sin reintento', async () => {
    const { CampaignsScreen } = await load();
    fetchMock.mockResolvedValueOnce(res(409, { title: 'OrganizationNotVerified' }));
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={NO_LIST} membersClient={MEMBERS_OK} />);
    await screen.findByRole('button', { name: 'Crear convocatoria' });
    fillCampaign();
    expect(await screen.findByText(/no está verificada/)).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(res(403, { title: 'Forbidden' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Crear convocatoria' }).at(-1)!);
    expect(await screen.findByText('No tienes acceso a esta operación.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][1].headers['Command-Id']).not.toBe(fetchMock.mock.calls[0][1].headers['Command-Id']);
  });

  it('crear: 5xx → ambiguo; Reintentar con el mismo Command-Id', async () => {
    const { CampaignsScreen } = await load();
    fetchMock.mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(201, { campaignRef: 'c', publicCode: 'p' }));
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={NO_LIST} membersClient={MEMBERS_OK} />);
    await screen.findByRole('button', { name: 'Crear convocatoria' });
    fillCampaign();
    fireEvent.click(await screen.findByText('Reintentar'));
    expect(await screen.findByText('Convocatoria creada')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][1].headers['Command-Id']).toBe(fetchMock.mock.calls[0][1].headers['Command-Id']);
  });

  it('listado: cargando / vacío / error / 403', async () => {
    const { CampaignsScreen } = await load();
    const r1 = render(<CampaignsScreen meClient={async () => ADMIN} listClient={() => new Promise(() => {})} membersClient={MEMBERS_OK} />);
    await screen.findByRole('button', { name: 'Crear convocatoria' });
    expect(await screen.findByText('Cargando…')).toBeInTheDocument();
    r1.unmount();
    const r2 = render(<CampaignsScreen meClient={async () => ADMIN} listClient={NO_LIST} membersClient={MEMBERS_OK} />);
    expect(await screen.findByText('Tu organización todavía no tiene convocatorias.')).toBeInTheDocument();
    r2.unmount();
    const r3 = render(<CampaignsScreen meClient={async () => ADMIN} listClient={async () => ({ kind: 'error' })} membersClient={MEMBERS_OK} />);
    expect(await screen.findByText('Reintentar')).toBeInTheDocument();
    r3.unmount();
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={async () => ({ kind: 'forbidden' })} membersClient={MEMBERS_OK} />);
    expect(await screen.findByText('No tienes acceso a este recurso.')).toBeInTheDocument();
  });

  it('listado real: datos, enlace público, QR y acciones solo si está abierta', async () => {
    const { CampaignsScreen } = await load();
    const closed = { ...CAMP, campaignRef: 'camp-2', title: 'Cerrada', status: 'CLOSED' };
    render(<CampaignsScreen meClient={async () => ADMIN} membersClient={MEMBERS_OK}
      listClient={async () => ({ kind: 'ok', items: [CAMP, closed] })} />);
    const items = await screen.findAllByTestId('org-campaign');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Abierta')).toBeInTheDocument();
    expect(within(items[0]).getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/c/PUB1');
    expect(within(items[0]).getByRole('button', { name: 'Cerrar convocatoria' })).toBeInTheDocument();
    expect(within(items[1]).getByText('Cerrada', { selector: 'dd' })).toBeInTheDocument();
    expect(within(items[1]).queryByRole('button')).toBeNull();
  });

  it('asignar empleado: elige entre miembros con papel de empleado; 409 con su texto; éxito recarga el listado', async () => {
    const { CampaignsScreen } = await load();
    LIST.mockClear();
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={LIST} membersClient={MEMBERS_OK} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Asignar empleado' }));
    const select = screen.getByLabelText('Empleado');
    expect(within(select as HTMLElement).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)).toEqual(['', 'acc-emp', 'acc-emp2', 'acc-admin']);
    fireEvent.change(select, { target: { value: 'acc-emp2' } });
    fetchMock.mockResolvedValueOnce(res(409, { title: 'InvalidResponsibleRecipient' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Asignar empleado' }).at(-1)!);
    expect(await screen.findByText('Esa cuenta no puede ser responsable de esta convocatoria.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/campaigns/camp-1/employees');
    expect(JSON.parse(init.body)).toEqual({ employeeRef: 'acc-emp2' });
    fetchMock.mockResolvedValueOnce(res(201, { assignmentId: 'as-1' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Asignar empleado' }).at(-1)!);
    expect(await screen.findByText('Empleado asignado.')).toBeInTheDocument();
    expect(LIST).toHaveBeenCalledTimes(2);
  });

  it('sin listado de miembros: el campo pasa a texto', async () => {
    const { CampaignsScreen } = await load();
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={LIST} membersClient={async () => ({ kind: 'forbidden' })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Designar administrador' }));
    fireEvent.change(screen.getByLabelText('Administrador'), { target: { value: 'acc-x' } });
    fetchMock.mockResolvedValueOnce(res(201, { assignmentId: 'as-2' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Designar administrador' }).at(-1)!);
    expect(await screen.findByText('Administrador designado.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.paxfide.test/api/v1/campaigns/camp-1/administrators');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ administratorRef: 'acc-x' });
  });

  it('retirar responsable: sin reemplazo no hay cuerpo; reemplazo exige papel; 409 último responsable', async () => {
    const { CampaignsScreen } = await load();
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={LIST} membersClient={MEMBERS_OK} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retirar responsable' }));
    fireEvent.change(screen.getByLabelText('Responsable'), { target: { value: 'acc-emp' } });
    fireEvent.change(screen.getByLabelText('Reemplazo (opcional)'), { target: { value: 'acc-emp2' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Retirar responsable' }).at(-1)!);
    expect(await screen.findByText('Con reemplazo, indica su papel.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Reemplazo (opcional)'), { target: { value: '' } });
    fetchMock.mockResolvedValueOnce(res(409, { title: 'LastResponsibleRemovalWithoutReplacement' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Retirar responsable' }).at(-1)!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/campaigns/camp-1/responsibles/acc-emp/remove');
    expect(init.body).toBeUndefined();
    expect(await screen.findByText('Es el último responsable: indica quién lo sustituye.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Reemplazo (opcional)'), { target: { value: 'acc-emp2' } });
    fireEvent.change(screen.getByLabelText('Papel del reemplazo'), { target: { value: 'EMPLOYEE' } });
    fetchMock.mockResolvedValueOnce(res(200, { removedAssignmentId: 'r1', replacementAssignmentId: 'r2' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Retirar responsable' }).at(-1)!);
    expect(await screen.findByText('Responsable retirado.')).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ replacementRef: 'acc-emp2', replacementActingRole: 'EMPLOYEE' });
  });

  it('cerrar: confirmación, POST sin cuerpo con Command-Id; 409 ya cerrada', async () => {
    const { CampaignsScreen } = await load();
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={LIST} membersClient={MEMBERS_OK} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar convocatoria' }));
    expect(screen.getByText(/Cerrar es definitivo/)).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(res(409, { title: 'CampaignAlreadyClosed' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar convocatoria' }).at(-1)!);
    expect(await screen.findByText('La convocatoria ya está cerrada.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/campaigns/camp-1/close');
    expect(init.body).toBeUndefined();
    expect(init.headers['Command-Id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('401 al crear → T-1 (sesión cerrada)', async () => {
    const { CampaignsScreen, session } = await load();
    fetchMock.mockResolvedValueOnce(res(401, { title: 'Unauthorized' }));
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={NO_LIST} membersClient={MEMBERS_OK} />);
    await screen.findByRole('button', { name: 'Crear convocatoria' });
    fillCampaign();
    await waitFor(() => expect(session.getState()).toBe('LOGGED_OUT'));
  });
});
