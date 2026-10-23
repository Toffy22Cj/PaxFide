'use client';
// Ref: plan-fase7-pantallas.md A-4 (un carril por activo de logistics[], lista plana: G-4 ⛔); prompts-agentes-estilo-v2.md
// §3.1 (pasos con eventType, timestamp, locationZone o "sin zona pública", custodianLabel(); camión solo si el último
// evento es ASSET_DISPATCHED). Sin hash ni sello por paso (G-3), sin nombres de lote ni destinatarios.
import React from 'react';
import type { LogisticsItem, TrackingOutcome, Transition } from '../../lib/api/tracking';
import { custodianLabel, eventLabel, lifecycleLabel } from '../../lib/labels';
import { formatQuantity } from '../../lib/quantity';
import { LocalDate } from '../LocalDate';
import { TruckLoader } from '../loaders';
import { ErrorState, LoadingState } from '../States';
import { NO_PUBLIC_ZONE, asTrackingEvent, showsTruck, stepKind } from './events';
import s from './tracking.module.css';

export type HistoryState = TrackingOutcome<Transition[]> | 'loading';

/** Nombre del bien: su tipo si llega (G-4b); si no, su número en la lista. Nunca un nombre de lote inventado. */
export const assetName = (item: LogisticsItem, index: number) => item.assetType ?? `Bien ${index}`;

export function AssetLane({ item, index, history, onRetry, id, hiddenOnNarrow, labelledBy }: {
  item: LogisticsItem; index: number; history: HistoryState; onRetry: () => void;
  id: string; hiddenOnNarrow: boolean; labelledBy?: string;
}) {
  const quantity = [formatQuantity(item.quantity), item.unitOfMeasure].filter(Boolean).join(' ');
  return (
    <section id={id} role={labelledBy ? 'tabpanel' : undefined} aria-labelledby={labelledBy ?? `${id}-title`}
      className={[s.lane, hiddenOnNarrow ? s.laneInactive : ''].join(' ')} data-testid="asset-lane">
      <header className={s.laneHead}>
        <h3 id={`${id}-title`} className={s.laneTitle}>{assetName(item, index)}</h3>
        <p className={s.laneMeta}>
          {[quantity || null, lifecycleLabel(item.lifecycleStatus), item.locationZone ?? NO_PUBLIC_ZONE, custodianLabel(item.custodianCategory)]
            .filter(Boolean).join(' · ')}
        </p>
      </header>
      {history === 'loading' && <LoadingState />}
      {history !== 'loading' && history.kind === 'ok' && history.data.length === 0 && (
        <p className={s.hint}>Sin movimientos registrados.</p>
      )}
      {history !== 'loading' && history.kind === 'ok' && history.data.length > 0 && (
        <>
          <ol className={s.steps} aria-label={`Recorrido de ${assetName(item, index)}`}>
            {history.data.map((t, i) => {
              const known = asTrackingEvent(t.eventType);
              return (
                <li key={i} className={s.step} data-kind={known ? stepKind(known) : 'unknown'} data-testid="tracking-step">
                  <span className={s.dot} aria-hidden="true" />
                  <div className={s.stepBody}>
                    <b className={s.stepTitle}>{eventLabel(t.eventType)}</b>
                    <span className={s.stepMeta}>
                      {t.timestamp ? <LocalDate iso={t.timestamp} withTime /> : 'Sin fecha'}
                      {' · '}{t.locationZone ?? NO_PUBLIC_ZONE}{' · '}{custodianLabel(t.custodianCategory)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
          {showsTruck(history.data) && (
            <div className={s.truck} data-testid="tracking-truck"><TruckLoader aria-label="En camino" /></div>
          )}
        </>
      )}
      {history !== 'loading' && history.kind === 'not-found' && <p className={s.hint}>El recorrido de este bien todavía no está disponible.</p>}
      {history !== 'loading' && (history.kind === 'error' || history.kind === 'invalid-code') && <ErrorState onRetry={onRetry} />}
    </section>
  );
}
