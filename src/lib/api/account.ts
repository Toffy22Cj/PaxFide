'use client';

import { apiRequest } from './http';

/** `GET /account/donations` (B6-b; ADR-048): sin seudónimo ni `donorRef`; `trackingCode` solo con fondos aplicados. */
export interface AccountDonation {
  intentId: string;
  campaignTitle?: string;
  amount: string;
  currency?: string;
  status: string;
  trackingCode?: string;
}

export type AccountDonationsOutcome =
  | { kind: 'ok'; items: AccountDonation[] }
  | { kind: 'forbidden' }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

const opt = (v: unknown) => (typeof v === 'string' ? v : undefined);

export async function fetchAccountDonations(): Promise<AccountDonationsOutcome> {
  const r = await apiRequest<{ items?: unknown }>({ path: '/account/donations', auth: 'required' });
  if (r.kind === 'ok') {
    const items = r.data?.items;
    if (!Array.isArray(items)) return { kind: 'error' };
    return {
      kind: 'ok',
      items: items.filter((i) => i && typeof i.intentId === 'string' && typeof i.amount === 'string' && typeof i.status === 'string')
        .map((i) => ({
          intentId: i.intentId, campaignTitle: opt(i.campaignTitle), amount: i.amount, currency: opt(i.currency),
          status: i.status, trackingCode: opt(i.trackingCode),
        })),
    };
  }
  if (r.kind === 'error' && r.status === 401) return { kind: 'unauthorized' };
  if (r.kind === 'error' && r.status === 403) return { kind: 'forbidden' };
  return { kind: 'error' };
}
