// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F2 y §4 F-A1; Documentos/paxfide-landing.html (theme-toggle).
// Conmutador del ciclo Día / Ocaso / Noche para la landing y el acceso.
'use client';

import React from 'react';
import {
  worldModeUI,
  type WorldMode,
  type WorldModeIcon,
} from './worldMode';
import s from './LandingThemeToggle.module.css';

function ModeIcon({ icon }: { icon: WorldModeIcon }) {
  if (icon === 'moon') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={s.icon}>
        <path d="M17 12.5A7 7 0 1 1 9.5 3a5.5 5.5 0 0 0 7.5 9.5z" />
      </svg>
    );
  }
  if (icon === 'sunset') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={s.icon}>
        <path d="M14 12a4 4 0 0 0-8 0" />
        <line x1="10" y1="4" x2="10" y2="6.5" />
        <line x1="4.93" y1="6.93" x2="6.7" y2="8.7" />
        <line x1="15.07" y1="6.93" x2="13.3" y2="8.7" />
        <line x1="2" y1="15" x2="18" y2="15" />
        <line x1="5" y1="18" x2="15" y2="18" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={s.icon}>
      <circle cx="10" cy="10" r="4" />
      <line x1="10" y1="1" x2="10" y2="3.5" />
      <line x1="10" y1="16.5" x2="10" y2="19" />
      <line x1="1" y1="10" x2="3.5" y2="10" />
      <line x1="16.5" y1="10" x2="19" y2="10" />
      <line x1="3.64" y1="3.64" x2="5.4" y2="5.4" />
      <line x1="14.6" y1="14.6" x2="16.36" y2="16.36" />
      <line x1="3.64" y1="16.36" x2="5.4" y2="14.6" />
      <line x1="14.6" y1="5.4" x2="16.36" y2="3.64" />
    </svg>
  );
}

export interface LandingThemeToggleProps {
  mode: WorldMode;
  nightVal: number;
  onToggle: () => void;
  className?: string;
  id?: string;
}

export function LandingThemeToggle({
  mode,
  nightVal,
  onToggle,
  className,
  id,
}: LandingThemeToggleProps) {
  const ui = worldModeUI(mode, nightVal);
  return (
    <button
      type="button"
      id={id}
      data-testid="landing-theme-toggle"
      data-mode={mode}
      aria-label={ui.ariaLabel}
      title="Ciclo Día / Noche"
      className={className ? `${s.toggle} ${className}` : s.toggle}
      onClick={onToggle}
    >
      <ModeIcon icon={ui.icon} />
      <span className={s.text} data-testid="landing-theme-text">{ui.text}</span>
    </button>
  );
}
