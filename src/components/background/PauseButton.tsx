'use client';
// Ref: sistema-visual-paxfide-web-enmienda-1.md R-F2 (control visible para pausar; la elección se recuerda) y R-F3 (con
// "reducir movimiento" no hay nada que pausar); plan-fase7-pantallas.md A-1 y D-P13 (en `/` va en la cabecera de la
// landing). Un solo botón para la ciudad y el mundo: la misma preferencia guardada.
import React from 'react';
import { togglePausedPreference, usePausedPreference, useReducedMotion } from './usePausedPreference';

function PauseIcon({ paused }: { paused: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paused ? <path d="M8 5.5v13l10-6.5z" /> : <path d="M9 5v14M15 5v14" />}
    </svg>
  );
}

/** `className` da la forma del botón y `textClassName` la de su texto visible (cada cabecera decide cuándo mostrarlo). */
export function PauseButton({ className, textClassName }: { className?: string; textClassName?: string }) {
  const paused = usePausedPreference();
  const reduced = useReducedMotion();
  if (reduced !== false) return null; // hasta saberlo, o con "reducir movimiento", no hay botón
  const label = paused ? 'Reanudar animación' : 'Pausar animación';
  return (
    <button type="button" className={className} onClick={() => togglePausedPreference(paused)} aria-pressed={paused}
      aria-label={label} data-testid="city-pause">
      <PauseIcon paused={paused} /><span className={textClassName}>{label}</span>
    </button>
  );
}
