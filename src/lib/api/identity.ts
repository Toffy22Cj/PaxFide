'use client';

import { apiRequest } from './http';
import { LEGAL_VERSIONS } from '../legal/versions';

/**
 * ID-01: `POST /api/v1/auth/login` → `200 {token}`; 400 campos vacíos; 401 cualquier fallo; 500 al emitir.
 * referencia-api-v1.md §1, nota D3 (plan-fase7-puesta-al-dia.md R-2, U-2): con la contraseña correcta y alguna versión
 * legal sin aceptar, `403 AcceptanceRequired` con las versiones pendientes y sin token. El 401 no cambia.
 * Nota del 2026-10-29 (ADR-050 Enmienda 2; plan-fase7-puesta-al-dia.md P-6): con la contraseña correcta y el correo sin
 * verificar, `403 EmailNotVerified` sin token; va antes que `AcceptanceRequired`.
 */
export type LoginOutcome =
  | { kind: 'ok'; token: string }
  | { kind: 'invalid-credentials' }
  | { kind: 'email-not-verified' }
  | { kind: 'acceptance-required'; pendingTermsVersion?: string; pendingDataPolicyVersion?: string }
  | { kind: 'bad-request' }
  | { kind: 'server-error' }
  | { kind: 'network' };

/** Las versiones que se aceptan al repetir el login: solo las pendientes, exactamente las vigentes. */
export interface LoginAcceptance {
  acceptedTermsVersion?: string;
  acceptedDataPolicyVersion?: string;
}

export async function login(email: string, password: string, acceptance?: LoginAcceptance): Promise<LoginOutcome> {
  const r = await apiRequest<{ token?: unknown }>({
    path: '/auth/login', method: 'POST', body: { email, password, ...(acceptance ?? {}) }, auth: 'none',
  });
  if (r.kind === 'network') return { kind: 'network' };
  if (r.kind === 'ok') {
    const token = r.data && typeof r.data.token === 'string' ? r.data.token : null;
    return token ? { kind: 'ok', token } : { kind: 'server-error' };
  }
  if (r.status === 401) return { kind: 'invalid-credentials' };
  if (r.status === 403 && r.problem.title === 'EmailNotVerified') return { kind: 'email-not-verified' };
  if (r.status === 403 && r.problem.title === 'AcceptanceRequired') {
    const out: LoginOutcome = { kind: 'acceptance-required' };
    if (r.problem.pendingTermsVersion) out.pendingTermsVersion = r.problem.pendingTermsVersion;
    if (r.problem.pendingDataPolicyVersion) out.pendingDataPolicyVersion = r.problem.pendingDataPolicyVersion;
    return out;
  }
  if (r.status === 400) return { kind: 'bad-request' };
  return { kind: 'server-error' };
}

/**
 * U-2: las versiones pendientes que la web sabe mostrar. Si el backend pide una que no es la de LEGAL_VERSIONS, la web
 * no tiene ese texto: no se puede aceptar desde aquí (null).
 */
export function acceptanceFor(outcome: { pendingTermsVersion?: string; pendingDataPolicyVersion?: string }): LoginAcceptance | null {
  const { pendingTermsVersion: t, pendingDataPolicyVersion: d } = outcome;
  if (t === undefined && d === undefined) return null;
  if (t !== undefined && t !== LEGAL_VERSIONS.terms) return null;
  if (d !== undefined && d !== LEGAL_VERSIONS.dataPolicy) return null;
  const out: LoginAcceptance = {};
  if (t !== undefined) out.acceptedTermsVersion = t;
  if (d !== undefined) out.acceptedDataPolicyVersion = d;
  return out;
}

export type Role = 'ADMINISTRATOR' | 'REPRESENTATIVE' | 'EMPLOYEE';
const ROLES: readonly string[] = ['ADMINISTRATOR', 'REPRESENTATIVE', 'EMPLOYEE'];

