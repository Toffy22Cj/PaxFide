import { test, expect, Page, Browser, APIRequestContext } from '@playwright/test';
import crypto from 'crypto';

const API = 'http://localhost:3002';

async function login(browser: Browser, email: string, password: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
  return page;
}

/** El test hace de donante y de proveedor de pago (DW-30): una donación con fondos aplicados → un fondo. */
async function fundedDonation(request: APIRequestContext): Promise<string> {
  const r = await request.post(`${API}/api/v1/public/campaigns/01JDEMOPUBLICC0DEMONETARY1/donation-intents`, {
    data: { amount: '5000000', currency: 'COP', paymentMethod: 'GATEWAY' }, headers: { 'Command-Id': crypto.randomUUID() },
  });
  const { intentId } = await r.json();
  await request.post(`${API}/__test/payments`, { data: { intentId } });
  return (await (await request.get(`${API}/__test/intents/${intentId}/fund`)).json()).fundId;
}

test.describe('P2-C — fondos, activos de la organización y verificación', () => {
  test('fondos: el administrador solicita y confirma una asignación; el empleado registra el camino A eligiéndolas', async ({ browser, request }) => {
    const fundId = await fundedDonation(request);

    const admin = await login(browser, 'admin@demo.test', 'demo-admin');
    await admin.getByRole('link', { name: 'Fondos de mi organización' }).click();
    const fund = admin.getByTestId('fund').filter({ hasText: fundId });
    await expect(fund.getByTestId('fund-available')).toHaveText('50.000 COP');
    await fund.getByRole('button', { name: 'Solicitar asignación' }).click();
    const dialog = admin.getByRole('dialog');
    await dialog.getByLabel('Importe (COP)').fill('60000');
    await dialog.getByRole('button', { name: 'Solicitar asignación' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByLabel('Importe (COP)').fill('10000');
    // Rechazado → nueva intención (nuevo Command-Id): se cierra y se vuelve a abrir
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await fund.getByRole('button', { name: 'Solicitar asignación' }).click();
    await dialog.getByLabel('Importe (COP)').fill('10000');
    await dialog.getByRole('button', { name: 'Solicitar asignación' }).click();
    await expect(admin.getByText('Asignación solicitada.')).toBeVisible();
    await expect(fund.getByTestId('fund-available')).toHaveText('40.000 COP');
    await expect(fund.getByTestId('allocation')).toContainText('10.000 COP · Solicitada');
    await fund.getByRole('button', { name: 'Confirmar asignación' }).click();
    await dialog.getByRole('button', { name: 'Confirmar asignación' }).click();
    await expect(admin.getByText('Asignación confirmada.')).toBeVisible();
    await expect(fund.getByTestId('allocation')).toContainText('Confirmada');

    const employee = await login(browser, 'empleado@demo.test', 'demo-empleado');
    await expect(employee.getByRole('link', { name: 'Fondos de mi organización' })).toBeVisible();
    await employee.getByRole('button', { name: 'Registrar activo' }).click();
    await employee.getByLabel('Compra con fondos de una donación').check();
    await employee.getByLabel('Fondo', { exact: true }).selectOption(fundId);
    const allocation = employee.getByLabel('Asignación de fondos', { exact: true });
    await allocation.selectOption({ index: 1 });
    await employee.getByLabel('Tipo de bien').fill('Mercado P2-C');
    await employee.getByLabel('Cantidad').fill('3');
    await employee.getByLabel('Unidad de medida').fill('kit');
    await employee.getByLabel('Custodio (referencia)').fill('BODEGA-P2C');
    await employee.getByLabel('Ubicación actual').fill('Bodega P2-C');
    const registered = employee.waitForRequest((r) => r.url().endsWith('/physical-assets/register') && r.method() === 'POST');
    await employee.getByRole('button', { name: 'Registrar' }).click();
    expect((await registered).postDataJSON()).toMatchObject({ fundId });
    await expect(employee).toHaveURL(/\/assets\//);
    const assetRef = decodeURIComponent(employee.url().split('/assets/')[1]);

    // Activos de la organización: aparece, con enlace a su página
    await employee.getByRole('link', { name: 'Panel' }).click();
    await employee.getByRole('link', { name: 'Activos de mi organización' }).click();
    const row = employee.getByTestId('org-asset').filter({ hasText: assetRef });
    await expect(row).toContainText('Bodega P2-C');
    await row.getByRole('link').click();
    await expect(employee).toHaveURL(new RegExp(`/assets/${assetRef}$`));
  });
});
