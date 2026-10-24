// Ref: sistema-visual-paxfide-web.md §6 (marca: SVG propio con los colores de marca, sustituto ligero del raster).
import React from 'react';

/** Marca de PaxFide. Decorativa: el nombre va al lado en texto. Compartida por la cabecera de la app y la landing. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <circle cx="20" cy="8" r="4" fill="var(--brand-yellow-400)" />
      <path d="M4 18c3-1 6-1 9 1l5 3c1 .6 2.4.3 3-.7.5-.9.2-2-.7-2.6L15 15" fill="none" stroke="var(--brand-green-800)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M14 13.5c-1.8-1.6-3.8-.4-3.8 1.4 0 1.9 2.4 3.4 3.8 4.4 1.4-1 3.8-2.5 3.8-4.4 0-1.8-2-3-3.8-1.4z" fill="var(--brand-green-500)" />
    </svg>
  );
}
