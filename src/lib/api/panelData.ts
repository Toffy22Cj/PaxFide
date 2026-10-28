'use client';

// Ref: referencia-api-v1.md §3 (ficha R-6, Bloque B, G-6: `GET …/funds/monthly`; Bloque D, G-7: `GET …/integrity` y
// G-8: `GET …/activity`, con sus Enmiendas 2 y 3); plan-fase7-puesta-al-dia.md P-3. Solo lectura, sin `Command-Id`.
import { apiRequest } from './http';
import { segment } from './config';

export type ReadOutcome<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'forbidden' }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

const opt = (v: unknown) => (typeof v === 'string' ? v : undefined);
const count = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null);

function outcome<T>(r: Awaited<ReturnType<typeof apiRequest<unknown>>>, parse: (d: unknown) => T | null): ReadOutcome<T> {
  if (r.kind === 'ok') {
    const data = parse(r.data);
    return data ? { kind: 'ok', data } : { kind: 'error' };
  }
  if (r.kind === 'error' && r.status === 401) return { kind: 'unauthorized' };
  if (r.kind === 'error' && r.status === 403) return { kind: 'forbidden' };
  return { kind: 'error' };
}

/** G-6: una fila por mes y moneda, del más antiguo al actual, con los meses vacíos en "0". */
export interface MonthlyCleared {
  timezone: string;
  items: { month: string; currency: string; clearedAmount: string }[];
  truncated: boolean;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function fetchMonthlyCleared(organizationId: string, months = 6): Promise<ReadOutcome<MonthlyCleared>> {
  const r = await apiRequest<unknown>({ path: `/organizations/${segment(organizationId)}/funds/monthly?months=${months}`, auth: 'required' });
  return outcome(r, (d) => {
    const x = d as Record<string, unknown> | null;
    if (!x || typeof x.timezone !== 'string' || !Array.isArray(x.items)) return null;
    return {
      timezone: x.timezone,
      truncated: x.truncated === true,
      items: x.items.filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
        .filter((i) => typeof i.month === 'string' && MONTH.test(i.month) && typeof i.currency === 'string'
          && typeof i.clearedAmount === 'string' && /^\d+$/.test(i.clearedAmount))
        .map((i) => ({ month: i.month as string, currency: i.currency as string, clearedAmount: i.clearedAmount as string })),
    };
  });
}

/** El mes "AAAA-MM" de un instante en una zona horaria (la del backend: los meses se cuentan allí). */
export function monthIn(timezone: string, now: number): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(now));
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    if (y && m) return `${y}-${m}`;
  } catch { /* zona desconocida: UTC */ }
  return new Date(now).toISOString().slice(0, 7);
}

/** Nombre del mes en español ("octubre") de un "AAAA-MM". */
export function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('es', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
}

/** G-7: solo `ADMINISTRATOR` o `REPRESENTATIVE`. */
export interface OrgIntegrity {
  unanchoredEvents: number;
  inPendingBatches: number;
  underReviewEvents: number;
  lastAnchoredAt?: string;
  truncated: boolean;
  checkedAt?: string;
}

export async function fetchOrgIntegrity(organizationId: string): Promise<ReadOutcome<OrgIntegrity>> {
  const r = await apiRequest<unknown>({ path: `/organizations/${segment(organizationId)}/integrity`, auth: 'required' });
  return outcome(r, (d) => {
    const x = d as Record<string, unknown> | null;
    if (!x) return null;
    const u = count(x.unanchoredEvents), p = count(x.inPendingBatches), rv = count(x.underReviewEvents);
    if (u === null || p === null || rv === null) return null;
    return { unanchoredEvents: u, inPendingBatches: p, underReviewEvents: rv, lastAnchoredAt: opt(x.lastAnchoredAt), truncated: x.truncated === true, checkedAt: opt(x.checkedAt) };
  });
}

/** G-8: los tipos del contrato. Uno desconocido no se muestra (nunca se inventa su texto). */
export const ACTIVITY_TYPES = [
  'ASSET_REGISTERED', 'ASSET_DISPATCHED', 'ASSET_RECEIVED', 'ASSET_DELIVERED', 'ASSET_SPLIT', 'FUNDS_CLEARED', 'CAMPAIGN_CLOSED', 'BATCH_ANCHORED',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface ActivityItem {
  type: ActivityType;
  occurredAt: string;
  subject?: { kind: 'ASSET' | 'CAMPAIGN' | 'FUND'; ref: string };
  eventCount?: number;
  quantity?: string;
  unitOfMeasure?: string;
  locationZone?: string;
}

export interface ActivityPage { items: ActivityItem[]; nextCursor?: string; truncated: boolean }

export function parseActivity(d: unknown): ActivityPage | null {
  const x = d as Record<string, unknown> | null;
  if (!x || !Array.isArray(x.items)) return null;
  const items: ActivityItem[] = [];
  for (const raw of x.items) {
    if (!raw || typeof raw !== 'object') continue;
    const i = raw as Record<string, unknown>;
    if (!(ACTIVITY_TYPES as readonly string[]).includes(i.type as string) || typeof i.occurredAt !== 'string') continue;
    const s = i.subject as Record<string, unknown> | undefined;
    const subject = s && (s.kind === 'ASSET' || s.kind === 'CAMPAIGN' || s.kind === 'FUND') && typeof s.ref === 'string'
      ? { kind: s.kind, ref: s.ref } as ActivityItem['subject'] : undefined;
    items.push({
      type: i.type as ActivityType, occurredAt: i.occurredAt,
      // BATCH_ANCHORED nunca lleva sujeto (P-R6D-1 (b))
      subject: i.type === 'BATCH_ANCHORED' ? undefined : subject,
      eventCount: count(i.eventCount) ?? undefined,
      quantity: typeof i.quantity === 'number' ? String(i.quantity) : opt(i.quantity),
      unitOfMeasure: opt(i.unitOfMeasure), locationZone: opt(i.locationZone),
    });
  }
  return { items, nextCursor: opt(x.nextCursor), truncated: x.truncated === true };
}

export async function fetchActivity(organizationId: string, cursor?: string): Promise<ReadOutcome<ActivityPage>> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return outcome(await apiRequest<unknown>({ path: `/organizations/${segment(organizationId)}/activity${qs}`, auth: 'required' }), parseActivity);
}
