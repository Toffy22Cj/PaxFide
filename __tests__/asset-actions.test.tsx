import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeQuantity } from '../src/lib/api/assetCommands';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const res = (status: number, body?: unknown, location?: string) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)),
  headers: { get: (k: string) => (k === 'Location' ? location ?? null : null) },
});

const ACTIONS = ['action:split', 'action:dispatch', 'action:receive', 'action:deliver', 'action:register-asset', '/panel'];

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(ACTIONS));
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  const session = await import('../src/lib/auth/session');
  session.login('jwt-empleado');
  return {
    session,
    ...(await import('../src/components/asset/AssetActions')),
    ...(await import('../src/components/asset/SplitProgress')),
    ...(await import('../src/components/asset/RegisterAssetForm')),
    ...(await import('../src/screens/PanelHomeScreen')),
  };
}

describe('Cantidades (RequestFields.QUANTITY)', () => {
  it('admite hasta 4 decimales con punto o coma; rechaza signo, miles, exponente y cero', () => {
    expect(normalizeQuantity('10')).toBe('10');
    expect(normalizeQuantity('2,5')).toBe('2.5');
    expect(normalizeQuantity('0.1234')).toBe('0.1234');
    for (const bad of ['0', '0.00', '-1', '1.000.000', '1e3', '1.23456', 'abc', '']) expect(normalizeQuantity(bad)).toBeNull();
  });
});

