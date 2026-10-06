import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockPush, mockReplace, getMockPathname, setMockPathname } = vi.hoisted(() => {
  let pathname = '/';
  return {
    mockPush: vi.fn(),
    mockReplace: vi.fn(),
    getMockPathname: () => pathname,
    setMockPathname: (p: string) => { pathname = p; },
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => getMockPathname(),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock('../src/lib/routing/classifier', () => ({
  classifyRoute: (pathname: string) => {
    if (pathname.startsWith('/c/')) return 'PUBLIC';
    if (pathname === '/login') return 'AUTH';
    if (pathname.startsWith('/panel')) return 'AUTHENTICATED';
    return 'NOT_APPROVED';
  }
}));

import RouteGuard from '../src/app/RouteGuard';
import * as session from '../src/lib/auth/session';

describe('Route Guard (T-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session._resetForTest();
  });

  afterEach(() => {
    cleanup();
  });

  const renderGuard = (path: string, state: session.MachineState) => {
    setMockPathname(path);
    // Forzamos el estado de la sesión
    // Nota: en un entorno normal, _resetForTest pone LOGGED_OUT en el cliente.
    // Para probar RESTORING manipulamos el valor interno o mockeamos getState.
    vi.spyOn(session, 'getState').mockReturnValue(state);
    
    return render(
      <RouteGuard>
        <div data-testid="content">Contenido de la ruta</div>
      </RouteGuard>
    );
  };

  describe('Pública (/c/123)', () => {
    it('RESTORING: Permitir', () => {
      const { getByTestId } = renderGuard('/c/123', 'RESTORING');
      expect(getByTestId('content')).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('LOGGED_OUT: Permitir', () => {
      const { getByTestId } = renderGuard('/c/123', 'LOGGED_OUT');
      expect(getByTestId('content')).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('AUTHENTICATED: Permitir', () => {
      const { getByTestId } = renderGuard('/c/123', 'AUTHENTICATED');
      expect(getByTestId('content')).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('Auth (/login)', () => {
    it('RESTORING: Esperar (Renderiza shell para SSR)', () => {
      const { getByTestId } = renderGuard('/login', 'RESTORING');
      expect(getByTestId('content')).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('LOGGED_OUT: Permitir', () => {
      const { getByTestId } = renderGuard('/login', 'LOGGED_OUT');
      expect(getByTestId('content')).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('AUTHENTICATED: Redirige a /panel (o destino retenido)', () => {
      renderGuard('/login', 'AUTHENTICATED');
      expect(mockReplace).toHaveBeenCalledWith('/panel');
    });

    it('AUTHENTICATED: Redirige al destino retenido si existe', () => {
      session.setPostLoginDestination('/assets/abc');
      renderGuard('/login', 'AUTHENTICATED');
      expect(mockReplace).toHaveBeenCalledWith('/assets/abc');
    });
  });

  describe('Autenticada (/panel)', () => {
    it('RESTORING: Esperar (Renderiza shell para SSR sin exponer contenido protegido)', () => {
      const { getByTestId, queryByTestId } = renderGuard('/panel', 'RESTORING');
      expect(getByTestId('loading-guard')).toBeInTheDocument();
      expect(queryByTestId('content')).not.toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('LOGGED_OUT: Redirige a /login y retiene destino', () => {
      renderGuard('/panel', 'LOGGED_OUT');
      expect(mockReplace).toHaveBeenCalledWith('/login');
      // Verificamos que se haya retenido el destino (mockeando el spyOn de vuelta al módulo para leerlo)
      vi.restoreAllMocks();
      expect(session.consumePostLoginDestination()).toBe('/panel');
    });

    it('AUTHENTICATED: Permitir', () => {
      const { getByTestId } = renderGuard('/panel', 'AUTHENTICATED');
      expect(getByTestId('content')).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('No aprobada (/not-exists)', () => {
    it('RESTORING: 404', () => {
      const { queryByTestId, getByText } = renderGuard('/not-exists', 'RESTORING');
      expect(queryByTestId('content')).toBeNull();
      expect(getByText('404 - Not Found')).toBeInTheDocument();
    });

    it('LOGGED_OUT: 404', () => {
      const { queryByTestId, getByText } = renderGuard('/not-exists', 'LOGGED_OUT');
      expect(queryByTestId('content')).toBeNull();
      expect(getByText('404 - Not Found')).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled(); // Nunca redirige a /login (G-W4)
    });

    it('AUTHENTICATED: 404', () => {
      const { queryByTestId, getByText } = renderGuard('/not-exists', 'AUTHENTICATED');
      expect(queryByTestId('content')).toBeNull();
      expect(getByText('404 - Not Found')).toBeInTheDocument();
    });
  });

  describe('Invariantes', () => {
    it('Idempotencia: si ya estoy en AUTHENTICATED en /panel, no recarga ni redirige', () => {
      renderGuard('/panel', 'AUTHENTICATED');
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
