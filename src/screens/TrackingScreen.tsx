'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  DonationIntegrity, DonationTracking, fetchAssetHistory, fetchIntegrity, fetchNarrative, fetchTracking, IntegrityBatch, LogisticsItem,
  Narrative, TrackingOutcome, Transition,
} from '../lib/api/tracking';
import { consumeHandedOffTrackingCode } from '../lib/tracking/handoff';
import { formatMinorUnits } from '../lib/money';
import { custodianLabel, donationStatusLabel, eventLabel, lifecycleLabel } from '../lib/labels';
import { PageHeader, DefinitionList, Surface, Actions, uiClasses as ui } from '../components/ui/Layout';
import { TextField } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { ErrorState, LoadingState, StatusNotice } from '../components/States';
import { LocalDate } from '../components/LocalDate';
import { formatQuantity } from '../lib/quantity';

type Clients = {
  tracking?: typeof fetchTracking;
  narrative?: typeof fetchNarrative;
  history?: typeof fetchAssetHistory;
  integrity?: typeof fetchIntegrity;
};

const money = (v: string | undefined, currency?: string) => (v === undefined ? '—' : formatMinorUnits(v, currency));

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
  return (
    <>
      <Surface title="Hechos verificables">
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
        <h3 className={ui.sectionTitle}>Bienes de tu donación</h3>
        {data.logistics.length === 0
          ? <p>Todavía no hay bienes asociados a tu donación.</p>
          : <ul className={ui.list}>{data.logistics.map((item, i) => (
            <AssetItem key={item.assetRef} index={i + 1} item={item} trackingCode={trackingCode} clients={clients} />
          ))}</ul>}
      </Surface>
      <IntegritySection trackingCode={trackingCode} client={clients.integrity ?? fetchIntegrity} />
      <NarrativeSection trackingCode={trackingCode} client={clients.narrative ?? fetchNarrative} />
      <Actions><Button variant="secondary" onClick={onClose}>Cerrar seguimiento</Button></Actions>
    </>
  );
}

