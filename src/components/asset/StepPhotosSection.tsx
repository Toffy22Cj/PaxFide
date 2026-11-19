'use client';
// Ref: plan-fotos-tarea5-web.md §3.3 y §3.4; ADR-051 Enmienda 2 E2-5 (publicación con confirmación explícita; la decisión queda
// registrada) y E2-6 (quién ve qué). «Pasos y fotos» en la ficha del lote: la foto original de cada paso la ven los miembros
// de la organización con cualquier rol y la plataforma; la copia censurada de la entrega, también; PUBLICARLA para el
// donante es solo del `ADMINISTRATOR`. Es representación: el backend autoriza (403 uniforme) y un 403 nunca se muestra como éxito.
import React, { useCallback, useEffect, useId, useState } from 'react';
import {
  redactedPath, stepEvidenceClient, stepPhotoPath, type PublicationDecision, type ReadStep, type SetPublicationOutcome,
  type StepEvidenceClient, type StepEvidenceItem,
} from '../../lib/api/stepEvidence';
import { fetchPrivateImage, type PrivateImageOutcome } from '../../lib/api/media';
import type { PrincipalState } from '../../lib/auth/usePrincipal';
import { LocalDate } from '../LocalDate';
import { Button } from '../ui/Button';
import { Actions, Surface } from '../ui/Layout';
import { ErrorState, LoadingState, StatusNotice } from '../States';
import { PrivateImage, type PrivateImageState } from '../media/PrivateImage';
import s from '../media/media.module.css';

const STEP_LABEL: Record<ReadStep, string> = { registered: 'Registro', dispatched: 'Despacho', received: 'Recepción', delivered: 'Entrega' };
const REMOVED = 'La plataforma retiró esta foto.';

function imageText(state: PrivateImageState): string | null {
  switch (state) {
    case 'loading': case 'ok': return null;
    case 'not-found': return 'Sin foto en este paso.';
    case 'removed': return REMOVED;
    case 'forbidden': return 'Tu cuenta no puede ver las fotos de este lote.';
    case 'error': return 'No pudimos cargar la foto. Recarga la página para intentarlo de nuevo.';
    default: { const unreachable: never = state; throw new Error(`Estado desconocido: ${String(unreachable)}`); }
  }
}

