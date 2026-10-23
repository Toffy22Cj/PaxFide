// Ref: prompts-agentes-estilo-v2.md §4 (EVIDENCIA); plan-fase7-pantallas.md §1.5 y A-2. Capturas en claro (DF7-17) a
// 390 y 1280 px de la landing: la primera parada, una parada intermedia y el final (seguimiento y convocatorias).
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

async function shot(page: Page, name: string, width: number) {
  await page.waitForTimeout(1200); // el mundo se mueve y la cámara sigue al scroll: unos fotogramas antes de capturar
  await page.screenshot({ path: path.join(OUT, `vs4-landing-${name}__claro__${width}.png`) });
}

for (const width of [390, 1280]) {
  test(`vs4 landing ${width}`, async ({ page }) => {
    if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
    await page.setViewportSize({ width, height: 860 });
    await page.goto('/');
    await expect(page.getByTestId('landing-campaigns')).toBeVisible();
    await shot(page, 'inicio', width);
    await page.locator('#parada-4').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await shot(page, 'sello', width);
    await page.getByTestId('example-toggle').click();
    await page.locator('#seguir').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await shot(page, 'seguimiento', width);
    await page.locator('#convocatorias').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await shot(page, 'convocatorias', width);
  });
}
