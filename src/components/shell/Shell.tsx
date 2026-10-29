'use client';

// Ref: prompts-agentes-estilo-v2.md VS-2; sistema-visual-paxfide-web-enmienda-1.md §8 (data-nav-position y
// --nav-inset-*); respuesta de Carlos al plan de VS-2 (2026-10-21: B, C, D, E y GET /me en cada ruta); ADR-046 D5;
// plan-fase7-pantallas.md A-1 (fondo animado en las rutas de D-P2, control de pausa en la cabecera, R-F1 y R-F2) y A-2
// (en `/` el mundo de la landing en lugar de la ciudad; la misma pausa para los dos) y D-P13 (en `/`, sin cabecera ni barra);
// plan-fase7-puesta-al-dia.md A2.5 U-19 ("Iniciar sesión" en la cabecera sin sesión).
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as session from '../../lib/auth/session';
import { isSurfaceEnabled } from '../../lib/routing/surfaces';
import { fetchMe, parsePrincipal, type Principal } from '../../lib/api/identity';
import { navEntriesFor, positionForWidth, NAV_BREAKPOINT_PX, type NavPosition, readSavedNavPosition, saveNavPosition } from '../../lib/nav/navEntries';
import { nextNavPrincipal } from '../../lib/nav/navPrincipal';
import { AppNav } from '../nav/AppNav';
import { CityBackground } from '../background/CityBackground';
import { usePausedPreference } from '../background/usePausedPreference';
import { PauseButton } from '../background/PauseButton';
import { BrandMark } from './BrandMark';
import { ThemeSelect } from '../theme/ThemeSelect';
import { backgroundFor, hasAppChrome } from '../../lib/routing/backgroundRoutes';
import { classifyRoute } from '../../lib/routing/classifier';
import { districtForRoute } from '../background/cityScene';
import { CityHud } from './CityHud';
import { PanelPortal } from './PanelPortal';
import { NavPositionSheet } from '../nav/NavPositionSheet';
import s from './Shell.module.css';

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

