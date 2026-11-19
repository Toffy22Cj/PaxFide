import React from 'react';
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  ComboBarsLine, Donut, HorizontalBars, KpiTiles, LineChart, Progress, StackedBars, VerticalBars,
} from '../src/components/charts/Charts';
import { ChartPanel } from '../src/components/charts/ChartPanel';
import { chartPreferenceKey, readChartChoice, writeChartChoice } from '../src/components/charts/chartPreference';
import { cumulative, niceMax, stackTotals, type CategoryChartData } from '../src/components/charts/chartData';
import {
  activityByType, activityOverTime, assetsByState, assetsStateByType, fundsStatusData, monthlyCurrencies, monthlyData,
  predictionCutsData,
} from '../src/components/charts/panelSeries';
import {
  ACTIVITY_CHART_LIMIT, ActivityChartsSection, AssetsCharts, FundsCharts, PredictionChartsPanel, canChooseOrgCharts,
  canChoosePredictionCharts,
} from '../src/components/charts/ChartPanels';
import { PredictionScreen, ESTIMATE_LABEL } from '../src/screens/PredictionScreen';
import { parsePrediction, parsePredictionHistory } from '../src/lib/api/prediction';
import type { MonthlyCleared, ActivityItem } from '../src/lib/api/panelData';
import type { Fund, OrgAsset } from '../src/lib/api/organization';
import * as session from '../src/lib/auth/session';

// Datos de PRUEBA tomados de las respuestas reales del escenario `demo-historico` del backend (paso 2,
// evidencia-fase6/paso2-escenario-historico-d4485a6-2026-11-16.md); recortados, nunca inventados para el gráfico.
const MONTHLY: MonthlyCleared = {
  timezone: 'America/Bogota', truncated: false,
  items: [
    { month: '2026-06', currency: 'COP', clearedAmount: '45252525' }, { month: '2026-06', currency: 'USD', clearedAmount: '0' },
    { month: '2026-07', currency: 'COP', clearedAmount: '1007506647' }, { month: '2026-07', currency: 'USD', clearedAmount: '0' },
    { month: '2026-08', currency: 'COP', clearedAmount: '1426730464' }, { month: '2026-08', currency: 'USD', clearedAmount: '0' },
    { month: '2026-09', currency: 'COP', clearedAmount: '2073216754' }, { month: '2026-09', currency: 'USD', clearedAmount: '0' },
    { month: '2026-10', currency: 'COP', clearedAmount: '3751196301' }, { month: '2026-10', currency: 'USD', clearedAmount: '138889' },
    { month: '2026-11', currency: 'COP', clearedAmount: '1651097309' }, { month: '2026-11', currency: 'USD', clearedAmount: '111111' },
  ],
};
const ASSETS: OrgAsset[] = [
  { assetRef: 'a1', lifecycleStatus: 'DELIVERED', assetType: 'SCHOOL_KIT' },
  { assetRef: 'a2', lifecycleStatus: 'DISPATCHED', assetType: 'FOOD_KIT' },
  { assetRef: 'a3', lifecycleStatus: 'RECEIVED', assetType: 'HYGIENE_KIT' },
  { assetRef: 'a4', lifecycleStatus: 'REGISTERED', assetType: 'BLANKET' },
  { assetRef: 'a5', lifecycleStatus: 'REGISTERED', assetType: 'BLANKET' },
  { assetRef: 'a6', lifecycleStatus: 'DELIVERED', assetType: 'BLANKET' },
];
const FUNDS: Fund[] = [
  { fundId: 'f1', currency: 'COP', clearedAmount: '60000000', availableAmount: '10000000', allocations: [{ allocationId: 'x', amount: '50000000', status: 'CONFIRMED' }] },
  { fundId: 'f2', currency: 'USD', clearedAmount: '138889', availableAmount: '138889', allocations: [] },
];
const act = (type: ActivityItem['type'], occurredAt: string): ActivityItem => ({ type, occurredAt });
const ACTIVITY: ActivityItem[] = [
  act('FUNDS_CLEARED', '2026-11-10T15:00:00Z'), act('FUNDS_CLEARED', '2026-11-10T16:00:00Z'),
  act('ASSET_REGISTERED', '2026-11-12T15:00:00Z'), act('ASSET_DELIVERED', '2026-11-14T15:00:00Z'),
];
// Un corte sin cifra (FUTURE_CUT) entre medias: nunca se rellena
const CUTS = parsePredictionHistory({
  kind: 'ESTIMATE', available: true, warnings: [],
  cuts: [
    { t: 0.15, available: true, probabilityReachTarget: 0.12, estimatedFinalPctOfTarget: 0.8, pctRaisedAtCut: 0.1577 },
    { t: 0.25, available: true, probabilityReachTarget: 0.07, estimatedFinalPctOfTarget: 0.82, pctRaisedAtCut: 0.2644 },
    { t: 0.5, available: false, unavailableReason: 'FUTURE_CUT', unavailableText: 'Este corte aún no ha llegado' },
  ],
});
const cuts = CUTS.kind === 'ok' ? CUTS.cuts : [];
const ESTIMATE = parsePrediction({
  kind: 'ESTIMATE', modelVersion: 'test-1', available: true, probabilityReachTarget: 0.069,
  estimatedFinalPctOfTarget: 0.8203, pctTimeElapsed: 0.4, warnings: [],
});
const view = ESTIMATE.kind === 'ok' ? ESTIMATE.view : (undefined as never);

