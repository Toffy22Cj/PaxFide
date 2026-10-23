'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  DonationTracking, fetchAssetHistory, fetchIntegrity, fetchNarrative, fetchTracking, LogisticsItem, Narrative, TrackingOutcome,
} from '../lib/api/tracking';
import { consumeHandedOffTrackingCode } from '../lib/tracking/handoff';
import { formatMinorUnits } from '../lib/money';
import { donationStatusLabel } from '../lib/labels';
import { PageHeader, DefinitionList, Surface, Actions } from '../components/ui/Layout';
import { TextField } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { ErrorState, LoadingState, StatusNotice } from '../components/States';
import { TrackingCodeChip } from '../components/tracking/TrackingCodeChip';
import { IntegrityBadge } from '../components/tracking/IntegrityBadge';
import { AssetLane, assetName, type HistoryState } from '../components/tracking/AssetLane';
import t from '../components/tracking/tracking.module.css';

type Clients = {
  tracking?: typeof fetchTracking;
  narrative?: typeof fetchNarrative;
  history?: typeof fetchAssetHistory;
  integrity?: typeof fetchIntegrity;
};

const money = (v: string | undefined, currency?: string) => (v === undefined ? '—' : formatMinorUnits(v, currency));

// Ref: plan-fase7-pantallas.md A-4 (línea de tiempo de paxfide-linea-tiempo.html); prompts-agentes-estilo-v2.md VS-7,
// §3.1 y §3.5 (T-1); referencia-api-v1.md §8 (G-1: campaignTitle? y organizationName?).
/**
 * `TrackingPage` por formulario (C2/H1, DW-01): el código se escribe aquí (o llega en memoria desde la donación,
 * DW-16) y solo vive en el estado de este componente; viaja en `Authorization`. Un 401 es un único mensaje y nunca
 * toca la sesión. La narrativa es generada y se muestra separada de los hechos.
 */
