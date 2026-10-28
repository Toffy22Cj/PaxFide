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

/**
 * El acceso sobre el mundo de la landing (plan-fase7-fidelidad.md D-F5) y los textos legales (D-F17, con la misma
 * barra del acceso). Estas pantallas montan su propio mundo (`AccessLayout`), en la vista panorámica.
 */
const ACCESS = new Set(['/login', '/register', '/invitaciones']);
const LEGAL = new Set(['/terminos', '/privacidad', '/terminos-organizacion']);

export function isAccessRoute(pathname: string): boolean {
  return ACCESS.has(pathname) || LEGAL.has(pathname);
}

/**
 * D-P13 (Carlos, 2026-10-23): en `/` la estructura de la app no pone su cabecera ni su barra de navegación (lateral ni
 * inferior); la landing usa solo su propia cabecera. D-F5 y D-F17: tampoco en el acceso ni en los textos legales, que
 * llevan la barra del acceso. En el resto de rutas, la estructura de siempre.
 */
export function hasAppChrome(pathname: string): boolean {
  return pathname !== '/' && !isAccessRoute(pathname);
}
