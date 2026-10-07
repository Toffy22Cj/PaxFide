'use client';

import { segment } from './config';
import { apiRequest } from './http';

/** CV-01: `POST /organizations/{organizationId}/campaigns` → `201 {campaignRef, publicCode}` (exactamente esos dos). */
export function createCampaignRequest(organizationId: string) {
  return (payload: unknown) => ({
    path: `/organizations/${segment(organizationId)}/campaigns`, body: payload, auth: 'required' as const,
  });
}

export interface CreatedCampaign {
  campaignRef: string;
  publicCode: string;
}

export function parseCreatedCampaign(data: unknown): CreatedCampaign | null {
  const d = data as Record<string, unknown> | null;
  return d && typeof d.campaignRef === 'string' && typeof d.publicCode === 'string'
    ? { campaignRef: d.campaignRef, publicCode: d.publicCode } : null;
}

const opt = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** `GET /organizations/{organizationId}/campaigns` (S-02 resuelta; DD-49): una página de 100, solo `ADMINISTRATOR`. */
export interface AdminCampaign {
  campaignRef: string;
  publicCode: string;
  title: string;
  status: string;
  visibility?: string;
  currency?: string;
  targetAmount?: string;
  targetPolicy?: string;
  clearedAmount?: string;
  responsibles: { accountId: string; actingRole: string }[];
  assignedEmployeeCount: number;
}

export type ListOutcome<T> = { kind: 'ok'; items: T[] } | { kind: 'forbidden' } | { kind: 'unauthorized' } | { kind: 'error' };

function listOutcome<T>(r: Awaited<ReturnType<typeof apiRequest<{ items?: unknown }>>>, map: (x: any) => T | null): ListOutcome<T> {
  if (r.kind === 'ok' && Array.isArray(r.data?.items)) {
    return { kind: 'ok', items: r.data!.items.map(map).filter((x: T | null): x is T => x !== null) };
  }
  if (r.kind === 'error' && r.status === 403) return { kind: 'forbidden' };
  if (r.kind === 'error' && r.status === 401) return { kind: 'unauthorized' };
  return { kind: 'error' };
}

export async function fetchOrganizationCampaigns(organizationId: string): Promise<ListOutcome<AdminCampaign>> {
  const r = await apiRequest<{ items?: unknown }>({ path: `/organizations/${segment(organizationId)}/campaigns`, auth: 'required' });
  return listOutcome(r, (i) => (i && typeof i.campaignRef === 'string' && typeof i.publicCode === 'string' && typeof i.title === 'string' ? {
    campaignRef: i.campaignRef, publicCode: i.publicCode, title: i.title, status: String(i.status), visibility: opt(i.visibility),
    currency: opt(i.currency), targetAmount: opt(i.targetAmount), targetPolicy: opt(i.targetPolicy), clearedAmount: opt(i.clearedAmount),
    responsibles: Array.isArray(i.responsibles)
      ? i.responsibles.filter((x: any) => x && typeof x.accountId === 'string').map((x: any) => ({ accountId: x.accountId, actingRole: String(x.actingRole) }))
      : [],
    assignedEmployeeCount: typeof i.assignedEmployeeCount === 'number' ? i.assignedEmployeeCount : 0,
  } : null));
}

/** `GET /organizations/{organizationId}/members` (R6 resuelto; DD-55): `ADMINISTRATOR` o `REPRESENTATIVE`; sin email. */
export interface Member {
  accountId: string;
  roles: string[];
  status?: string;
}

export async function fetchMembers(organizationId: string): Promise<ListOutcome<Member>> {
  const r = await apiRequest<{ items?: unknown }>({ path: `/organizations/${segment(organizationId)}/members`, auth: 'required' });
  return listOutcome(r, (m) => (m && typeof m.accountId === 'string'
    ? { accountId: m.accountId, roles: Array.isArray(m.roles) ? m.roles.map(String) : [], status: opt(m.status) } : null));
}

/** CV-03: `POST /campaigns/{campaignRef}/administrators` con `{administratorRef}` → `201 {assignmentId}`. */
export const designateAdministratorRequest = (campaignRef: string) => (payload: unknown) => ({
  path: `/campaigns/${segment(campaignRef)}/administrators`, body: payload, auth: 'required' as const,
});

/** CV-02 desde una fila del listado. */
export const assignEmployeeToRequest = (campaignRef: string) => (payload: unknown) => ({
  path: `/campaigns/${segment(campaignRef)}/employees`, body: payload, auth: 'required' as const,
});

/**
 * Retirar responsable (DD-50; `responsibleRef` = `accountId` del responsable): sin cuerpo, o
 * `{replacementRef, replacementActingRole}`. 409 si es el último. Sin reemplazo no se envía cuerpo.
 */
export const removeResponsibleRequest = (campaignRef: string, responsibleRef: string) => (payload: unknown) => ({
  path: `/campaigns/${segment(campaignRef)}/responsibles/${segment(responsibleRef)}/remove`,
  body: payload && typeof payload === 'object' && Object.keys(payload).length > 0 ? payload : undefined,
  auth: 'required' as const,
});

/** Cerrar convocatoria (sin cuerpo): `200 {campaignRef, status: "CLOSED"}`; `CLOSED` es terminal (409 `CampaignAlreadyClosed`). */
export const closeCampaignRequest = (campaignRef: string) => () => ({
  path: `/campaigns/${segment(campaignRef)}/close`, body: undefined, auth: 'required' as const,
});
