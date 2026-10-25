#!/usr/bin/env node
// Ref: Documentos/plan-fase7-fidelidad.md §1 (punto 2 y 4), §5 F-B1.
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

const OUT_DIR = path.join(ROOT, 'Documentos', 'evidencia-web', 'capturas', 'fidelidad', 'panel');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function isPortOpen(port) {
  try {
    const res = await fetch(`http://localhost:${port}/`, { method: 'HEAD' });
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

async function main() {
  console.log('Iniciando captura de fidelidad...');
  let fakeBackendProc = null;
  let nextProc = null;

  try {
    // 1. Asegurar fake backend en puerto 3002
    const backendUp = await isPortOpen(3002);
    if (!backendUp) {
      console.log('Iniciando fake backend en puerto 3002...');
      fakeBackendProc = spawn('node', ['scripts/fake-backend.js'], {
        cwd: ROOT,
        stdio: 'inherit',
      });
      await waitForServer('http://localhost:3002/api/v1/health', 10000).catch(() => {});
    }

    // 2. Asegurar frontend en puerto 3000
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

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const sketchPath = path.join(ROOT, 'Documentos', 'paxfide-panel.html');
    const sketchUrl = `file://${sketchPath}`;

    // A. Capturar Boceto (paxfide-panel.html)
    console.log('Capturando boceto...');
    for (const theme of ['claro', 'oscuro']) {
      for (const width of [390, 1280]) {
        const page = await browser.newPage({
          viewport: { width, height: 860 },
        });
        await page.goto(sketchUrl);
        // Configurar tema y rol en el prototipo
        await page.evaluate(
          ({ th }) => {
            const dRole = document.querySelector('#dRole');
            if (dRole) {
              dRole.value = 'ADMINISTRATOR';
              dRole.dispatchEvent(new Event('change'));
            }
            if (typeof window.showPanelView === 'function') {
              window.showPanelView('org');
            }
            if (th === 'oscuro') {
              document.documentElement.dataset.theme = 'dark';
            } else {
              delete document.documentElement.dataset.theme;
            }
          },
          { th: theme }
        );
        await page.waitForTimeout(400);
        const out = path.join(OUT_DIR, `boceto__${theme}__${width}.png`);
        await page.screenshot({ path: out, fullPage: true });
        console.log(`Boceto guardado: ${out}`);
        await page.close();
      }
    }

    // B. Capturar App en localhost:3000/panel
    console.log('Capturando app...');
    for (const theme of ['claro', 'oscuro']) {
      for (const width of [390, 1280]) {
        const context = await browser.newContext({
          viewport: { width, height: 860 },
        });
        const page = await context.newPage();

        // Iniciar sesión como administrador
        await page.goto('http://localhost:3000/panel');
        await page.getByLabel('Correo electrónico').waitFor({ timeout: 10000 });
        await page.getByLabel('Correo electrónico').fill('admin@demo.test');
        await page.getByLabel('Contraseña').fill('demo-admin');
        await page.getByRole('button', { name: 'Iniciar sesión' }).click();

        await page.waitForURL(/\/panel$/, { timeout: 10000 });
        await page.getByTestId('panel-content').waitFor({ timeout: 10000 });

        // Aplicar tema
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

        const out = path.join(OUT_DIR, `app__${theme}__${width}.png`);
        await page.screenshot({ path: out, fullPage: true });
        console.log(`App guardada: ${out}`);
        await context.close();
      }
    }

    // C. Verificación de superposiciones (§1.4)
    console.log('Comprobando no-superposición (elementFromPoint) a 390, 1280 y 1920 px...');
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:3000/panel');
    await page.getByLabel('Correo electrónico').waitFor({ timeout: 10000 });
    await page.getByLabel('Correo electrónico').fill('admin@demo.test');
    await page.getByLabel('Contraseña').fill('demo-admin');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL(/\/panel$/);
    await page.getByTestId('panel-content').waitFor();

    for (const width of [390, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);

      const overlapIssues = await page.evaluate(() => {
        const controls = Array.from(document.querySelectorAll('button, a, input, select'));
        const issues = [];
        for (const el of controls) {
          if (el.offsetParent === null) continue; // no visible
          el.scrollIntoView({ block: 'center', inline: 'center' });
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const cx = Math.floor(rect.left + rect.width / 2);
          const cy = Math.floor(rect.top + rect.height / 2);
          const topEl = document.elementFromPoint(cx, cy);
          if (topEl && topEl.tagName && topEl.tagName.toUpperCase().includes('NEXTJS')) {
            continue; // ignora el indicador dev de Turbopack/Next.js
          }
          if (topEl !== el && !el.contains(topEl)) {
            issues.push({
              tag: el.tagName,
              text: el.textContent?.trim().slice(0, 30),
              topElTag: topEl?.tagName,
              topElClass: topEl?.className,
              cx,
              cy,
            });
          }
        }
        return issues;
      });

      if (overlapIssues.length > 0) {
        console.error(`Superposiciones a ${width}px:`, overlapIssues);
        throw new Error(`Controles interactivos superpuestos detectados a ${width}px`);
      }
      console.log(`✓ Sin superposiciones a ${width}px.`);
    }

    await browser.close();
    console.log('✅ Capturas y comprobación de superposición completadas con éxito.');
  } finally {
    if (nextProc) {
      nextProc.kill('SIGTERM');
    }
    if (fakeBackendProc) {
      fakeBackendProc.kill('SIGTERM');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
