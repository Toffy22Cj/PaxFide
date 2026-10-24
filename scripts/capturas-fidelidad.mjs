// Ref: plan-fase7-fidelidad.md §1 (definición de terminado, punto 2): capturas lado a lado del boceto y de la app, en
// el mismo estado y al mismo ancho (390 y 1280 px), en claro y en oscuro. Usa la Playwright del repo (no es una
// dependencia nueva). El boceto se abre como file:// SIN red (toda petición que no sea file:// se aborta); la app,
// contra el servidor falso, ya arrancado (pnpm build && pnpm start con NEXT_PUBLIC_E2E_*, y node scripts/fake-backend.js).
//
// Uso:  node scripts/capturas-fidelidad.mjs <pantalla> [<pantalla> …]     (sin argumentos: todas)
//       APP_URL=http://localhost:3000  PW_CHROMIUM_PATH=/ruta/a/chrome (opcional)
// Salida: Documentos/evidencia-web/capturas/fidelidad/<pantalla>/<estado>__<claro|oscuro>__<ancho>.png
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'Documentos');
const OUT = path.join(DOCS, 'evidencia-web', 'capturas', 'fidelidad');
const APP = process.env.APP_URL ?? 'http://localhost:3000';
const WIDTHS = [390, 1280];
const THEMES = ['claro', 'oscuro'];

const settle = (page, ms = 1200) => page.waitForTimeout(ms);
/** Lleva el centro de la sección `id` al centro de la ventana, sin desplazamiento suave. */
const scrollTo = (page, id, f = 0.5) => page.evaluate(([i, q]) => {
  document.documentElement.style.scrollBehavior = 'auto';
  const el = document.getElementById(i);
  if (el) window.scrollTo(0, el.offsetTop + el.offsetHeight * q - window.innerHeight / 2);
}, [id, f]);

/**
 * Cada pantalla: el boceto (`mock`), la ruta de la app (`app`), cómo poner cada uno en oscuro y sus estados. Un estado
 * prepara las dos páginas igual (`both`) o cada una a su manera (`mock` / `app`).
 */
const SCREENS = {
  landing: {
    mock: 'paxfide-landing.html',
    app: '/',
    // Boceto: su botón Día / Noche pasa de Auto a Noche. App: la misma elección guardada (D-F2)
    darkMock: (page) => page.evaluate(() => document.getElementById('themeToggle')?.click()),
    darkApp: (page) => page.addInitScript(() => window.localStorage.setItem('paxfide.world-mode', 'night')),
    states: {
      'parada-1': { both: (p) => scrollTo(p, 'parada-1') },
      'parada-3': { both: (p) => scrollTo(p, 'parada-3') },
      'parada-4': { both: (p) => scrollTo(p, 'parada-4') },
      'recorrido': { both: (p) => scrollTo(p, 'recorrido') },
      'seguimiento-ejemplo': {
        mock: async (p) => { await scrollTo(p, 'seguir', 0.35); await p.evaluate(() => document.querySelector('.demo-chip')?.click()); },
        app: async (p) => { await scrollTo(p, 'seguir', 0.35); await p.getByTestId('example-chip').first().click(); },
      },
      'convocatorias': { both: (p) => scrollTo(p, 'convocatorias', 0.2) },
      'menu-estrecho': {
        onlyWidth: 390,
        mock: (p) => p.evaluate(() => document.getElementById('navToggle')?.click()),
        app: (p) => p.getByRole('button', { name: 'Abrir menú de navegación' }).click(),
      },
    },
  },
};

async function shot(browser, { url, offline, width, dark, prepare }) {
  const context = await browser.newContext({ viewport: { width, height: 860 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  if (offline) await page.route((u) => !u.href.startsWith('file:'), (r) => r.abort());
  if (dark?.before) await dark.before(page);
  await page.goto(url, { waitUntil: offline ? 'load' : 'networkidle' });
  await settle(page, 800);
  if (dark?.after) await dark.after(page);
  await prepare(page);
  await settle(page);
  const png = await page.screenshot();
  await context.close();
  return png;
}

/** Une las dos capturas en una sola imagen, con su rótulo, renderizándolas en una página. */
async function sideBySide(browser, mockPng, appPng, width, file) {
  const page = await browser.newPage({ viewport: { width: width * 2 + 48, height: 940 } });
  const img = (b) => `data:image/png;base64,${b.toString('base64')}`;
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#E2E9E9;font:600 14px system-ui;display:flex;gap:16px;padding:16px">
    <figure style="margin:0"><figcaption style="padding:0 0 8px">Boceto</figcaption><img src="${img(mockPng)}" width="${width}"></figure>
    <figure style="margin:0"><figcaption style="padding:0 0 8px">App</figcaption><img src="${img(appPng)}" width="${width}"></figure>
  </body></html>`);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}

const names = process.argv.slice(2);
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
try {
  for (const name of names.length ? names : Object.keys(SCREENS)) {
    const screen = SCREENS[name];
    if (!screen) throw new Error(`Pantalla desconocida: ${name}`);
    const mockUrl = pathToFileURL(path.join(DOCS, screen.mock)).href;
    readFileSync(path.join(DOCS, screen.mock)); // falla pronto si falta el boceto
    const dir = path.join(OUT, name);
    mkdirSync(dir, { recursive: true });
    for (const [state, prep] of Object.entries(screen.states)) {
      for (const width of WIDTHS) {
        if (prep.onlyWidth && prep.onlyWidth !== width) continue;
        for (const theme of THEMES) {
          const dark = theme === 'oscuro';
          const mockPng = await shot(browser, {
            url: mockUrl, offline: true, width,
            dark: dark ? { after: screen.darkMock } : null,
            prepare: prep.mock ?? prep.both,
          });
          const appPng = await shot(browser, {
            url: APP + (prep.appPath ?? screen.app), offline: false, width,
            dark: dark ? { before: screen.darkApp, after: screen.darkAppAfter } : null,
            prepare: prep.app ?? prep.both,
          });
          const file = path.join(dir, `${state}__${theme}__${width}.png`);
          await sideBySide(browser, mockPng, appPng, width, file);
          console.log(path.relative(ROOT, file));
        }
      }
    }
  }
} finally {
  await browser.close();
}
