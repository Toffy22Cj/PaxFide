'use client';
// Ref: plan-fase7-puesta-al-dia.md U-4, U-5, U-7 (retirar) y U-8; referencia-api-v1.md §3 (logo, ADR-051 F6 y F8,
// Tarea 2), §4 (portada, Tarea 3), §6 (leer la evidencia, Tarea 5) y §2 (`…/media/remove`, F7). Ni el logo ni la portada
// llevan `Command-Id`. Las imágenes privadas se piden con `fetch` y el JWT en `Authorization` (nunca en un `src`);
// nada de la petición se registra.
import { apiRequest } from './http';
import { getApiBase, segment } from './config';
import { getJwt, handle401 } from '../auth/session';

/** 2 MB para el logo y la portada (antes de subir; el backend vuelve a mirar el contenido). */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;

export type MediaError = 'TooLarge' | 'UnsupportedFormat' | 'StorageUnavailable' | 'Forbidden' | 'Unauthorized' | 'Failed';

export function checkImageFile(file: { size: number; type: string }): MediaError | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'UnsupportedFormat';
  if (file.size > IMAGE_MAX_BYTES) return 'TooLarge';
  return null;
}

export function mediaErrorFor(status: number): MediaError {
  switch (status) {
    case 413: return 'TooLarge';
    case 415: return 'UnsupportedFormat';
    case 503: return 'StorageUnavailable';
    case 403: return 'Forbidden';
    case 401: return 'Unauthorized';
    default: return 'Failed';
  }
}

export function mediaErrorText(e: MediaError): string {
  switch (e) {
    case 'TooLarge': return 'La imagen pesa más de 2 MB o es demasiado grande. Elige una más liviana.';
    case 'UnsupportedFormat': return 'La imagen tiene que ser JPEG o PNG.';
    case 'StorageUnavailable': return 'No pudimos guardar la imagen en este momento. Inténtalo de nuevo en unos minutos.';
    case 'Forbidden': return 'Tu papel no puede cambiar esta imagen.';
    case 'Unauthorized': return 'Tu sesión terminó. Vuelve a iniciar sesión.';
    case 'Failed': return 'No pudimos guardar la imagen. Inténtalo de nuevo.';
    default: {
      const unreachable: never = e;
      throw new Error(`Fallo de imagen desconocido: ${String(unreachable)}`);
    }
  }
}

export type UploadOutcome = { kind: 'ok'; url?: string } | { kind: 'error'; error: MediaError } | { kind: 'network' };

/** `PUT` multipart (campo `file`) con progreso por XHR (`fetch` no lo da al subir). */
function putImage(path: string, file: Blob, field: 'logoUrl' | 'coverImageUrl', onProgress?: (f: number) => void): Promise<UploadOutcome> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${getApiBase()}${path}`);
    xhr.setRequestHeader('Accept', 'application/json');
    const jwt = getJwt();
    if (jwt) xhr.setRequestHeader('Authorization', `Bearer ${jwt}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onerror = () => resolve({ kind: 'network' });
    xhr.ontimeout = () => resolve({ kind: 'network' });
    xhr.onload = () => {
      if (xhr.status === 401 && jwt) handle401(false);
      if (xhr.status === 200) {
        let url: string | undefined;
        try { const b = JSON.parse(xhr.responseText || '{}'); url = typeof b[field] === 'string' ? b[field] : undefined; } catch { url = undefined; }
        resolve({ kind: 'ok', url });
        return;
      }
      resolve({ kind: 'error', error: mediaErrorFor(xhr.status) });
    };
    const form = new FormData();
    form.append('file', file, 'imagen');
    xhr.send(form);
  });
}

export type DeleteOutcome = { kind: 'ok' } | { kind: 'error'; error: MediaError } | { kind: 'network' };

async function deleteImage(path: string): Promise<DeleteOutcome> {
  const jwt = getJwt();
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      method: 'DELETE', headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    });
  } catch {
    return { kind: 'network' };
  }
  if (res.status === 401 && jwt) handle401(false);
  return res.status === 204 || res.status === 200 ? { kind: 'ok' } : { kind: 'error', error: mediaErrorFor(res.status) };
}

