'use client';
// Ref: plan-fase7-fidelidad.md F-A5 (tres columnas en 1280 px; una en estrecho; selección de un paso con clic o
// teclado) y F-C2; plan-fase7-puesta-al-dia.md P-2; referencia-api-v1.md §8 (G-2 firstClearedAt/lastClearedAt, G-4
// parentAssetRef, G-3 anchorStatus); paxfide-linea-tiempo.html (#detailCard, #treeStage, #snakeCard). Desviaciones
// X-15 (sin nombre del lote ni destinatario) y X-16 (sin selector de escenario ni "Recorrido en vivo").
import React, { useEffect, useMemo, useState } from 'react';
import type { LogisticsItem, TrackingOutcome, Transition } from '../../lib/api/tracking';
import { custodianLabel, eventLabel, lifecycleLabel } from '../../lib/labels';
import { formatMinorUnits } from '../../lib/money';
import { formatQuantity } from '../../lib/quantity';
import { buildAssetTree, type TreeNode } from '../../lib/tracking/tree';
import { LocalDate } from '../LocalDate';
import { TruckLoader } from '../loaders';
import { ErrorState, LoadingState } from '../States';
import { NO_PUBLIC_ZONE, asTrackingEvent, showsTruck, stepKind } from './events';
import { StepIcon } from './StepIcon';
import { AnchorPill, StepDetail, type PaymentFacts, type Selection } from './StepDetail';
import s from './timeline.module.css';

export type HistoryState = TrackingOutcome<Transition[]> | 'loading';

/** Nombre del bien: su tipo si llega (G-4b); si no, su número en la lista. Nunca un nombre de lote inventado (X-15). */
export const assetName = (item: LogisticsItem, index: number) => item.assetType ?? `Bien ${index}`;

/** Nombre de la pestaña; si dos bienes se llaman igual, lleva su número para distinguirlos. */
export function tabLabel(items: LogisticsItem[], i: number): string {
  const name = assetName(items[i], i + 1);
  return items.filter((x, j) => assetName(x, j + 1) === name).length > 1 ? `${name} ${i + 1}` : name;
}

const quantityOf = (item: LogisticsItem) => [formatQuantity(item.quantity), item.unitOfMeasure].filter(Boolean).join(' ');

