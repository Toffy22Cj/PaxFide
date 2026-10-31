'use client';
// Ref: Documentos/prompts-agentes-estilo-v2.md VS-1; Documentos/sistema-visual-paxfide-web-enmienda-1.md §7.2; Documentos/plan-vs1-movimiento.md §2–§4.
import React from 'react';
import s from './Loaders.module.css';

export type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-label'?: string;
};

/**
 * 07 Esqueleto: placeholder visual con gradiente shimmer en bucle.
 * Emplea los tokens semánticos --color-divider y --color-bg (funciona en claro y oscuro).
 */
export function Skeleton({
  width,
  height,
  borderRadius,
  className,
  style,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel = 'Cargando contenido',
}: SkeletonProps) {
  const isHidden = ariaHidden === true || ariaHidden === 'true';

  const inlineStyle: React.CSSProperties = {
    ...style,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(borderRadius !== undefined ? { borderRadius } : {}),
  };

  return (
    <div
      className={[s.skeletonItem, className ?? ''].join(' ')}
      style={inlineStyle}
      role={isHidden ? undefined : 'status'}
      aria-label={isHidden ? undefined : ariaLabel}
      aria-hidden={isHidden ? true : undefined}
    />
  );
}

/**
 * Estructura de tarjeta simulada con 4 líneas proporcionales (cabecera + párrafos).
 */
export function SkeletonCard({
  className,
  'aria-label': ariaLabel = 'Cargando tarjeta',
}: {
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      className={[s.skeletonCard, className ?? ''].join(' ')}
      role="status"
      aria-label={ariaLabel}
    >
      <Skeleton height="62px" width="100%" borderRadius="10px" aria-hidden="true" />
      <Skeleton height="10px" width="70%" borderRadius="4px" aria-hidden="true" />
      <Skeleton height="10px" width="45%" borderRadius="4px" aria-hidden="true" />
      <Skeleton height="8px" width="30%" borderRadius="999px" aria-hidden="true" />
    </div>
  );
}

/**
 * Lista de 3 filas con indicador visual simulado.
 */
export function SkeletonList({
  count = 3,
  className,
  'aria-label': ariaLabel = 'Cargando lista',
}: {
  count?: number;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      className={[s.skeletonList, className ?? ''].join(' ')}
      role="status"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={s.skeletonListItem} aria-hidden="true">
          <Skeleton width="32px" height="32px" borderRadius="8px" aria-hidden="true" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Skeleton width="60%" height="10px" borderRadius="4px" aria-hidden="true" />
            <Skeleton width="35%" height="8px" borderRadius="4px" aria-hidden="true" />
          </div>
        </div>
      ))}
    </div>
  );
}
