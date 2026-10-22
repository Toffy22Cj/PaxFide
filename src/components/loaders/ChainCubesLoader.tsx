'use client';
// Ref: Documentos/prompts-agentes-estilo-v2.md VS-1; Documentos/sistema-visual-paxfide-web-enmienda-1.md §7.2; Documentos/plan-vs1-movimiento.md §2–§5.
import React from 'react';
import s from './Loaders.module.css';

export type ChainCubesLoaderProps = {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-label'?: string;
};

/**
 * 01 Cubos encadenados: tres cubos isométricos interconectados que saltan en secuencia.
 * Evoca la idea de trazabilidad y encadenamiento criptográfico sin términos técnicos.
 * Colores: 2 cubos azules y 1 verde al final, con enlaces celestes.
 */
export function ChainCubesLoader({
  className,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel = 'Cargando',
}: ChainCubesLoaderProps) {
  const isHidden = ariaHidden === true || ariaHidden === 'true';

  return (
    <div
      className={[s.chain, className ?? ''].join(' ')}
      role={isHidden ? undefined : 'status'}
      aria-label={isHidden ? undefined : ariaLabel}
      aria-hidden={isHidden ? true : undefined}
    >
      {/* Cubo 1: Azul */}
      <svg
        className={[s.cube, s.cube1].join(' ')}
        viewBox="0 0 30 34"
        aria-hidden="true"
        focusable="false"
      >
        <polygon points="15,2 28,9 15,16 2,9" fill="var(--brand-blue-500)" />
        <polygon points="2,9 15,16 15,32 2,25" fill="var(--brand-blue-800)" />
        <polygon points="28,9 15,16 15,32 28,25" fill="var(--brand-blue-700)" />
      </svg>

      {/* Enlace 1 */}
      <i className={[s.chainLink, s.chainLink1].join(' ')} aria-hidden="true" />

      {/* Cubo 2: Azul con desfase duration-fast */}
      <svg
        className={[s.cube, s.cube2].join(' ')}
        viewBox="0 0 30 34"
        aria-hidden="true"
        focusable="false"
      >
        <polygon points="15,2 28,9 15,16 2,9" fill="var(--brand-blue-500)" />
        <polygon points="2,9 15,16 15,32 2,25" fill="var(--brand-blue-800)" />
        <polygon points="28,9 15,16 15,32 28,25" fill="var(--brand-blue-700)" />
      </svg>

      {/* Enlace 2 con desfase duration-fast */}
      <i className={[s.chainLink, s.chainLink2].join(' ')} aria-hidden="true" />

      {/* Cubo 3: Verde con desfase duration-normal */}
      <svg
        className={[s.cube, s.cube3].join(' ')}
        viewBox="0 0 30 34"
        aria-hidden="true"
        focusable="false"
      >
        <polygon points="15,2 28,9 15,16 2,9" fill="var(--brand-green-500)" />
        <polygon points="2,9 15,16 15,32 2,25" fill="var(--brand-green-900)" />
        <polygon points="28,9 15,16 15,32 28,25" fill="var(--brand-green-800)" />
      </svg>
    </div>
  );
}