/** Almacenamiento en memoria (como localStorage). */
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    store: () => ({
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v); },
      removeItem: (k: string) => { data.delete(k); },
    }),
  };
}

const EMPTY: CategoryChartData = { categories: [], series: [], format: String, unit: 'x' };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); session._resetForTest(); try { window.localStorage.clear(); } catch { /* sin almacenamiento */ } });

describe('Gráficos (paso 3): datos', () => {
  it('ejes redondos y sumas sin inventar', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(73)).toBe(100);
    expect(niceMax(3_751_196_301)).toBe(5_000_000_000);
    expect(cumulative([null, 2, null, 3])).toEqual([null, 2, 2, 5]);
    expect(stackTotals({ ...EMPTY, categories: ['a', 'b'], series: [{ key: 'x', label: 'x', values: [1, null] }, { key: 'y', label: 'y', values: [2, null] }] }))
      .toEqual([3, null]);
  });

  it('fondos por mes: la moneda con más importe primero; los meses del backend en "0" son 0, no huecos', () => {
    expect(monthlyCurrencies(MONTHLY)).toEqual(['COP', 'USD']);
    const usd = monthlyData(MONTHLY, 'USD');
    expect(usd.categories).toHaveLength(6);
    expect(usd.series[0].values).toEqual([0, 0, 0, 0, 138889, 111111]);
    expect(usd.format(138889)).toBe('1.388,89 USD');
  });

  it('estado del dinero: una barra por moneda en % de lo recibido; nunca se suman monedas', () => {
    const d = fundsStatusData(FUNDS);
    expect(d.categories).toEqual(['COP', 'USD']);
    expect(d.series.map((s) => s.key)).toEqual(['available', 'alloc-CONFIRMED']);
    expect(d.series[0].values).toEqual([(10 / 60) * 100, 100]);
    expect(d.series[1].values).toEqual([(50 / 60) * 100, 0]);
  });

  it('lotes: se cuentan lotes por estado y tipo (las cantidades no se suman)', () => {
    expect(assetsByState(ASSETS).series[0].values).toEqual([2, 1, 1, 2]);
    const st = assetsStateByType(ASSETS);
    expect(st.categories).toEqual(['Registrado', 'Despachado', 'Recibido', 'Entregado']);
    expect(st.series.find((s) => s.key === 'BLANKET')?.values).toEqual([2, 0, 0, 1]);
    expect(assetsStateByType(ASSETS, true).categories).toEqual(['BLANKET', 'FOOD_KIT', 'HYGIENE_KIT', 'SCHOOL_KIT']);
  });

  it('actividad: por tipo y por día (Bogotá); un día sin eventos entre medias cuenta 0', () => {
    expect(activityByType(ACTIVITY).series[0].values).toEqual([1, 1, 2]);
    const daily = activityOverTime(ACTIVITY);
    expect(daily.granularity).toBe('day');
    expect(daily.series[0].values).toEqual([2, 0, 1, 0, 1]);
    const weekly = activityOverTime([act('FUNDS_CLEARED', '2026-06-01T15:00:00Z'), act('FUNDS_CLEARED', '2026-11-01T15:00:00Z')]);
    expect(weekly.granularity).toBe('week');
  });

  it('predicción por corte: un corte sin cifra queda vacío (null), nunca se rellena', () => {
    const d = predictionCutsData(cuts);
    expect(d.series[0].values[2]).toBeNull();
    expect(d.series[1].values[2]).toBeNull();
    expect(d.series[1].nature).toBe('estimate');
  });
});

