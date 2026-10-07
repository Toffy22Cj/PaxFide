'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '../components/ui/Button';
import { RegisterAssetForm } from '../components/asset/RegisterAssetForm';
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
  if ((roles.includes('ADMINISTRATOR') || roles.includes('REPRESENTATIVE')) && isSurfaceEnabled('/panel/prediction')) {
    entries.push({ id: 'prediction', label: 'Estimación de convocatorias', href: '/panel/prediction' });
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

/**
 * "Registrar activo" (D-N1-2 (a)): a `EMPLOYEE`; nunca a un principal cuyo único rol aplicable sea
 * `REPRESENTATIVE` mientras R10 siga abierto.
 */
export function canRegisterAsset(principal: Principal | null): boolean {
  return !!principal && principal.roles.includes('EMPLOYEE') && isSurfaceEnabled('action:register-asset');
}

export function PanelHomeScreen({ meClient = fetchMe }: { meClient?: typeof fetchMe }) {
  const { state, reload } = usePrincipal(meClient);
  const router = useRouter();
  const [registering, setRegistering] = useState(false);
  const register = state.status === 'ready' && canRegisterAsset(state.data);

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
      {state.status === 'ready' && (panelEntries(state.data).length > 0 || !register) && <Entries entries={panelEntries(state.data)} />}
      {register && !registering && (
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" block onClick={() => setRegistering(true)}>Registrar activo</Button>
        </div>
      )}
      {register && registering && (
        <div style={{ marginTop: 24 }}>
          <RegisterAssetForm onCancel={() => setRegistering(false)}
            onRegistered={(assetRef) => router.push(`/assets/${encodeURIComponent(assetRef)}`)} />
        </div>
      )}
    </div>
  );
}
