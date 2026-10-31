import { test, expect } from '@playwright/test';

test.describe('Production build (Rule 7)', () => {
  test('does not expose __TEST_SESSION__ or __TEST_ROUTER__ backdoors', async ({ page }) => {
    await page.goto('/');
    
    // Check if it's exposed
    const isSessionExposed = await page.evaluate(() => {
      return !!(window as any).__TEST_SESSION__;
    });
    const isRouterExposed = await page.evaluate(() => {
      return !!(window as any).__TEST_ROUTER__;
    });

    expect(isSessionExposed).toBe(false);
    expect(isRouterExposed).toBe(false);
  });
});

// U-27 (plan-fase7-puesta-al-dia.md Anexo 4, P-13): el build normal, sin perfil, activa la lista única (la de demo)
test.describe('Build normal sin perfil (U-27)', () => {
  test('/login, /campaigns y /verificar-correo existen', async ({ page }) => {
    for (const path of ['/login', '/campaigns', '/verificar-correo']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByText('No encontramos esta página.'), path).toHaveCount(0);
    }
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
    await page.goto('/verificar-correo');
    await expect(page.getByRole('heading', { name: 'Confirmar tu correo' })).toBeVisible();
  });

  test('negativas: /tracking/x y /panel/platform/x siguen dando 404', async ({ page }) => {
    for (const path of ['/tracking/x', '/panel/platform/x']) {
      await page.goto(path);
      await expect(page.getByText('No encontramos esta página.'), path).toBeVisible();
    }
  });
});
