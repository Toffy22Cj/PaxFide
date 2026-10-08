'use client';

import React from 'react';
import Link from 'next/link';
import { fetchMyCampaigns, MyCampaign } from '../lib/api/members';
import { useRead } from '../lib/api/useRead';
import { ListOutcome } from '../lib/api/campaignAdmin';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { campaignStatusLabel, roleLabel } from '../lib/labels';
import { DefinitionList, PageHeader, uiClasses as ui } from '../components/ui/Layout';
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from '../components/States';
import { LocalDate } from '../components/LocalDate';

/**
 * `/panel/my-campaigns` (§3.4; DD-72; DW-50): las convocatorias de las que quien entra es responsable activo en su
 * organización (también las cerradas), con el papel con el que actúa y enlace a la página pública.
 */
export function MyCampaignsScreen({ client = fetchMyCampaigns }: { client?: typeof fetchMyCampaigns }) {
  const list = useRead<ListOutcome<MyCampaign>, never>(async () => ({ status: 'ready', data: await client() }), []);
  const data = list.state.status === 'ready' ? list.state.data : undefined;
  const linkable = isSurfaceEnabled('/c/:publicCode');

  return (
    <div>
      <PageHeader title="Mis convocatorias" />
      {data === undefined && <LoadingState />}
      {data?.kind === 'forbidden' && <ForbiddenState />}
      {(data?.kind === 'error' || data?.kind === 'unauthorized') && <ErrorState onRetry={list.reload} />}
      {data?.kind === 'ok' && data.items.length === 0 && <EmptyState text="No eres responsable de ninguna convocatoria." />}
      {data?.kind === 'ok' && data.items.length > 0 && (
        <ul className={ui.list}>
          {data.items.map((c) => (
            <li key={c.campaignRef} data-testid="my-campaign">
              <h2 className={ui.sectionTitle}>{c.title}</h2>
              <DefinitionList items={[
                { label: 'Estado', value: campaignStatusLabel(c.status) },
                { label: 'Tu papel', value: roleLabel(c.actingRole) },
                { label: 'Desde', value: c.assignedAt ? <LocalDate iso={c.assignedAt} /> : '—' },
                { label: 'Página pública', value: linkable ? <Link href={`/c/${encodeURIComponent(c.publicCode)}`}>Abrir</Link> : '—' },
              ]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
