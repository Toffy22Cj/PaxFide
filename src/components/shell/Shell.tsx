'use client';

import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as session from '../../lib/auth/session';
import s from './Shell.module.css';

/** Marca: SVG propio con los colores de marca (sustituto ligero del raster, `sistema-visual` §6). */
function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <circle cx="20" cy="8" r="4" fill="var(--brand-yellow-400)" />
      <path d="M4 18c3-1 6-1 9 1l5 3c1 .6 2.4.3 3-.7.5-.9.2-2-.7-2.6L15 15" fill="none" stroke="var(--brand-green-800)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M14 13.5c-1.8-1.6-3.8-.4-3.8 1.4 0 1.9 2.4 3.4 3.8 4.4 1.4-1 3.8-2.5 3.8-4.4 0-1.8-2-3-3.8-1.4z" fill="var(--brand-green-500)" />
    </svg>
  );
}

/**
 * Shell (§5.1): marca a la izquierda y "Cerrar sesión" solo en AUTHENTICATED. Sin barra lateral ni navegación por
 * rol: el enlace "Panel" es la única entrada fija (decisión DW-05).
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(session.subscribe, session.getState, () => 'RESTORING' as session.MachineState);
  const pathname = usePathname() ?? '';
  const wide = pathname.startsWith('/panel/prediction');

  return (
    <>
      <header className={s.header}>
        <div className={s.bar}>
          <span className={s.brand}><Mark />PaxFide</span>
          {state === 'AUTHENTICATED' && (
            <nav className={s.nav} aria-label="Sesión">
              <Link href="/panel" className={s.navLink}>Panel</Link>
              <button type="button" className={s.logout} data-testid="logout-btn" onClick={() => session.logout()}>
                Cerrar sesión
              </button>
            </nav>
          )}
        </div>
      </header>
      <main className={[s.main, wide ? s.wide : ''].join(' ')}>{children}</main>
    </>
  );
}
