// Ref: prompts-agentes-estilo-v2.md §4 (EVIDENCIA); plan-fase7-pantallas.md §1.5 y A-3. Capturas en claro (DF7-17) a
// 390 y 1280 px del inicio de un donante y de una cuenta con organización.
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

async function home(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByTestId('home-campaigns').getByTestId('campaign-card').first()).toBeVisible();
  await page.waitForTimeout(900); // la ciudad se mueve: unos fotogramas antes de capturar
}

for (const width of [390, 1280]) {
  test(`vs5 home ${width}`, async ({ browser }) => {
    if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
    for (const [who, email, password] of [['donante', 'donante@demo.test', 'demo-donante'], ['organizacion', 'admin@demo.test', 'demo-admin']]) {
      const page = await (await browser.newContext({ viewport: { width, height: 860 } })).newPage();
      await home(page, email, password);
      await page.screenshot({ path: path.join(OUT, `vs5-home-${who}__claro__${width}.png`), fullPage: true });
    }
  });
}
