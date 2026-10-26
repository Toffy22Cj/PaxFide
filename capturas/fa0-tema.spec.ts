// Ref: Documentos/plan-fase7-fidelidad.md §4 F-A0, D-F11; plan-fase7-pantallas.md §6 (C-1).
// Captura en claro y en oscuro de todas las pantallas a 390 y 1280 px contra el backend simulado.
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

async function loginAdmin(page: Page) {
  await page.goto('/panel');
  await page.getByLabel('Correo electrónico').fill('admin@demo.test');
  await page.getByLabel('Contraseña').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

async function loginDonor(page: Page) {
  await page.goto('/account/donations');
  await page.getByLabel('Correo electrónico').fill('donante@demo.test');
  await page.getByLabel('Contraseña').fill('demo-donante');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/account\/donations$/);
}

async function goClient(page: Page, to: string) {
  await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
  await page.evaluate((p) => (window as any).__TEST_ROUTER__.push(p), to);
}

for (const width of [390, 1280]) {
  for (const scheme of ['light', 'dark'] as const) {
    const tema = scheme === 'light' ? 'claro' : 'oscuro';

    test(`capturas fa0 ${tema} ${width}px`, async ({ page }) => {
      if (test.info().project.name !== '1280') return; // una sola pasada
      await page.setViewportSize({ width, height: 860 });
      await page.emulateMedia({ colorScheme: scheme });

      // 1. Landing
      await page.goto('/');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `fa0-landing__${tema}__${width}.png`), fullPage: true });

      // 2. Login
      await page.goto('/login');
      await page.getByLabel('Correo electrónico').waitFor();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, `fa0-login__${tema}__${width}.png`), fullPage: true });

      // 3. Register
      await page.goto('/register');
      await page.getByLabel('Correo electrónico').waitFor();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, `fa0-register__${tema}__${width}.png`), fullPage: true });

      // 4. Invitaciones
      await page.goto('/invitaciones');
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, `fa0-invitaciones__${tema}__${width}.png`), fullPage: true });

      // 5. Campaigns públicas
      await page.goto('/campaigns');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `fa0-campaigns__${tema}__${width}.png`), fullPage: true });

      // 6. Detalle de convocatoria
      await page.goto('/c/camp-demo-1');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `fa0-campaign-detail__${tema}__${width}.png`), fullPage: true });

      // 7. Tracking
      await page.goto('/tracking');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `fa0-tracking__${tema}__${width}.png`), fullPage: true });

      // 8. Donante autenticado: Donaciones y Home
      await loginDonor(page);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `fa0-donations__${tema}__${width}.png`), fullPage: true });

      await goClient(page, '/home');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `fa0-home__${tema}__${width}.png`), fullPage: true });

      // 9. Administrador autenticado: Panel, Convocatorias, Lotes, Predicción
      await page.goto('/login');
      await loginAdmin(page);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `fa0-panel__${tema}__${width}.png`), fullPage: true });

      await goClient(page, '/panel/campaigns');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `fa0-panel-campaigns__${tema}__${width}.png`), fullPage: true });

      await goClient(page, '/panel/assets');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `fa0-panel-assets__${tema}__${width}.png`), fullPage: true });

      await goClient(page, '/panel/prediction');
      await page.getByLabel('Convocatoria').selectOption('camp-demo-1');
      await page.getByRole('button', { name: 'Ver estimación' }).click();
      await expect(page.getByTestId('prediction-estimate')).toBeVisible();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, `fa0-panel-prediction__${tema}__${width}.png`), fullPage: true });
    });
  }
}
