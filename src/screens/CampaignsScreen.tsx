'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { useRead } from '../lib/api/useRead';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import {
  AdminCampaign,
  assignEmployeeToRequest,
  closeCampaignRequest,
  CreatedCampaign,
  designateAdministratorRequest,
  fetchMembers,
  fetchOrganizationCampaigns,
  ListOutcome,
  Member,
  removeResponsibleRequest,
} from '../lib/api/campaignAdmin';
import { formatMinorUnits } from '../lib/money';
import { campaignStatusLabel, roleLabel } from '../lib/labels';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ForbiddenState, LoadingState, StatusNotice, UnavailableState } from '../components/States';
import { CreateCampaignForm } from '../components/campaign/CreateCampaignForm';
import { CommandModal, FieldSpec } from '../components/asset/CommandModal';
import { QrCode } from '../components/QrCode';
import { IsometricEmblem, PanelIcon } from './PanelHomeScreen';
import s from './panel.module.css';
import ui from '../components/ui/ui.module.css';

/** QR de la URL canónica de la página pública (matriz §4b: `/c/{publicCode}`), con el origen de esta web. */
function PublicQr({ publicCode, title }: { publicCode: string; title: string }) {
  const [origin, setOrigin] = React.useState<string | null>(null);
  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  if (!origin) return null;
  return (
    <QrCode
      value={`${origin}/c/${encodeURIComponent(publicCode)}`}
      label={`Código QR de la página pública de «${title}»`}
      size={180}
    />
  );
}

type ActionKind = 'assign' | 'designate' | 'remove' | 'close';
const ACTION_SURFACE: Record<ActionKind, string> = {
  assign: 'action:assign-employee',
  designate: 'action:designate-administrator',
  remove: 'action:remove-responsible',
  close: 'action:close-campaign',
};
const ACTION_LABEL: Record<ActionKind, string> = {
  assign: 'Asignar empleado',
  designate: 'Designar administrador',
  remove: 'Retirar responsable',
  close: 'Cerrar convocatoria',
};
const SUCCESS: Record<ActionKind, string> = {
  assign: 'Empleado asignado.',
  designate: 'Administrador designado.',
  remove: 'Responsable retirado.',
  close: 'Convocatoria cerrada.',
};

/** Los miembros no traen nombre ni email (DD-55): se muestran por su cuenta y sus papeles. */
const memberOption = (m: Member) => ({
  value: m.accountId,
  label: `${m.accountId} (${m.roles.map(roleLabel).join(', ') || 'sin papel'})`,
});

function memberField(name: string, label: string, members: Member[] | null, role?: string, optional?: boolean): FieldSpec {
  const pool = members?.filter((m) => !role || m.roles.includes(role));
  return pool
    ? { name, label, optional, options: pool.map(memberOption) }
    : { name, label, optional, hint: 'No se pudo leer el listado de miembros: escribe el identificador de la cuenta.' };
}

