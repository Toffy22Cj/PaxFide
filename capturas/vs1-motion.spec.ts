// Ref: Documentos/prompts-agentes-estilo-v2.md VS-1; Documentos/plan-vs1-movimiento.md §8–§9 (Carlos, 2026-10-22).
// Capturas a 390 y 1280 px del botón de /login en estado "Enviando" (tema claro).
import { test, expect } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

for (const width of [390, 1280]) {
  test(`vs1 login enviando claro ${width}`, async ({ page }) => {
    if (test.info().project.name !== '1280') return;
    await page.setViewportSize({ width, height: 860 });

    await page.emulateMedia({ colorScheme: 'light' });

    // Configurar retraso en el backend simulado para mantener el estado "Enviando" durante la captura
    await page.route('**/api/v1/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        await route.continue({
          headers: {
            ...route.request().headers(),
            'x-test-delay-ms': '5000',
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@demo.test');
    await page.getByLabel('Contraseña').fill('demo-admin');
    const submitBtn = page.getByRole('button', { name: 'Iniciar sesión' });
    await submitBtn.click();

    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toHaveAttribute('aria-busy', 'true');
    await expect(submitBtn.locator('i').first()).toBeVisible();

    await page.screenshot({
      path: path.join(OUT, `vs1-login-enviando__claro__${width}.png`),
      fullPage: true,
    });
  });
}
