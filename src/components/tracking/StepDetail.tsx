'use client';
// Ref: plan-fase7-fidelidad.md F-A5 (columna "Detalle y verificación") y F-C2; plan-fase7-puesta-al-dia.md P-2
// ("Huella criptográfica", "Comprobar en mi navegador", huella de la foto de entrega, U-8); referencia-api-v1.md §8,
// notas del 2026-10-25 (G-3, E1.3, E1.4 y ADR-051 F6); paxfide-linea-tiempo.html (showDetail).
import React, { useEffect, useState } from 'react';
import { fetchEvidencePreview, type Transition } from '../../lib/api/tracking';
import { anchorStatusLabel, custodianLabel, eventLabel } from '../../lib/labels';
import { explorerName, explorerUrl, shortHash, verifyAnchorProof } from '../../lib/tracking/merkle';
import { formatMinorUnits } from '../../lib/money';
import { LocalDate } from '../LocalDate';
import { StatusNotice } from '../States';
import { NO_PUBLIC_ZONE, asTrackingEvent, eventDescription } from './events';
import { StepIcon } from './StepIcon';
import s from './timeline.module.css';
import { zoneOrNone } from '../../lib/location/zoneLabel';

export type Selection =
  | { kind: 'payment' }
  | { kind: 'step'; assetRef: string; index: number };

export interface PaymentFacts { firstClearedAt?: string; lastClearedAt?: string; amount?: string; currency?: string }

/** El paso seleccionado. Se anuncia con `aria-live="polite"` al cambiar (F-A5). */
export function StepDetail({ step, payment, assetTitle, trackingCode, previewClient = fetchEvidencePreview }: {
  step: Transition | null; payment: PaymentFacts | null; assetTitle?: string;
  /** Para pedir la copia censurada con la cabecera (E5b); solo viaja ahí, nunca a la URL de la imagen. */
  trackingCode?: string; previewClient?: typeof fetchEvidencePreview;
}) {
  return (
    <div className={s.detail} aria-live="polite" data-testid="step-detail">
      {payment && <PaymentDetail payment={payment} />}
      {step && <TransitionDetail step={step} assetTitle={assetTitle} trackingCode={trackingCode} previewClient={previewClient} />}
      {!payment && !step && <p className={s.hint}>Elige un paso del recorrido para ver su detalle.</p>}
    </div>
  );
}

function PaymentDetail({ payment }: { payment: PaymentFacts }) {
  const different = payment.lastClearedAt && payment.lastClearedAt !== payment.firstClearedAt;
  return (
    <>
      <span className={s.detailIcon} aria-hidden="true"><StepIcon kind="payment" /></span>
      <b className={s.detailTitle}>Donada</b>
      <p className={s.detailText}>Tu pago se confirmó y el dinero quedó en el fondo de la convocatoria.</p>
      <dl className={s.detailMeta}>
        {payment.amount !== undefined && <><dt>Monto</dt><dd>{formatMinorUnits(payment.amount, payment.currency)}</dd></>}
        <dt>Pago confirmado</dt>
        <dd data-testid="detail-first-cleared">{payment.firstClearedAt ? <LocalDate iso={payment.firstClearedAt} withTime /> : 'Todavía no'}</dd>
        {different && <><dt>Última liquidación</dt><dd data-testid="detail-last-cleared"><LocalDate iso={payment.lastClearedAt!} withTime /></dd></>}
      </dl>
    </>
  );
}

function TransitionDetail({ step, assetTitle, trackingCode, previewClient }: {
  step: Transition; assetTitle?: string; trackingCode?: string; previewClient: typeof fetchEvidencePreview;
}) {
  const known = asTrackingEvent(step.eventType);
  return (
    <>
      <span className={s.detailIcon} aria-hidden="true"><StepIcon kind={known ?? 'unknown'} /></span>
      <b className={s.detailTitle}>{eventLabel(step.eventType)}</b>
      {assetTitle && <span className={s.hint}>{assetTitle}</span>}
      <p className={s.detailText}>{known ? eventDescription(known) : 'Registro del recorrido del lote.'}</p>
      <dl className={s.detailMeta}>
        <dt>Evento</dt><dd><code className={s.mono}>{step.eventType}</code></dd>
        <dt>Custodio responsable</dt><dd>{custodianLabel(step.custodianCategory ?? 'UNCATEGORIZED')}</dd>
        <dt>Zona</dt><dd>{zoneOrNone(step.locationZone, NO_PUBLIC_ZONE)}</dd>
        <dt>Fecha</dt><dd>{step.timestamp ? <LocalDate iso={step.timestamp} withTime /> : 'Sin fecha'}</dd>
        {step.eventHash && <><dt>Huella criptográfica</dt><dd><HashValue hash={step.eventHash} label="Copiar huella" /></dd></>}
        {step.evidenceRegistered !== undefined && (
          <>
            <dt>{step.eventType === 'ASSET_DELIVERED' ? 'Foto de la entrega' : 'Foto del paso'}</dt>
            <dd data-testid="detail-evidence">
              {step.evidenceRegistered
                ? <>{step.eventType === 'ASSET_DELIVERED' ? 'Con foto de entrega' : 'Con foto'}{step.evidenceRef && <> · <HashValue hash={step.evidenceRef} label="Copiar huella de la foto" /></>}</>
                : 'Sin foto'}
            </dd>
          </>
        )}
      </dl>
      {step.evidencePreviewUrl && trackingCode && (
        <EvidencePreview trackingCode={trackingCode} url={step.evidencePreviewUrl} client={previewClient} />
      )}
      <AnchorPill status={step.anchorStatus} />
      <AnchorVerification step={step} />
    </>
  );
}

