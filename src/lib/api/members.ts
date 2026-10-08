'use client';

import { segment } from './config';
import { apiRequest } from './http';
import { ListOutcome } from './campaignAdmin';

const opt = (v: unknown) => (typeof v === 'string' ? v : undefined);

function listOutcome<T>(r: Awaited<ReturnType<typeof apiRequest<{ items?: unknown }>>>, map: (x: any) => T | null): ListOutcome<T> {
  if (r.kind === 'ok' && Array.isArray(r.data?.items)) {
    return { kind: 'ok', items: r.data!.items.map(map).filter((x: T | null): x is T => x !== null) };
  }
  if (r.kind === 'error' && r.status === 403) return { kind: 'forbidden' };
  if (r.kind === 'error' && r.status === 401) return { kind: 'unauthorized' };
  return { kind: 'error' };
}

/**
 * Invitaciones (§3.3, ADR-049; DD-65): `ADMINISTRATOR` o `REPRESENTATIVE`. Pendientes sin caducar, con el correo
 * **enmascarado** (nunca el correo completo). El correo de la invitación lleva `{web}/invitaciones#token=…`.
 */
export interface Invitation {
  invitationId: string;
  emailMasked: string;
  role: string;
  createdAt?: string;
  expiresAt?: string;
  delivery?: string;
}

export async function fetchInvitations(organizationId: string): Promise<ListOutcome<Invitation>> {
  const r = await apiRequest<{ items?: unknown }>({ path: `/organizations/${segment(organizationId)}/invitations`, auth: 'required' });
  return listOutcome(r, (i) => (i && typeof i.invitationId === 'string' ? {
    invitationId: i.invitationId, emailMasked: String(i.emailMasked ?? ''), role: String(i.role),
    createdAt: opt(i.createdAt), expiresAt: opt(i.expiresAt), delivery: opt(i.delivery),
  } : null));
}

/** `POST …/invitations` con `{email, role}` → `202 {invitationId, role, expiresAt}`, la misma respuesta exista o no la cuenta. */
export const inviteRequest = (organizationId: string) => (payload: unknown) => ({
  path: `/organizations/${segment(organizationId)}/invitations`, body: payload, auth: 'required' as const,
});

export const revokeInvitationRequest = (organizationId: string, invitationId: string) => () => ({
  path: `/organizations/${segment(organizationId)}/invitations/${segment(invitationId)}/revoke`, body: undefined, auth: 'required' as const,
});

/**
 * Cambiar papel (DD-66): `{role: ADMINISTRATOR}` añade el de administrador; `{role: EMPLOYEE}` deja a la persona solo
 * como empleada. Los papeles del `REPRESENTATIVE` solo los cambia él.
 */
export const changeRoleRequest = (organizationId: string, accountId: string) => (payload: unknown) => ({
  path: `/organizations/${segment(organizationId)}/members/${segment(accountId)}/role`, body: payload, auth: 'required' as const,
});

export const removeMemberRequest = (organizationId: string, accountId: string) => () => ({
  path: `/organizations/${segment(organizationId)}/members/${segment(accountId)}/remove`, body: undefined, auth: 'required' as const,
});

/**
 * Aceptar invitación (ADR-049 D4): `POST /invitations/accept` con JWT y el token **en el cuerpo** (D-09). Nunca en la
 * URL. 403 `InvitationNotAcceptable` uniforme (desconocido, caducado, revocado, usado u otro correo).
 */
export type AcceptOutcome =
  | { kind: 'ok'; organizationId?: string; roles: string[] }
  | { kind: 'not-acceptable' }
  | { kind: 'already-member' }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

export async function acceptInvitation(token: string): Promise<AcceptOutcome> {
  const r = await apiRequest<{ organizationId?: unknown; roles?: unknown }>({
    path: '/invitations/accept', method: 'POST', body: { token }, auth: 'required',
  });
  if (r.kind === 'ok') {
    return { kind: 'ok', organizationId: opt(r.data?.organizationId), roles: Array.isArray(r.data?.roles) ? r.data!.roles.map(String) : [] };
  }
  if (r.kind === 'error' && r.status === 403) return { kind: 'not-acceptable' };
  if (r.kind === 'error' && r.status === 409) return { kind: 'already-member' };
  if (r.kind === 'error' && r.status === 401) return { kind: 'unauthorized' };
  return { kind: 'error' };
}

/** "Mis convocatorias" (`GET /me/campaigns`, §3.4; DD-72): asignaciones activas de quien llama, también `CLOSED`. */
export interface MyCampaign {
  campaignRef: string;
  publicCode: string;
  title: string;
  status: string;
  actingRole: string;
  assignedAt?: string;
}

export async function fetchMyCampaigns(): Promise<ListOutcome<MyCampaign>> {
  const r = await apiRequest<{ items?: unknown }>({ path: '/me/campaigns', auth: 'required' });
  return listOutcome(r, (c) => (c && typeof c.campaignRef === 'string' && typeof c.publicCode === 'string' ? {
    campaignRef: c.campaignRef, publicCode: c.publicCode, title: String(c.title ?? ''), status: String(c.status),
    actingRole: String(c.actingRole), assignedAt: opt(c.assignedAt),
  } : null));
}
