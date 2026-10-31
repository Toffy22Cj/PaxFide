'use client';

// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F5, D-F2, D-F10; Documentos/paxfide-landing.html (.auth-top-bar, .auth-view);
// plan-fase7-puesta-al-dia.md Anexo 4, U-28 a U-30: el marco del acceso (mundo, barra de arriba y data-theme) lo monta
// UNA vez el layout del grupo de rutas `(acceso)`; las pantallas ya no se envuelven en él.
import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { WorldScene } from '../landing/WorldScene';
import { LandingThemeToggle } from '../landing/LandingThemeToggle';
import { PauseButton } from '../background/PauseButton';
import {
  readSavedWorldMode,
  nextWorldMode,
  calculateNightVal,
  subscribeWorldMode,
  setWorldModePreference,
  accessThemeInitScript,
  type WorldMode,
} from '../landing/worldMode';
import s from './AccessLayout.module.css';

const ROOT_ID = 'access-root';

export interface AccessLayoutProps {
  children: React.ReactNode;
}

export function AccessLayout({ children }: AccessLayoutProps) {
  // U-30: el modo guardado se lee antes del primer pintado (en el HTML lo pone el script de abajo; al hidratar, este
  // almacén) y nunca sale un fotograma con el modo equivocado. En el servidor, 'auto'
  const worldMode = useSyncExternalStore<WorldMode>(subscribeWorldMode, readSavedWorldMode, () => 'auto');

  const handleToggleMode = () => setWorldModePreference(nextWorldMode(worldMode));

  const nightVal = calculateNightVal(worldMode, 5);
  // D-F2: las superficies del acceso siguen la mezcla de noche del mundo, no el tema del sistema (en Auto, también).
  // U-28: este es el ÚNICO contenedor que decide el tema del acceso; las hojas leen sus variables --acc-*
  const themeAttr = nightVal > 0.5 ? 'dark' : 'light';

  return (
    <div className={s.root} id={ROOT_ID} data-theme={themeAttr} data-testid="access-root" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: accessThemeInitScript(ROOT_ID) }} />
      <WorldScene mode={worldMode} fixedView={5} />
      <header className={s.topBar} data-testid="access-top-bar">
        <Link href="/" className={s.backBtn} aria-label="Volver al recorrido">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 19" />
          </svg>
          <span>Volver al recorrido</span>
        </Link>

        {/* U-29: la única marca del acceso, como .auth-top-brand del boceto ("Pax<b>Fide</b>.") */}
        <div className={s.topBrand} data-testid="access-brand">
          <span className={s.brandText}>Pax<b className={s.brandAccent}>Fide</b>.</span>
        </div>

        <div className={s.acts}>
          <LandingThemeToggle mode={worldMode} nightVal={nightVal} onToggle={handleToggleMode} />
          <PauseButton className={s.pauseBtn} textClassName={s.pauseText} />
        </div>
      </header>

      <main className={s.cardWrap}>
        {children}
      </main>
    </div>
  );
}
