'use client';

import { segment } from './config';
import { apiRequest } from './http';
import { ListOutcome } from './campaignAdmin';

const opt = (v: unknown) => (typeof v === 'string' ? v : undefined);
const digits = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) ? v : undefined);

function listOutcome<T>(r: Awaited<ReturnType<typeof apiRequest<{ items?: unknown }>>>, map: (x: any) => T | null): ListOutcome<T> {
  if (r.kind === 'ok' && Array.isArray(r.data?.items)) {
    return { kind: 'ok', items: r.data!.items.map(map).filter((x: T | null): x is T => x !== null) };
  }
  if (r.kind === 'error' && r.status === 403) return { kind: 'forbidden' };
  if (r.kind === 'error' && r.status === 401) return { kind: 'unauthorized' };
  return { kind: 'error' };
}

/**
 * `GET /organizations/{id}/funds` (S-04 resuelta; DD-31): `ADMINISTRATOR` o `EMPLOYEE`; una página de 200; sin
 * `donorRef`. Importes en unidades mínimas (D-01 resuelta en la referencia).
 */
export interface Allocation {
  allocationId: string;
  amount: string;
  status: string;
}

export interface Fund {
  fundId: string;
  campaignRef?: string;
  currency: string;
  clearedAmount: string;
  availableAmount: string;
  allocations: Allocation[];
}

export async function fetchFunds(organizationId: string): Promise<ListOutcome<Fund>> {
  const r = await apiRequest<{ items?: unknown }>({ path: `/organizations/${segment(organizationId)}/funds`, auth: 'required' });
  return listOutcome(r, (f) => {
    if (!f || typeof f.fundId !== 'string' || typeof f.currency !== 'string') return null;
    const cleared = digits(f.clearedAmount);
    const available = digits(f.availableAmount);
    if (cleared === undefined || available === undefined) return null;
    return {
      fundId: f.fundId, campaignRef: opt(f.campaignRef), currency: f.currency, clearedAmount: cleared, availableAmount: available,
      allocations: Array.isArray(f.allocations)
        ? f.allocations.filter((a: any) => a && typeof a.allocationId === 'string' && digits(a.amount) !== undefined)
          .map((a: any) => ({ allocationId: a.allocationId, amount: a.amount, status: String(a.status) }))
        : [],
    };
  });
}

/** `GET /organizations/{id}/physical-assets` (DD-54): `ADMINISTRATOR` o `EMPLOYEE`; una página de 200; sin `donorRef`. */
export interface OrgAsset {
  assetRef: string;
  lifecycleStatus: string;
  currentCustodianRef?: string;
  currentLocation?: string;
  quantity?: string;
  unitOfMeasure?: string;
  campaignRef?: string;
}

export async function fetchOrganizationAssets(organizationId: string): Promise<ListOutcome<OrgAsset>> {
  const r = await apiRequest<{ items?: unknown }>({ path: `/organizations/${segment(organizationId)}/physical-assets`, auth: 'required' });
  return listOutcome(r, (a) => (a && typeof a.assetRef === 'string' ? {
    assetRef: a.assetRef, lifecycleStatus: String(a.lifecycleStatus), currentCustodianRef: opt(a.currentCustodianRef),
    currentLocation: opt(a.currentLocation), quantity: opt(a.quantity), unitOfMeasure: opt(a.unitOfMeasure), campaignRef: opt(a.campaignRef),
  } : null));
}

/** `POST /funds/{fundId}/allocations` con `{amount}` → `201 {allocationId, status: "REQUESTED"}` (`ADMINISTRATOR`, `Command-Id`). */
export const requestAllocationRequest = (fundId: string) => (payload: unknown) => ({
  path: `/funds/${segment(fundId)}/allocations`, body: payload, auth: 'required' as const,
});

/** `POST /funds/{fundId}/allocations/{allocationId}/confirm` (sin cuerpo) → `200 {allocationId, status: "CONFIRMED"}` (DD-32). */
export const confirmAllocationRequest = (fundId: string, allocationId: string) => () => ({
  path: `/funds/${segment(fundId)}/allocations/${segment(allocationId)}/confirm`, body: undefined, auth: 'required' as const,
});

/**
 * Verificación de organizaciones (plataforma): `verify` y `reject` sin cuerpo; `request-information` con
 * `{message}` (1–2000). `200 {organizationId, verificationStatus}`; 404 inexistente; 409 si ya está resuelta (DD-48).
 */
export type PlatformDecision = 'verify' | 'reject' | 'request-information';

export const platformDecisionRequest = (organizationId: string, decision: PlatformDecision) => (payload: unknown) => ({
  path: `/platform/organizations/${segment(organizationId)}/${decision}`,
  body: decision === 'request-information' ? payload : undefined,
  auth: 'required' as const,
});
