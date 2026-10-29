// Ref: plan-fase7-puesta-al-dia.md Anexo 2, A2.5 (U-18, U-19) y P-11.
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/home', replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
}));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock('../src/lib/routing/surfaces', () => ({
  isSurfaceEnabled: (s: string) => ['/home', '/login', '/register', '/campaigns', '/tracking', '/panel', '/account', '/c/:publicCode'].includes(s),
}));

import * as session from '../src/lib/auth/session';
import RouteGuard from '../src/app/RouteGuard';
import { Shell } from '../src/components/shell/Shell';
import { LoginScreen } from '../src/screens/LoginScreen';

const guard = (path: string) => {
  nav.pathname = path;
  return render(<RouteGuard><div data-testid="content">contenido</div></RouteGuard>);
};

beforeEach(() => {
  session._resetForTest();
  nav.replace.mockClear();
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as never;
});
afterEach(() => cleanup());

describe('U-18 · cerrar sesión lleva siempre a /login', () => {
  it.each(['/home', '/panel', '/campaigns', '/c/ABC'])('desde %s: router.replace("/login") y sin destino guardado', (path) => {
    session.login('jwt');
    guard(path);
    nav.replace.mockClear();
    act(() => session.logout());
    expect(nav.replace).toHaveBeenCalledWith('/login');
    expect(nav.replace).not.toHaveBeenCalledWith(path);
    expect(session.getPostLoginDestination()).toBeNull();
  });

  it('negativa del destino guardado: tras cerrar sesión e iniciarla de nuevo, el destino por defecto', () => {
    session.login('jwt');
    guard('/panel');
    act(() => session.logout());
    cleanup();
    guard('/login'); // la ruta de acceso ya está en pantalla
    expect(session.isLogoutNavigationPending()).toBe(false);
    nav.replace.mockClear();
    act(() => session.login('jwt-2'));
    expect(nav.replace).toHaveBeenCalledWith('/home');
  });

  it('sin regresión: la caducidad (EXPIRED) en una ruta autenticada sigue guardando el destino', () => {
    session.login('jwt');
    guard('/panel');
    act(() => session.handle401(false));
    expect(session.getLastLogoutReason()).toBe('EXPIRED');
    expect(session.getPostLoginDestination()).toBe('/panel');
    expect(nav.replace).toHaveBeenCalledWith('/login');
  });

  it('un cierre desde otra pestaña (OTHER_TAB) en una ruta pública no navega', () => {
    session.login('jwt');
    guard('/campaigns');
    nav.replace.mockClear();
    act(() => session._simulateChannelMessageForTest());
    expect(session.getLastLogoutReason()).toBe('OTHER_TAB');
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('el login muestra "Cerraste sesión." tras un cierre voluntario', () => {
    session.login('jwt');
    session.logout();
    nav.pathname = '/login';
    render(<LoginScreen />);
    expect(screen.getByText('Cerraste sesión.')).toBeInTheDocument();
  });
});

describe('U-19 · "Iniciar sesión" en la cabecera sin sesión', () => {
  const me = async () => ({ kind: 'error' as const });

  it.each(['/campaigns', '/tracking'])('sin sesión en %s: enlace a /login', (path) => {
    nav.pathname = path;
    render(<Shell me={me}>x</Shell>);
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(screen.queryByTestId('logout-btn')).toBeNull();
  });

  it.each(['/login', '/register'])('negativa: en %s no aparece', (path) => {
    nav.pathname = path;
    render(<Shell me={me}>x</Shell>);
    expect(screen.queryByTestId('login-link')).toBeNull();
  });

  it('negativa: con sesión no aparece (está "Cerrar sesión")', () => {
    session.login('jwt');
    nav.pathname = '/campaigns';
    render(<Shell me={me}>x</Shell>);
    expect(screen.queryByTestId('login-link')).toBeNull();
    expect(screen.getByTestId('logout-btn')).toBeInTheDocument();
  });

  it('un cierre desde otra pestaña en una ruta pública deja visible "Iniciar sesión"', () => {
    session.login('jwt');
    nav.pathname = '/campaigns';
    render(<Shell me={me}>x</Shell>);
    expect(screen.queryByTestId('login-link')).toBeNull();
    act(() => session._simulateChannelMessageForTest());
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