export function TrackingTimeline({ items, payment, campaignLine, histories, onRetry, aside }: {
  items: LogisticsItem[];
  payment: PaymentFacts;
  campaignLine?: string;
  histories: Record<string, HistoryState>;
  onRetry: (assetRef: string) => void;
  /** Lo que va bajo el detalle en la columna izquierda (la insignia de integridad y los hechos). */
  aside: React.ReactNode;
}) {
  const roots = useMemo(() => buildAssetTree(items), [items]);
  const indexOf = (ref: string) => items.findIndex((i) => i.assetRef === ref);
  const [picked, setPicked] = useState<Selection | null>(null);
  const [snakeLot, setSnakeLot] = useState(0);

  const historyOf = (ref: string): Transition[] => {
    const h = histories[ref];
    return h && h !== 'loading' && h.kind === 'ok' ? h.data : [];
  };
  // Sin elección todavía: el último paso del primer lote con recorrido; si no hay, el pago
  const selection: Selection | null = picked ?? (() => {
    for (const item of items) {
      const h = historyOf(item.assetRef);
      if (h.length > 0) return { kind: 'step', assetRef: item.assetRef, index: h.length - 1 } as Selection;
    }
    return payment.firstClearedAt ? { kind: 'payment' } as Selection : null;
  })();

  const select = (sel: Selection) => {
    setPicked(sel);
    if (sel.kind === 'step') { const i = indexOf(sel.assetRef); if (i >= 0) setSnakeLot(i); }
  };

  const selectedStep = selection?.kind === 'step' ? historyOf(selection.assetRef)[selection.index] ?? null : null;
  const selectedItem = selection?.kind === 'step' ? items[indexOf(selection.assetRef)] : undefined;
  const isSelected = (sel: Selection) => !!selection && (selection.kind === 'payment'
    ? sel.kind === 'payment'
    : sel.kind === 'step' && sel.assetRef === selection.assetRef && sel.index === selection.index);

  return (
    <div className={s.workspaceWrap}>
    <div className={s.workspace} data-testid="tracking-workspace">
      <aside className={s.leftCol} aria-label="Detalle y verificación">
        <p className={s.colTag}><span className={s.colDot} aria-hidden="true" />Detalle y verificación</p>
        <StepDetail
          step={selectedStep}
          payment={selection?.kind === 'payment' ? payment : null}
          assetTitle={selectedItem ? `${assetName(selectedItem, indexOf(selectedItem.assetRef) + 1)}${quantityOf(selectedItem) ? ` · ${quantityOf(selectedItem)}` : ''}` : undefined}
        />
        {aside}
      </aside>

      <div className={s.tree} data-testid="tracking-tree">
        <button type="button" className={[s.rootNode, isSelected({ kind: 'payment' }) ? s.selected : ''].join(' ')}
          aria-pressed={isSelected({ kind: 'payment' })} onClick={() => select({ kind: 'payment' })} data-testid="tree-root">
          <span className={s.nodeIcon} aria-hidden="true"><StepIcon kind="payment" /></span>
          <span className={s.rootBody}>
            <b className={s.stepTitle}>Donada</b>
            <span className={s.chips}>
              {payment.amount !== undefined && <span className={s.chip}>{formatMinorUnits(payment.amount, payment.currency)}</span>}
              {payment.firstClearedAt
                ? <span className={s.dateBadge} data-testid="root-date"><LocalDate iso={payment.firstClearedAt} withTime /></span>
                : <span className={s.chip}>Pago sin confirmar</span>}
            </span>
          </span>
        </button>
        {items.length === 0
          ? <p className={s.hint}>Todavía no hay bienes asociados a tu donación.</p>
          : roots.map((node) => (
            <LotCard key={node.item.assetRef} node={node} depth={0} items={items} histories={histories} onRetry={onRetry}
              isSelected={isSelected} onSelect={select} />
          ))}
      </div>

      {items.length > 0 && (
        <aside className={s.rightCol} aria-label="Recorrido de tu donación">
          <p className={s.colTag}><span className={[s.colDot, s.colDotGold].join(' ')} aria-hidden="true" />Recorrido en serpiente</p>
          <SnakeRoute items={items} active={Math.min(snakeLot, items.length - 1)} onTab={setSnakeLot}
            history={histories[items[Math.min(snakeLot, items.length - 1)].assetRef] ?? 'loading'}
            payment={payment} campaignLine={campaignLine} isSelected={isSelected} onSelect={select} />
        </aside>
      )}
    </div>
    </div>
  );
}

