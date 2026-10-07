import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as session from '../src/lib/auth/session';
import { LoginScreen } from '../src/screens/LoginScreen';

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /Iniciar sesión/ }));
}

describe('LoginScreen (§5.2)', () => {
  beforeEach(() => session._resetForTest());

  it('validación local: campos vacíos → "Este campo es obligatorio." sin llamar al backend', () => {
    const client = vi.fn();
    render(<LoginScreen loginClient={client} />);
    fireEvent.click(screen.getByRole('button', { name: /Iniciar sesión/ }));
    expect(screen.getAllByText('Este campo es obligatorio.')).toHaveLength(2);
    expect(client).not.toHaveBeenCalled();
  });

  it('enviando: botón deshabilitado con "…"', async () => {
    let resolve: (v: any) => void = () => {};
    const client = vi.fn(() => new Promise<any>((r) => { resolve = r; }));
    render(<LoginScreen loginClient={client} />);
    fill('a@b.co', 'x');
    const btn = screen.getByRole('button', { name: /Iniciar sesión…/ });
    expect(btn).toBeDisabled();
    resolve({ kind: 'invalid-credentials' });
    await screen.findByText('Correo o contraseña incorrectos.');
  });

  it('401: un único mensaje, sin sugerir "cuenta inactiva"', async () => {
    render(<LoginScreen loginClient={async () => ({ kind: 'invalid-credentials' })} />);
    fill('a@b.co', 'x');
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(document.body.textContent).not.toMatch(/inactiv/i);
    expect(session.getState()).toBe('LOGGED_OUT');
  });

  it('5xx y red tienen sus textos', async () => {
    const { unmount } = render(<LoginScreen loginClient={async () => ({ kind: 'server-error' })} />);
    fill('a@b.co', 'x');
    await screen.findByText('No pudimos iniciar sesión. Inténtalo de nuevo más tarde.');
    unmount();
    render(<LoginScreen loginClient={async () => ({ kind: 'network' })} />);
    fill('a@b.co', 'x');
    await screen.findByText('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.');
  });

  it('éxito: el token pasa a la sesión en memoria y no a ningún almacenamiento', async () => {
    render(<LoginScreen loginClient={async () => ({ kind: 'ok', token: 'jwt-secreto' })} />);
    fill('a@b.co', 'x');
    await waitFor(() => expect(session.getState()).toBe('AUTHENTICATED'));
    expect(session.getJwt()).toBe('jwt-secreto');
    expect(JSON.stringify(localStorage)).not.toContain('jwt-secreto');
    expect(JSON.stringify(sessionStorage)).not.toContain('jwt-secreto');
    expect(document.cookie).not.toContain('jwt-secreto');
  });

  it('aviso de sesión expirada (T-1) y de cierre en otra pestaña', () => {
    session.login('t');
    session.handle401(false);
    const { unmount } = render(<LoginScreen loginClient={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Tu sesión expiró. Vuelve a iniciar sesión.');
    unmount();
    session.login('t');
    session._simulateChannelMessageForTest();
    render(<LoginScreen loginClient={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cerraste sesión en otra pestaña.');
  });
});
