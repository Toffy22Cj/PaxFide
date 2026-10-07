import { parsePublicCampaign, PublicCampaignOutcome } from './publicCampaignModel';


/**
 * Lectura pública de CV-07 desde el servidor Next.js (SSR + OG de `/c`, ADR-046 D7). **Nunca** lleva credenciales:
 * este módulo no importa la sesión ni el cliente autenticado (C1). No registra la ruta (el `publicCode` es un
 * secreto bearer, ADR-041 §2.7).
 */
export async function fetchPublicCampaignOnServer(publicCode: string): Promise<PublicCampaignOutcome> {
  const base = (process.env.API_INTERNAL_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
  if (!base) return { kind: 'error' };
  try {
    const res = await fetch(`${base}/public/campaigns/${encodeURIComponent(publicCode)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 404) return { kind: 'not-found' };
    if (!res.ok) return { kind: 'error' };
    const campaign = parsePublicCampaign(await res.json());
    return campaign ? { kind: 'ok', campaign } : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}
