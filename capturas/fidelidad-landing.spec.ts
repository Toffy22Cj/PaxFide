// Ref: Documentos/plan-fase7-fidelidad.md §1 (Punto 2) y §4 F-A1.
// Capturas de fidelidad lado a lado: boceto y app (claro y oscuro, 390 y 1280 px).
import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'Documentos', 'evidencia-web', 'capturas', 'fidelidad', 'landing');

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

for (const width of [390, 1280]) {
  for (const scheme of ['light', 'dark'] as const) {
    const tema = scheme === 'light' ? 'claro' : 'oscuro';
    const isDark = scheme === 'dark';

    test(`captura fidelidad landing ${tema} ${width}px`, async ({ browser }) => {
      // 1. Boceto (file:// sin red)
      const bocetoContext = await browser.newContext({
        viewport: { width, height: 860 },
        colorScheme: scheme,
      });
      const bocetoPage = await bocetoContext.newPage();
      const bocetoUrl = `file://${path.join(ROOT, 'Documentos', 'paxfide-landing.html')}`;
      await bocetoPage.goto(bocetoUrl, { waitUntil: 'load' });
      await bocetoPage.evaluate((dark) => {
        if (typeof (window as any).PaxWorld !== 'undefined' && typeof (window as any).PaxWorld.setTheme === 'function') {
          (window as any).PaxWorld.setTheme(dark ? 'night' : 'day');
        } else if (typeof (window as any).toggleTheme === 'function' && dark) {
          (window as any).toggleTheme();
        }
      }, isDark);
      await bocetoPage.waitForTimeout(600);
      await bocetoPage.screenshot({
        path: path.join(OUT, `landing__boceto__${tema}__${width}.png`),
        fullPage: true,
      });
      await bocetoContext.close();

      // 2. App (contra backend de pruebas)
      const appContext = await browser.newContext({
        viewport: { width, height: 860 },
        colorScheme: scheme,
      });
      const appPage = await appContext.newPage();
      await appPage.addInitScript((dark) => {
        try {
          window.localStorage.setItem('paxfide.world-mode', dark ? 'night' : 'day');
        } catch {}
      }, isDark);
      await appPage.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
      await appPage.waitForTimeout(600);
      await appPage.screenshot({
        path: path.join(OUT, `landing__app__${tema}__${width}.png`),
        fullPage: true,
      });
      await appContext.close();
    });
  }
}
