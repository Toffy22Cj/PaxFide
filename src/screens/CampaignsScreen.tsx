'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { useRead } from '../lib/api/useRead';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import {
  AdminCampaign, assignEmployeeToRequest, closeCampaignRequest, CreatedCampaign, designateAdministratorRequest,
  fetchMembers, fetchOrganizationCampaigns, ListOutcome, Member, removeResponsibleRequest,
} from '../lib/api/campaignAdmin';
import { formatMinorUnits } from '../lib/money';
import { campaignStatusLabel, roleLabel, visibilityLabel } from '../lib/labels';
import { PageHeader, Surface, Actions, DefinitionList, uiClasses as ui } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ForbiddenState, LoadingState, StatusNotice, UnavailableState } from '../components/States';
import { CreateCampaignForm } from '../components/campaign/CreateCampaignForm';
import { CommandModal, FieldSpec } from '../components/asset/CommandModal';
import { QrCode } from '../components/QrCode';

/** QR de la URL canónica de la página pública (matriz §4b: `/c/{publicCode}`), con el origen de esta web. */
function PublicQr({ publicCode, title }: { publicCode: string; title: string }) {
  const [origin, setOrigin] = React.useState<string | null>(null);
  React.useEffect(() => { setOrigin(window.location.origin); }, []);
  if (!origin) return null;
  return <QrCode value={`${origin}/c/${encodeURIComponent(publicCode)}`} label={`Código QR de la página pública de «${title}»`} size={180} />;
}

type ActionKind = 'assign' | 'designate' | 'remove' | 'close';
const ACTION_SURFACE: Record<ActionKind, string> = {
  assign: 'action:assign-employee',
  designate: 'action:designate-administrator',
  remove: 'action:remove-responsible',
  close: 'action:close-campaign',
};
const ACTION_LABEL: Record<ActionKind, string> = {
  assign: 'Asignar empleado', designate: 'Designar administrador', remove: 'Retirar responsable', close: 'Cerrar convocatoria',
};
const SUCCESS: Record<ActionKind, string> = {
  assign: 'Empleado asignado.', designate: 'Administrador designado.', remove: 'Responsable retirado.', close: 'Convocatoria cerrada.',
};

/** Los miembros no traen nombre ni email (DD-55): se muestran por su cuenta y sus papeles. */
const memberOption = (m: Member) => ({ value: m.accountId, label: `${m.accountId} (${m.roles.map(roleLabel).join(', ') || 'sin papel'})` });

function memberField(name: string, label: string, members: Member[] | null, role?: string, optional?: boolean): FieldSpec {
  const pool = members?.filter((m) => !role || m.roles.includes(role));
  return pool
    ? { name, label, optional, options: pool.map(memberOption) }
    : { name, label, optional, hint: 'No se pudo leer el listado de miembros: escribe el identificador de la cuenta.' };
}

function ActionModal({ kind, campaign, members, onDone, onClose }: {
  kind: ActionKind; campaign: AdminCampaign; members: Member[] | null; onDone: () => void; onClose: () => void;
}) {
  const common = { submitLabel: ACTION_LABEL[kind], onSuccess: onDone, onClose };
  if (kind === 'assign') {
    return <CommandModal {...common} title={`${ACTION_LABEL.assign} — ${campaign.title}`}
      fields={[memberField('employeeRef', 'Empleado', members, 'EMPLOYEE')]} builder={assignEmployeeToRequest(campaign.campaignRef)} />;
  }
  if (kind === 'designate') {
    return <CommandModal {...common} title={`${ACTION_LABEL.designate} — ${campaign.title}`}
      fields={[memberField('administratorRef', 'Administrador', members, 'ADMINISTRATOR')]}
      builder={designateAdministratorRequest(campaign.campaignRef)} />;
  }
  if (kind === 'close') {
    return <CommandModal {...common} title={`${ACTION_LABEL.close} — ${campaign.title}`} fields={[]}
      description="Cerrar es definitivo: la convocatoria deja de aceptar donaciones y no se puede volver a abrir."
      builder={closeCampaignRequest(campaign.campaignRef)} />;
  }
  return <RemoveResponsibleModal campaign={campaign} members={members} onDone={onDone} onClose={onClose} />;
}

