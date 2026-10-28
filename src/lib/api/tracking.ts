'use client';

import { apiRequest } from './http';
import { segment } from './config';
import type { AnchorProof } from '../tracking/merkle';

/**
 * Seguimiento público (TR-01 a TR-03). El `trackingCode` es una credencial y viaja **solo** en
 * `Authorization: Bearer <trackingCode>` (contrato real: `TrackingCodeAuthFilter`), nunca en la ruta ni en la query
 * (C2/H1, DW-01). Nunca lleva el JWT y un 401 nunca toca la sesión (`front-fase2` §4).
 */
function trackingRequest(path: string, trackingCode: string) {
  return apiRequest<unknown>({ path, auth: 'none', headers: { Authorization: `Bearer ${trackingCode}` } });
}

export interface FinancialSnapshot {
  currency?: string;
  originalAmount?: string;
  clearedAmount?: string;
  pendingAllocationAmount?: string;
  confirmedAllocationAmount?: string;
  refundedAmount?: string;
  /** G-2 (nota del 2026-10-23, §8): primer y último `FUNDS_CLEARED`; faltan sin liquidaciones. */
  firstClearedAt?: string;
  lastClearedAt?: string;
}

export interface LogisticsItem {
  assetRef: string;
  lifecycleStatus: string;
  assetType?: string;
  unitOfMeasure?: string;
  quantity?: string;
  locationZone?: string;
  custodianCategory?: string;
  /** G-4 (nota del 2026-10-25, §8): siempre otro ítem de la misma `logistics`; si no, falta. */
  parentAssetRef?: string;
}

export interface DonationTracking {
  financialSnapshot: FinancialSnapshot | null;
  logistics: LogisticsItem[];
  status: string;
  /** G-1 (nota del 2026-10-21, §8): faltan si la donación no tiene convocatoria o no se encuentra. */
  campaignTitle?: string;
  organizationName?: string;
}

export type TrackingOutcome<T> =
  | { kind: 'ok'; data: T }
  /** Código no válido o expirado: un único mensaje (front-fase1 §13). */
  | { kind: 'invalid-code' }
  /** Código válido sin proyección todavía (TR-D1). */
  | { kind: 'not-found' }
  | { kind: 'error' };

const opt = (v: unknown) => (typeof v === 'string' ? v : undefined);
/** Los importes de TR-01 llegan como número JSON (`long`); fuera del rango seguro no se muestran (nunca se aproximan). */
const amount = (v: unknown): string | undefined =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? String(v) : typeof v === 'string' && /^\d+$/.test(v) ? v : undefined;

function outcomeOf<T>(r: Awaited<ReturnType<typeof trackingRequest>>, parse: (d: unknown) => T | null): TrackingOutcome<T> {
  if (r.kind === 'ok') {
    const data = parse(r.data);
    return data ? { kind: 'ok', data } : { kind: 'error' };
  }
  if (r.kind === 'error' && r.status === 401) return { kind: 'invalid-code' };
  if (r.kind === 'error' && r.status === 404) return { kind: 'not-found' };
  return { kind: 'error' };
}

export function parseTracking(data: unknown): DonationTracking | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.status !== 'string') return null;
  const f = d.financialSnapshot as Record<string, unknown> | null | undefined;
  return {
    status: d.status,
    campaignTitle: opt(d.campaignTitle),
    organizationName: opt(d.organizationName),
    financialSnapshot: f && typeof f === 'object' ? {
      currency: opt(f.currency),
      originalAmount: amount(f.originalAmount),
      clearedAmount: amount(f.clearedAmount),
      pendingAllocationAmount: amount(f.pendingAllocationAmount),
      confirmedAllocationAmount: amount(f.confirmedAllocationAmount),
      refundedAmount: amount(f.refundedAmount),
      firstClearedAt: opt(f.firstClearedAt),
      lastClearedAt: opt(f.lastClearedAt),
    } : null,
    logistics: Array.isArray(d.logistics) ? d.logistics
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof (x as any).assetRef === 'string')
      .map((x) => ({
        assetRef: x.assetRef as string,
        lifecycleStatus: opt(x.lifecycleStatus) ?? '',
        assetType: opt(x.assetType),
        unitOfMeasure: opt(x.unitOfMeasure),
        quantity: typeof x.quantity === 'number' ? String(x.quantity) : opt(x.quantity),
        locationZone: opt(x.locationZone),
        custodianCategory: opt(x.custodianCategory),
        parentAssetRef: opt(x.parentAssetRef),
      })) : [],
  };
}