export function TrackingScreen({ clients = {} }: { clients?: Clients }) {
  const getTracking = clients.tracking ?? fetchTracking;
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string>();
  const code = useRef<string | null>(null);
  const [result, setResult] = useState<TrackingOutcome<DonationTracking> | 'loading' | null>(null);

  const open = async (trackingCode: string) => {
    code.current = trackingCode;
    setInput('');
    setResult('loading');
    setResult(await getTracking(trackingCode));
  };

  useEffect(() => {
    const handed = consumeHandedOffTrackingCode();
    if (handed) void open(handed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) {
      setInputError('Este campo es obligatorio.');
      return;
    }
    setInputError(undefined);
    void open(value);
  };

  const close = () => {
    code.current = null;
    setResult(null);
  };

  const invalid = result !== null && result !== 'loading' && result.kind === 'invalid-code';

  return (
    <div>
      <PageHeader title="Seguimiento de tu donación" />
      {(result === null || invalid) && (
        <Surface>
          {invalid && (
            <StatusNotice variant="rejected" text="El código no es válido o expiró." />
          )}
          <p>Escribe el código de seguimiento que recibiste al confirmarse tu donación. No lo compartas: es la llave
            de tu seguimiento.</p>
          <form onSubmit={submit} noValidate>
            <TextField label="Código de seguimiento" value={input} onChange={(e) => setInput(e.target.value)}
              autoComplete="off" spellCheck={false} autoCapitalize="off" error={inputError} />
            <Button type="submit">Ver seguimiento</Button>
          </form>
        </Surface>
      )}
      {result === 'loading' && <LoadingState />}
      {result !== null && result !== 'loading' && result.kind === 'not-found' && (
        <>
          <StatusNotice variant="info" text="Tu donación todavía se está procesando. Vuelve a consultarla en unos minutos." />
          <Actions>
            <Button onClick={() => code.current && void open(code.current)}>Volver a consultar</Button>
            <Button variant="secondary" onClick={close}>Usar otro código</Button>
          </Actions>
        </>
      )}
      {result !== null && result !== 'loading' && result.kind === 'error' && (
        <ErrorState onRetry={() => code.current && void open(code.current)} />
      )}
      {result !== null && result !== 'loading' && result.kind === 'ok' && code.current && (
        <TrackingDetails data={result.data} trackingCode={code.current} clients={clients} onClose={close} />
      )}
    </div>
  );
}

function TrackingDetails({ data, trackingCode, clients, onClose }: {
  data: DonationTracking; trackingCode: string; clients: Clients; onClose: () => void;
}) {
  const f = data.financialSnapshot;
  const sub = [data.campaignTitle, data.organizationName].filter(Boolean).join(' · ');
  const assets = data.logistics.length;
  return (
    <>
      <section className={t.header} aria-labelledby="tracking-story">
        <p className={t.kicker}>DONACIÓN{f?.originalAmount !== undefined ? ` · ${money(f.originalAmount, f.currency)}` : ''}</p>
        <h2 id="tracking-story" className={t.title}>Historia de tu donación</h2>
        {/* G-1: título y organización solo si llegan; nunca ciudad ni destinatario */}
        {sub && <p className={t.sub} data-testid="tracking-campaign">{sub}</p>}
        <span className={t.pill} data-testid="tracking-pill">
          {donationStatusLabel(data.status)}{assets > 0 ? ` · ${assets === 1 ? '1 bien' : `${assets} bienes`}` : ''}
        </span>
        <TrackingCodeChip code={trackingCode} />
      </section>
      <div className={t.grid}>
        <section className={t.panel} aria-labelledby="tracking-facts">
          <h3 id="tracking-facts" className={t.panelTitle}>Hechos verificables</h3>
          <DefinitionList items={[
            { label: 'Estado', value: donationStatusLabel(data.status), testId: 'tracking-status' },
            ...(f ? [
              { label: 'Donado', value: money(f.originalAmount, f.currency), testId: 'tracking-original' },
              { label: 'Recibido', value: money(f.clearedAmount, f.currency) },
              { label: 'Comprometido en compras', value: money(f.pendingAllocationAmount, f.currency) },
              { label: 'Usado en compras', value: money(f.confirmedAllocationAmount, f.currency) },
              { label: 'Reembolsado', value: money(f.refundedAmount, f.currency) },
            ] : []),
          ]} />
        </section>
        <IntegrityBadge trackingCode={trackingCode} client={clients.integrity ?? fetchIntegrity} />
      </div>
      <h3 className={t.lanesTitle}>Bienes de tu donación</h3>
      {assets === 0
        ? <p className={t.privacy}>Todavía no hay bienes asociados a tu donación.</p>
        : <Lanes items={data.logistics} trackingCode={trackingCode} client={clients.history ?? fetchAssetHistory} />}
      <NarrativeSection trackingCode={trackingCode} client={clients.narrative ?? fetchNarrative} />
      <p className={t.privacy}>Los custodios se identifican solo por su categoría. Nunca se muestra quién recibe la ayuda.</p>
      <Actions><Button variant="secondary" onClick={onClose}>Cerrar seguimiento</Button></Actions>
    </>
  );
}

/** Nombre de la pestaña; si dos bienes se llaman igual, lleva su número para distinguirlos. */
export function tabLabel(items: LogisticsItem[], i: number): string {
  const name = assetName(items[i], i + 1);
  return items.filter((x, j) => assetName(x, j + 1) === name).length > 1 ? `${name} ${i + 1}` : name;
}

/** Un carril por bien (lista plana, G-4). Los recorridos se piden todos al abrir; en estrecho, una pestaña por bien. */
function Lanes({ items, trackingCode, client }: { items: LogisticsItem[]; trackingCode: string; client: typeof fetchAssetHistory }) {
  const [histories, setHistories] = useState<Record<string, HistoryState>>({});
  const [active, setActive] = useState(0);
  const load = async (assetRef: string) => {
    setHistories((h) => ({ ...h, [assetRef]: 'loading' }));
    const r = await client(trackingCode, assetRef);
    setHistories((h) => ({ ...h, [assetRef]: r }));
  };
  useEffect(() => { items.forEach((i) => void load(i.assetRef)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingCode, items]);
  const tabs = items.length > 1;
  return (
    <>
      {tabs && (
        <div className={t.tabs} role="tablist" aria-label="Bienes de tu donación">
          {items.map((item, i) => (
            <button key={item.assetRef} type="button" role="tab" id={`lane-tab-${i}`} aria-controls={`lane-${i}`}
              aria-selected={i === active} className={t.tab} onClick={() => setActive(i)}>
              {tabLabel(items, i)}
            </button>
          ))}
        </div>
      )}
      <div className={t.lanes}>
        {items.map((item, i) => (
          <AssetLane key={item.assetRef} id={`lane-${i}`} item={item} index={i + 1} history={histories[item.assetRef] ?? 'loading'}
            onRetry={() => void load(item.assetRef)} hiddenOnNarrow={tabs && i !== active} labelledBy={tabs ? `lane-tab-${i}` : undefined} />
        ))}
      </div>
    </>
  );
}

/** Resumen generado (TR-02): su contenido solo con `AVAILABLE`, rotulado y separado de los hechos. */
function NarrativeSection({ trackingCode, client }: { trackingCode: string; client: typeof fetchNarrative }) {
  const [state, setState] = useState<TrackingOutcome<Narrative> | 'loading'>('loading');
  const load = async () => {
    setState('loading');
    setState(await client(trackingCode));
  };
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingCode]);

  return (
    <section className={`${t.panel} ${t.narrative}`} aria-labelledby="tracking-narrative">
      <h3 id="tracking-narrative" className={t.panelTitle}>Resumen de tu donación</h3>
      <p className={t.hint}>Texto generado automáticamente a partir de los hechos de arriba. Si algo no coincide, mandan los hechos.</p>
      {state === 'loading' && <LoadingState />}
      {state !== 'loading' && state.kind === 'ok' && state.data.status === 'PENDING' && (
        <StatusNotice variant="info" text="El relato se está generando.">
          <Actions><Button variant="secondary" onClick={() => void load()}>Actualizar</Button></Actions>
        </StatusNotice>
      )}
      {state !== 'loading' && state.kind === 'ok' && state.data.status === 'AVAILABLE' && (
        <>
          <p data-testid="narrative" style={{ whiteSpace: 'pre-line', margin: 0 }}>{state.data.content ?? ''}</p>
          {state.data.source === 'FALLBACK_TEMPLATE' && <p className={t.hint}>Relato de plantilla (sin IA).</p>}
          {state.data.source === 'LLM_GENERATED' && <p className={t.hint}>Relato redactado con IA.</p>}
        </>
      )}
      {state !== 'loading' && state.kind === 'ok' && state.data.status !== 'PENDING' && state.data.status !== 'AVAILABLE' && (
        <p className={t.hint}>El resumen no está disponible.</p>
      )}
      {state !== 'loading' && state.kind === 'not-found' && <p className={t.hint}>El relato todavía no está disponible.</p>}
      {state !== 'loading' && (state.kind === 'error' || state.kind === 'invalid-code') && <ErrorState onRetry={() => void load()} />}
    </section>
  );
}