/** Retirar (DD-50): se elige el responsable; el reemplazo es opcional y, si se da, exige su papel. */
function RemoveResponsibleModal({ campaign, members, onDone, onClose }: {
  campaign: AdminCampaign; members: Member[] | null; onDone: () => void; onClose: () => void;
}) {
  return (
    <CommandModal title={`${ACTION_LABEL.remove} — ${campaign.title}`} submitLabel={ACTION_LABEL.remove} onClose={onClose} onSuccess={onDone}
      description="Si es el último responsable, indica un reemplazo."
      fields={[
        { name: 'responsibleRef', label: 'Responsable',
          options: campaign.responsibles.map((r) => ({ value: r.accountId, label: `${r.accountId} (${roleLabel(r.actingRole)})` })) },
        memberField('replacementRef', 'Reemplazo (opcional)', members, undefined, true),
        { name: 'replacementActingRole', label: 'Papel del reemplazo', optional: true,
          options: [{ value: 'EMPLOYEE', label: 'Empleado' }, { value: 'ADMINISTRATOR', label: 'Administrador' }] },
      ]}
      validate={(p) => ({
        replacementActingRole: p.replacementRef && !p.replacementActingRole ? 'Con reemplazo, indica su papel.' : undefined,
        replacementRef: !p.replacementRef && p.replacementActingRole ? 'Indica el reemplazo o deja el papel vacío.' : undefined,
      })}
      builder={(payload) => {
        const { responsibleRef, ...body } = payload as Record<string, string>;
        return removeResponsibleRequest(campaign.campaignRef, responsibleRef)(body);
      }} />
  );
}

function CampaignItem({ c, onAction }: { c: AdminCampaign; onAction: (kind: ActionKind) => void }) {
  const open = c.status === 'OPEN';
  const actions = (['assign', 'designate', 'remove', 'close'] as ActionKind[]).filter((k) => isSurfaceEnabled(ACTION_SURFACE[k])
    && open && (k !== 'remove' || c.responsibles.length > 0));
  return (
    <li data-testid="org-campaign">
      <h3 className={ui.sectionTitle}>{c.title}</h3>
      <DefinitionList items={[
        { label: 'Estado', value: campaignStatusLabel(c.status), testId: 'campaign-status' },
        { label: 'Visibilidad', value: visibilityLabel(c.visibility) },
        { label: 'Meta', value: c.targetAmount && c.currency ? formatMinorUnits(c.targetAmount, c.currency) : 'Sin meta monetaria' },
        { label: 'Recaudado', value: c.clearedAmount && c.currency ? formatMinorUnits(c.clearedAmount, c.currency) : '—' },
        { label: 'Responsables', value: c.responsibles.length > 0
          ? <ul className={ui.list}>{c.responsibles.map((r) => <li key={r.accountId}><span className={ui.mono}>{r.accountId}</span> ({roleLabel(r.actingRole)})</li>)}</ul>
          : 'Ninguno' },
        { label: 'Empleados asignados', value: String(c.assignedEmployeeCount) },
        { label: 'Referencia', value: <span className={ui.mono}>{c.campaignRef}</span> },
        { label: 'Página pública', value: <Link href={`/c/${encodeURIComponent(c.publicCode)}`}>Abrir</Link> },
      ]} />
      <details>
        <summary>Ver QR de la página pública</summary>
        <PublicQr publicCode={c.publicCode} title={c.title} />
      </details>
      {(actions.length > 0 || isSurfaceEnabled('/panel/prediction')) && (
        <Actions>
          {actions.map((k) => (
            <Button key={k} variant={k === 'close' ? 'secondary' : 'primary'} onClick={() => onAction(k)}>{ACTION_LABEL[k]}</Button>
          ))}
          {isSurfaceEnabled('/panel/prediction') && <Link href="/panel/prediction">Ver estimación</Link>}
        </Actions>
      )}
    </li>
  );
}

