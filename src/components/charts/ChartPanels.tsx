'use client';

// Ref: plan del paso 3 (encargo del 2026-11-15, Tarea B; aprobado por Manuel el 2026-11-16). Los cuatro paneles con su
// par de gráficos. Quién elige el tipo («cada rol en lo que ya ve»): fondos, lotes y actividad, `ADMINISTRATOR` y
// `EMPLOYEE`; predicción, `ADMINISTRATOR` y `REPRESENTATIVE`. El predeterminado de cada lado es la primera opción.
import React, { useEffect, useState } from 'react';
import s from './charts.module.css';
import { ChartPanel, type ChartOption } from './ChartPanel';
import { ComboBarsLine, Donut, HorizontalBars, KpiTiles, LineChart, Progress, StackedBars, VerticalBars } from './Charts';
import {
  activityByType, activityOverTime, assetsByState, assetsStateByType, fundsStatusData, monthlyCurrencies, monthlyData,
  predictionCutsData, predictionProbabilityData, predictionTodayData, shortMonth,
} from './panelSeries';
import { formatMinorUnits } from '../../lib/money';
import { fetchActivity, type ActivityItem, type MonthlyCleared } from '../../lib/api/panelData';
import type { Fund, OrgAsset } from '../../lib/api/organization';
import type { PredictionCut, PredictionView } from '../../lib/api/prediction';
import type { PreferenceStorage } from '../../lib/theme/theme';
import { AdvancedPredictionChart, BasicPredictionChart } from '../prediction/PredictionCharts';
import { LocalDate } from '../LocalDate';
import { StatusNotice } from '../States';

type Roles = readonly string[];
type Storage = () => PreferenceStorage | null | undefined;

/** Fondos, lotes y actividad: eligen `ADMINISTRATOR` y `EMPLOYEE` (decisión de Manuel del 2026-11-15). */
export const canChooseOrgCharts = (roles: Roles) => roles.includes('ADMINISTRATOR') || roles.includes('EMPLOYEE');
/** Predicción: eligen `ADMINISTRATOR` y `REPRESENTATIVE` (los que la ven, DD-43). */
export const canChoosePredictionCharts = (roles: Roles) => roles.includes('ADMINISTRATOR') || roles.includes('REPRESENTATIVE');

// --- Fondos -------------------------------------------------------------------------------------------------------

