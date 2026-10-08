'use client';

import React, { useState } from 'react';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { createOrganizationRequest } from '../lib/api/organization';
import { organizationTypeLabel, roleLabel, verificationStatusLabel } from '../lib/labels';
import { Actions, DefinitionList, PageHeader, Surface, uiClasses as ui } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { ErrorState, LoadingState, StatusNotice, UnavailableState } from '../components/States';
import { CommandModal } from '../components/asset/CommandModal';

const TYPES = [{ value: 'FOUNDATION', label: 'Fundación' }, { value: 'COMPANY', label: 'Empresa' }];

/**
 * `/panel/organization` (R9, §3.1; DW-46): una cuenta sin organización la crea (`POST /organizations`) y queda como
 * `REPRESENTATIVE`, pendiente de verificación. Con organización, se muestra la cuenta y sus papeles; el estado de
 * verificación no tiene lectura (S-18): solo se conoce en la respuesta de la creación.
 */
export function OrganizationScreen({ meClient = fetchMe }: { meClient?: typeof fetchMe }) {
  const { state, reload } = usePrincipal(meClient);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ organizationId: string; verificationStatus: string; name: string; type: string } | null>(null);

  return (
    <div>
      <PageHeader title="Mi organización" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta" />}
      {created && (
        <StatusNotice variant="success" title="Organización creada">
          <DefinitionList items={[
            { label: 'Nombre', value: created.name },
            { label: 'Tipo', value: organizationTypeLabel(created.type) },
            { label: 'Estado', value: verificationStatusLabel(created.verificationStatus), testId: 'organization-status' },
            { label: 'Identificador', value: <span className={ui.mono}>{created.organizationId}</span> },
          ]} />
          <p>La plataforma la revisará. Hasta que esté verificada no podrás crear convocatorias. Eres su representante:
            ya puedes invitar a otras personas.</p>
        </StatusNotice>
      )}
      {state.status === 'ready' && !state.data.organizationId && !created && (
        <Surface title="Crear una organización">
          <p>Tu cuenta no pertenece a ninguna organización. Si representas a una fundación o una empresa, regístrala:
            quedará pendiente de verificación por la plataforma.</p>
          {isSurfaceEnabled('action:create-organization') && (
            <Actions><Button onClick={() => setCreating(true)}>Crear organización</Button></Actions>
          )}
        </Surface>
      )}
      {state.status === 'ready' && state.data.organizationId && (
        <Surface title="Tu cuenta en la organización">
          <DefinitionList items={[
            { label: 'Organización', value: <span className={ui.mono}>{state.data.organizationId}</span> },
            { label: 'Tus papeles', value: state.data.roles.map(roleLabel).join(', ') || '—', testId: 'organization-roles' },
          ]} />
          {!created && <UnavailableState what="El estado de verificación de tu organización" />}
        </Surface>
      )}
      {creating && (
        <CommandModal<{ organizationId?: string; verificationStatus?: string }>
          title="Crear organización" submitLabel="Crear organización"
          fields={[
            { name: 'type', label: 'Tipo', options: TYPES },
            { name: 'name', label: 'Nombre', hint: 'Entre 1 y 200 caracteres.', parse: (raw) => (raw.length <= 200 ? raw : null), invalid: 'Máximo 200 caracteres.' },
          ]}
          builder={createOrganizationRequest}
          onClose={() => setCreating(false)}
          onSuccess={(data, _location, sentPayload) => {
            setCreated({
              organizationId: String(data?.organizationId ?? ''), verificationStatus: String(data?.verificationStatus ?? ''),
              name: sentPayload.name ?? '', type: sentPayload.type ?? '',
            });
            setCreating(false);
            reload();
          }} />
      )}
    </div>
  );
}
