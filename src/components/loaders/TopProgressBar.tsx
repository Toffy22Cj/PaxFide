'use client';
// Ref: Documentos/prompts-agentes-estilo-v2.md VS-1; Documentos/sistema-visual-paxfide-web-enmienda-1.md §7.2; Documentos/plan-vs1-movimiento.md §2–§5.
import React from 'react';
import s from './Loaders.module.css';

export type TopProgressBarProps = {
  /** Si la barra se muestra o no (por defecto true). */
  active?: boolean;
  className?: string;
  'aria-label'?: string;
};

/**
 * 08 Barra superior: indicador lineal indeterminado fijado en la parte superior.
 * Degradado tricolor verde-azul-amarillo sobre pista --color-divider.
 * Componente puramente visual; su conexión a la navegación se decidirá por separado.
 */
export function TopProgressBar({
  active = true,
  className,
  'aria-label': ariaLabel = 'Cargando página',
}: TopProgressBarProps) {
  if (!active) return null;

  return (
    <div
      className={[s.topProgressBar, className ?? ''].join(' ')}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={s.topProgressBarIndicator} aria-hidden="true" />
    </div>
  );
}
