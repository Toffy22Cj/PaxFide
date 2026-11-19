'use client';
// Ref: plan-fotos-tarea5-web.md §3.1; ADR-051 Enmienda 2 E2-8 (comodidad). Una zona para elegir o arrastrar y soltar una
// imagen, con vista previa local (`URL.createObjectURL`, revocada al cambiar y al desmontar). No sube nada: devuelve el
// `File`; quien la usa sube en el momento de confirmar. La comprobación (`check`) es de quien la usa: la foto de un paso
// admite 5 MB y la portada o el logo, 2 MB.
import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import s from './media.module.css';

export function PhotoPicker({ label, hint, value, onChange, check, disabled, accept = 'image/jpeg,image/png', previewAlt = 'Vista previa de la foto', removeLabel = 'Quitar foto', changeLabel = 'Cambiar foto', testId, inputTestId = 'photo-input', previewTestId = 'photo-preview', previewClassName, idle, hideActions, camera = true }: {
  label: string;
  hint?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  /** Devuelve el texto del problema o `null` si la imagen sirve. Un archivo rechazado nunca llega a `onChange`. */
  check: (file: File) => string | null;
  disabled?: boolean;
  accept?: string;
  previewAlt?: string;
  removeLabel?: string;
  changeLabel?: string;
  testId?: string;
  inputTestId?: string;
  previewTestId?: string;
  previewClassName?: string;
  /** Lo que se ve mientras no hay vista previa (p. ej. la imagen actual del logo). */
  idle?: React.ReactNode;
  /** Quien lo usa pone sus propios botones («Descartar», «Guardar»). */
  hideActions?: boolean;
  /** Pide la cámara trasera en el móvil (fotos de paso). El logo y la portada eligen de la galería. */
  camera?: boolean;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // La vista previa sigue al valor; la anterior se revoca al cambiar y al desmontar
  useEffect(() => {
    if (!value) { setPreview(null); if (input.current) input.current.value = ''; return; }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const take = (file: File | null | undefined) => {
    if (disabled || !file) return;
    const bad = check(file);
    if (bad) { setProblem(bad); if (input.current) input.current.value = ''; return; }
    setProblem(null);
    onChange(file);
  };
  const clear = () => { setProblem(null); if (input.current) input.current.value = ''; onChange(null); };

  return (
    <div className={s.picker} data-testid={testId}>
      <label htmlFor={inputId} className={s.label}>{label}</label>
      {hint && <span className={s.hint}>{hint}</span>}
      <div
        data-testid="photo-drop"
        className={`${s.drop} ${over ? s.dropOver : ''}`}
        onDragOver={(e) => { if (disabled) return; e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer?.files?.[0]); }}
      >
        {preview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={preview} alt={previewAlt} className={previewClassName ?? s.pickerPreview} data-testid={previewTestId} />
          : (idle ?? <span className={s.hint}>Arrastra una foto aquí o elígela.</span>)}
        <input ref={input} id={inputId} type="file" accept={accept} capture={camera ? 'environment' : undefined} className={s.file} disabled={disabled}
          aria-invalid={problem ? true : undefined} onChange={(e) => take(e.target.files?.[0])} data-testid={inputTestId} />
      </div>
      {problem && <span className={s.pickerError} role="alert">{problem}</span>}
      {value && !hideActions && (
        <div className={s.pickerActions}>
          <Button variant="secondary" onClick={() => input.current?.click()} disabled={disabled}>{changeLabel}</Button>
          <Button variant="secondary" onClick={clear} disabled={disabled}>{removeLabel}</Button>
        </div>
      )}
    </div>
  );
}
