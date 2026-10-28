// Ref: plan-fase7-puesta-al-dia.md P-3 (F-C3); referencia-api-v1.md §3 (G-6, G-7, G-8, G-9). Contra el servidor falso.
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:3002';

/** Una donación pagada a una convocatoria de org-1 en el doble del backend: da un fondo con fecha de liquidación. */
async function paidDonation(request: APIRequestContext) {
  const { publicCode } = await (await request.post(`${API}/__test/campaigns`, { data: { title: 'Convocatoria P-3' } })).json();
  const intent = await (await request.post(`${API}/api/v1/public/campaigns/${publicCode}/donation-intents`, {
    headers: { 'Command-Id': crypto.randomUUID() }, data: { amount: '2500000', currency: 'COP', paymentMethod: 'GATEWAY' },
  })).json();
  await request.post(`${API}/__test/payments`, { data: { intentId: intent.intentId } });
}

async function loginPanel(page: Page, email: string, password: string) {
  await page.goto('/panel');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test.describe('P-3: datos de tiempo del panel', () => {
  test('administrador: "Recaudado en <mes>" con su serie, "Integridad" y "Actividad reciente"', async ({ page, request }) => {
    await paidDonation(request);
    const paths: string[] = [];
    page.on('request', (r) => paths.push(new URL(r.url()).pathname));
    await loginPanel(page, 'admin@demo.test', 'demo-admin');
    const month = new Intl.DateTimeFormat('es', { month: 'long', timeZone: 'America/Bogota' }).format(new Date());
    await expect(page.getByTestId('kpi-monthly')).toContainText(`Recaudado en ${month}`);
    await expect(page.getByTestId('kpi-monthly').getByTestId('kpi-sparkline').first()).toBeVisible();
    await expect(page.getByTestId('kpi-integrity')).toBeVisible();
    await expect(page.getByTestId('panel-activity')).toBeVisible();
    expect(paths.some((p) => p.endsWith('/organizations/org-1/integrity'))).toBe(true);
    expect(paths.some((p) => p.endsWith('/organizations/org-1/funds/monthly'))).toBe(true);
  });

  test('empleado: nunca pide la integridad (negativa); la tabla de lotes tiene "Último cambio"', async ({ page }) => {
    const paths: string[] = [];
    page.on('request', (r) => paths.push(new URL(r.url()).pathname));
    await loginPanel(page, 'empleado@demo.test', 'demo-empleado');
    await page.getByRole('button', { name: 'Registrar activo' }).click();
    await page.getByLabel('Tipo de bien').fill('Mercado');
    await page.getByLabel('Cantidad').fill('3');
    await page.getByLabel('Unidad de medida').fill('kit');
    await page.getByLabel('Custodio (referencia)').fill('BODEGA-1');
    await page.getByLabel('Ubicación actual').fill('Bodega central');
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page).toHaveURL(/\/assets\//);
    await page.evaluate(() => (window as any).__TEST_ROUTER__.push('/panel'));
    await expect(page.getByTestId('panel-activity').getByTestId('activity-item').first()).toBeVisible();
    await page.evaluate(() => (window as any).__TEST_ROUTER__.push('/panel/assets'));
    await expect(page.getByRole('columnheader', { name: 'Último cambio' })).toBeVisible();
    await expect(page.getByTestId('org-asset-last-change').first().locator('time')).toBeVisible();
    expect(paths.some((p) => p.endsWith('/integrity'))).toBe(false);
    await expect(page.getByTestId('kpi-integrity')).toHaveCount(0);
  });
});
