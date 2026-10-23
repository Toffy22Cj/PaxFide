// Ref: plan-fase7-pantallas.md D-P2 (rutas con fondo animado); sistema-visual-paxfide-web-enmienda-1.md §3.1 (solo
// pantallas del donante; nunca en la parte administrativa) y R-F7.

/** Rutas exactas o con parámetro (`/c/:publicCode`) donde se monta la ciudad animada. */
const EXACT = new Set(['/', '/home', '/campaigns', '/tracking', '/account/donations']);
const PREFIXES = ['/c/'];

export function hasAnimatedBackground(pathname: string): boolean {
  if (EXACT.has(pathname)) return true;
  return PREFIXES.some((p) => pathname.startsWith(p) && pathname.length > p.length && !pathname.slice(p.length).includes('/'));
}