describe('Acciones del activo', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { global.fetch = fetchMock as any; fetchMock.mockReset(); push.mockReset(); });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

  it('DELIVERED → sin acciones (solo lectura)', async () => {
    const { AssetActions } = await load();
    render(<AssetActions assetRef="A1" delivered onChanged={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Despachar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dividir activo' })).toBeNull();
  });

  it('una acción no habilitada no se renderiza', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['action:dispatch']));
    const { AssetActions } = await import('../src/components/asset/AssetActions');
    render(<AssetActions assetRef="A1" delivered={false} onChanged={() => {}} />);
    expect(screen.getByRole('button', { name: 'Despachar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dividir activo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Entregar' })).toBeNull();
  });

  it('despachar: modal con su campo, Command-Id, éxito → aviso y relectura', async () => {
    const { AssetActions } = await load();
    const onChanged = vi.fn();
    fetchMock.mockResolvedValueOnce(res(200, { assetRef: 'A 1', status: 'DISPATCHED' }));
    render(<AssetActions assetRef="A 1" delivered={false} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Despachar' }));
    expect(screen.getByRole('dialog', { name: 'Despachar activo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(screen.getByText('Este campo es obligatorio.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Transportista (referencia)'), { target: { value: 'TR-9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('Activo despachado.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/physical-assets/A%201/dispatch');
    expect(JSON.parse(init.body)).toEqual({ carrierRef: 'TR-9' });
    expect(init.headers['Command-Id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('entregar: 409 InvalidAssetTransition → rechazo; Escape cierra el modal', async () => {
    const { AssetActions } = await load();
    fetchMock.mockResolvedValueOnce(res(409, { title: 'InvalidAssetTransition' }));
    render(<AssetActions assetRef="A1" delivered={false} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Entregar' }));
    for (const [label, value] of [['Custodio final (referencia)', 'C'], ['Beneficiario (referencia)', 'B'], ['Lugar de entrega (referencia)', 'L'], ['Evidencia (referencia)', 'E']]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('El activo no está en un estado que permita esta operación.')).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ finalCustodianRef: 'C', beneficiaryRef: 'B', locationRef: 'L', evidenceRef: 'E' });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('recibir: 403 → "No tienes acceso"; 5xx → ambiguo y Reintentar con el mismo Command-Id', async () => {
    const { AssetActions } = await load();
    fetchMock.mockResolvedValueOnce(res(403, { title: 'Forbidden' }));
    render(<AssetActions assetRef="A1" delivered={false} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recibir' }));
    fireEvent.change(screen.getByLabelText('Instalación (ubicación)'), { target: { value: 'Bodega' } });
    fireEvent.change(screen.getByLabelText('Quién recibe (referencia)'), { target: { value: 'R' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('No tienes acceso a esta operación.')).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(res(500)).mockResolvedValueOnce(res(200, { assetRef: 'A1', status: 'RECEIVED' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    fireEvent.click(await screen.findByText('Reintentar'));
    expect(await screen.findByText('Activo recibido.')).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][1].headers['Command-Id']).toBe(fetchMock.mock.calls[1][1].headers['Command-Id']);
    expect(fetchMock.mock.calls[1][1].headers['Command-Id']).not.toBe(fetchMock.mock.calls[0][1].headers['Command-Id']);
  });

  it('dividir: cantidad normalizada; 202 → se consulta el estado hasta que existe el hijo', async () => {
    const { AssetActions } = await load();
    fetchMock
      .mockResolvedValueOnce(res(202, { parentAssetRef: 'P1', childAssetRef: 'C1', status: 'PENDING' }, '/api/v1/physical-assets/P1/splits/C1'))
      .mockResolvedValueOnce(res(200, { status: 'PENDING' }))
      .mockResolvedValueOnce(res(200, { status: 'CHILD_CREATED' }));
    render(<AssetActions assetRef="P1" delivered={false} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dividir activo' }));
    fireEvent.change(screen.getByLabelText('Cantidad a separar'), { target: { value: '2,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('División en curso')).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ quantity: '2.5' });
    expect(await screen.findByText('División completada', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByTestId('split-child-link')).toHaveAttribute('href', '/assets/C1');
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.paxfide.test/api/v1/physical-assets/P1/splits/C1');
    // Solo un POST: la consulta nunca repite el comando
    expect(fetchMock.mock.calls.filter((c) => c[1].method === 'POST')).toHaveLength(1);
  });

  it('SplitProgress: revertida, sin resolver y agotado el sondeo → "Consultar de nuevo"', async () => {
    const { SplitProgress } = await load();
    const r1 = render(<SplitProgress parentAssetRef="P" childAssetRef="C" client={async () => ({ kind: 'ok', status: 'COMPENSATED' })} />);
    expect(await screen.findByText(/se revirtió/)).toBeInTheDocument();
    r1.unmount();
    const r2 = render(<SplitProgress parentAssetRef="P" childAssetRef="C" client={async () => ({ kind: 'ok', status: 'UNRESOLVED' })} />);
    expect(await screen.findByText('La división necesita revisión')).toBeInTheDocument();
    r2.unmount();
    const client = vi.fn().mockResolvedValue({ kind: 'ok', status: 'PENDING' });
    render(<SplitProgress parentAssetRef="P" childAssetRef="C" client={client} intervalMs={1} />);
    expect(await screen.findByText('Consultar de nuevo', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(client).toHaveBeenCalledTimes(20);
  });
});

describe('Registrar activo (PanelHome)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { global.fetch = fetchMock as any; fetchMock.mockReset(); push.mockReset(); });
  afterEach(() => vi.unstubAllEnvs());

  const fill = (pairs: [string, string][]) => pairs.forEach(([l, v]) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } }));
  const COMMON: [string, string][] = [['Tipo de bien', 'Mercado'], ['Cantidad', '10'], ['Unidad de medida', 'kit'], ['Custodio (referencia)', 'CUS'], ['Ubicación actual', 'Bodega']];

  it('solo EMPLOYEE lo ve; nunca un REPRESENTATIVE solo (D-N1-2)', async () => {
    const { PanelHomeScreen } = await load();
    const r = render(<PanelHomeScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['REPRESENTATIVE'] } })} />);
    await screen.findByTestId('empty-state');
    expect(screen.queryByRole('button', { name: 'Registrar activo' })).toBeNull();
    r.unmount();
    render(<PanelHomeScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['EMPLOYEE'] } })} />);
    expect(await screen.findByRole('button', { name: 'Registrar activo' })).toBeInTheDocument();
  });

  it('camino B: /from-donation sin donorRef ni organización; éxito → /assets/{assetRef}', async () => {
    const { RegisterAssetForm } = await load();
    const onRegistered = vi.fn();
    fetchMock.mockResolvedValueOnce(res(201, { assetRef: 'AS-9', status: 'REGISTERED', donationRef: 'd' }));
    render(<RegisterAssetForm onRegistered={onRegistered} onCancel={() => {}} />);
    fill([...COMMON, ['Convocatoria (referencia, opcional)', 'camp-1']]);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith('AS-9'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/physical-assets/from-donation');
    expect(JSON.parse(init.body)).toEqual({ assetType: 'Mercado', quantity: '10', unitOfMeasure: 'kit', custodianRef: 'CUS', currentLocation: 'Bodega', campaignRef: 'camp-1' });
  });

  it('camino A: /register con fundId y allocationId; 409 → rechazo', async () => {
    const { RegisterAssetForm } = await load();
    fetchMock.mockResolvedValueOnce(res(409, { title: 'InsufficientAvailableFunds' }));
    render(<RegisterAssetForm onRegistered={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByLabelText('Compra con fondos de una donación'));
    fill([['Fondo (referencia)', 'fund-1'], ['Asignación de fondos (referencia)', 'al-1'], ...COMMON]);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(await screen.findByText('El fondo no tiene saldo disponible suficiente para esta compra.')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/physical-assets/register');
    expect(JSON.parse(init.body)).toEqual({ fundId: 'fund-1', allocationId: 'al-1', assetType: 'Mercado', quantity: '10', unitOfMeasure: 'kit', custodianRef: 'CUS', currentLocation: 'Bodega' });
  });

  it('401 → T-1', async () => {
    const { RegisterAssetForm, session } = await load();
    fetchMock.mockResolvedValueOnce(res(401, { title: 'Unauthorized' }));
    render(<RegisterAssetForm onRegistered={() => {}} onCancel={() => {}} />);
    fill(COMMON);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(session.getState()).toBe('LOGGED_OUT'));
  });
});
