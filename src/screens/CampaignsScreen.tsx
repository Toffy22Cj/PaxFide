'use client';

import React from 'react';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { PageHeader } from '../components/ui/Layout';
import { EmptyState, ErrorState, LoadingState, UnavailableState } from '../components/States';

/**
 * `/panel/campaigns` (`front-fase2` §9; delta N1 §3.2). El `organizationId` sale de `/me`; sin él no se llama al
 * backend (D-N1-4). El listado no tiene endpoint en el backend (solicitud S-02).
 */
export function CampaignsScreen({ meClient = fetchMe }: { meClient?: typeof fetchMe }) {
  const { state, reload } = usePrincipal(meClient);

  return (
    <div>
      <PageHeader title="Convocatorias de mi organización" testId="campaigns-title" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta (organización y roles)" />}
      {state.status === 'ready' && !state.data.organizationId && (
        <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />
      )}
      {state.status === 'ready' && state.data.organizationId && (
        <UnavailableState what="El listado de convocatorias de tu organización" />
      )}
    </div>
  );
}
