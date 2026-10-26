#!/usr/bin/env node
// Ref: Documentos/plan-fase7-fidelidad.md §1 (punto 2 y 4), §4 F-A1, §5 F-B1, F-B2.
// Capturas de fidelidad lado a lado (boceto vs app) en claro y oscuro a 390 y 1280 px.
// Comprobación de superposición con elementFromPoint a 390, 1280 y 1920 px.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const launchOptions = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
  : { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };

const SCREENS = [
  { id: 'panel', path: '/panel', sketchView: 'org', role: 'ADMINISTRATOR' },
  { id: 'campaigns', path: '/panel/campaigns', sketchView: 'campaigns', role: 'ADMINISTRATOR' },
  { id: 'assets', path: '/panel/assets', sketchView: 'assets', role: 'EMPLOYEE' },
];

async function isPortOpen(port) {
  try {
    await fetch(`http://localhost:${port}/`, { method: 'HEAD' });
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404 || res.status === 401) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timeout esperando servidor en ${url}`);
}

async function captureLanding(browser) {
  const outDir = path.join(ROOT, 'Documentos', 'evidencia-web', 'capturas', 'fidelidad', 'landing');
  fs.mkdirSync(outDir, { recursive: true });
  const widths = [390, 1280];
  const themes = ['claro', 'oscuro'];

  for (const width of widths) {
    for (const tema of themes) {
      const isDark = tema === 'oscuro';
      console.log(`[capturas-fidelidad] Capturando landing - ${tema} - ${width}px...`);

      // 1. Boceto
      const bocetoPage = await browser.newPage({
        viewport: { width, height: 860 },
        colorScheme: isDark ? 'dark' : 'light',
      });
      const bocetoUrl = `file://${path.join(ROOT, 'Documentos', 'paxfide-landing.html')}`;
      await bocetoPage.goto(bocetoUrl, { waitUntil: 'load' });
      await bocetoPage.evaluate((dark) => {
        if (typeof window.PaxWorld !== 'undefined' && typeof window.PaxWorld.setTheme === 'function') {
          window.PaxWorld.setTheme(dark ? 'night' : 'day');
        } else if (typeof window.toggleTheme === 'function' && dark) {
          window.toggleTheme();
        }
      }, isDark);
      await bocetoPage.waitForTimeout(600);
      const bocetoPath = path.join(outDir, `landing__boceto__${tema}__${width}.png`);
      await bocetoPage.screenshot({ path: bocetoPath, fullPage: true });
      await bocetoPage.close();

      // 2. App
      const appPage = await browser.newPage({
        viewport: { width, height: 860 },
        colorScheme: isDark ? 'dark' : 'light',
      });
      await appPage.addInitScript((dark) => {
        try {
          window.localStorage.setItem('paxfide.world-mode', dark ? 'night' : 'day');
        } catch {}
      }, isDark);
      await appPage.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
      await appPage.waitForTimeout(600);
      const appPath = path.join(outDir, `landing__app__${tema}__${width}.png`);
      await appPage.screenshot({ path: appPath, fullPage: true });
      await appPage.close();

      console.log(`  ✓ Guardado:\n    - ${bocetoPath}\n    - ${appPath}`);
    }
  }
}