/** Ficha N1 (CONGELADA): exactamente `accountId`, `organizationId?`, `roles`, `platformAuthority?`. */
export interface Principal {
  accountId: string;
  organizationId?: string;
  roles: Role[];
  platformAuthority?: string;
}

export type MeOutcome =
  | { kind: 'ok'; principal: Principal }
  /** 404: el backend todavía no expone `/me` (solicitud S-01). No se infiere nada. */
  | { kind: 'unavailable' }
  | { kind: 'unauthorized' }
  /** Red, 5xx o una respuesta que viola la ficha: no se infiere ningún valor (delta N1 §3.5). */
  | { kind: 'error' };

export function parsePrincipal(data: unknown): Principal | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.accountId !== 'string' || !Array.isArray(d.roles)) return null;
  if (!d.roles.every((r) => typeof r === 'string' && ROLES.includes(r))) return null;
  if (d.organizationId !== undefined && typeof d.organizationId !== 'string') return null;
  if (d.platformAuthority !== undefined && typeof d.platformAuthority !== 'string') return null;
  if (d.roles.length > 0 && d.organizationId === undefined) return null;
  // Solo los cuatro campos de la ficha; cualquier otro se descarta
  const principal: Principal = { accountId: d.accountId, roles: d.roles as Role[] };
  if (d.organizationId !== undefined) principal.organizationId = d.organizationId as string;
  if (d.platformAuthority !== undefined) principal.platformAuthority = d.platformAuthority as string;
  return principal;
}

export async function fetchMe(): Promise<MeOutcome> {
  const r = await apiRequest<unknown>({ path: '/me', auth: 'required' });
  if (r.kind === 'network') return { kind: 'error' };
  if (r.kind === 'ok') {
    const principal = parsePrincipal(r.data);
    return principal ? { kind: 'ok', principal } : { kind: 'error' };
  }
  if (r.status === 401) return { kind: 'unauthorized' };
  if (r.status === 404) return { kind: 'unavailable' };
  return { kind: 'error' };
}

/**
 * `POST /auth/register` (P2; sin `Command-Id`, DD-56): `201 {accountId, status}`; 409 `DuplicateEmail`.
 * referencia-api-v1.md §1, nota R-5 (plan-fase7-puesta-al-dia.md R-1): lleva las dos versiones aceptadas; sin ellas o
 * con otra, 400 `BadRequest` sin cuenta creada (`legal-rejected`).
 */
export type RegisterOutcome =
  | { kind: 'ok' }
  | { kind: 'duplicate-email' }
  | { kind: 'invalid-email' }
  | { kind: 'bad-request' }
  | { kind: 'server-error' }
  | { kind: 'network' }
  | { kind: 'password-too-short' }
  | { kind: 'legal-rejected' };

export async function registerAccount(email: string, password: string): Promise<RegisterOutcome> {
  const r = await apiRequest<unknown>({
    path: '/auth/register', method: 'POST', auth: 'none',
    body: { email, password, acceptedTermsVersion: LEGAL_VERSIONS.terms, acceptedDataPolicyVersion: LEGAL_VERSIONS.dataPolicy },
  });
  if (r.kind === 'network') return { kind: 'network' };
  if (r.kind === 'ok') return { kind: 'ok' };
  if (r.status === 409) return { kind: 'duplicate-email' };
  if (r.status === 400 && r.problem.title === 'InvalidEmailFormat') return { kind: 'invalid-email' };
  // H-P2-1 del backend (`4d1d65a`): menos de 12 caracteres → 400 `PasswordTooShort`
  if (r.status === 400 && r.problem.title === 'PasswordTooShort') return { kind: 'password-too-short' };
  // Los campos vacíos no llegan al backend (los valida el formulario): un 400 `BadRequest` es la versión legal
  if (r.status === 400 && r.problem.title === 'BadRequest') return { kind: 'legal-rejected' };
  if (r.status === 400) return { kind: 'bad-request' };
  return { kind: 'server-error' };
}