function publicationText(kind: Exclude<SetPublicationOutcome['kind'], 'ok'>): string {
  switch (kind) {
    case 'forbidden': return 'Tu cuenta no puede cambiar la publicación de esta foto.';
    case 'not-generated': return 'La copia todavía no está generada. Recarga la página e inténtalo de nuevo.';
    case 'removed': return REMOVED;
    case 'network': return 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.';
    case 'error': return 'No pudimos cambiar la publicación. Inténtalo de nuevo.';
    default: { const unreachable: never = kind; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
  }
}

type Img = (path: string) => Promise<PrivateImageOutcome>;

function StepPhoto({ assetRef, item, imageClient }: { assetRef: string; item: StepEvidenceItem; imageClient: Img }) {
  const [state, setState] = useState<PrivateImageState>('loading');
  const shown = item.hasPhoto && !item.removed;
  const text = item.removed ? REMOVED : !item.hasPhoto ? 'Sin foto en este paso.' : imageText(state);
  return (
    <li className={s.stepItem} data-testid="step-photo" data-step={item.step}>
      <span className={s.stepHead}>{STEP_LABEL[item.step]} · evento {item.sequence} · <LocalDate iso={item.occurredAt} withTime compact /></span>
      {shown && (
        <PrivateImage path={stepPhotoPath(assetRef, item.step, item.sequence)} alt={`Foto del paso «${STEP_LABEL[item.step]}»`} className={s.stepImg}
          client={imageClient} onState={setState} fallback={state === 'loading' ? <LoadingState /> : null} />
      )}
      {text && <p className={s.hint}>{text}</p>}
    </li>
  );
}

/** Publicar: la casilla EXPLÍCITA nace sin marcar y «Publicar» queda deshabilitado hasta marcarla (E2-5). */
function PublishConfirm({ onConfirm, onCancel, busy }: { onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  const id = useId();
  const [checked, setChecked] = useState(false);
  return (
    <div className={s.confirm} role="group" aria-label="Confirmar publicación">
      <label className={s.check} htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} disabled={busy} />
        <span>Revisé la copia y no se reconoce a ninguna persona</span>
      </label>
      <Actions>
        <Button onClick={onConfirm} disabled={!checked} sending={busy}>Publicar</Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Button>
      </Actions>
    </div>
  );
}

function RedactedCopy({ assetRef, isAdmin, client, imageClient }: { assetRef: string; isAdmin: boolean; client: StepEvidenceClient; imageClient: Img }) {
  const [state, setState] = useState<PrivateImageState>('loading');
  const [pub, setPub] = useState<{ published: boolean; decisions: PublicationDecision[] } | null>(null);
  const [pubError, setPubError] = useState(false);
  const [mode, setMode] = useState<'idle' | 'publish' | 'unpublish'>('idle');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const readPublication = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await client.publication(assetRef);
      if (r.kind === 'ok') { setPub({ published: r.published, decisions: r.decisions }); setPubError(false); } else setPubError(true);
    } catch { setPubError(true); }
  }, [assetRef, client, isAdmin]);
  useEffect(() => { void readPublication(); }, [readPublication]);

  const change = async (publish: boolean) => {
    setBusy(true);
    setProblem(null);
    let r: SetPublicationOutcome;
    try { r = await client.setPublication(assetRef, publish); } catch { r = { kind: 'error' }; }
    setBusy(false);
    if (r.kind !== 'ok') { setProblem(publicationText(r.kind)); return; }
    setMode('idle');
    await readPublication();
  };

  const text = imageText(state);
  return (
    <li className={s.copy} data-testid="redacted-copy">
      <span className={s.stepHead}>Copia censurada de la entrega</span>
      <PrivateImage path={redactedPath(assetRef)} alt="Copia censurada de la foto de la entrega" className={s.stepImg}
        client={imageClient} onState={setState} fallback={state === 'loading' ? <LoadingState /> : null} />
      {text && <p className={s.hint}>{state === 'not-found' ? 'Esta entrega no tiene foto.' : text}</p>}
      <p className={s.hint}>
        Esta es una vista pixelada de la foto de la entrega: no sirve para leer ni verificar a simple vista. Es lo único que el donante
        vería, y solo si el administrador la publica.
      </p>
      {!isAdmin && <p className={s.hint}>Solo el administrador de la organización puede publicar la copia.</p>}
      {isAdmin && pubError && <p className={s.stepError}>No pudimos leer el estado de la publicación. Recarga la página.</p>}
      {isAdmin && pub && state === 'ok' && (
        <>
          {pub.published
            ? <StatusNotice variant="success" text="Publicada para el donante." />
            : <p className={s.hint}>No está publicada: el donante no ve ninguna foto de la entrega.</p>}
          {problem && <StatusNotice variant="rejected" text={problem} />}
          {mode === 'idle' && (
            <Actions>
              {pub.published
                ? <Button variant="secondary" onClick={() => { setProblem(null); setMode('unpublish'); }}>Despublicar</Button>
                : <Button onClick={() => { setProblem(null); setMode('publish'); }}>Publicar para el donante</Button>}
            </Actions>
          )}
          {mode === 'publish' && <PublishConfirm busy={busy} onConfirm={() => void change(true)} onCancel={() => setMode('idle')} />}
          {mode === 'unpublish' && (
            <div className={s.confirm} role="group" aria-label="Confirmar despublicación">
              <p>¿Despublicar? El donante dejará de ver la copia.</p>
              <Actions>
                <Button onClick={() => void change(false)} sending={busy}>Sí, despublicar</Button>
                <Button variant="secondary" onClick={() => setMode('idle')} disabled={busy}>Cancelar</Button>
              </Actions>
            </div>
          )}
          {pub.decisions.length > 0 && (
            <ol className={s.decisions} aria-label="Historial de decisiones">
              {pub.decisions.map((d, i) => (
                <li key={`${d.at}-${i}`} data-testid="publication-decision">
                  {d.action === 'PUBLISH' ? 'Publicó' : 'Despublicó'} · {d.by} · <LocalDate iso={d.at} withTime compact />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </li>
  );
}

export function StepPhotosSection({ assetRef, principal, client = stepEvidenceClient, imageClient = fetchPrivateImage }: {
  assetRef: string;
  principal: PrincipalState;
  client?: StepEvidenceClient;
  imageClient?: Img;
}) {
  const member = principal.status === 'ready' && !!(principal.data.organizationId || principal.data.platformAuthority);
  const isAdmin = principal.status === 'ready' && !!principal.data.organizationId && principal.data.roles.includes('ADMINISTRATOR');
  const [list, setList] = useState<{ kind: 'loading' } | { kind: 'ok'; items: StepEvidenceItem[] } | { kind: 'forbidden' } | { kind: 'error' }>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!member) return;
    let alive = true;
    setList({ kind: 'loading' });
    client.list(assetRef).catch(() => ({ kind: 'error' } as const)).then((r) => { if (alive) setList(r); });
    return () => { alive = false; };
  }, [assetRef, client, member, attempt]);

  if (!member) return null;
  const items = list.kind === 'ok' ? list.items : [];
  const delivered = items.filter((i) => i.step === 'delivered');
  const others = items.filter((i) => i.step !== 'delivered');
  return (
    <Surface title="Pasos y fotos">
      {list.kind === 'loading' && <LoadingState />}
      {list.kind === 'forbidden' && <p className={s.hint}>Tu cuenta no puede ver las fotos de este lote.</p>}
      {list.kind === 'error' && <ErrorState onRetry={() => setAttempt((a) => a + 1)} />}
      {list.kind === 'ok' && items.length === 0 && <p className={s.hint}>Todavía no hay pasos con foto en este lote.</p>}
      {list.kind === 'ok' && items.length > 0 && (
        <ul className={s.stepList}>
          {others.map((i) => <StepPhoto key={`${i.step}-${i.sequence}`} assetRef={assetRef} item={i} imageClient={imageClient} />)}
          {/* La foto original de la entrega ya se ve en «Foto de la entrega»; aquí va su copia censurada */}
          {delivered.map((i) => (i.removed
            ? <li key={`d-${i.sequence}`} className={s.stepItem}><span className={s.stepHead}>Entrega</span><p className={s.hint}>{REMOVED}</p></li>
            : i.hasPhoto
              ? <RedactedCopy key={`d-${i.sequence}`} assetRef={assetRef} isAdmin={isAdmin} client={client} imageClient={imageClient} />
              : null))}
        </ul>
      )}
    </Surface>
  );
}
