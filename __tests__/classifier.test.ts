import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Route Classifier (W-2)', () => {
  describe('Con lista vacía (todas las superficies deshabilitadas)', () => {
    it('todas las rutas retornan NOT_APPROVED', async () => {
      vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', '[]');
      const { classifyRoute } = await import('../src/lib/routing/classifier');
      
      expect(classifyRoute('/login')).toBe('NOT_APPROVED');
      expect(classifyRoute('/c/123')).toBe('NOT_APPROVED');
      expect(classifyRoute('/tracking/123')).toBe('NOT_APPROVED');
      expect(classifyRoute('/assets/abc')).toBe('NOT_APPROVED');
      expect(classifyRoute('/panel')).toBe('NOT_APPROVED');
      expect(classifyRoute('/panel/campaigns')).toBe('NOT_APPROVED');
      expect(classifyRoute('/inventada')).toBe('NOT_APPROVED');
      expect(classifyRoute('/')).toBe('NOT_APPROVED');
    });
  });

  describe('Con superficies habilitadas', () => {
    it('clasifica correctamente cada ruta del árbol según su categoría', async () => {
      vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify([
        '/login',
        '/c/:publicCode',
        '/tracking/:trackingCode',
        '/assets/:assetRef',
        '/panel',
        '/panel/campaigns'
      ]));
      const { classifyRoute } = await import('../src/lib/routing/classifier');

      // AUTH
      expect(classifyRoute('/login')).toBe('AUTH');

      // PUBLIC
      expect(classifyRoute('/c/123')).toBe('PUBLIC');
      expect(classifyRoute('/tracking/123')).toBe('PUBLIC');

      // AUTHENTICATED
      expect(classifyRoute('/assets/abc')).toBe('AUTHENTICATED');
      expect(classifyRoute('/panel')).toBe('AUTHENTICATED');
      expect(classifyRoute('/panel/campaigns')).toBe('AUTHENTICATED');
    });

    it('identifica rutas explícitamente no aprobadas o de otras fases', async () => {
      vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/panel']));
      const { classifyRoute } = await import('../src/lib/routing/classifier');
      
      expect(classifyRoute('/panel/platform')).toBe('NOT_APPROVED');
      expect(classifyRoute('/panel/platform/organizations')).toBe('NOT_APPROVED');
      expect(classifyRoute('/unknown')).toBe('NOT_APPROVED');
    });

    it('rechaza parámetros inválidos (>255 chars o vacíos)', async () => {
      vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/c/:publicCode', '/assets/:assetRef']));
      const { classifyRoute } = await import('../src/lib/routing/classifier');
      
      const longParam = 'a'.repeat(256);
      expect(classifyRoute(`/c/${longParam}`)).toBe('NOT_APPROVED');
      expect(classifyRoute(`/assets/${longParam}`)).toBe('NOT_APPROVED');
      expect(classifyRoute('/c/')).toBe('NOT_APPROVED'); // Vacio
    });
  });
});