function LotCard({ node, depth, items, histories, onRetry, isSelected, onSelect }: {
  node: TreeNode<LogisticsItem>; depth: number; items: LogisticsItem[];
  histories: Record<string, HistoryState>; onRetry: (assetRef: string) => void;
  isSelected: (sel: Selection) => boolean; onSelect: (sel: Selection) => void;
}) {
  const item = node.item;
  const index = items.findIndex((i) => i.assetRef === item.assetRef) + 1;
  const history = histories[item.assetRef] ?? 'loading';
  const quantity = quantityOf(item);
  const titleId = `lot-${index}-title`;
  return (
    <section className={[s.lot, depth > 0 ? s.subLot : ''].join(' ')} aria-labelledby={titleId} data-testid="asset-lane"
      data-depth={depth}>
      <header className={s.lotHead}>
        {depth > 0 && <span className={s.subKicker}>Sublote</span>}
        <h3 id={titleId} className={s.lotTitle}>{assetName(item, index)}</h3>
        {quantity && <span className={s.unitsChip}>{quantity}</span>}
        <p className={s.lotMeta}>
          {[lifecycleLabel(item.lifecycleStatus), item.locationZone ?? NO_PUBLIC_ZONE, custodianLabel(item.custodianCategory ?? 'UNCATEGORIZED')]
            .filter(Boolean).join(' · ')}
        </p>
      </header>
      {history === 'loading' && <LoadingState />}
      {history !== 'loading' && history.kind === 'ok' && history.data.length === 0 && <p className={s.hint}>Sin movimientos registrados.</p>}
      {history !== 'loading' && history.kind === 'ok' && history.data.length > 0 && (
        <ol className={s.steps} aria-label={`Recorrido de ${assetName(item, index)}`}>
          {history.data.map((t, i) => {
            const known = asTrackingEvent(t.eventType);
            const sel: Selection = { kind: 'step', assetRef: item.assetRef, index: i };
            const truckHere = i === history.data.length - 1 && showsTruck(history.data);
            return (
              <li key={i} className={s.step} data-kind={known ? stepKind(known) : 'unknown'} data-testid="tracking-step">
                <button type="button" className={[s.stepButton, isSelected(sel) ? s.selected : ''].join(' ')}
                  aria-pressed={isSelected(sel)} onClick={() => onSelect(sel)}>
                  <span className={s.nodeIcon} aria-hidden="true">
                    <StepIcon kind={known ?? 'unknown'} />
                    {t.anchorStatus && <span className={s.seal} data-status={t.anchorStatus}><StepIcon kind={t.anchorStatus === 'ANCHORED' ? 'lock' : t.anchorStatus === 'UNDER_REVIEW' ? 'warning' : 'clock'} size={10} /></span>}
                  </span>
                  <span className={s.stepBody}>
                    <span className={s.stepLine}>
                      <b className={s.stepTitle}>{eventLabel(t.eventType)}</b>
                      <span className={s.dateBadge}>{t.timestamp ? <LocalDate iso={t.timestamp} withTime /> : 'Sin fecha'}</span>
                    </span>
                    <span className={s.chips}>
                      <span className={s.chip}>{t.locationZone ?? NO_PUBLIC_ZONE}</span>
                      <span className={s.chip}>{custodianLabel(t.custodianCategory ?? 'UNCATEGORIZED')}</span>
                      {t.anchorStatus === 'UNDER_REVIEW' && <AnchorPill status={t.anchorStatus} />}
                    </span>
                  </span>
                </button>
                {truckHere && <div className={s.treeTruck} data-testid="tracking-truck"><TruckLoader aria-label="En camino" /></div>}
              </li>
            );
          })}
        </ol>
      )}
      {history !== 'loading' && history.kind === 'not-found' && <p className={s.hint}>El recorrido de este bien todavía no está disponible.</p>}
      {history !== 'loading' && (history.kind === 'error' || history.kind === 'invalid-code') && <ErrorState onRetry={() => onRetry(item.assetRef)} />}
      {node.children.map((child) => (
        <LotCard key={child.item.assetRef} node={child} depth={depth + 1} items={items} histories={histories} onRetry={onRetry}
          isSelected={isSelected} onSelect={onSelect} />
      ))}
    </section>
  );
}

/** Geometría de la serpiente: estaciones alternas a izquierda y derecha; todos los tramos miden lo mismo. */
export const SNAKE = { width: 300, left: 40, right: 260, top: 40, gap: 100 } as const;

export function snakeGeometry(n: number) {
  const points = Array.from({ length: Math.max(1, n) }, (_, i) => ({ x: i % 2 === 0 ? SNAKE.left : SNAKE.right, y: SNAKE.top + i * SNAKE.gap }));
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    d += ` C ${a.x} ${a.y + 55}, ${b.x} ${b.y - 55}, ${b.x} ${b.y}`;
  }
  return { points, d, height: points[points.length - 1].y + SNAKE.top };
}

/** Posición en la carretera (offset-distance) de la estación `i` de `n`. */
export const stationDistance = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * 100);

type Station = { label: string; at?: string; sel: Selection; kind: 'payment' | NonNullable<ReturnType<typeof asTrackingEvent>> | 'unknown'; anchor?: Transition['anchorStatus'] };

