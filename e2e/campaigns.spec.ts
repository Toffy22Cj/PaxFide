import { test, expect, Page } from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

function future(days: number) {
  const d = new Date(Date.now() + days * 86400000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

async function fillCampaign(page: Page, title: string) {
  await page.getByRole('button', { name: 'Crear convocatoria' }).click();
  await page.getByLabel('Título').fill(title);
  await page.getByLabel(/Visibilidad/).selectOption('PUBLIC');
  await page.getByLabel(/^Inicio/).fill(future(1));
  await page.getByLabel(/^Fin/).fill(future(60));
  await page.getByLabel('Dinero').check();
  await page.getByLabel('Pasarela de pago').check();
  await page.getByLabel(/^Moneda/).fill('COP');
  await page.getByLabel(/^Meta/).fill('2000000');
  await page.getByLabel('Política de meta').selectOption('FLEXIBLE');
  await page.getByRole('button', { name: 'Crear convocatoria' }).last().click();
}

test.describe('Panel de convocatorias (CV-01, CV-02)', () => {
  test('crear por la interfaz → página pública con los medios aceptados → asignar responsable', async ({ page }) => {
    await login(page, 'admin@demo.test', 'demo-admin');
    await page.getByRole('link', { name: 'Convocatorias de mi organización' }).click();
    const post = page.waitForRequest((r) => r.url().includes('/organizations/org-1/campaigns') && r.method() === 'POST');
    await fillCampaign(page, 'Agua potable e2e');
    const body = (await post).postDataJSON();
    expect(body.configuration).toEqual({
      acceptedDonationTypes: ['MONETARY'], acceptedPaymentMethods: ['GATEWAY'], currency: 'COP', targetAmount: '200000000', targetPolicy: 'FLEXIBLE',
    });
    expect(body.visibility).toBe('PUBLIC');
    await expect(page.getByText('Convocatoria creada')).toBeVisible();
    await expect(page.getByRole('img', { name: /Código QR de la página pública de «Agua potable e2e»/ }).first()).toBeVisible();

    // Responsable: empleado de la organización
    await page.getByLabel('Cuenta del responsable').fill('acc-employee');
    await page.getByRole('button', { name: 'Asignar' }).click();
    await expect(page.getByText('Responsable asignado.')).toBeVisible();
    await page.getByRole('button', { name: 'Asignar otro' }).click();
    await page.getByLabel('Cuenta del responsable').fill('acc-employee');
    await page.getByRole('button', { name: 'Asignar' }).click();
    await expect(page.locator('main').getByRole('alert')).toHaveText('Esa cuenta ya está asignada a esta convocatoria.');

    // Enlace público (navegación de cliente; la página pública no necesita sesión)
    await page.getByTestId('created-public-link').click();
    await expect(page).toHaveURL(/\/c\/[0-9A-Z]{26}$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Agua potable e2e' })).toBeVisible();
    await expect(page.getByText('Fundación Demo')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Pasarela de pago' })).toBeVisible();
    await expect(page.getByTestId('cleared-amount')).toHaveText('0 COP');
  });

  test('organización sin verificar → 409 con su texto', async ({ page }) => {
    await login(page, 'admin-sin-verificar@demo.test', 'demo-admin2');
    await page.getByRole('link', { name: 'Convocatorias de mi organización' }).click();
    await fillCampaign(page, 'No debería crearse');
    await expect(page.locator('main').getByRole('alert')).toHaveText('Tu organización todavía no está verificada. No puede crear convocatorias.');
  });

  test('un empleado no ve las acciones de convocatoria (representa; el backend autoriza)', async ({ page }) => {
    await login(page, 'empleado@demo.test', 'demo-empleado');
    await expect(page.getByRole('link', { name: 'Convocatorias de mi organización' })).toHaveCount(0);
  });
});
