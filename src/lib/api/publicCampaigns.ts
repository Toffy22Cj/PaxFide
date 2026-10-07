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
