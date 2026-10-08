'use client';

import { segment } from './config';
import { apiRequest } from './http';
import { ListOutcome, AdminCampaign } from './campaignAdmin';
import type { PublicCampaign } from './publicCampaignModel';

/**
 * Configuración de una convocatoria (Enmienda 4 de ADR-037; DD-73). La misma forma que CV-01. Con `MONETARY`
 * mantenido, meta, política, moneda y `onTargetReached` no cambian (409 `MonetaryTermsChangeNotSupported`).
 */
export interface CampaignConfiguration {
  acceptedDonationTypes: string[];
  acceptedPaymentMethods: string[];
  currency?: string;
  targetAmount?: string;
  targetPolicy?: string;
  onTargetReached?: string;
}

/**
 * D-10: no hay lectura de la configuración actual. Se compone con la página pública (CV-07: tipos, medios, moneda y
 * meta) y el listado de la organización (política). `onTargetReached` no se lee: con `CLOSE_ON_TARGET` no se puede
 * reenviar la configuración monetaria sin cambiarla, y la web lo dice en vez de inventarla (devuelve `null`).
 */
export function currentConfiguration(campaign: AdminCampaign, pub: PublicCampaign): CampaignConfiguration | null {
  const monetary = pub.acceptedDonationTypes.includes('MONETARY');
  if (monetary && campaign.targetPolicy === 'CLOSE_ON_TARGET') return null;
  return {
    acceptedDonationTypes: [...pub.acceptedDonationTypes].sort(),
    acceptedPaymentMethods: [...pub.acceptedPaymentMethods].sort(),
    ...(monetary ? {
      currency: pub.currency ?? campaign.currency, targetAmount: pub.targetAmount ?? campaign.targetAmount, targetPolicy: campaign.targetPolicy,
    } : {}),
  };
}

export interface ChangeRequest {
  requestId: string;
  status: string;
  baseConfigurationVersion: number;
  proposedConfiguration: CampaignConfiguration;
  requestedBy?: string;
  requestedAt?: string;
  decidedBy?: string;
  decidedAt?: string;
  resultingConfigurationVersion?: number;
}

const strs = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
const opt = (v: unknown) => (typeof v === 'string' ? v : undefined);
const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : undefined);

export async function fetchChangeRequests(campaignRef: string): Promise<ListOutcome<ChangeRequest>> {
  const r = await apiRequest<{ items?: unknown }>({ path: `/campaigns/${segment(campaignRef)}/configuration-change-requests`, auth: 'required' });
  if (r.kind === 'ok' && Array.isArray(r.data?.items)) {
    return {
      kind: 'ok',
      items: r.data!.items.filter((x: any) => x && typeof x.requestId === 'string').map((x: any) => ({
        requestId: x.requestId, status: String(x.status), baseConfigurationVersion: int(x.baseConfigurationVersion) ?? 0,
        proposedConfiguration: {
          acceptedDonationTypes: strs(x.proposedConfiguration?.acceptedDonationTypes),
          acceptedPaymentMethods: strs(x.proposedConfiguration?.acceptedPaymentMethods),
          currency: opt(x.proposedConfiguration?.currency), targetAmount: opt(x.proposedConfiguration?.targetAmount),
          targetPolicy: opt(x.proposedConfiguration?.targetPolicy), onTargetReached: opt(x.proposedConfiguration?.onTargetReached),
        },
        requestedBy: opt(x.requestedBy), requestedAt: opt(x.requestedAt), decidedBy: opt(x.decidedBy), decidedAt: opt(x.decidedAt),
        resultingConfigurationVersion: int(x.resultingConfigurationVersion),
      })),
    };
  }
  if (r.kind === 'error' && r.status === 403) return { kind: 'forbidden' };
  if (r.kind === 'error' && r.status === 401) return { kind: 'unauthorized' };
  return { kind: 'error' };
}

/** Versiones conocidas en esta sesión (respuestas de edición y aprobación): solo memoria. */
const knownVersions = new Map<string, number>();

export function rememberVersion(campaignRef: string, version: unknown) {
  if (typeof version === 'number' && Number.isInteger(version) && version >= 1) {
    knownVersions.set(campaignRef, Math.max(version, knownVersions.get(campaignRef) ?? 1));
  }
}

/**
 * D-10: versión deducida, sin lectura que la dé. La inicial es 1; cada aprobación deja `resultingConfigurationVersion`;
 * una solicitud pendiente se hizo sobre `baseConfigurationVersion`; y las ediciones hechas en esta sesión se recuerdan.
 * Una edición directa de otra persona no deja rastro: el backend responde 409 `ConfigurationVersionConflict`.
 */
export function deriveVersion(campaignRef: string, requests: ChangeRequest[]): number {
  let v = knownVersions.get(campaignRef) ?? 1;
  for (const r of requests) {
    if (r.resultingConfigurationVersion) v = Math.max(v, r.resultingConfigurationVersion);
    if (r.status === 'PENDING') v = Math.max(v, r.baseConfigurationVersion);
  }
  return v;
}

const base = (campaignRef: string) => `/campaigns/${segment(campaignRef)}`;

/** Edición directa (solo sin donaciones): `{expectedConfigurationVersion, configuration}` → `200 {campaignRef, configurationVersion}`. */
export const editConfigurationRequest = (campaignRef: string) => (payload: unknown) => ({
  path: `${base(campaignRef)}/configuration`, body: payload, auth: 'required' as const,
});

/** Solicitud de cambio: el mismo cuerpo → `201 {requestId, status: "PENDING", baseConfigurationVersion}`. */
export const requestConfigurationChangeRequest = (campaignRef: string) => (payload: unknown) => ({
  path: `${base(campaignRef)}/configuration-change-requests`, body: payload, auth: 'required' as const,
});

/** Aprobar (otro `ADMINISTRATOR` o el `REPRESENTATIVE`; la propia → 403 `SelfApprovalNotAllowed`) o rechazar. */
export const decideChangeRequest = (campaignRef: string, requestId: string, decision: 'approve' | 'reject') => () => ({
  path: `${base(campaignRef)}/configuration-change-requests/${segment(requestId)}/${decision}`, body: undefined, auth: 'required' as const,
});
