'use client';

import { apiRequest } from './http';
import { segment } from './config';
import { parsePublicCampaign, PublicCampaign, PublicCampaignOutcome } from './publicCampaignModel';

export type { PublicCampaign, PublicCampaignOutcome };

/** Sin JWT nunca (ruta pública). En SSR también: el servidor Next.js no posee credenciales (D3). */
export async function fetchPublicCampaign(publicCode: string): Promise<PublicCampaignOutcome> {
  const r = await apiRequest<unknown>({ path: `/public/campaigns/${segment(publicCode)}`, auth: 'none' });
  if (r.kind === 'ok') {
    const campaign = parsePublicCampaign(r.data);
    return campaign ? { kind: 'ok', campaign } : { kind: 'error' };
  }
  if (r.kind === 'error' && r.status === 404) return { kind: 'not-found' };
  return { kind: 'error' };
}

/** CV-11, respuesta `201 {intentId, statusToken?, paymentRedirectUrl?}`. */
export interface CreatedIntent {
  intentId: string;
  statusToken?: string;
  paymentRedirectUrl?: string;
}

export function parseCreatedIntent(data: unknown): CreatedIntent | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.intentId !== 'string') return null;
  return { intentId: d.intentId, statusToken: optStr(d.statusToken), paymentRedirectUrl: optStr(d.paymentRedirectUrl) };
}

function optStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export function donationIntentRequest(publicCode: string) {
  return (payload: unknown) => ({
    path: `/public/campaigns/${segment(publicCode)}/donation-intents`,
    body: payload,
    // JWT opcional: con sesión, el donorRef lo deriva el backend de la cuenta (ADR-048); sin ella, anónimo
    auth: 'optional' as const,
  });
}

export type IntentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED_UNKNOWN' | 'FUNDING_REJECTED';

export type IntentStatusOutcome =
  | { kind: 'ok'; status: string; trackingCode?: string }
  /** El mismo 404 para intención inexistente o token ausente, incorrecto o caducado (Enmienda 3 de ADR-037, D6). */
  | { kind: 'not-found' }
  | { kind: 'error' };

/** El `statusToken` va solo en la cabecera `Intent-Token`, nunca en la ruta ni en la query. */
export async function fetchIntentStatus(intentId: string, statusToken: string): Promise<IntentStatusOutcome> {
  const r = await apiRequest<unknown>({
    path: `/public/donation-intents/${segment(intentId)}`,
    auth: 'none',
    headers: { 'Intent-Token': statusToken },
  });
  if (r.kind === 'ok') {
    const d = r.data as Record<string, unknown> | null;
    if (!d || typeof d.status !== 'string') return { kind: 'error' };
    return { kind: 'ok', status: d.status, trackingCode: optStr(d.trackingCode) };
  }
  if (r.kind === 'error' && r.status === 404) return { kind: 'not-found' };
  return { kind: 'error' };
}

/** `GET /public/campaigns?cursor=` (P2.6; DD-52/53): solo `PUBLIC` y `OPEN`; cursor opaco; sin `nextCursor` al final. */
export interface DiscoveryItem {
  publicCode: string;
  title: string;
  organizationName?: string;
  status: string;
  startDate: string;
  endDate: string;
  acceptedDonationTypes: string[];
  currency?: string;
  targetAmount?: string;
  clearedAmount?: string;
}

export type DiscoveryOutcome = { kind: 'ok'; items: DiscoveryItem[]; nextCursor?: string } | { kind: 'error' };

export async function fetchDiscovery(cursor?: string): Promise<DiscoveryOutcome> {
  const r = await apiRequest<{ items?: unknown; nextCursor?: unknown }>({
    path: `/public/campaigns${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, auth: 'none',
  });
  if (r.kind !== 'ok' || !Array.isArray(r.data?.items)) return { kind: 'error' };
  const items = r.data.items.filter((i: any) => i && typeof i.publicCode === 'string' && typeof i.title === 'string')
    .map((i: any) => ({
      publicCode: i.publicCode, title: i.title, organizationName: optStr(i.organizationName), status: String(i.status),
      startDate: String(i.startDate), endDate: String(i.endDate),
      acceptedDonationTypes: Array.isArray(i.acceptedDonationTypes) ? i.acceptedDonationTypes : [],
      currency: optStr(i.currency), targetAmount: optStr(i.targetAmount), clearedAmount: optStr(i.clearedAmount),
    }));
  return { kind: 'ok', items, nextCursor: optStr(r.data.nextCursor) };
}

/** `GET /public/campaigns/{publicCode}/narrative` (ADR-040; B5): relato generado + hechos deterministas. */
export interface CampaignFacts {
  status?: string;
  currency?: string;
  targetAmount?: string;
  clearedAmount?: string;
  unitsDelivered?: string;
  distinctRecipients?: number;
}

export type CampaignNarrativeOutcome =
  | { kind: 'ok'; status: 'AVAILABLE' | 'PENDING' | 'UNAVAILABLE' | string; content?: string; source?: string; facts: CampaignFacts | null }
  | { kind: 'not-found' }
  | { kind: 'error' };

export async function fetchCampaignNarrative(publicCode: string): Promise<CampaignNarrativeOutcome> {
  const r = await apiRequest<any>({ path: `/public/campaigns/${segment(publicCode)}/narrative`, auth: 'none' });
  if (r.kind === 'error' && r.status === 404) return { kind: 'not-found' };
  if (r.kind !== 'ok' || !r.data || typeof r.data.status !== 'string') return { kind: 'error' };
  const f = r.data.facts;
  const facts: CampaignFacts | null = f && typeof f === 'object' ? {
    status: optStr(f.status), currency: optStr(f.currency), targetAmount: optStr(f.targetAmount),
    clearedAmount: optStr(f.clearedAmount), unitsDelivered: optStr(f.unitsDelivered),
    distinctRecipients: typeof f.distinctRecipients === 'number' && Number.isSafeInteger(f.distinctRecipients) ? f.distinctRecipients : undefined,
  } : null;
  return { kind: 'ok', status: r.data.status, content: optStr(r.data.content), source: optStr(r.data.source), facts };
}
