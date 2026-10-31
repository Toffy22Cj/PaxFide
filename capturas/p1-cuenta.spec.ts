// Ref: plan-fase7-puesta-al-dia.md §1.1 (capturas en claro y oscuro a 390 y 1280 px) y P-1: "¿Olvidaste tu
// contraseña?", /recuperar, "¿Cómo te llamamos?", el saludo con nombre, el Perfil con "Seguridad" y "Reactivar una cuenta".
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { acceptLegal } from '../e2e/support/evidence';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');
const API = 'http://localhost:3002';
const PASSWORD = 'clave-demo-larga';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}
async function go(page: Page, to: string) {
  await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
  await page.evaluate((p) => (window as any).__TEST_ROUTER__.push(p), to);
  await expect(page).toHaveURL(new RegExp(`${to.replace(/\//g, '\\/')}$`));
  await expect(page.getByTestId('panel-portal')).toHaveCount(0);
}

for (const width of [390, 1280]) {
  for (const [scheme, tema] of [['light', 'claro'], ['dark', 'oscuro']] as const) {
    test(`p1 ${tema} ${width}`, async ({ page, request, browser }) => {
      if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
      test.setTimeout(150_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      const shot = (p: Page, name: string, fullPage = true) =>
        p.screenshot({ path: path.join(OUT, `p1-${name}__${tema}__${width}.png`), fullPage });

      // Login con "¿Olvidaste tu contraseña?" y /recuperar
      await page.goto('/login');
      await expect(page.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toBeVisible();
      await shot(page, 'login-olvido');
      await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
      await page.getByLabel('Correo electrónico').fill('nadie@demo.test');
      await shot(page, 'recuperar-correo');
      await page.getByRole('button', { name: 'Enviar enlace' }).click();
      await expect(page.getByTestId('reset-sent')).toBeVisible();
      await page.waitForTimeout(400); // termina la entrada del aviso
      await shot(page, 'recuperar-enviado');
      await page.goto('/recuperar#token=rst-captura');
      await page.getByLabel('Contraseña nueva').fill('una-clave-Larga-2026');
      await shot(page, 'recuperar-nueva');
      await page.getByLabel('Repite la contraseña').fill('una-clave-Larga-2026');
      await page.getByRole('button', { name: 'Guardar contraseña' }).click();
      await expect(page.getByText(/Este enlace ya no sirve/)).toBeVisible();
      await page.waitForTimeout(400);
      await shot(page, 'recuperar-invalido');

      // "¿Cómo te llamamos?" tras la bienvenida
      const email = `captura-p1-${width}-${tema}-${Date.now()}@demo.test`;
      await page.goto('/register');
      await page.getByLabel('Correo electrónico').fill(email);
      await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
      await page.getByLabel('Repite la contraseña').fill(PASSWORD);
      await acceptLegal(page);
      await page.getByRole('button', { name: 'Crear cuenta' }).click();
      await expect(page.getByText('Cuenta creada')).toBeVisible();
      await page.getByRole('tab', { name: 'Iniciar sesión' }).click();
      await page.getByLabel('Correo electrónico').fill(email);
      await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
      await page.getByTestId('welcome-gate').getByRole('button', { name: 'Continuar' }).click();
      const gate = page.getByTestId('name-gate');
      await expect(gate.getByLabel('Correo de la cuenta')).toHaveValue(email);
      await gate.getByLabel('Nombre').fill('Laura');
      await gate.getByLabel('Apellido').fill('Gómez');
      await shot(page, 'como-te-llamamos');
      await gate.getByRole('button', { name: 'Guardar y continuar' }).click();
      await expect(page).toHaveURL(/\/home$/);
      await expect(page.getByTestId('home-greeting')).toContainText(', Laura');
      await expect(page.getByTestId('panel-portal')).toHaveCount(0);
      await page.waitForTimeout(600);
      await shot(page, 'home-nombre', false);

      // Perfil con "Tus datos" y "Seguridad"
      await go(page, '/account');
      await expect(page.getByTestId('profile-given-name')).toHaveText('Laura');
      await page.waitForTimeout(400);
      await shot(page, 'perfil-seguridad');
      const form = page.getByTestId('change-password-form');
      await form.getByLabel('Contraseña actual').fill('otra-cosa-larga');
      await form.getByLabel('Contraseña nueva', { exact: true }).fill('clave-nueva-larga-1');
      await form.getByLabel('Repite la contraseña nueva').fill('clave-nueva-larga-1');
      await form.getByRole('button', { name: 'Cambiar contraseña' }).click();
      await expect(page.getByText('La contraseña actual no es correcta.')).toBeVisible();
      await form.scrollIntoViewIfNeeded();
      await shot(page, 'perfil-contrasena-incorrecta');
      await page.getByRole('button', { name: 'Desactivar mi cuenta' }).click();
      await page.getByRole('dialog').getByLabel('Contraseña actual').fill('x');
      await shot(page, 'perfil-desactivar', false); // con un modal abierto, solo la ventana

      // Sin nombre: "Completa tu perfil"
      const plain = `captura-p1b-${width}-${tema}-${Date.now()}@demo.test`;
      await request.post(`${API}/api/v1/auth/register`, { data: { email: plain, password: PASSWORD, acceptedTermsVersion: 'v1-2026-10', acceptedDataPolicyVersion: 'v1-2026-10' } });
      const other = await (await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme })).newPage();
      await login(other, plain, PASSWORD);
      await expect(other.getByTestId('profile-nudge')).toBeVisible();
      await expect(other.getByTestId('panel-portal')).toHaveCount(0);
      await other.waitForTimeout(600);
      await shot(other, 'home-completa-perfil', false);
      await other.context().close();

      // Plataforma: "Reactivar una cuenta"
      const admin = await (await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme })).newPage();
      await login(admin, 'plataforma@demo.test', 'demo-plataforma');
      await expect(admin).toHaveURL(/\/home$/);
      await admin.waitForTimeout(800);
      await go(admin, '/panel/platform');
      const re = admin.getByTestId('reactivate-form');
      await re.getByLabel(/Cuenta \(identificador\)/).fill('no-existe');
      await re.getByRole('button', { name: 'Reactivar' }).click();
      await expect(admin.getByText('No existe esa cuenta.')).toBeVisible();
      await re.scrollIntoViewIfNeeded();
      await shot(admin, 'plataforma-reactivar', false); // la cabecera fija se repetiría a media página
      await admin.context().close();
    });
  }
}