function AssetItem({ index, item, trackingCode, clients }: {
  index: number; item: LogisticsItem; trackingCode: string; clients: Clients;
}) {
  const [history, setHistory] = useState<TrackingOutcome<Transition[]> | 'loading' | null>(null);
  const load = async () => {
    setHistory('loading');
    setHistory(await (clients.history ?? fetchAssetHistory)(trackingCode, item.assetRef));
  };
  return (
    <li className={ui.surface} style={{ marginBottom: 0 }}>
      <DefinitionList items={[
        { label: 'Bien', value: item.assetType ?? `Bien ${index}` },
        { label: 'Cantidad', value: [formatQuantity(item.quantity), item.unitOfMeasure].filter(Boolean).join(' ') || '—' },
        { label: 'Estado', value: lifecycleLabel(item.lifecycleStatus) },
        { label: 'Zona', value: item.locationZone ?? '—' },
        { label: 'Custodio', value: custodianLabel(item.custodianCategory) },
      ]} />
      {history === null && <Button variant="secondary" onClick={() => void load()}>Ver recorrido</Button>}
      {history === 'loading' && <LoadingState />}
      {history !== null && history !== 'loading' && history.kind === 'ok' && (
        history.data.length === 0 ? <p>Sin movimientos registrados.</p> : (
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <caption style={{ textAlign: 'left', fontWeight: 600, padding: '8px 0' }}>Recorrido</caption>
              <thead><tr><th scope="col">Fecha</th><th scope="col">Evento</th><th scope="col">Zona</th><th scope="col">Custodio</th></tr></thead>
              <tbody>{history.data.map((t, i) => (
                <tr key={i}>
                  <td>{t.timestamp ? <LocalDate iso={t.timestamp} withTime /> : '—'}</td>
                  <td>{eventLabel(t.eventType)}</td>
                  <td>{t.locationZone ?? '—'}</td>
                  <td>{custodianLabel(t.custodianCategory)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ))}
      {history !== null && history !== 'loading' && history.kind === 'not-found' && <p>El recorrido de este bien todavía no está disponible.</p>}
      {history !== null && history !== 'loading' && (history.kind === 'error' || history.kind === 'invalid-code') && (
        <ErrorState onRetry={() => void load()} />
      )}
    </li>
  );
}

function NarrativeSection({ trackingCode, client }: { trackingCode: string; client: typeof fetchNarrative }) {
  const [state, setState] = useState<TrackingOutcome<Narrative> | 'loading'>('loading');
  const load = async () => {
    setState('loading');
    setState(await client(trackingCode));
  };
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingCode]);

  return (
    <Surface title="Relato de tu donación">
      <p className={ui.hint}>Texto generado automáticamente a partir de los hechos de arriba. Si algo no coincide, mandan los hechos.</p>
      {state === 'loading' && <LoadingState />}
      {state !== 'loading' && state.kind === 'ok' && state.data.status === 'PENDING' && (
        <StatusNotice variant="info" text="El relato se está generando.">
          <Actions><Button variant="secondary" onClick={() => void load()}>Actualizar</Button></Actions>
        </StatusNotice>
      )}
      {state !== 'loading' && state.kind === 'ok' && state.data.status !== 'PENDING' && (
        <>
          <p data-testid="narrative" style={{ whiteSpace: 'pre-line' }}>{state.data.content ?? ''}</p>
          {state.data.source === 'FALLBACK_TEMPLATE' && <p className={ui.hint}>Relato de plantilla (sin IA).</p>}
          {state.data.source === 'LLM_GENERATED' && <p className={ui.hint}>Relato redactado con IA.</p>}
        </>
      )}
      {state !== 'loading' && state.kind === 'not-found' && <p>El relato todavía no está disponible.</p>}
      {state !== 'loading' && (state.kind === 'error' || state.kind === 'invalid-code') && <ErrorState onRetry={() => void load()} />}
    </Surface>
  );
}

const ANCHOR_STATUS: Record<string, string> = {
  COLLECTING: 'Reuniendo eventos para anclarlos',
  PENDING: 'Pendiente de anclar',
  SUBMITTING: 'Enviándose a la cadena de bloques',
  SUBMITTED: 'Enviado; esperando confirmación de la cadena',
  ANCHORED: 'Anclado en la cadena de bloques',
  STUCK: 'Anclaje detenido; se reintentará',
  FAILED: 'El anclaje falló',
  ANCHOR_MISMATCH: 'Lo anclado no coincide con lo registrado',
};

/** Resultado en lenguaje llano: qué significa para el donante, sin jerga. */
function verdict(b: IntegrityBatch): { variant: 'success' | 'rejected' | 'info'; title: string; text: string } {
  if (b.result === 'MATCH') {
    return { variant: 'success', title: 'Coincide',
      text: 'Los eventos de este grupo son los mismos que se anclaron en la cadena de bloques: no se han modificado.' };
  }
  if (b.result === 'MISMATCH') {
    const affects = b.affectsThisDonation === true ? ' Afecta a eventos de tu donación.'
      : b.affectsThisDonation === false ? ' No afecta a los eventos de tu donación.' : '';
    return { variant: 'rejected', title: 'No coincide',
      text: `El registro de este grupo no es igual al que se ancló: algo cambió después del anclaje.${affects}` };
  }
  return { variant: 'info', title: 'No se pudo comprobar',
    text: 'Por ahora no se puede confirmar ni descartar ningún cambio en este grupo de eventos.' };
}

/**
 * Verificación de integridad (S-22): se consulta a petición con el mismo código, en `Authorization`. Cada grupo de
 * eventos anclado (lote) se explica en lenguaje llano; la raíz y la transacción son datos públicos de la cadena.
 */
function IntegritySection({ trackingCode, client }: { trackingCode: string; client: typeof fetchIntegrity }) {
  const [state, setState] = useState<TrackingOutcome<DonationIntegrity> | 'loading' | null>(null);
  const load = async () => {
    setState('loading');
    setState(await client(trackingCode));
  };
  return (
    <Surface title="Verificación de integridad">
      <p>Comprueba que el registro de tu donación no se ha modificado desde que se ancló en la cadena de bloques. Los
        eventos se anclan por grupos: cada grupo guarda en la cadena una huella (raíz) de todos sus eventos.</p>
      {state === null && <Button variant="secondary" onClick={() => void load()}>Comprobar integridad</Button>}
      {state === 'loading' && <LoadingState />}
      {state !== null && state !== 'loading' && state.kind === 'ok' && (
        <div data-testid="integrity">
          {state.data.batches.length === 0 && state.data.unanchoredEvents === 0 && (
            <p>Tu donación todavía no tiene eventos que comprobar.</p>
          )}
          {state.data.unanchoredEvents > 0 && (
            <StatusNotice variant="info" text={state.data.unanchoredEvents === 1
              ? 'Hay 1 evento de tu donación que todavía no se ha anclado; se comprobará cuando se ancle.'
              : `Hay ${state.data.unanchoredEvents} eventos de tu donación que todavía no se han anclado; se comprobarán cuando se anclen.`} />
          )}
          {state.data.batches.length > 0 && (
            <ul className={ui.list}>{state.data.batches.map((b, i) => {
              const v = verdict(b);
              return (
                <li key={i} className={ui.surface} style={{ marginBottom: 0 }} data-testid="integrity-batch" data-result={b.result}>
                  <h3 className={ui.sectionTitle}>Grupo {i + 1}</h3>
                  <StatusNotice variant={v.variant} title={v.title} text={v.text} />
                  <DefinitionList items={[
                    { label: 'Eventos de tu donación en este grupo', value: String(b.eventsOfThisDonation) },
                    { label: 'Estado del anclaje', value: ANCHOR_STATUS[b.anchorStatus] ?? b.anchorStatus },
                    ...(b.reasonText ? [{ label: 'Motivo', value: b.reasonText }] : []),
                    ...(b.anchoredAt ? [{ label: 'Anclado el', value: <LocalDate iso={b.anchoredAt} withTime /> }] : []),
                    ...(b.network ? [{ label: 'Red', value: b.network }] : []),
                    ...(b.confirmedBlockNumber !== undefined ? [{ label: 'Bloque', value: String(b.confirmedBlockNumber) }] : []),
                    ...(b.merkleRoot ? [{ label: 'Raíz (huella del grupo)', value: <code style={{ wordBreak: 'break-all' }}>{b.merkleRoot}</code> }] : []),
                    ...(b.transactionHash ? [{ label: 'Transacción', value: <code style={{ wordBreak: 'break-all' }}>{b.transactionHash}</code> }] : []),
                  ]} />
                </li>
              );
            })}</ul>
          )}
          {state.data.checkedAt && <p className={ui.hint}>Comprobado el <LocalDate iso={state.data.checkedAt} withTime />. El resultado puede tardar unos minutos en actualizarse.</p>}
          <Actions><Button variant="secondary" onClick={() => void load()}>Volver a comprobar</Button></Actions>
        </div>
      )}
      {state !== null && state !== 'loading' && state.kind === 'not-found' && <p>La verificación todavía no está disponible para tu donación.</p>}
      {state !== null && state !== 'loading' && state.kind === 'invalid-code' && <StatusNotice variant="rejected" text="El código no es válido o expiró." />}
      {state !== null && state !== 'loading' && state.kind === 'error' && <ErrorState onRetry={() => void load()} />}
    </Surface>
  );
}
