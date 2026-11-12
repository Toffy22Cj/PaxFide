'use client';
// Ref: paxfide-linea-tiempo2.html (Manuel, 2026-11-12): la carretera con una estación por estado y el camión que avanza
// hasta el estado actual. Horizontal en ancho; vertical en estrecho (por el ancho del contenedor). Solo hechos del
// historial: una estación está alcanzada si su evento ocurrió; el camión va del estado anterior al actual (lo que sí
// pasó, §3.1) y, con un despacho como último evento, queda a medio camino hacia "Recibido".
import React, { useEffect, useState } from 'react';
import type { LogisticsItem, Transition } from '../../lib/api/tracking';
import { eventLabel } from '../../lib/labels';
import { LocalDate } from '../LocalDate';
import { StepIcon, type IconKind } from './StepIcon';
import type { Selection } from './StepDetail';
import s from './road.module.css';

/** Las estaciones de la carretera, en orden. Los demás eventos (división, custodia…) no mueven el camión. */
export const ROAD_STATIONS = ['payment', 'ASSET_REGISTERED', 'ASSET_DISPATCHED', 'ASSET_RECEIVED', 'ASSET_DELIVERED'] as const;
type RoadKey = (typeof ROAD_STATIONS)[number];

export type RoadStation = {
  key: RoadKey;
  label: string;
  reached: boolean;
  at?: string;
  /** El paso del historial que abre el detalle (el último de ese tipo). */
  stepIndex?: number;
  anchor?: Transition['anchorStatus'];
};

/**
 * La carretera de un lote: qué estaciones se alcanzaron y dónde está el camión. `truckAt` es una posición en estaciones
 * (0 = pago); un despacho como último evento lo deja a medio camino (+0,5). -1 sin pago confirmado.
 */
export function roadState(paidAt: string | undefined, steps: readonly Transition[]): { stations: RoadStation[]; current: number; truckAt: number } {
  const lastOf = (type: string) => {
    for (let i = steps.length - 1; i >= 0; i--) if (steps[i].eventType === type) return i;
    return -1;
  };
  // El estado actual es el del último evento de la carretera, no el más avanzado: un lote recibido y despachado de
  // nuevo vuelve a ir en camino
  let current = paidAt ? 0 : -1;
  for (let i = steps.length - 1; i >= 0; i--) {
    const k = (ROAD_STATIONS as readonly string[]).indexOf(steps[i].eventType);
    if (k > 0) { current = k; break; }
  }
  const stations = ROAD_STATIONS.map((key, k): RoadStation => {
    if (key === 'payment') return { key, label: 'Pago confirmado', reached: !!paidAt, at: paidAt };
    const idx = lastOf(key);
    const reached = k <= current && idx >= 0;
    return { key, label: eventLabel(key), reached, at: reached ? steps[idx].timestamp : undefined,
      stepIndex: reached ? idx : undefined, anchor: reached ? steps[idx].anchorStatus : undefined };
  });
  const moving = current >= 0 && ROAD_STATIONS[current] === 'ASSET_DISPATCHED';
  return { stations, current, truckAt: current < 0 ? -0.5 : current + (moving ? 0.5 : 0) };
}

