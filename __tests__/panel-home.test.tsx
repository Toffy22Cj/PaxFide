import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isClosingSoon,
  computeTotalClearedByCurrency,
  countDispatcheableAssets,
} from '../src/screens/PanelHomeScreen';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

async function load(surfaces: string[]) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(surfaces));
  return import('../src/screens/PanelHomeScreen');
}

const ALL = [
  '/panel',
  '/panel/campaigns',
  '/panel/funds',
  '/panel/assets',
  '/account/donations',
  'action:register-asset',
];

describe('PanelHome (§5.6, D-N1-1)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('cargando mientras /me está en curso', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={() => new Promise(() => {})} />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('ADMINISTRATOR: "Convocatorias de mi organización" y "Mis donaciones"', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['ADMINISTRATOR'] } })} />);
    expect(await screen.findByText('Convocatorias de mi organización')).toHaveAttribute('href', '/panel/campaigns');
    expect(screen.getByText('Mis donaciones')).toHaveAttribute('href', '/account/donations');
  });

  it('EMPLOYEE no ve la entrada de convocatorias (representa, no autoriza)', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['EMPLOYEE'] } })} />);
    await screen.findByText('Mis donaciones');
    expect(screen.queryByText('Convocatorias de mi organización')).toBeNull();
  });

  it('vacío: sin entradas aplicables → EmptyState con el texto aprobado', async () => {
    const { PanelHomeScreen } = await load(['/panel']);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', roles: [] } })} />);
    expect(await screen.findByText('No hay opciones disponibles para tu cuenta en este panel.')).toBeInTheDocument();
  });

  it('una superficie deshabilitada no aparece aunque el rol la permita', async () => {
    const { PanelHomeScreen } = await load(['/panel']);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['ADMINISTRATOR'] } })} />);
    await screen.findByTestId('empty-state');
    expect(screen.queryByText('Convocatorias de mi organización')).toBeNull();
  });

  it('error → ErrorState con Reintentar, que vuelve a pedir /me', async () => {
    const { PanelHomeScreen } = await load(ALL);
    const client = vi.fn().mockResolvedValueOnce({ kind: 'error' })
      .mockResolvedValueOnce({ kind: 'ok', principal: { accountId: 'a', roles: [] } });
    render(<PanelHomeScreen meClient={client} />);
    fireEvent.click(await screen.findByText('Reintentar'));
    await screen.findByText('Mis donaciones');
    expect(client).toHaveBeenCalledTimes(2);
  });

  it('/me no disponible (404) → aviso "No disponible" y solo entradas sin roles', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'unavailable' })} />);
    expect(await screen.findByTestId('unavailable-state')).toBeInTheDocument();
    expect(screen.getByText('Mis donaciones')).toBeInTheDocument();
    expect(screen.queryByText('Convocatorias de mi organización')).toBeNull();
  });

  it('401: no pinta nada propio (T-1 lo resuelve el guard)', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'unauthorized' })} />);
    await Promise.resolve();
    expect(screen.queryByText('Mis donaciones')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Panel v2 (VS-6, B-2): lógica pura y utilidades', () => {
  const NOW = 1761234567000; // Fecha base fija para tests deterministas

  describe('isClosingSoon (D-P9: límite de 7 días calculado en cliente)', () => {
    it('dentro del límite (6 días) → true', () => {
      const endDate = new Date(NOW + 6 * 24 * 60 * 60 * 1000).toISOString();
      expect(isClosingSoon({ status: 'OPEN', endDate }, NOW)).toBe(true);
    });

    it('en el límite exacto (7 días) → true', () => {
      const endDate = new Date(NOW + 7 * 24 * 60 * 60 * 1000).toISOString();
      expect(isClosingSoon({ status: 'OPEN', endDate }, NOW)).toBe(true);
    });

    it('apenas fuera del límite (7 días + 1 minuto) → false', () => {
      const endDate = new Date(NOW + 7 * 24 * 60 * 60 * 1000 + 60000).toISOString();
      expect(isClosingSoon({ status: 'OPEN', endDate }, NOW)).toBe(false);
    });

    it('fuera del límite (8 días) → false', () => {
      const endDate = new Date(NOW + 8 * 24 * 60 * 60 * 1000).toISOString();
      expect(isClosingSoon({ status: 'OPEN', endDate }, NOW)).toBe(false);
    });

    it('fecha pasada (en el pasado) → false', () => {
      const endDate = new Date(NOW - 1000).toISOString();
      expect(isClosingSoon({ status: 'OPEN', endDate }, NOW)).toBe(false);
    });

    it('convocatoria CLOSED aunque esté en fecha próxima → false', () => {
      const endDate = new Date(NOW + 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(isClosingSoon({ status: 'CLOSED', endDate }, NOW)).toBe(false);
    });

    it('sin endDate → false', () => {
      expect(isClosingSoon({ status: 'OPEN', endDate: undefined }, NOW)).toBe(false);
    });
  });

  describe('computeTotalClearedByCurrency (cuentas con 0 y con varias monedas)', () => {
    it('sin fondos → 0 COP', () => {
      const res = computeTotalClearedByCurrency([]);
      expect(res).toEqual([{ currency: 'COP', formatted: '0 COP' }]);
    });

    it('varios fondos con la misma moneda → suma acumulada', () => {
      const funds = [
        { fundId: 'f1', currency: 'COP', clearedAmount: '100000000', availableAmount: '0', allocations: [] },
        { fundId: 'f2', currency: 'COP', clearedAmount: '250000000', availableAmount: '0', allocations: [] },
      ];
      const res = computeTotalClearedByCurrency(funds);
      expect(res).toHaveLength(1);
      expect(res[0].currency).toBe('COP');
      expect(res[0].formatted).toBe('3.500.000 COP');
    });

    it('fondos con varias monedas (COP y USD) → agrupa y formatea cada una', () => {
      const funds = [
        { fundId: 'f1', currency: 'COP', clearedAmount: '100000000', availableAmount: '0', allocations: [] },
        { fundId: 'f2', currency: 'USD', clearedAmount: '50000', availableAmount: '0', allocations: [] },
      ];
      const res = computeTotalClearedByCurrency(funds);
      expect(res).toHaveLength(2);
      expect(res.map((r) => r.formatted)).toEqual(['1.000.000 COP', '500 USD']);
    });
  });

  describe('countDispatcheableAssets', () => {
    it('cuenta solo REGISTERED y RECEIVED; omite DISPATCHED y DELIVERED', () => {
      const assets = [
        { assetRef: 'a1', lifecycleStatus: 'REGISTERED' },
        { assetRef: 'a2', lifecycleStatus: 'RECEIVED' },
        { assetRef: 'a3', lifecycleStatus: 'DISPATCHED' },
        { assetRef: 'a4', lifecycleStatus: 'DELIVERED' },
      ];
      expect(countDispatcheableAssets(assets as any)).toBe(2);
    });
  });
});