function SnakeRoute({ items, active, onTab, history, payment, campaignLine, isSelected, onSelect }: {
  items: LogisticsItem[]; active: number; onTab: (i: number) => void; history: HistoryState; payment: PaymentFacts;
  campaignLine?: string; isSelected: (sel: Selection) => boolean; onSelect: (sel: Selection) => void;
}) {
  const item = items[active];
  const steps = history !== 'loading' && history.kind === 'ok' ? history.data : [];
  const stations: Station[] = [
    ...(payment.firstClearedAt ? [{ label: 'Pago confirmado', at: payment.firstClearedAt, sel: { kind: 'payment' } as Selection, kind: 'payment' as const }] : []),
    ...steps.map((t, i) => ({
      label: eventLabel(t.eventType), at: t.timestamp, sel: { kind: 'step', assetRef: item.assetRef, index: i } as Selection,
      kind: asTrackingEvent(t.eventType) ?? 'unknown' as const, anchor: t.anchorStatus,
    })),
  ];
  const geo = snakeGeometry(stations.length);
  const n = stations.length;
  // Solo conduce si el último evento del lote es un despacho (va en camino); si no, queda parado en su estación
  const driving = n > 1 && showsTruck(steps);
  const to = stationDistance(n - 1, n);
  const from = driving ? stationDistance(n - 2, n) : to;
  const quantity = quantityOf(item);

  return (
    <section className={s.snake} aria-labelledby="snake-title" data-testid="snake">
      <header className={s.snakeHead}>
        <p className={s.snakeKicker}>{`LOTE · ${assetName(item, active + 1)}${quantity ? ` · ${quantity}` : ''}`.toUpperCase()}</p>
        <span className={s.snakePill}>{lifecycleLabel(item.lifecycleStatus)}{n > 0 ? ` · ${n} ${n === 1 ? 'estación' : 'estaciones'}` : ''}</span>
        <h3 id="snake-title" className={s.snakeTitle}>Recorrido de tu donación</h3>
        {campaignLine && <p className={s.hint}>{campaignLine}</p>}
      </header>
      {items.length > 1 && (
        <div className={s.tabs} role="tablist" aria-label="Bienes de tu donación">
          {items.map((it, i) => (
            <button key={it.assetRef} type="button" role="tab" id={`snake-tab-${i}`} aria-controls="snake-track"
              aria-selected={i === active} className={s.tab} onClick={() => onTab(i)}>
              {tabLabel(items, i)}
            </button>
          ))}
        </div>
      )}
      <div id="snake-track" role={items.length > 1 ? 'tabpanel' : undefined} aria-labelledby={items.length > 1 ? `snake-tab-${active}` : undefined}>
        {history === 'loading' && <LoadingState />}
        {n === 0 && history !== 'loading' && <p className={s.hint}>Este bien todavía no tiene estaciones.</p>}
        {n > 0 && (
          <div className={s.track} style={{ width: SNAKE.width, height: geo.height }}>
            <svg className={s.road} width={SNAKE.width} height={geo.height} viewBox={`0 0 ${SNAKE.width} ${geo.height}`} aria-hidden="true" focusable="false">
              <path d={geo.d} className={s.roadAsphalt} />
              <path d={geo.d} className={s.roadLine} />
            </svg>
            <ol className={s.stations} aria-label="Estaciones del recorrido">
              {stations.map((st, i) => (
                <li key={i} className={s.station} data-side={i % 2 === 0 ? 'left' : 'right'}
                  style={{ left: geo.points[i].x, top: geo.points[i].y }}>
                  <button type="button" className={[s.stationButton, isSelected(st.sel) ? s.selected : ''].join(' ')}
                    aria-pressed={isSelected(st.sel)} onClick={() => onSelect(st.sel)} data-testid="snake-station">
                    <span className={s.stationIcon} aria-hidden="true"><StepIcon kind={st.kind} /></span>
                    <span className={s.stationLabel}>
                      <b>{st.label}</b>
                      {st.at && <small><LocalDate iso={st.at} /></small>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <div className={s.snakeTruck} data-testid="snake-truck" data-driving={driving ? 'true' : 'false'} aria-hidden="true"
              style={{ offsetPath: `path('${geo.d}')`, ['--from' as string]: `${from}%`, ['--to' as string]: `${to}%` } as React.CSSProperties}>
              <svg width="40" height="26" viewBox="0 0 64 34" focusable="false">
                <rect x="2" y="8" width="38" height="22" rx="3" className={s.truckBox} />
                <path d="M40 14h12l9 9v7H40z" className={s.truckCab} />
                <circle cx="14" cy="31" r="3.5" className={s.truckWheel} />
                <circle cx="50" cy="31" r="3.5" className={s.truckWheel} />
              </svg>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
