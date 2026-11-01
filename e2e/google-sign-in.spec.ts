// Ref: plan-fase7-puesta-al-dia.md Anexo 6 (G-W1 a G-W9) y A6.2; referencia-api-v1.md, nota del 2026-10-31 (ADR-050
// D9). El E2E nunca sale a Google: el build usa el doble de Google Identity Services del servidor falso
// (NEXT_PUBLIC_E2E_GIS_URL) y los idToken de prueba son `fake-google.<sub>.<correo>`.
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { skipWelcome, verifyEmailApi } from './support/evidence';

const API = 'http://localhost:3002';
const PASSWORD = 'clave-demo-larga';
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

async function registerApi(request: APIRequestContext, prefix: string) {
  const email = `${prefix}-${unique()}@demo.test`;
  await request.post(`${API}/api/v1/auth/register`, {
    data: { email, password: PASSWORD, acceptedTermsVersion: 'v1-2026-10', acceptedDataPolicyVersion: 'v1-2026-10' },
  });
  await verifyEmailApi(request, email);
  return email;
}

/** El credential que entregará el siguiente clic en el botón (doble) de Google. */
async function nextGoogleCredential(page: Page, credential: string) {
  await page.evaluate((c) => { (window as any).__gisNextCredential = c; }, credential);
}

/** El aviso de la pantalla (no el anunciador de rutas de Next, que también es `role="alert"`). */
const alert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

async function go(page: Page, path: string) {
  await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
  await page.evaluate((p) => (window as any).__TEST_ROUTER__.push(p), path);
  await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
}

test.describe('P-16: Google en la web', () => {
  test('recorrido: vincular en Seguridad → entrar con Google → desvincular → Google ya no entra', async ({ page, request }) => {
    const email = await registerApi(request, 'p16-g');
    const credential = `fake-google.sub${unique()}.${email}`;

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await skipWelcome(page);
    await go(page, '/account');

    const block = page.getByTestId('google-link-block');
    await block.getByRole('button', { name: 'Vincular Google', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('google-link-needs-password')).toBeVisible();
    await expect(dialog.getByTestId('gis-stub-button')).toHaveCount(0);
    await dialog.getByLabel('Contraseña actual').fill(PASSWORD);
    await nextGoogleCredential(page, credential);
    const linked = page.waitForRequest((r) => r.url().endsWith('/account/google/link') && r.method() === 'POST');
    await dialog.getByTestId('gis-stub-button').click();
    expect((await linked).postDataJSON()).toEqual({ idToken: credential, currentPassword: PASSWORD });
    await expect(page.getByText('Vinculamos tu cuenta de Google. Ya puedes entrar con ella.')).toBeVisible();

    // Una recarga cierra la sesión (vive en memoria, D2): se entra con Google
    await page.goto('/login');
    await nextGoogleCredential(page, credential);
    const signIn = page.waitForRequest((r) => r.url().endsWith('/auth/google'));
    await page.getByTestId('google-sign-in').getByTestId('gis-stub-button').click();
    expect((await signIn).postDataJSON()).toEqual({ idToken: credential });
    await expect(page).toHaveURL(/\/home$/);

    await go(page, '/account');
    await page.getByTestId('google-link-block').getByRole('button', { name: 'Desvincular Google' }).click();
    await page.getByRole('dialog').getByLabel('Contraseña actual').fill(PASSWORD);
    await page.getByRole('dialog').getByRole('button', { name: 'Desvincular', exact: true }).click();
    await expect(page.getByText('Listo. Si tenías una cuenta de Google vinculada, ya no podrás entrar con ella.')).toBeVisible();

    await page.goto('/login');
    await nextGoogleCredential(page, credential);
    await page.getByTestId('google-sign-in').getByTestId('gis-stub-button').click();
    await expect(alert(page)).toContainText('No pudimos entrar con Google.');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('una cuenta de Google sin vincular: el 401 de siempre, sin revelar el motivo; un 503 ofrece la contraseña', async ({ page, request }) => {
    await page.goto('/login');
    await nextGoogleCredential(page, `fake-google.nadie${unique()}.nadie@demo.test`);
    await page.getByTestId('google-sign-in').getByTestId('gis-stub-button').click();
    await expect(alert(page)).toHaveText('No pudimos entrar con Google. Si aún no vinculaste tu cuenta de Google, entra con tu correo y contraseña y vincúlala en Configuración › Seguridad.');

    await request.post(`${API}/__test/google-unavailable`);
    await page.getByTestId('google-sign-in').getByTestId('gis-stub-button').click();
    await expect(alert(page)).toHaveText('Google no responde ahora. Entra con tu correo y contraseña.');
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  });

  test('esa cuenta de Google ya está en otra cuenta → 409 GoogleAccountAlreadyLinked con su texto', async ({ page, request }) => {
    const first = await registerApi(request, 'p16-a');
    const second = await registerApi(request, 'p16-b');
    const credential = `fake-google.sub${unique()}.${first}`;
    const login = await request.post(`${API}/api/v1/auth/login`, { data: { email: first, password: PASSWORD } });
    const { token } = await login.json();
    const r = await request.post(`${API}/api/v1/account/google/link`, {
      headers: { Authorization: `Bearer ${token}` }, data: { idToken: credential, currentPassword: PASSWORD },
    });
    expect(r.status()).toBe(204);

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(second);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await skipWelcome(page);
    await go(page, '/account');
    await page.getByTestId('google-link-block').getByRole('button', { name: 'Vincular Google', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Contraseña actual').fill(PASSWORD);
    await nextGoogleCredential(page, credential);
    await page.getByRole('dialog').getByTestId('gis-stub-button').click();
    await expect(page.getByText('Esa cuenta de Google ya está vinculada a otra cuenta de PaxFide.')).toBeVisible();
  });

  test('G-W2 (negativa): la portada, una convocatoria pública y "Crear cuenta" no cargan el script de Google', async ({ page }) => {
    const google: string[] = [];
    page.on('request', (r) => {
      const u = r.url();
      if (u.includes('accounts.google.com') || u.includes('/__test/gsi-client.js')) google.push(u);
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.goto('/c/01JDEMOPUBLICC0DEMONETARY1');
    await page.waitForLoadState('networkidle');
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('google-button')).toHaveCount(0);
    expect(google).toEqual([]);
    // Y en el acceso, una sola carga del doble y nunca accounts.google.com
    await page.goto('/login');
    await expect(page.getByTestId('gis-stub-button')).toBeVisible();
    expect(google.filter((u) => u.includes('accounts.google.com'))).toEqual([]);
    expect(await page.evaluate(() => (window as any).__gisLoads)).toBe(1);
  });
});
