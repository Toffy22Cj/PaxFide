// Ref: Documentos/plan-fase7-pantallas.md §1.5, §5 B-3; capturas de pantallas del panel en claro a 390 y 1280 px.
import { test, expect, Page } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

const SCREENS = [
  { path: '/panel/campaigns', name: 'b3-panel-campaigns' },
  { path: '/panel/prediction', name: 'b3-panel-prediction' },
  { path: '/panel/funds', name: 'b3-panel-funds' },
  { path: '/panel/assets', name: 'b3-panel-assets' },
  { path: '/panel/configuration', name: 'b3-panel-configuration' },
  { path: '/panel/members', name: 'b3-panel-members' },
  { path: '/panel/my-campaigns', name: 'b3-panel-my-campaigns' },
  { path: '/panel/organization', name: 'b3-panel-organization' },
  { path: '/panel/platform', name: 'b3-panel-platform' },
];

async function go(page: Page, to: string) {
  await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
  await page.evaluate((p) => (window as any).__TEST_ROUTER__.push(p), to);
  await page.waitForTimeout(600);
}

for (const width of [390, 1280]) {
  test(`b3 panel screens claro ${width}`, async ({ page }) => {
    if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
    await page.setViewportSize({ width, height: 860 });

    // Iniciar sesión como administrador
    await page.goto('/panel');
    await page.getByLabel('Correo electrónico').waitFor();
    await page.getByLabel('Correo electrónico').fill('admin@demo.test');
    await page.getByLabel('Contraseña').fill('demo-admin');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByTestId('panel-content')).toBeVisible();

    for (const scr of SCREENS) {
      await go(page, scr.path);
      await page.screenshot({ path: path.join(OUT, `${scr.name}__claro__${width}.png`), fullPage: true });
    }

    // Estimación con resultado (gráficas de PredictionCharts)
    await go(page, '/panel/prediction');
    await page.getByRole('button', { name: 'Ver estimación' }).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `b3-panel-prediction-result__claro__${width}.png`), fullPage: true });
  });
}

// /assets/:assetRef solo lo opera un EMPLEADO (canOperate en el fake-backend; un administrador recibe 403)
for (const width of [390, 1280]) {
  test(`b3 detalle de lote claro ${width}`, async ({ page }) => {
    if (test.info().project.name !== '1280') return;
    await page.setViewportSize({ width, height: 860 });
    await page.goto('/panel');
    await page.getByLabel('Correo electrónico').waitFor();
    await page.getByLabel('Correo electrónico').fill('empleado@demo.test');
    await page.getByLabel('Contraseña').fill('demo-empleado');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/panel$/);
    await go(page, '/assets/ASSET-123');
    await expect(page.getByTestId('field-lifecycleStatus')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `b3-asset-detail__claro__${width}.png`), fullPage: true });
  });
}
