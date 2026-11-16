// Ref: plan del paso 3 (encargo del 2026-11-15, Tarea B; aprobado por Manuel el 2026-11-16). Modelo de datos común a
// todos los gráficos: categorías en el eje (meses, estados, tipos…) y series con un valor por categoría. Solo lógica
// pura: ningún gráfico inventa, interpola ni rellena datos; un valor ausente es `null` y se dibuja vacío.

/** Cómo se distingue una serie además del color (accesibilidad: la leyenda nunca depende solo del color). */
export type SeriesPattern = 'solid' | 'hatch' | 'dots' | 'cross';

export interface ChartSeries {
  key: string;
  label: string;
  /** Un valor por categoría; `null` = sin dato (nunca se dibuja como cero). */
  values: (number | null)[];
  /** `fact` = hecho registrado; `estimate` = estimación del modelo. Se dice en la leyenda y en la tabla. */
  nature?: 'fact' | 'estimate';
}

export interface CategoryChartData {
  categories: string[];
  series: ChartSeries[];
  /** Texto de un valor ("1.234.567 COP", "12 lotes"…), para ejes, tooltips, tabla y `aria-label`. */
  format: (value: number) => string;
  /** Unidad del eje de valores, dicha en el pie y en la tabla. */
  unit: string;
}

/** Colores de las series: solo la capa semántica (legible en claro y en oscuro; el test de tokens lo exige). */
export const SERIES_COLORS = [
  'var(--color-text)',
  'var(--color-link)',
  'var(--color-ambiguous-title)',
  'var(--color-text-secondary)',
  'var(--color-danger-text)',
] as const;

const PATTERNS: SeriesPattern[] = ['solid', 'hatch', 'dots', 'cross'];

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

/** Con más series que colores, el patrón cambia: dos series nunca se parecen solo por el color. */
export function seriesPattern(index: number): SeriesPattern {
  return PATTERNS[Math.floor(index / SERIES_COLORS.length) % PATTERNS.length];
}

/** Máximo "redondo" del eje (1, 2, 2,5, 5 × 10^n) que contiene a `max`; 1 si no hay valores positivos. */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * exp >= max) return step * exp;
  }
  return 10 * exp;
}

/** Marcas del eje de valores: de 0 a `top` en `n` tramos. */
export function ticks(top: number, n = 4): number[] {
  return Array.from({ length: n + 1 }, (_, i) => (top * i) / n);
}

export function values(data: CategoryChartData): number[] {
  return data.series.flatMap((s) => s.values).filter((v): v is number => v !== null && Number.isFinite(v));
}

export function isEmpty(data: CategoryChartData): boolean {
  return data.categories.length === 0 || values(data).length === 0;
}

/** Suma por categoría de todas las series (para barras apiladas); `null` si ninguna serie tiene dato. */
export function stackTotals(data: CategoryChartData): (number | null)[] {
  return data.categories.map((_, i) => {
    const vs = data.series.map((s) => s.values[i]).filter((v): v is number => v !== null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
  });
}

/** Suma de cada serie (para la dona y el KPI). */
export function seriesTotals(data: CategoryChartData): number[] {
  return data.series.map((s) => s.values.reduce<number>((a, v) => a + (v ?? 0), 0));
}

/** Acumulado de una serie (para la línea del combinado): sigue `null` mientras no hay datos. */
export function cumulative(series: (number | null)[]): (number | null)[] {
  let acc: number | null = null;
  return series.map((v) => {
    if (v !== null) acc = (acc ?? 0) + v;
    return acc;
  });
}

/** Resumen en una frase de todos los valores, para el `aria-label` del gráfico. */
export function describe(data: CategoryChartData): string {
  if (isEmpty(data)) return 'Sin datos para dibujar';
  return data.series.map((s) => `${s.label}: ${data.categories.map((c, i) =>
    `${c} ${s.values[i] === null ? 'sin dato' : data.format(s.values[i] as number)}`).join(', ')}`).join('. ');
}

export const percent = (fraction: number) => `${Math.round(fraction * 100)} %`;
