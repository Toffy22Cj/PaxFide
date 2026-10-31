// Ref: plan-fase7-puesta-al-dia.md P-1 (F-C1 completa + D7) y §1.2 (el servidor falso responde como el real);
// referencia-api-v1.md §1 (notas del 2026-10-25: contraseña, desactivación, perfil y recuperación) y §2 (reactivación).
import { test, expect, type Page, type APIRequestContext, type Request } from '@playwright/test';
import { acceptLegal, skipWelcome, verifyEmailApi } from './support/evidence';

const API = 'http://localhost:3002';
const PASSWORD = 'clave-demo-larga';

async function registerApi(request: APIRequestContext, prefix: string) {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@demo.test`;
  const r = await request.post(`${API}/api/v1/auth/register`, {
    data: { email, password: PASSWORD, acceptedTermsVersion: 'v1-2026-10', acceptedDataPolicyVersion: 'v1-2026-10' },
  });
  const { accountId } = await r.json();
  await verifyEmailApi(request, email); // P-6: la cuenta nace sin verificar
  return { email, accountId: accountId as string };
}

async function loginForm(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

/** Navegación del cliente: la sesión vive en memoria y una recarga la perdería (D2). */
async function go(page: Page, path: string) {
  await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
  await page.evaluate((p) => (window as any).__TEST_ROUTER__.push(p), path);
  await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
}

async function loggedInProfile(page: Page, email: string, password = PASSWORD) {
  await loginForm(page, email, password);
  await expect(page).toHaveURL(/\/home$/);
  await go(page, '/account');
  await expect(page.getByTestId('security-card')).toBeVisible();
}

async function changePassword(page: Page, current: string, next: string) {
  const form = page.getByTestId('change-password-form');
  await form.getByLabel('Contraseña actual').fill(current);
  await form.getByLabel('Contraseña nueva', { exact: true }).fill(next);
  await form.getByLabel('Repite la contraseña nueva').fill(next);
  await form.getByRole('button', { name: 'Cambiar contraseña' }).click();
}

test.describe('P-1: seguridad de la cuenta', () => {
  test('cambiar contraseña: la siguiente petición lleva el token nuevo en la cabecera; la anterior ya no entra', async ({ page, request }) => {
    const { email } = await registerApi(request, 'p1-pass');
    await loggedInProfile(page, email);
    const changed = page.waitForResponse((r) => r.url().endsWith('/account/password'));
    await changePassword(page, PASSWORD, 'clave-nueva-larga-1');
    const { token } = await (await changed).json();
    await expect(page.getByText('Cambiamos tu contraseña. Cerramos tus otras sesiones.')).toBeVisible();
    // La siguiente petición autenticada (cabecera enviada, no el estado)
    const next = page.waitForRequest((r) => r.url().includes('/api/v1/') && !!r.headers()['authorization']);
    await go(page, '/account/donations');
    expect((await next).headers()['authorization']).toBe(`Bearer ${token}`);
    await expect(page).toHaveURL(/\/account\/donations$/);
    // Ninguna contraseña quedó en el navegador
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(stored).not.toContain('clave-nueva-larga-1');
    expect(stored).not.toContain(token);
    const old = await request.post(`${API}/api/v1/auth/login`, { data: { email, password: PASSWORD } });
    expect(old.status()).toBe(401);
  });

  test('CurrentPasswordIncorrect: en el campo, sin cerrar la sesión ni cambiar de token', async ({ page, request }) => {
    const { email } = await registerApi(request, 'p1-bad');
    await loggedInProfile(page, email);
    await changePassword(page, 'otra-cosa-larga', 'clave-nueva-larga-2');
    await expect(page.getByText('La contraseña actual no es correcta.')).toBeVisible();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText('Cambiamos tu contraseña. Cerramos tus otras sesiones.')).toHaveCount(0);
    const ok = await request.post(`${API}/api/v1/auth/login`, { data: { email, password: PASSWORD } });
    expect(ok.status()).toBe(200);
  });

  test('500 tras confirmar: al login con "Tu contraseña cambió; vuelve a iniciar sesión"', async ({ page, request }) => {
    const { email } = await registerApi(request, 'p1-500');
    await request.post(`${API}/__test/password-change-500`, { data: { email } });
    await loggedInProfile(page, email);
    await changePassword(page, PASSWORD, 'clave-nueva-larga-3');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Tu contraseña cambió; vuelve a iniciar sesión.')).toBeVisible();
    await loginForm(page, email, 'clave-nueva-larga-3');
    await expect(page).toHaveURL(/\/home$/);
  });

  test('recuperar: mismo mensaje exista o no la cuenta; el token sale de la barra; luego se entra con la nueva', async ({ page, request }) => {
    const { email } = await registerApi(request, 'p1-reset');
    await page.goto('/login');
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
    await expect(page).toHaveURL(/\/recuperar$/);
    await page.getByLabel('Correo electrónico').fill(`nadie-${Date.now()}@demo.test`);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    const unknown = await page.getByTestId('reset-sent').textContent();
    expect(unknown).toContain('vuelve a pedirlo en 5 minutos');
    await page.goto('/recuperar');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByTestId('reset-sent')).toHaveText(unknown!);

    const { link } = await (await request.get(`${API}/__test/password-reset/last?email=${encodeURIComponent(email)}`)).json();
    const token = link.split('#token=')[1];
    const sentUrls: string[] = [];
    page.on('request', (r) => sentUrls.push(r.url() + ' ' + (r.headers()['referer'] ?? '')));
    await page.goto(link);
    await expect(page.getByLabel('Contraseña nueva')).toBeVisible();
    expect(page.url()).not.toContain(token);
    expect(await page.evaluate(() => location.href)).not.toContain(token);
    // Corto: no consume el token (se corrige y se reenvía)
    await page.getByLabel('Contraseña nueva').fill('corta');
    await page.getByLabel('Repite la contraseña').fill('corta');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByText('La contraseña debe tener al menos 12 caracteres.')).toBeVisible();
    await page.getByLabel('Contraseña nueva').fill('clave-recuperada-1');
    await page.getByLabel('Repite la contraseña').fill('clave-recuperada-1');
    const confirm = page.waitForRequest((r) => r.url().endsWith('/auth/password-reset/confirm'));
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    expect((await confirm).postDataJSON()).toEqual({ token, newPassword: 'clave-recuperada-1' });
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-notice')).toHaveText('Ya puedes entrar con tu contraseña nueva.');
    // El token solo viajó en el cuerpo: nunca en una URL ni en un Referer
    expect(sentUrls.filter((u) => u.includes(token))).toEqual([]);
    await loginForm(page, email, 'clave-recuperada-1');
    await expect(page).toHaveURL(/\/home$/);
  });

  test('recuperar: un enlace ya usado da un único texto y nunca lleva al login', async ({ page }) => {
    await page.goto('/recuperar#token=rst-que-no-existe');
    await expect(page.getByLabel('Contraseña nueva')).toBeVisible();
    expect(page.url()).not.toContain('rst-que-no-existe');
    await page.getByLabel('Contraseña nueva').fill('clave-recuperada-2');
    await page.getByLabel('Repite la contraseña').fill('clave-recuperada-2');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByText(/Este enlace ya no sirve/)).toBeVisible();
    await expect(page).toHaveURL(/\/recuperar$/);
    await expect(page.getByRole('button', { name: 'Pedir un enlace nuevo' })).toBeVisible();
  });

  test('nombre: "¿Cómo te llamamos?" en el paso 3 de la bienvenida; saludo con el nombre; el nombre solo viaja en /account/profile', async ({ page }) => {
    const email = `p1-nombre-${Date.now()}@demo.test`;
    const NAME = `Zoraida${Date.now() % 100000}`;
    const carrying: Request[] = [];
    page.on('request', (r) => {
      const all = r.url() + JSON.stringify(r.headers()) + (r.postData() ?? '');
      if (all.includes(NAME)) carrying.push(r);
    });
    await page.goto('/register');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Repite la contraseña').fill(PASSWORD);
    await acceptLegal(page);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Cuenta creada')).toBeVisible();
    await verifyEmailApi(page.request, email); // P-6: la cuenta nace sin verificar
    await page.getByRole('tab', { name: 'Iniciar sesión' }).click();
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/home$/);
    const welcome = page.getByTestId('welcome-overlay');
    await welcome.getByRole('button', { name: 'Continuar' }).click();
    await welcome.getByRole('button', { name: 'Continuar' }).click();
    const gate = page.getByTestId('welcome-step-3');
    await expect(gate.getByRole('heading', { name: '¿Cómo te llamamos?' })).toBeVisible();
    await expect(gate.getByLabel('Correo de la cuenta')).toHaveValue(email);
    await gate.getByLabel('Nombre').fill(NAME);
    await gate.getByLabel('Apellido').fill('Pérez');
    await gate.getByRole('button', { name: 'Guardar' }).click();
    await expect(welcome).toHaveCount(0);
    await expect(page.getByTestId('home-greeting')).toContainText(`, ${NAME}`);
    await expect(page.getByTestId('home-avatar')).toHaveText(`${NAME[0]}P`.toUpperCase());
    await expect(page.getByTestId('profile-nudge')).toHaveCount(0);
    await go(page, '/account');
    await expect(page.getByTestId('profile-given-name')).toHaveText(NAME);
    await go(page, '/campaigns');
    await go(page, '/home');
    expect(carrying.length).toBeGreaterThan(0);
    expect(carrying.map((r) => `${r.method()} ${new URL(r.url()).pathname}`)).toEqual(
      carrying.map(() => 'PUT /api/v1/account/profile'));
    expect(page.url()).not.toContain(NAME);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(stored).not.toContain(NAME);
  });

  test('sin nombre: "Completa tu perfil" → Perfil → "Editar datos" lo guarda y el aviso desaparece', async ({ page, request }) => {
    const { email } = await registerApi(request, 'p1-nudge');
    await loginForm(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/home$/);
    await skipWelcome(page);
    const nudge = page.getByTestId('profile-nudge');
    await expect(nudge).toBeVisible();
    await nudge.getByRole('link', { name: 'Agregar' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId('profile-given-name')).toHaveText('Sin completar');
    await page.getByRole('button', { name: 'Editar datos' }).click();
    const form = page.getByTestId('profile-name-form');
    await form.getByLabel('Nombre').fill('Ana');
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Guardamos tus datos.')).toBeVisible();
    await expect(page.getByTestId('profile-given-name')).toHaveText('Ana');
    await expect(page.getByTestId('profile-family-name')).toHaveText('Sin completar');
    await go(page, '/home');
    await expect(page.getByTestId('home-greeting')).toContainText(', Ana');
    await expect(page.getByTestId('profile-nudge')).toHaveCount(0);
  });

  test('desactivar: 204 cierra la sesión; ya no entra; la plataforma la reactiva y vuelve a entrar', async ({ page, browser, request }) => {
    const { email, accountId } = await registerApi(request, 'p1-off');
    await loggedInProfile(page, email);
    await page.getByRole('button', { name: 'Desactivar mi cuenta' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Contraseña actual').fill(PASSWORD);
    await dialog.getByRole('button', { name: 'Desactivar' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(/Desactivaste tu cuenta/)).toBeVisible();
    await loginForm(page, email, PASSWORD);
    await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();

    const admin = await (await browser.newContext()).newPage();
    await loginForm(admin, 'plataforma@demo.test', 'demo-plataforma');
    await expect(admin).toHaveURL(/\/home$/);
    await go(admin, '/panel/platform');
    const form = admin.getByTestId('reactivate-form');
    await form.getByLabel(/Cuenta \(identificador\)/).fill('no-existe-esta-cuenta');
    await form.getByRole('button', { name: 'Reactivar' }).click();
    await expect(admin.getByText('No existe esa cuenta.')).toBeVisible();
    await expect(admin.getByText('Cuenta activa')).toHaveCount(0);
    await form.getByLabel(/Cuenta \(identificador\)/).fill(accountId);
    await form.getByRole('button', { name: 'Reactivar' }).click();
    await expect(admin.getByText('Cuenta activa')).toBeVisible();
    await expect(admin.getByText('No existe esa cuenta.')).toHaveCount(0);

    await loginForm(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/home$/);
  });

  test('desactivar como representante: 409 con su texto y la sesión sigue', async ({ page }) => {
    await loggedInProfile(page, 'representante@demo.test', 'demo-representante');
    await page.getByRole('button', { name: 'Desactivar mi cuenta' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Contraseña actual').fill('demo-representante');
    await dialog.getByRole('button', { name: 'Desactivar' }).click();
    await expect(page.getByText(/Representas a tu organización/)).toBeVisible();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId('security-card')).toBeVisible();
  });
});

/**
 * plan-fase7-fidelidad.md §1.4: en el centro de cada control interactivo visible, `elementFromPoint` devuelve ese mismo
 * control (o algo dentro de él). Cada control se lleva al centro de la ventana antes de mirar.
 */
async function overlaps(page: Page, scope: string): Promise<string[]> {
  return page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (!root) return [`sin ${sel}`];
    const bad: string[] = [];
    const controls = [...root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; });
    for (const el of controls) {
      el.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (!hit || !(hit === el || el.contains(hit) || (el.id && hit.closest(`label[for="${el.id}"]`)))) {
        bad.push(`${el.tagName.toLowerCase()}「${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.id).trim().slice(0, 30)}」 tapado por ${hit ? hit.tagName.toLowerCase() + '.' + String(hit.className).slice(0, 40) : 'nada'}`);
      }
    }
    return bad;
  }, scope);
}

test.describe('P-1: sin superposiciones (390, 1280 y 1920 px)', () => {
  for (const width of [390, 1280, 1920]) {
    test(`login, /recuperar, "¿Cómo te llamamos?", inicio con aviso y Perfil a ${width} px`, async ({ page, request }) => {
      await page.setViewportSize({ width, height: 860 });
      await page.goto('/login');
      expect(await overlaps(page, '[data-world-avoid]')).toEqual([]);
      await page.goto('/recuperar');
      await expect(page.getByLabel('Correo electrónico')).toBeVisible();
      expect(await overlaps(page, '[data-testid="recover-screen"]')).toEqual([]);
      await page.goto('/recuperar#token=rst-x');
      await expect(page.getByLabel('Contraseña nueva')).toBeVisible();
      expect(await overlaps(page, '[data-testid="recover-screen"]')).toEqual([]);

      const email = `p1-solape-${width}-${Date.now()}@demo.test`;
      await page.goto('/register');
      await page.getByLabel('Correo electrónico').fill(email);
      await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
      await page.getByLabel('Repite la contraseña').fill(PASSWORD);
      await acceptLegal(page);
      await page.getByRole('button', { name: 'Crear cuenta' }).click();
      await expect(page.getByText('Cuenta creada')).toBeVisible();
      await verifyEmailApi(page.request, email); // P-6: la cuenta nace sin verificar
      await page.getByRole('tab', { name: 'Iniciar sesión' }).click();
      await page.getByLabel('Correo electrónico').fill(email);
      await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
      const welcome = page.getByTestId('welcome-overlay');
      await welcome.getByRole('button', { name: 'Continuar' }).click();
      await welcome.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByTestId('welcome-step-3')).toBeVisible();
      expect(await overlaps(page, '[role="dialog"]')).toEqual([]);
      await page.getByTestId('welcome-step-3').getByRole('button', { name: 'Después' }).click();
      await expect(page.getByTestId('profile-nudge')).toBeVisible();
      await expect(page.getByTestId('panel-portal')).toHaveCount(0);
      expect(await overlaps(page, '[data-testid="profile-nudge"]')).toEqual([]);
      await go(page, '/account');
      await expect(page.getByTestId('security-card')).toBeVisible();
      expect(await overlaps(page, '[data-testid="profile-screen"]')).toEqual([]);
    });
  }
});
