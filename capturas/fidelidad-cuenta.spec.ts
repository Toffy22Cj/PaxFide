// Ref: Documentos/plan-fase7-fidelidad.md §1 (punto 2: capturas lado a lado) y F-C1; plan-fase7-puesta-al-dia.md P-1.
// Boceto (paxfide-home.html, sin red) y app (servidor falso) en el mismo estado: "¿Cómo te llamamos?", inicio sin
// nombre ("Completa tu perfil"), inicio con nombre y Perfil. Claro y oscuro, 390 y 1280 px.
import { test, expect, type Browser, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { acceptLegal } from '../e2e/support/evidence';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'Documentos', 'evidencia-web', 'capturas', 'fidelidad', 'cuenta');
const API = 'http://localhost:3002';
const PASSWORD = 'clave-demo-larga';
type State = 'como-te-llamamos' | 'home-sin-nombre' | 'home-con-nombre' | 'perfil';
const STATES: State[] = ['como-te-llamamos', 'home-sin-nombre', 'home-con-nombre', 'perfil'];

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); });

async function sketch(browser: Browser, state: State, width: number, scheme: 'light' | 'dark', file: string) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
  const page = await ctx.newPage();
  const named = state === 'home-con-nombre' || state === 'perfil';
  // El boceto guarda su estado de demostración en localStorage (`pxf.*`); se usa su propio flujo (botones)
  await page.addInitScript((n) => {
    try { localStorage.clear(); if (n) { localStorage.setItem('pxf.prof', 'full'); } } catch {}
  }, named);
  await page.goto(`file://${path.join(ROOT, 'Documentos', 'paxfide-home.html')}`, { waitUntil: 'load' });
  await page.click('#wGo');
  if (state === 'como-te-llamamos') {
    await page.fill('#gName', 'Laura');
    await page.fill('#fName', 'Gómez');
  } else {
    if (!named) await page.click('#dSkip');
    if (state === 'perfil') await page.click('#navItems [data-k="profile"]');
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: file, fullPage: false });
  await ctx.close();
}

async function app(browser: Browser, state: State, width: number, scheme: 'light' | 'dark', file: string, request: any) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.addInitScript((dark) => { try { localStorage.setItem('paxfide.world-mode', dark ? 'night' : 'day'); } catch {} }, scheme === 'dark');
  const email = `fid-${state}-${width}-${scheme}-${Date.now()}@demo.test`;
  if (state === 'como-te-llamamos') {
    await page.goto('/register');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Repite la contraseña').fill(PASSWORD);
    await acceptLegal(page);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Cuenta creada')).toBeVisible();
    await page.getByRole('tab', { name: 'Iniciar sesión' }).click();
  } else {
    await request.post(`${API}/api/v1/auth/register`, { data: { email, password: PASSWORD, acceptedTermsVersion: 'v1-2026-10', acceptedDataPolicyVersion: 'v1-2026-10' } });
    if (state !== 'home-sin-nombre') {
      const { token } = await (await request.post(`${API}/api/v1/auth/login`, { data: { email, password: PASSWORD } })).json();
      await request.put(`${API}/api/v1/account/profile`, { headers: { Authorization: `Bearer ${token}` }, data: { givenName: 'Laura', familyName: 'Gómez' } });
    }
    await page.goto('/login');
  }
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  if (state === 'como-te-llamamos') {
    await page.getByTestId('welcome-gate').getByRole('button', { name: 'Continuar' }).click();
    await page.getByTestId('name-gate').getByLabel('Nombre').fill('Laura');
    await page.getByTestId('name-gate').getByLabel('Apellido').fill('Gómez');
  } else {
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId('panel-portal')).toHaveCount(0);
    if (state === 'perfil') {
      await page.evaluate(() => (window as any).__TEST_ROUTER__.push('/account'));
      await expect(page.getByTestId('security-card')).toBeVisible();
    } else if (state === 'home-sin-nombre') {
      await expect(page.getByTestId('profile-nudge')).toBeVisible();
    } else {
      await expect(page.getByTestId('home-greeting')).toContainText(', Laura');
    }
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: file, fullPage: false });
  await ctx.close();
}

for (const state of STATES) {
  for (const width of [390, 1280]) {
    for (const scheme of ['light', 'dark'] as const) {
      const tema = scheme === 'light' ? 'claro' : 'oscuro';
      test(`fidelidad ${state} ${tema} ${width}`, async ({ browser, request }) => {
        if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
        test.setTimeout(90_000);
        await sketch(browser, state, width, scheme, path.join(OUT, `${state}__boceto__${tema}__${width}.png`));
        await app(browser, state, width, scheme, path.join(OUT, `${state}__app__${tema}__${width}.png`), request);
      });
    }
  }
}
