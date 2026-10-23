// Ref: Documentos/plan-fase7-pantallas.md §1.5, §5 B-1.
// Capturas a 390 y 1280 px de primitivas de UI v2 (Button, Field, States) en tema claro.
import { test, expect } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

for (const width of [390, 1280]) {
  test(`b1 ui primitives login claro ${width}`, async ({ page }) => {
    if (test.info().project.name !== '1280') return;
    await page.setViewportSize({ width, height: 860 });
    await page.emulateMedia({ colorScheme: 'light' });

    await page.goto('/login');
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();

    await page.screenshot({
      path: path.join(OUT, `b1-login-primitives__claro__${width}.png`),
      fullPage: true,
    });
  });

  test(`b1 ui states loading claro ${width}`, async ({ page }) => {
    if (test.info().project.name !== '1280') return;
    await page.setViewportSize({ width, height: 860 });
    await page.emulateMedia({ colorScheme: 'light' });

    // Interceptar /public/campaigns para mantener LoadingState visible
    await page.route('**/api/v1/public/campaigns*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });

    await page.goto('/campaigns');
    await expect(page.locator('[data-testid="loading-state"]')).toBeVisible();

    await page.screenshot({
      path: path.join(OUT, `b1-states-loading__claro__${width}.png`),
      fullPage: true,
    });
  });

  test(`b1 ui states error claro ${width}`, async ({ page }) => {
    if (test.info().project.name !== '1280') return;
    await page.setViewportSize({ width, height: 860 });
    await page.emulateMedia({ colorScheme: 'light' });

    // Interceptar para forzar error 500 y renderizar ErrorState
    await page.route('**/api/v1/public/campaigns*', (route) => {
      return route.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        body: JSON.stringify({ title: 'Error de servidor', status: 500 }),
      });
    });

    await page.goto('/campaigns');
    await expect(page.getByText('No pudimos cargar la información. Inténtalo de nuevo.')).toBeVisible();

    await page.screenshot({
      path: path.join(OUT, `b1-states-error__claro__${width}.png`),
      fullPage: true,
    });
  });
}
