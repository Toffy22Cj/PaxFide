import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});
// Datos de PRUEBA de los tests (no son del backend)
const CAMP = { campaignRef: 'camp-1', publicCode: 'PC1', title: 'Agua', status: 'OPEN', currency: 'COP', targetAmount: '100000000',
  targetPolicy: 'FLEXIBLE', responsibles: [], assignedEmployeeCount: 0 };
const INKIND = { ...CAMP, campaignRef: 'camp-2', publicCode: 'PC2', title: 'Ropa', currency: undefined, targetAmount: undefined, targetPolicy: undefined };
const PUB = { title: 'Agua', status: 'OPEN', startDate: '2026-10-01T00:00:00Z', endDate: '2026-12-01T00:00:00Z',
  acceptedDonationTypes: ['MONETARY', 'IN_KIND'], acceptedPaymentMethods: ['GATEWAY'], currency: 'COP', targetAmount: '100000000' };
const PUB_INKIND = { ...PUB, title: 'Ropa', acceptedDonationTypes: ['IN_KIND'], acceptedPaymentMethods: [], currency: undefined, targetAmount: undefined };
const ADMIN = async () => ({ kind: 'ok' as const, principal: { accountId: 'acc-admin', organizationId: 'org-1', roles: ['ADMINISTRATOR' as const] } });
const REQ = (over: Record<string, unknown> = {}) => ({
  requestId: 'req-1', status: 'PENDING', baseConfigurationVersion: 2, requestedBy: 'acc-other', requestedAt: '2026-10-08T01:00:00Z',
  proposedConfiguration: { acceptedDonationTypes: ['MONETARY'], acceptedPaymentMethods: ['GATEWAY', 'BANK_TRANSFER'], currency: 'COP', targetAmount: '100000000', targetPolicy: 'FLEXIBLE' },
  ...over,
});

const S = ['/panel/configuration', 'action:configuration-edit', 'action:configuration-request', 'action:configuration-approve', 'action:configuration-reject'];

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(S));
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  const session = await import('../src/lib/auth/session');
  session.login('jwt-test');
  return { ...(await import('../src/screens/ConfigurationScreen')), ...(await import('../src/lib/api/configuration')) };
}

