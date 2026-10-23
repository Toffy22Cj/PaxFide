// Ref: plan-fase7-pantallas.md D-P2 (rutas con fondo animado); sistema-visual-paxfide-web-enmienda-1.md §3.1 (solo
// pantallas del donante; nunca en la parte administrativa) y R-F7.

/** Rutas exactas o con parámetro (`/c/:publicCode`) con fondo animado (la ciudad, o el mundo en `/`). */
const EXACT = new Set(['/', '/home', '/campaigns', '/tracking', '/account/donations']);
const PREFIXES = ['/c/'];

export function hasAnimatedBackground(pathname: string): boolean {
  if (EXACT.has(pathname)) return true;
  return PREFIXES.some((p) => pathname.startsWith(p) && pathname.length > p.length && !pathname.slice(p.length).includes('/'));
}

export type AnimatedBackground = 'city' | 'world';

/**
 * Qué ilustración va detrás (A-2): en `/` el mundo del recorrido de la landing, que monta la propia landing porque lo
 * guía su scroll; en las demás rutas de D-P2, la ciudad. Fuera de D-P2, ninguna.
 */
export function backgroundFor(pathname: string): AnimatedBackground | null {
  if (!hasAnimatedBackground(pathname)) return null;
  return pathname === '/' ? 'world' : 'city';
}
