'use client';

// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F5, D-F2, D-F10; Documentos/paxfide-landing.html (.auth-top-bar, .auth-view)
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { WorldScene } from '../landing/WorldScene';
import { LandingThemeToggle } from '../landing/LandingThemeToggle';
import { PauseButton } from '../background/PauseButton';
import {
  readSavedWorldMode,
  saveWorldMode,
  nextWorldMode,
  calculateNightVal,
  type WorldMode,
} from '../landing/worldMode';
import s from './AccessLayout.module.css';

export interface AccessLayoutProps {
  children: React.ReactNode;
}

export function AccessLayout({ children }: AccessLayoutProps) {
  const [worldMode, setWorldMode] = useState<WorldMode>('auto');

  useEffect(() => {
    setWorldMode(readSavedWorldMode());
  }, []);

  const handleToggleMode = () => {
    const next = nextWorldMode(worldMode);
    setWorldMode(next);
    saveWorldMode(next);
  };

  const nightVal = calculateNightVal(worldMode, 5);
  // D-F2: las superficies del acceso siguen la mezcla de noche del mundo, no el tema del sistema (en Auto, también).
  // Sin esto, con el sistema en oscuro y el mundo de día, la tarjeta quedaba clara con el texto claro.
  const themeAttr = nightVal > 0.5 ? 'dark' : 'light';

  return (
    <div className={s.root} data-theme={themeAttr} data-testid="access-root">
      <WorldScene mode={worldMode} fixedView={5} />
      <header className={s.topBar} data-testid="access-top-bar">
        <Link href="/" className={s.backBtn} aria-label="Volver al recorrido">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 19" />
          </svg>
          <span>Volver al recorrido</span>
        </Link>

        <div className={s.topBrand}>
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
