// Ref: prompts-agentes-estilo-v2.md §4 (EVIDENCIA) y VS-0. Capturas claro/oscuro a 390 y 1280 px de la pantalla de
// entrada, para mostrar que las pantallas existentes siguen igual con los tokens v2 (DF7-09).
import { test } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

for (const width of [390, 1280]) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`vs0 login ${scheme} ${width}`, async ({ page }) => {
      if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
      await page.setViewportSize({ width, height: 860 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/login');
      await page.getByLabel('Correo electrónico').waitFor();
      await page.screenshot({ path: path.join(OUT, `vs0-login__${scheme === 'light' ? 'claro' : 'oscuro'}__${width}.png`), fullPage: true });
    });
  }
}
