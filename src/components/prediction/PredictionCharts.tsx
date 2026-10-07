import React from 'react';
import s from './prediction.module.css';
import { uiClasses as ui } from '../ui/Layout';

/**
 * Vista que consumen los gráficos. **No es un contrato del backend** (todavía no existe: S-06); el adaptador del
 * endpoint, cuando exista, traducirá su respuesta a esta forma. Probabilidades en [0, 1]; porcentajes de la meta.
 */
export interface PredictionCheckpoint {
  /** Fracción del tiempo de la convocatoria (0.15, 0.25, 0.50). */
  t: number;
  /** Probabilidad estimada de alcanzar la meta. */
  probability: number;
  /** Porcentaje final de la meta estimado. */
  estimatedFinalPercent: number;
  /** Porcentaje de la meta recaudado (hecho verificable) en ese corte. */
  observedPercent: number;
}

const pct = (x: number) => `${Math.round(x)} %`;
const GREEN = 'var(--brand-green-900)';
const BLUE = 'var(--brand-blue-700)';

/** Gráfico básico: probabilidad de alcanzar la meta y % final estimado, en el último corte disponible. */
export function BasicPredictionChart({ latest }: { latest: PredictionCheckpoint }) {
  const prob = Math.max(0, Math.min(1, latest.probability)) * 100;
  const fin = Math.max(0, latest.estimatedFinalPercent);
  const finBar = Math.min(fin, 200) / 2;
  return (
    <figure style={{ margin: 0 }} aria-label="Gráfico básico de la estimación">
      <div className={s.tiles}>
        <div className={s.tile} data-testid="basic-probability">
          <p className={s.tileLabel}>Probabilidad estimada de alcanzar la meta</p>
          <p className={s.tileValue}>{pct(prob)}</p>
          <div className={s.meter} role="img" aria-label={`Probabilidad estimada: ${pct(prob)}`}>
            <div className={s.meterFill} style={{ width: `${prob}%` }} />
          </div>
        </div>
        <div className={s.tile} data-testid="basic-final">
          <p className={s.tileLabel}>Porcentaje final de la meta estimado</p>
          <p className={s.tileValue}>{pct(fin)}</p>
          <svg viewBox="0 0 200 24" className={s.chart} role="img" aria-label={`Final estimado: ${pct(fin)} de la meta`}>
            <rect x="0" y="6" width="200" height="12" rx="6" fill="var(--neutral-200)" />
            <rect x="0" y="6" width={finBar * 2} height="12" rx="6" fill={BLUE} />
            {/* Meta (100 %) a la mitad de la escala 0–200 % */}
            <line x1="100" x2="100" y1="0" y2="24" stroke={GREEN} strokeWidth="2" />
          </svg>
          <p className={s.tileLabel}>La línea marca la meta (100 %). Escala hasta 200 %.</p>
        </div>
      </div>
      <figcaption className={ui.hint}>Corte: {pct(latest.t * 100)} del tiempo de la convocatoria.</figcaption>
    </figure>
  );
}

/**
 * Gráfico avanzado: evolución del % final estimado en cada corte frente al % recaudado observado. Un solo eje
 * (porcentaje de la meta). Observado: línea continua con círculos; estimado: línea discontinua con cuadrados.
 */
export function AdvancedPredictionChart({ checkpoints }: { checkpoints: PredictionCheckpoint[] }) {
  const W = 560, H = 280, L = 44, R = 64, T = 16, B = 40;
  const pts = [...checkpoints].sort((a, b) => a.t - b.t);
  const maxY = Math.max(120, ...pts.map((p) => Math.max(p.estimatedFinalPercent, p.observedPercent))) ;
  const top = Math.ceil(maxY / 50) * 50;
  const x = (t: number) => L + t * (W - L - R);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const line = (key: 'estimatedFinalPercent' | 'observedPercent') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t)} ${y(p[key])}`).join(' ');
  const ticks = Array.from({ length: top / 50 + 1 }, (_, i) => i * 50);
  const last = pts[pts.length - 1];

  return (
    <figure style={{ margin: 0 }}>
      <ul className={s.legend}>
        <li><svg width="28" height="10" aria-hidden="true"><line x1="0" x2="28" y1="5" y2="5" stroke={GREEN} strokeWidth="2" /><circle cx="14" cy="5" r="4" fill={GREEN} /></svg>Recaudado (hecho)</li>
        <li><svg width="28" height="10" aria-hidden="true"><line x1="0" x2="28" y1="5" y2="5" stroke={BLUE} strokeWidth="2" strokeDasharray="5 3" /><rect x="10" y="1" width="8" height="8" fill={BLUE} /></svg>Final estimado (estimación)</li>
      </ul>
      <div className={s.scroll} tabIndex={0} aria-label="Gráfico desplazable horizontalmente">
      <svg viewBox={`0 0 ${W} ${H}`} className={[s.chart, s.wideChart].join(' ')} role="img"
        aria-label="Evolución del porcentaje final estimado frente al recaudado en cada corte" data-testid="advanced-chart">
        {ticks.map((v) => (
          <g key={v}>
            <line className={s.grid} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className={s.axis} x={L - 6} y={y(v) + 4} textAnchor="end">{v} %</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(100)} y2={y(100)} stroke={GREEN} strokeWidth="1" strokeDasharray="2 3" />
        <text className={s.axis} x={W - R + 4} y={y(100) + 4}>Meta</text>
        {[0, 0.15, 0.25, 0.5, 1].map((t) => (
          <text key={t} className={s.axis} x={x(t)} y={H - B + 16} textAnchor="middle">{Math.round(t * 100)} %</text>
        ))}
        <text className={s.axis} x={(L + W - R) / 2} y={H - 6} textAnchor="middle">Tiempo transcurrido de la convocatoria</text>
        <path d={line('observedPercent')} fill="none" stroke={GREEN} strokeWidth="2" />
        <path d={line('estimatedFinalPercent')} fill="none" stroke={BLUE} strokeWidth="2" strokeDasharray="6 4" />
        {pts.map((p) => (
          <g key={p.t}>
            <circle cx={x(p.t)} cy={y(p.observedPercent)} r="5" fill={GREEN} stroke="#FFFFFF" strokeWidth="2">
              <title>{`t = ${pct(p.t * 100)} · recaudado ${pct(p.observedPercent)}`}</title>
            </circle>
            <rect x={x(p.t) - 5} y={y(p.estimatedFinalPercent) - 5} width="10" height="10" fill={BLUE} stroke="#FFFFFF" strokeWidth="2">
              <title>{`t = ${pct(p.t * 100)} · final estimado ${pct(p.estimatedFinalPercent)} · probabilidad ${pct(p.probability * 100)}`}</title>
            </rect>
          </g>
        ))}
        {last && <text className={s.axis} x={x(last.t) + 10} y={y(last.estimatedFinalPercent) + 4}>{pct(last.estimatedFinalPercent)}</text>}
      </svg>
      </div>
      <details className={s.details}>
        <summary>Ver los datos en tabla</summary>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead><tr><th scope="col">Corte</th><th scope="col">Recaudado (hecho)</th><th scope="col">Final estimado</th><th scope="col">Probabilidad estimada</th></tr></thead>
            <tbody>{pts.map((p) => (
              <tr key={p.t}><td>{pct(p.t * 100)}</td><td>{pct(p.observedPercent)}</td><td>{pct(p.estimatedFinalPercent)}</td><td>{pct(p.probability * 100)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
