'use client';

// Ref: plan del paso 3 (encargo del 2026-11-15, Tarea B; aprobado por Manuel el 2026-11-16). Componente base de
// gráficos de la web: SVG a mano, sin librerías (ADR-046 D8). Todos los tipos comparten el marco (figura, leyenda,
// `role="img"` con el dato en `aria-label`, tabla equivalente), los ejes y los patrones. Solo dibujan lo que reciben:
// un valor `null` se deja vacío, nunca se interpola ni se rellena.
import React, { useId } from 'react';
import s from './charts.module.css';
import { uiClasses as ui } from '../ui/Layout';
import {
  type CategoryChartData, cumulative, describe, isEmpty, niceMax, percent, seriesColor, seriesPattern, seriesTotals,
  stackTotals, ticks, values,
} from './chartData';

const W = 560, H = 260, R = 16, T = 16, B = 44;

/** Margen izquierdo según la etiqueta más larga del eje (los importes en COP son largos): nunca se corta. */
function leftMargin(top: number, format: (v: number) => string): number {
  const longest = Math.max(...ticks(top).map((v) => format(v).length));
  return Math.min(170, Math.max(40, Math.round(longest * 6.3) + 14));
}

// ---------------------------------------------------------------------------------------------------------------
// Marco común

function patternId(base: string, index: number) {
  return `${base}-p${index}`;
}

/** `fill` de una serie: color liso o patrón (con más series que colores; nunca solo el color distingue dos series). */
function seriesFill(base: string, index: number): string {
  return seriesPattern(index) === 'solid' ? seriesColor(index) : `url(#${patternId(base, index)})`;
}

function Patterns({ base, count }: { base: string; count: number }) {
  return (
    <defs>
      {Array.from({ length: count }, (_, i) => {
        const p = seriesPattern(i);
        if (p === 'solid') return null;
        const c = seriesColor(i);
        return (
          <pattern key={i} id={patternId(base, i)} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="var(--color-surface)" />
            {p === 'hatch' && <path d="M0 6 L6 0" stroke={c} strokeWidth="2" />}
            {p === 'dots' && <circle cx="3" cy="3" r="1.6" fill={c} />}
            {p === 'cross' && <path d="M0 0 L6 6 M6 0 L0 6" stroke={c} strokeWidth="1.2" />}
          </pattern>
        );
      })}
    </defs>
  );
}

/** Forma del marcador de una línea: cambia con la serie, para no depender del color. */
function Marker({ index, x, y, title }: { index: number; x: number; y: number; title: string }) {
  const c = seriesColor(index);
  const shape = index % 4;
  return (
    <g>
      {shape === 0 && <circle cx={x} cy={y} r="4.5" fill={c} stroke="var(--color-surface)" strokeWidth="1.5" />}
      {shape === 1 && <rect x={x - 4} y={y - 4} width="8" height="8" fill={c} stroke="var(--color-surface)" strokeWidth="1.5" />}
      {shape === 2 && <path d={`M${x} ${y - 5} L${x + 5} ${y + 4} L${x - 5} ${y + 4} Z`} fill={c} stroke="var(--color-surface)" strokeWidth="1.5" />}
      {shape === 3 && <path d={`M${x} ${y - 5} L${x + 5} ${y} L${x} ${y + 5} L${x - 5} ${y} Z`} fill={c} stroke="var(--color-surface)" strokeWidth="1.5" />}
      <title>{title}</title>
    </g>
  );
}

export interface LegendItem { label: string; index: number; kind?: 'area' | 'line' }

