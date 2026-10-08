import React from 'react';
import s from './prediction.module.css';
import { uiClasses as ui } from '../ui/Layout';
import type { PredictionCut, PredictionView } from '../../lib/api/prediction';
import { LocalDate } from '../LocalDate';

const pct = (x: number) => `${Math.round(x)} %`;
const GREEN = 'var(--brand-green-900)';
const BLUE = 'var(--brand-blue-700)';
/** Cortes con los que se entrenó el modelo (aviso del backend: 15 %, 25 % y 50 % del tiempo). */
const TRAINED_CUTS = [0.15, 0.25, 0.5];

/** Gráfico básico: probabilidad de alcanzar la meta y % final estimado. */
export function BasicPredictionChart({ view }: { view: PredictionView }) {
  const prob = Math.max(0, Math.min(1, view.probability)) * 100;
  const fin = Math.max(0, view.estimatedFinal * 100);
  const finBar = Math.min(fin, 200);
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
            <rect x="0" y="6" width={finBar} height="12" rx="6" fill={BLUE} />
            <line x1="100" x2="100" y1="0" y2="24" stroke={GREEN} strokeWidth="2" />
          </svg>
          <p className={s.tileLabel}>La línea marca la meta (100 %). Escala hasta 200 %.</p>
        </div>
      </div>
      <figcaption className={ui.hint}>Calculada con el {pct(view.pctTimeElapsed * 100)} del tiempo de la convocatoria transcurrido.</figcaption>
    </figure>
  );
}

/**
 * Gráfico avanzado: dónde está la convocatoria hoy (recaudado, hecho verificable) frente al final que estima el modelo,
 * sobre el tiempo de la convocatoria, con los cortes de entrenamiento marcados. El backend da una sola estimación (D-03):
 * no se dibuja ninguna trayectoria entre los dos puntos para no inventarla. Un solo eje (% de la meta).
 */
