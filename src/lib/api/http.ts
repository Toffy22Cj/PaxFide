import { getJwt, handle401 } from '../auth/session';
import { getApiBase } from './config';

/**
 * Cliente HTTP único de la web (ADR-046 D3: navegador → backend, sin BFF).
 *
 * - El JWT solo se lee de memoria y solo viaja en `Authorization` hacia el backend.
 * - Nada de lo que pasa por aquí se registra: ni rutas, ni cabeceras, ni cuerpos (secretos bearer, ADR-041 §2.7).
 * - Del `ProblemDetail` solo se conserva `title` (nombre de la regla); el `detail` nunca se muestra
 *   (`diseno-ux-contractual-web-v1.md` §6).
 */

export type AuthMode =
  /** Ruta con JWT obligatorio: un 401 es T-1 (cierra la sesión local). */
  | 'required'
  /** JWT opcional (CV-11): se envía si existe; un 401 con JWT también es T-1. */
  | 'optional'
  /** Ruta pública o con su propio mecanismo (seguimiento, `Intent-Token`): un 401 nunca toca la sesión. */
  | 'none';

export interface ApiRequest {
  path: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  auth: AuthMode;
  headers?: Record<string, string>;
}

export interface ProblemInfo {
  title?: string;
}

export type ApiResult<T> =
  | { kind: 'ok'; status: number; data: T; location: string | null }
  | { kind: 'error'; status: number; problem: ProblemInfo }
  /** Timeout, conexión cortada o sin respuesta: nunca se sabe si llegó al servidor. */
  | { kind: 'network' };

async function readJson(res: Response): Promise<unknown> {
  if (typeof res.text !== 'function') return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function problemOf(body: unknown): ProblemInfo {
  if (body && typeof body === 'object' && typeof (body as { title?: unknown }).title === 'string') {
    return { title: (body as { title: string }).title };
  }
  return {};
}

export async function apiRequest<T>(req: ApiRequest): Promise<ApiResult<T>> {
  const base = getApiBase();
  const headers: Record<string, string> = { Accept: 'application/json', ...(req.headers ?? {}) };
  const jwt = req.auth === 'none' ? null : getJwt();
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  if (req.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${base}${req.path}`, {
      method: req.method ?? 'GET',
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    return { kind: 'network' };
  }

  if (res.status === 401 && jwt) {
    // T-1 solo si la petición llevaba JWT; las rutas con su propio mecanismo nunca tocan la sesión
    handle401(false);
  }

  const body = await readJson(res).catch(() => null);
  if (res.status >= 200 && res.status < 300) {
    const location = res.headers && typeof res.headers.get === 'function' ? res.headers.get('Location') : null;
    return { kind: 'ok', status: res.status, data: body as T, location };
  }
  return { kind: 'error', status: res.status, problem: problemOf(body) };
}
