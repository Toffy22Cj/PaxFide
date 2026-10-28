'use client';
// Ref: plan-fase7-puesta-al-dia.md R-4 y U-3; referencia-api-v1.md §6, notas del 2026-10-25 (ADR-051 T4, F5) y del
// 2026-10-26 (410); ADR-046 D6 (máquina de comandos sin Outbox). "Foto de la entrega" sustituye a "Evidencia
// (referencia)": 1) se comprueba el tamaño y el tipo; 2) se sube (sin `Command-Id`, con progreso); 3) con su
// `evidenceRef` se entrega con `useCommand`. Un reintento por ambigüedad repite la MISMA petición (mismo `Command-Id` y
// mismo `evidenceRef`) sin volver a subir la foto.
import React, { useEffect, useId, useRef, useState } from 'react';
import { useCommand } from '../../lib/commands/useCommand';
import { deliverRequest } from '../../lib/api/assetCommands';
import {
  checkEvidenceFile, evidenceErrorText, uploadDeliveryEvidence, type EvidenceError, type EvidenceUpload,
} from '../../lib/api/deliveryEvidence';
import { Modal } from '../ui/Modal';
import { TextField } from '../ui/Field';
import { Button } from '../ui/Button';
import { Actions, uiClasses as ui } from '../ui/Layout';
import { StatusNotice } from '../States';
import { CommandFeedback } from '../CommandFeedback';
import s from './DeliverModal.module.css';

const REF_FIELDS = [
  { name: 'finalCustodianRef', label: 'Custodio final (referencia)' },
  { name: 'beneficiaryRef', label: 'Beneficiario (referencia)', hint: 'Una referencia, nunca datos personales.' },
  { name: 'locationRef', label: 'Lugar de entrega (referencia)' },
] as const;
type RefName = (typeof REF_FIELDS)[number]['name'];

type Upload = (organizationId: string, file: Blob, onProgress?: (f: number) => void) => Promise<EvidenceUpload>;

export function DeliverModal({ assetRef, organizationId, onSuccess, onClose, upload = uploadDeliveryEvidence }: {
  assetRef: string;
  /** La organización de la sesión (`GET /me`): la foto se sube a la suya. Sin ella no se puede subir. */
  organizationId: string | null;
  onSuccess: () => void;
  onClose: () => void;
  upload?: Upload;
}) {
  const fileId = useId();
  const [values, setValues] = useState<Record<RefName, string>>({ finalCustodianRef: '', beneficiaryRef: '', locationRef: '' });
  const [errors, setErrors] = useState<Partial<Record<RefName | 'file', string>>>({});
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<EvidenceError | 'network' | 'no-organization' | null>(null);
  /** El `evidenceRef` de la foto ya subida: si la persona vuelve a confirmar, no se sube otra vez. */
  const evidenceRef = useRef<string | null>(null);
  const command = useCommand(deliverRequest(assetRef));
  const uploading = progress !== null;
  const sending = uploading || command.state === 'SENDING';

  useEffect(() => {
    if (command.state === 'SUCCESS') onSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command.state]);

  const pick = (f: File | null) => {
    setFile(f);
    evidenceRef.current = null; // otra foto: otra subida
    setUploadError(null);
    setErrors((e) => ({ ...e, file: f ? (checkEvidenceFile(f) ? evidenceErrorText(checkEvidenceFile(f)!) : undefined) : undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<RefName | 'file', string>> = {};
    const payload: Record<string, string> = {};
    for (const f of REF_FIELDS) {
      const raw = values[f.name].trim();
      if (!raw) next[f.name] = 'Este campo es obligatorio.';
      else if (raw.length > 256) next[f.name] = 'Valor no válido.';
      else payload[f.name] = raw;
    }
    if (!file) next.file = 'Toma o elige la foto de la entrega.';
    else {
      const bad = checkEvidenceFile(file);
      if (bad) next.file = evidenceErrorText(bad); // 6 MB o un tipo que no es imagen: no se sube
    }
    setErrors(next);
    if (Object.values(next).some(Boolean) || !file) return;
    if (!organizationId) { setUploadError('no-organization'); return; }

    setUploadError(null);
    if (!evidenceRef.current) {
      setProgress(0);
      const r = await upload(organizationId, file, setProgress);
      setProgress(null);
      if (r.kind === 'network') { setUploadError('network'); return; }
      if (r.kind === 'error') { setUploadError(r.error); return; }
      evidenceRef.current = r.evidenceRef;
    }
    void command.execute({ ...payload, evidenceRef: evidenceRef.current });
  };

  const locked = sending || command.state === 'AMBIGUOUS';
  return (
    <Modal title="Entregar activo" onCancel={onClose}>
      <div className={ui.modalText}>Registra la entrega final. Después el activo queda en solo lectura. La hora la pone el servidor.</div>
      <form onSubmit={(e) => void submit(e)} noValidate>
        {REF_FIELDS.map((f) => (
          <TextField key={f.name} label={f.label} hint={'hint' in f ? f.hint : undefined} value={values[f.name]} autoComplete="off"
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} error={errors[f.name]} disabled={locked} />
        ))}
        <div className={s.field}>
          <label htmlFor={fileId} className={s.label}>Foto de la entrega</label>
          <span id={`${fileId}-hint`} className={s.hint}>JPEG o PNG, hasta 5 MB. Se guarda sin la ubicación ni los datos de la cámara.</span>
          <input id={fileId} type="file" accept="image/jpeg,image/png" capture="environment" className={s.file}
            aria-describedby={`${fileId}-hint${errors.file ? ` ${fileId}-error` : ''}`} aria-invalid={errors.file ? true : undefined}
            onChange={(e) => pick(e.target.files?.[0] ?? null)} disabled={locked} data-testid="evidence-file" />
          {errors.file && <span id={`${fileId}-error`} className={s.error}>{errors.file}</span>}
        </div>
        {uploading && (
          <div className={s.progress} role="status" aria-live="polite">
            <span>Subiendo la foto… {Math.round((progress ?? 0) * 100)} %</span>
            <progress max={1} value={progress ?? 0} aria-label="Progreso de la subida" />
          </div>
        )}
        {uploadError && (
          <StatusNotice variant="rejected" text={uploadError === 'network'
            ? 'No pudimos conectar para subir la foto. Revisa tu conexión e inténtalo de nuevo.'
            : uploadError === 'no-organization'
              ? 'No pudimos saber a qué organización pertenece tu cuenta. Recarga la página e inténtalo de nuevo.'
              : evidenceErrorText(uploadError)} />
        )}
        <CommandFeedback command={command} />
        <Actions>
          <Button variant="secondary" onClick={onClose} disabled={sending}>Cancelar</Button>
          {command.state !== 'AMBIGUOUS' && <Button type="submit" sending={sending}>Confirmar</Button>}
        </Actions>
      </form>
    </Modal>
  );
}
