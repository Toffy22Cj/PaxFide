import { isSurfaceEnabled } from './surfaces';

export type RouteCategory = 'PUBLIC' | 'AUTH' | 'AUTHENTICATED' | 'NOT_APPROVED';

/** Validación estructural heredada (`front-fase2` §8): no vacío + longitud máxima defensiva. */
function isValidParam(param: string | undefined): boolean {
  return !!param && param.length > 0 && param.length <= 255;
}

function when(surface: string, category: RouteCategory): RouteCategory {
  return isSurfaceEnabled(surface) ? category : 'NOT_APPROVED';
}

/**
 * Categoría de una ruta (G-W1, G-W4). Solo conoce la ruta y la lista de habilitación; nunca roles, sesión ni
 * códigos HTTP (invariante 3 de `front-fase2` §8).
 */
export function classifyRoute(pathname: string): RouteCategory {
  if (!pathname.startsWith('/')) return 'NOT_APPROVED';
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return 'NOT_APPROVED';

  const [a, b] = parts;

  if (parts.length === 1 && a === 'login') return when('/login', 'AUTH');

  if (parts.length === 2 && a === 'c') {
    return isValidParam(b) ? when('/c/:publicCode', 'PUBLIC') : 'NOT_APPROVED';
  }

  // Seguimiento por formulario (C2/H1, DW-01): el código nunca va en la ruta. `/tracking/<lo-que-sea>` no existe
  // en ningún build, esté o no en la lista.
  if (a === 'tracking') {
    return parts.length === 1 ? when('/tracking', 'PUBLIC') : 'NOT_APPROVED';
  }

  if (parts.length === 2 && a === 'assets') {
    return isValidParam(b) ? when('/assets/:assetRef', 'AUTHENTICATED') : 'NOT_APPROVED';
  }

  if (parts.length === 2 && a === 'account' && b === 'donations') {
    return when('/account/donations', 'AUTHENTICATED');
  }

  if (a === 'panel') {
    if (parts.length === 1) return when('/panel', 'AUTHENTICATED');
    if (parts.length === 2 && b === 'campaigns') return when('/panel/campaigns', 'AUTHENTICATED');
    if (parts.length === 2 && b === 'prediction') return when('/panel/prediction', 'AUTHENTICATED');
    // /panel/platform/** y cualquier otra: fuera de v1 (T6)
    return 'NOT_APPROVED';
  }

  return 'NOT_APPROVED';
}