describe('Gráficos (paso 3): cada tipo con datos y vacío', () => {
  const data = assetsByState(ASSETS);
  const types: [string, (d: CategoryChartData) => React.ReactElement][] = [
    ['vbars', (d) => <VerticalBars data={d} testId="t" />],
    ['hbars', (d) => <HorizontalBars data={d} testId="t" />],
    ['line', (d) => <LineChart data={d} testId="t" />],
    ['area', (d) => <LineChart data={d} testId="t" area />],
    ['donut', (d) => <Donut data={d} testId="t" />],
    ['stacked', (d) => <StackedBars data={d} testId="t" />],
    ['combo', (d) => <ComboBarsLine data={d} testId="t" cumulativeLine />],
  ];
  for (const [name, el] of types) {
    it(`${name}: role="img" con las cifras en aria-label, y la tabla con los mismos datos`, () => {
      render(el(data));
      const svg = screen.getByTestId('t-svg');
      expect(svg).toHaveAttribute('role', 'img');
      expect(svg.getAttribute('aria-label')).toContain('2 lotes');
      const rows = within(screen.getByTestId('t-table')).getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Registrado2 lotes');
    });
    it(`${name}: sin datos, un aviso y ningún dibujo`, () => {
      render(el(EMPTY));
      expect(screen.getByTestId('t-empty')).toHaveTextContent('No hay datos para dibujar');
      expect(screen.queryByTestId('t-svg')).toBeNull();
    });
  }

  // Regresión (2026-11-16): con conteos, las marcas caían en fracciones («1.25 lotes») al redondear el eje a 5
  it('con conteos, las marcas del eje son enteras: nunca «1.25 lotes» ni «2.5 lotes»', () => {
    const { container } = render(<VerticalBars data={data} testId="t" />);
    const axis = [...container.querySelectorAll('text')].map((t) => t.textContent ?? '').filter((t) => /lotes?$/.test(t));
    expect(axis.length).toBeGreaterThan(0);
    for (const label of axis) expect(label).toMatch(/^\d+ lotes?$/);
    cleanup();
    const { container: c2 } = render(<StackedBars data={assetsStateByType(ASSETS)} testId="s" />);
    for (const t of [...c2.querySelectorAll('text')].map((x) => x.textContent ?? '').filter((x) => /lotes?$/.test(x))) {
      expect(t).toMatch(/^\d+ lotes?$/);
    }
  });

  it('KPI y progreso: con datos y vacíos', () => {
    render(<><KpiTiles testId="k" tiles={[{ label: 'Lotes', value: '6' }]} /><Progress testId="p" label="Entregados" part={2} total={6} format={String} /></>);
    expect(screen.getByTestId('k-tile')).toHaveTextContent('Lotes6');
    expect(screen.getByTestId('p-svg').getAttribute('aria-label')).toBe('Entregados: 2 de 6 (33 %)');
    cleanup();
    render(<><KpiTiles testId="k" tiles={[]} /><Progress testId="p" label="Entregados" part={0} total={0} format={String} /></>);
    expect(screen.getByTestId('k-empty')).toBeInTheDocument();
    expect(screen.getByTestId('p-empty')).toBeInTheDocument();
  });

  it('las líneas se cortan en un hueco: nunca se une un corte sin cifra', () => {
    render(<LineChart data={{ ...EMPTY, categories: ['a', 'b', 'c', 'd'], series: [{ key: 's', label: 's', values: [1, 2, null, 4] }] }} testId="t" />);
    expect(screen.getAllByTestId('t-line')).toHaveLength(1); // a-b; "d" queda suelto
    cleanup();
    render(<ComboBarsLine data={predictionCutsData(cuts)} testId="c" />);
    expect(screen.getAllByTestId('c-line')).toHaveLength(1); // 15 %–25 %; el 50 % no tiene cifra
    expect(within(screen.getByTestId('c-table')).getAllByRole('row')[3]).toHaveTextContent('Sin datoSin dato');
    cleanup();
    // Hueco en medio: la línea no lo cruza (sin ningún tramo entre el primer y el tercer punto)
    render(<ComboBarsLine data={{ ...EMPTY, categories: ['a', 'b', 'c'], series: [
      { key: 'bar', label: 'barras', values: [1, 1, 1] }, { key: 'lin', label: 'línea', values: [1, null, 3] }] }} testId="g" />);
    expect(screen.queryAllByTestId('g-line')).toHaveLength(0);
  });

  it('con más series que colores, la leyenda distingue por patrón (no solo por color)', () => {
    const many: CategoryChartData = { ...EMPTY, categories: ['x'], series: Array.from({ length: 7 }, (_, i) => ({ key: `s${i}`, label: `S${i}`, values: [i + 1] })) };
    const { container } = render(<StackedBars data={many} testId="t" />);
    expect(container.querySelectorAll('pattern').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('chart-legend').querySelectorAll('li')).toHaveLength(7);
  });
});

