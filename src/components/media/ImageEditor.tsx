'use client';
// Ref: plan-fase7-puesta-al-dia.md U-5 (logo y portada): la vista previa se muestra antes de subir; "Quitar" pide
// confirmación sin diálogo del navegador; antes de subir se comprueba el límite de 2 MB. Sin `Command-Id`.
import React, { useEffect, useId, useRef, useState } from 'react';
import { checkImageFile, mediaErrorText, type DeleteOutcome, type MediaError, type UploadOutcome } from '../../lib/api/media';
import { Button } from '../ui/Button';
import { Actions } from '../ui/Layout';
import { StatusNotice } from '../States';
import s from './media.module.css';

export function ImageEditor({ what, current, hasImage, upload, remove, onChanged }: {
  /** "logo" o "portada": los textos de los botones salen de aquí ("Cambiar logo", "Quitar portada"). */
  what: 'logo' | 'portada';
  /** La imagen actual (o su inicial) tal como se ve hoy. */
  current: React.ReactNode;
  hasImage: boolean;
  upload: (file: File, onProgress: (f: number) => void) => Promise<UploadOutcome>;
  remove: () => Promise<DeleteOutcome>;
  onChanged: (change: 'uploaded' | 'removed') => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<MediaError | 'network' | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  // La vista previa local también se libera
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | null) => {
    setDone(null);
    setError(null);
    if (!f) { setFile(null); setPreview(null); return; }
    const bad = checkImageFile(f);
    if (bad) { setFile(null); setPreview(null); setError(bad); if (input.current) input.current.value = ''; return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const send = async () => {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    const r = await upload(file, setProgress);
    setBusy(false);
    setProgress(null);
    if (r.kind === 'ok') {
      setFile(null); setPreview(null); if (input.current) input.current.value = '';
      setDone(what === 'logo' ? 'Guardamos el logo.' : 'Guardamos la portada.');
      onChanged('uploaded');
      return;
    }
    setError(r.kind === 'network' ? 'network' : r.error);
  };

  const doRemove = async () => {
    setBusy(true);
    const r = await remove();
    setBusy(false);
    setConfirming(false);
    if (r.kind === 'ok') { setDone(what === 'logo' ? 'Quitamos el logo.' : 'Quitamos la portada.'); onChanged('removed'); return; }
    setError(r.kind === 'network' ? 'network' : r.error);
  };

  const Label = what === 'logo' ? 'logo' : 'portada';
  return (
    <div className={s.editor} data-testid={`image-editor-${what}`}>
      <div className={s.current}>{preview
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={preview} alt={`Vista previa de la ${what === 'logo' ? 'imagen del logo' : 'portada'}`} className={s.preview} data-testid="image-preview" />
        : current}</div>
      {done && <StatusNotice variant="success" text={done} />}
      {error && <StatusNotice variant="rejected" text={error === 'network' ? 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.' : mediaErrorText(error)} />}
      <label htmlFor={inputId} className={s.label}>{`Cambiar ${Label}`}</label>
      <span className={s.hint}>JPEG o PNG, hasta 2 MB. Se guarda sin los datos de la cámara.</span>
      <input ref={input} id={inputId} type="file" accept="image/jpeg,image/png" className={s.file} disabled={busy}
        onChange={(e) => pick(e.target.files?.[0] ?? null)} data-testid={`image-file-${what}`} />
      {progress !== null && (
        <div className={s.progress} role="status" aria-live="polite">
          <span>Subiendo… {Math.round(progress * 100)} %</span>
          <progress max={1} value={progress} aria-label="Progreso de la subida" />
        </div>
      )}
      <Actions>
        {file && <Button onClick={() => void send()} sending={busy}>{`Guardar ${Label}`}</Button>}
        {file && <Button variant="secondary" onClick={() => pick(null)} disabled={busy}>Descartar</Button>}
        {!file && hasImage && !confirming && <Button variant="secondary" onClick={() => setConfirming(true)} disabled={busy}>{`Quitar ${Label}`}</Button>}
      </Actions>
      {confirming && (
        <div className={s.confirm} role="group" aria-label={`Confirmar quitar ${Label}`} data-testid="remove-confirm">
          <p>{what === 'logo' ? '¿Quitar el logo? Se verá la inicial de la organización.' : '¿Quitar la portada? La tarjeta vuelve a su aspecto sin imagen.'}</p>
          <Actions>
            <Button onClick={() => void doRemove()} sending={busy}>Sí, quitar</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Cancelar</Button>
          </Actions>
        </div>
      )}
    </div>
  );
}