async function capturePanelScreens(browser, screensToRun) {
  const sketchPath = path.join(ROOT, 'Documentos', 'paxfide-panel.html');
  const sketchUrl = `file://${sketchPath}`;

  for (const screenInfo of screensToRun) {
    const outDir = path.join(ROOT, 'Documentos', 'evidencia-web', 'capturas', 'fidelidad', screenInfo.id);
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`\n=== Procesando pantalla: ${screenInfo.id} (${screenInfo.path}) ===`);

    // A. Capturar Boceto (paxfide-panel.html)
    console.log(`Capturando boceto para ${screenInfo.id}...`);
    for (const theme of ['claro', 'oscuro']) {
      for (const width of [390, 1280]) {
        const page = await browser.newPage({
          viewport: { width, height: 860 },
        });
        await page.goto(sketchUrl);
        await page.evaluate(
          ({ th, role, view }) => {
            const dRole = document.querySelector('#dRole');
            if (dRole) {
              dRole.value = role;
              dRole.dispatchEvent(new Event('change'));
            }
            if (typeof window.showPanelView === 'function') {
              window.showPanelView(view);
            }
            if (th === 'oscuro') {
              document.documentElement.dataset.theme = 'dark';
            } else {
              delete document.documentElement.dataset.theme;
            }
          },
          { th: theme, role: screenInfo.role, view: screenInfo.sketchView }
        );
        await page.waitForTimeout(400);
        const out = path.join(outDir, `boceto__${theme}__${width}.png`);
        await page.screenshot({ path: out, fullPage: true });
        console.log(`Boceto guardado: ${out}`);
        await page.close();
      }
    }

    // B. Capturar App en localhost:3000
    console.log(`Capturando app para ${screenInfo.id}...`);
    const user = screenInfo.role === 'ADMINISTRATOR' ? 'admin@demo.test' : 'empleado@demo.test';
    const pass = screenInfo.role === 'ADMINISTRATOR' ? 'demo-admin' : 'demo-empleado';

    for (const theme of ['claro', 'oscuro']) {
      for (const width of [390, 1280]) {
        const context = await browser.newContext({
          viewport: { width, height: 860 },
        });
        const page = await context.newPage();

        await page.goto(`http://localhost:3000${screenInfo.path}`);
        await page.getByLabel('Correo electrónico').waitFor({ timeout: 10000 });
        await page.getByLabel('Correo electrónico').fill(user);
        await page.getByLabel('Contraseña').fill(pass);
        await page.getByRole('button', { name: 'Iniciar sesión' }).click();

        await page.waitForURL(new RegExp(`${screenInfo.path}$`), { timeout: 10000 });
        await page.getByTestId('panel-content').waitFor({ timeout: 10000 });

        if (theme === 'oscuro') {
          await page.evaluate(() => {
            document.documentElement.setAttribute('data-theme', 'dark');
          });
        } else {
          await page.evaluate(() => {
            document.documentElement.removeAttribute('data-theme');
          });
        }
        await page.waitForTimeout(500);

        const out = path.join(outDir, `app__${theme}__${width}.png`);
        await page.screenshot({ path: out, fullPage: true });
        console.log(`App guardada: ${out}`);
        await context.close();
      }
    }

    // C. Verificación de superposiciones (§1.4)
    console.log(`Comprobando no-superposición (elementFromPoint) para ${screenInfo.id} a 390, 1280 y 1920 px...`);
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`http://localhost:3000${screenInfo.path}`);
    await page.getByLabel('Correo electrónico').waitFor({ timeout: 10000 });
    await page.getByLabel('Correo electrónico').fill(user);
    await page.getByLabel('Contraseña').fill(pass);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL(new RegExp(`${screenInfo.path}$`));
    await page.getByTestId('panel-content').waitFor();

    for (const width of [390, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);

      const overlapIssues = await page.evaluate(() => {
        const controls = Array.from(document.querySelectorAll('button, a, input, select'));
        const issues = [];
        for (const el of controls) {
          if (el.offsetParent === null) continue;
          el.scrollIntoView({ block: 'center', inline: 'center' });
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const cx = Math.floor(rect.left + rect.width / 2);
          const cy = Math.floor(rect.top + rect.height / 2);
          const topEl = document.elementFromPoint(cx, cy);
          if (topEl && topEl.tagName && topEl.tagName.toUpperCase().includes('NEXTJS')) {
            continue;
          }
          if (topEl !== el && !el.contains(topEl)) {
            issues.push({
              tag: el.tagName,
              text: el.textContent?.trim().slice(0, 30),
              topElTag: topEl?.tagName,
              topElClass: topEl?.className,
            });
          }
        }
        return issues;
      });

      if (overlapIssues.length > 0) {
        console.error(`ERROR: Elementos superpuestos a ${width}px en ${screenInfo.id}:`, overlapIssues);
        throw new Error(`Se detectaron superposiciones a ${width}px en ${screenInfo.id}`);
      } else {
        console.log(`✓ Sin superposiciones a ${width}px en ${screenInfo.id}.`);
      }
    }
    await context.close();
  }
}

async function main() {
  const targetScreen = process.argv[2];
  console.log(`Iniciando capturas de fidelidad${targetScreen ? ` para: ${targetScreen}` : ''}...`);

  let fakeBackendProc = null;
  let nextProc = null;

  try {
    const backendUp = await isPortOpen(3002);
    if (!backendUp) {
      console.log('Iniciando fake backend en puerto 3002...');
      fakeBackendProc = spawn('node', ['scripts/fake-backend.js'], {
        cwd: ROOT,
        stdio: 'inherit',
      });
      await waitForServer('http://localhost:3002/api/v1/health', 10000).catch(() => {});
    }

    const webUp = await isPortOpen(3000);
    if (!webUp) {
      console.log('Iniciando Next.js en puerto 3000...');
      const surfaces = JSON.stringify([
        '/',
        '/home',
        '/login',
        '/panel',
        '/panel/campaigns',
        '/panel/assets',
        '/panel/funds',
        '/account/donations',
        'action:register-asset',
        'action:create-campaign',
      ]);
      nextProc = spawn('pnpm', ['dev', '--port', '3000'], {
        cwd: ROOT,
        stdio: 'inherit',
        env: {
          ...process.env,
          NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3002/api/v1',
          NEXT_PUBLIC_E2E_SURFACES: surfaces,
        },
      });
      await waitForServer('http://localhost:3000/login', 35000);
    }

    const browser = await chromium.launch(launchOptions);

    try {
      if (targetScreen === 'landing') {
        await captureLanding(browser);
      } else if (targetScreen) {
        const match = SCREENS.filter((s) => s.id === targetScreen);
        if (match.length === 0) {
          console.error(`Pantalla desconocida: ${targetScreen}`);
          process.exit(1);
        }
        await capturePanelScreens(browser, match);
      } else {
        await capturePanelScreens(browser, SCREENS);
      }
    } finally {
      await browser.close();
    }

    console.log('\n✅ Todas las capturas y comprobaciones completadas con éxito.');
  } finally {
    if (nextProc) nextProc.kill();
    if (fakeBackendProc) fakeBackendProc.kill();
  }
}

main().catch((err) => {
  console.error('Fallo en la captura de fidelidad:', err);
  process.exit(1);
});
