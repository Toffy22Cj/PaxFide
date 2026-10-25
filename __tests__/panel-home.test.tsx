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

describe('PanelHome (§5.6, D-N1-1, D-F13)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('cargando mientras /me está en curso', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={() => new Promise(() => {})} />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('panelEntries (D-N1-1): ADMINISTRATOR genera convocatorias; EMPLOYEE no (representa, no autoriza)', async () => {
    const { panelEntries } = await load(ALL);
    const adminEntries = panelEntries({ accountId: 'a', organizationId: 'o', roles: ['ADMINISTRATOR'] });
    expect(adminEntries.some((e) => e.id === 'campaigns' && e.href === '/panel/campaigns')).toBe(true);
    expect(adminEntries.some((e) => e.id === 'donations' && e.href === '/account/donations')).toBe(true);

    const empEntries = panelEntries({ accountId: 'a', organizationId: 'o', roles: ['EMPLOYEE'] });
    expect(empEntries.some((e) => e.id === 'campaigns')).toBe(false);
    expect(empEntries.some((e) => e.id === 'donations')).toBe(true);
  });

  it('vacío: sin entradas aplicables → EmptyState con el texto aprobado', async () => {
    const { PanelHomeScreen } = await load(['/panel']);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', roles: [] } })} />);
    expect(await screen.findByText('No hay opciones disponibles para tu cuenta en este panel.')).toBeInTheDocument();
  });

  it('una superficie deshabilitada no aparece en panelEntries aunque el rol la permita', async () => {
    const { panelEntries } = await load(['/panel']);
    const adminEntries = panelEntries({ accountId: 'a', organizationId: 'o', roles: ['ADMINISTRATOR'] });
    expect(adminEntries.some((e) => e.id === 'campaigns')).toBe(false);
  });

  it('error → ErrorState con Reintentar, que vuelve a pedir /me', async () => {
    const { PanelHomeScreen } = await load(ALL);
    const client = vi.fn().mockResolvedValueOnce({ kind: 'error' })
      .mockResolvedValueOnce({ kind: 'ok', principal: { accountId: 'a', roles: [] } });
    render(<PanelHomeScreen meClient={client} />);
    fireEvent.click(await screen.findByText('Reintentar'));
    expect(await screen.findByText('¿Tienes una fundación?')).toBeInTheDocument();
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

describe('Panel v2 fidelidad (F-B1, D-F12, D-F13): vistas por rol y comportamiento de componentes', () => {
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
      assetType: 'Kits de higiene',
      quantity: '60',
      unitOfMeasure: 'kit',
      currentLocation: 'Riohacha',
    },
    {
      assetRef: 'AS-0140',
      lifecycleStatus: 'DISPATCHED',
      assetType: undefined,
      quantity: '40',
      unitOfMeasure: 'und',
      currentLocation: 'Bodega Central',
    },
  ];

  it('ADMINISTRATOR: ve cabecera con nombre y logo, los 3 KPIs, pendientes en orden de urgencia y aserciones negativas', async () => {
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

    // Cabecera con nombre de la organización, subtítulo con rol y verificación, y logo
    expect(await screen.findByText('Fundación Manos Unidas')).toBeInTheDocument();
    expect(screen.getByText('Organización verificada · Tu rol: Administrador')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fundación Manos Unidas' })).toHaveAttribute('src', 'https://cdn.example.test/logo.png');

    // Botón de acción en la cabecera
    expect(screen.getByTestId('new-campaign-button')).toHaveAttribute('href', '/panel/campaigns');

    // 3 KPIs con valores reales (X-13)
    expect(await screen.findByTestId('kpi-open-campaigns')).toHaveTextContent('2');
    expect(screen.getByTestId('kpi-cleared-amount')).toHaveTextContent('1.700.000 COP');
    expect(screen.getByTestId('kpi-assets-dispatch')).toHaveTextContent('1'); // AS-0142 es RECEIVED, AS-0140 es DISPATCHED

    // Pendientes (Por hacer) ordenados por urgencia: 1) ambiguos, 2) fondos por aplicar, 3) convocatorias sin empleado
    const todoList = screen.getByTestId('panel-todos');
    const todos = todoList.children;
    expect(todos).toHaveLength(3);

    // 1. Comando ambiguo en amarillo con clase todoAmbiguous, icono y acción Revisar
    expect(todos[0]).toHaveAttribute('data-testid', 'ambiguous-todo');
    expect(todos[0]).toHaveTextContent('No pudimos confirmar la operación');
    expect(todos[0]).toHaveTextContent('Revísalo antes de repetirla.');
    expect(todos[0].className).toContain('todoAmbiguous');
    expect(todos[0].className).not.toContain('danger');

    // 2. Fondos con availableAmount > 0
    expect(todos[1]).toHaveAttribute('data-testid', 'available-fund-todo');
    expect(todos[1]).toHaveTextContent('800.000 COP por aplicar');

    // 3. Convocatoria sin empleado
    expect(todos[2]).toHaveAttribute('data-testid', 'unassigned-campaign-todo');
    expect(todos[2]).toHaveTextContent('Asignar responsable a «Kits escolares Urgentes»');

    // Aserciones negativas de fidelidad (D-F12, D-F13):
    // 1. No existe "Secciones del panel"
    expect(screen.queryByText('Secciones del panel')).toBeNull();
    // 2. No existen tablas de convocatorias ni de lotes en /panel (pertenecen a /panel/campaigns y /panel/assets en F-B2)
    expect(screen.queryByTestId('panel-campaigns-table')).toBeNull();
    expect(screen.queryByTestId('panel-assets-table')).toBeNull();
    // 3. "Datos de ejemplo" no aparece
    expect(screen.queryByText(/Datos de ejemplo/i)).toBeNull();

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

    // Título estándar "Tu organización", subtítulo con rol Empleado
    expect(await screen.findByTestId('panel-title')).toHaveTextContent('Tu organización');
    expect(screen.getByText('Organización · Tu rol: Empleado')).toBeInTheDocument();

    // Negativas cruzadas de cliente: EMPLOYEE no puede consultar org ni convocatorias
    expect(orgClient).not.toHaveBeenCalled();
    expect(campaignsClient).not.toHaveBeenCalled();

    // Aserciones negativas visuales
    expect(screen.queryByTestId('kpi-open-campaigns')).toBeNull();
    expect(screen.queryByTestId('panel-campaigns-table')).toBeNull();
    expect(screen.queryByTestId('panel-assets-table')).toBeNull();
    expect(screen.queryByText('Secciones del panel')).toBeNull();

    // Sí ve KPIs autorizados (recaudado y lotes por despachar)
    expect(await screen.findByTestId('kpi-cleared-amount')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-assets-dispatch')).toBeInTheDocument();

    // Ve botón "Registrar activo"
    expect(screen.getByRole('button', { name: 'Registrar activo' })).toBeInTheDocument();
  });

  it('REPRESENTATIVE: pide org (nombre/logo); aserciones negativas: no pide ni muestra convocatorias, fondos, activos ni KPIs; Por hacer vacío', async () => {
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
    expect(screen.getByText('Organización verificada · Tu rol: Representante')).toBeInTheDocument();
    expect(screen.getByTestId('org-initial')).toHaveTextContent('F'); // Inicial de la organización
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

    // Tampoco ve el botón de registrar activo ni "Secciones del panel"
    expect(screen.queryByRole('button', { name: 'Registrar activo' })).toBeNull();
    expect(screen.queryByText('Secciones del panel')).toBeNull();

    // "Por hacer" muestra el texto aprobado de estado vacío (D-F13)
    expect(screen.getByTestId('empty-todos')).toHaveTextContent('No tienes tareas pendientes.');
  });
});
