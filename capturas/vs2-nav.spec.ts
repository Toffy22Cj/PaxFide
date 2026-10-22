// Ref: prompts-agentes-estilo-v2.md §4 (EVIDENCIA) y VS-2; respuesta de Carlos al plan de VS-2 (solo claro, DF7-17).
// Capturas a 390 y 1280 px de /login (sin sesión), /panel y /campaigns (con ADMINISTRATOR).
import { test, expect } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

for (const width of [390, 1280]) {
  test(`vs2 claro ${width}`, async ({ page }) => {
    if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
    await page.setViewportSize({ width, height: 860 });
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').waitFor();
    await page.screenshot({ path: path.join(OUT, `vs2-login__claro__${width}.png`), fullPage: true });
    await page.getByLabel('Correo electrónico').fill('admin@demo.test');
    await page.getByLabel('Contraseña').fill('demo-admin');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/panel$/);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `vs2-panel__claro__${width}.png`), fullPage: true });
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Explorar' }).click();
    await expect(page).toHaveURL(/\/campaigns$/);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `vs2-campaigns__claro__${width}.png`), fullPage: true });
  });
}
