// Ref: plan-fase7-puesta-al-dia.md Anexo 2, A2.1 y P-10: el 401 de GET /account sigue el flujo de sesión, y el fallo de
// GET /account/profile no tumba la pantalla.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as session from '../src/lib/auth/session';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

const problem = (status: number, title: string) => new Response(JSON.stringify({ type: 'about:blank', title, status }), {
  status, headers: { 'Content-Type': 'application/problem+json' },
});
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('P-10 · carga del Perfil', () => {
  beforeEach(() => {
    session._resetForTest();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.test/api/v1');
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as never;
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('401 de GET /account: cierra la sesión (EXPIRED) y no muestra "No se pudo cargar la información del perfil"', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).endsWith('/account') ? problem(401, 'Unauthorized') : json({ email: 'x@y.z' }))));
    session.login('jwt-caducado');
    const { ProfileScreen } = await import('../src/screens/ProfileScreen');
    render(<ProfileScreen impactClient={async () => ({ kind: 'error' })} />);
    await waitFor(() => expect(session.getState()).toBe('LOGGED_OUT'));
    expect(session.getLastLogoutReason()).toBe('EXPIRED');
    expect(screen.queryByText('No se pudo cargar la información del perfil.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('cualquier otro fallo de GET /account sí muestra el error con "Reintentar" (sin regresión)', async () => {
    const { ProfileScreen } = await import('../src/screens/ProfileScreen');
    render(<ProfileScreen client={async () => ({ kind: 'error' })} impactClient={async () => ({ kind: 'error' })} />);
    expect(await screen.findByText('No se pudo cargar la información del perfil.')).toBeInTheDocument();
    expect(session.getState()).toBe('LOGGED_OUT'); // no la tocó: ya estaba sin sesión en el test
  });

  it('el cuerpo del backend real ({email}, sin accountId) carga la pantalla', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).endsWith('/account') ? json({ email: 'real@demo.test' }) : json({ email: 'real@demo.test' }))));
    session.login('jwt');
    const { ProfileScreen } = await import('../src/screens/ProfileScreen');
    render(<ProfileScreen impactClient={async () => ({ kind: 'error' })} />);
    expect(await screen.findByTestId('profile-email-header')).toHaveTextContent('real@demo.test');
  });

  it('si falla GET /account/profile, el resto del Perfil sigue', async () => {
    const { ProfileScreen } = await import('../src/screens/ProfileScreen');
    render(<ProfileScreen client={async () => ({ kind: 'ok', account: { accountId: '', email: 'x@y.z' } })}
      profileClients={{ fetch: async () => ({ kind: 'error' }), update: async () => ({ kind: 'error' }) }}
      impactClient={async () => ({ kind: 'error' })} />);
    expect(await screen.findByTestId('profile-screen')).toBeInTheDocument();
    expect(screen.getByTestId('profile-email-header')).toHaveTextContent('x@y.z');
    expect(screen.getByText('Apariencia y ciudad')).toBeInTheDocument();
    expect(screen.queryByText('No se pudo cargar la información del perfil.')).toBeNull();
  });
});