const fetchMock = vi.fn();
beforeEach(() => { global.fetch = fetchMock as any; fetchMock.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

function screenWith(m: any, opts: { requests?: any; pub?: any; list?: any; me?: any } = {}) {
  return render(<m.ConfigurationScreen meClient={opts.me ?? ADMIN}
    listClient={opts.list ?? (async () => ({ kind: 'ok', items: [CAMP, INKIND] }))}
    requestsClient={opts.requests ?? (async () => ({ kind: 'ok', items: [] }))}
    publicClient={opts.pub ?? (async (code: string) => ({ kind: 'ok', campaign: code === 'PC1' ? PUB : PUB_INKIND }))} />);
}

describe('Configuración — composición y versión (D-10)', () => {
  it('compone la configuración actual con CV-07 y el listado; CLOSE_ON_TARGET con dinero → sin configuración', async () => {
    const m = await load();
    expect(m.currentConfiguration(CAMP as any, PUB as any)).toEqual({
      acceptedDonationTypes: ['IN_KIND', 'MONETARY'], acceptedPaymentMethods: ['GATEWAY'], currency: 'COP', targetAmount: '100000000', targetPolicy: 'FLEXIBLE',
    });
    expect(m.currentConfiguration(INKIND as any, PUB_INKIND as any)).toEqual({ acceptedDonationTypes: ['IN_KIND'], acceptedPaymentMethods: [] });
    expect(m.currentConfiguration({ ...CAMP, targetPolicy: 'CLOSE_ON_TARGET' } as any, PUB as any)).toBeNull();
  });

  it('versión: 1, aprobadas, pendientes y las conocidas en la sesión', async () => {
    const m = await load();
    expect(m.deriveVersion('x', [])).toBe(1);
    expect(m.deriveVersion('x', [REQ({ status: 'APPROVED', resultingConfigurationVersion: 3 }) as any])).toBe(3);
    expect(m.deriveVersion('x', [REQ({ baseConfigurationVersion: 4 }) as any])).toBe(4);
    m.rememberVersion('y', 5);
    expect(m.deriveVersion('y', [REQ({ status: 'APPROVED', resultingConfigurationVersion: 3 }) as any])).toBe(5);
  });
});

describe('/panel/configuration', () => {
  it('sin papel de gestión: nada; listado 403 (representante): escribe la referencia y ve solo las solicitudes', async () => {
    const m = await load();
    const r1 = render(<m.ConfigurationScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'e', organizationId: 'o', roles: ['EMPLOYEE'] } })} />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    r1.unmount();
    const requests = vi.fn().mockResolvedValue({ kind: 'ok', items: [REQ()] });
    screenWith(m, { me: async () => ({ kind: 'ok', principal: { accountId: 'acc-rep', organizationId: 'org-1', roles: ['REPRESENTATIVE'] } }),
      list: async () => ({ kind: 'forbidden' }), requests });
    fireEvent.change(await screen.findByLabelText('Referencia de la convocatoria'), { target: { value: 'camp-9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver configuración' }));
    expect(await screen.findByTestId('change-request')).toHaveTextContent('Pendiente');
    expect(requests).toHaveBeenCalledWith('camp-9');
    expect(screen.queryByText('Configuración actual')).toBeNull();
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
  });

  it('actual y edición directa: cuerpo {expectedConfigurationVersion, configuration} con las condiciones monetarias intactas; 409 con su texto', async () => {
    const m = await load();
    screenWith(m);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver configuración' }));
    expect(await screen.findByTestId('configuration-version')).toHaveTextContent('1');
    expect(screen.getByText('Configuración actual').closest('section')).toHaveTextContent('Especie (bienes), Dinero');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sin aprobación' }));
    expect(screen.getByText('No hay cambios respecto a la configuración actual.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Especie (bienes)'));
    fireEvent.click(screen.getByLabelText('Transferencia bancaria'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sin aprobación' }));
    fetchMock.mockResolvedValueOnce(res(409, { title: 'CampaignAlreadyHasDonations' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }));
    expect(await within(screen.getByRole('dialog')).findByText(/necesita una solicitud con aprobación/)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/campaigns/camp-1/configuration');
    expect(JSON.parse(init.body)).toEqual({ expectedConfigurationVersion: 1, configuration: {
      acceptedDonationTypes: ['MONETARY'], acceptedPaymentMethods: ['BANK_TRANSFER', 'GATEWAY'], currency: 'COP', targetAmount: '100000000', targetPolicy: 'FLEXIBLE',
    } });
    expect(init.headers['Command-Id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('solicitar cambio: añadir dinero a una de especie exige moneda, meta (a unidades mínimas) y política', async () => {
    const m = await load();
    const requests = vi.fn().mockResolvedValue({ kind: 'ok', items: [] });
    screenWith(m, { requests });
    fireEvent.change(await screen.findByLabelText('Convocatoria'), { target: { value: 'camp-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver configuración' }));
    await screen.findByTestId('configuration-version');
    fireEvent.click(screen.getByLabelText('Dinero'));
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar cambio' }));
    expect(screen.getByText('Elige al menos un medio de pago.')).toBeInTheDocument();
    expect(screen.getByText(/Código ISO 4217 de tres letras/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Pasarela de pago'));
    fireEvent.change(screen.getByLabelText('Moneda'), { target: { value: 'cop' } });
    fireEvent.change(screen.getByLabelText('Meta'), { target: { value: '500000' } });
    fireEvent.change(screen.getByLabelText('Política de meta'), { target: { value: 'STRICT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar cambio' }));
    fetchMock.mockResolvedValueOnce(res(201, { requestId: 'req-9', status: 'PENDING', baseConfigurationVersion: 1 }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Solicitar' }));
    expect(await screen.findByText('Solicitud de cambio enviada.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.paxfide.test/api/v1/campaigns/camp-2/configuration-change-requests');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).configuration).toEqual({
      acceptedDonationTypes: ['IN_KIND', 'MONETARY'], acceptedPaymentMethods: ['GATEWAY'], currency: 'COP', targetAmount: '50000000', targetPolicy: 'STRICT',
    });
    expect(requests).toHaveBeenCalledTimes(2);
  });

  it('con una solicitud pendiente no se ofrece otra; aprobar (nunca la propia), 403 SelfApprovalNotAllowed, retirar la propia', async () => {
    const m = await load();
    screenWith(m, { requests: async () => ({ kind: 'ok', items: [REQ(), REQ({ requestId: 'req-2', requestedBy: 'acc-admin' })] }) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ver configuración' }));
    const [other, mine] = await screen.findAllByTestId('change-request');
    expect(screen.getByText(/Hay una solicitud pendiente/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solicitar cambio' })).toBeNull();
    expect(within(mine).queryByRole('button', { name: 'Aprobar' })).toBeNull();
    expect(within(mine).getByRole('button', { name: 'Retirar' })).toBeInTheDocument();
    expect(screen.getByTestId('configuration-version')).toHaveTextContent('2');
    fireEvent.click(within(other).getByRole('button', { name: 'Aprobar' }));
    fetchMock.mockResolvedValueOnce(res(403, { title: 'SelfApprovalNotAllowed' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aprobar' }));
    expect(await within(screen.getByRole('dialog')).findByText(/No puedes aprobar tu propia solicitud/)).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.paxfide.test/api/v1/campaigns/camp-1/configuration-change-requests/req-1/approve');
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(within(mine).getByRole('button', { name: 'Retirar' }));
    fetchMock.mockResolvedValueOnce(res(200, { requestId: 'req-2', status: 'REJECTED' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retirar' }));
    expect(await screen.findByText('Solicitud cerrada sin cambios.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.paxfide.test/api/v1/campaigns/camp-1/configuration-change-requests/req-2/reject');
  });

  it('regresión: tras guardar, la configuración actual se recompone con el listado releído (la política nueva solo la trae él)', async () => {
    const m = await load();
    const list = vi.fn()
      .mockResolvedValueOnce({ kind: 'ok', items: [INKIND] })
      .mockResolvedValueOnce({ kind: 'ok', items: [INKIND] })
      .mockResolvedValue({ kind: 'ok', items: [{ ...INKIND, currency: 'COP', targetAmount: '100000000', targetPolicy: 'FLEXIBLE' }] });
    const pub = vi.fn()
      .mockResolvedValueOnce({ kind: 'ok', campaign: PUB_INKIND })
      .mockResolvedValue({ kind: 'ok', campaign: { ...PUB_INKIND, acceptedDonationTypes: ['IN_KIND', 'MONETARY'], acceptedPaymentMethods: ['GATEWAY'], currency: 'COP', targetAmount: '100000000' } });
    screenWith(m, { list, pub });
    fireEvent.click(await screen.findByRole('button', { name: 'Ver configuración' }));
    await screen.findByTestId('configuration-version');
    fireEvent.click(screen.getByLabelText('Dinero'));
    fireEvent.click(screen.getByLabelText('Pasarela de pago'));
    fireEvent.change(screen.getByLabelText('Moneda'), { target: { value: 'COP' } });
    fireEvent.change(screen.getByLabelText('Meta', { exact: true }), { target: { value: '1000000' } });
    fireEvent.change(screen.getByLabelText('Política de meta'), { target: { value: 'FLEXIBLE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sin aprobación' }));
    fetchMock.mockResolvedValueOnce(res(200, { campaignRef: 'camp-2', configurationVersion: 2 }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Configuración guardada.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('configuration-version')).toHaveTextContent('2'));
    expect(screen.getByText('Configuración actual').closest('section')).toHaveTextContent('Flexible');
    // Un segundo cambio reenvía las condiciones monetarias completas, con la política
    fireEvent.click(screen.getByLabelText('Transferencia bancaria'));
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar cambio' }));
    fetchMock.mockResolvedValueOnce(res(201, { requestId: 'r', status: 'PENDING', baseConfigurationVersion: 2 }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Solicitar' }));
    await screen.findByText('Solicitud de cambio enviada.');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ expectedConfigurationVersion: 2, configuration: {
      acceptedDonationTypes: ['IN_KIND', 'MONETARY'], acceptedPaymentMethods: ['BANK_TRANSFER', 'GATEWAY'], currency: 'COP', targetAmount: '100000000', targetPolicy: 'FLEXIBLE',
    } });
  });

  it('estados: solicitudes 403 / error; configuración no disponible si falla CV-07; CLOSE_ON_TARGET sin edición', async () => {
    const m = await load();
    const r1 = screenWith(m, { requests: async () => ({ kind: 'forbidden' }), pub: async () => ({ kind: 'error' }) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ver configuración' }));
    expect(await screen.findByText('No tienes acceso a este recurso.')).toBeInTheDocument();
    expect(screen.getByTestId('unavailable-state')).toHaveTextContent('La configuración actual de esta convocatoria');
    r1.unmount();
    screenWith(m, { list: async () => ({ kind: 'ok', items: [{ ...CAMP, targetPolicy: 'CLOSE_ON_TARGET' }] }), requests: async () => ({ kind: 'error' }) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ver configuración' }));
    expect(await screen.findByText(/cierra al alcanzar la meta/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solicitar cambio' })).toBeNull();
    expect(screen.getByText('Reintentar')).toBeInTheDocument();
  });
});