function ActionModal({
  kind,
  campaign,
  members,
  onDone,
  onClose,
}: {
  kind: ActionKind;
  campaign: AdminCampaign;
  members: Member[] | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const common = { submitLabel: ACTION_LABEL[kind], onSuccess: onDone, onClose };
  if (kind === 'assign') {
    return (
      <CommandModal
        {...common}
        title={`${ACTION_LABEL.assign} — ${campaign.title}`}
        fields={[memberField('employeeRef', 'Empleado', members, 'EMPLOYEE')]}
        builder={assignEmployeeToRequest(campaign.campaignRef)}
      />
    );
  }
  if (kind === 'designate') {
    return (
      <CommandModal
        {...common}
        title={`${ACTION_LABEL.designate} — ${campaign.title}`}
        fields={[memberField('administratorRef', 'Administrador', members, 'ADMINISTRATOR')]}
        builder={designateAdministratorRequest(campaign.campaignRef)}
      />
    );
  }
  if (kind === 'close') {
    return (
      <CommandModal
        {...common}
        title={`${ACTION_LABEL.close} — ${campaign.title}`}
        fields={[]}
        description="Cerrar es definitivo: la convocatoria deja de aceptar donaciones y no se puede volver a abrir."
        builder={closeCampaignRequest(campaign.campaignRef)}
      />
    );
  }
  return <RemoveResponsibleModal campaign={campaign} members={members} onDone={onDone} onClose={onClose} />;
}

/** Retirar (DD-50): se elige el responsable; el reemplazo es opcional y, si se da, exige su papel. */
function RemoveResponsibleModal({
  campaign,
  members,
  onDone,
  onClose,
}: {
  campaign: AdminCampaign;
  members: Member[] | null;
  onDone: () => void;
  onClose: () => void;
}) {
  return (
    <CommandModal
      title={`${ACTION_LABEL.remove} — ${campaign.title}`}
      submitLabel={ACTION_LABEL.remove}
      onClose={onClose}
      onSuccess={onDone}
      description="Si es el último responsable, indica un reemplazo."
      fields={[
        {
          name: 'responsibleRef',
          label: 'Responsable',
          options: campaign.responsibles.map((r) => ({
            value: r.accountId,
            label: `${r.accountId} (${roleLabel(r.actingRole)})`,
          })),
        },
        memberField('replacementRef', 'Reemplazo (opcional)', members, undefined, true),
        {
          name: 'replacementActingRole',
          label: 'Papel del reemplazo',
          optional: true,
          options: [
            { value: 'EMPLOYEE', label: 'Empleado' },
            { value: 'ADMINISTRATOR', label: 'Administrador' },
          ],
        },
      ]}
      validate={(p) => ({
        replacementActingRole: p.replacementRef && !p.replacementActingRole ? 'Con reemplazo, indica su papel.' : undefined,
        replacementRef: !p.replacementRef && p.replacementActingRole ? 'Indica el reemplazo o deja el papel vacío.' : undefined,
      })}
      builder={(payload) => {
        const { responsibleRef, ...body } = payload as Record<string, string>;
        return removeResponsibleRequest(campaign.campaignRef, responsibleRef)(body);
      }}
    />
  );
}

export type CampaignStatusTone = 'ok' | 'wait' | 'off';

/**
 * Determina el estado visual de la convocatoria según el boceto y D-P9:
 * "Cierra pronto" = convocatoria abierta con endDate dentro de los próximos 7 días (calculado en el cliente con la hora del dispositivo).
 */
export function getCampaignStatusInfo(c: AdminCampaign): { tone: CampaignStatusTone; label: string } {
  if (c.status === 'CLOSED') {
    return { tone: 'off', label: 'Cerrada' };
  }
  if (c.status === 'OPEN') {
    if (c.endDate) {
      const end = new Date(c.endDate).getTime();
      const now = Date.now();
      const diffMs = end - now;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 7) {
        return { tone: 'wait', label: 'Cierra pronto' };
      }
    }
    return { tone: 'ok', label: 'Abierta' };
  }
  return { tone: 'off', label: campaignStatusLabel(c.status) };
}

function stClass(tone: CampaignStatusTone): string {
  switch (tone) {
    case 'ok':
      return s.stOk;
    case 'wait':
      return s.stWait;
    case 'off':
      return s.stOff;
  }
}

function formatEndDate(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

export type CampaignFilter = 'ALL' | 'OPEN' | 'CLOSED';

export function matchesCampaignFilter(c: AdminCampaign, filter: CampaignFilter): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'OPEN':
      return c.status === 'OPEN';
    case 'CLOSED':
      return c.status === 'CLOSED';
    default: {
      const _unreachable: never = filter;
      return _unreachable;
    }
  }
}