export async function fetchTracking(trackingCode: string): Promise<TrackingOutcome<DonationTracking>> {
  return outcomeOf(await trackingRequest('/donations/tracking', trackingCode), parseTracking);
}

export interface Narrative {
  status: string;
  content?: string;
  source?: string;
}

/** TR-02: 200 disponible; 202 `PENDING` (se generará; "Actualizar" manual); 404 sin proyección. */
export async function fetchNarrative(trackingCode: string): Promise<TrackingOutcome<Narrative>> {
  return outcomeOf(await trackingRequest('/donations/tracking/narrative', trackingCode), (d) => {
    const x = d as Record<string, unknown> | null;
    return x && typeof x.status === 'string' ? { status: x.status, content: opt(x.content), source: opt(x.source) } : null;
  });
}

export interface Transition {
  eventType: string;
  timestamp?: string;
  locationZone?: string;
  custodianCategory?: string;
  status?: string;
  /** G-3 (nota del 2026-10-25, §8): siempre en el contrato; un valor desconocido no se muestra. */
  anchorStatus?: AnchorStatus;
  /** 64 hexadecimales en minúscula; falta en pasos sin evento asociado. */
  eventHash?: string;
  /** Solo con `ANCHORED` y las hojas guardadas (E1). */
  anchorProof?: AnchorProof;
  /** ADR-051 F6: solo en el paso `DELIVERED`. Nunca la imagen ni su URL. */
  evidenceRegistered?: boolean;
  evidenceRef?: string;
}

export const ANCHOR_STATUSES = ['ANCHORED', 'IN_BATCH', 'PENDING', 'UNDER_REVIEW'] as const;
export type AnchorStatus = (typeof ANCHOR_STATUSES)[number];
const HEX64 = /^[0-9a-f]{64}$/;
const EVIDENCE_REF = /^sha256:[0-9a-f]{64}$/;

/** La prueba solo se acepta entera y bien formada; si falta algo, no hay botón (nunca se comprueba a medias). */
export function parseAnchorProof(v: unknown): AnchorProof | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const p = v as Record<string, unknown>;
  if (typeof p.merkleRoot !== 'string' || !HEX64.test(p.merkleRoot)) return undefined;
  if (typeof p.leafIndex !== 'number' || !Number.isSafeInteger(p.leafIndex) || p.leafIndex < 0) return undefined;
  if (!Array.isArray(p.path)) return undefined;
  const path = p.path.map((x) => x as Record<string, unknown>);
  if (!path.every((x) => x && (x.side === 'LEFT' || x.side === 'RIGHT') && typeof x.hash === 'string' && HEX64.test(x.hash))) return undefined;
  if (typeof p.transactionHash !== 'string' || typeof p.network !== 'string' || typeof p.anchoredAt !== 'string') return undefined;
  return {
    merkleRoot: p.merkleRoot, leafIndex: p.leafIndex,
    path: path.map((x) => ({ side: x.side as 'LEFT' | 'RIGHT', hash: x.hash as string })),
    transactionHash: p.transactionHash, network: p.network, anchoredAt: p.anchoredAt,
  };
}

