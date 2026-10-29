'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { classifyRoute } from '../lib/routing/classifier';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import * as session from '../lib/auth/session';
import NotFound from './not-found';

/** Destino por defecto tras iniciar sesión sin destino guardado (A-3). */
export function defaultDestination(): string {
  return isSurfaceEnabled('/home') ? '/home' : '/panel';
}

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_E2E_BUILD) {
    (window as any).__TEST_ROUTER__ = router;
  }
  
  // Usamos useSyncExternalStore para suscribirnos a los cambios de la máquina de sesión
  // y evitar warnings de hidratación si renderizamos diferente.
  // SSR snapshot: siempre RESTORING, de modo que el server retorne el shell.
  const sessionState = useSyncExternalStore(
    session.subscribe,
    session.getState,
    () => 'RESTORING' as session.MachineState
  );

  const category = classifyRoute(pathname || '');

  useEffect(() => {
    if (!pathname) return;
    // U-18 (plan-fase7-puesta-al-dia.md A2.5): "Cerrar sesión" lleva siempre al login, desde cualquier ruta, sin
    // destino guardado; `replace` para que "atrás" no vuelva a la pantalla con sesión
    if (sessionState === 'LOGGED_OUT' && session.isLogoutNavigationPending()) {
      if (category === 'AUTH') {
        session.clearLogoutNavigation();
      } else {
        router.replace('/login');
        return;
      }
    }
    if (category === 'NOT_APPROVED' || category === 'PUBLIC') return;

    if (sessionState === 'LOGGED_OUT' && category === 'AUTHENTICATED') {
      session.setPostLoginDestination(pathname);
      router.replace('/login');
    } else if (sessionState === 'AUTHENTICATED' && category === 'AUTH') {
      // D-F10: en el primer login tras crear la cuenta en la pestaña, LoginScreen muestra la bienvenida
      // a menos que haya un destino post-login explícito (ej. /invitaciones)
      if (session.isJustRegistered() && !session.getPostLoginDestination()) {
        return;
      }
      // A-3 (plan-fase7-pantallas.md): tras iniciar sesión, el destino guardado; si no hay, el inicio del donante
      // (`/home`) cuando está habilitado y, si no, el panel como hasta ahora
      const dest = session.consumePostLoginDestination();
      router.replace(dest || defaultDestination());
    }
  }, [sessionState, category, pathname, router]);

  // Invariante 4: evitar que bfcache muestre una página autenticada si ya se hizo logout
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        const cat = classifyRoute(window.location.pathname);
        if (cat === 'AUTHENTICATED' && session.getState() === 'LOGGED_OUT') {
          window.location.reload();
        }
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  if (category === 'NOT_APPROVED') {
    return <NotFound />;
  }

  // No renderizar rutas autenticadas a menos que sepamos que estamos autenticados
  if (category === 'AUTHENTICATED' && sessionState !== 'AUTHENTICATED') {
    return (
      <>
        <div data-testid="loading-guard">Cargando...</div>
      </>
    );
  }

  return (
    <>
      {children}
    </>
  );
}
