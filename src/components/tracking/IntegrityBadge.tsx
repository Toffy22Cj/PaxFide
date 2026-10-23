'use client';
// Ref: plan-fase7-pantallas.md A-4 (insignia de integridad de la donación, ficha P4, con el árbol de Merkle de VS-1
// mientras carga); prompts-agentes-estilo-v2.md VS-7 (NOT_ANCHORED y unanchoredEvents como "pendiente de anclaje",
// amarillo, no rojo) y §3.1 (G-3: ningún hash por paso; solo los de esta insignia).
import React, { useEffect, useState } from 'react';
import { fetchIntegrity, type DonationIntegrity, type IntegrityBatch, type TrackingOutcome } from '../../lib/api/tracking';
import { MerkleTreeLoader } from '../loaders';
import { ErrorState, StatusNotice, type StatusNoticeVariant } from '../States';
import { LocalDate } from '../LocalDate';
import s from './tracking.module.css';

export interface IntegrityVerdict { variant: StatusNoticeVariant; title: string; text: string }

/**
 * Resumen de toda la donación. Orden: un "no coincide" manda; después, lo que no se pudo comprobar; después, lo que
 * espera anclaje (amarillo, nunca rojo); y solo si todo lo anclado coincide y no queda nada por anclar, "coincide".
 */
export function integrityVerdict(d: DonationIntegrity): IntegrityVerdict {
  const mismatch = d.batches.filter((b) => b.result === 'MISMATCH');
  if (mismatch.length > 0) {
    const affects = mismatch.some((b) => b.affectsThisDonation !== false);
    return { variant: 'rejected', title: 'No coincide', text: affects
      ? 'Parte del registro de tu donación no es igual a lo que se ancló en la cadena de bloques: algo cambió después del anclaje.'
      : 'Un grupo de eventos anclado junto con los de tu donación cambió después del anclaje. Los eventos de tu donación no están afectados.' };
  }
  const pending = (b: IntegrityBatch) => b.result === 'INCONCLUSIVE' && b.reason === 'NOT_ANCHORED';
  if (d.batches.some((b) => b.result === 'INCONCLUSIVE' && !pending(b))) {
    return { variant: 'info', title: 'No se pudo comprobar', text: 'Por ahora no se puede confirmar ni descartar ningún cambio en el registro de tu donación.' };
  }
  if (d.unanchoredEvents > 0 || d.batches.some(pending)) {
    const matched = d.batches.some((b) => b.result === 'MATCH');
    return { variant: 'ambiguous', title: 'Pendiente de anclaje', text: matched
      ? 'Lo que ya se ancló coincide. Algunos eventos de tu donación todavía esperan su anclaje en la cadena de bloques.'
      : 'Los eventos de tu donación todavía esperan su anclaje en la cadena de bloques.' };
  }
  if (d.batches.length === 0) {
    return { variant: 'info', title: 'Sin eventos que comprobar', text: 'Tu donación todavía no tiene eventos que comprobar.' };
  }
  return { variant: 'success', title: 'Coincide', text: 'Los eventos de tu donación son los mismos que se anclaron en la cadena de bloques: no se han modificado.' };
}

const ANCHOR_STATUS: Record<string, string> = {
  COLLECTING: 'Reuniendo eventos para anclarlos', PENDING: 'Pendiente de anclar', SUBMITTING: 'Enviándose a la cadena de bloques',
  SUBMITTED: 'Enviado; esperando confirmación de la cadena', ANCHORED: 'Anclado en la cadena de bloques',
  STUCK: 'Anclaje detenido; se reintentará', FAILED: 'El anclaje falló', ANCHOR_MISMATCH: 'Lo anclado no coincide con lo registrado',
};
const RESULT: Record<IntegrityBatch['result'], string> = { MATCH: 'Coincide', MISMATCH: 'No coincide', INCONCLUSIVE: 'No se pudo comprobar' };