describe('Gráficos (paso 3): selector por rol y preferencia', () => {
  const opts = (prefix: string) => [
    { id: 'a', label: `${prefix} A`, render: () => <p>{`${prefix}-a`}</p> },
    { id: 'b', label: `${prefix} B`, render: () => <p>{`${prefix}-b`}</p> },
  ];

  it('quién elige: fondos, lotes y actividad ADMINISTRATOR y EMPLOYEE; predicción ADMINISTRATOR y REPRESENTATIVE', () => {
    expect(canChooseOrgCharts(['ADMINISTRATOR'])).toBe(true);
    expect(canChooseOrgCharts(['EMPLOYEE'])).toBe(true);
    expect(canChooseOrgCharts(['REPRESENTATIVE'])).toBe(false);
    expect(canChoosePredictionCharts(['ADMINISTRATOR'])).toBe(true);
    expect(canChoosePredictionCharts(['REPRESENTATIVE'])).toBe(true);
    expect(canChoosePredictionCharts(['EMPLOYEE'])).toBe(false);
  });

  it('con permiso: un simple y un avanzado a la vez, cada uno con su selector; la elección se guarda por cuenta', () => {
    const m = memory();
    render(<ChartPanel panel="assets" simple={opts('s')} advanced={opts('v')} canChoose accountId="acc-1" storage={m.store} />);
    expect(screen.getByText('s-a')).toBeInTheDocument();
    expect(screen.getByText('v-a')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('charts-assets-simple-select'), { target: { value: 'b' } });
    expect(screen.getByText('s-b')).toBeInTheDocument();
    expect(JSON.parse(m.data.get(chartPreferenceKey('acc-1', 'assets'))!)).toEqual({ simple: 'b' });
    // al volver (recargar), la elección sigue
    cleanup();
    render(<ChartPanel panel="assets" simple={opts('s')} advanced={opts('v')} canChoose accountId="acc-1" storage={m.store} />);
    expect(screen.getByText('s-b')).toBeInTheDocument();
    expect(screen.getByText('v-a')).toBeInTheDocument();
  });

  it('sin permiso: ningún selector y siempre los predeterminados, aunque haya una elección guardada', () => {
    const m = memory({ [chartPreferenceKey('acc-1', 'assets')]: JSON.stringify({ simple: 'b', advanced: 'b' }) });
    render(<ChartPanel panel="assets" simple={opts('s')} advanced={opts('v')} canChoose={false} accountId="acc-1" storage={m.store} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('s-a')).toBeInTheDocument();
    expect(screen.getByText('v-a')).toBeInTheDocument();
    expect(screen.queryByText('s-b')).toBeNull();
  });

  it('la clave usa el identificador opaco de la cuenta, nunca el correo; un valor ajeno se ignora', () => {
    expect(chartPreferenceKey('01M7HNDX', 'funds')).toBe('paxfide.charts.v1.01M7HNDX.funds');
    const m = memory({ [chartPreferenceKey('acc-1', 'funds')]: JSON.stringify({ simple: 'no-existe', advanced: 'b' }) });
    expect(readChartChoice(m.store, 'acc-1', 'funds', { simple: ['a', 'b'], advanced: ['a', 'b'] })).toEqual({ simple: undefined, advanced: 'b' });
  });

  it('un almacenamiento roto no rompe nada: se ven los predeterminados y se puede cambiar el tipo', () => {
    const broken = () => { throw new Error('bloqueado'); };
    expect(writeChartChoice(broken, 'acc-1', 'funds', { simple: 'b' })).toEqual({ ok: false, error: 'StorageUnavailable' });
    render(<ChartPanel panel="funds" simple={opts('s')} advanced={opts('v')} canChoose accountId="acc-1" storage={broken} />);
    expect(screen.getByText('s-a')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('charts-funds-simple-select'), { target: { value: 'b' } });
    expect(screen.getByText('s-b')).toBeInTheDocument();
  });
});

