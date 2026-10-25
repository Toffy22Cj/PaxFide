// Ref: Documentos/plan-fase7-pantallas.md §5 B-4. Pantallas de acceso v2: superficie centrada con la marca, sin fondo animado.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import * as session from '../src/lib/auth/session';
import { LoginScreen } from '../src/screens/LoginScreen';
import { RegisterScreen } from '../src/screens/RegisterScreen';
import { InvitationScreen } from '../src/screens/InvitationScreen';

const SCREENS: [string, () => React.ReactElement, string][] = [
  ['login', () => <LoginScreen loginClient={vi.fn()} />, 'Iniciar sesión'],
  ['registro', () => <RegisterScreen client={vi.fn()} />, 'Crear cuenta'],
  ['invitación', () => <InvitationScreen client={vi.fn()} />, 'Invitación a una organización'],
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
    expect(card).toHaveTextContent('PaxFide');
    // La marca es decorativa: el nombre va en texto y el SVG queda oculto a lectores de pantalla
    expect(card!.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    // Con fondo del mundo (D-F5, cambia D-P2)
    expect(container.querySelector('canvas')).not.toBeNull();
    // Píldora del boceto (D-F5)
    expect(card).toHaveTextContent('TU CUENTA PAXFIDE');
  });
});