function BatchDetail({ b, i }: { b: IntegrityBatch; i: number }) {
  const rows: [string, React.ReactNode][] = [
    ['Resultado', RESULT[b.result]],
    ['Eventos de tu donación', String(b.eventsOfThisDonation)],
    ['Estado del anclaje', ANCHOR_STATUS[b.anchorStatus] ?? b.anchorStatus],
    ...(b.reasonText ? [['Motivo', b.reasonText] as [string, React.ReactNode]] : []),
    ...(b.anchoredAt ? [['Anclado el', <LocalDate key="a" iso={b.anchoredAt} withTime />] as [string, React.ReactNode]] : []),
    ...(b.network ? [['Red', b.network] as [string, React.ReactNode]] : []),
    ...(b.confirmedBlockNumber !== undefined ? [['Bloque', String(b.confirmedBlockNumber)] as [string, React.ReactNode]] : []),
    ...(b.merkleRoot ? [['Raíz (huella del grupo)', <code key="r" className={s.hash}>{b.merkleRoot}</code>] as [string, React.ReactNode]] : []),
    ...(b.transactionHash ? [['Transacción', <code key="t" className={s.hash}>{b.transactionHash}</code>] as [string, React.ReactNode]] : []),
  ];
  return (
    <li className={s.batch} data-testid="integrity-batch" data-result={b.result}>
      <h4 className={s.batchTitle}>Grupo {i + 1}</h4>
      <dl className={s.dl}>{rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
    </li>
  );
}

/** Se consulta al abrir el seguimiento, con el mismo código en `Authorization` (S-22); "Volver a comprobar" la repite. */
export function IntegrityBadge({ trackingCode, client = fetchIntegrity }: { trackingCode: string; client?: typeof fetchIntegrity }) {
  const [state, setState] = useState<TrackingOutcome<DonationIntegrity> | 'loading'>('loading');
  const load = async () => {
    setState('loading');
    setState(await client(trackingCode));
  };
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingCode]);

  return (
    <section className={s.panel} aria-labelledby="integrity-title" data-testid="integrity">
      <h3 id="integrity-title" className={s.panelTitle}>Integridad de tu donación</h3>
      {state === 'loading' && <div className={s.loader}><MerkleTreeLoader /></div>}
      {state !== 'loading' && state.kind === 'ok' && (() => {
        const v = integrityVerdict(state.data);
        return (
          <>
            <div data-testid="integrity-verdict" data-variant={v.variant}><StatusNotice variant={v.variant} title={v.title} text={v.text} /></div>
            {state.data.unanchoredEvents > 0 && (
              <p className={s.hint}>{state.data.unanchoredEvents === 1
                ? '1 evento de tu donación todavía no se ha anclado.'
                : `${state.data.unanchoredEvents} eventos de tu donación todavía no se han anclado.`}</p>
            )}
            {state.data.batches.length > 0 && (
              <details className={s.details}>
                <summary>Ver el detalle de la verificación</summary>
                <p className={s.hint}>Los eventos se anclan por grupos: cada grupo guarda en la cadena una huella (raíz) de todos sus eventos.</p>
                <ul className={s.batches}>{state.data.batches.map((b, i) => <BatchDetail key={i} b={b} i={i} />)}</ul>
              </details>
            )}
            {state.data.checkedAt && <p className={s.hint}>Comprobado el <LocalDate iso={state.data.checkedAt} withTime />. El resultado puede tardar unos minutos en actualizarse.</p>}
            <button type="button" className={s.smallButton} onClick={() => void load()}>Volver a comprobar</button>
          </>
        );
      })()}
      {state !== 'loading' && state.kind === 'not-found' && <p className={s.hint}>La verificación todavía no está disponible para tu donación.</p>}
      {state !== 'loading' && state.kind === 'invalid-code' && <StatusNotice variant="rejected" text="El código no es válido o expiró." />}
      {state !== 'loading' && state.kind === 'error' && <ErrorState onRetry={() => void load()} />}
    </section>
  );
}