export function parseTransition(t: Record<string, unknown>): Transition {
  const anchorStatus = (ANCHOR_STATUSES as readonly string[]).includes(t.anchorStatus as string) ? t.anchorStatus as AnchorStatus : undefined;
  const eventHash = typeof t.eventHash === 'string' && HEX64.test(t.eventHash) ? t.eventHash : undefined;
  const delivered = t.eventType === 'ASSET_DELIVERED';
  return {
    eventType: t.eventType as string, timestamp: opt(t.timestamp), locationZone: opt(t.locationZone),
    custodianCategory: opt(t.custodianCategory), status: opt(t.status), anchorStatus, eventHash,
    anchorProof: anchorStatus === 'ANCHORED' && eventHash ? parseAnchorProof(t.anchorProof) : undefined,
    evidenceRegistered: delivered && typeof t.evidenceRegistered === 'boolean' ? t.evidenceRegistered : undefined,
    evidenceRef: delivered && typeof t.evidenceRef === 'string' && EVIDENCE_REF.test(t.evidenceRef) ? t.evidenceRef : undefined,
  };
}

/** TR-03: historial público de un activo de la donación. */
export async function fetchAssetHistory(trackingCode: string, assetRef: string): Promise<TrackingOutcome<Transition[]>> {
  return outcomeOf(await trackingRequest(`/donations/tracking/assets/${segment(assetRef)}/history`, trackingCode), (d) => {
    const h = (d as { history?: unknown } | null)?.history;
    if (!Array.isArray(h)) return null;
    return h.filter((t) => t && typeof t.eventType === 'string').map((t) => parseTransition(t));
  });
}

export interface IntegrityBatch {
  anchorStatus: string;
  merkleRoot?: string;
  transactionHash?: string;
  network?: string;
  anchoredAt?: string;
  confirmedBlockNumber?: number;
  eventsOfThisDonation: number;
  result: 'MATCH' | 'MISMATCH' | 'INCONCLUSIVE';
  reason?: string;
  reasonText?: string;
  affectsThisDonation?: boolean;
}

export interface DonationIntegrity {
  batches: IntegrityBatch[];
  unanchoredEvents: number;
  checkedAt?: string;
}

const RESULTS = ['MATCH', 'MISMATCH', 'INCONCLUSIVE'] as const;
const count = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : 0);

export function parseIntegrity(data: unknown): DonationIntegrity | null {
  const d = data as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || !Array.isArray(d.batches)) return null;
  return {
    unanchoredEvents: count(d.unanchoredEvents),
    checkedAt: opt(d.checkedAt),
    batches: d.batches.filter((b): b is Record<string, any> => !!b && typeof b === 'object' && typeof (b as any).anchorStatus === 'string')
      .map((b) => {
        const v = (b.verification ?? {}) as Record<string, unknown>;
        // Un resultado desconocido nunca se presenta como "coincide": se trata como no concluyente
        const result = RESULTS.includes(v.result as any) ? v.result as IntegrityBatch['result'] : 'INCONCLUSIVE';
        return {
          anchorStatus: b.anchorStatus, merkleRoot: opt(b.merkleRoot), transactionHash: opt(b.transactionHash),
          network: opt(b.network), anchoredAt: opt(b.anchoredAt),
          confirmedBlockNumber: typeof b.confirmedBlockNumber === 'number' ? b.confirmedBlockNumber : undefined,
          eventsOfThisDonation: count(b.eventsOfThisDonation),
          result, reason: opt(v.reason), reasonText: opt(v.reasonText),
          affectsThisDonation: typeof v.affectsThisDonation === 'boolean' ? v.affectsThisDonation : undefined,
        };
      }),
  };
}

/**
 * Integridad de la donación (S-22, backend `d169dda`): `GET /donations/tracking/integrity` con el código en
 * `Authorization`, como TR-01. Solo lectura; el backend guarda el resultado 5 min por lote (DD-76).
 */
export async function fetchIntegrity(trackingCode: string): Promise<TrackingOutcome<DonationIntegrity>> {
  return outcomeOf(await trackingRequest('/donations/tracking/integrity', trackingCode), parseIntegrity);
}