describe('Panel v2 (VS-6, B-2): vistas por rol y comportamiento de componentes', () => {
  afterEach(() => vi.unstubAllEnvs());

  const NOW = 1761234567000;

  const mockOrg = {
    organizationId: 'org-1',
    name: 'Fundación Manos Unidas',
    type: 'FOUNDATION',
    verificationStatus: 'VERIFIED',
    logoUrl: 'https://cdn.example.test/logo.png',
  };

  const mockCampaigns = [
    {
      campaignRef: 'c-1',
      publicCode: 'cp-1',
      title: 'Kits escolares Urgentes',
      status: 'OPEN',
      endDate: new Date(NOW + 4 * 24 * 60 * 60 * 1000).toISOString(),
      assignedEmployeeCount: 0, // sin empleado
      clearedAmount: '120000000',
      targetAmount: '300000000',
      currency: 'COP',
      responsibles: [],
    },
    {
      campaignRef: 'c-2',
      publicCode: 'cp-2',
      title: 'Agua potable en la Guajira',
      status: 'OPEN',
      endDate: new Date(NOW + 20 * 24 * 60 * 60 * 1000).toISOString(),
      assignedEmployeeCount: 1,
      clearedAmount: '50000000',
      targetAmount: '100000000',
      currency: 'COP',
      responsibles: [],
    },
  ];

  const mockFunds = [
    {
      fundId: 'f-1',
      currency: 'COP',
      clearedAmount: '170000000',
      availableAmount: '80000000', // pendiente de aplicar
      campaignRef: 'c-1',
      allocations: [],
    },
  ];

  const mockAssets = [
    {
      assetRef: 'AS-0142',
      lifecycleStatus: 'RECEIVED',
      assetType: 'Kits de higiene', // G-4b con assetType
      quantity: '60',
      unitOfMeasure: 'kit',
      currentLocation: 'Riohacha',
    },
    {
      assetRef: 'AS-0140',
      lifecycleStatus: 'DISPATCHED',
      assetType: undefined, // G-4b sin assetType
      quantity: '40',
      unitOfMeasure: 'und',
      currentLocation: 'Bodega Central', // no debe mostrarse: en DISPATCHED debe ser '—'
    },
  ];

  it('ADMINISTRATOR: ve cabecera con nombre y logo, los 3 KPIs, pendientes, tabla de convocatorias y tabla de lotes', async () => {
    const { PanelHomeScreen } = await load(ALL);
    const orgClient = vi.fn().mockResolvedValue({ kind: 'ok', organization: mockOrg });
    const campaignsClient = vi.fn().mockResolvedValue({ kind: 'ok', items: mockCampaigns });
    const fundsClient = vi.fn().mockResolvedValue({ kind: 'ok', items: mockFunds });
    const assetsClient = vi.fn().mockResolvedValue({ kind: 'ok', items: mockAssets });

    render(
      <PanelHomeScreen
        meClient={async () => ({ kind: 'ok', principal: { accountId: 'acc-admin', organizationId: 'org-1', roles: ['ADMINISTRATOR'] } })}
        orgClient={orgClient}
        campaignsClient={campaignsClient}
        fundsClient={fundsClient}
        assetsClient={assetsClient}
        ambiguousCommands={[{ id: 'cmd-amb-1', title: 'No pudimos confirmar la operación', detail: 'Revísalo antes de repetirla.', createdAt: NOW }]}
        now={NOW}
      />
    );

    // Cabecera con nombre de la organización y logo
    expect(await screen.findByText('Fundación Manos Unidas')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fundación Manos Unidas' })).toHaveAttribute('src', 'https://cdn.example.test/logo.png');

    // 3 KPIs
    expect(await screen.findByTestId('kpi-open-campaigns')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-cleared-amount')).toHaveTextContent('1.700.000 COP');
    expect(screen.getByTestId('kpi-assets-dispatch')).toHaveTextContent('1'); // AS-0142 es RECEIVED, AS-0140 es DISPATCHED

    // Pendientes (Por hacer)
    // 1. Comando ambiguo en amarillo con icono y texto
    const ambTodo = await screen.findByTestId('ambiguous-todo');
    expect(ambTodo).toHaveTextContent('No pudimos confirmar la operación');
    expect(ambTodo).toHaveTextContent('Revísalo antes de repetirla.');
    expect(ambTodo.className).toContain('todoAmbiguous');
    expect(ambTodo.className).not.toContain('danger');

    // 2. Convocatoria sin empleado
    expect(screen.getByTestId('unassigned-campaign-todo')).toHaveTextContent('Asignar responsable a «Kits escolares Urgentes»');

    // 3. Fondos con availableAmount > 0
    expect(screen.getByTestId('available-fund-todo')).toHaveTextContent('800.000 COP por aplicar');

    // Tabla de convocatorias: "Cierra pronto" en la que cierra en 4 días, pero no en la que cierra en 20 días
    expect(screen.getByTestId('panel-campaigns-table')).toBeInTheDocument();
    const rows = screen.getAllByTestId('panel-campaign-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Kits escolares Urgentes');
    expect(rows[0]).toHaveTextContent('Cierra pronto');
    expect(rows[1]).toHaveTextContent('Agua potable en la Guajira');
    expect(rows[1]).not.toHaveTextContent('Cierra pronto');

    // Tabla de lotes con G-4b assetType y currentLocation ausente en DISPATCHED
    expect(screen.getByTestId('panel-assets-table')).toBeInTheDocument();
    const assetTypes = screen.getAllByTestId('asset-type');
    expect(assetTypes[0]).toHaveTextContent('Kits de higiene');
    expect(assetTypes[1]).toHaveTextContent('—'); // sin assetType

    const locations = screen.getAllByTestId('asset-location');
    expect(locations[0]).toHaveTextContent('Riohacha');
    expect(locations[1]).toHaveTextContent('—'); // en DISPATCHED siempre '—'

    expect(orgClient).toHaveBeenCalledTimes(1);
    expect(campaignsClient).toHaveBeenCalledTimes(1);
    expect(fundsClient).toHaveBeenCalledTimes(1);
    expect(assetsClient).toHaveBeenCalledTimes(1);
  });

  it('EMPLOYEE: no pide org ni convocatorias; no ve tabla de convocatorias ni KPI de convocatorias; ve lotes y Registrar activo', async () => {
    const { PanelHomeScreen } = await load(ALL);
    const orgClient = vi.fn();
    const campaignsClient = vi.fn();
    const fundsClient = vi.fn().mockResolvedValue({ kind: 'ok', items: mockFunds });
    const assetsClient = vi.fn().mockResolvedValue({ kind: 'ok', items: mockAssets });

    render(
      <PanelHomeScreen
        meClient={async () => ({ kind: 'ok', principal: { accountId: 'acc-emp', organizationId: 'org-1', roles: ['EMPLOYEE'] } })}
        orgClient={orgClient}
        campaignsClient={campaignsClient}
        fundsClient={fundsClient}
        assetsClient={assetsClient}
        now={NOW}
      />
    );

    // Título estándar "Tu organización" (D-P8), pero sin pedir GET /organizations/{id}
    expect(await screen.findByTestId('panel-title')).toHaveTextContent('Tu organización');
    expect(orgClient).not.toHaveBeenCalled();
    expect(campaignsClient).not.toHaveBeenCalled();

    // Aserciones negativas de convocatorias para EMPLOYEE
    expect(screen.queryByTestId('kpi-open-campaigns')).toBeNull();
    expect(screen.queryByTestId('panel-campaigns-table')).toBeNull();

    // Sí ve KPIs autorizados (recaudado y lotes por despachar) y tabla de lotes
    expect(await screen.findByTestId('kpi-cleared-amount')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-assets-dispatch')).toBeInTheDocument();
    expect(await screen.findByTestId('panel-assets-table')).toBeInTheDocument();

    // Ve botón "Registrar activo"
    expect(screen.getByRole('button', { name: 'Registrar activo' })).toBeInTheDocument();
  });

  it('REPRESENTATIVE: pide org (nombre/logo); aserciones negativas: no pide ni muestra convocatorias, fondos, activos ni KPIs', async () => {
    const { PanelHomeScreen } = await load(ALL);
    const orgClient = vi.fn().mockResolvedValue({ kind: 'ok', organization: { ...mockOrg, logoUrl: undefined } });
    const campaignsClient = vi.fn();
    const fundsClient = vi.fn();
    const assetsClient = vi.fn();

    render(
      <PanelHomeScreen
        meClient={async () => ({ kind: 'ok', principal: { accountId: 'acc-rep', organizationId: 'org-1', roles: ['REPRESENTATIVE'] } })}
        orgClient={orgClient}
        campaignsClient={campaignsClient}
        fundsClient={fundsClient}
        assetsClient={assetsClient}
        now={NOW}
      />
    );

    // Representante sí ve el nombre de la organización
    expect(await screen.findByText('Fundación Manos Unidas')).toBeInTheDocument();
    expect(screen.getByTestId('org-initial')).toHaveTextContent('F'); // Inicial de la organización (DF7-22)
    expect(orgClient).toHaveBeenCalledTimes(1);

    // Aserciones negativas: REPRESENTATIVE no puede leer campañas, fondos ni activos
    expect(campaignsClient).not.toHaveBeenCalled();
    expect(fundsClient).not.toHaveBeenCalled();
    expect(assetsClient).not.toHaveBeenCalled();

    // Ninguno de los 3 KPIs aparece
    expect(screen.queryByTestId('kpi-open-campaigns')).toBeNull();
    expect(screen.queryByTestId('kpi-cleared-amount')).toBeNull();
    expect(screen.queryByTestId('kpi-assets-dispatch')).toBeNull();

    // Ninguna de las tablas aparece
    expect(screen.queryByTestId('panel-campaigns-table')).toBeNull();
    expect(screen.queryByTestId('panel-assets-table')).toBeNull();

    // Tampoco ve el botón de registrar activo
    expect(screen.queryByRole('button', { name: 'Registrar activo' })).toBeNull();
  });
});
