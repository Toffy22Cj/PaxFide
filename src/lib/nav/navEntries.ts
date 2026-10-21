// Ref: prompts-agentes-estilo-v2.md VS-2 (entradas según superficies y rol de GET /me) y nota de Carlos 2026-10-21
// (lista de iconos); ADR-046 D5 (una superficie deshabilitada no aparece); respuesta de Carlos al plan de VS-2 (B, C).
import type { Principal } from '../api/identity';

/** Los diez iconos aprobados (nota de Carlos, 2026-10-21). Solo se muestran los que tienen una ruta habilitada. */
export type NavIcon =
  | 'inicio' | 'explorar' | 'donaciones' | 'seguimiento' | 'organizacion'
  | 'convocatorias' | 'lotes' | 'perfil' | 'ajustes' | 'qr';

export interface NavEntry {
  id: NavIcon;
  label: string;
  href: string;
}

/** Qué sabe la barra de la sesión. `principal: null` = sin sesión o `/me` sin datos (DW-06). */
export interface NavContext {
  authenticated: boolean;
  principal: Principal | null;
}

/** Orden fijo: el mismo en todas las posiciones de la barra (enmienda §8). */
const ORDER: readonly NavIcon[] = [
  'inicio', 'explorar', 'donaciones', 'seguimiento', 'organizacion', 'convocatorias', 'lotes', 'perfil', 'ajustes', 'qr',
];

/** Ruta y etiqueta de cada icono; `null` = no hay ruta aprobada y la entrada nunca aparece (D5). */
export function routeFor(id: NavIcon): { label: string; href: string | null } {
  switch (id) {
    case 'inicio': return { label: 'Inicio', href: '/home' };
    case 'explorar': return { label: 'Explorar', href: '/campaigns' };
    case 'donaciones': return { label: 'Donaciones', href: '/account/donations' };
    case 'seguimiento': return { label: 'Seguimiento', href: '/tracking' };
    case 'organizacion': return { label: 'Organización', href: '/panel' };
    case 'convocatorias': return { label: 'Convocatorias', href: '/panel/campaigns' };
    case 'lotes': return { label: 'Lotes', href: '/panel/assets' };
    case 'perfil': return { label: 'Perfil', href: null }; // GET /account/profile no implementado (ADR-050)
    case 'ajustes': return { label: 'Ajustes', href: null }; // sin ruta aprobada
    case 'qr': return { label: 'QR', href: null }; // lector QR sin decidir (§3.3 de los prompts)
    default: {
      const unreachable: never = id;
      throw new Error(`Entrada de navegación desconocida: ${String(unreachable)}`);
    }
  }
}

/**
 * Quién ve la entrada. Es representación, no autorización (ADR-046 D5): el backend sigue autorizando y cada
 * pantalla resuelve su 403. Los criterios de rol son los de `PanelHomeScreen`.
 */
function visibleTo(id: NavIcon, ctx: NavContext): boolean {
  const roles = ctx.principal?.roles ?? [];
  switch (id) {
    case 'explorar':
    case 'seguimiento':
      return true;
    case 'inicio':
    case 'donaciones':
      return ctx.authenticated; // también los miembros de una organización (respuesta C)
    case 'organizacion':
      return ctx.authenticated && ctx.principal?.organizationId !== undefined; // respuesta B
    case 'convocatorias':
      return ctx.authenticated && roles.includes('ADMINISTRATOR');
    case 'lotes':
      return ctx.authenticated && (roles.includes('ADMINISTRATOR') || roles.includes('EMPLOYEE'));
    case 'perfil':
    case 'ajustes':
    case 'qr':
      return false;
    default: {
      const unreachable: never = id;
      throw new Error(`Entrada de navegación desconocida: ${String(unreachable)}`);
    }
  }
}

export function navEntriesFor(ctx: NavContext, isEnabled: (surface: string) => boolean): NavEntry[] {
  const out: NavEntry[] = [];
  for (const id of ORDER) {
    const { label, href } = routeFor(id);
    if (href === null || !isEnabled(href) || !visibleTo(id, ctx)) continue;
    out.push({ id, label, href });
  }
  return out;
}

/** La entrada activa es la de prefijo más largo que coincide por segmentos (`/panel` no activa `/panelx`). */
export function activeEntry(pathname: string, entries: readonly NavEntry[]): NavIcon | null {
  let best: NavEntry | null = null;
  for (const e of entries) {
    const match = pathname === e.href || pathname.startsWith(e.href + '/');
    if (match && (!best || e.href.length > best.href.length)) best = e;
  }
  return best ? best.id : null;
}

/** Posición por ancho (enmienda §8, E4): barra inferior por debajo de 768 px, lateral desde 768 px. */
export type NavPosition = 'bottom' | 'side';
export const NAV_BREAKPOINT_PX = 768;

export function positionForWidth(width: number): NavPosition {
  return width >= NAV_BREAKPOINT_PX ? 'side' : 'bottom';
}
