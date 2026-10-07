'use client';

import React from 'react';
import Link from 'next/link';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { useRead } from '../lib/api/useRead';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { ListOutcome } from '../lib/api/campaignAdmin';
import { fetchOrganizationAssets, OrgAsset } from '../lib/api/organization';
import { lifecycleLabel } from '../lib/labels';
import { PageHeader, uiClasses as ui } from '../components/ui/Layout';
import { EmptyState, ErrorState, ForbiddenState, LoadingState, UnavailableState } from '../components/States';

/**
 * `/panel/assets` (DD-54): activos de la organización (`ADMINISTRATOR` o `EMPLOYEE`), cada uno con enlace a su
 * página. Cantidades tal cual llegan (D-07).
 */
export function OrgAssetsScreen({ meClient = fetchMe, assetsClient = fetchOrganizationAssets }: {
  meClient?: typeof fetchMe;
  assetsClient?: typeof fetchOrganizationAssets;
}) {
  const { state, reload } = usePrincipal(meClient);
  const organizationId = state.status === 'ready' ? state.data.organizationId : undefined;
  const roles = state.status === 'ready' ? state.data.roles : [];
  const enabled = !!organizationId && (roles.includes('ADMINISTRATOR') || roles.includes('EMPLOYEE'));

  const list = useRead<ListOutcome<OrgAsset> | null, never>(async () => ({
    status: 'ready', data: enabled ? await assetsClient(organizationId!) : null,
  }), [enabled, organizationId]);
  const assets = list.state.status === 'ready' && list.state.data ? list.state.data : undefined;
  const linkable = isSurfaceEnabled('/assets/:assetRef');

  return (
    <div>
      <PageHeader title="Activos de mi organización" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta (organización y roles)" />}
      {state.status === 'ready' && !enabled && <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />}
      {enabled && assets === undefined && <LoadingState />}
      {assets?.kind === 'forbidden' && <ForbiddenState />}
      {(assets?.kind === 'error' || assets?.kind === 'unauthorized') && <ErrorState onRetry={list.reload} />}
      {assets?.kind === 'ok' && assets.items.length === 0 && <EmptyState text="Tu organización todavía no tiene activos registrados." />}
      {assets?.kind === 'ok' && assets.items.length > 0 && (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr><th scope="col">Activo</th><th scope="col">Estado</th><th scope="col">Cantidad</th><th scope="col">Ubicación</th><th scope="col">Custodio</th></tr>
            </thead>
            <tbody>
              {assets.items.map((a) => (
                <tr key={a.assetRef} data-testid="org-asset">
                  <td className={ui.mono}>
                    {linkable ? <Link href={`/assets/${encodeURIComponent(a.assetRef)}`}>{a.assetRef}</Link> : a.assetRef}
                  </td>
                  <td>{lifecycleLabel(a.lifecycleStatus)}</td>
                  <td>{a.quantity ?? '—'} {a.unitOfMeasure ?? ''}</td>
                  <td>{a.currentLocation ?? '—'}</td>
                  <td>{a.currentCustodianRef ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
