'use client';

import React from 'react';
import Link from 'next/link';
import { fetchMe, Principal } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { PageHeader, uiClasses as ui } from '../components/ui/Layout';
import { EmptyState, ErrorState, LoadingState, UnavailableState } from '../components/States';

export interface PanelEntry {
  id: string;
  label: string;
  href: string;
}

/**
 * Entradas de `PanelHome` (D-N1-1 (a)): una entrada se muestra si el contrato de su destino autoriza al menos uno de
 * los roles del principal. Es representación, no autorización. Cuando `/me` no está disponible solo se ofrecen las
 * entradas que no dependen de roles (DW-06).
 */
export function panelEntries(principal: Principal | null): PanelEntry[] {
  const roles = principal?.roles ?? [];
  const entries: PanelEntry[] = [];
  if (roles.includes('ADMINISTRATOR') && isSurfaceEnabled('/panel/campaigns')) {
    entries.push({ id: 'campaigns', label: 'Convocatorias de mi organización', href: '/panel/campaigns' });
  }
  if (isSurfaceEnabled('/account/donations')) {
    entries.push({ id: 'donations', label: 'Mis donaciones', href: '/account/donations' });
  }
  return entries;
}

function Entries({ entries }: { entries: PanelEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />;
  }
  return (
    <ul className={ui.list}>
      {entries.map((e) => (
        <li key={e.id}>
          <Link href={e.href} className={[ui.button, ui.secondary, ui.block].join(' ')} data-testid={`${e.id}-link`}>
            {e.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PanelHomeScreen({ meClient = fetchMe }: { meClient?: typeof fetchMe }) {
  const { state, reload } = usePrincipal(meClient);

  return (
    <div data-testid="panel-content">
      <PageHeader title="Panel" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && (
        <>
          <UnavailableState what="La información de tu cuenta (organización y roles)" />
          <Entries entries={panelEntries(null)} />
        </>
      )}
      {state.status === 'ready' && <Entries entries={panelEntries(state.data)} />}
    </div>
  );
}
