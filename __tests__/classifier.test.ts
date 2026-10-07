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

  describe('Perfil de build', () => {
    it('build por defecto (sin perfil): todo deshabilitado', async () => {
      vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', undefined as unknown as string);
      vi.stubEnv('NEXT_PUBLIC_SURFACE_PROFILE', '');
      const { classifyRoute } = await import('../src/lib/routing/classifier');
      const { isSurfaceEnabled } = await import('../src/lib/routing/surfaces');
      for (const r of ['/login', '/panel', '/c/x', '/tracking', '/assets/a', '/account/donations', '/panel/campaigns']) {
        expect(classifyRoute(r)).toBe('NOT_APPROVED');
      }
      expect(isSurfaceEnabled('action:split')).toBe(false);
      expect(isSurfaceEnabled('action:donate')).toBe(false);
    });

    it('build de demo: cada ruta de la lista de demo existe; /tracking/:code y /panel/platform siguen siendo 404', async () => {
      vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', undefined as unknown as string);
      vi.stubEnv('NEXT_PUBLIC_SURFACE_PROFILE', 'demo');
      const demo: string[] = (await import('../src/lib/routing/enabled-surfaces.demo.json')).default;
      const { classifyRoute } = await import('../src/lib/routing/classifier');
      const routes = demo.filter((x) => x.startsWith('/')).map((x) => x.replace(/:[A-Za-z]+/g, 'x1'));
      expect(routes.length).toBeGreaterThan(0);
      for (const r of routes) {
        expect(classifyRoute(r)).not.toBe('NOT_APPROVED');
      }
      expect(classifyRoute('/tracking/secreto')).toBe('NOT_APPROVED');
      expect(classifyRoute('/panel/platform/x')).toBe('NOT_APPROVED');
    });
  });

  describe('Con superficies habilitadas', () => {
    it('clasifica correctamente cada ruta del árbol según su categoría', async () => {
      vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify([
        '/login',
        '/c/:publicCode',
        '/tracking/:trackingCode',
        '/tracking',
        '/assets/:assetRef',
        '/account/donations',
        '/panel',
        '/panel/campaigns'
      ]));
      const { classifyRoute } = await import('../src/lib/routing/classifier');

      // AUTH
      expect(classifyRoute('/login')).toBe('AUTH');

      // PUBLIC
      expect(classifyRoute('/c/123')).toBe('PUBLIC');
      // C2/H1 (DW-01): el código de seguimiento nunca va en la ruta; aunque esté en la lista, no existe
      expect(classifyRoute('/tracking/123')).toBe('NOT_APPROVED');

      // AUTHENTICATED
      expect(classifyRoute('/assets/abc')).toBe('AUTHENTICATED');
      expect(classifyRoute('/panel')).toBe('AUTHENTICATED');
      expect(classifyRoute('/panel/campaigns')).toBe('AUTHENTICATED');
      expect(classifyRoute('/account/donations')).toBe('AUTHENTICATED');
      expect(classifyRoute('/tracking')).toBe('PUBLIC');
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
