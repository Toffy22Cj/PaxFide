// Ref: plan-fase7-puesta-al-dia.md P-3 (tests); plan-fase7-fidelidad.md F-C3; referencia-api-v1.md §3 (G-6, G-7, G-8, G-9).
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ACTIVITY_TYPES, monthIn, parseActivity, type ActivityItem, type MonthlyCleared } from '../src/lib/api/panelData';
import { activityText } from '../src/lib/labels';
import { daysSince, integritySummary, monthlySummary } from '../src/components/panel/PanelTimeData';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

async function load(surfaces: string[]) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(surfaces));
  return import('../src/screens/PanelHomeScreen');
}
afterEach(() => vi.unstubAllEnvs());

// 2026-10-15 12:00 en Bogotá (UTC-5)
const NOW = Date.parse('2026-10-15T17:00:00Z');
const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const MONTHLY: MonthlyCleared = {
  timezone: 'America/Bogota', truncated: false,
  items: [
    ...months.map((m, i) => ({ month: m, currency: 'COP', clearedAmount: i === 5 ? '425000000' : i === 2 ? '100000000' : '0' })),
    ...months.map((m, i) => ({ month: m, currency: 'USD', clearedAmount: i === 5 ? '5000' : '0' })),
  ],
};

describe('Recaudado en el mes (G-6)', () => {
  it('el mes actual en la zona del backend: a las 23:30 de Bogotá del 31 ya es el mes de Bogotá, no el de UTC', () => {
    expect(monthIn('America/Bogota', Date.parse('2026-11-01T04:30:00Z'))).toBe('2026-10');
    expect(monthIn('UTC', Date.parse('2026-11-01T04:30:00Z'))).toBe('2026-11');
  });
  it('meses en 0 se conservan en la serie; dos monedas, una fila cada una', () => {
    const r = monthlySummary(MONTHLY, NOW);
    expect(r.current).toBe('2026-10');
    expect(r.rows.map((x) => [x.currency, x.amount])).toEqual([['COP', '425000000'], ['USD', '5000']]);
    expect(r.rows[0].series.map((x) => x.amount)).toEqual(['0', '0', '100000000', '0', '0', '425000000']);
  });
  it('sin fila del mes actual: 0, nunca otro mes', () => {
    const r = monthlySummary({ ...MONTHLY, items: MONTHLY.items.filter((i) => i.month !== '2026-10') }, NOW);
    expect(r.rows[0].amount).toBe('0');
  });
});

describe('Integridad (G-7)', () => {
  const base = { unanchoredEvents: 0, inPendingBatches: 0, underReviewEvents: 0, truncated: false };
  it('"Al día", "N pasos esperan anclaje" y "N en revisión" (la revisión manda)', () => {
    expect(integritySummary(base)).toMatchObject({ tone: 'ok', value: 'Al día' });
    expect(integritySummary({ ...base, unanchoredEvents: 1, inPendingBatches: 1 })).toMatchObject({ tone: 'pending', sub: '2 pasos esperan anclaje' });
    expect(integritySummary({ ...base, unanchoredEvents: 3, underReviewEvents: 1 })).toMatchObject({ tone: 'review', value: 'En revisión', sub: '1 paso en revisión' });
  });
});

