'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { useRead } from '../lib/api/useRead';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { ListOutcome } from '../lib/api/campaignAdmin';
import {
  fetchPlatformAdmins, fetchVerificationQueue, grantPlatformAdminRequest, PlatformAdmin, PlatformDecision,
  platformDecisionRequest, QueueItem, QueueStatus, revokePlatformAdminRequest,
} from '../lib/api/organization';
import { organizationTypeLabel, verificationStatusLabel } from '../lib/labels';
import { Actions, DefinitionList, PageHeader, Surface, uiClasses as ui } from '../components/ui/Layout';
import { SelectField } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ForbiddenState, LoadingState, StatusNotice, UnavailableState } from '../components/States';
import { CommandModal, FieldSpec } from '../components/asset/CommandModal';

const LABEL: Record<PlatformDecision, string> = {
  verify: 'Verificar', reject: 'Rechazar', 'request-information': 'Pedir más información',
};
const TITLE: Record<PlatformDecision, string> = {
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
const FILTERS: { value: '' | QueueStatus; label: string }[] = [
  { value: '', label: 'Todas las pendientes' },
  { value: 'PENDING_VERIFICATION', label: 'Pendientes de verificación' },
  { value: 'NEEDS_MORE_INFORMATION', label: 'Con información pedida' },
];

type Queue = { status: 'loading' } | { status: 'error' } | { status: 'forbidden' } | { status: 'ready'; items: QueueItem[]; nextCursor?: string; more: boolean };

/** Cola de verificación (DW-44): paginada por cursor, con filtro, y decisión por fila (sin escribir identificadores). */
function VerificationQueue({ queueClient }: { queueClient: typeof fetchVerificationQueue }) {
  const [filter, setFilter] = useState<'' | QueueStatus>('');
  const [queue, setQueue] = useState<Queue>({ status: 'loading' });
  const [decision, setDecision] = useState<{ org: QueueItem; kind: PlatformDecision } | null>(null);
  const [result, setResult] = useState<{ name: string; status: string } | null>(null);
  const actions = (Object.keys(LABEL) as PlatformDecision[]).filter((d) => isSurfaceEnabled(`action:platform-${d}`));

  const load = useCallback(async (cursor?: string) => {
    if (!cursor) setQueue({ status: 'loading' });
    else setQueue((q) => (q.status === 'ready' ? { ...q, more: true } : q));
    const r = await queueClient({ status: filter || undefined, cursor });
    if (r.kind === 'forbidden') { setQueue({ status: 'forbidden' }); return; }
    if (r.kind !== 'ok') { setQueue({ status: 'error' }); return; }
    setQueue((q) => ({
      status: 'ready', more: false, nextCursor: r.nextCursor,
      items: cursor && q.status === 'ready' ? [...q.items, ...r.items] : r.items,
    }));
  }, [filter, queueClient]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Surface title="Organizaciones pendientes">
      <SelectField label="Mostrar" value={filter} options={FILTERS} onChange={(e) => setFilter(e.target.value as '' | QueueStatus)} />
      {result && (
        <StatusNotice variant="success" title="Decisión registrada">
          <p>{result.name}: {verificationStatusLabel(result.status)}.</p>
        </StatusNotice>
      )}
      {queue.status === 'loading' && <LoadingState />}
      {queue.status === 'forbidden' && <ForbiddenState />}
      {queue.status === 'error' && <ErrorState onRetry={() => void load()} />}
      {queue.status === 'ready' && queue.items.length === 0 && <EmptyState text="No hay organizaciones pendientes." />}
      {queue.status === 'ready' && queue.items.length > 0 && (
        <ul className={ui.list}>
          {queue.items.map((o) => (
            <li key={o.organizationId} data-testid="queue-item">
              <h3 className={ui.sectionTitle}>{o.name ?? 'Organización sin nombre'}</h3>
              <DefinitionList items={[
                { label: 'Tipo', value: organizationTypeLabel(o.type) },
                { label: 'Estado', value: verificationStatusLabel(o.verificationStatus) },
                ...(o.informationRequest ? [{ label: 'Información pedida', value: o.informationRequest }] : []),
                { label: 'Identificador', value: <span className={ui.mono}>{o.organizationId}</span> },
              ]} />
              {actions.length > 0 && (
                <Actions>
                  {actions.map((d) => (
                    <Button key={d} variant={d === 'verify' ? 'primary' : 'secondary'}
                      onClick={() => { setResult(null); setDecision({ org: o, kind: d }); }}>{LABEL[d]}</Button>
                  ))}
                </Actions>
              )}
            </li>
          ))}
        </ul>
      )}
      {queue.status === 'ready' && queue.nextCursor && (
        <Actions><Button variant="secondary" sending={queue.more} onClick={() => void load(queue.nextCursor)}>Cargar más</Button></Actions>
      )}
      {decision && (
        <CommandModal<{ verificationStatus?: string }>
          title={TITLE[decision.kind]} submitLabel={TITLE[decision.kind]}
          description={<>{decision.org.name ?? 'Organización sin nombre'} ({organizationTypeLabel(decision.org.type)}). {DESCRIPTION[decision.kind]}</>}
          fields={decision.kind === 'request-information' ? [MESSAGE] : []}
          builder={platformDecisionRequest(decision.org.organizationId, decision.kind)}
          onClose={() => setDecision(null)}
          onSuccess={(data) => {
            setResult({ name: decision.org.name ?? 'Organización sin nombre', status: String(data?.verificationStatus ?? '') });
            setDecision(null);
            void load();
          }} />
      )}
    </Surface>
  );
}

/** Administradores de plataforma (§3.2; DW-45): sin email en el contrato, se identifican por la cuenta. */
function PlatformAdmins({ selfId, adminsClient }: { selfId: string; adminsClient: typeof fetchPlatformAdmins }) {
  const list = useRead<ListOutcome<PlatformAdmin>, never>(async () => ({ status: 'ready', data: await adminsClient() }), []);
  const [action, setAction] = useState<{ kind: 'grant' } | { kind: 'revoke'; accountId: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const admins = list.state.status === 'ready' ? list.state.data : undefined;
  const canGrant = isSurfaceEnabled('action:platform-grant-admin');
  const canRevoke = isSurfaceEnabled('action:platform-revoke-admin');

  return (
    <Surface title="Administradores de la plataforma">
      {done && <StatusNotice variant="success" text={done} />}
      {admins === undefined && <LoadingState />}
      {admins?.kind === 'forbidden' && <ForbiddenState />}
      {(admins?.kind === 'error' || admins?.kind === 'unauthorized') && <ErrorState onRetry={list.reload} />}
      {admins?.kind === 'ok' && (
        <ul className={ui.list}>
          {admins.items.map((a) => (
            <li key={a.accountId} data-testid="platform-admin">
              <span className={ui.mono}>{a.accountId}</span>{a.accountId === selfId ? ' (tú)' : ''}
              {canRevoke && (
                <> <Button variant="secondary" onClick={() => { setDone(null); setAction({ kind: 'revoke', accountId: a.accountId }); }}>
                  Retirar</Button></>
              )}
            </li>
          ))}
        </ul>
      )}
      {canGrant && (
        <Actions><Button onClick={() => { setDone(null); setAction({ kind: 'grant' }); }}>Añadir administrador</Button></Actions>
      )}
      {action?.kind === 'grant' && (
        <CommandModal title="Añadir administrador de la plataforma" submitLabel="Añadir administrador"
          description="La cuenta tendrá la autoridad de plataforma: verificar organizaciones y gestionar administradores."
          fields={[{ name: 'accountId', label: 'Cuenta (identificador)', hint: 'El contrato no permite buscar por correo: pide a la persona el identificador de su cuenta.' }]}
          builder={grantPlatformAdminRequest}
          onClose={() => setAction(null)}
          onSuccess={() => { setDone('Administrador añadido.'); setAction(null); list.reload(); }} />
      )}
      {action?.kind === 'revoke' && (
        <CommandModal title="Retirar administrador de la plataforma" submitLabel="Retirar" fields={[]}
          description={<>La cuenta <span className={ui.mono}>{action.accountId}</span> pierde la autoridad de plataforma{action.accountId === selfId ? ' (eres tú: perderás el acceso a esta pantalla)' : ''}. La plataforma nunca se queda sin administradores.</>}
          builder={revokePlatformAdminRequest(action.accountId)}
          onClose={() => setAction(null)}
          onSuccess={() => { setDone('Administrador retirado.'); setAction(null); list.reload(); }} />
      )}
    </Surface>
  );
}

/**
 * `/panel/platform`: autoridad de plataforma (`platformAuthority` de `/me`; representación, el backend autoriza).
 * Cola de verificación con decisiones por fila y administradores de la plataforma.
 */
export function PlatformScreen({ meClient = fetchMe, queueClient = fetchVerificationQueue, adminsClient = fetchPlatformAdmins }: {
  meClient?: typeof fetchMe;
  queueClient?: typeof fetchVerificationQueue;
  adminsClient?: typeof fetchPlatformAdmins;
}) {
  const { state, reload } = usePrincipal(meClient);
  const allowed = state.status === 'ready' && !!state.data.platformAuthority;

  return (
    <div>
      <PageHeader title="Plataforma" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta" />}
      {state.status === 'ready' && !allowed && <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />}
      {allowed && (
        <>
          <VerificationQueue queueClient={queueClient} />
          <PlatformAdmins selfId={state.status === 'ready' ? state.data.accountId : ''} adminsClient={adminsClient} />
        </>
      )}
    </div>
  );
}
