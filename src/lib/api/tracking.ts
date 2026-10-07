'use client';

import { apiRequest } from './http';
import { segment } from './config';

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
}

export interface LogisticsItem {
  assetRef: string;
  lifecycleStatus: string;
  assetType?: string;
  unitOfMeasure?: string;
  quantity?: string;
  locationZone?: string;
  custodianCategory?: string;
}

export interface DonationTracking {
  financialSnapshot: FinancialSnapshot | null;
  logistics: LogisticsItem[];
  status: string;
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
    financialSnapshot: f && typeof f === 'object' ? {
      currency: opt(f.currency),
      originalAmount: amount(f.originalAmount),
      clearedAmount: amount(f.clearedAmount),
      pendingAllocationAmount: amount(f.pendingAllocationAmount),
      confirmedAllocationAmount: amount(f.confirmedAllocationAmount),
      refundedAmount: amount(f.refundedAmount),
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
}

/** TR-03: historial público de un activo de la donación. */
export async function fetchAssetHistory(trackingCode: string, assetRef: string): Promise<TrackingOutcome<Transition[]>> {
  return outcomeOf(await trackingRequest(`/donations/tracking/assets/${segment(assetRef)}/history`, trackingCode), (d) => {
    const h = (d as { history?: unknown } | null)?.history;
    if (!Array.isArray(h)) return null;
    return h.filter((t) => t && typeof t.eventType === 'string').map((t) => ({
      eventType: t.eventType, timestamp: opt(t.timestamp), locationZone: opt(t.locationZone),
      custodianCategory: opt(t.custodianCategory), status: opt(t.status),
    }));
  });
}
