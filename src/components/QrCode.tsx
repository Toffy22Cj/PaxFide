'use client';

import React, { useMemo } from 'react';
import { encodeQr } from '../lib/qr';

/** QR en SVG propio (D8). Módulos en `brand-green-900` sobre blanco, con la zona de silencio de 4 módulos. */
export function QrCode({ value, label, size = 200 }: { value: string; label: string; size?: number }) {
  const modules = useMemo(() => encodeQr(value), [value]);
  const n = modules.length + 8;
  const path = modules.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x + 4} ${y + 4}h1v1h-1z` : ''))).join('');
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges"
      style={{ background: 'var(--white)', display: 'block' }}>
      <rect width={n} height={n} fill="#FFFFFF" />
      <path d={path} fill="#1B5141" />
    </svg>
  );
}
