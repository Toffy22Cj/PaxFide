// Ref: plan del paso 3. Transforma las respuestas reales del backend en datos de gráfico. Lógica pura: ningún valor se
// inventa. Lo que el backend no da (un mes sin fila, un corte sin cifra) queda `null` o fuera; lo que da en "0" es 0.
import { formatMinorUnits } from '../../lib/money';
import { lifecycleLabel, allocationStatusLabel } from '../../lib/labels';
import type { MonthlyCleared, ActivityItem } from '../../lib/api/panelData';
import type { Fund, OrgAsset } from '../../lib/api/organization';
import type { PredictionCut, PredictionView } from '../../lib/api/prediction';
import type { CategoryChartData } from './chartData';

const pct0 = (v: number) => `${Math.round(v)} %`;

// --- Fondos -------------------------------------------------------------------------------------------------------

/** Monedas con filas en `/funds/monthly`, la de más importe primero. */
export function monthlyCurrencies(m: MonthlyCleared): string[] {
  const totals = new Map<string, number>();
  for (const i of m.items) totals.set(i.currency, (totals.get(i.currency) ?? 0) + Number(i.clearedAmount));
  return [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
}

/** "2026-07" → "jul 2026". */
export function shortMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const name = new Intl.DateTimeFormat('es', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
  return `${name.replace('.', '')} ${y}`;
}

/** Recaudado por mes en una moneda (unidades mínimas); los meses vacíos vienen del backend en "0". */
export function monthlyData(m: MonthlyCleared, currency: string): CategoryChartData {
  const rows = m.items.filter((i) => i.currency === currency);
  return {
    categories: rows.map((r) => shortMonth(r.month)),
    series: [{ key: 'cleared', label: `Recaudado en ${currency}`, values: rows.map((r) => Number(r.clearedAmount)), nature: 'fact' }],
    format: (v) => formatMinorUnits(String(Math.round(v)), currency),
    unit: 'Mes',
  };
}

/**
 * Estado del dinero por moneda, en % de lo recibido (barras apiladas al 100 %): disponible y cada estado de las
 * asignaciones, todo de `/funds`. Cada barra es una moneda: nunca se suman monedas distintas.
 */
export function fundsStatusData(funds: Fund[]): CategoryChartData {
  const currencies = [...new Set(funds.map((f) => f.currency))].sort();
  const statuses = [...new Set(funds.flatMap((f) => f.allocations.map((a) => a.status)))].sort();
  const sum = (c: string, pick: (f: Fund) => number) => funds.filter((f) => f.currency === c).reduce((a, f) => a + pick(f), 0);
  const cleared = currencies.map((c) => sum(c, (f) => Number(f.clearedAmount)));
  const share = (vals: number[]) => vals.map((v, i) => (cleared[i] > 0 ? (v / cleared[i]) * 100 : null));
  return {
    categories: currencies,
    series: [
      { key: 'available', label: 'Disponible', values: share(currencies.map((c) => sum(c, (f) => Number(f.availableAmount)))), nature: 'fact' },
      ...statuses.map((st) => ({
        key: `alloc-${st}`, label: `Asignación ${allocationStatusLabel(st).toLowerCase()}`, nature: 'fact' as const,
        values: share(currencies.map((c) => sum(c, (f) => f.allocations.filter((a) => a.status === st).reduce((x, a) => x + Number(a.amount), 0)))),
      })),
    ],
    format: pct0,
    unit: 'Moneda (% de lo recibido)',
  };
}

// --- Lotes --------------------------------------------------------------------------------------------------------

export const LIFECYCLE_ORDER = ['REGISTERED', 'DISPATCHED', 'RECEIVED', 'DELIVERED'];
const lots = (n: number) => `${n} ${n === 1 ? 'lote' : 'lotes'}`;

function stateOrder(items: OrgAsset[]): string[] {
  const extra = [...new Set(items.map((a) => a.lifecycleStatus))].filter((s) => !LIFECYCLE_ORDER.includes(s)).sort();
  return [...LIFECYCLE_ORDER, ...extra];
}

/** Lotes por estado (se cuentan lotes: las cantidades tienen unidades distintas y no se suman). */
export function assetsByState(items: OrgAsset[]): CategoryChartData {
  const states = stateOrder(items);
  return {
    categories: states.map(lifecycleLabel),
    series: [{ key: 'lots', label: 'Lotes', values: states.map((s) => items.filter((a) => a.lifecycleStatus === s).length), nature: 'fact' }],
    format: lots,
    unit: 'Estado',
  };
}

const typeOf = (a: OrgAsset) => a.assetType ?? 'Sin tipo';

/** Apiladas: en cada estado, cuántos lotes de cada tipo; o al revés (`byType`). */
export function assetsStateByType(items: OrgAsset[], byType = false): CategoryChartData {
  const states = stateOrder(items);
  const types = [...new Set(items.map(typeOf))].sort();
  const count = (s: string, t: string) => items.filter((a) => a.lifecycleStatus === s && typeOf(a) === t).length;
  return byType
    ? {
      categories: types,
      series: states.map((s) => ({ key: s, label: lifecycleLabel(s), values: types.map((t) => count(s, t)), nature: 'fact' as const })),
      format: lots, unit: 'Tipo de lote',
    }
    : {
      categories: states.map(lifecycleLabel),
      series: types.map((t) => ({ key: t, label: t, values: states.map((s) => count(s, t)), nature: 'fact' as const })),
      format: lots, unit: 'Estado',
    };
}

// --- Actividad ----------------------------------------------------------------------------------------------------

export const ACTIVITY_LABEL: Record<string, string> = {
  ASSET_REGISTERED: 'Lote registrado', ASSET_DISPATCHED: 'Lote despachado', ASSET_RECEIVED: 'Lote recibido',
  ASSET_DELIVERED: 'Lote entregado', ASSET_SPLIT: 'Lote dividido', FUNDS_CLEARED: 'Donación confirmada',
  CAMPAIGN_CLOSED: 'Convocatoria cerrada', BATCH_ANCHORED: 'Anclaje en blockchain',
};
const events = (n: number) => `${n} ${n === 1 ? 'evento' : 'eventos'}`;

export function activityByType(items: ActivityItem[]): CategoryChartData {
  const types = Object.keys(ACTIVITY_LABEL).filter((t) => items.some((i) => i.type === t));
  return {
    categories: types.map((t) => ACTIVITY_LABEL[t]),
    series: [{ key: 'events', label: 'Eventos', values: types.map((t) => items.filter((i) => i.type === t).length), nature: 'fact' }],
    format: events,
    unit: 'Tipo de evento',
  };
}

/** El día "AAAA-MM-DD" de un instante en la zona del backend (los meses de fondos también se cuentan allí). */
export function dayIn(iso: string, timezone = 'America/Bogota'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

const DAY = 86_400_000;
const dayLabel = (d: string) => new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  .format(new Date(`${d}T12:00:00Z`)).replace('.', '');

/**
 * Eventos por día (o por semana, si los cargados abarcan más de 31 días), del más antiguo al más reciente. Entre el
 * primero y el último, un periodo sin eventos cuenta 0: entre los eventos cargados, ese día no hubo ninguno.
 */
export function activityOverTime(items: ActivityItem[], byType = false): CategoryChartData & { granularity: 'day' | 'week' } {
  const days = items.map((i) => dayIn(i.occurredAt)).sort();
  if (days.length === 0) return { categories: [], series: [], format: events, unit: 'Día', granularity: 'day' };
  const first = Date.parse(`${days[0]}T00:00:00Z`), last = Date.parse(`${days[days.length - 1]}T00:00:00Z`);
  const weekly = (last - first) / DAY > 31;
  const step = weekly ? 7 * DAY : DAY;
  const buckets: number[] = [];
  for (let t = first; t <= last; t += step) buckets.push(t);
  const bucketOf = (i: ActivityItem) => Math.floor((Date.parse(`${dayIn(i.occurredAt)}T00:00:00Z`) - first) / step);
  const categories = buckets.map((t) => (weekly ? `sem. ${dayLabel(new Date(t).toISOString().slice(0, 10))}` : dayLabel(new Date(t).toISOString().slice(0, 10))));
  const countWhere = (pred: (i: ActivityItem) => boolean) => buckets.map((_, b) => items.filter((i) => bucketOf(i) === b && pred(i)).length);
  const types = Object.keys(ACTIVITY_LABEL).filter((t) => items.some((i) => i.type === t));
  return {
    categories,
    series: byType
      ? types.map((t) => ({ key: t, label: ACTIVITY_LABEL[t], values: countWhere((i) => i.type === t), nature: 'fact' as const }))
      : [{ key: 'events', label: 'Eventos', values: countWhere(() => true), nature: 'fact' }],
    format: events,
    unit: weekly ? 'Semana' : 'Día',
    granularity: weekly ? 'week' : 'day',
  };
}

// --- Predicción ---------------------------------------------------------------------------------------------------

/** Hoy: recaudado (hecho, si se conoce), final estimado (estimación) y la meta, en % de la meta. */
export function predictionTodayData(view: PredictionView, observedFraction?: number): CategoryChartData {
  const cats = [...(observedFraction !== undefined ? ['Recaudado hoy (hecho)'] : []), 'Final estimado (estimación)', 'Meta'];
  const vals = [...(observedFraction !== undefined ? [observedFraction * 100] : []), view.estimatedFinal * 100, 100];
  return {
    categories: cats,
    series: [{ key: 'pct', label: '% de la meta', values: vals }],
    format: pct0,
    unit: 'Dato',
  };
}

/**
 * Por corte: lo recaudado entonces (hecho reconstruido del event store) y el final que se estimaba (estimación). Un
 * corte sin cifra queda `null`: nunca se rellena.
 */
export function predictionCutsData(cuts: PredictionCut[]): CategoryChartData {
  return {
    categories: cuts.map((c) => `${Math.round(c.t * 100)} % del tiempo`),
    series: [
      { key: 'raised', label: 'Recaudado en el corte (hecho)', values: cuts.map((c) => (c.raisedAtCut === undefined ? null : c.raisedAtCut * 100)), nature: 'fact' },
      { key: 'final', label: 'Final estimado en el corte (estimación)', values: cuts.map((c) => (c.available && c.estimatedFinal !== undefined ? c.estimatedFinal * 100 : null)), nature: 'estimate' },
    ],
    format: pct0,
    unit: 'Corte',
  };
}

export function predictionProbabilityData(cuts: PredictionCut[]): CategoryChartData {
  return {
    categories: cuts.map((c) => `${Math.round(c.t * 100)} % del tiempo`),
    series: [{ key: 'prob', label: 'Probabilidad de alcanzar la meta (estimación)', values: cuts.map((c) => (c.available && c.probability !== undefined ? c.probability * 100 : null)), nature: 'estimate' }],
    format: pct0,
    unit: 'Corte',
  };
}
