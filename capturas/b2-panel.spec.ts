// Ref: Documentos/plan-fase7-pantallas.md §1.5, §5 B-2; capturas de /panel en claro a 390 y 1280 px.
import { test, expect } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

for (const width of [390, 1280]) {
  test(`b2 panel v2 claro ${width}`, async ({ page }) => {
    if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
    await page.setViewportSize({ width, height: 860 });
    // Pedir /panel sin sesión guarda destino en el guardia y vuelve ahí tras login
    await page.goto('/panel');
    await page.getByLabel('Correo electrónico').waitFor();
    await page.getByLabel('Correo electrónico').fill('admin@demo.test');
    await page.getByLabel('Contraseña').fill('demo-admin');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByTestId('panel-content')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `b2-panel__claro__${width}.png`), fullPage: true });
  });
}