/**
 * La copia censurada de la foto de entrega (ADR-021-D Enmienda 2, E5b y E6): se pide con `fetch` y la cabecera, se pinta con
 * `URL.createObjectURL` y se revoca al desmontar y al cambiar de paso, incluso si la respuesta llega tarde. El `src` es un
 * `blob:` y nunca lleva el código. Si no carga, no se dice nada más: el hecho (la huella) sigue arriba.
 */
function EvidencePreview({ trackingCode, url, client }: { trackingCode: string; url: string; client: typeof fetchEvidencePreview }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setSrc(null);
    setLoading(true);
    void client(trackingCode, url).then((r) => {
      if (!alive) return;
      if (r.kind === 'ok') {
        objectUrl = URL.createObjectURL(r.data);
        setSrc(objectUrl);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [trackingCode, url, client]);
  if (loading) return <p className={s.hint} data-testid="evidence-preview-loading">Cargando la foto…</p>;
  if (!src) return null;
  return (
    <figure className={s.evidence} data-testid="evidence-preview">
      <img src={src} data-testid="evidence-preview-img" className={s.evidenceImg}
        alt="Foto de la entrega, con las personas y los datos que identifican difuminados" />
      <figcaption className={s.hint}>Una copia difuminada de la foto de la entrega; la original no se publica.</figcaption>
    </figure>
  );
}

/** Recortada a la vista; "Copiar" copia la completa. */
function HashValue({ hash, label }: { hash: string; label: string }) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  useEffect(() => setCopied(null), [hash]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(hash); setCopied('ok'); } catch { setCopied('fail'); }
  };
  return (
    <span className={s.hashRow}>
      <code className={s.hashChip} title={hash} data-testid="hash-short">{shortHash(hash)}</code>
      <button type="button" className={s.linkButton} onClick={() => void copy()} aria-label={label}>Copiar</button>
      <span className={s.copied} aria-live="polite">{copied === 'ok' ? 'Copiada' : copied === 'fail' ? 'No se pudo copiar' : ''}</span>
    </span>
  );
}

export function AnchorPill({ status }: { status?: Transition['anchorStatus'] }) {
  if (!status) return null;
  return (
    <span className={s.anchorPill} data-status={status} data-testid="anchor-pill">
      <StepIcon kind={status === 'ANCHORED' ? 'lock' : status === 'UNDER_REVIEW' ? 'warning' : 'clock'} />
      {anchorStatusLabel(status)}
    </span>
  );
}

type Check = 'idle' | 'checking' | 'match' | 'mismatch' | 'error';

/** "Comprobar en mi navegador" (E1.3) solo con `anchorProof`; sin ella, se explica por qué no se puede. */
function AnchorVerification({ step }: { step: Transition }) {
  const [check, setCheck] = useState<Check>('idle');
  useEffect(() => setCheck('idle'), [step]);
  const proof = step.anchorProof;

  if (step.anchorStatus === 'ANCHORED' && !proof) {
    return <p className={s.hint} data-testid="anchor-legacy">Este paso se ancló en un lote antiguo, antes de que se guardaran las pruebas: su huella no se puede comprobar desde el navegador.</p>;
  }
  if (!proof || !step.eventHash) return null;

  const run = async () => {
    setCheck('checking');
    try {
      setCheck((await verifyAnchorProof(step.eventHash!, proof)) ? 'match' : 'mismatch');
    } catch {
      setCheck('error');
    }
  };
  const url = explorerUrl(proof.network, proof.transactionHash);
  return (
    <div className={s.verify} data-testid="anchor-verify">
      <button type="button" className={s.verifyButton} onClick={() => void run()} disabled={check === 'checking'}>
        Comprobar en mi navegador
      </button>
      {check === 'match' && <div data-testid="verify-result" data-result="match"><StatusNotice variant="success" title="Coincide" text="Con la prueba, la huella de este paso da la raíz que se ancló." /></div>}
      {check === 'mismatch' && <div data-testid="verify-result" data-result="mismatch"><StatusNotice variant="rejected" title="No coincide" text="Con la prueba recibida, la huella de este paso no da la raíz anclada." /></div>}
      {check === 'error' && <StatusNotice variant="info" text="Este navegador no pudo hacer la comprobación." />}
      <p className={s.hint}>
        Se comprueba aquí, sin enviar nada: que la huella de este paso está dentro de la raíz anclada
        {proof.anchoredAt ? <> el <LocalDate iso={proof.anchoredAt} withTime /></> : null}. No comprueba que la huella
        corresponda al contenido del evento, que no se publica: eso lo revisa el servidor en la integridad de tu donación.
      </p>
      {url && (
        <a className={s.txLink} href={url} target="_blank" rel="noopener noreferrer" data-testid="tx-link">
          Ver la transacción en {explorerName(proof.network)}
        </a>
      )}
    </div>
  );
}
