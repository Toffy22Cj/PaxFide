'use client';

import { apiRequest } from './http';
import { segment } from './config';

/**
 * Comandos de activos (B6-c, `PhysicalAssetController`; matriz §4). Todos con `Command-Id`. Cantidades como texto
 * decimal positivo con hasta 4 decimales, sin signo, exponente ni separador de miles (`RequestFields.QUANTITY`).
 */
export const QUANTITY = /^[0-9]{1,15}(\.[0-9]{1,4})?$/;

/** Normaliza lo que escribe la persona (admite coma decimal) al formato del contrato; `null` si no es válido o es 0. */
export function normalizeQuantity(input: string): string | null {
  const v = input.trim().replace(',', '.');
  if (!QUANTITY.test(v)) return null;
  return /^0+(\.0+)?$/.test(v) ? null : v;
}

const base = (assetRef: string) => `/physical-assets/${segment(assetRef)}`;

export const splitRequest = (assetRef: string) => (payload: unknown) =>
  ({ path: `${base(assetRef)}/split`, body: payload, auth: 'required' as const });
export const dispatchRequest = (assetRef: string) => (payload: unknown) =>
  ({ path: `${base(assetRef)}/dispatch`, body: payload, auth: 'required' as const });
export const receiveRequest = (assetRef: string) => (payload: unknown) =>
  ({ path: `${base(assetRef)}/receive`, body: payload, auth: 'required' as const });
export const deliverRequest = (assetRef: string) => (payload: unknown) =>
  ({ path: `${base(assetRef)}/deliver`, body: payload, auth: 'required' as const });

/** Camino A (compra con el `Fund`): la organización sale del JWT (DD-10). */
export const registerPathARequest = (payload: unknown) =>
  ({ path: '/physical-assets/register', body: payload, auth: 'required' as const });
/** Camino B (donación en especie): el `donorRef` lo genera el servidor (DD-09); el cliente no lo envía. */
export const registerPathBRequest = (payload: unknown) =>
  ({ path: '/physical-assets/from-donation', body: payload, auth: 'required' as const });

/** `202 {parentAssetRef, childAssetRef, status: "PENDING"}`. */
export function parseSplitAccepted(data: unknown): { parentAssetRef: string; childAssetRef: string } | null {
  const d = data as Record<string, unknown> | null;
  return d && typeof d.parentAssetRef === 'string' && typeof d.childAssetRef === 'string'
    ? { parentAssetRef: d.parentAssetRef, childAssetRef: d.childAssetRef } : null;
}

/** `201 {assetRef, status, donationRef?, campaignRef?}`. */
export function parseRegistered(data: unknown): { assetRef: string } | null {
  const d = data as Record<string, unknown> | null;
  return d && typeof d.assetRef === 'string' ? { assetRef: d.assetRef } : null;
}

/** Estados de `SplitResolutionStatus` (D-SPLIT S7). */
export type SplitStatus = 'PENDING' | 'CHILD_CREATED' | 'COMPENSATED' | 'UNRESOLVED' | 'RESOLVED_MANUALLY' | string;

export type SplitStatusOutcome = { kind: 'ok'; status: SplitStatus } | { kind: 'forbidden' } | { kind: 'not-found' } | { kind: 'error' };

/** `GET /physical-assets/{assetRef}/splits/{childAssetRef}` → `{status}`. */
export async function fetchSplitStatus(parentAssetRef: string, childAssetRef: string): Promise<SplitStatusOutcome> {
  const r = await apiRequest<{ status?: unknown }>({
    path: `${base(parentAssetRef)}/splits/${segment(childAssetRef)}`, auth: 'required',
  });
  if (r.kind === 'ok') return typeof r.data?.status === 'string' ? { kind: 'ok', status: r.data.status } : { kind: 'error' };
  if (r.kind === 'error' && r.status === 403) return { kind: 'forbidden' };
  if (r.kind === 'error' && r.status === 404) return { kind: 'not-found' };
  return { kind: 'error' };
}
