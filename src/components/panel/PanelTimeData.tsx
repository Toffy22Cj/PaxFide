'use client';
// Ref: plan-fase7-puesta-al-dia.md P-3 (F-C3); plan-fase7-fidelidad.md X-13 (KPI "Integridad", "Actividad reciente" y
// "Recaudado en <mes>"); paxfide-panel.html (vPanel: .kpi, .feed); referencia-api-v1.md §3 (G-6, G-7, G-8).
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchActivity, monthIn, monthName,
  type ActivityItem, type ActivityPage, type MonthlyCleared, type OrgIntegrity, type ReadOutcome,
} from '../../lib/api/panelData';
import { activityText } from '../../lib/labels';
import { formatMinorUnits } from '../../lib/money';
import { isSurfaceEnabled } from '../../lib/routing/surfaces';
import { LocalDate } from '../LocalDate';
import { ErrorState, LoadingState } from '../States';
import s from './panelTimeData.module.css';

/** El mes actual de cada moneda y su serie (del más antiguo al actual), en la zona horaria que devuelve el backend. */
export function monthlySummary(data: MonthlyCleared, now: number) {
  const current = monthIn(data.timezone, now);
  const currencies = [...new Set(data.items.map((i) => i.currency))];
  return {
    current,
    rows: currencies.map((currency) => {
      const series = data.items.filter((i) => i.currency === currency).sort((a, b) => (a.month < b.month ? -1 : 1));
      const thisMonth = series.find((i) => i.month === current);
      return { currency, amount: thisMonth?.clearedAmount ?? '0', series: series.map((i) => ({ month: i.month, amount: i.clearedAmount })) };
    }),
  };
}

/** Mini serie en SVG, sin librería. Una serie toda en 0 se dibuja plana (nunca se inventa una forma). */
export function Sparkline({ series, label }: { series: { month: string; amount: string }[]; label: string }) {
  if (series.length < 2) return null;
  const W = 96, H = 28, pad = 3;
  const values = series.map((p) => Number(BigInt(p.amount)));
  const max = Math.max(...values);
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (series.length - 1);
  const y = (v: number) => (max === 0 ? H - pad : H - pad - (v / max) * (H - 2 * pad));
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className={s.spark} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} data-testid="kpi-sparkline">
      <path d={d} className={s.sparkLine} />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2.5" className={s.sparkDot} />
    </svg>
  );
}

export function MonthlyKpi({ data, now, iconClass, icon }: { data: MonthlyCleared; now: number; iconClass: string; icon: React.ReactNode }) {
  const { current, rows } = monthlySummary(data, now);
  const month = monthName(current);
  return (
    <div className={s.kpi} data-testid="kpi-monthly">
      <span className={iconClass}>{icon}</span>
      <span className={s.kpiLabel}>Recaudado en {month}</span>
      <b className={s.kpiValue} data-testid="kpi-monthly-value">
        {rows.length === 0 ? formatMinorUnits('0', 'COP') : rows.map((r) => formatMinorUnits(r.amount, r.currency)).join(' · ')}
      </b>
      <small className={s.kpiSub}>Confirmado en fondos · últimos {Math.max(1, rows[0]?.series.length ?? 6)} meses</small>
      {rows.map((r) => (
        <Sparkline key={r.currency} series={r.series} label={`Recaudado por mes en ${r.currency}, del más antiguo al actual`} />
      ))}
      {data.truncated && <small className={s.warn} data-testid="kpi-monthly-truncated">Incompleto: solo se suman los 10 000 fondos más recientes.</small>}
    </div>
  );
}

export type IntegrityTone = 'ok' | 'pending' | 'review';

export function integritySummary(d: OrgIntegrity): { tone: IntegrityTone; value: string; sub: string } {
  if (d.underReviewEvents > 0) {
    return { tone: 'review', value: 'En revisión', sub: d.underReviewEvents === 1 ? '1 paso en revisión' : `${d.underReviewEvents} pasos en revisión` };
  }
  const waiting = d.unanchoredEvents + d.inPendingBatches;
  if (waiting > 0) {
    return { tone: 'pending', value: 'En proceso', sub: waiting === 1 ? '1 paso espera anclaje' : `${waiting} pasos esperan anclaje` };
  }
  return { tone: 'ok', value: 'Al día', sub: 'Todos los pasos están anclados' };
}

