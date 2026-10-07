'use client';

import * as session from './session';
import { fetchMe, Principal } from '../api/identity';
import { useRead, ReadState } from '../api/useRead';

export type PrincipalState = ReadState<Principal, 'unavailable' | 'error' | 'unauthorized'>;

/**
 * Lee `GET /me` al entrar en cada página que lo necesita (D-N1-3 (a)). Solo representa: un 403 del backend manda
 * sobre lo que diga la respuesta. El último valor queda en memoria con la sesión y se descarta en `LOGGED_OUT`.
 */
export function usePrincipal(client: typeof fetchMe = fetchMe) {
  return useRead<Principal, 'unavailable' | 'error' | 'unauthorized'>(async () => {
    const r = await client();
    if (r.kind === 'ok') {
      session.setLastPrincipal(r.principal);
      return { status: 'ready', data: r.principal };
    }
    return { status: r.kind };
  }, []);
}
