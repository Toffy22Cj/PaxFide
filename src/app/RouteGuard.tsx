'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { classifyRoute } from '../lib/routing/classifier';
import * as session from '../lib/auth/session';
import NotFound from './not-found';

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
    if (category === 'NOT_APPROVED' || category === 'PUBLIC') return;

    if (sessionState === 'LOGGED_OUT' && category === 'AUTHENTICATED') {
      session.setPostLoginDestination(pathname);
      router.replace('/login');
    } else if (sessionState === 'AUTHENTICATED' && category === 'AUTH') {
      const dest = session.consumePostLoginDestination();
      router.replace(dest || '/panel');
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
