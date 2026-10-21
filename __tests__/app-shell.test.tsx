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
  it('landmarks: banner, navigation "Principal" y main; la cabecera no monta el selector de tema (D)', async () => {
    render(<Shell me={async () => ({ kind: 'error' })}><p>contenido</p></Shell>);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(nav()).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('contenido');
    expect(screen.queryByLabelText('Tema')).toBeNull();
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
});
