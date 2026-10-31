// Ref: plan-fase7-puesta-al-dia.md §1.1 (sin boceto: capturas en claro y oscuro a 390 y 1280 px) y P-0: la
// re-aceptación del login (U-2), crear organización con su casilla (R-3) y la entrega con foto (U-3).
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { acceptLegal, attachDeliveryPhoto } from '../e2e/support/evidence';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');
const API = 'http://localhost:3002';

async function newAccount(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo-larga');
  await page.getByLabel('Repite la contraseña').fill('clave-demo-larga');
  await acceptLegal(page);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Cuenta creada')).toBeVisible();
}
async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

for (const width of [390, 1280]) {
  for (const [scheme, tema] of [['light', 'claro'], ['dark', 'oscuro']] as const) {
    test(`p0 ${tema} ${width}`, async ({ page, request, browser }) => {
      if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      // Con un modal abierto, la captura de página completa sale en blanco: solo la ventana
      const shot = (name: string, fullPage = true) => page.screenshot({ path: path.join(OUT, `p0-${name}__${tema}__${width}.png`), fullPage });

      // Registro con las dos casillas
      await page.goto('/register');
      await page.getByLabel('Correo electrónico').fill('nueva@demo.test');
      await expect(page.getByTestId('consent-terms')).toBeVisible();
      await shot('registro-casillas');

      // Re-aceptación del login
      const email = `captura-${width}-${tema}-${Date.now()}@demo.test`;
      await newAccount(page, email);
      await request.post(`${API}/__test/acceptance-pending`, { data: { email } });
      await login(page, email, 'clave-demo-larga');
      await expect(page.getByTestId('acceptance-required')).toBeVisible();
      await shot('login-aceptacion');
      await acceptLegal(page.getByTestId('acceptance-required'));
      await page.getByRole('button', { name: 'Aceptar y entrar' }).click();
      await expect(page).not.toHaveURL(/\/login$/);

      // Crear organización con la casilla de sus términos (otra pestaña: una cuenta nueva, creada por la API)
      const orgEmail = `captura-org-${width}-${tema}-${Date.now()}@demo.test`;
      await request.post(`${API}/api/v1/auth/register`, { data: { email: orgEmail, password: 'clave-demo-larga', acceptedTermsVersion: 'v1-2026-10', acceptedDataPolicyVersion: 'v1-2026-10' } });
      const org = await (await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme })).newPage();
      await login(org, orgEmail, 'clave-demo-larga');
      await expect(org).toHaveURL(/\/home$/);
      await org.waitForTimeout(800); // sin cruzar la navegación del login con la siguiente
      await org.evaluate(() => (window as unknown as { __TEST_ROUTER__: { push: (p: string) => void } }).__TEST_ROUTER__.push('/panel/organization'));
      await org.getByRole('button', { name: 'Crear organización' }).click();
      await org.getByRole('dialog').getByLabel('Nombre').fill('Fundación de la captura');
      await expect(org.getByRole('dialog').getByTestId('consent-organizationTerms')).toBeVisible();
      await expect(org.getByTestId('panel-portal')).toHaveCount(0); // el portal del panel (D-F7) ya terminó
      await org.screenshot({ path: path.join(OUT, `p0-organizacion-terminos__${tema}__${width}.png`) });
      await org.context().close();

      // Entrega con foto (empleado)
      await page.goto('/panel');
      await page.getByLabel('Correo electrónico').fill('empleado@demo.test');
      await page.getByLabel('Contraseña').fill('demo-empleado');
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
      await expect(page).toHaveURL(/\/panel$/);
      await page.getByRole('button', { name: 'Registrar activo' }).click();
      await page.getByLabel('Tipo de bien').fill('Mercado');
      await page.getByLabel('Cantidad').fill('3');
      await page.getByLabel('Unidad de medida').fill('kit');
      await page.getByLabel('Custodio (referencia)').fill('BODEGA-1');
      await page.getByLabel('Ubicación actual').fill('Bodega central');
      await page.getByRole('button', { name: 'Registrar' }).click();
      await expect(page).toHaveURL(/\/assets\//);
      await page.getByRole('button', { name: 'Despachar', exact: true }).click();
      await page.getByRole('dialog').getByLabel('Transportista (referencia)').fill('TRANS-1');
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
      await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Despachado');
      await page.getByRole('button', { name: 'Entregar', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Custodio final (referencia)').fill('ALIADO-1');
      await dialog.getByLabel('Beneficiario (referencia)').fill('BEN-1');
      await dialog.getByLabel('Lugar de entrega (referencia)').fill('LUGAR-1');
      await attachDeliveryPhoto(dialog);
      await shot('entrega-foto', false);
      await request.post(`${API}/__test/evidence-fail`, { data: { status: 410 } });
      await dialog.getByRole('button', { name: 'Confirmar' }).click();
      await expect(dialog.getByText('La plataforma retiró esta foto. Toma una nueva.')).toBeVisible();
      await shot('entrega-foto-retirada', false);
    });
  }
}
