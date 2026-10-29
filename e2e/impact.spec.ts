// Ref: plan-fase7-puesta-al-dia.md Anexo 1, P-7 ("Mi impacto" como tarjeta en /home y en /account; sin ruta propia).
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import crypto from 'crypto';

const API = 'http://localhost:3002';
const PASSWORD = 'clave-demo-larga';

async function freshAccount(request: APIRequestContext) {
  const email = `impacto-${crypto.randomUUID().slice(0, 8)}@demo.test`;
  await request.post(`${API}/api/v1/auth/register`, {
    data: { email, password: PASSWORD, acceptedTermsVersion: 'v1-2026-10', acceptedDataPolicyVersion: 'v1-2026-10' },
  });
  const { token } = await (await request.post(`${API}/api/v1/auth/login`, { data: { email, password: PASSWORD } })).json();
  return { email, token: token as string };
}

async function loginAt(page: Page, path: string, email: string) {
  await page.goto(path);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

test('P-7: sin donaciones, el estado vacío; con una confirmada, la tarjeta en /home y en /account', async ({ page, request }) => {
  const { email, token } = await freshAccount(request);
  await loginAt(page, '/home', email);
  const card = page.getByTestId('impact-card');
  await expect(card.getByText('Aún no tienes donaciones confirmadas')).toBeVisible();
  await expect(card.getByRole('link', { name: 'Explorar convocatorias' })).toHaveAttribute('href', '/campaigns');
  await expect(card).not.toContainText('0');

  const { publicCode } = await (await request.post(`${API}/__test/campaigns`, { data: { title: 'Impacto E2E' } })).json();
  const r = await request.post(`${API}/api/v1/public/campaigns/${publicCode}/donation-intents`, {
    data: { amount: '5000000', currency: 'COP', paymentMethod: 'GATEWAY' },
    headers: { 'Command-Id': crypto.randomUUID(), Authorization: `Bearer ${token}` },
  });
  await request.post(`${API}/__test/payments`, { data: { intentId: (await r.json()).intentId } });

  // Recargar pierde la sesión en memoria (D2): se vuelve a entrar
  await loginAt(page, '/home', email);
  await expect(card.getByTestId('impact-totals')).toHaveText('50.000 COP');
  await expect(card.getByTestId('impact-donations')).toHaveText('1 donación confirmada');
  await expect(card.getByTestId('impact-campaigns')).toHaveText('1 convocatoria apoyada');
  await expect(card).not.toContainText(/tus unidades|entregaste/i);

  await page.getByRole('link', { name: 'Perfil' }).first().click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId('impact-card').getByTestId('impact-totals')).toHaveText('50.000 COP');
});

test('P-7: si /account/impact falla, el resto del inicio sigue visible', async ({ page, request }) => {
  const { email } = await freshAccount(request);
  await page.route('**/api/v1/account/impact', (route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{"title":"ServiceUnavailable","status":503}' }));
  await loginAt(page, '/home', email);
  await expect(page.getByTestId('impact-card').getByRole('button', { name: 'Reintentar' })).toBeVisible();
  await expect(page.getByTestId('home-greeting')).toBeVisible();
  await expect(page.getByTestId('home-donations')).toBeVisible();
});

test('P-7: la web no tiene la ruta /account/impact (404, D5)', async ({ page }) => {
  const res = await page.goto('/account/impact');
  expect(res?.status()).toBe(404);
});
