'use client';
// Ref: Documentos/prompts-agentes-estilo-v2.md VS-1; Documentos/sistema-visual-paxfide-web-enmienda-1.md §7.2; Documentos/plan-vs1-movimiento.md §2–§4.
import React from 'react';
import s from './Loaders.module.css';

export type BrandDotsProps = {
  /** Si true, se oculta a tecnologías de asistencia (p. ej. dentro de un botón con aria-busy). */
  'aria-hidden'?: boolean | 'true' | 'false';
  /** Etiqueta accesible cuando actúa de forma independiente (por defecto 'Cargando'). */
  'aria-label'?: string;
  className?: string;
};

/**
 * 06 Puntos de marca: verde, azul y amarillo de PaxFide con desfase de oscilación.
 * Sustituye cualquier spinner o '…' en botones en estado sending o acciones en curso.
 */
export function BrandDots({
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel = 'Cargando',
  className,
}: BrandDotsProps) {
  const isHidden = ariaHidden === true || ariaHidden === 'true';

  return (
    <span
      className={[s.dots, className ?? ''].join(' ')}
      role={isHidden ? undefined : 'status'}
      aria-label={isHidden ? undefined : ariaLabel}
      aria-hidden={isHidden ? true : undefined}
    >
      <i className={[s.dot, s.dot1].join(' ')} />
      <i className={[s.dot, s.dot2].join(' ')} />
      <i className={[s.dot, s.dot3].join(' ')} />
    </span>
  );
}