export function AdvancedPredictionChart({ view, observedFraction }: { view: PredictionView; observedFraction?: number }) {
  const W = 560, H = 280, L = 44, R = 64, T = 16, B = 40;
  const observed = observedFraction === undefined ? undefined : observedFraction * 100;
  const estimate = view.estimatedFinal * 100;
  const top = Math.max(150, Math.ceil(Math.max(estimate, observed ?? 0) / 50) * 50);
  const x = (t: number) => L + t * (W - L - R);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const ticks = Array.from({ length: top / 50 + 1 }, (_, i) => i * 50);
  const t = Math.max(0, Math.min(1, view.pctTimeElapsed));

  return (
    <figure style={{ margin: 0 }}>
      <ul className={s.legend}>
        {observed !== undefined && (
          <li><svg width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill={GREEN} /></svg>Recaudado hoy (hecho)</li>
        )}
        <li><svg width="16" height="16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" fill={BLUE} /></svg>Final estimado (estimación)</li>
        <li><svg width="16" height="16" aria-hidden="true"><line x1="8" x2="8" y1="1" y2="15" stroke="var(--brand-neutral-700)" strokeDasharray="2 2" /></svg>Cortes de entrenamiento</li>
      </ul>
      <div className={s.scroll} tabIndex={0} aria-label="Gráfico desplazable horizontalmente">
        <svg viewBox={`0 0 ${W} ${H}`} className={[s.chart, s.wideChart].join(' ')} role="img" data-testid="advanced-chart"
          aria-label={`Hoy (${pct(t * 100)} del tiempo)${observed !== undefined ? `: recaudado ${pct(observed)} de la meta` : ''}; final estimado ${pct(estimate)}`}>
          {ticks.map((v) => (
            <g key={v}>
              <line className={s.grid} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
              <text className={s.axis} x={L - 6} y={y(v) + 4} textAnchor="end">{v} %</text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={y(100)} y2={y(100)} stroke={GREEN} strokeWidth="1" strokeDasharray="2 3" />
          <text className={s.axis} x={W - R + 4} y={y(100) + 4}>Meta</text>
          {TRAINED_CUTS.map((c) => (
            <line key={c} x1={x(c)} x2={x(c)} y1={T} y2={H - B} stroke="var(--brand-neutral-700)" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
          ))}
          {[0, 0.15, 0.25, 0.5, 1].map((c) => (
            <text key={c} className={s.axis} x={x(c)} y={H - B + 16} textAnchor="middle">{Math.round(c * 100)} %</text>
          ))}
          <text className={s.axis} x={(L + W - R) / 2} y={H - 6} textAnchor="middle">Tiempo transcurrido de la convocatoria</text>
          <line x1={x(t)} x2={x(t)} y1={T} y2={H - B} stroke={GREEN} strokeWidth="1.5" />
          <text className={s.axis} x={x(t) + 4} y={T + 10}>Hoy</text>
          {observed !== undefined && (
            <circle cx={x(t)} cy={y(observed)} r="6" fill={GREEN} stroke="#FFFFFF" strokeWidth="2">
              <title>{`Hoy: recaudado ${pct(observed)} de la meta`}</title>
            </circle>
          )}
          <rect x={x(1) - 6} y={y(estimate) - 6} width="12" height="12" fill={BLUE} stroke="#FFFFFF" strokeWidth="2">
            <title>{`Final estimado: ${pct(estimate)} de la meta`}</title>
          </rect>
          <text className={s.axis} x={x(1) + 10} y={y(estimate) + 4}>{pct(estimate)}</text>
        </svg>
      </div>
      <details className={s.details}>
        <summary>Ver los datos en tabla</summary>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead><tr><th scope="col">Dato</th><th scope="col">Valor</th><th scope="col">Tipo</th></tr></thead>
            <tbody>
              <tr><td>Tiempo transcurrido</td><td>{pct(t * 100)}</td><td>Hecho</td></tr>
              {observed !== undefined && <tr><td>Recaudado hoy</td><td>{pct(observed)} de la meta</td><td>Hecho</td></tr>}
              <tr><td>Final estimado</td><td>{pct(estimate)} de la meta</td><td>Estimación</td></tr>
              <tr><td>Probabilidad de alcanzar la meta</td><td>{pct(view.probability * 100)}</td><td>Estimación</td></tr>
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/**
 * Evolución en los cortes de entrenamiento (S-17): para cada corte (15 %, 25 % y 50 % del tiempo), lo recaudado en
 * ese momento (hecho reconstruido del Event Store) y el final que el modelo estimaba entonces (estimación). Un corte sin
 * cifra se dibuja vacío, con una marca "Sin cifra" y el texto del backend en la tabla; nunca se rellena ni se interpola.
 * No se unen los puntos con líneas para no sugerir una trayectoria que el backend no da.
 */
export function PredictionHistoryChart({ cuts }: { cuts: PredictionCut[] }) {
  const W = 560, H = 280, L = 44, R = 24, T = 16, B = 40;
  const values = cuts.flatMap((c) => [c.raisedAtCut, c.estimatedFinal]).filter((v): v is number => v !== undefined).map((v) => v * 100);
  const top = Math.max(150, Math.ceil(Math.max(0, ...values) / 50) * 50);
  // Eje X: solo el tramo de los cortes (0 a 60 % del tiempo), para que se distingan
  const span = 0.6;
  const x = (t: number) => L + (t / span) * (W - L - R);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const ticks = Array.from({ length: top / 50 + 1 }, (_, i) => i * 50);
  const label = cuts.map((c) => `Corte ${pct(c.t * 100)}: ${c.available
    ? `recaudado ${c.raisedAtCut !== undefined ? pct(c.raisedAtCut * 100) : 'sin dato'}, final estimado ${pct((c.estimatedFinal ?? 0) * 100)}, probabilidad ${pct((c.probability ?? 0) * 100)}`
    : `sin cifra${c.raisedAtCut !== undefined ? ` (recaudado ${pct(c.raisedAtCut * 100)})` : ''}`}`).join('; ');

  return (
    <figure style={{ margin: 0 }} data-testid="prediction-history">
      <ul className={s.legend}>
        <li><svg width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5" fill={GREEN} /></svg>Recaudado en el corte (hecho)</li>
        <li><svg width="16" height="16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" fill={BLUE} /></svg>Final estimado en el corte (estimación)</li>
        <li><svg width="16" height="16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" fill="none" stroke="var(--brand-neutral-700)" strokeDasharray="2 2" /></svg>Corte sin cifra</li>
      </ul>
      <div className={s.scroll} tabIndex={0} aria-label="Gráfico desplazable horizontalmente">
        <svg viewBox={`0 0 ${W} ${H}`} className={[s.chart, s.wideChart].join(' ')} role="img" data-testid="history-chart" aria-label={label}>
          {ticks.map((v) => (
            <g key={v}>
              <line className={s.grid} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
              <text className={s.axis} x={L - 6} y={y(v) + 4} textAnchor="end">{v} %</text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={y(100)} y2={y(100)} stroke={GREEN} strokeWidth="1" strokeDasharray="2 3" />
          <text className={s.axis} x={W - R - 2} y={y(100) - 4} textAnchor="end">Meta</text>
          {cuts.map((c) => (
            <g key={c.t} data-testid={`history-cut-${Math.round(c.t * 100)}`} data-available={c.available ? 'true' : 'false'}>
              <line x1={x(c.t)} x2={x(c.t)} y1={T} y2={H - B} stroke="var(--brand-neutral-700)" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
              <text className={s.axis} x={x(c.t)} y={H - B + 16} textAnchor="middle">{pct(c.t * 100)}</text>
              {c.raisedAtCut !== undefined && (
                <circle cx={x(c.t) - 8} cy={y(c.raisedAtCut * 100)} r="6" fill={GREEN} stroke="#FFFFFF" strokeWidth="2">
                  <title>{`Corte ${pct(c.t * 100)}: recaudado ${pct(c.raisedAtCut * 100)} de la meta`}</title>
                </circle>
              )}
              {c.available && c.estimatedFinal !== undefined ? (
                <rect x={x(c.t) + 2} y={y(c.estimatedFinal * 100) - 6} width="12" height="12" fill={BLUE} stroke="#FFFFFF" strokeWidth="2">
                  <title>{`Corte ${pct(c.t * 100)}: final estimado ${pct(c.estimatedFinal * 100)} de la meta`}</title>
                </rect>
              ) : (
                <g>
                  <rect x={x(c.t) - 28} y={T + 20} width="56" height="22" fill="var(--white)" stroke="var(--brand-neutral-700)" strokeDasharray="2 2" />
                  <text className={s.axis} x={x(c.t)} y={T + 35} textAnchor="middle">Sin cifra</text>
                </g>
              )}
            </g>
          ))}
          <text className={s.axis} x={(L + W - R) / 2} y={H - 6} textAnchor="middle">Tiempo transcurrido de la convocatoria (corte)</text>
        </svg>
      </div>
      <div className={ui.tableWrap}>
        <table className={ui.table} data-testid="history-table">
          <caption className={ui.hint} style={{ textAlign: 'left' }}>Estimaciones calculadas en cada corte con lo recaudado hasta ese momento</caption>
          <thead>
            <tr>
              <th scope="col">Corte</th><th scope="col">Fecha del corte</th><th scope="col">Recaudado (hecho)</th>
              <th scope="col">Final estimado (estimación)</th><th scope="col">Probabilidad (estimación)</th>
            </tr>
          </thead>
          <tbody>
            {cuts.map((c) => (
              <tr key={c.t}>
                <th scope="row">{pct(c.t * 100)} del tiempo</th>
                <td>{c.cutAt ? <LocalDate iso={c.cutAt} /> : '—'}</td>
                <td>{c.raisedAtCut !== undefined ? `${pct(c.raisedAtCut * 100)} de la meta` : '—'}</td>
                {c.available
                  ? <><td>{pct((c.estimatedFinal ?? 0) * 100)} de la meta</td><td>{pct((c.probability ?? 0) * 100)}</td></>
                  : <td colSpan={2}>Sin cifra: {c.reason}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
