import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});
const me = (roles: string[], extra: Record<string, unknown> = {}) => async () =>
  ({ kind: 'ok' as const, principal: { accountId: 'acc-1', organizationId: 'org-1', roles: roles as any, ...extra } });
// Datos de PRUEBA de los tests (no son del backend)
const FUND = {
  fundId: 'fund-1', campaignRef: 'camp-1', currency: 'COP', clearedAmount: '6000000', availableAmount: '5000000',
  allocations: [{ allocationId: 'alloc-1', amount: '1000000', status: 'REQUESTED' }],
};

async function load(surfaces: string[]) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(surfaces));
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  const session = await import('../src/lib/auth/session');
  session.login('jwt-test');
  return {
    ...(await import('../src/screens/FundsScreen')),
    ...(await import('../src/screens/OrgAssetsScreen')),
    ...(await import('../src/screens/PlatformScreen')),
    ...(await import('../src/components/asset/RegisterAssetForm')),
    ...(await import('../src/lib/routing/classifier')),
    ...(await import('../src/screens/PanelHomeScreen')),
  };
}

const fetchMock = vi.fn();
beforeEach(() => { global.fetch = fetchMock as any; fetchMock.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe('Rutas y entradas de P2-C', () => {
  it('rutas solo con la lista; /panel/platform/<x> no existe nunca', async () => {
    const m = await load(['/panel/funds', '/panel/assets', '/panel/platform']);
    expect(m.classifyRoute('/panel/funds')).toBe('AUTHENTICATED');
    expect(m.classifyRoute('/panel/assets')).toBe('AUTHENTICATED');
    expect(m.classifyRoute('/panel/platform')).toBe('AUTHENTICATED');
    expect(m.classifyRoute('/panel/platform/organizations')).toBe('NOT_APPROVED');
    const off = await load([]);
    expect(off.classifyRoute('/panel/funds')).toBe('NOT_APPROVED');
    expect(off.classifyRoute('/panel/platform')).toBe('NOT_APPROVED');
  });

  it('entradas del panel según papel y autoridad de plataforma (representación)', async () => {
    const m = await load(['/panel/funds', '/panel/assets', '/panel/platform']);
    const ids = (p: any) => m.panelEntries(p).map((e) => e.id);
    expect(ids({ accountId: 'a', organizationId: 'o', roles: ['EMPLOYEE'] })).toEqual(['funds', 'assets']);
    expect(ids({ accountId: 'a', organizationId: 'o', roles: ['REPRESENTATIVE'] })).toEqual([]);
    expect(ids({ accountId: 'a', roles: [], platformAuthority: 'PLATFORM_ADMIN' })).toEqual(['platform']);
  });
});

describe('/panel/funds', () => {
  const S = ['/panel/funds', 'action:request-allocation', 'action:confirm-allocation'];

  it('cargando / vacío / error / 403 / sin papel', async () => {
    const { FundsScreen } = await load(S);
    const r1 = render(<FundsScreen meClient={me(['ADMINISTRATOR'])} fundsClient={() => new Promise(() => {})} />);
    await waitFor(() => expect(screen.getByText('Cargando…')).toBeInTheDocument());
    r1.unmount();
    const r2 = render(<FundsScreen meClient={me(['EMPLOYEE'])} fundsClient={async () => ({ kind: 'ok', items: [] })} />);
    expect(await screen.findByText('Tu organización todavía no tiene fondos.')).toBeInTheDocument();
    r2.unmount();
    const r3 = render(<FundsScreen meClient={me(['ADMINISTRATOR'])} fundsClient={async () => ({ kind: 'error' })} />);
    expect(await screen.findByText('Reintentar')).toBeInTheDocument();
    r3.unmount();
    const r4 = render(<FundsScreen meClient={me(['ADMINISTRATOR'])} fundsClient={async () => ({ kind: 'forbidden' })} />);
    expect(await screen.findByText('No tienes acceso a este recurso.')).toBeInTheDocument();
    r4.unmount();
    const client = vi.fn();
    render(<FundsScreen meClient={me(['REPRESENTATIVE'])} fundsClient={client} />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(client).not.toHaveBeenCalled();
  });

  it('un EMPLOYEE ve los fondos sin acciones; importes en unidades mínimas formateados', async () => {
    const { FundsScreen } = await load(S);
    render(<FundsScreen meClient={me(['EMPLOYEE'])} fundsClient={async () => ({ kind: 'ok', items: [FUND] })} />);
    const fund = await screen.findByTestId('fund');
    expect(within(fund).getByTestId('fund-available')).toHaveTextContent('50.000 COP');
    expect(within(fund).getByTestId('allocation')).toHaveTextContent('alloc-1 · 10.000 COP · Solicitada');
    expect(within(fund).queryByRole('button')).toBeNull();
  });

  it('ADMINISTRATOR: solicitar asignación (importe a unidades mínimas, Command-Id); 409 con su texto', async () => {
    const { FundsScreen } = await load(S);
    const funds = vi.fn().mockResolvedValue({ kind: 'ok', items: [FUND] });
    render(<FundsScreen meClient={me(['ADMINISTRATOR'])} fundsClient={funds} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Solicitar asignación' }));
    fireEvent.change(screen.getByLabelText('Importe (COP)'), { target: { value: '20000' } });
    fetchMock.mockResolvedValueOnce(res(409, { title: 'InsufficientFunds' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Solicitar asignación' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/funds/fund-1/allocations');
    expect(JSON.parse(init.body)).toEqual({ amount: '2000000' });
    expect(init.headers['Command-Id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(res(201, { allocationId: 'alloc-2', status: 'REQUESTED' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Solicitar asignación' }));
    expect(await screen.findByText('Asignación solicitada.')).toBeInTheDocument();
    expect(funds).toHaveBeenCalledTimes(2);
  });

  it('ADMINISTRATOR: confirmar una asignación REQUESTED (sin cuerpo)', async () => {
    const { FundsScreen } = await load(S);
    render(<FundsScreen meClient={me(['ADMINISTRATOR'])} fundsClient={async () => ({ kind: 'ok', items: [FUND] })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar asignación' }));
    fetchMock.mockResolvedValueOnce(res(200, { allocationId: 'alloc-1', status: 'CONFIRMED' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar asignación' }));
    expect(await screen.findByText('Asignación confirmada.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/funds/fund-1/allocations/alloc-1/confirm');
    expect(init.body).toBeUndefined();
  });
});

describe('/panel/assets', () => {
  it('estados y listado con enlace a cada activo', async () => {
    const { OrgAssetsScreen } = await load(['/panel/assets', '/assets/:assetRef']);
    const r1 = render(<OrgAssetsScreen meClient={me(['EMPLOYEE'])} assetsClient={async () => ({ kind: 'ok', items: [] })} />);
    expect(await screen.findByText('Tu organización todavía no tiene activos registrados.')).toBeInTheDocument();
    r1.unmount();
    const r2 = render(<OrgAssetsScreen meClient={me(['EMPLOYEE'])} assetsClient={async () => ({ kind: 'forbidden' })} />);
    expect(await screen.findByText('No tienes acceso a este recurso.')).toBeInTheDocument();
    r2.unmount();
    render(<OrgAssetsScreen meClient={me(['ADMINISTRATOR'])} assetsClient={async () => ({ kind: 'ok', items: [
      { assetRef: 'asset-1', lifecycleStatus: 'RECEIVED', quantity: '6.0000', unitOfMeasure: 'UNITS', currentLocation: 'centro-1', currentCustodianRef: 'recibe-1' },
    ] })} />);
    const row = await screen.findByTestId('org-asset');
    expect(row).toHaveTextContent('Recibido');
    expect(row).toHaveTextContent('6 UNITS');
    expect(within(row).getByRole('link')).toHaveAttribute('href', '/assets/asset-1');
  });
});

describe('Registrar activo — camino A con fondos leídos', () => {
  it('elige fondo y asignación de la lectura; envía sus ids', async () => {
    const { RegisterAssetForm } = await load(['action:register-asset']);
    const onRegistered = vi.fn();
    render(<RegisterAssetForm organizationId="org-1" onRegistered={onRegistered} onCancel={() => {}}
      fundsClient={async () => ({ kind: 'ok', items: [FUND] })} />);
    fireEvent.click(screen.getByLabelText('Compra con fondos de una donación'));
    fireEvent.change(await screen.findByLabelText('Fondo'), { target: { value: 'fund-1' } });
    fireEvent.change(screen.getByLabelText('Asignación de fondos'), { target: { value: 'alloc-1' } });
    for (const [l, v] of [['Tipo de bien', 'BLANKET'], ['Cantidad', '10'], ['Unidad de medida', 'UNITS'], ['Custodio (referencia)', 'b-1'], ['Ubicación actual', 'b-1']]) {
      fireEvent.change(screen.getByLabelText(l), { target: { value: v } });
    }
    fetchMock.mockResolvedValueOnce(res(201, { assetRef: 'asset-9', status: 'REGISTERED' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith('asset-9'));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ fundId: 'fund-1', allocationId: 'alloc-1', quantity: '10' });
  });

  it('si la lectura de fondos falla, los campos pasan a texto', async () => {
    const { RegisterAssetForm } = await load(['action:register-asset']);
    render(<RegisterAssetForm organizationId="org-1" onRegistered={() => {}} onCancel={() => {}}
      fundsClient={async () => ({ kind: 'forbidden' })} />);
    fireEvent.click(screen.getByLabelText('Compra con fondos de una donación'));
    expect(await screen.findByLabelText('Fondo (referencia)')).toBeInTheDocument();
    expect(screen.getByLabelText('Asignación de fondos (referencia)')).toBeInTheDocument();
  });
});
