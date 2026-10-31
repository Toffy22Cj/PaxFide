// Ref: Documentos/plan-fase7-fidelidad.md §1 (Punto 2) y §4 F-A2.
// Capturas de fidelidad lado a lado: boceto y app para Login y Registro (claro y oscuro, 390 y 1280 px).
import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'Documentos', 'evidencia-web', 'capturas', 'fidelidad', 'acceso');

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

for (const screen of ['login', 'register'] as const) {
  for (const width of [390, 1280]) {
    for (const scheme of ['light', 'dark'] as const) {
      const tema = scheme === 'light' ? 'claro' : 'oscuro';
      const isDark = scheme === 'dark';

      test(`captura fidelidad ${screen} ${tema} ${width}px`, async ({ browser }) => {
        // 1. Boceto (paxfide-landing.html con openAuth)
        const bocetoContext = await browser.newContext({
          viewport: { width, height: 860 },
          colorScheme: scheme,
        });
        const bocetoPage = await bocetoContext.newPage();
        const bocetoUrl = `file://${path.join(ROOT, 'Documentos', 'paxfide-landing.html')}`;
        await bocetoPage.goto(bocetoUrl, { waitUntil: 'load' });
        await bocetoPage.evaluate(({ dark, tab }) => {
          if (typeof (window as any).PaxWorld !== 'undefined' && typeof (window as any).PaxWorld.setTheme === 'function') {
            (window as any).PaxWorld.setTheme(dark ? 'night' : 'day');
          }
          if (typeof (window as any).openAuth === 'function') {
            (window as any).openAuth(tab);
          }
        }, { dark: isDark, tab: screen });
        await bocetoPage.waitForTimeout(600);
        await bocetoPage.screenshot({
          path: path.join(OUT, `${screen}__boceto__${tema}__${width}.png`),
          fullPage: true,
        });
        await bocetoContext.close();

        // 2. App
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
        await appPage.goto(`http://localhost:3000/${screen}`, { waitUntil: 'domcontentloaded' });
        await appPage.waitForTimeout(600);
        await appPage.screenshot({
          path: path.join(OUT, `${screen}__app__${tema}__${width}.png`),
          fullPage: true,
        });
        await appContext.close();
      });
    }
  }
}
