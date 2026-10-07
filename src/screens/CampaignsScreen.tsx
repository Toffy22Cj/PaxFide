'use client';

import React, { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import {
  addSessionCampaign, getSessionCampaigns, SessionCampaign, subscribeSessionCampaigns,
} from '../lib/campaigns/sessionCampaigns';
import { PageHeader, Surface, Actions, DefinitionList, uiClasses as ui } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingState, StatusNotice, UnavailableState } from '../components/States';
import { CreateCampaignForm } from '../components/campaign/CreateCampaignForm';
import { AssignEmployeeForm } from '../components/campaign/AssignEmployeeForm';
import { QrCode } from '../components/QrCode';

/** QR de la URL canónica de la página pública (matriz §4b: `/c/{publicCode}`), con el origen de esta web. */
function PublicQr({ publicCode, title }: { publicCode: string; title: string }) {
  const [origin, setOrigin] = React.useState<string | null>(null);
  React.useEffect(() => { setOrigin(window.location.origin); }, []);
  if (!origin) return null;
  return <QrCode value={`${origin}/c/${encodeURIComponent(publicCode)}`} label={`Código QR de la página pública de «${title}»`} size={180} />;
}

const EMPTY: SessionCampaign[] = [];

/**
 * `/panel/campaigns` (`front-fase2` §9; delta N1 §3.2). El `organizationId` sale de `/me`; sin él no se llama al
 * backend (D-N1-4). El listado no tiene endpoint (S-02): se muestran las creadas en esta sesión. Las acciones se
 * ofrecen a `ADMINISTRATOR` (representación); el backend autoriza y su 403 manda.
 */
export function CampaignsScreen({ meClient = fetchMe }: { meClient?: typeof fetchMe }) {
  const { state, reload } = usePrincipal(meClient);
  const created = useSyncExternalStore(subscribeSessionCampaigns, getSessionCampaigns, () => EMPTY);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<SessionCampaign | null>(null);

  const isAdmin = state.status === 'ready' && state.data.roles.includes('ADMINISTRATOR');
  const organizationId = state.status === 'ready' ? state.data.organizationId : undefined;

  return (
    <div>
      <PageHeader title="Convocatorias de mi organización" testId="campaigns-title" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta (organización y roles)" />}
      {state.status === 'ready' && (!organizationId || !isAdmin) && (
        <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />
      )}
      {state.status === 'ready' && organizationId && isAdmin && (
        <>
          {justCreated && (
            <StatusNotice variant="success" title="Convocatoria creada">
              <p>Enlace público: <Link href={`/c/${encodeURIComponent(justCreated.publicCode)}`} data-testid="created-public-link">
                Ver «{justCreated.title}»</Link></p>
              <PublicQr publicCode={justCreated.publicCode} title={justCreated.title} />
              <p>Imprime o comparte este QR: abre la página pública de la convocatoria.</p>
            </StatusNotice>
          )}
          {isSurfaceEnabled('action:create-campaign') && !creating && (
            <Actions><Button onClick={() => { setJustCreated(null); setCreating(true); }}>Crear convocatoria</Button></Actions>
          )}
          {creating && (
            <CreateCampaignForm organizationId={organizationId} onCancel={() => setCreating(false)}
              onCreated={(c, title) => {
                const item = { ...c, title };
                addSessionCampaign(item);
                setJustCreated(item);
                setCreating(false);
              }} />
          )}
          <h2 className={ui.sectionTitle} style={{ marginTop: 24 }}>Listado</h2>
          <UnavailableState what="El listado de convocatorias de tu organización" />
          {created.length > 0 && (
            <Surface title="Creadas en esta sesión">
              <ul className={ui.list}>
                {created.map((c) => (
                  <li key={c.campaignRef} data-testid="session-campaign">
                    <DefinitionList items={[
                      { label: 'Título', value: c.title },
                      { label: 'Referencia', value: <span className={ui.mono}>{c.campaignRef}</span> },
                      { label: 'Página pública', value: <Link href={`/c/${encodeURIComponent(c.publicCode)}`}>Abrir</Link> },
                      { label: 'QR', value: <PublicQr publicCode={c.publicCode} title={c.title} /> },
                    ]} />
                  </li>
                ))}
              </ul>
            </Surface>
          )}
          {isSurfaceEnabled('action:assign-employee') && <AssignEmployeeForm key={created.length} campaigns={created} />}
        </>
      )}
    </div>
  );
}