/** `auto` hasta hidratar (el CSS decide por media query); después, la posición por ancho y preferencia (D-F8; enmienda §8, E4). */
function useNavPosition(): [NavPosition | 'auto', boolean, (pos: NavPosition) => void] {
  const [position, setPosition] = useState<NavPosition | 'auto'>('auto');
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${NAV_BREAKPOINT_PX}px)`);
    const update = () => {
      const saved = readSavedNavPosition();
      const desktop = mq.matches;
      setIsDesktop(desktop);
      const width = desktop ? NAV_BREAKPOINT_PX : 0;
      const pos = positionForWidth(width, saved);
      setPosition(pos);
      if (width >= NAV_BREAKPOINT_PX && saved) {
        document.documentElement.setAttribute('data-nav-position', saved);
      } else {
        document.documentElement.removeAttribute('data-nav-position');
      }
    };
    update();
    mq.addEventListener('change', update);
    window.addEventListener('paxfide:nav-position-change', update);
    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener('paxfide:nav-position-change', update);
    };
  }, []);
  const changePosition = (pos: NavPosition) => {
    saveNavPosition(pos);
    setPosition(pos);
  };
  return [position, isDesktop, changePosition];
}

/**
 * Estructura de la aplicación (VS-2): cabecera fina con la marca y "Cerrar sesión" en todos los anchos (respuesta E)
 * y barra de navegación inferior (< 768 px) o lateral (≥ 768 px). Las entradas salen de las superficies habilitadas y
 * del rol de `GET /me` (D5): representación, no autorización.
 */
export function Shell({ children, me = fetchMe }: { children: React.ReactNode; me?: typeof fetchMe }) {
  const state = useSyncExternalStore(session.subscribe, session.getState, () => 'RESTORING' as session.MachineState);
  const pathname = usePathname() ?? '';
  // plan-fase7-puesta-al-dia.md P-2 (F-A5): el seguimiento lleva tres columnas en escritorio, como el boceto
  const wide = pathname.startsWith('/panel/prediction') || pathname === '/tracking';
  const principal = useNavPrincipal(state, pathname, me);
  const [position, isDesktop, setNavPosition] = useNavPosition();
  const [isTuneOpen, setIsTuneOpen] = useState(false);
  const [isPeeking, setIsPeeking] = useState(false);
  const [portalMode, setPortalMode] = useState<'enter' | 'exit' | null>(null);
  const prevPathRef = useRef<string | null>(null);

  // D-P13: en `/` ni cabecera ni barra de la app; la landing pone la suya
  const chrome = hasAppChrome(pathname);
  const entries = chrome ? navEntriesFor({ authenticated: state === 'AUTHENTICATED', principal }, isSurfaceEnabled, position) : [];
  const background = backgroundFor(pathname);
  const city = background === 'city';
  const paused = usePausedPreference();

  const currentDistrictKey = districtForRoute(pathname);
  const effectiveDistrictKey = isPeeking ? 'welcome' : currentDistrictKey;
  const isPanel = pathname.startsWith('/panel') || pathname.startsWith('/assets');

  useEffect(() => {
    if (prevPathRef.current !== null && prevPathRef.current !== pathname) {
      const prevWasCity = backgroundFor(prevPathRef.current) === 'city';
      const curIsPanel = pathname.startsWith('/panel') || pathname.startsWith('/assets');
      const prevWasPanel = prevPathRef.current.startsWith('/panel') || prevPathRef.current.startsWith('/assets');
      const curIsCity = backgroundFor(pathname) === 'city';
      if (prevWasCity && curIsPanel) {
        setPortalMode('enter');
      } else if (prevWasPanel && curIsCity) {
        setPortalMode('exit');
      }
    }
    prevPathRef.current = pathname;
    setIsPeeking(false);
  }, [pathname]);

  return (
    <div className={s.app} data-nav-position={position} data-has-nav={entries.length > 0 ? 'true' : 'false'}>
      {city && <CityBackground paused={paused} district={effectiveDistrictKey} />}
      {city && (
        <CityHud
          districtKey={currentDistrictKey}
          isPeeking={isPeeking}
          onTogglePeek={() => setIsPeeking((v) => !v)}
        />
      )}
      <PanelPortal mode={portalMode} onComplete={() => setPortalMode(null)} />
      <NavPositionSheet
        isOpen={isTuneOpen}
        currentPosition={position === 'auto' ? 'side' : position}
        isCustom={readSavedNavPosition() !== null}
        onSelectPosition={(pos) => setNavPosition(pos)}
        onClose={() => setIsTuneOpen(false)}
      />
      {chrome && (
        <header className={s.header}>
          <div className={s.bar}>
            <span className={s.brand}><BrandMark />PaxFide</span>
            <div className={s.actions}>
              <ThemeSelect className={s.themeSelect} />
              {background && <PauseButton className={s.pause} textClassName={s.pauseText} />}
              {state === 'AUTHENTICATED' && (
                <button type="button" className={s.logout} data-testid="logout-btn" onClick={() => session.logout()}>
                  Cerrar sesión
                </button>
              )}
              {/* U-19 (plan-fase7-puesta-al-dia.md A2.5): sin sesión, en el mismo sitio, el enlace al login (no en las
                  rutas de acceso, que no llevan esta cabecera) */}
              {state === 'LOGGED_OUT' && classifyRoute(pathname) !== 'AUTH' && isSurfaceEnabled('/login') && (
                <Link href="/login" className={s.logout} data-testid="login-link">Iniciar sesión</Link>
              )}
            </div>
          </div>
        </header>
      )}
      {chrome && (
        <AppNav
          entries={entries}
          pathname={pathname}
          onOpenTune={isDesktop ? () => setIsTuneOpen(true) : undefined}
        />
      )}
      {chrome ? (
        <main
          className={[s.main, wide ? s.wide : '', city ? s.onCity : '', isPeeking ? s.peeking : ''].filter(Boolean).join(' ')}
          inert={isPeeking ? true : undefined}
        >
          <div key={pathname} className={isPanel ? s.viewPn : s.viewIn}>
            {children}
          </div>
        </main>
      ) : (
        <div className={[s.main, s.onWorld].join(' ')}>
          <div key={pathname} className={s.viewIn}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
