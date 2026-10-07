'use client';

import * as React from 'react';
import { subscribe, getState, logout } from '../lib/auth/session';
import { Button } from './Button';
import { usePathname } from 'next/navigation';
import { classifyRoute } from '../lib/routing/classifier';

function useSessionState() {
  const [state, setState] = React.useState(getState());
  React.useEffect(() => {
    const unsub = subscribe(setState);
    return () => { unsub(); };
  }, []);
  return state;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const sessionState = useSessionState();
  const pathname = usePathname();
  const routeCategory = pathname ? classifyRoute(pathname) : 'NOT_APPROVED';
  
  const isAuthenticated = sessionState === 'AUTHENTICATED';
  const showLogout = isAuthenticated && routeCategory !== 'PUBLIC';

  return (
    <div className="pax-shell">
      <header className="pax-shell-header">
        <div className="pax-shell-logo" style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--brand-green-900)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div style={{ width: 24, height: 24, backgroundColor: 'var(--brand-green-900)', borderRadius: '50%' }} aria-hidden="true"></div>
          PaxFide
        </div>
        {showLogout && (
          <Button variant="secondary" onClick={logout}>
            Cerrar sesión
          </Button>
        )}
      </header>
      <main className="pax-shell-main">
        {children}
      </main>
    </div>
  );
}
