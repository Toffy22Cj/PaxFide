// Ref: sistema-visual-paxfide-web.md §6 («versión del logo»): el emblema del logo oficial, sin el texto, generado por
// scripts/marca/generar-iconos.py desde Documentos/marca/paxfide-logo-original.webp. Sustituye al SVG provisional.
import React from 'react';

export const BRAND_MARK_SRC = '/marca/paxfide-emblema.png';

/** Marca de PaxFide. Decorativa: el nombre va al lado en texto. Compartida por la cabecera, la landing y el acceso. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- un PNG estático de 192 px: next/image no aporta nada aquí
    <img src={BRAND_MARK_SRC} width={size} height={size} alt="" aria-hidden="true" decoding="async"
         data-testid="brand-mark" style={{ display: 'block', flex: 'none' }} />
  );
}