function CampaignRow({
  c,
  onAction,
}: {
  c: AdminCampaign;
  onAction: (kind: ActionKind) => void;
}) {
  const open = c.status === 'OPEN';
  const actions = (['assign', 'designate', 'remove', 'close'] as ActionKind[]).filter(
    (k) => isSurfaceEnabled(ACTION_SURFACE[k]) && open && (k !== 'remove' || c.responsibles.length > 0)
  );
  const statusInfo = getCampaignStatusInfo(c);

  const zero = BigInt(0);
  const target = c.targetAmount ? BigInt(c.targetAmount) : zero;
  const raised = c.clearedAmount ? BigInt(c.clearedAmount) : zero;
  const pct = target > zero ? Math.min(100, Math.round(Number((raised * BigInt(100)) / target))) : 0;
  const raisedStr = c.clearedAmount && c.currency ? formatMinorUnits(c.clearedAmount, c.currency) : '—';
  const goalStr = c.targetAmount && c.currency ? formatMinorUnits(c.targetAmount, c.currency) : 'Sin meta';

  return (
    <tr data-testid="org-campaign">
      <td>
        <b>{c.title}</b>
        <span className={s.mono} style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '12px' }}>
          Ref: {c.campaignRef}
        </span>
        <div style={{ marginTop: '2px' }}>
          <Link href={`/c/${encodeURIComponent(c.publicCode)}`} className={s.pnLink} style={{ fontSize: '12px' }}>
            Abrir
          </Link>
        </div>
        <details className={s.subDetails}>
          <summary>Ver QR de la página pública</summary>
          <div style={{ padding: '8px 0' }}>
            <PublicQr publicCode={c.publicCode} title={c.title} />
          </div>
        </details>
        {c.responsibles.length > 0 && (
          <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Responsables:{' '}
            {c.responsibles.map((r, i) => (
              <span key={r.accountId}>
                {i > 0 ? ', ' : ''}
                <span className={s.mono}>
                  {r.accountId} ({roleLabel(r.actingRole)})
                </span>
              </span>
            ))}
          </div>
        )}
      </td>
      <td>
        <dd className={`${s.st} ${stClass(statusInfo.tone)}`} data-testid="campaign-status" style={{ margin: 0 }}>
          {statusInfo.label}
        </dd>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className={s.mbar} aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </span>
          <span className={s.mono}>{pct}%</span>
        </div>
        <small className={s.mono} style={{ color: 'var(--color-text-secondary)', display: 'block' }}>
          {raisedStr}
        </small>
      </td>
      <td className={s.mono}>{goalStr}</td>
      <td className={s.mono}>{formatEndDate(c.endDate)}</td>
      <td style={{ textAlign: 'right' }}>
        <div className={s.rowActs} style={{ justifyContent: 'flex-end' }}>
          {actions.map((k) => (
            <Button
              key={k}
              variant={k === 'close' ? 'secondary' : 'primary'}
              onClick={() => onAction(k)}
            >
              {ACTION_LABEL[k]}
            </Button>
          ))}
          {isSurfaceEnabled('/panel/prediction') && (
            <Link href="/panel/prediction" className={[ui.button, ui.secondary].join(' ')}>
              Ver estimación
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * `/panel/campaigns` (F-B2, fidelidad visual al boceto paxfide-panel.html).
 * Cabecera con emblema y "Nueva convocatoria", chips de estado "Todas" / "Abiertas" / "Cerradas",
 * y tabla del boceto (convocatoria, estado con "Cierra pronto" D-P9, recaudado con barra de progreso, meta, cierre).
 */
export function CampaignsScreen({
  meClient = fetchMe,
  listClient = fetchOrganizationCampaigns,
  membersClient = fetchMembers,
}: {
  meClient?: typeof fetchMe;
  listClient?: typeof fetchOrganizationCampaigns;
  membersClient?: typeof fetchMembers;
}) {
  const { state, reload } = usePrincipal(meClient);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<(CreatedCampaign & { title: string }) | null>(null);
  const [action, setAction] = useState<{ kind: ActionKind; campaign: AdminCampaign } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CampaignFilter>('ALL');

  const isAdmin = state.status === 'ready' && state.data.roles.includes('ADMINISTRATOR');
  const organizationId = state.status === 'ready' ? state.data.organizationId : undefined;
  const enabled = !!organizationId && isAdmin;

  const list = useRead<ListOutcome<AdminCampaign> | null, never>(async () => ({
    status: 'ready',
    data: enabled ? await listClient(organizationId!) : null,
  }), [enabled, organizationId]);

  const members = useRead<Member[] | null, never>(async () => {
    if (!enabled) return { status: 'ready', data: null };
    const r = await membersClient(organizationId!);
    return { status: 'ready', data: r.kind === 'ok' ? r.items : null };
  }, [enabled, organizationId]);

  const listState = list.state.status === 'ready' && list.state.data ? list.state.data : undefined;
  const memberList = members.state.status === 'ready' ? members.state.data : null;

  const items = listState?.kind === 'ok' ? listState.items : [];
  const filtered = items.filter((c) => matchesCampaignFilter(c, statusFilter));

  return (
    <div className={s.container} data-testid="panel-content">
      {/* Cabecera del panel según vPanel('campaigns') del boceto */}
      <header className={s.pnHead} data-testid="panel-header">
        <div className={s.headLeft}>
          <IsometricEmblem district="campaigns" />
          <div className={s.headText}>
            <h1 className={s.headTitle} data-testid="campaigns-title">
              Convocatorias
            </h1>
            <p className={s.headSub}>
              {enabled ? `Tu organización · ${items.length} en total` : 'Organización'}
            </p>
          </div>
        </div>
        <div className={s.acts}>
          {enabled && isSurfaceEnabled('action:create-campaign') && !creating && (
            <button
              type="button"
              className={s.pnBtnPrimary}
              aria-label="Crear convocatoria"
              onClick={() => {
                setJustCreated(null);
                setDone(null);
                setCreating(true);
              }}
              data-testid="new-campaign-button"
            >
              <PanelIcon name="plus" /> Nueva convocatoria
            </button>
          )}
        </div>
      </header>

      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta (organización y roles)" />}
      {state.status === 'ready' && !enabled && <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />}

      {enabled && (
        <>
          {justCreated && (
            <StatusNotice variant="success" title="Convocatoria creada">
              <p>
                Enlace público:{' '}
                <Link href={`/c/${encodeURIComponent(justCreated.publicCode)}`} data-testid="created-public-link">
                  Ver «{justCreated.title}»
                </Link>
              </p>
              <PublicQr publicCode={justCreated.publicCode} title={justCreated.title} />
              <p>Imprime o comparte este QR: abre la página pública de la convocatoria.</p>
            </StatusNotice>
          )}

          {done && <StatusNotice variant="success" text={done} />}

          {creating && (
            <CreateCampaignForm
              organizationId={organizationId!}
              onCancel={() => setCreating(false)}
              onCreated={(c, title) => {
                setJustCreated({ ...c, title });
                setCreating(false);
                list.reload();
              }}
            />
          )}

          {/* Chips de estado: Todas / Abiertas / Cerradas */}
          <div className={s.pnTabs} role="group" aria-label="Estado">
            <button
              type="button"
              className={s.pnTabBtn}
              aria-pressed={statusFilter === 'ALL'}
              onClick={() => setStatusFilter('ALL')}
            >
              Todas
            </button>
            <button
              type="button"
              className={s.pnTabBtn}
              aria-pressed={statusFilter === 'OPEN'}
              onClick={() => setStatusFilter('OPEN')}
            >
              Abiertas
            </button>
            <button
              type="button"
              className={s.pnTabBtn}
              aria-pressed={statusFilter === 'CLOSED'}
              onClick={() => setStatusFilter('CLOSED')}
            >
              Cerradas
            </button>
          </div>

          {listState === undefined && <LoadingState />}
          {listState?.kind === 'forbidden' && <ForbiddenState />}
          {(listState?.kind === 'error' || listState?.kind === 'unauthorized') && <ErrorState onRetry={list.reload} />}
          {listState?.kind === 'ok' && items.length === 0 && (
            <EmptyState text="Tu organización todavía no tiene convocatorias." />
          )}

          {listState?.kind === 'ok' && items.length > 0 && (
            <div className={s.tblWrap}>
              <table className={s.pnTable}>
                <thead>
                  <tr>
                    <th>Convocatoria</th>
                    <th>Estado</th>
                    <th>Recaudado</th>
                    <th>Meta</th>
                    <th>Cierra</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <CampaignRow
                      key={c.campaignRef}
                      c={c}
                      onAction={(kind) => {
                        setDone(null);
                        setAction({ kind, campaign: c });
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {action && (
            <ActionModal
              kind={action.kind}
              campaign={action.campaign}
              members={memberList}
              onClose={() => setAction(null)}
              onDone={() => {
                setDone(SUCCESS[action.kind]);
                setAction(null);
                list.reload();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