function Legend({ base, items }: { base: string; items: LegendItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className={s.legend} data-testid="chart-legend">
      {items.map((it) => (
        <li key={`${it.index}-${it.label}`}>
          <svg width="16" height="16" aria-hidden="true">
            {it.kind === 'line'
              ? <><line x1="1" x2="15" y1="8" y2="8" stroke={seriesColor(it.index)} strokeWidth="2" /><Marker index={it.index} x={8} y={8} title="" /></>
              : <rect x="2" y="2" width="12" height="12" fill={seriesFill(base, it.index)} stroke={seriesColor(it.index)} />}
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Tabla con los mismos datos que el gráfico (equivalente accesible y para comprobar las cifras). */
export function DataTable({ data, testId }: { data: CategoryChartData; testId?: string }) {
  return (
    <details className={s.details}>
      <summary>Ver los datos en tabla</summary>
      <div className={ui.tableWrap}>
        <table className={ui.table} data-testid={testId}>
          <thead>
            <tr>
              <th scope="col">{data.unit}</th>
              {data.series.map((sr) => (
                <th scope="col" key={sr.key}>{sr.label}{sr.nature === 'estimate' ? ' (estimación)' : sr.nature === 'fact' ? ' (hecho)' : ''}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.categories.map((c, i) => (
              <tr key={`${c}-${i}`}>
                <th scope="row">{c}</th>
                {data.series.map((sr) => (
                  <td key={sr.key}>{sr.values[i] === null ? 'Sin dato' : data.format(sr.values[i] as number)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function EmptyChart({ testId }: { testId?: string }) {
  return <p className={s.empty} role="status" data-testid={testId ? `${testId}-empty` : 'chart-empty'}>No hay datos para dibujar este gráfico.</p>;
}

interface FrameProps {
  data: CategoryChartData;
  testId: string;
  label: string;
  legend: LegendItem[];
  caption?: string;
  height?: number;
  children: (base: string) => React.ReactNode;
}

function Frame({ data, testId, label, legend, caption, height = H, children }: FrameProps) {
  const base = useId().replace(/:/g, '');
  return (
    <figure className={s.figure} data-testid={testId}>
      <Legend base={base} items={legend} />
      <div className={s.scroll} tabIndex={0} aria-label="Gráfico desplazable horizontalmente">
        <svg viewBox={`0 0 ${W} ${height}`} className={s.svg} role="img" aria-label={label} data-testid={`${testId}-svg`}>
          <Patterns base={base} count={Math.max(data.series.length, data.categories.length)} />
          {children(base)}
        </svg>
      </div>
      {caption && <figcaption className={s.caption}>{caption}</figcaption>}
      <DataTable data={data} testId={`${testId}-table`} />
    </figure>
  );
}

/** Rejilla y eje de valores (vertical). */
function ValueAxis({ top, format, L, height = H }: { top: number; format: (v: number) => string; L: number; height?: number }) {
  const y = (v: number) => T + (1 - v / top) * (height - T - B);
  return (
    <g>
      {ticks(top).map((v) => (
        <g key={v}>
          <line className={s.grid} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text className={s.axis} x={L - 6} y={y(v) + 4} textAnchor="end">{format(v)}</text>
        </g>
      ))}
    </g>
  );
}

/** Etiquetas de categoría del eje horizontal; con muchas, solo algunas para que no se monten. */
function CategoryLabels({ categories, x, height = H }: { categories: string[]; x: (i: number) => number; height?: number }) {
  const every = Math.max(1, Math.ceil(categories.length / 8));
  return (
    <g>
      {categories.map((c, i) => i % every === 0 && (
        <text key={`${c}-${i}`} className={s.axis} x={x(i)} y={height - B + 16} textAnchor="middle">{c}</text>
      ))}
    </g>
  );
}

const plotH = (height: number) => height - T - B;

// ---------------------------------------------------------------------------------------------------------------
// Tipos simples

export interface ChartProps { data: CategoryChartData; testId: string; caption?: string }

/** Barras verticales (agrupadas si hay varias series). */
export function VerticalBars({ data, testId, caption }: ChartProps) {
  if (isEmpty(data)) return <EmptyChart testId={testId} />;
  const top = niceMax(Math.max(...values(data)));
  const L = leftMargin(top, data.format);
  const band = (W - L - R) / data.categories.length;
  const n = data.series.length;
  const bw = Math.max(2, Math.min(28, (band * 0.7) / n));
  const y = (v: number) => T + (1 - v / top) * plotH(H);
  const cx = (i: number) => L + band * (i + 0.5);
  return (
    <Frame data={data} testId={testId} label={describe(data)} caption={caption}
      legend={n > 1 ? data.series.map((sr, i) => ({ label: sr.label, index: i })) : []}>
      {(base) => (
        <>
          <ValueAxis top={top} format={data.format} L={L} />
          {data.series.map((sr, si) => sr.values.map((v, i) => v === null ? null : (
            <rect key={`${si}-${i}`} x={cx(i) - (n * bw) / 2 + si * bw} y={y(v)} width={bw} height={Math.max(0, y(0) - y(v))}
              fill={seriesFill(base, si)} stroke={seriesColor(si)} data-testid={`${testId}-bar`}>
              <title>{`${data.categories[i]} · ${sr.label}: ${data.format(v)}`}</title>
            </rect>
          )))}
          <line className={s.baseline} x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
          <CategoryLabels categories={data.categories} x={cx} />
        </>
      )}
    </Frame>
  );
}

/** Barras horizontales: cada categoría en una fila, con su cifra escrita al final de la barra. */
export function HorizontalBars({ data, testId, caption }: ChartProps) {
  if (isEmpty(data)) return <EmptyChart testId={testId} />;
  const n = data.series.length;
  const row = 14 * n + 14;
  const height = T + data.categories.length * row + 24;
  const left = 150, right = 110;
  const top = niceMax(Math.max(...values(data)));
  const x = (v: number) => left + (v / top) * (W - left - right);
  return (
    <Frame data={data} testId={testId} label={describe(data)} caption={caption} height={height}
      legend={n > 1 ? data.series.map((sr, i) => ({ label: sr.label, index: i })) : []}>
      {(base) => (
        <>
          {data.categories.map((c, i) => (
            <g key={`${c}-${i}`}>
              <text className={s.axisStrong} x={left - 8} y={T + i * row + row / 2 + 4} textAnchor="end">{c}</text>
              {data.series.map((sr, si) => {
                const v = sr.values[i];
                const yy = T + i * row + 7 + si * 14;
                return v === null
                  ? <text key={si} className={s.axis} x={left + 4} y={yy + 9}>Sin dato</text>
                  : (
                    <g key={si}>
                      <rect x={left} y={yy} width={Math.max(1, x(v) - left)} height="11" fill={seriesFill(base, si)} stroke={seriesColor(si)}
                        data-testid={`${testId}-bar`}>
                        <title>{`${c} · ${sr.label}: ${data.format(v)}`}</title>
                      </rect>
                      <text className={s.axis} x={x(v) + 6} y={yy + 9}>{data.format(v)}</text>
                    </g>
                  );
              })}
            </g>
          ))}
          <line className={s.baseline} x1={left} x2={left} y1={T} y2={height - 24} />
        </>
      )}
    </Frame>
  );
}

/** Líneas (o área): un `null` corta la línea; nunca se une un hueco. */
export function LineChart({ data, testId, caption, area = false }: ChartProps & { area?: boolean }) {
  if (isEmpty(data)) return <EmptyChart testId={testId} />;
  const top = niceMax(Math.max(...values(data)));
  const L = leftMargin(top, data.format);
  const n = data.categories.length;
  const cx = (i: number) => (n === 1 ? (L + W - R) / 2 : L + (i / (n - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / top) * plotH(H);
  const segments = (vs: (number | null)[]) => {
    const out: { i: number; v: number }[][] = [];
    let cur: { i: number; v: number }[] = [];
    vs.forEach((v, i) => {
      if (v === null) { if (cur.length) out.push(cur); cur = []; } else cur.push({ i, v });
    });
    if (cur.length) out.push(cur);
    return out;
  };
  return (
    <Frame data={data} testId={testId} label={describe(data)} caption={caption}
      legend={data.series.map((sr, i) => ({ label: sr.label, index: i, kind: area ? 'area' : 'line' }))}>
      {(base) => (
        <>
          <ValueAxis top={top} format={data.format} L={L} />
          {data.series.map((sr, si) => segments(sr.values).map((seg, k) => (
            <g key={`${si}-${k}`}>
              {area && seg.length > 1 && (
                <path d={`M${cx(seg[0].i)} ${y(0)} ${seg.map((p) => `L${cx(p.i)} ${y(p.v)}`).join(' ')} L${cx(seg[seg.length - 1].i)} ${y(0)} Z`}
                  fill={seriesFill(base, si)} fillOpacity={seriesPattern(si) === 'solid' ? 0.25 : 1} data-testid={`${testId}-area`} />
              )}
              {seg.length > 1 && (
                <path d={seg.map((p, j) => `${j ? 'L' : 'M'}${cx(p.i)} ${y(p.v)}`).join(' ')} fill="none" stroke={seriesColor(si)} strokeWidth="2"
                  data-testid={`${testId}-line`} />
              )}
              {seg.map((p) => <Marker key={p.i} index={si} x={cx(p.i)} y={y(p.v)} title={`${data.categories[p.i]} · ${sr.label}: ${data.format(p.v)}`} />)}
            </g>
          )))}
          <line className={s.baseline} x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
          <CategoryLabels categories={data.categories} x={cx} />
        </>
      )}
    </Frame>
  );
}

/** Dona: las categorías son las porciones (de la primera serie); en el centro, el total. */
export function Donut({ data, testId, caption }: ChartProps) {
  if (isEmpty(data)) return <EmptyChart testId={testId} />;
  const vals = data.series[0].values.map((v) => v ?? 0);
  const total = vals.reduce((a, b) => a + b, 0);
  if (total <= 0) return <EmptyChart testId={testId} />;
  const cx = W / 2, cy = H / 2, r = 90, inner = 54;
  let angle = -Math.PI / 2;
  const arcs = vals.map((v, i) => {
    const start = angle;
    angle += (v / total) * Math.PI * 2;
    return { i, v, start, end: angle };
  });
  const point = (a: number, rad: number) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
  const label = `${data.series[0].label}. Total ${data.format(total)}. ${data.categories.map((c, i) =>
    `${c}: ${data.format(vals[i])} (${percent(vals[i] / total)})`).join('; ')}`;
  return (
    <Frame data={data} testId={testId} label={label} caption={caption}
      legend={data.categories.map((c, i) => ({ label: `${c}: ${data.format(vals[i])} (${percent(vals[i] / total)})`, index: i }))}>
      {(base) => (
        <>
          {arcs.filter((a) => a.v > 0).map((a) => {
            const full = a.end - a.start >= Math.PI * 2 - 1e-9;
            const large = a.end - a.start > Math.PI ? 1 : 0;
            const d = full
              ? `M${point(0, r)} A${r} ${r} 0 1 1 ${point(Math.PI, r)} A${r} ${r} 0 1 1 ${point(0, r)} M${point(0, inner)} A${inner} ${inner} 0 1 0 ${point(Math.PI, inner)} A${inner} ${inner} 0 1 0 ${point(0, inner)} Z`
              : `M${point(a.start, r)} A${r} ${r} 0 ${large} 1 ${point(a.end, r)} L${point(a.end, inner)} A${inner} ${inner} 0 ${large} 0 ${point(a.start, inner)} Z`;
            return (
              <path key={a.i} d={d} fill={seriesFill(base, a.i)} stroke="var(--color-surface)" strokeWidth="2" fillRule="evenodd"
                data-testid={`${testId}-slice`}>
                <title>{`${data.categories[a.i]}: ${data.format(a.v)} (${percent(a.v / total)})`}</title>
              </path>
            );
          })}
          <text className={s.axisStrong} x={cx} y={cy + 4} textAnchor="middle">{data.format(total)}</text>
        </>
      )}
    </Frame>
  );
}

/** Tarjetas KPI: cifras sueltas, sin eje. */
export function KpiTiles({ tiles, testId, caption }: { tiles: { label: string; value: string }[]; testId: string; caption?: string }) {
  if (tiles.length === 0) return <EmptyChart testId={testId} />;
  return (
    <figure className={s.figure} data-testid={testId}>
      <div className={s.tiles}>
        {tiles.map((t) => (
          <div className={s.tile} key={t.label} data-testid={`${testId}-tile`}>
            <p className={s.tileLabel}>{t.label}</p>
            <p className={s.tileValue}>{t.value}</p>
          </div>
        ))}
      </div>
      {caption && <figcaption className={s.caption}>{caption}</figcaption>}
    </figure>
  );
}

/** Barra de progreso: una parte sobre un total, con el porcentaje escrito. */
export function Progress({ label, part, total, format, testId, caption }: {
  label: string; part: number; total: number; format: (v: number) => string; testId: string; caption?: string;
}) {
  if (!(total > 0)) return <EmptyChart testId={testId} />;
  const f = Math.max(0, Math.min(1, part / total));
  const text = `${label}: ${format(part)} de ${format(total)} (${percent(f)})`;
  return (
    <figure className={s.figure} data-testid={testId}>
      <p className={s.tileLabel}>{label}</p>
      <p className={s.tileValue}>{percent(f)}</p>
      <svg viewBox="0 0 200 20" className={s.svg} style={{ minWidth: 0 }} role="img" aria-label={text} data-testid={`${testId}-svg`}>
        <rect x="0" y="4" width="200" height="12" rx="6" fill="var(--color-divider)" />
        <rect x="0" y="4" width={200 * f} height="12" rx="6" fill="var(--color-text)" />
      </svg>
      <figcaption className={s.caption}>{format(part)} de {format(total)}{caption ? `. ${caption}` : ''}</figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Tipos avanzados

/** Barras apiladas: cada categoría es una barra; cada serie, un tramo. El total se escribe encima. */
export function StackedBars({ data, testId, caption }: ChartProps) {
  if (isEmpty(data)) return <EmptyChart testId={testId} />;
  const totals = stackTotals(data);
  const top = niceMax(Math.max(...totals.filter((v): v is number => v !== null)));
  const L = leftMargin(top, data.format);
  const band = (W - L - R) / data.categories.length;
  const bw = Math.max(4, Math.min(48, band * 0.6));
  const y = (v: number) => T + (1 - v / top) * plotH(H);
  const cx = (i: number) => L + band * (i + 0.5);
  const label = `${describe(data)}. Totales: ${data.categories.map((c, i) => `${c} ${totals[i] === null ? 'sin dato' : data.format(totals[i] as number)}`).join(', ')}`;
  return (
    <Frame data={data} testId={testId} label={label} caption={caption}
      legend={data.series.map((sr, i) => ({ label: sr.label, index: i }))}>
      {(base) => (
        <>
          <ValueAxis top={top} format={data.format} L={L} />
          {data.categories.map((c, i) => {
            let acc = 0;
            return (
              <g key={`${c}-${i}`}>
                {data.series.map((sr, si) => {
                  const v = sr.values[i];
                  if (v === null || v <= 0) return null;
                  const y0 = y(acc), y1 = y(acc + v);
                  acc += v;
                  return (
                    <rect key={si} x={cx(i) - bw / 2} y={y1} width={bw} height={Math.max(0, y0 - y1)} fill={seriesFill(base, si)}
                      stroke="var(--color-surface)" data-testid={`${testId}-segment`}>
                      <title>{`${c} · ${sr.label}: ${data.format(v)}`}</title>
                    </rect>
                  );
                })}
                {totals[i] !== null && band >= data.format(totals[i] as number).length * 6.3 + 4 && <text className={s.axis} x={cx(i)} y={y(totals[i] as number) - 4} textAnchor="middle">{data.format(totals[i] as number)}</text>}
              </g>
            );
          })}
          <line className={s.baseline} x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
          <CategoryLabels categories={data.categories} x={cx} />
        </>
      )}
    </Frame>
  );
}

/**
 * Combinado: la primera serie en barras y la segunda en línea, sobre el mismo eje (la misma unidad). Con
 * `cumulativeLine`, la línea es el acumulado de la primera serie (calculado aquí, y así se dice en la leyenda).
 */
export function ComboBarsLine({ data, testId, caption, cumulativeLine = false, lineLabel }: ChartProps & {
  cumulativeLine?: boolean; lineLabel?: string;
}) {
  const bars = data.series[0];
  const line = cumulativeLine
    ? { key: 'acumulado', label: lineLabel ?? `${bars?.label ?? ''} acumulado`, values: cumulative(bars?.values ?? []), nature: bars?.nature }
    : data.series[1];
  const merged: CategoryChartData = { ...data, series: [bars, line].filter(Boolean) as CategoryChartData['series'] };
  if (!bars || isEmpty(merged)) return <EmptyChart testId={testId} />;
  const top = niceMax(Math.max(...values(merged)));
  const L = leftMargin(top, data.format);
  const band = (W - L - R) / data.categories.length;
  const bw = Math.max(3, Math.min(32, band * 0.6));
  const y = (v: number) => T + (1 - v / top) * plotH(H);
  const cx = (i: number) => L + band * (i + 0.5);
  const pts = line ? line.values.map((v, i) => (v === null ? null : { i, v })).filter((p): p is { i: number; v: number } => p !== null) : [];
  return (
    <Frame data={merged} testId={testId} label={describe(merged)} caption={caption}
      legend={[{ label: bars.label, index: 0 }, ...(line ? [{ label: line.label, index: 1, kind: 'line' as const }] : [])]}>
      {(base) => (
        <>
          <ValueAxis top={top} format={data.format} L={L} />
          {bars.values.map((v, i) => v === null ? null : (
            <rect key={i} x={cx(i) - bw / 2} y={y(v)} width={bw} height={Math.max(0, y(0) - y(v))} fill={seriesFill(base, 0)}
              stroke={seriesColor(0)} data-testid={`${testId}-bar`}>
              <title>{`${data.categories[i]} · ${bars.label}: ${data.format(v)}`}</title>
            </rect>
          ))}
          {/* La línea solo une valores consecutivos: un hueco (`null`) la corta, nunca se cruza */}
          {pts.map((p, j) => (j > 0 && pts[j - 1].i === p.i - 1 ? (
            <line key={`l${p.i}`} x1={cx(pts[j - 1].i)} y1={y(pts[j - 1].v)} x2={cx(p.i)} y2={y(p.v)} stroke={seriesColor(1)} strokeWidth="2"
              data-testid={`${testId}-line`} />
          ) : null))}
          {line && pts.map((p) => <Marker key={p.i} index={1} x={cx(p.i)} y={y(p.v)} title={`${data.categories[p.i]} · ${line.label}: ${data.format(p.v)}`} />)}
          <line className={s.baseline} x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
          <CategoryLabels categories={data.categories} x={cx} />
        </>
      )}
    </Frame>
  );
}

/** Suma total de una serie: para los KPI de los paneles. */
export const totalOf = (data: CategoryChartData, index = 0) => seriesTotals(data)[index] ?? 0;