describe('Gráficos (paso 3): paneles', () => {
  it('fondos: ADMINISTRATOR elige; con dos monedas, se elige la moneda; el predeterminado son barras por mes', () => {
    render(<FundsCharts monthly={MONTHLY} funds={FUNDS} roles={['ADMINISTRATOR']} accountId="acc-1" storage={memory().store} />);
    expect(screen.getByTestId('charts-funds-simple')).toHaveAttribute('data-chart', 'vbars');
    expect(screen.getByTestId('charts-funds-advanced')).toHaveAttribute('data-chart', 'combo');
    expect(screen.getByTestId('funds-vbars-svg').getAttribute('aria-label')).toContain('37.511.963,01 COP');
    fireEvent.change(screen.getByTestId('funds-currency'), { target: { value: 'USD' } });
    expect(screen.getByTestId('funds-vbars-svg').getAttribute('aria-label')).toContain('1.388,89 USD');
    fireEvent.change(screen.getByTestId('charts-funds-advanced-select'), { target: { value: 'status' } });
    expect(screen.getByTestId('funds-status-svg')).toBeInTheDocument();
  });

  it('lotes: EMPLOYEE elige; REPRESENTATIVE no tendría selector (aserción negativa)', () => {
    render(<AssetsCharts items={ASSETS} roles={['EMPLOYEE']} accountId="acc-2" storage={memory().store} />);
    expect(screen.getByTestId('charts-assets-simple-select')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('charts-assets-simple-select'), { target: { value: 'progress' } });
    expect(screen.getByTestId('assets-progress-svg').getAttribute('aria-label')).toBe('Lotes entregados: 2 lotes de 6 lotes (33 %)');
    cleanup();
    render(<AssetsCharts items={ASSETS} roles={['REPRESENTATIVE']} accountId="acc-3" storage={memory().store} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByTestId('charts-assets')).toHaveAttribute('data-can-choose', 'false');
  });

  it('actividad: carga páginas hasta el tope y dice que hay más; REPRESENTATIVE la ve sin selector', async () => {
    const page = (n: number, cursor?: string) => ({ kind: 'ok' as const, data: {
      items: Array.from({ length: n }, (_, i) => act('FUNDS_CLEARED', `2026-11-${String(1 + (i % 9)).padStart(2, '0')}T15:00:00Z`)),
      nextCursor: cursor, truncated: false,
    } });
    const client = vi.fn(async (_o: string, c?: string) => page(20, `c${Number(c?.slice(1) ?? 0) + 1}`));
    render(<ActivityChartsSection organizationId="org-1" client={client} roles={['REPRESENTATIVE']} accountId="acc-4" />);
    expect(await screen.findByTestId('charts-activity')).toHaveAttribute('data-can-choose', 'false');
    expect(client).toHaveBeenCalledTimes(ACTIVITY_CHART_LIMIT / 20);
    expect(screen.getAllByText(/Los 100 eventos más recientes \(como mucho 100; hay más que no se dibujan\)/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('actividad: un error de lectura no rompe la pantalla', async () => {
    render(<ActivityChartsSection organizationId="org-1" client={async () => ({ kind: 'error' })} roles={['ADMINISTRATOR']} />);
    expect(await screen.findByText('No pudimos cargar la actividad.')).toBeInTheDocument();
  });

  it('predicción: los predeterminados son los gráficos de siempre; las alternativas por corte no rellenan', () => {
    render(<PredictionChartsPanel view={view} observedFraction={0.45} cuts={cuts} roles={['REPRESENTATIVE']} accountId="acc-5" storage={memory().store} />);
    expect(screen.getByTestId('basic-probability')).toHaveTextContent('7 %');
    expect(screen.getByTestId('advanced-chart')).toHaveAttribute('role', 'img');
    fireEvent.change(screen.getByTestId('charts-prediction-advanced-select'), { target: { value: 'cuts' } });
    expect(screen.getByTestId('prediction-cuts-combo-svg').getAttribute('aria-label')).toContain('50 % del tiempo sin dato');
    fireEvent.change(screen.getByTestId('charts-prediction-advanced-select'), { target: { value: 'probability' } });
    expect(screen.getAllByTestId('prediction-probability-line-line')).toHaveLength(1);
  });
});

describe('Gráficos (paso 3): pantalla de predicción', () => {
  const ADMIN = async () => ({ kind: 'ok' as const, principal: { accountId: 'acc-9', organizationId: 'o', roles: ['ADMINISTRATOR' as const] } });
  const LIST = async () => ({ kind: 'ok' as const, items: [{ campaignRef: 'camp-1', publicCode: 'P1', title: 'Agua', status: 'OPEN', currency: 'COP', targetAmount: '1000', clearedAmount: '450', responsibles: [], assignedEmployeeCount: 0 }] });

  beforeEach(() => {
    window.localStorage.setItem(chartPreferenceKey('acc-9', 'prediction'), JSON.stringify({ simple: 'hbars', advanced: 'probability' }));
  });

  it('con otro tipo elegido, la etiqueta de estimación sigue visible y separada, y se dibuja lo elegido', async () => {
    render(<PredictionScreen meClient={ADMIN} listClient={LIST} client={async () => ESTIMATE}
      historyClient={async () => CUTS} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver estimación' }));
    const block = await screen.findByTestId('prediction-estimate');
    expect(within(block).getByText(ESTIMATE_LABEL)).toBeInTheDocument();
    await waitFor(() => expect(within(block).getByTestId('charts-prediction-simple')).toHaveAttribute('data-chart', 'hbars'));
    expect(within(block).getByTestId('prediction-hbars-svg').getAttribute('aria-label')).toContain('Recaudado hoy (hecho) 45 %');
    expect(within(block).getByTestId('charts-prediction-advanced')).toHaveAttribute('data-chart', 'probability');
    expect(within(block).queryByTestId('basic-probability')).toBeNull();
  });
});
