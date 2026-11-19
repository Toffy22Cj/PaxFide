'use client';
// Ref: plan-fotos-tarea5-web.md §3.1, §3.3 y §3.4; ADR-051 Enmienda 2 (E2-1, E2-5, E2-6); referencia-api-v1.md §6 (notas del
// 2026-11-19, Tareas 2 y 3). La foto de un paso se sube ANTES del comando, a `POST /organizations/{id}/asset-evidence`
// (multipart `file` y `step`, JPEG o PNG, 5 MB) → `201 {evidenceRef}`; el comando la usa. El JWT solo va en
// `Authorization` (ADR-046 D2/D3); nada de la petición se registra. La foto de la entrega sigue en `deliveryEvidence.ts`.
import { getJwt, handle401 } from '../auth/session';
import { apiRequest } from './http';
import { getApiBase, segment } from './config';
import {
  EVIDENCE_REF, evidenceErrorFor, evidenceErrorText, type EvidenceError, type EvidenceUpload,
} from './deliveryEvidence';

/** Los pasos que aceptan foto al subirla (en mayúsculas, como el campo `step` del backend). */
export type EvidenceStep = 'REGISTERED' | 'DISPATCHED' | 'RECEIVED';
/** Los pasos al leer (en minúsculas); `delivered` es la entrega. */
export type ReadStep = 'registered' | 'dispatched' | 'received' | 'delivered';
const READ_STEPS: readonly ReadStep[] = ['registered', 'dispatched', 'received', 'delivered'];

export function uploadStepEvidence(organizationId: string, step: EvidenceStep, file: Blob, onProgress?: (fraction: number) => void): Promise<EvidenceUpload> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getApiBase()}/organizations/${encodeURIComponent(organizationId)}/asset-evidence`);
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
    form.append('step', step);
    xhr.send(form);
  });
}

/** Los textos de la entrega, salvo el de `Forbidden`, que dice lo que corresponde al paso. */
export function stepEvidenceErrorText(error: EvidenceError, step: EvidenceStep): string {
  if (error !== 'Forbidden') return evidenceErrorText(error);
  switch (step) {
    case 'REGISTERED': return 'Tu cuenta no puede registrar lotes con foto en esta organización.';
    case 'DISPATCHED': return 'Tu cuenta no puede despachar lotes con foto en esta organización.';
    case 'RECEIVED': return 'Tu cuenta no puede recibir lotes con foto en esta organización.';
    default: { const unreachable: never = step; throw new Error(`Paso desconocido: ${String(unreachable)}`); }
  }
}

export const stepPhotoPath = (assetRef: string, step: ReadStep | EvidenceStep, sequence?: number) =>
  `/physical-assets/${segment(assetRef)}/evidence/${step.toLowerCase()}${sequence === undefined ? '' : `?sequence=${sequence}`}`;
export const redactedPath = (assetRef: string) => `/physical-assets/${segment(assetRef)}/evidence/redacted`;
const publicationPath = (assetRef: string) => `${redactedPath(assetRef)}/publication`;

export interface StepEvidenceItem { step: ReadStep; sequence: number; occurredAt: string; hasPhoto: boolean; removed: boolean }
export type StepListOutcome = { kind: 'ok'; items: StepEvidenceItem[] } | { kind: 'forbidden' } | { kind: 'error' };

export interface PublicationDecision { action: 'PUBLISH' | 'UNPUBLISH'; at: string; by: string; confirmNoIdentifiablePerson: boolean | null }
export type PublicationOutcome = { kind: 'ok'; published: boolean; decisions: PublicationDecision[] } | { kind: 'forbidden' } | { kind: 'error' };
export type SetPublicationOutcome =
  | { kind: 'ok' } | { kind: 'forbidden' } | { kind: 'not-generated' } | { kind: 'removed' } | { kind: 'error' } | { kind: 'network' };

function toItem(x: unknown): StepEvidenceItem | null {
  const d = x as Record<string, unknown> | null;
  if (!d || typeof d.step !== 'string' || typeof d.sequence !== 'number' || typeof d.occurredAt !== 'string') return null;
  const step = d.step.toLowerCase() as ReadStep;
  if (!READ_STEPS.includes(step)) return null;
  return { step, sequence: d.sequence, occurredAt: d.occurredAt, hasPhoto: d.hasPhoto === true, removed: d.removed === true };
}

function toDecision(x: unknown): PublicationDecision | null {
  const d = x as Record<string, unknown> | null;
  if (!d || (d.action !== 'PUBLISH' && d.action !== 'UNPUBLISH') || typeof d.at !== 'string' || typeof d.by !== 'string') return null;
  return { action: d.action, at: d.at, by: d.by, confirmNoIdentifiablePerson: typeof d.confirmNoIdentifiablePerson === 'boolean' ? d.confirmNoIdentifiablePerson : null };
}

/** El cliente que usan las pantallas; los tests lo sustituyen entero. */
export interface StepEvidenceClient {
  list: (assetRef: string) => Promise<StepListOutcome>;
  publication: (assetRef: string) => Promise<PublicationOutcome>;
  setPublication: (assetRef: string, publish: boolean) => Promise<SetPublicationOutcome>;
}

export const stepEvidenceClient: StepEvidenceClient = {
  async list(assetRef) {
    const r = await apiRequest<unknown>({ path: `/physical-assets/${segment(assetRef)}/evidence/steps`, auth: 'required' });
    if (r.kind === 'ok' && Array.isArray(r.data)) {
      return { kind: 'ok', items: r.data.map(toItem).filter((i): i is StepEvidenceItem => i !== null) };
    }
    return r.kind === 'error' && r.status === 403 ? { kind: 'forbidden' } : { kind: 'error' };
  },
  async publication(assetRef) {
    const r = await apiRequest<unknown>({ path: publicationPath(assetRef), auth: 'required' });
    if (r.kind === 'ok') {
      const d = r.data as Record<string, unknown> | null;
      if (d && typeof d.published === 'boolean' && Array.isArray(d.decisions)) {
        return { kind: 'ok', published: d.published, decisions: d.decisions.map(toDecision).filter((x): x is PublicationDecision => x !== null) };
      }
    }
    return r.kind === 'error' && r.status === 403 ? { kind: 'forbidden' } : { kind: 'error' };
  },
  async setPublication(assetRef, publish) {
    const r = await apiRequest<unknown>({
      path: publicationPath(assetRef), method: publish ? 'PUT' : 'DELETE', auth: 'required',
      ...(publish ? { body: { confirmNoIdentifiablePerson: true } } : {}),
    });
    if (r.kind === 'network') return { kind: 'network' };
    if (r.kind === 'ok') return { kind: 'ok' };
    switch (r.status) {
      case 403: return { kind: 'forbidden' };
      case 409: return { kind: 'not-generated' };
      case 410: return { kind: 'removed' };
      default: return { kind: 'error' };
    }
  },
};
