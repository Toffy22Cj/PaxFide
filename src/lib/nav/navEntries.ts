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
    case 'perfil': return { label: 'Perfil', href: '/account' }; // D-F9: nueva superficie /account
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
      return ctx.authenticated; // D-F9: disponible para cualquier cuenta con sesión
    case 'ajustes':
    case 'qr':
      return false;
    default: {
      const unreachable: never = id;
      throw new Error(`Entrada de navegación desconocida: ${String(unreachable)}`);
    }
  }
}

/** Máximo de entradas en la barra inferior (DF7-20, Carlos 2026-10-22). Con Inicio (VS-5), el ADMINISTRATOR queda en 5. */
export const MAX_BOTTOM_ENTRIES = 5;

/**
 * Entradas que solo están en la barra lateral: en la inferior se abren desde el panel (DF7-20). La regla vive aquí,
 * no en CSS, para que en pantalla estrecha esas entradas no estén en la página.
 */
function inBottomBar(id: NavIcon, ctx?: NavContext): boolean {
  switch (id) {
    case 'convocatorias':
    case 'lotes':
      return false;
    case 'seguimiento':
      // D-F15: en < 768 px, para las cuentas con organización, "Donaciones" y "Seguimiento" se combinan en "Donaciones"
      if (ctx?.authenticated && ctx.principal?.organizationId !== undefined) {
        return false;
      }
      return true;
    case 'inicio':
    case 'explorar':
    case 'donaciones':
    case 'organizacion':
    case 'perfil':
      return true;
    case 'ajustes':
    case 'qr':
      return false;
    default: {
      const unreachable: never = id;
      throw new Error(`Entrada de navegación desconocida: ${String(unreachable)}`);
    }
  }
}

/**
 * Entradas de la barra para una posición. Antes de hidratar (`auto`) se usa el conjunto de la barra inferior: es el
 * que cabe en cualquier ancho, y la lateral solo añade entradas al final.
 */
export function navEntriesFor(
  ctx: NavContext,
  isEnabled: (surface: string) => boolean,
  position: NavPosition | 'auto' = 'side',
): NavEntry[] {
  const narrow = position === 'bottom' || position === 'auto';
  const out: NavEntry[] = [];
  for (const id of ORDER) {
    const { label, href } = routeFor(id);
    if (href === null || !isEnabled(href) || !visibleTo(id, ctx)) continue;
    if (narrow && !inBottomBar(id, ctx)) continue;
    out.push({ id, label, href });
  }
  return out;
}

/** La entrada activa es la de prefijo más largo que coincide por segmentos (`/panel` no activa `/panelx`). */
export function activeEntry(pathname: string, entries: readonly NavEntry[]): NavIcon | null {
  // D-F15: si estamos en /tracking y 'seguimiento' no está en la barra pero sí 'donaciones', 'donaciones' queda activa
  const hasSeguimiento = entries.some((e) => e.id === 'seguimiento');
  const hasDonaciones = entries.some((e) => e.id === 'donaciones');
  if (pathname === '/tracking' && !hasSeguimiento && hasDonaciones) {
    return 'donaciones';
  }
  let best: NavEntry | null = null;
  for (const e of entries) {
    const match = pathname === e.href || pathname.startsWith(e.href + '/');
    if (match && (!best || e.href.length > best.href.length)) best = e;
  }
  return best ? best.id : null;
}

/** Posición por ancho y configuración (D-F8; enmienda §8): barra inferior por debajo de 768 px, configurable desde 768 px. */
export type NavPosition = 'bottom' | 'side' | 'left' | 'right' | 'top';
export const NAV_BREAKPOINT_PX = 768;

export function positionForWidth(width: number, customPos?: NavPosition | null): NavPosition {
  if (width < NAV_BREAKPOINT_PX) return 'bottom';
  if (customPos && (customPos === 'top' || customPos === 'bottom' || customPos === 'left' || customPos === 'right' || customPos === 'side')) {
    return customPos;
  }
  return 'side';
}

export const NAV_POSITION_STORAGE_KEY = 'paxfide.nav-position';

export function readSavedNavPosition(): NavPosition | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(NAV_POSITION_STORAGE_KEY);
    if (val === 'top' || val === 'bottom' || val === 'left' || val === 'right' || val === 'side') {
      return val as NavPosition;
    }
  } catch {}
  return null;
}

export function saveNavPosition(pos: NavPosition | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (pos) {
      localStorage.setItem(NAV_POSITION_STORAGE_KEY, pos);
      if (window.innerWidth >= NAV_BREAKPOINT_PX) {
        document.documentElement.setAttribute('data-nav-position', pos);
      }
    } else {
      localStorage.removeItem(NAV_POSITION_STORAGE_KEY);
      document.documentElement.removeAttribute('data-nav-position');
    }
    window.dispatchEvent(new Event('paxfide:nav-position-change'));
  } catch {}
}

export const NAV_POSITION_INIT_SCRIPT =
  `try{var p=window.localStorage.getItem(${JSON.stringify(NAV_POSITION_STORAGE_KEY)});` +
  `if(p&&window.innerWidth>=768&&(p==='top'||p==='bottom'||p==='left'||p==='right'||p==='side')){` +
  `document.documentElement.setAttribute('data-nav-position',p);}}catch(e){}`;
