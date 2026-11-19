'use client';
// Ref: plan-fotos-tarea5-web.md §3.1 y §3.2; ADR-051 Enmienda 2 E2-1 (opcional), E2-2 (la huella queda sellada al escribir el
// evento) y E2-3 (nunca se bloquea el paso). La foto se sube al CONFIRMAR el paso (`prepare`), no al elegirla; el
// `evidenceRef` ya subido se conserva: un reintento por ambigüedad repite el mismo comando sin volver a subir (patrón de
// `DeliverModal`). Si la subida falla, el comando no sale hasta que la persona vuelve a confirmar o elige «Seguir sin foto».
import React, { useCallback, useRef, useState } from 'react';
import { checkEvidenceFile, evidenceErrorText, type EvidenceError, type EvidenceUpload } from '../../lib/api/deliveryEvidence';
import { stepEvidenceErrorText, uploadStepEvidence, type EvidenceStep } from '../../lib/api/stepEvidence';
import { PhotoPicker } from '../media/PhotoPicker';
import { Button } from '../ui/Button';
import { StatusNotice } from '../States';
import s from '../media/media.module.css';

export type StepUpload = (organizationId: string, step: EvidenceStep, file: Blob, onProgress?: (f: number) => void) => Promise<EvidenceUpload>;
export type PhotoPrepared = { kind: 'none' } | { kind: 'ok'; evidenceRef: string } | { kind: 'blocked' };

export interface StepPhoto {
  /** Sin organización conocida no hay dónde subir: el campo no se ofrece. */
  available: boolean;
  step: EvidenceStep;
  file: File | null;
  setFile: (f: File | null) => void;
  progress: number | null;
  error: EvidenceError | 'network' | null;
  busy: boolean;
  /** Sube si hace falta. `none`: sin foto; `ok`: con su `evidenceRef`; `blocked`: falló y la persona decide. */
  prepare: () => Promise<PhotoPrepared>;
  /** «Seguir sin foto»: quita la foto y el fallo. No confirma nada por sí solo. */
  skip: () => void;
}

export function useStepPhoto({ organizationId, step, upload = uploadStepEvidence }: { organizationId: string | null | undefined; step: EvidenceStep; upload?: StepUpload }): StepPhoto {
  const [file, setFileState] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<EvidenceError | 'network' | null>(null);
  /** El `evidenceRef` de la foto ya subida: otra foto, otra subida. */
  const uploaded = useRef<string | null>(null);

  const setFile = useCallback((f: File | null) => { uploaded.current = null; setError(null); setFileState(f); }, []);

  const prepare = useCallback(async (): Promise<PhotoPrepared> => {
    if (!file || !organizationId) return { kind: 'none' };
    if (uploaded.current) return { kind: 'ok', evidenceRef: uploaded.current };
    setError(null);
    setProgress(0);
    let r: EvidenceUpload;
    try { r = await upload(organizationId, step, file, setProgress); } catch { r = { kind: 'network' }; }
    setProgress(null);
    if (r.kind === 'network') { setError('network'); return { kind: 'blocked' }; }
    if (r.kind === 'error') { setError(r.error); return { kind: 'blocked' }; }
    uploaded.current = r.evidenceRef;
    return { kind: 'ok', evidenceRef: r.evidenceRef };
  }, [file, organizationId, step, upload]);

  return {
    available: !!organizationId, step, file, setFile, progress, error, busy: progress !== null, prepare,
    skip: () => setFile(null),
  };
}

const check = (f: File) => { const e = checkEvidenceFile(f); return e ? evidenceErrorText(e) : null; };

export function StepPhotoField({ photo, disabled, afterConfirm = false }: {
  photo: StepPhoto;
  disabled?: boolean;
  /** `true` cuando el comando ya salió (ambiguo): la foto no se puede cambiar. */
  afterConfirm?: boolean;
}) {
  if (!photo.available) return null;
  const locked = disabled || photo.busy || afterConfirm;
  return (
    <div data-testid="step-photo-field">
      <PhotoPicker label="Foto (opcional)" value={photo.file} onChange={photo.setFile} check={check} disabled={locked}
        hint="JPEG o PNG, hasta 5 MB. Se guarda sin la ubicación ni los datos de la cámara. Después de confirmar el paso, la foto ya no se puede cambiar." />
      {photo.progress !== null && (
        <div className={s.progress} role="status" aria-live="polite">
          <span>Subiendo la foto… {Math.round(photo.progress * 100)} %</span>
          <progress max={1} value={photo.progress} aria-label="Progreso de la subida" />
        </div>
      )}
      {photo.error && (
        <>
          <StatusNotice variant="rejected" text={photo.error === 'network'
            ? 'No pudimos conectar para subir la foto. Revisa tu conexión e inténtalo de nuevo.'
            : stepEvidenceErrorText(photo.error, photo.step)} />
          <p className={s.hint}>Puedes volver a confirmar para reintentar, o seguir sin la foto: el paso no depende de ella.</p>
          <Button variant="secondary" onClick={photo.skip} disabled={locked}>Seguir sin foto</Button>
        </>
      )}
    </div>
  );
}