describe('Actividad (G-8)', () => {
  const item = (type: ActivityItem['type'], extra: Partial<ActivityItem> = {}): ActivityItem => ({ type, occurredAt: '2026-10-14T10:00:00Z', ...extra });
  it('cada tipo tiene su texto; sin actor, importes ni destinatarios', () => {
    const texts = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, activityText(item(t, { quantity: '40', unitOfMeasure: 'kit', locationZone: 'Riohacha', eventCount: 14 }))]));
    expect(texts).toEqual({
      ASSET_REGISTERED: 'Lote registrado · 40 kit en Riohacha',
      ASSET_DISPATCHED: 'Lote despachado',
      ASSET_RECEIVED: 'Lote recibido en Riohacha',
      ASSET_DELIVERED: 'Lote entregado en Riohacha',
      ASSET_SPLIT: 'Lote dividido: 40 kit pasan a un sublote',
      FUNDS_CLEARED: 'Donación confirmada',
      CAMPAIGN_CLOSED: 'Convocatoria cerrada',
      BATCH_ANCHORED: 'Anclados en blockchain: 14 pasos',
    });
    expect(activityText(item('BATCH_ANCHORED', { eventCount: 1 }))).toBe('Anclados en blockchain: 1 paso');
  });
  it('parseo: un tipo desconocido no se muestra; BATCH_ANCHORED nunca lleva sujeto', () => {
    const p = parseActivity({ items: [
      { type: 'ASSET_TELEPORTED', occurredAt: '2026-10-14T10:00:00Z' },
      { type: 'BATCH_ANCHORED', occurredAt: '2026-10-14T10:00:00Z', eventCount: 3, subject: { kind: 'ASSET', ref: 'x' } },
      { type: 'ASSET_RECEIVED', occurredAt: '2026-10-13T10:00:00Z', subject: { kind: 'ASSET', ref: 'A-1' }, donorRef: 'no' },
    ], nextCursor: 'c2', truncated: true })!;
    expect(p.items.map((i) => i.type)).toEqual(['BATCH_ANCHORED', 'ASSET_RECEIVED']);
    expect(p.items[0].subject).toBeUndefined();
    expect(p.items[1]).not.toHaveProperty('donorRef');
    expect(p).toMatchObject({ nextCursor: 'c2', truncated: true });
  });
});

describe('Último cambio (G-9)', () => {
  it('sin lastEventAt → null (nunca "hace 0 días")', () => {
    expect(daysSince(undefined, NOW)).toBeNull();
    expect(daysSince('no-es-fecha', NOW)).toBeNull();
    expect(daysSince('2026-10-11T16:00:00Z', NOW)).toBe(4);
  });
});

const ALL = ['/panel', '/panel/campaigns', '/panel/funds', '/panel/assets', '/assets/:assetRef', 'action:register-asset'];
const me = (roles: string[]) => async () => ({ kind: 'ok' as const, principal: { accountId: 'a', organizationId: 'org-1', roles } });
const page = (n: number, next?: string, truncated = false) => ({ kind: 'ok' as const, data: {
  items: Array.from({ length: n }, (_, i) => ({ type: 'ASSET_RECEIVED' as const, occurredAt: '2026-10-14T10:00:00Z', subject: { kind: 'ASSET' as const, ref: `A-${i}` } })),
  nextCursor: next, truncated } });

function clients(over: Record<string, unknown> = {}) {
  return {
    orgClient: async () => ({ kind: 'ok', organization: { organizationId: 'org-1', name: 'Fundación Demo', verificationStatus: 'VERIFIED' } }) as any,
    campaignsClient: async () => ({ kind: 'ok', items: [] }) as any,
    fundsClient: async () => ({ kind: 'ok', items: [] }) as any,
    assetsClient: async () => ({ kind: 'ok', items: [
      { assetRef: 'L-1', lifecycleStatus: 'REGISTERED', lastEventAt: '2026-10-10T10:00:00Z' },
      { assetRef: 'L-2', lifecycleStatus: 'RECEIVED' },
      { assetRef: 'L-3', lifecycleStatus: 'REGISTERED', lastEventAt: '2026-10-14T10:00:00Z' },
    ] }) as any,
    monthlyClient: vi.fn(async () => ({ kind: 'ok', data: MONTHLY })),
    integrityClient: vi.fn(async () => ({ kind: 'ok', data: { unanchoredEvents: 2, inPendingBatches: 0, underReviewEvents: 0, truncated: true, lastAnchoredAt: '2026-10-08T10:00:00Z' } })),
    activityClient: vi.fn(async (_o: string, c?: string) => (c ? page(3) : page(20, 'cursor-2', true))),
    ambiguousCommands: [],
    now: NOW,
    ...over,
  };
}

