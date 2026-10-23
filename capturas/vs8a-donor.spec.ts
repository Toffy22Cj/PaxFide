// Ref: prompts-agentes-estilo-v2.md §4 (EVIDENCIA); plan-fase7-pantallas.md §1.5 y A-5. Capturas en claro (DF7-17) a
// 390 y 1280 px de /campaigns, /c/:publicCode y /account/donations tras la pasada de estilo.
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');
const API = 'http://localhost:3002';
const shot = async (page: Page, name: string, width: number) => {
  await page.waitForTimeout(900); // la ciudad se mueve: unos fotogramas antes de capturar
  await page.screenshot({ path: path.join(OUT, `vs8a-${name}__claro__${width}.png`), fullPage: true });
};

for (const width of [390, 1280]) {
  test(`vs8a donante ${width}`, async ({ page, request }) => {
    if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
    await page.setViewportSize({ width, height: 860 });
    await page.goto('/campaigns');
    await expect(page.getByTestId('discovery-item').first()).toBeVisible();
    await shot(page, 'campaigns', width);
    await page.goto('/c/01JDEMOPUBLICC0DEMONETARY1');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await shot(page, 'campaign-public', width);
    // Una donación pagada del donante, creada por la API (la captura no repite el flujo de donar)
    const { publicCode } = await (await request.post(`${API}/__test/campaigns`, { data: { title: 'Mercados para adultos mayores' } })).json();
    const { token } = await (await request.post(`${API}/api/v1/auth/login`, { data: { email: 'donante@demo.test', password: 'demo-donante' } })).json();
    const intent = await (await request.post(`${API}/api/v1/public/campaigns/${publicCode}/donation-intents`, {
      headers: { 'Command-Id': crypto.randomUUID(), Authorization: `Bearer ${token}` }, data: { amount: '3000000', currency: 'COP', paymentMethod: 'GATEWAY' },
    })).json();
    await request.post(`${API}/__test/payments`, { data: { intentId: intent.intentId } });
    await page.goto('/account/donations');
    await page.getByLabel('Correo electrónico').fill('donante@demo.test');
    await page.getByLabel('Contraseña').fill('demo-donante');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/account\/donations$/);
    await expect(page.getByTestId('account-donation').first()).toBeVisible();
    await shot(page, 'account-donations', width);
  });
}
