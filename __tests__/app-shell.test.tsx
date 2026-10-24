// Ref: prompts-agentes-estilo-v2.md VS-2; respuesta de Carlos al plan de VS-2 (B, D, E, GET /me en cada ruta).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import type { MeOutcome, Principal } from '../src/lib/api/identity';

let pathname = '/panel';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('../src/lib/routing/surfaces', () => ({
  isSurfaceEnabled: (s: string) => ['/campaigns', '/account/donations', '/tracking', '/panel', '/panel/campaigns', '/panel/assets'].includes(s),
}));

import * as session from '../src/lib/auth/session';
import { Shell } from '../src/components/shell/Shell';

const admin: Principal = { accountId: 'a', organizationId: 'org-1', roles: ['ADMINISTRATOR'] };
const donor: Principal = { accountId: 'a', roles: [] };

function matchMediaFor(width: number) {
  return (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return { matches: min ? width >= Number(min[1]) : false, media: query, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList;
  };
}

beforeEach(() => {
  session._resetForTest();
  pathname = '/panel';
  window.matchMedia = matchMediaFor(1280);
});
afterEach(() => vi.restoreAllMocks());

const nav = () => screen.getByRole('navigation', { name: 'Principal' });

describe('Shell (VS-2)', () => {
  it('landmarks: banner, navigation "Principal" y main; la cabecera monta el selector de tema (C-1, DF7-10)', async () => {
    render(<Shell me={async () => ({ kind: 'error' })}><p>contenido</p></Shell>);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(nav()).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('contenido');
    const select = within(screen.getByRole('banner')).getByLabelText('Tema');
    expect(select.tagName).toBe('SELECT');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Como el sistema', 'Claro', 'Oscuro']);
    // Solo uno: ni en el contenido ni duplicado
    expect(screen.getAllByLabelText('Tema')).toHaveLength(1);
  });

  it('a 390 (bottom), Convocatorias y Lotes no están en la página (DF7-20)', async () => {
    window.matchMedia = matchMediaFor(390);
    act(() => { session.login('tok'); session.setLastPrincipal(admin); });
    const { container } = render(<Shell me={async () => ({ kind: 'ok', principal: admin })}>x</Shell>);
    await waitFor(() => expect(container.firstElementChild).toHaveAttribute('data-nav-position', 'bottom'));
    expect(within(nav()).getAllByRole('link').map((a) => a.textContent)).toEqual(['Explorar', 'Donaciones', 'Seguimiento', 'Organización']);
    expect(container.querySelector('[data-testid="nav-convocatorias"]')).toBeNull();
    expect(container.querySelector('[data-testid="nav-lotes"]')).toBeNull();
  });

  it('data-nav-position por ancho: side a 1280, bottom a 390', async () => {
    const { container, unmount } = render(<Shell me={async () => ({ kind: 'error' })}>x</Shell>);
    await waitFor(() => expect(container.firstElementChild).toHaveAttribute('data-nav-position', 'side'));
    unmount();
    window.matchMedia = matchMediaFor(390);
    const r = render(<Shell me={async () => ({ kind: 'error' })}>x</Shell>);
    await waitFor(() => expect(r.container.firstElementChild).toHaveAttribute('data-nav-position', 'bottom'));
  });

  it('se pinta con el último principal conocido y aria-current marca la entrada activa', async () => {
    act(() => { session.login('tok'); session.setLastPrincipal(admin); });
    let resolve: (o: MeOutcome) => void = () => {};
    render(<Shell me={() => new Promise((r) => { resolve = r; })}>x</Shell>);
    // Antes de que responda /me ya está "Organización" (sin parpadeo)
    expect(within(nav()).getByRole('link', { name: 'Organización' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav()).getByRole('link', { name: 'Convocatorias' })).not.toHaveAttribute('aria-current');
    await act(async () => resolve({ kind: 'ok', principal: admin }));
  });

  it('GET /me en cada cambio de ruta: si pierde organizationId, "Organización" desaparece en la segunda', async () => {
    act(() => { session.login('tok'); });
    const me = vi.fn<() => Promise<MeOutcome>>()
      .mockResolvedValueOnce({ kind: 'ok', principal: admin })
      .mockResolvedValueOnce({ kind: 'ok', principal: donor });
    const { rerender } = render(<Shell me={me}>x</Shell>);
    await waitFor(() => expect(within(nav()).getByRole('link', { name: 'Organización' })).toBeInTheDocument());
    pathname = '/campaigns';
    rerender(<Shell me={me}>x</Shell>);
    await waitFor(() => expect(within(nav()).queryByRole('link', { name: 'Organización' })).toBeNull());
    expect(me).toHaveBeenCalledTimes(2);
    expect(within(nav()).getByRole('link', { name: 'Donaciones' })).toBeInTheDocument();
  });

  it('si /me falla se queda con lo último conocido; sin nada, solo entradas sin rol (DW-06)', async () => {
    act(() => { session.login('tok'); });
    const me = vi.fn<() => Promise<MeOutcome>>()
      .mockResolvedValueOnce({ kind: 'error' })
      .mockResolvedValueOnce({ kind: 'ok', principal: admin })
      .mockResolvedValueOnce({ kind: 'unavailable' });
    const { rerender } = render(<Shell me={me}>x</Shell>);
    await waitFor(() => expect(me).toHaveBeenCalledTimes(1));
    expect(within(nav()).queryByRole('link', { name: 'Organización' })).toBeNull();
    expect(within(nav()).getByRole('link', { name: 'Donaciones' })).toBeInTheDocument();
    pathname = '/campaigns'; rerender(<Shell me={me}>x</Shell>);
    await waitFor(() => expect(within(nav()).getByRole('link', { name: 'Organización' })).toBeInTheDocument());
    pathname = '/tracking'; rerender(<Shell me={me}>x</Shell>);
    await waitFor(() => expect(me).toHaveBeenCalledTimes(3));
    expect(within(nav()).getByRole('link', { name: 'Organización' })).toBeInTheDocument();
  });

  it('sin sesión no pide /me y no muestra "Cerrar sesión"', async () => {
    const me = vi.fn<() => Promise<MeOutcome>>();
    render(<Shell me={me}>x</Shell>);
    expect(me).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
    expect(within(nav()).getAllByRole('link').map((a) => a.textContent)).toEqual(['Explorar', 'Seguimiento']);
  });

  it('iconos SVG propios con currentColor, decorativos', async () => {
    render(<Shell me={async () => ({ kind: 'error' })}>x</Shell>);
    const svgs = nav().querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('stroke', 'currentColor');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('focusable', 'false');
    });
  });

  it('D-P13: en / ni cabecera ni barra de la app; en /campaigns, las dos', async () => {
    pathname = '/';
    const { container, unmount } = render(<Shell me={async () => ({ kind: 'error' })}><p>landing</p></Shell>);
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('data-has-nav', 'false');
    // La landing abre su propio <main> tras su cabecera: la estructura no pone otro
    expect(screen.queryByRole('main')).toBeNull();
    expect(container).toHaveTextContent('landing');
    unmount();
    pathname = '/campaigns';
    render(<Shell me={async () => ({ kind: 'error' })}><p>x</p></Shell>);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(nav()).toBeInTheDocument();
  });
});

