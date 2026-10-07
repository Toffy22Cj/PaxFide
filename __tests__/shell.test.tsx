import { render, screen, cleanup } from '@testing-library/react';
import { describe, test, expect, vi, afterEach } from 'vitest';
import * as session from '../src/lib/auth/session';
import * as navigation from 'next/navigation';
import * as classifier from '../src/lib/routing/classifier';
import { Shell } from '../src/components/Shell';

afterEach(cleanup);

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

vi.mock('../src/lib/routing/classifier', () => ({
  classifyRoute: vi.fn(),
}));

vi.mock('../src/lib/auth/session', () => ({
  getState: vi.fn(),
  subscribe: vi.fn((listener) => {
    return () => {};
  }),
  logout: vi.fn(),
}));

describe('Shell negative assertions', () => {
  test('Cerrar sesión no se renderiza en LOGGED_OUT', () => {
    vi.mocked(session.getState).mockReturnValue('LOGGED_OUT');
    vi.spyOn(navigation, 'usePathname').mockReturnValue('/panel');
    
    render(<Shell>Content</Shell>);
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
  });

  test('Cerrar sesión no se renderiza en rutas públicas, incluso autenticado', () => {
    vi.mocked(session.getState).mockReturnValue('AUTHENTICATED');
    vi.spyOn(navigation, 'usePathname').mockReturnValue('/c/public123'); // PUBLIC route
    vi.mocked(classifier.classifyRoute).mockReturnValue('PUBLIC');
    
    render(<Shell>Content</Shell>);
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
  });

  test('Cerrar sesión se renderiza en rutas autenticadas', () => {
    vi.mocked(session.getState).mockReturnValue('AUTHENTICATED');
    vi.spyOn(navigation, 'usePathname').mockReturnValue('/panel');
    vi.mocked(classifier.classifyRoute).mockReturnValue('AUTHENTICATED');
    
    render(<Shell>Content</Shell>);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });
});
