'use client';

import React, { useState } from 'react';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { PlatformDecision, platformDecisionRequest } from '../lib/api/organization';
import { verificationStatusLabel } from '../lib/labels';
import { Actions, PageHeader, Surface, uiClasses as ui } from '../components/ui/Layout';
import { TextField } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingState, StatusNotice, UnavailableState } from '../components/States';
import { CommandModal, FieldSpec } from '../components/asset/CommandModal';

const LABEL: Record<PlatformDecision, string> = {
  verify: 'Verificar organización', reject: 'Rechazar organización', 'request-information': 'Pedir más información',
};
const DESCRIPTION: Record<PlatformDecision, string> = {
  verify: 'Una organización verificada puede crear convocatorias. Verificar o rechazar es definitivo.',
  reject: 'Rechazar es definitivo: la organización no podrá crear convocatorias.',
  'request-information': 'La organización recibe tu mensaje y sigue pendiente de verificación.',
};
const MESSAGE: FieldSpec = {
  name: 'message', label: 'Mensaje para la organización', multiline: true, hint: 'Entre 1 y 2000 caracteres.',
  parse: (raw) => (raw.length <= 2000 ? raw : null), invalid: 'Máximo 2000 caracteres.',
};

/**
 * `/panel/platform`: verificación de organizaciones por la autoridad de plataforma (`platformAuthority` de `/me`;
 * representación, el backend autoriza). No hay lectura de organizaciones pendientes (D-04): el identificador se
 * escribe. Verificar, rechazar y pedir información, con confirmación; el resultado es el estado que devuelve el backend.
 */
export function PlatformScreen({ meClient = fetchMe }: { meClient?: typeof fetchMe }) {
  const { state, reload } = usePrincipal(meClient);
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [decision, setDecision] = useState<PlatformDecision | null>(null);
  const [result, setResult] = useState<{ organizationId: string; status: string } | null>(null);
  const allowed = state.status === 'ready' && !!state.data.platformAuthority;
  const actions = (Object.keys(LABEL) as PlatformDecision[]).filter((d) => isSurfaceEnabled(`action:platform-${d}`));

  const open = (d: PlatformDecision) => {
    const id = organizationId.trim();
    if (!id) { setError('Escribe el identificador de la organización.'); return; }
    if (id.length > 256) { setError('Máximo 256 caracteres.'); return; }
    setError(undefined);
    setResult(null);
    setDecision(d);
  };

  return (
    <div>
      <PageHeader title="Verificación de organizaciones" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta" />}
      {state.status === 'ready' && !allowed && <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />}
      {allowed && (
        <>
          <UnavailableState what="El listado de organizaciones pendientes" />
          <Surface title="Decidir sobre una organización">
            <TextField label="Identificador de la organización" value={organizationId} autoComplete="off" error={error}
              hint="Todavía no hay listado de organizaciones pendientes: escribe el identificador que te dio la organización."
              onChange={(e) => setOrganizationId(e.target.value)} />
            <Actions>
              {actions.map((d) => (
                <Button key={d} variant={d === 'verify' ? 'primary' : 'secondary'} onClick={() => open(d)}>{LABEL[d]}</Button>
              ))}
            </Actions>
          </Surface>
          {result && (
            <StatusNotice variant="success" title="Decisión registrada">
              <p>Organización <span className={ui.mono}>{result.organizationId}</span>: {verificationStatusLabel(result.status)}.</p>
            </StatusNotice>
          )}
          {decision && (
            <CommandModal<{ organizationId?: string; verificationStatus?: string }>
              title={LABEL[decision]} submitLabel={LABEL[decision]}
              description={<>Organización <span className={ui.mono}>{organizationId.trim()}</span>. {DESCRIPTION[decision]}</>}
              fields={decision === 'request-information' ? [MESSAGE] : []}
              builder={platformDecisionRequest(organizationId.trim(), decision)}
              onClose={() => setDecision(null)}
              onSuccess={(data) => {
                setResult({ organizationId: data?.organizationId ?? organizationId.trim(), status: String(data?.verificationStatus ?? '') });
                setDecision(null);
              }} />
          )}
        </>
      )}
    </div>
  );
}
