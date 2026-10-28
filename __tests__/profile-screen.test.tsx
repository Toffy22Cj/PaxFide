// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F9, D-F8
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileScreen } from '../src/screens/ProfileScreen';
import * as session from '../src/lib/auth/session';
import { NAV_POSITION_STORAGE_KEY } from '../src/lib/nav/navEntries';

vi.mock('../src/lib/api/account', async (orig) => ({
  ...(await orig<typeof import('../src/lib/api/account')>()),
  fetchProfile: vi.fn().mockResolvedValue({ kind: 'ok', profile: { email: 'donante@demo.test' } }),
}));

describe('ProfileScreen (D-F9)', () => {
  beforeEach(() => {
    session._resetForTest();
    localStorage.clear();
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList);
  });

  it('muestra el correo en la cabecera y en "Tus datos"', async () => {
    const mockClient = vi.fn().mockResolvedValue({
      kind: 'ok',
      account: { accountId: 'acc-123', email: 'donante@demo.test' },
    });

    render(<ProfileScreen client={mockClient} />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-screen')).toBeInTheDocument();
    });

    expect(screen.getByTestId('profile-email-header')).toHaveTextContent('donante@demo.test');
    expect(screen.getByTestId('profile-email-detail')).toHaveTextContent('donante@demo.test');
    expect(screen.getByText('Tus datos')).toBeInTheDocument();
    expect(screen.getByText('Solo los ves tú.')).toBeInTheDocument();
  });

  it('P-1: "Tus datos" con Nombre y Apellido ("Sin completar") y la tarjeta "Seguridad"; nunca "Próximamente"', async () => {
    const mockClient = vi.fn().mockResolvedValue({
      kind: 'ok',
      account: { accountId: 'acc-123', email: 'donante@demo.test' },
    });

    render(<ProfileScreen client={mockClient} />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-screen')).toBeInTheDocument();
    });

    expect(await screen.findByTestId('profile-given-name')).toHaveTextContent('Sin completar');
    expect(screen.getByTestId('profile-family-name')).toHaveTextContent('Sin completar');
    expect(screen.getByRole('heading', { name: 'Seguridad' })).toBeInTheDocument();
    expect(screen.queryByText(/Próximamente/i)).toBeNull();
  });

  it('tarjeta "Apariencia y ciudad": tema, barra y animación', async () => {
    const mockClient = vi.fn().mockResolvedValue({
      kind: 'ok',
      account: { accountId: 'acc-123', email: 'donante@demo.test' },
    });

    render(<ProfileScreen client={mockClient} />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-screen')).toBeInTheDocument();
    });

    expect(screen.getByText('Apariencia y ciudad')).toBeInTheDocument();
    expect(screen.getByTestId('theme-select')).toBeInTheDocument();
    expect(screen.getByTestId('profile-nav-btn')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('city-pause')).toBeInTheDocument();
    });
  });

  it('el botón de la barra abre NavPositionSheet y permite cambiar la posición (D-F8)', async () => {
    const mockClient = vi.fn().mockResolvedValue({
      kind: 'ok',
      account: { accountId: 'acc-123', email: 'donante@demo.test' },
    });

    render(<ProfileScreen client={mockClient} />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-screen')).toBeInTheDocument();
    });

    const navBtn = screen.getByTestId('profile-nav-btn');
    fireEvent.click(navBtn);

    expect(screen.getByTestId('nav-position-sheet')).toBeInTheDocument();
    expect(screen.getByText('¿Dónde quieres la barra?')).toBeInTheDocument();

    // Selecciona posición 'top' (Arriba)
    const topBtn = screen.getByRole('radio', { name: /Arriba/i });
    fireEvent.click(topBtn);

    expect(localStorage.getItem(NAV_POSITION_STORAGE_KEY)).toBe('top');
  });

  it('botón "Cerrar sesión" invoca session.logout()', async () => {
    const logoutSpy = vi.spyOn(session, 'logout');
    const mockClient = vi.fn().mockResolvedValue({
      kind: 'ok',
      account: { accountId: 'acc-123', email: 'donante@demo.test' },
    });

    render(<ProfileScreen client={mockClient} />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-screen')).toBeInTheDocument();
    });

    const logoutBtn = screen.getByTestId('profile-logout-btn');
    fireEvent.click(logoutBtn);

    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });
});
