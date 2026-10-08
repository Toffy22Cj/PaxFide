'use client';

import React, { useState } from 'react';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { useRead } from '../lib/api/useRead';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { fetchMembers, ListOutcome, Member } from '../lib/api/campaignAdmin';
import {
  changeRoleRequest, fetchInvitations, Invitation, inviteRequest, removeMemberRequest, revokeInvitationRequest,
} from '../lib/api/members';
import { deliveryLabel, memberStatusLabel, roleLabel } from '../lib/labels';
import { Actions, PageHeader, Surface, uiClasses as ui } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ForbiddenState, LoadingState, StatusNotice, UnavailableState } from '../components/States';
import { CommandModal } from '../components/asset/CommandModal';
import { LocalDate } from '../components/LocalDate';

const ROLES = [{ value: 'EMPLOYEE', label: 'Empleado' }, { value: 'ADMINISTRATOR', label: 'Administrador' }];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Action =
  | { kind: 'invite' }
  | { kind: 'revoke'; invitation: Invitation }
  | { kind: 'make-admin' | 'only-employee' | 'remove'; member: Member };

/**
 * `/panel/members` (§3.3, ADR-049; DW-49): `ADMINISTRATOR` o `REPRESENTATIVE`. Miembros (por cuenta y papeles: el
 * contrato no trae nombre ni correo) con "Hacer administrador", "Dejar solo como empleado" y "Quitar"; invitaciones
 * pendientes (correo enmascarado) con "Revocar"; e "Invitar" por correo con papel.
 */
