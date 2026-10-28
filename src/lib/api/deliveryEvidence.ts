'use client';
// Ref: plan-fase7-puesta-al-dia.md R-4 y U-3; referencia-api-v1.md §6, notas del 2026-10-25 (ADR-051 T4) y del
// 2026-10-26 (410): la foto de la entrega se sube ANTES de entregar, a `POST /organizations/{id}/delivery-evidence`
// (multipart, campo `file`, JPEG o PNG, como mucho 5 MB binarios; sin `Command-Id`) → `201 {evidenceRef}`. La entrega
// usa ese `evidenceRef`. El JWT solo va en `Authorization` (ADR-046 D2/D3); nada de la petición se registra.
import { getJwt, handle401 } from '../auth/session';
import { getApiBase } from './config';

/** 5 MB binarios, como `MediaPurpose.DELIVERY_EVIDENCE` del backend (5 × 1024 × 1024). */
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_TYPES = ['image/jpeg', 'image/png'] as const;

/** Fallos con nombre (regla 4): los del contrato y los que se detectan antes de subir. */
export type EvidenceError =
  | 'TooLarge' // antes de subir, o 413 ImageTooLarge
  | 'UnsupportedFormat' // antes de subir por el tipo, o 415 UnsupportedImageFormat (por el contenido)
  | 'Removed' // 410 EvidenceRemoved: la plataforma retiró esa misma foto
  | 'StorageUnavailable' // 503 MediaStorageUnavailable
  | 'Forbidden' // 403 (quien no puede entregar u otra organización)
  | 'Unauthorized' // 401: la sesión se cierra (T-1)
  | 'Failed'; // cualquier otra respuesta

export type EvidenceUpload =
  | { kind: 'ok'; evidenceRef: string }
  | { kind: 'error'; error: EvidenceError }
  | { kind: 'network' };

/** `sha256:` y 64 hexadecimales en minúscula: lo único que el backend acepta como `evidenceRef` en la entrega. */
export const EVIDENCE_REF = /^sha256:[0-9a-f]{64}$/;

/** Comprobación antes de subir (lógica pura): tamaño y tipo declarado. El backend vuelve a mirar el contenido. */
export function checkEvidenceFile(file: { size: number; type: string }): EvidenceError | null {
  if (!(EVIDENCE_TYPES as readonly string[]).includes(file.type)) return 'UnsupportedFormat';
  if (file.size > EVIDENCE_MAX_BYTES) return 'TooLarge';
  return null;
}

export function evidenceErrorFor(status: number): EvidenceError {
  switch (status) {
    case 413: return 'TooLarge';
    case 415: return 'UnsupportedFormat';
    case 410: return 'Removed';
    case 503: return 'StorageUnavailable';
    case 403: return 'Forbidden';
    case 401: return 'Unauthorized';
    default: return 'Failed';
  }
}

/** Textos de cada fallo (U-3: cada uno con el suyo). */
export function evidenceErrorText(error: EvidenceError): string {
  switch (error) {
    case 'TooLarge': return 'La foto pesa más de 5 MB. Elige una más liviana.';
    case 'UnsupportedFormat': return 'La foto tiene que ser JPEG o PNG.';
    case 'Removed': return 'La plataforma retiró esta foto. Toma una nueva.';
    case 'StorageUnavailable': return 'No pudimos guardar la foto en este momento. Inténtalo de nuevo en unos minutos.';
    case 'Forbidden': return 'Tu cuenta no puede registrar entregas de esta organización.';
    case 'Unauthorized': return 'Tu sesión terminó. Vuelve a iniciar sesión.';
    case 'Failed': return 'No pudimos subir la foto. Inténtalo de nuevo.';
    default: {
      const unreachable: never = error;
      throw new Error(`Fallo de evidencia desconocido: ${String(unreachable)}`);
    }
  }
}

/**
 * Sube la foto con XMLHttpRequest para poder mostrar el progreso (`fetch` no lo da al subir). `onProgress` recibe de 0
 * a 1. Sin reintento automático: si falla, la persona decide.
 */
export function uploadDeliveryEvidence(organizationId: string, file: Blob, onProgress?: (fraction: number) => void): Promise<EvidenceUpload> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getApiBase()}/organizations/${encodeURIComponent(organizationId)}/delivery-evidence`);
    xhr.setRequestHeader('Accept', 'application/json');
    const jwt = getJwt();
    if (jwt) xhr.setRequestHeader('Authorization', `Bearer ${jwt}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onerror = () => resolve({ kind: 'network' });
    xhr.ontimeout = () => resolve({ kind: 'network' });
    xhr.onload = () => {
      if (xhr.status === 401 && jwt) handle401(false);
      if (xhr.status === 201) {
        let ref: unknown = null;
        try { ref = (JSON.parse(xhr.responseText) as { evidenceRef?: unknown }).evidenceRef; } catch { ref = null; }
        resolve(typeof ref === 'string' && EVIDENCE_REF.test(ref) ? { kind: 'ok', evidenceRef: ref } : { kind: 'error', error: 'Failed' });
        return;
      }
      resolve({ kind: 'error', error: evidenceErrorFor(xhr.status) });
    };
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}
