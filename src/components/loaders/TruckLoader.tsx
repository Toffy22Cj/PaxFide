'use client';
// Ref: Documentos/prompts-agentes-estilo-v2.md VS-1; Documentos/sistema-visual-paxfide-web-enmienda-1.md §7.2; Documentos/plan-vs1-movimiento.md §2–§5.
import React from 'react';
import s from './Loaders.module.css';

export type TruckLoaderProps = {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-label'?: string;
};

/**
 * 03 Camión en ruta: camión PaxFide con carretera en desplazamiento continuo y rebote sutil.
 * Componente puramente visual (sin lógica de dominio). La condición para renderizarlo
 * (solo cuando el último evento es ASSET_DISPATCHED) se aplicará en la pantalla de seguimiento (VS-7).
 */
export function TruckLoader({
  className,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel = 'En camino',
}: TruckLoaderProps) {
  const isHidden = ariaHidden === true || ariaHidden === 'true';

  return (
    <div
      className={[s.road, className ?? ''].join(' ')}
      role={isHidden ? undefined : 'img'}
      aria-label={isHidden ? undefined : ariaLabel}
      aria-hidden={isHidden ? true : undefined}
    >
      <span className={s.roadLine} aria-hidden="true" />
      <svg
        className={s.truckSvg}
        viewBox="0 0 66 42"
        aria-hidden="true"
        focusable="false"
      >
        {/* Carrocería amarilla con franja dorada */}
        <rect x="2" y="8" width="38" height="22" rx="3" fill="var(--brand-yellow-400)" />
        <rect x="2" y="8" width="38" height="5" rx="2" fill="var(--brand-yellow-900)" />
        {/* Símbolo PaxFide en el lateral */}
        <path
          d="M15 24.5c-3-2-4.2-3.7-3.5-5.2.6-1.2 2-1.1 3.5.4 1.4-1 2.8-.6 3.3.8.6 1.5-.5 2.9-3.3 4z"
          fill="var(--brand-green-900)"
        />
        {/* Cabina verde */}
        <path d="M40 14h12l9 9v7H40z" fill="var(--brand-green-800)" />
        {/* Ventana azul clara */}
        <path d="M43 16h8l6 6h-14z" fill="var(--brand-blue-50)" />
        {/* Chasis */}
        <rect x="0" y="29" width="63" height="3" rx="1.5" fill="var(--brand-green-900)" />
        {/* Ruedas y tapacubos */}
        <circle cx="14" cy="34" r="6" fill="var(--brand-green-900)" />
        <circle cx="51" cy="34" r="6" fill="var(--brand-green-900)" />
        <circle cx="14" cy="34" r="2" fill="var(--neutral-200)" />
        <circle cx="51" cy="34" r="2" fill="var(--neutral-200)" />
      </svg>
    </div>
  );
}
