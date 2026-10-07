/** CV-07 (`PublicCampaignResponse`, B6-a): nulos omitidos; importes como texto en unidades mínimas. */
export interface PublicCampaign {
  organizationName?: string;
  title: string;
  description?: string;
  status: 'OPEN' | 'CLOSED' | string;
  startDate: string;
  endDate: string;
  acceptedDonationTypes: string[];
  acceptedPaymentMethods: string[];
  currency?: string;
  targetAmount?: string;
  clearedAmount?: string;
}

export type PublicCampaignOutcome =
  | { kind: 'ok'; campaign: PublicCampaign }
  | { kind: 'not-found' }
  | { kind: 'error' };

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Solo los campos de CV-07; cualquier otro se descarta. */
export function parsePublicCampaign(data: unknown): PublicCampaign | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.title !== 'string' || typeof d.status !== 'string' || typeof d.startDate !== 'string'
    || typeof d.endDate !== 'string') return null;
  return {
    organizationName: str(d.organizationName),
    title: d.title,
    description: str(d.description),
    status: d.status,
    startDate: d.startDate,
    endDate: d.endDate,
    acceptedDonationTypes: strings(d.acceptedDonationTypes),
    acceptedPaymentMethods: strings(d.acceptedPaymentMethods),
    currency: str(d.currency),
    targetAmount: str(d.targetAmount),
    clearedAmount: str(d.clearedAmount),
  };
}

