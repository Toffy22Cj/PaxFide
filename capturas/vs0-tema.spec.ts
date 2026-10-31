// Ref: prompts-agentes-estilo-v2.md §4 (EVIDENCIA) y VS-0; sistema-visual-paxfide-web-enmienda-1.md §7.1 (radios, opción
// (a) de Carlos, 2026-10-21). Capturas claro/oscuro a 390 y 1280 px del login y de la estimación (/panel/prediction,
// que usa radius-surface). VS0_FASE=antes|despues se añade al nombre del archivo.
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');
const FASE = process.env.VS0_FASE ?? 'despues';

async function prediction(page: Page) {
  // A-3: el inicio por defecto es /home; pedir /panel sin sesión lo guarda como destino y se vuelve ahí tras entrar
  await page.goto('/panel');
  await page.getByLabel('Correo electrónico').fill('admin@demo.test');
  await page.getByLabel('Contraseña').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
  await page.evaluate(() => (window as any).__TEST_ROUTER__.push('/panel/prediction'));
  await page.getByLabel('Convocatoria').selectOption('camp-demo-1');
  await page.getByRole('button', { name: 'Ver estimación' }).click();
  await expect(page.getByTestId('prediction-estimate')).toBeVisible();
}

for (const width of [390, 1280]) {
  for (const scheme of ['light', 'dark'] as const) {
    const tema = scheme === 'light' ? 'claro' : 'oscuro';
    test(`vs0 ${FASE} ${scheme} ${width}`, async ({ page }) => {
      if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
      await page.setViewportSize({ width, height: 860 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/login');
      await page.getByLabel('Correo electrónico').waitFor();
      await page.screenshot({ path: path.join(OUT, `vs0-login__${tema}-${FASE}__${width}.png`), fullPage: true });
      await prediction(page);
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(OUT, `vs0-estimacion__${tema}-${FASE}__${width}.png`), fullPage: true });
    });
  }
}
