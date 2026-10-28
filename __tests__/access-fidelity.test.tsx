// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F5, D-F10, D-F14, X-4..X-7; §4 F-A2.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as session from '../src/lib/auth/session';
import { RegisterScreen } from '../src/screens/RegisterScreen';
import { LoginScreen } from '../src/screens/LoginScreen';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

/** R-1 (plan-fase7-puesta-al-dia.md): sin las dos casillas no se puede enviar; las marca si aún no lo están. */
function consentAll() {
  for (const id of ['consent-terms', 'consent-dataPolicy']) {
    const box = screen.getByTestId(id) as HTMLInputElement;
    if (!box.checked) fireEvent.click(box);
  }
}


describe('Fidelidad del Acceso (F-A2)', () => {
  beforeEach(() => {
    session._resetForTest();
  });

  describe('Registro y D-F14 (Fundación y desviaciones)', () => {
    it('D-F14: no existe selector de rol (donante/organización) ni enlace a /panel/organization (negativa)', () => {
      const { container } = render(<RegisterScreen client={vi.fn()} />);

      // Negativa: no hay selector de donante u organización (X-7)
      expect(screen.queryByLabelText(/donante/i)).toBeNull();
      expect(screen.queryByLabelText(/organización/i)).toBeNull();
      expect(container.querySelector('input[name="userRole"]')).toBeNull();

      // Negativa: no hay enlace a /panel/organization
      const orgLink = container.querySelector('a[href*="/panel/organization"]');
      expect(orgLink).toBeNull();
    });

    it('D-F14: la nota plegable "¿Representas una fundación?" contiene los 5 pasos', () => {
      render(<RegisterScreen client={vi.fn()} />);
      const summary = screen.getByText('¿Representas una fundación?');
      expect(summary).toBeInTheDocument();

      const details = summary.closest('details');
      expect(details).not.toBeNull();
      expect(details).toHaveTextContent('Crea tu cuenta aquí, como cualquier donante.');
      expect(details).toHaveTextContent('Inicia sesión.');
      expect(details).toHaveTextContent('Registrar organización');
      expect(details).toHaveTextContent('Pendiente de verificación');
      expect(details).toHaveTextContent('Verificada');
    });

    it('X-6: con 11 caracteres el registro avisa antes de enviar y el medidor indica debilidad', () => {
      const client = vi.fn();
      render(<RegisterScreen client={client} />);

      const passInput = screen.getByLabelText('Contraseña');
      fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'user@demo.test' } });
      fireEvent.change(passInput, { target: { value: '12345678901' } }); // 11 chars
      fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: '12345678901' } });

      // Medidor de seguridad indica débil (< 12)
      expect(screen.getByText(/Seguridad: Débil/i)).toBeInTheDocument();

      consentAll(); fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      // Bloquea antes de enviar al backend
      expect(screen.getByText('La contraseña debe tener al menos 12 caracteres.')).toBeInTheDocument();
      expect(client).not.toHaveBeenCalled();
    });

    it('con 12 caracteres el registro pasa la validación local y llama al backend', async () => {
      const client = vi.fn().mockResolvedValue({ kind: 'ok' });
      render(<RegisterScreen client={client} />);

      fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'user@demo.test' } });
      fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: '123456789012' } }); // 12 chars
      fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: '123456789012' } });

      consentAll(); fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      await waitFor(() => expect(client).toHaveBeenCalledWith('user@demo.test', '123456789012'));
      expect(session.isJustRegistered()).toBe(true);
    });
  });

  describe('D-F10: Bienvenida', () => {
    it('tras registrarse e iniciar sesión: se muestra la bienvenida con los cubos y "Continuar" limpia el aviso', async () => {
      session.markJustRegistered();
      expect(session.isJustRegistered()).toBe(true);

      const onContinue = vi.fn();
      const profileClients = {
        fetch: vi.fn().mockResolvedValue({ kind: 'ok', profile: { email: 'nuevo@demo.test' } }),
        update: vi.fn(),
      };
      render(<LoginScreen loginClient={async () => ({ kind: 'ok', token: 'jwt-nuevo' })} onContinueWelcome={onContinue} profileClients={profileClients} />);

      // Login
      fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'nuevo@demo.test' } });
      fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-12-caracteres' } });
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

      // Se muestra la bienvenida (D-F10)
      const welcome = await screen.findByTestId('welcome-gate');
      expect(welcome).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Te damos la bienvenida a PaxFide');
      expect(screen.getByText('Dona a convocatorias verificadas')).toBeInTheDocument();
      expect(screen.getByText('Sigue el recorrido de tu ayuda')).toBeInTheDocument();
      expect(screen.getByText('Cada paso queda sellado')).toBeInTheDocument();

      // Pulsar Continuar: P-1 añade "¿Cómo te llamamos?", opcional
      const btn = screen.getByRole('button', { name: 'Continuar' });
      fireEvent.click(btn);
      expect(onContinue).not.toHaveBeenCalled();
      expect(await screen.findByTestId('name-gate')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Más tarde' }));
      expect(onContinue).toHaveBeenCalledTimes(1);
      expect(profileClients.update).not.toHaveBeenCalled();
    });

    it('en un inicio de sesión normal: NO se muestra la bienvenida (negativa)', async () => {
      expect(session.isJustRegistered()).toBe(false);

      render(<LoginScreen loginClient={async () => ({ kind: 'ok', token: 'jwt-normal' })} />);

      fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'normal@demo.test' } });
      fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-12-caracteres' } });
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

      // No se muestra la bienvenida
      await waitFor(() => expect(session.getState()).toBe('AUTHENTICATED'));
      expect(screen.queryByTestId('welcome-gate')).toBeNull();
    });
  });

  describe('D-F5: Estructura de barra de acceso y retorno', () => {
    it('la barra de acceso contiene "Volver al recorrido" enlazando a "/" y botón de pausa', () => {
      render(<LoginScreen loginClient={vi.fn()} />);

      const backLink = screen.getByRole('link', { name: 'Volver al recorrido' });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/');

      expect(screen.getByRole('button', { name: 'Pausar animación' })).toBeInTheDocument();
      expect(screen.getByTestId('landing-theme-toggle')).toBeInTheDocument();
    });
  });
});
