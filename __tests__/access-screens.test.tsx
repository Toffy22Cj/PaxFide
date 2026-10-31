// Ref: Documentos/plan-fase7-pantallas.md §5 B-4; plan-fase7-puesta-al-dia.md Anexo 4, U-29 y U-30: las pantallas van dentro
// del marco del grupo (acceso) (y /login y /register, de la tarjeta con pestañas), como en las rutas reales.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/login' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => nav.pathname }));
vi.mock('../src/lib/routing/surfaces', () => ({ isSurfaceEnabled: () => true }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import * as session from '../src/lib/auth/session';
import { LoginScreen } from '../src/screens/LoginScreen';
import { RegisterScreen } from '../src/screens/RegisterScreen';
import { InvitationScreen } from '../src/screens/InvitationScreen';
import { AccessLayout } from '../src/components/access/AccessLayout';
import { AuthCard } from '../src/components/access/AuthCard';

const SCREENS: [string, () => React.ReactElement, string][] = [
  ['login', () => { nav.pathname = '/login'; return <AccessLayout><AuthCard><LoginScreen loginClient={vi.fn()} /></AuthCard></AccessLayout>; }, 'Iniciar sesión'],
  ['registro', () => { nav.pathname = '/register'; return <AccessLayout><AuthCard><RegisterScreen client={vi.fn()} /></AuthCard></AccessLayout>; }, 'Crear cuenta'],
  ['invitación', () => { nav.pathname = '/invitaciones'; return <AccessLayout><InvitationScreen client={vi.fn()} /></AccessLayout>; }, 'Invitación a una organización'],
];

describe('Pantallas de acceso v2 (B-4)', () => {
  beforeEach(() => session._resetForTest());

  it.each(SCREENS)('%s: marca y un único h1 dentro de la superficie centrada', (_n, el, title) => {
    const { container } = render(el());
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(title);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const card = h1.closest('[class*="card"]');
    expect(card).not.toBeNull();
    // U-29: dentro de la tarjeta no hay ninguna marca (negativa); arriba, exactamente una ("Pax<b>Fide</b>.")
    expect(card!.textContent).not.toMatch(/PaxFide(?!\.)/);
    expect(card!.querySelector('[data-testid="access-brand"]')).toBeNull();
    expect(screen.getAllByTestId('access-brand')).toHaveLength(1);
    expect(screen.getByTestId('access-brand')).toHaveTextContent('PaxFide.');
    // Con fondo del mundo (D-F5, cambia D-P2)
    expect(container.querySelector('canvas')).not.toBeNull();
    // Píldora del boceto (D-F5)
    expect(card).toHaveTextContent('TU CUENTA PAXFIDE');
  });
});
