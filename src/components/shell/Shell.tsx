'use client';

// Ref: prompts-agentes-estilo-v2.md VS-2; sistema-visual-paxfide-web-enmienda-1.md §8 (data-nav-position y
// --nav-inset-*); respuesta de Carlos al plan de VS-2 (2026-10-21: B, C, D, E y GET /me en cada ruta); ADR-046 D5;
// plan-fase7-pantallas.md A-1 (fondo animado en las rutas de D-P2, control de pausa en la cabecera, R-F1 y R-F2) y A-2
// (en `/` el mundo de la landing en lugar de la ciudad; la misma pausa para los dos).
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import * as session from '../../lib/auth/session';
import { isSurfaceEnabled } from '../../lib/routing/surfaces';
import { fetchMe, parsePrincipal, type Principal } from '../../lib/api/identity';
import { navEntriesFor, positionForWidth, NAV_BREAKPOINT_PX, type NavPosition } from '../../lib/nav/navEntries';
import { nextNavPrincipal } from '../../lib/nav/navPrincipal';
import { AppNav } from '../nav/AppNav';
import { CityBackground } from '../background/CityBackground';
import { togglePausedPreference, usePausedPreference, useReducedMotion } from '../background/usePausedPreference';
import { backgroundFor } from '../../lib/routing/backgroundRoutes';
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
 * Principal para la barra: se pinta con el último conocido (sin parpadeo) y se vuelve a pedir `GET /me` en cada
 * cambio de ruta (D-N1-3). Si falla, se queda con lo último conocido (DW-06). Fuera de sesión, nada.
 */
function useNavPrincipal(state: session.MachineState, pathname: string, me: typeof fetchMe): Principal | null {
  const [principal, setPrincipal] = useState<Principal | null>(() => parsePrincipal(session.getLastPrincipal()));
  const seq = useRef(0);
  useEffect(() => {
    if (state !== 'AUTHENTICATED') {
      seq.current++;
      setPrincipal(null);
      return;
    }
    setPrincipal((p) => p ?? parsePrincipal(session.getLastPrincipal()));
    const mine = ++seq.current;
    me().then(
      (outcome) => {
        if (mine !== seq.current) return;
        if (outcome.kind === 'ok') session.setLastPrincipal(outcome.principal);
        setPrincipal((prev) => nextNavPrincipal(prev, outcome));
      },
      () => { /* error de red: se queda con lo último conocido */ },
    );
  }, [state, pathname, me]);
  return principal;
}

/** `auto` hasta hidratar (el CSS decide por media query); después, la posición por ancho (enmienda §8, E4). */
function useNavPosition(): NavPosition | 'auto' {
  const [position, setPosition] = useState<NavPosition | 'auto'>('auto');
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${NAV_BREAKPOINT_PX}px)`);
    const update = () => setPosition(positionForWidth(mq.matches ? NAV_BREAKPOINT_PX : 0));
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return position;
}

/** Pausa de la ilustración (R-F2): se recuerda en el navegador. Con "reducir movimiento" no hay nada que pausar (R-F3). */
function useAnimationPause(): { paused: boolean; toggle: () => void; canPause: boolean } {
  const paused = usePausedPreference();
  const reduced = useReducedMotion();
  return { paused, toggle: () => togglePausedPreference(paused), canPause: reduced === false };
}

function PauseIcon({ paused }: { paused: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paused ? <path d="M8 5.5v13l10-6.5z" /> : <path d="M9 5v14M15 5v14" />}
    </svg>
  );
}

/**
 * Estructura de la aplicación (VS-2): cabecera fina con la marca y "Cerrar sesión" en todos los anchos (respuesta E)
 * y barra de navegación inferior (< 768 px) o lateral (≥ 768 px). Las entradas salen de las superficies habilitadas y
 * del rol de `GET /me` (D5): representación, no autorización.
 */
export function Shell({ children, me = fetchMe }: { children: React.ReactNode; me?: typeof fetchMe }) {
  const state = useSyncExternalStore(session.subscribe, session.getState, () => 'RESTORING' as session.MachineState);
  const pathname = usePathname() ?? '';
  const wide = pathname.startsWith('/panel/prediction');
  const principal = useNavPrincipal(state, pathname, me);
  const position = useNavPosition();
  const entries = navEntriesFor({ authenticated: state === 'AUTHENTICATED', principal }, isSurfaceEnabled, position);
  const background = backgroundFor(pathname);
  const city = background === 'city';
  const pause = useAnimationPause();
  const pauseLabel = pause.paused ? 'Reanudar animación' : 'Pausar animación';

  return (
    <div className={s.app} data-nav-position={position} data-has-nav={entries.length > 0 ? 'true' : 'false'}>
      {city && <CityBackground paused={pause.paused} />}
      <header className={s.header}>
        <div className={s.bar}>
          <span className={s.brand}><Mark />PaxFide</span>
          <div className={s.actions}>
            {/* Aquí va el selector de tema en VS-8, al retirar el tema claro forzado (DF7-17). */}
            {background && pause.canPause && (
              <button type="button" className={s.pause} onClick={pause.toggle} aria-pressed={pause.paused}
                aria-label={pauseLabel} data-testid="city-pause">
                <PauseIcon paused={pause.paused} /><span className={s.pauseText}>{pauseLabel}</span>
              </button>
            )}
            {state === 'AUTHENTICATED' && (
              <button type="button" className={s.logout} data-testid="logout-btn" onClick={() => session.logout()}>
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      </header>
      <AppNav entries={entries} pathname={pathname} />
      <main className={[s.main, wide ? s.wide : '', city ? s.onCity : '', background === 'world' ? s.onWorld : ''].join(' ')}>{children}</main>
    </div>
  );
}