export function IntegrityKpi({ data, iconClass, icon }: { data: OrgIntegrity; iconClass: string; icon: React.ReactNode }) {
  const v = integritySummary(data);
  return (
    <div className={s.kpi} data-testid="kpi-integrity" data-tone={v.tone}>
      <span className={iconClass}>{icon}</span>
      <span className={s.kpiLabel}>Integridad</span>
      <b className={[s.kpiValue, v.tone !== 'ok' ? s.amber : ''].join(' ')}>
        {v.tone !== 'ok' && (
          <svg className={s.warnIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 3l10 18H2zM12 10v5M12 18h.01" /></svg>
        )}
        {v.value}
      </b>
      <small className={s.kpiSub}>{v.sub}</small>
      {data.lastAnchoredAt && <small className={s.kpiSub}>Último anclaje: <LocalDate iso={data.lastAnchoredAt} withTime /></small>}
      {data.truncated && <small className={s.warn} data-testid="kpi-integrity-truncated">Incompleto: se revisan solo 10 000 fondos y 10 000 lotes.</small>}
    </div>
  );
}

/** "Actividad reciente" (G-8): 20 por página, con "Ver más" por el cursor. */
export function ActivityFeed({ organizationId, client = fetchActivity }: {
  organizationId: string;
  client?: (organizationId: string, cursor?: string) => Promise<ReadOutcome<ActivityPage>>;
}) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [truncated, setTruncated] = useState(false);
  const [state, setState] = useState<'loading' | 'more' | 'ready' | 'error' | 'forbidden'>('loading');

  const load = async (from?: string) => {
    setState(from ? 'more' : 'loading');
    const r = await client(organizationId, from).catch(() => ({ kind: 'error' } as const));
    if (r.kind !== 'ok') { setState(r.kind === 'forbidden' ? 'forbidden' : 'error'); return; }
    setItems((prev) => (from ? [...prev, ...r.data.items] : r.data.items));
    setCursor(r.data.nextCursor);
    setTruncated(r.data.truncated);
    setState('ready');
  };
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const assetLink = (i: ActivityItem) => i.subject?.kind === 'ASSET' && isSurfaceEnabled('/assets/:assetRef') ? `/assets/${encodeURIComponent(i.subject.ref)}` : null;

  return (
    <section className={s.feedCard} aria-labelledby="activity-title" data-testid="panel-activity">
      <h2 id="activity-title" className={s.feedTitle}>Actividad reciente</h2>
      <p className={s.sub}>Lo último que quedó registrado.</p>
      {truncated && <p className={s.warn} data-testid="activity-truncated">Se muestra la actividad de los 10 000 fondos y lotes más recientes.</p>}
      {state === 'loading' && <LoadingState />}
      {state === 'forbidden' && <p className={s.sub}>Tu papel no puede ver la actividad de la organización.</p>}
      {state === 'error' && <ErrorState onRetry={() => void load(items.length ? cursor : undefined)} />}
      {state !== 'loading' && items.length === 0 && state === 'ready' && <p className={s.sub}>Todavía no hay actividad.</p>}
      {items.length > 0 && (
        <ol className={s.feed}>
          {items.map((i, n) => {
            const href = assetLink(i);
            const text = activityText(i);
            return (
              <li key={n} data-testid="activity-item" data-type={i.type}>
                <LocalDate iso={i.occurredAt} withTime compact />
                {href ? <Link href={href}>{text}</Link> : <span>{text}</span>}
              </li>
            );
          })}
        </ol>
      )}
      {cursor && state !== 'loading' && state !== 'error' && (
        <button type="button" className={s.more} onClick={() => void load(cursor)} disabled={state === 'more'} aria-busy={state === 'more' || undefined}>
          Ver más
        </button>
      )}
    </section>
  );
}

/** Días completos desde `iso`; `null` si no hay fecha (nunca "hace 0 días"). */
export function daysSince(iso: string | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}
