// Ref: plan-fase7-pantallas.md D-P2 (rutas con fondo animado); plan-fase7-fidelidad.md D-F5 (acceso sobre el mundo),
// D-F17 (rutas legales con barra de acceso y sin chrome); sistema-visual-paxfide-web-enmienda-1.md §3.1 y R-F7.

/** Rutas de acceso y legales que se muestran sobre el mundo y sin estructura de app (D-F5, D-F17). */
const ACCESS_ROUTES = new Set([
  '/login',
  '/register',
  '/invitaciones',
  '/recuperar',
  '/verificar-correo', // plan-fase7-puesta-al-dia.md P-6
  '/terminos',
  '/privacidad',
  '/terminos-organizacion',
]);

/**
 * U-30 (plan-fase7-puesta-al-dia.md Anexo 4): rutas del grupo `(acceso)`. El Shell no las separa por ruta: el marco del
 * acceso (mundo, barra y tarjeta) se queda montado entre ellas.
 */
export function isAccessRoute(pathname: string): boolean {
  return ACCESS_ROUTES.has(pathname);
}

/** Rutas exactas o con parámetro (`/c/:publicCode`) con fondo animado (la ciudad, o el mundo en `/` y acceso). */
const EXACT = new Set([
  '/',
  '/home',
  '/campaigns',
  '/tracking',
  '/account/donations',
  '/account',
  ...ACCESS_ROUTES,
]);
const PREFIXES = ['/c/'];

export function hasAnimatedBackground(pathname: string): boolean {
  if (EXACT.has(pathname)) return true;
  return PREFIXES.some((p) => pathname.startsWith(p) && pathname.length > p.length && !pathname.slice(p.length).includes('/'));
}

export type AnimatedBackground = 'city' | 'world';

/**
 * Qué ilustración va detrás: en `/` y en las rutas de acceso/legales (D-F5, D-F17) el mundo del recorrido;
 * en las demás rutas de donante, la ciudad. Fuera de ellas, ninguna (R-F7).
 */
export function backgroundFor(pathname: string): AnimatedBackground | null {
  if (!hasAnimatedBackground(pathname)) return null;
  return pathname === '/' || ACCESS_ROUTES.has(pathname) ? 'world' : 'city';
}

/**
 * D-P13, D-F5, D-F17: en `/`, `/login`, `/register`, `/invitaciones` y las rutas legales, la estructura de la app
 * no pone cabecera ni barra de navegación de la app. Esas páginas usan su propia cabecera/barra de acceso.
 */
export function hasAppChrome(pathname: string): boolean {
  return pathname !== '/' && !ACCESS_ROUTES.has(pathname);
}
