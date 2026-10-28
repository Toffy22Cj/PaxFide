// Ref: paxfide-linea-tiempo.html (svgIcon: tarjeta, base de datos, camión, caja, corazón, candado, reloj). Solo forma:
// el texto del paso lo dice siempre (nunca se comunica algo solo con el icono o el color).
import React from 'react';
import type { TrackingEvent } from './events';

export type IconKind = TrackingEvent | 'payment' | 'lock' | 'clock' | 'warning' | 'unknown';

const PATHS: Record<IconKind, string> = {
  payment: 'M3 6h18v12H3zM3 10h18M7 15h4',
  ASSET_REGISTERED: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  ASSET_DISPATCHED: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ASSET_RECEIVED: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  ASSET_DELIVERED: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  ASSET_SPLIT: 'M6 3v6a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v4M6 21v-8M18 3v4',
  ASSET_SPLIT_COMPENSATED: 'M4 12a8 8 0 1 0 3-6.2M4 4v4h4',
  ASSET_CUSTODY_TRANSFERRED: 'M7 7h12l-3-3M17 17H5l3 3',
  ASSET_DEPLETED: 'M5 12h14',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  warning: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  unknown: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
};

export function StepIcon({ kind, size = 18 }: { kind: IconKind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={PATHS[kind]} /></svg>
  );
}