export function FundsCharts({ monthly, funds, roles, accountId, storage }: {
  monthly: MonthlyCleared; funds?: Fund[]; roles: Roles; accountId?: string; storage?: Storage;
}) {
  const currencies = monthlyCurrencies(monthly);
  const [currency, setCurrency] = useState(currencies[0] ?? '');
  const cur = currencies.includes(currency) ? currency : currencies[0] ?? '';
  if (!cur) return <StatusNotice variant="info" title="Sin fondos por mes" text="Tu organización todavía no tiene fondos recibidos." />;
  const data = monthlyData(monthly, cur);
  const rows = monthly.items.filter((i) => i.currency === cur);
  const total = rows.reduce((a, r) => a + Number(r.clearedAmount), 0);
  const best = rows.reduce<typeof rows[number] | undefined>((b, r) => (!b || Number(r.clearedAmount) > Number(b.clearedAmount) ? r : b), undefined);
  const fmt = (v: number) => formatMinorUnits(String(Math.round(v)), cur);
  const span = rows.length ? `${shortMonth(rows[0].month)} – ${shortMonth(rows[rows.length - 1].month)}` : '';
  const caption = `Fondos recibidos por mes en ${cur} (${span}), por la fecha del hecho en ${monthly.timezone}.`;

  const simple: ChartOption[] = [
    { id: 'vbars', label: 'Barras verticales', render: () => <VerticalBars data={data} testId="funds-vbars" caption={caption} /> },
    { id: 'hbars', label: 'Barras horizontales', render: () => <HorizontalBars data={data} testId="funds-hbars" caption={caption} /> },
    { id: 'line', label: 'Líneas', render: () => <LineChart data={data} testId="funds-line" caption={caption} /> },
    { id: 'area', label: 'Área', render: () => <LineChart data={data} testId="funds-area" caption={caption} area /> },
    {
      id: 'kpi', label: 'Cifras clave', render: () => <KpiTiles testId="funds-kpi" caption={caption} tiles={[
        { label: `Recibido en ${rows.length} meses`, value: fmt(total) },
        { label: `Recibido en ${rows.length ? shortMonth(rows[rows.length - 1].month) : '—'}`, value: rows.length ? fmt(Number(rows[rows.length - 1].clearedAmount)) : '—' },
        { label: best ? `Mes con más (${shortMonth(best.month)})` : 'Mes con más', value: best ? fmt(Number(best.clearedAmount)) : '—' },
      ]} />,
    },
  ];
  const advanced: ChartOption[] = [
    {
      id: 'combo', label: 'Barras por mes y línea acumulada', render: () => (
        <ComboBarsLine data={data} testId="funds-combo" cumulativeLine lineLabel={`Acumulado de estos ${rows.length} meses`}
          caption={`${caption} La línea suma solo los meses mostrados, no el total histórico.`} />
      ),
    },
    {
      id: 'status', label: 'Estado del dinero por moneda', render: () => (funds && funds.length > 0
        ? <StackedBars data={fundsStatusData(funds)} testId="funds-status"
          caption="Cada barra es una moneda, en % de lo recibido en ella: nunca se suman monedas distintas. Datos de los fondos de la organización." />
        : <StatusNotice variant="info" title="Sin datos de fondos" text="No hay fondos con los que dibujar este gráfico." />),
    },
    {
      id: 'multiples', label: 'Un gráfico por moneda', render: () => (
        <div className={s.panel} data-testid="funds-multiples">
          {currencies.map((c) => (
            <VerticalBars key={c} data={monthlyData(monthly, c)} testId={`funds-multiples-${c}`} caption={`Recibido por mes en ${c}.`} />
          ))}
        </div>
      ),
    },
  ];
  return (
    <div className={s.panel}>
      {currencies.length > 1 && (
        <label className={s.note}>
          Moneda{' '}
          <select className={s.select} value={cur} onChange={(e) => setCurrency(e.target.value)} data-testid="funds-currency">
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}
      <ChartPanel panel="funds" simple={simple} advanced={advanced} canChoose={canChooseOrgCharts(roles)} accountId={accountId}
        storage={storage} />
    </div>
  );
}

/** Carga los fondos por mes (12) y pinta el panel; un error no rompe la pantalla de fondos. */
export function FundsChartsSection({ organizationId, client, funds, roles, accountId }: {
  organizationId: string; client: (o: string, months?: number) => Promise<import('../../lib/api/panelData').ReadOutcome<MonthlyCleared>>;
  funds?: Fund[]; roles: Roles; accountId?: string;
}) {
  const [state, setState] = useState<'loading' | 'error' | 'forbidden' | MonthlyCleared>('loading');
  useEffect(() => {
    let live = true;
    setState('loading');
    (async () => {
      try {
        const r = await client(organizationId, 12);
        if (live) setState(r.kind === 'ok' ? r.data : r.kind === 'forbidden' ? 'forbidden' : 'error');
      } catch {
        if (live) setState('error');
      }
    })();
    return () => { live = false; };
  }, [organizationId, client]);
  return (
    <section aria-labelledby="funds-charts-title" data-testid="funds-charts">
      <h2 id="funds-charts-title" className={s.slotTitle}>Fondos por mes</h2>
      {state === 'loading' && <p className={s.note}>Cargando los fondos por mes…</p>}
      {state === 'error' && <StatusNotice variant="info" title="Gráficos no disponibles" text="No pudimos cargar los fondos por mes." />}
      {state === 'forbidden' && <StatusNotice variant="info" title="Gráficos no disponibles" text="Tu cuenta no puede ver los fondos por mes." />}
      {typeof state === 'object' && <FundsCharts monthly={state} funds={funds} roles={roles} accountId={accountId} />}
    </section>
  );
}

// --- Lotes --------------------------------------------------------------------------------------------------------

export function AssetsCharts({ items, roles, accountId, storage }: { items: OrgAsset[]; roles: Roles; accountId?: string; storage?: Storage }) {
  const byState = assetsByState(items);
  const delivered = items.filter((a) => a.lifecycleStatus === 'DELIVERED').length;
  const count = (st: string) => items.filter((a) => a.lifecycleStatus === st).length;
  const caption = `${items.length} ${items.length === 1 ? 'lote' : 'lotes'} de la organización. Se cuentan lotes: sus cantidades tienen unidades distintas y no se suman.`;
  const simple: ChartOption[] = [
    { id: 'vbars', label: 'Barras verticales', render: () => <VerticalBars data={byState} testId="assets-vbars" caption={caption} /> },
    { id: 'hbars', label: 'Barras horizontales', render: () => <HorizontalBars data={byState} testId="assets-hbars" caption={caption} /> },
    { id: 'donut', label: 'Dona', render: () => <Donut data={byState} testId="assets-donut" caption={caption} /> },
    {
      id: 'progress', label: 'Progreso de entrega', render: () => (
        <Progress label="Lotes entregados" part={delivered} total={items.length} testId="assets-progress"
          format={(v) => `${v} ${v === 1 ? 'lote' : 'lotes'}`} />
      ),
    },
    {
      id: 'kpi', label: 'Cifras clave', render: () => <KpiTiles testId="assets-kpi" caption={caption} tiles={[
        { label: 'Lotes', value: String(items.length) },
        { label: 'En bodega', value: String(count('REGISTERED') + count('RECEIVED')) },
        { label: 'En camino', value: String(count('DISPATCHED')) },
        { label: 'Entregados', value: String(delivered) },
      ]} />,
    },
  ];
  const advanced: ChartOption[] = [
    { id: 'stateByType', label: 'Estados por tipo de lote', render: () => <StackedBars data={assetsStateByType(items)} testId="assets-state-type" caption={caption} /> },
    { id: 'typeByState', label: 'Tipos de lote por estado', render: () => <StackedBars data={assetsStateByType(items, true)} testId="assets-type-state" caption={caption} /> },
  ];
  if (items.length === 0) return <StatusNotice variant="info" title="Sin lotes" text="Tu organización todavía no tiene lotes." />;
  return <ChartPanel panel="assets" simple={simple} advanced={advanced} canChoose={canChooseOrgCharts(roles)} accountId={accountId} storage={storage} />;
}

// --- Actividad ----------------------------------------------------------------------------------------------------

/** Tope de eventos que se cargan para los gráficos (5 páginas de 20); el gráfico lo dice. */
export const ACTIVITY_CHART_LIMIT = 100;

export function ActivityCharts({ items, more, roles, accountId, storage }: {
  items: ActivityItem[]; more: boolean; roles: Roles; accountId?: string; storage?: Storage;
}) {
  if (items.length === 0) return <StatusNotice variant="info" title="Sin actividad" text="Todavía no hay actividad en tu organización." />;
  const byType = activityByType(items);
  const over = activityOverTime(items);
  const sorted = [...items].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const scope = `Los ${items.length} eventos más recientes${more ? ` (como mucho ${ACTIVITY_CHART_LIMIT}; hay más que no se dibujan)` : ''}.`;
  const simple: ChartOption[] = [
    { id: 'hbars', label: 'Barras horizontales', render: () => <HorizontalBars data={byType} testId="activity-hbars" caption={scope} /> },
    { id: 'vbars', label: 'Barras verticales', render: () => <VerticalBars data={byType} testId="activity-vbars" caption={scope} /> },
    { id: 'donut', label: 'Dona', render: () => <Donut data={byType} testId="activity-donut" caption={scope} /> },
    {
      id: 'kpi', label: 'Cifras clave', render: () => (
        <KpiTiles testId="activity-kpi" caption={scope} tiles={[
          { label: 'Eventos', value: String(items.length) },
          { label: over.granularity === 'week' ? 'Semanas con actividad' : 'Días con actividad', value: String(over.series[0].values.filter((v) => (v ?? 0) > 0).length) },
          { label: 'Tipos de evento', value: String(byType.categories.length) },
        ]} />
      ),
    },
  ];
  const time = (byTypeSeries: boolean) => activityOverTime(items, byTypeSeries);
  const timeCaption = <>{scope} Por {over.granularity === 'week' ? 'semana' : 'día'} del hecho, en America/Bogota, del <LocalDate iso={sorted[0].occurredAt} /> al <LocalDate iso={sorted[sorted.length - 1].occurredAt} />.</>;
  const advanced: ChartOption[] = [
    { id: 'line', label: over.granularity === 'week' ? 'Eventos por semana' : 'Eventos por día', render: () => <><LineChart data={time(false)} testId="activity-line" /><p className={s.caption}>{timeCaption}</p></> },
    { id: 'stacked', label: over.granularity === 'week' ? 'Eventos por semana y tipo' : 'Eventos por día y tipo', render: () => <><StackedBars data={time(true)} testId="activity-stacked" /><p className={s.caption}>{timeCaption}</p></> },
  ];
  return <ChartPanel panel="activity" simple={simple} advanced={advanced} canChoose={canChooseOrgCharts(roles)} accountId={accountId} storage={storage} />;
}

/** Carga hasta {@link ACTIVITY_CHART_LIMIT} eventos (páginas de `/activity`) y pinta el panel. */
export function ActivityChartsSection({ organizationId, client = fetchActivity, roles, accountId }: {
  organizationId: string; client?: typeof fetchActivity; roles: Roles; accountId?: string;
}) {
  const [state, setState] = useState<'loading' | 'error' | 'forbidden' | { items: ActivityItem[]; more: boolean }>('loading');
  useEffect(() => {
    let live = true;
    setState('loading');
    (async () => {
      try {
        const items: ActivityItem[] = [];
        let cursor: string | undefined;
        do {
          const r = await client(organizationId, cursor);
          if (r.kind !== 'ok') { if (live) setState(r.kind === 'forbidden' ? 'forbidden' : 'error'); return; }
          items.push(...r.data.items);
          cursor = r.data.nextCursor;
        } while (cursor && items.length < ACTIVITY_CHART_LIMIT);
        if (live) setState({ items: items.slice(0, ACTIVITY_CHART_LIMIT), more: !!cursor || items.length > ACTIVITY_CHART_LIMIT });
      } catch {
        if (live) setState('error');
      }
    })();
    return () => { live = false; };
  }, [organizationId, client]);
  return (
    <section aria-labelledby="activity-charts-title" data-testid="activity-charts">
      <h2 id="activity-charts-title" className={s.slotTitle}>Actividad en gráficos</h2>
      {state === 'loading' && <p className={s.note}>Cargando la actividad…</p>}
      {state === 'error' && <StatusNotice variant="info" title="Gráficos no disponibles" text="No pudimos cargar la actividad." />}
      {state === 'forbidden' && <StatusNotice variant="info" title="Gráficos no disponibles" text="Tu cuenta no puede ver la actividad." />}
      {typeof state === 'object' && <ActivityCharts items={state.items} more={state.more} roles={roles} accountId={accountId} />}
    </section>
  );
}

// --- Predicción ---------------------------------------------------------------------------------------------------

/**
 * Predicción: los predeterminados son los dos gráficos que ya existían (`BasicPredictionChart` y
 * `AdvancedPredictionChart`), sin cambios en lo que muestran. Las alternativas por corte usan `/prediction/history`;
 * si no hay cortes, lo dicen. La etiqueta de estimación la pone el bloque que contiene el panel.
 */
export function PredictionChartsPanel({ view, observedFraction, cuts, roles, accountId, storage }: {
  view: PredictionView; observedFraction?: number; cuts?: PredictionCut[]; roles: Roles; accountId?: string; storage?: Storage;
}) {
  const today = predictionTodayData(view, observedFraction);
  const noCuts = <StatusNotice variant="info" title="Sin cortes" text="No hay estimaciones por corte para esta convocatoria." />;
  const simple: ChartOption[] = [
    { id: 'kpi', label: 'Probabilidad y final estimado', render: () => <BasicPredictionChart view={view} /> },
    { id: 'hbars', label: 'Barras horizontales (% de la meta)', render: () => <HorizontalBars data={today} testId="prediction-hbars" caption="Recaudado (hecho) y final estimado (estimación), frente a la meta." /> },
    { id: 'vbars', label: 'Barras verticales (% de la meta)', render: () => <VerticalBars data={today} testId="prediction-vbars" caption="Recaudado (hecho) y final estimado (estimación), frente a la meta." /> },
  ];
  const advanced: ChartOption[] = [
    { id: 'today', label: 'Hoy frente al final estimado', render: () => <AdvancedPredictionChart view={view} observedFraction={observedFraction} /> },
    {
      id: 'cuts', label: 'Recaudado y final estimado por corte', render: () => (cuts && cuts.length > 0
        ? <ComboBarsLine data={predictionCutsData(cuts)} testId="prediction-cuts-combo"
          caption="Barras: lo recaudado en cada corte (hecho). Línea: el final que el modelo estimaba entonces (estimación); solo une cortes consecutivos con cifra." />
        : noCuts),
    },
    {
      id: 'probability', label: 'Probabilidad por corte', render: () => (cuts && cuts.length > 0
        ? <LineChart data={predictionProbabilityData(cuts)} testId="prediction-probability-line"
          caption="Probabilidad estimada en cada corte con lo recaudado hasta ese momento; un corte sin cifra queda vacío." />
        : noCuts),
    },
  ];
  return <ChartPanel panel="prediction" simple={simple} advanced={advanced} canChoose={canChoosePredictionCharts(roles)}
    accountId={accountId} storage={storage} />;
}