const logoPath = (orgId: string) => `/organizations/${segment(orgId)}/logo`;
const coverPath = (orgId: string, campaignRef: string) => `/organizations/${segment(orgId)}/campaigns/${segment(campaignRef)}/cover`;

export const uploadLogo = (orgId: string, file: Blob, onProgress?: (f: number) => void) => putImage(logoPath(orgId), file, 'logoUrl', onProgress);
export const deleteLogo = (orgId: string) => deleteImage(logoPath(orgId));
export const uploadCover = (orgId: string, campaignRef: string, file: Blob, onProgress?: (f: number) => void) =>
  putImage(coverPath(orgId, campaignRef), file, 'coverImageUrl', onProgress);
export const deleteCover = (orgId: string, campaignRef: string) => deleteImage(coverPath(orgId, campaignRef));

/** U-4: una imagen con JWT (logo privado o evidencia). 404 y 410 tienen su propio resultado. */
export type PrivateImageOutcome =
  | { kind: 'ok'; blob: Blob }
  | { kind: 'not-found' }
  | { kind: 'removed' }
  | { kind: 'forbidden' }
  | { kind: 'error' };

/**
 * `path` es una ruta de la API (`/organizations/{id}/logo`, `/physical-assets/{ref}/evidence`) o la URL que devolvió el
 * backend (`/api/v1/…`), siempre del mismo origen que la API: nunca se manda el JWT a otro sitio.
 */
export async function fetchPrivateImage(path: string): Promise<PrivateImageOutcome> {
  const url = privateApiUrl(path);
  if (!url) return { kind: 'error' };
  const jwt = getJwt();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: jwt ? { Authorization: `Bearer ${jwt}`, Accept: 'image/*' } : { Accept: 'image/*' },
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    });
  } catch {
    return { kind: 'error' };
  }
  if (res.status === 401 && jwt) handle401(false);
  if (res.status === 200) {
    try { return { kind: 'ok', blob: await res.blob() }; } catch { return { kind: 'error' }; }
  }
  if (res.status === 404) return { kind: 'not-found' };
  if (res.status === 410) return { kind: 'removed' };
  if (res.status === 403) return { kind: 'forbidden' };
  return { kind: 'error' };
}

/** La URL absoluta de una ruta de la API, o `null` si saldría del origen de la API. */
export function privateApiUrl(path: string): string | null {
  try {
    const base = new URL(getApiBase());
    const basePath = base.pathname.replace(/\/+$/, '');
    const full = path.startsWith(basePath + '/') ? new URL(path, base) : new URL(basePath + path, base);
    return full.origin === base.origin && path.startsWith('/') && !path.startsWith('//') ? full.toString() : null;
  } catch {
    return null;
  }
}

/** U-7: retirar una foto (`POST /platform/organizations/{id}/media/remove`). El motivo nunca se guarda ni se registra. */
export type MediaPurpose = 'ORGANIZATION_LOGO' | 'CAMPAIGN_COVER' | 'DELIVERY_EVIDENCE';
export type RemoveOutcome =
  | { kind: 'ok' }
  | { kind: 'not-found' }
  | { kind: 'bad-request' }
  | { kind: 'forbidden' }
  | { kind: 'storage-unavailable' }
  | { kind: 'network' }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

export async function removePlatformMedia(organizationId: string, purpose: MediaPurpose, ref: string | undefined, reason: string): Promise<RemoveOutcome> {
  const r = await apiRequest<unknown>({
    path: `/platform/organizations/${segment(organizationId)}/media/remove`, method: 'POST', auth: 'required',
    body: ref ? { purpose, ref, reason } : { purpose, reason },
  });
  if (r.kind === 'network') return { kind: 'network' };
  if (r.kind === 'ok') return { kind: 'ok' };
  switch (r.status) {
    case 404: return { kind: 'not-found' };
    case 400: return { kind: 'bad-request' };
    case 403: return { kind: 'forbidden' };
    case 503: return { kind: 'storage-unavailable' };
    case 401: return { kind: 'unauthorized' };
    default: return { kind: 'error' };
  }
}
