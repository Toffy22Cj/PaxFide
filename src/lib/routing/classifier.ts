import enabledSurfacesList from './enabled-surfaces.json';

export type RouteCategory = 'PUBLIC' | 'AUTH' | 'AUTHENTICATED' | 'NOT_APPROVED';

function getEnabledSurfaces() {
  if (process.env.NEXT_PUBLIC_E2E_SURFACES) {
    return new Set<string>(JSON.parse(process.env.NEXT_PUBLIC_E2E_SURFACES));
  }
  return new Set<string>(enabledSurfacesList);
}

const enabledSurfaces = getEnabledSurfaces();

function isValidParam(param: string | undefined): boolean {
  if (!param) return false;
  if (param.length === 0 || param.length > 255) return false;
  return true;
}

export function classifyRoute(pathname: string): RouteCategory {
  if (!pathname.startsWith('/')) {
    return 'NOT_APPROVED';
  }

  const parts = pathname.split('/').filter(Boolean);

  if (parts.length === 0) {
    return 'NOT_APPROVED';
  }

  // Auth
  if (parts.length === 1 && parts[0] === 'login') {
    if (!enabledSurfaces.has('/login')) return 'NOT_APPROVED';
    return 'AUTH';
  }

  // Public
  if (parts.length === 2 && parts[0] === 'c') {
    if (!enabledSurfaces.has('/c/:publicCode')) return 'NOT_APPROVED';
    if (!isValidParam(parts[1])) return 'NOT_APPROVED';
    return 'PUBLIC';
  }

  if (parts.length === 2 && parts[0] === 'tracking') {
    // tracking is explicitly blocked by C2 until verified, but if it were enabled:
    if (!enabledSurfaces.has('/tracking/:trackingCode')) return 'NOT_APPROVED';
    if (!isValidParam(parts[1])) return 'NOT_APPROVED';
    return 'PUBLIC';
  }

  // Authenticated
  if (parts.length === 2 && parts[0] === 'assets') {
    if (!enabledSurfaces.has('/assets/:assetRef')) return 'NOT_APPROVED';
    if (!isValidParam(parts[1])) return 'NOT_APPROVED';
    return 'AUTHENTICATED';
  }

  if (parts.length === 1 && parts[0] === 'panel') {
    if (!enabledSurfaces.has('/panel')) return 'NOT_APPROVED';
    return 'AUTHENTICATED';
  }

  if (parts.length === 2 && parts[0] === 'panel' && parts[1] === 'campaigns') {
    if (!enabledSurfaces.has('/panel/campaigns')) return 'NOT_APPROVED';
    return 'AUTHENTICATED';
  }

  // Explicit blocks (R1, etc)
  if (parts[0] === 'panel' && parts[1] === 'platform') {
    return 'NOT_APPROVED';
  }

  return 'NOT_APPROVED';
}
