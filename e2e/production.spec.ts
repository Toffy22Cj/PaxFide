import { test, expect } from '@playwright/test';

test.describe('Production build (Rule 7)', () => {
  test('does not expose __TEST_SESSION__ or __TEST_ROUTER__ backdoors', async ({ page }) => {
    await page.goto('/');
    
    // Check if it's exposed
    const isSessionExposed = await page.evaluate(() => {
      return !!(window as any).__TEST_SESSION__;
    });
    const isRouterExposed = await page.evaluate(() => {
      return !!(window as any).__TEST_ROUTER__;
    });

    expect(isSessionExposed).toBe(false);
    expect(isRouterExposed).toBe(false);
  });
});

// U-27 (plan-fase7-puesta-al-dia.md Anexo 4, P-13): el build normal, sin perfil, activa la lista única (la de demo)
test.describe('Build normal sin perfil (U-27)', () => {
  test('/login, /campaigns y /verificar-correo existen', async ({ page }) => {
    for (const path of ['/login', '/campaigns', '/verificar-correo']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByText('No encontramos esta página.'), path).toHaveCount(0);
    }
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
    await page.goto('/verificar-correo');
    await expect(page.getByRole('heading', { name: 'Confirmar tu correo' })).toBeVisible();
  });

  test('negativas: /tracking/x y /panel/platform/x siguen dando 404', async ({ page }) => {
    for (const path of ['/tracking/x', '/panel/platform/x']) {
      await page.goto(path);
      await expect(page.getByText('No encontramos esta página.'), path).toBeVisible();
    }
  });
});

// Comprobación de despliegue 2b-a (Documentos/despliegue-web.md; despliegue-backend-2026-10.md §2): con el build normal,
// los tres enlaces de los correos del backend ({TRACEABILITY_WEB_BASE_URL}/verificar-correo#token=…, /recuperar#token=…
// e /invitaciones#token=…) abren su pantalla y el token sale de la barra. El servidor falso hace de buzón (como Mailpit).
test.describe('Enlaces de los correos con el build normal (2b-a)', () => {
  const API = 'http://localhost:3002';
  const tokenOf = (link: string) => new URLSearchParams(link.split('#')[1]).get('token')!;

  test('verificar el correo: /verificar-correo#token=… confirma y lleva al login', async ({ page, request }) => {
    const email = `deploy-verif-${Date.now()}@demo.test`;
    await request.post(`${API}/api/v1/auth/register`, {
      data: { email, password: 'clave-demo-larga', acceptedTermsVersion: 'v1-2026-10', acceptedDataPolicyVersion: 'v1-2026-10' },
    });
    const { link } = await (await request.get(`${API}/__test/email-verification/last?email=${encodeURIComponent(email)}`)).json();
    expect(link).toMatch(/^\/verificar-correo#token=/);
    await page.goto(link);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-notice')).toHaveText('Tu correo quedó verificado');
    expect(page.url()).not.toContain(tokenOf(link));
  });

  test('recuperar la contraseña: /recuperar#token=… pide la contraseña nueva', async ({ page, request }) => {
    const email = 'donante@demo.test';
    await request.post(`${API}/api/v1/auth/password-reset`, { data: { email } });
    const { link } = await (await request.get(`${API}/__test/password-reset/last?email=${encodeURIComponent(email)}`)).json();
    expect(link).toMatch(/^\/recuperar#token=/);
    await page.goto(link);
    await expect(page.getByLabel('Contraseña nueva', { exact: true })).toBeVisible();
    expect(page.url()).not.toContain(tokenOf(link));
  });

  test('aceptar una invitación: /invitaciones#token=… abre la invitación', async ({ page, request }) => {
    const email = `deploy-inv-${Date.now()}@demo.test`;
    const { token } = await (await request.post(`${API}/api/v1/auth/login`, { data: { email: 'admin@demo.test', password: 'demo-admin' } })).json();
    const r = await request.post(`${API}/api/v1/organizations/org-1/invitations`, {
      data: { email, role: 'EMPLOYEE' }, headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.status()).toBe(202);
    const { link } = await (await request.get(`${API}/__test/invitations/last?email=${encodeURIComponent(email)}`)).json();
    expect(link).toMatch(/^\/invitaciones#token=/);
    await page.goto(link);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Invitación a una organización');
    await expect(page.getByText('No encontramos esta página.')).toHaveCount(0);
    expect(page.url()).not.toContain(tokenOf(link));
  });
});