/**
 * `/panel/campaigns` (`front-fase2` §9; delta N1 §3.2). El `organizationId` sale de `/me`; sin él no se llama al
 * backend (D-N1-4). Listado real (`GET /organizations/{id}/campaigns`, S-02) con sus acciones; los responsables se
 * eligen entre los miembros (`GET /organizations/{id}/members`, R6). Todo se ofrece a `ADMINISTRATOR`
 * (representación); el backend autoriza y su 403 manda.
 */
export function CampaignsScreen({ meClient = fetchMe, listClient = fetchOrganizationCampaigns, membersClient = fetchMembers }: {
  meClient?: typeof fetchMe;
  listClient?: typeof fetchOrganizationCampaigns;
  membersClient?: typeof fetchMembers;
}) {
  const { state, reload } = usePrincipal(meClient);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<(CreatedCampaign & { title: string }) | null>(null);
  const [action, setAction] = useState<{ kind: ActionKind; campaign: AdminCampaign } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const isAdmin = state.status === 'ready' && state.data.roles.includes('ADMINISTRATOR');
  const organizationId = state.status === 'ready' ? state.data.organizationId : undefined;
  const enabled = !!organizationId && isAdmin;

  const list = useRead<ListOutcome<AdminCampaign> | null, never>(async () => ({
    status: 'ready', data: enabled ? await listClient(organizationId!) : null,
  }), [enabled, organizationId]);
  const members = useRead<Member[] | null, never>(async () => {
    if (!enabled) return { status: 'ready', data: null };
    const r = await membersClient(organizationId!);
    return { status: 'ready', data: r.kind === 'ok' ? r.items : null };
  }, [enabled, organizationId]);

  const listState = list.state.status === 'ready' ? list.state.data : undefined;
  const memberList = members.state.status === 'ready' ? members.state.data : null;

  return (
    <div>
      <PageHeader title="Convocatorias de mi organización" testId="campaigns-title" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta (organización y roles)" />}
      {state.status === 'ready' && !enabled && <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />}
      {enabled && (
        <>
          {justCreated && (
            <StatusNotice variant="success" title="Convocatoria creada">
              <p>Enlace público: <Link href={`/c/${encodeURIComponent(justCreated.publicCode)}`} data-testid="created-public-link">
                Ver «{justCreated.title}»</Link></p>
              <PublicQr publicCode={justCreated.publicCode} title={justCreated.title} />
              <p>Imprime o comparte este QR: abre la página pública de la convocatoria.</p>
            </StatusNotice>
          )}
          {done && <StatusNotice variant="success" text={done} />}
          {isSurfaceEnabled('action:create-campaign') && !creating && (
            <Actions><Button onClick={() => { setJustCreated(null); setDone(null); setCreating(true); }}>Crear convocatoria</Button></Actions>
          )}
          {creating && (
            <CreateCampaignForm organizationId={organizationId!} onCancel={() => setCreating(false)}
              onCreated={(c, title) => { setJustCreated({ ...c, title }); setCreating(false); list.reload(); }} />
          )}
          <Surface title="Listado">
            {listState === undefined && <LoadingState />}
            {listState?.kind === 'forbidden' && <ForbiddenState />}
            {(listState?.kind === 'error' || listState?.kind === 'unauthorized') && <ErrorState onRetry={list.reload} />}
            {listState?.kind === 'ok' && listState.items.length === 0 && <EmptyState text="Tu organización todavía no tiene convocatorias." />}
            {listState?.kind === 'ok' && listState.items.length > 0 && (
              <ul className={ui.list}>
                {listState.items.map((c) => (
                  <CampaignItem key={c.campaignRef} c={c} onAction={(kind) => { setDone(null); setAction({ kind, campaign: c }); }} />
                ))}
              </ul>
            )}
          </Surface>
          {action && (
            <ActionModal kind={action.kind} campaign={action.campaign} members={memberList}
              onClose={() => setAction(null)}
              onDone={() => { setDone(SUCCESS[action.kind]); setAction(null); list.reload(); }} />
          )}
        </>
      )}
    </div>
  );
}
