import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { classifyRoute } from '../../../lib/routing/classifier';
import { fetchPublicCampaignOnServer } from '../../../lib/api/publicServer';
import { CampaignPublicScreen } from '../../../screens/CampaignPublicScreen';

/**
 * `/c/:publicCode` — SSR + Open Graph + `noindex` para todas (ADR-046 D7, P-W2). Una convocatoria inexistente
 * responde HTTP 404 con su propio estado de pantalla (P-W3; el backend devuelve 404, S-09). Sin credenciales: el
 * servidor solo hace la lectura pública.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ publicCode: string }> };

const load = cache(async (publicCode: string) => fetchPublicCampaignOnServer(publicCode));

function enabled(publicCode: string) {
  return classifyRoute(`/c/${publicCode}`) !== 'NOT_APPROVED';
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { publicCode } = await params;
  const robots = { index: false, follow: false };
  if (!enabled(publicCode)) return { robots };
  const r = await load(publicCode);
  if (r.kind !== 'ok') return { title: 'Convocatoria — PaxFide', robots };
  const description = r.campaign.description?.slice(0, 200);
  return {
    title: `${r.campaign.title} — PaxFide`,
    description,
    robots,
    // Sin og:url: la URL lleva el publicCode, un secreto bearer (ADR-041 §2.7)
    openGraph: { title: r.campaign.title, description, siteName: 'PaxFide', type: 'website' },
  };
}

export default async function PublicCampaignPage({ params }: Params) {
  const { publicCode } = await params;
  if (!enabled(publicCode)) notFound();
  const initial = await load(publicCode);
  if (initial.kind === 'not-found') notFound();
  return <CampaignPublicScreen publicCode={publicCode} initial={initial} />;
}
