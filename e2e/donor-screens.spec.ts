// Ref: plan-fase7-pantallas.md A-5 (las pantallas que adoptan un loader añaden su E2E de "reducir movimiento").
import { test, expect, type Page } from '@playwright/test';

/** Retrasa la respuesta del backend para ver el esqueleto (cabecera de prueba del doble). */
async function delay(page: Page, pattern: string) {
  await page.route(pattern, (route) => route.continue({ headers: { ...route.request().headers(), 'x-test-delay-ms': '3000' } }));
}

const playStates = (page: Page, name: string) => page.getByRole('status', { name }).locator('[class*="skeletonItem"]')
  .evaluateAll((els) => els.map((el) => getComputedStyle(el).animationPlayState));

async function donorAt(page: Page, path: string) {
  await page.goto(path); // sin sesión: el guardia guarda el destino y lleva a /login
  await page.getByLabel('Correo electrónico').fill('donante@demo.test');
  await page.getByLabel('Contraseña').fill('demo-donante');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test.describe('Pantallas del donante v2 (VS-8a)', () => {
  for (const reduced of [true, false]) {
    test(`/campaigns: el esqueleto de carga ${reduced ? 'está detenido con' : 'se anima sin'} "reducir movimiento"`, async ({ page }) => {
      await delay(page, '**/api/v1/public/campaigns');
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await page.goto('/campaigns');
      await expect(page.getByRole('status', { name: 'Cargando convocatorias' })).toBeVisible();
      const states = await playStates(page, 'Cargando convocatorias');
      expect(states.length).toBeGreaterThan(0);
      expect(new Set(states)).toEqual(new Set([reduced ? 'paused' : 'running']));
      await expect(page.getByTestId('discovery-item').first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('discovery-item').first().getByTestId('campaign-card')).toBeVisible();
    });

    test(`/account/donations: el esqueleto de carga ${reduced ? 'está detenido con' : 'se anima sin'} "reducir movimiento"`, async ({ page }) => {
      await delay(page, '**/api/v1/account/donations');
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await donorAt(page, '/account/donations');
      await expect(page.getByRole('status', { name: 'Cargando tus donaciones' })).toBeVisible();
      const states = await playStates(page, 'Cargando tus donaciones');
      expect(states.length).toBeGreaterThan(0);
      expect(new Set(states)).toEqual(new Set([reduced ? 'paused' : 'running']));
    });
  }
});
