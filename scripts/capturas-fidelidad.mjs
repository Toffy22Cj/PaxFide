#!/usr/bin/env node
// Ref: Documentos/plan-fase7-fidelidad.md §1 (Punto 2) y §4 F-A1.
// Capturas lado a lado del boceto y de la app en Documentos/evidencia-web/capturas/fidelidad/<pantalla>/
// Abre el boceto como file:// sin red y la app contra el servidor local.
// Uso: node scripts/capturas-fidelidad.mjs [pantalla]

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

const targetScreen = process.argv[2] || 'landing';
const outDir = path.join(ROOT, 'Documentos', 'evidencia-web', 'capturas', 'fidelidad', targetScreen);
fs.mkdirSync(outDir, { recursive: true });

async function captureLanding(browser) {
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

async function main() {
  console.log(`=== Generador de Capturas de Fidelidad: ${targetScreen} ===`);
  const browser = await chromium.launch(launchOptions);
  try {
    if (targetScreen === 'landing') {
      await captureLanding(browser);
    } else {
      console.error(`Pantalla desconocida: ${targetScreen}`);
      process.exit(1);
    }
    console.log(`=== Capturas de fidelidad generadas exitosamente en: ${outDir} ===`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[capturas-fidelidad] Error:', err);
  process.exit(1);
});