function pillText(current: number, paid: boolean): string {
  if (!paid) return 'Pago sin confirmar';
  if (current === ROAD_STATIONS.length - 1) return 'Entregado';
  if (current === 0) return 'Esperando el lote';
  if (ROAD_STATIONS[current] === 'ASSET_DISPATCHED') return `En camino · ${current + 1} de ${ROAD_STATIONS.length}`;
  return `${current + 1} de ${ROAD_STATIONS.length}`;
}

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function RoadTimeline({ item, title, paidAt, steps, isSelected, onSelect }: {
  /** El lote que recorre la carretera; sin bienes todavía, solo el pago. */
  item?: LogisticsItem;
  title?: string;
  paidAt?: string;
  steps: readonly Transition[];
  isSelected: (sel: Selection) => boolean;
  onSelect: (sel: Selection) => void;
}) {
  const { stations, current, truckAt } = roadState(paidAt, steps);
  const n = ROAD_STATIONS.length;
  // Al cambiar de lote o de estado, el camión sale de la estación anterior y llega a la actual
  const [shown, setShown] = useState(truckAt);
  const [moving, setMoving] = useState(false);
  const key = `${item?.assetRef ?? ''}:${truckAt}`;
  useEffect(() => {
    if (reducedMotion() || truckAt <= 0) { setShown(truckAt); return; }
    // De la estación anterior; si va en camino (x,5), de la estación del despacho
    setShown(Math.max(0, truckAt % 1 === 0 ? truckAt - 1 : truckAt - 0.5));
    const go = window.setTimeout(() => { setShown(truckAt); setMoving(true); }, 350);
    const stop = window.setTimeout(() => setMoving(false), 350 + 1100);
    return () => { window.clearTimeout(go); window.clearTimeout(stop); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const selectionOf = (st: RoadStation): Selection | null => {
    if (!st.reached) return null;
    if (st.key === 'payment') return { kind: 'payment' };
    return item && st.stepIndex !== undefined ? { kind: 'step', assetRef: item.assetRef, index: st.stepIndex } : null;
  };

  return (
    <section className={s.road} aria-labelledby="road-title" data-testid="road-timeline">
      <header className={s.head}>
        <div>
          {title && <p className={s.kicker}>{title.toUpperCase()}</p>}
          <h2 id="road-title" className={s.title}>Recorrido de tu donación</h2>
        </div>
        <span className={s.pill} data-state={!paidAt ? 'wait' : current === n - 1 ? 'done' : 'go'} data-testid="road-pill">
          <i aria-hidden="true" />{pillText(current, !!paidAt)}
        </span>
      </header>

      <div className={s.track} style={{ ['--n' as string]: n, ['--done' as string]: Math.max(0, truckAt), ['--at' as string]: shown } as React.CSSProperties}>
        <div className={s.asphalt} aria-hidden="true" />
        <div className={s.asphaltDone} aria-hidden="true" />
        <ol className={s.stations} aria-label="Estados de la donación">
          {stations.map((st, i) => {
            const sel = selectionOf(st);
            // Una estación anterior a la actual sin su evento (p. ej. recibido sin despacho registrado) queda atrás del
            // camión: se pinta superada, sin fecha y sin detalle
            const state = i === current ? 'now' : st.reached || i < current ? 'done' : 'pending';
            return (
              <li key={st.key} className={s.station} style={{ ['--i' as string]: i } as React.CSSProperties}>
                <button type="button" className={s.stationButton} data-state={state} data-testid="road-station"
                  aria-pressed={sel ? isSelected(sel) : undefined} disabled={!sel} onClick={() => sel && onSelect(sel)}
                  aria-label={`${st.label}: ${state === 'now' ? 'estado actual' : state === 'done' ? (st.reached ? 'completado' : 'superado, sin registro') : 'pendiente'}`}>
                  <span className={s.post} aria-hidden="true">
                    <StepIcon kind={st.key as IconKind} />
                    {st.reached && st.key !== 'payment' && st.anchor !== undefined && (
                      <span className={s.seal} data-status={st.anchor}>
                        <StepIcon kind={st.anchor === 'ANCHORED' ? 'lock' : st.anchor === 'UNDER_REVIEW' ? 'warning' : 'clock'} size={9} />
                      </span>
                    )}
                  </span>
                  <span className={s.pole} aria-hidden="true" />
                  <span className={s.text}>
                    <span className={s.label}>{st.label}</span>
                    <span className={s.date}>{st.at ? <LocalDate iso={st.at} compact /> : ''}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className={s.truck} data-moving={moving ? 'true' : 'false'} data-testid="road-truck" aria-hidden="true">
          <span className={s.puff} /><span className={s.puff} />
          <svg viewBox="0 0 66 42" focusable="false">
            <g className={s.body}>
              <rect x="2" y="8" width="38" height="22" rx="3" className={s.box} />
              <rect x="2" y="8" width="38" height="5" rx="2" className={s.boxTop} />
              <path d="M15 24.5c-3-2-4.2-3.7-3.5-5.2.6-1.2 2-1.1 3.5.4 1.4-1 2.8-.6 3.3.8.6 1.5-.5 2.9-3.3 4z" className={s.heart} />
              <path d="M40 14h12l9 9v7H40z" className={s.cab} />
              <path d="M43 16h8l6 6h-14z" className={s.window} />
              <rect x="0" y="29" width="63" height="3" rx="1.5" className={s.chassis} />
            </g>
            <g className={s.wheel}><circle cx="14" cy="34" r="6" className={s.tyre} /><circle cx="14" cy="34" r="2.2" className={s.hub} /></g>
            <g className={s.wheel}><circle cx="51" cy="34" r="6" className={s.tyre} /><circle cx="51" cy="34" r="2.2" className={s.hub} /></g>
          </svg>
        </div>
      </div>
    </section>
  );
}
