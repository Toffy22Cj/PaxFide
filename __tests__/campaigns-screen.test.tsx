import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});
const ADMIN = { kind: 'ok' as const, principal: { accountId: 'acc-admin', organizationId: 'org 1', roles: ['ADMINISTRATOR' as const] } };

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/panel/campaigns', 'action:create-campaign', 'action:assign-employee', '/c/:publicCode']));
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
    render(<CampaignsScreen meClient={async () => ADMIN} />);
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
    expect(screen.getByTestId('session-campaign')).toHaveTextContent('camp-1');
    // El responsable se elige entre las creadas
    expect(screen.getByLabelText('Convocatoria')).toHaveValue('camp-1');
  });

  it('409 OrganizationNotVerified y 403 → rechazo con su texto, sin reintento', async () => {
    const { CampaignsScreen } = await load();
    fetchMock.mockResolvedValueOnce(res(409, { title: 'OrganizationNotVerified' }));
    render(<CampaignsScreen meClient={async () => ADMIN} />);
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
    render(<CampaignsScreen meClient={async () => ADMIN} />);
    await screen.findByRole('button', { name: 'Crear convocatoria' });
    fillCampaign();
    fireEvent.click(await screen.findByText('Reintentar'));
    expect(await screen.findByText('Convocatoria creada')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][1].headers['Command-Id']).toBe(fetchMock.mock.calls[0][1].headers['Command-Id']);
  });

  it('asignar responsable: cuerpo {employeeRef}; 409 InvalidResponsibleRecipient; éxito', async () => {
    const { CampaignsScreen } = await load();
    render(<CampaignsScreen meClient={async () => ADMIN} />);
    await screen.findByText('Asignar responsable');
    fireEvent.change(screen.getByLabelText('Referencia de la convocatoria'), { target: { value: 'camp-x' } });
    fireEvent.change(screen.getByLabelText('Cuenta del responsable'), { target: { value: 'acc-otro' } });
    fetchMock.mockResolvedValueOnce(res(409, { title: 'InvalidResponsibleRecipient' }));
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }));
    expect(await screen.findByText('Esa cuenta no puede ser responsable de esta convocatoria.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/campaigns/camp-x/employees');
    expect(JSON.parse(init.body)).toEqual({ employeeRef: 'acc-otro' });
    fetchMock.mockResolvedValueOnce(res(201, { assignmentId: 'as-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Asignar' }));
    expect(await screen.findByText('Responsable asignado.')).toBeInTheDocument();
  });

  it('401 al crear → T-1 (sesión cerrada) y las creadas en sesión se descartan', async () => {
    const { CampaignsScreen, session } = await load();
    const store = await import('../src/lib/campaigns/sessionCampaigns');
    store.addSessionCampaign({ campaignRef: 'c0', publicCode: 'p0', title: 'Anterior' });
    fetchMock.mockResolvedValueOnce(res(401, { title: 'Unauthorized' }));
    render(<CampaignsScreen meClient={async () => ADMIN} />);
    await screen.findByRole('button', { name: 'Crear convocatoria' });
    fillCampaign();
    await waitFor(() => expect(session.getState()).toBe('LOGGED_OUT'));
    expect(store.getSessionCampaigns()).toEqual([]);
  });
});
