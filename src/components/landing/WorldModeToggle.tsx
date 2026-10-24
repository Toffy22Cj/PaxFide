'use client';
// Ref: plan-fase7-fidelidad.md D-F2 y F-A1: el botón "Día / Noche" del prototipo (`.theme-toggle`, `toggleTheme`,
// `updateThemeUI`), con el icono en SVG en lugar de emoji. Va en la cabecera de la landing, en su menú estrecho y en
// la barra del acceso (F-A2). La landing y el acceso pintan sus superficies con `useSurfaceTheme`.
import React, { useSyncExternalStore } from 'react';
import {
  getWorldMode, getWorldNight, nextWorldMode, setWorldMode, subscribeWorld, surfaceTheme, worldModeLook,
  type WorldMode, type WorldModeIcon,
} from './worldMode';

const getStorage = () => window.localStorage;

export function useWorldMode(): WorldMode {
  return useSyncExternalStore(subscribeWorld, () => getWorldMode(getStorage), () => 'auto' as WorldMode);
}

/** Tema de las superficies (D-F2): oscuro cuando la mezcla de noche pasa de 0,5. */
export function useSurfaceTheme(): 'dark' | 'light' {
  return useSyncExternalStore(subscribeWorld, () => surfaceTheme(getWorldNight(getStorage)), () => 'light' as const);
}

/** Texto e icono del botón; el snapshot es una cadena para que React solo repinte cuando cambian. */
function useLook(): { text: string; icon: WorldModeIcon } {
  const key = useSyncExternalStore(
    subscribeWorld,
    () => { const l = worldModeLook(getWorldMode(getStorage), getWorldNight(getStorage)); return `${l.icon}|${l.text}`; },
    () => 'sun|Auto (Día)',
  );
  const [icon, text] = key.split('|') as [WorldModeIcon, string];
  return { icon, text };
}

function ModeIcon({ icon }: { icon: WorldModeIcon }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" data-icon={icon}>
      {icon === 'sun' && <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" /></>}
      {icon === 'dusk' && <><path d="M3 17.5h18M6.5 21h11" /><path d="M7 17.5a5 5 0 0 1 10 0" /><path d="M12 6.5v2.2M5.3 10.8l1.5 1.5M18.7 10.8l-1.5 1.5" /></>}
      {icon === 'moon' && <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z" />}
    </svg>
  );
}

/** `className` da la forma (cada cabecera decide); `textClassName`, la del texto visible. */
export function WorldModeToggle({ className, textClassName, testId = 'world-mode' }: {
  className?: string; textClassName?: string; testId?: string;
}) {
  const mode = useWorldMode();
  const { icon, text } = useLook();
  return (
    <button type="button" className={className} data-testid={testId} data-mode={mode}
      aria-label={`Modo de iluminación: ${text}`} title="Ciclo Día / Noche: Auto, Noche o Día"
      onClick={() => setWorldMode(getStorage, nextWorldMode(mode))}>
      <ModeIcon icon={icon} /><span className={textClassName}>{text}</span>
    </button>
  );
}
