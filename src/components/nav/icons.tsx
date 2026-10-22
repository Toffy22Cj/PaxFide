// Ref: prompts-agentes-estilo-v2.md VS-2 (iconos SVG propios con currentColor) y nota de Carlos 2026-10-21 (lista).
import React from 'react';
import type { NavIcon } from '../../lib/nav/navEntries';

/** Trazos de 24×24. Decorativos: la etiqueta visible da el nombre (sin texto en imagen). */
function paths(id: NavIcon): React.ReactNode {
  switch (id) {
    case 'inicio':
      return <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5h4v5" /></>;
    case 'explorar':
      return <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>;
    case 'donaciones':
      return <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />;
    case 'seguimiento':
      return <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16" /></>;
    case 'organizacion':
      return <><path d="M4 20V8l8-4 8 4v12" /><path d="M9 20v-5h6v5" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></>;
    case 'convocatorias':
      return <><path d="M5 4v16" /><path d="M5 5h11l-2 3.5 2 3.5H5" /></>;
    case 'lotes':
      return <><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></>;
    case 'perfil':
      return <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>;
    case 'ajustes':
      return <><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="17" r="2" /></>;
    case 'qr':
      return <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2" /></>;
    default: {
      const unreachable: never = id;
      throw new Error(`Icono desconocido: ${String(unreachable)}`);
    }
  }
}

export function NavIconSvg({ id }: { id: NavIcon }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" data-icon={id}>
      {paths(id)}
    </svg>
  );
}
