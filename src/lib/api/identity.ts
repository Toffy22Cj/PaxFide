import { apiRequest } from './http';

/** ID-01: `POST /api/v1/auth/login` → `200 {token}`; 400 campos vacíos; 401 cualquier fallo; 500 al emitir. */
export type LoginOutcome =
  | { kind: 'ok'; token: string }
  | { kind: 'invalid-credentials' }
  | { kind: 'bad-request' }
  | { kind: 'server-error' }
  | { kind: 'network' };

export async function login(email: string, password: string): Promise<LoginOutcome> {
  const r = await apiRequest<{ token?: unknown }>({
    path: '/auth/login', method: 'POST', body: { email, password }, auth: 'none',
  });
  if (r.kind === 'network') return { kind: 'network' };
  if (r.kind === 'ok') {
    const token = r.data && typeof r.data.token === 'string' ? r.data.token : null;
    return token ? { kind: 'ok', token } : { kind: 'server-error' };
  }
  if (r.status === 401) return { kind: 'invalid-credentials' };
  if (r.status === 400) return { kind: 'bad-request' };
  return { kind: 'server-error' };
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