export function MembersScreen({ meClient = fetchMe, membersClient = fetchMembers, invitationsClient = fetchInvitations }: {
  meClient?: typeof fetchMe;
  membersClient?: typeof fetchMembers;
  invitationsClient?: typeof fetchInvitations;
}) {
  const { state, reload } = usePrincipal(meClient);
  const [action, setAction] = useState<Action | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const organizationId = state.status === 'ready' ? state.data.organizationId : undefined;
  const selfId = state.status === 'ready' ? state.data.accountId : '';
  const roles = state.status === 'ready' ? state.data.roles : [];
  const enabled = !!organizationId && (roles.includes('ADMINISTRATOR') || roles.includes('REPRESENTATIVE'));

  const members = useRead<ListOutcome<Member> | null, never>(async () => ({
    status: 'ready', data: enabled ? await membersClient(organizationId!) : null,
  }), [enabled, organizationId]);
  const invitations = useRead<ListOutcome<Invitation> | null, never>(async () => ({
    status: 'ready', data: enabled ? await invitationsClient(organizationId!) : null,
  }), [enabled, organizationId]);
  const m = members.state.status === 'ready' && members.state.data ? members.state.data : undefined;
  const inv = invitations.state.status === 'ready' && invitations.state.data ? invitations.state.data : undefined;

  const can = (surface: string) => isSurfaceEnabled(surface);
  const finish = (text: string) => { setDone(text); setAction(null); members.reload(); invitations.reload(); };
  const open = (a: Action) => { setDone(null); setAction(a); };

  return (
    <div>
      <PageHeader title="Personas de mi organización" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta (organización y roles)" />}
      {state.status === 'ready' && !enabled && <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />}
      {enabled && (
        <>
          {done && <StatusNotice variant="success" text={done} />}
          <Surface title="Miembros">
            {m === undefined && <LoadingState />}
            {m?.kind === 'forbidden' && <ForbiddenState />}
            {(m?.kind === 'error' || m?.kind === 'unauthorized') && <ErrorState onRetry={members.reload} />}
            {m?.kind === 'ok' && m.items.length === 0 && <EmptyState text="La organización todavía no tiene miembros." />}
            {m?.kind === 'ok' && m.items.length > 0 && (
              <ul className={ui.list}>
                {m.items.map((x) => {
                  const rep = x.roles.includes('REPRESENTATIVE');
                  // Los papeles del representante solo los cambia él (DD-66); quitarlo exige transferir (409)
                  const roleActions = !rep || x.accountId === selfId;
                  return (
                    <li key={x.accountId} data-testid="member">
                      <p><span className={ui.mono}>{x.accountId}</span>{x.accountId === selfId ? ' (tú)' : ''} ·{' '}
                        {x.roles.map(roleLabel).join(', ') || 'sin papel'} · {memberStatusLabel(x.status)}</p>
                      <Actions>
                        {roleActions && !x.roles.includes('ADMINISTRATOR') && can('action:member-change-role') && (
                          <Button variant="secondary" onClick={() => open({ kind: 'make-admin', member: x })}>Hacer administrador</Button>
                        )}
                        {roleActions && x.roles.includes('ADMINISTRATOR') && can('action:member-change-role') && (
                          <Button variant="secondary" onClick={() => open({ kind: 'only-employee', member: x })}>Dejar solo como empleado</Button>
                        )}
                        {!rep && x.accountId !== selfId && can('action:member-remove') && (
                          <Button variant="secondary" onClick={() => open({ kind: 'remove', member: x })}>Quitar de la organización</Button>
                        )}
                      </Actions>
                    </li>
                  );
                })}
              </ul>
            )}
          </Surface>
          <Surface title="Invitaciones pendientes">
            {can('action:member-invite') && (
              <Actions><Button onClick={() => open({ kind: 'invite' })}>Invitar</Button></Actions>
            )}
            {inv === undefined && <LoadingState />}
            {inv?.kind === 'forbidden' && <ForbiddenState />}
            {(inv?.kind === 'error' || inv?.kind === 'unauthorized') && <ErrorState onRetry={invitations.reload} />}
            {inv?.kind === 'ok' && inv.items.length === 0 && <EmptyState text="No hay invitaciones pendientes." />}
            {inv?.kind === 'ok' && inv.items.length > 0 && (
              <div className={ui.tableWrap}>
                <table className={ui.table}>
                  <thead><tr><th scope="col">Correo</th><th scope="col">Papel</th><th scope="col">Caduca</th><th scope="col">Envío</th><th scope="col">Acción</th></tr></thead>
                  <tbody>
                    {inv.items.map((i) => (
                      <tr key={i.invitationId} data-testid="invitation">
                        <td>{i.emailMasked}</td>
                        <td>{roleLabel(i.role)}</td>
                        <td>{i.expiresAt ? <LocalDate iso={i.expiresAt} withTime /> : '—'}</td>
                        <td>{deliveryLabel(i.delivery)}</td>
                        <td>{can('action:invitation-revoke') && (
                          <Button variant="secondary" onClick={() => open({ kind: 'revoke', invitation: i })}>Revocar</Button>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>
          {action?.kind === 'invite' && (
            <CommandModal title="Invitar a la organización" submitLabel="Enviar invitación"
              description="La persona recibe un correo con un enlace para unirse. Si ya tiene cuenta, entra con ella; si no, la crea con ese correo."
              fields={[
                { name: 'email', label: 'Correo electrónico', parse: (raw) => (EMAIL.test(raw) && raw.length <= 254 ? raw : null), invalid: 'El correo no es válido.' },
                { name: 'role', label: 'Papel', options: ROLES },
              ]}
              builder={inviteRequest(organizationId!)}
              onClose={() => setAction(null)}
              onSuccess={() => finish('Invitación enviada.')} />
          )}
          {action?.kind === 'revoke' && (
            <CommandModal title="Revocar invitación" submitLabel="Revocar" fields={[]}
              description={`La invitación a ${action.invitation.emailMasked} deja de servir.`}
              builder={revokeInvitationRequest(organizationId!, action.invitation.invitationId)}
              onClose={() => setAction(null)}
              onSuccess={() => finish('Invitación revocada.')} />
          )}
          {(action?.kind === 'make-admin' || action?.kind === 'only-employee') && (
            <CommandModal title={action.kind === 'make-admin' ? 'Hacer administrador' : 'Dejar solo como empleado'}
              submitLabel={action.kind === 'make-admin' ? 'Hacer administrador' : 'Dejar solo como empleado'} fields={[]}
              description={<>La cuenta <span className={ui.mono}>{action.member.accountId}</span>{action.kind === 'make-admin'
                ? ' podrá gestionar convocatorias, fondos y personas.'
                : ' deja de ser administradora y queda como empleada.'}{action.member.accountId === selfId
                ? ' Eres tú: perderás la gestión de la organización.' : ''}</>}
              builder={(p) => changeRoleRequest(organizationId!, action.member.accountId)({ ...(p as object), role: action.kind === 'make-admin' ? 'ADMINISTRATOR' : 'EMPLOYEE' })}
              onClose={() => setAction(null)}
              onSuccess={() => finish('Papel cambiado.')} />
          )}
          {action?.kind === 'remove' && (
            <CommandModal title="Quitar de la organización" submitLabel="Quitar" fields={[]}
              description={<>La cuenta <span className={ui.mono}>{action.member.accountId}</span> deja de pertenecer a la organización. Su cuenta sigue existiendo.</>}
              builder={removeMemberRequest(organizationId!, action.member.accountId)}
              onClose={() => setAction(null)}
              onSuccess={() => finish('Persona quitada de la organización.')} />
          )}
        </>
      )}
    </div>
  );
}