describe('Panel (F-C3)', () => {
  it('administrador: "Recaudado en octubre" con mini serie, integridad con aviso, "Ver más" y lotes parados en "Por hacer"', async () => {
    const { PanelHomeScreen } = await load(ALL);
    const c = clients();
    render(<PanelHomeScreen meClient={me(['ADMINISTRATOR'])} {...(c as any)} />);
    const kpi = await screen.findByTestId('kpi-monthly');
    expect(kpi).toHaveTextContent('Recaudado en octubre');
    expect(within(kpi).getByTestId('kpi-monthly-value')).toHaveTextContent(/4\.250\.000 COP · 50 USD/);
    expect(within(kpi).getAllByTestId('kpi-sparkline')).toHaveLength(2);
    expect(screen.queryByTestId('kpi-cleared-amount')).toBeNull();
    const integ = await screen.findByTestId('kpi-integrity');
    expect(integ).toHaveAttribute('data-tone', 'pending');
    expect(integ).toHaveTextContent('2 pasos esperan anclaje');
    expect(within(integ).getByTestId('kpi-integrity-truncated')).toBeInTheDocument();
    expect(c.integrityClient).toHaveBeenCalledWith('org-1');
    // Lotes por despachar: L-1 (5 días) cuenta; L-2 sin fecha no; L-3 (1 día) no
    expect(await screen.findByTestId('stale-assets-todo')).toHaveTextContent('Despachar 1 lote');
    expect(screen.getByTestId('kpi-assets-dispatch')).toHaveTextContent('1 desde hace más de 3 días');
    // Actividad: 20, aviso de truncado, "Ver más" pide la página siguiente con el cursor
    await waitFor(() => expect(screen.getAllByTestId('activity-item')).toHaveLength(20));
    expect(screen.getByTestId('activity-truncated')).toHaveTextContent('Se muestra la actividad de los 10 000 fondos y lotes más recientes');
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    await waitFor(() => expect(screen.getAllByTestId('activity-item')).toHaveLength(23));
    expect(c.activityClient).toHaveBeenLastCalledWith('org-1', 'cursor-2');
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
    expect(screen.getAllByTestId('activity-item')[0].querySelector('a')).toHaveAttribute('href', '/assets/A-0');
  });

  it('empleado: no pide la integridad (negativa) y sí ve la actividad y el recaudado', async () => {
    const { PanelHomeScreen } = await load(ALL);
    const c = clients();
    render(<PanelHomeScreen meClient={me(['EMPLOYEE'])} {...(c as any)} />);
    await screen.findByTestId('kpi-monthly');
    await screen.findAllByTestId('activity-item');
    expect(c.integrityClient).not.toHaveBeenCalled();
    expect(screen.queryByTestId('kpi-integrity')).toBeNull();
  });

  it('representante: integridad y actividad, sin pedir el recaudado (no es de su papel)', async () => {
    const { PanelHomeScreen } = await load(ALL);
    const c = clients();
    render(<PanelHomeScreen meClient={me(['REPRESENTATIVE'])} {...(c as any)} />);
    await screen.findByTestId('kpi-integrity');
    await screen.findAllByTestId('activity-item');
    expect(c.monthlyClient).not.toHaveBeenCalled();
  });

  it('en revisión: amarillo con icono, nunca "Al día"', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={me(['ADMINISTRATOR'])} {...(clients({ integrityClient: async () => ({ kind: 'ok', data: { unanchoredEvents: 0, inPendingBatches: 0, underReviewEvents: 2, truncated: false } }) }) as any)} />);
    const integ = await screen.findByTestId('kpi-integrity');
    expect(integ).toHaveAttribute('data-tone', 'review');
    expect(integ).toHaveTextContent('En revisión');
    expect(integ.querySelector('svg')).not.toBeNull();
    expect(integ).not.toHaveTextContent('Al día');
  });

  it('si el recaudado mensual falla, queda el "Recaudado total" de siempre', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={me(['ADMINISTRATOR'])} {...(clients({ monthlyClient: async () => ({ kind: 'error' }) }) as any)} />);
    expect(await screen.findByTestId('kpi-cleared-amount')).toHaveTextContent('Recaudado total');
    expect(screen.queryByTestId('kpi-monthly')).toBeNull();
  });
});
