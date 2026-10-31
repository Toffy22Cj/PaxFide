// Ref: plan-fase7-puesta-al-dia.md Anexo 1, P-6 (verificación del correo); ADR-050 Enmienda 2; referencia-api-v1.md §1,
// nota del 2026-10-29. Servidor falso: cuentas nuevas sin verificar; las de la semilla, verificadas.
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { acceptLegal, skipWelcome } from './support/evidence';

const API = 'http://localhost:3002';
const PASSWORD = 'clave-demo-larga';
const RESEND = 'Si no llega, revisa el spam o vuelve a pedirlo en 5 minutos';

async function registerUi(page: Page, prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@demo.test`;
  await page.goto('/register');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Repite la contraseña').fill(PASSWORD);
  await acceptLegal(page);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
  return email;
}

async function lastLink(request: APIRequestContext, email: string): Promise<string> {
  return (await (await request.get(`${API}/__test/email-verification/last?email=${encodeURIComponent(email)}`)).json()).link;
}

async function loginForm(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test.describe('P-6 · verificación del correo', () => {
  test('registro → "Revisa tu correo" → login con 403 → enlace → login → /home; sin sesión tras confirmar', async ({ page, request }) => {
    const email = await registerUi(page, 'p6');
    await expect(page.getByTestId('check-email-address')).toHaveText(email);
    await page.getByRole('button', { name: 'Reenviar' }).click();
    await expect(page.getByTestId('resend-sent')).toHaveText(RESEND);

    // Login antes de confirmar: 403 EmailNotVerified; la contraseña no queda en el DOM
    await loginForm(page, email);
    const gate = page.getByTestId('email-not-verified');
    await expect(gate.getByRole('heading', { name: 'Antes de entrar, confirma tu correo' })).toBeVisible();
    expect(await page.content()).not.toContain(PASSWORD);
    await expect(page).toHaveURL(/\/login$/);
    await gate.getByRole('button', { name: 'Reenviar' }).click();
    await expect(gate.getByTestId('resend-sent')).toHaveText(RESEND);

    // El enlace del correo: el token sale de la barra, al login con el aviso y sin sesión
    const link = await lastLink(request, email);
    const token = new URLSearchParams(link.split('#')[1]).get('token')!;
    const confirm = page.waitForRequest((r) => r.url().endsWith('/auth/email-verification/confirm'));
    await page.goto(link);
    expect((await confirm).postDataJSON()).toEqual({ token });
    await expect(page).toHaveURL(/\/login$/);
    expect(page.url()).not.toContain(token);
    await expect(page.getByTestId('login-notice')).toHaveText('Tu correo quedó verificado');
    // Negativa: tras confirmar no queda ninguna sesión
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login$/);

    // Ahora sí entra (cuenta nueva: la bienvenida de U-16 sale en /home)
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await skipWelcome(page);
    await expect(page.getByTestId('home-greeting')).toBeVisible();
  });

  test('/verificar-correo: el token ya no está en la barra; un enlace usado da "El enlace no es válido o caducó" con "Reenviar"', async ({ page, request }) => {
    const email = await registerUi(page, 'p6-usado');
    const link = await lastLink(request, email);
    const token = new URLSearchParams(link.split('#')[1]).get('token')!;
    // Se usa una vez por la API: el enlace queda gastado
    await request.post(`${API}/api/v1/auth/email-verification/confirm`, { data: { token } });
    await page.goto(link);
    await expect(page.getByTestId('verify-invalid')).toHaveText('El enlace no es válido o caducó');
    expect(page.url()).not.toContain(token);
    expect(await page.evaluate(() => location.href)).not.toContain(token);
    // "Reenviar" da el mismo texto exista o no la cuenta
    for (const target of [email, `no-existe-${Date.now()}@demo.test`]) {
      await page.reload();
      await page.getByLabel('Correo electrónico').fill(target);
      await page.getByRole('button', { name: 'Reenviar' }).click();
      await expect(page.getByTestId('resend-sent')).toHaveText(RESEND);
    }
  });

  test('el 403 EmailNotVerified gana a AcceptanceRequired: sin verificar y sin términos, se ve la verificación', async ({ page, request }) => {
    const email = await registerUi(page, 'p6-orden');
    await request.post(`${API}/__test/acceptance-pending`, { data: { email } });
    await loginForm(page, email);
    await expect(page.getByTestId('email-not-verified')).toBeVisible();
    await expect(page.getByTestId('acceptance-required')).toHaveCount(0);
    await expect(page.getByText('Actualizamos nuestras condiciones')).toHaveCount(0);
  });

  test('negativa: una contraseña errónea sigue con el 401 de siempre, sin hablar de verificar', async ({ page }) => {
    const email = await registerUi(page, 'p6-401');
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill('otra-clave-incorrecta');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
    await expect(page.getByTestId('email-not-verified')).toHaveCount(0);
  });

  test('recuperar la contraseña también verifica el correo: tras recuperar se puede entrar', async ({ page, request }) => {
    const email = await registerUi(page, 'p6-recuperar');
    await page.goto('/recuperar');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByTestId('reset-sent')).toBeVisible();
    const { link } = await (await request.get(`${API}/__test/password-reset/last?email=${encodeURIComponent(email)}`)).json();
    await page.goto(link);
    await page.getByLabel('Contraseña nueva', { exact: true }).fill('otra-clave-nueva-123');
    await page.getByLabel('Repite la contraseña').fill('otra-clave-nueva-123');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill('otra-clave-nueva-123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId('email-not-verified')).toHaveCount(0);
  });

  test('Perfil: con emailVerified true, sin aviso; con false, aviso con "Reenviar"', async ({ page, request }) => {
    const email = await registerUi(page, 'p6-perfil');
    const link = await lastLink(request, email);
    await request.post(`${API}/api/v1/auth/email-verification/confirm`, { data: { token: new URLSearchParams(link.split('#')[1]).get('token') } });
    await page.goto('/account');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByTestId('profile-screen')).toBeVisible();
    await expect(page.getByTestId('email-unverified-notice')).toHaveCount(0);
    // Una cuenta anterior a la Enmienda 2 (Q2 (a)) con la sesión todavía abierta
    await request.post(`${API}/__test/unverify`, { data: { email } });
    await page.getByRole('link', { name: 'Inicio' }).first().click();
    await skipWelcome(page);
    await page.getByRole('link', { name: 'Perfil' }).first().click();
    const notice = page.getByTestId('email-unverified-notice');
    await expect(notice).toContainText('Confirma tu correo');
    await notice.getByRole('button', { name: 'Reenviar' }).click();
    await expect(notice.getByTestId('resend-sent')).toHaveText(RESEND);
  });
});
