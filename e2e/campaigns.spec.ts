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

    // Responsable: empleado de la organización, elegido entre los miembros desde la fila del listado
    const row = page.getByTestId('org-campaign').filter({ hasText: 'Agua potable e2e' });
    await row.getByRole('button', { name: 'Asignar empleado' }).click();
    await page.getByLabel('Empleado', { exact: true }).selectOption('acc-employee-3');
    await page.getByRole('dialog').getByRole('button', { name: 'Asignar empleado' }).click();
    await expect(page.getByText('Empleado asignado.')).toBeVisible();
    await expect(row).toContainText('acc-employee-3 (Empleado)');
    await row.getByRole('button', { name: 'Asignar empleado' }).click();
    await page.getByLabel('Empleado', { exact: true }).selectOption('acc-employee-3');
    await page.getByRole('dialog').getByRole('button', { name: 'Asignar empleado' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Esa cuenta ya es responsable activa de esta convocatoria.');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

    // Enlace público (navegación de cliente; la página pública no necesita sesión)
    await page.getByTestId('created-public-link').click();
    await expect(page).toHaveURL(/\/c\/[0-9A-Z]{26}$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Agua potable e2e' })).toBeVisible();
    await expect(page.getByText('Fundación Demo')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Pasarela de pago' })).toBeVisible();
    await expect(page.getByTestId('cleared-amount')).toHaveText('0 COP');
  });

  test('listado real: designar administrador, retirar responsable con reemplazo, cerrar y estimación', async ({ page }) => {
    await login(page, 'admin@demo.test', 'demo-admin');
    await page.getByRole('link', { name: 'Convocatorias de mi organización' }).click();
    await fillCampaign(page, 'Ciclo completo e2e');
    await expect(page.getByText('Convocatoria creada')).toBeVisible();
    const row = page.getByTestId('org-campaign').filter({ hasText: 'Ciclo completo e2e' });
    const dialog = page.getByRole('dialog');

    // CV-03
    await row.getByRole('button', { name: 'Designar administrador' }).click();
    await page.getByLabel('Administrador', { exact: true }).selectOption('acc-admin');
    await dialog.getByRole('button', { name: 'Designar administrador' }).click();
    await expect(page.getByText('Administrador designado.')).toBeVisible();
    await expect(row).toContainText('acc-admin (Administrador)');

    // Retirar al último responsable sin reemplazo → 409; con reemplazo → éxito
    await row.getByRole('button', { name: 'Retirar responsable' }).click();
    await page.getByLabel('Responsable', { exact: true }).selectOption('acc-admin');
    await dialog.getByRole('button', { name: 'Retirar responsable' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Es el último responsable: indica quién lo sustituye.');
    await page.getByLabel('Reemplazo (opcional)').selectOption('acc-employee-2');
    await page.getByLabel('Papel del reemplazo').selectOption('EMPLOYEE');
    await dialog.getByRole('button', { name: 'Retirar responsable' }).click();
    await expect(page.getByText('Responsable retirado.')).toBeVisible();
    await expect(row).toContainText('acc-employee-2 (Empleado)');
    await expect(row).not.toContainText('acc-admin (Administrador)');

    // Estimación (P3) desde la fila
    await row.getByRole('link', { name: 'Ver estimación' }).click();
    await expect(page).toHaveURL(/\/panel\/prediction$/);
    await page.getByLabel('Convocatoria').selectOption({ label: 'Ciclo completo e2e' });
    await page.getByRole('button', { name: 'Ver estimación' }).click();
    const estimate = page.getByTestId('prediction-estimate');
    await expect(estimate.getByText('ESTIMACIÓN — modelo entrenado con datos sintéticos')).toBeVisible();
    await expect(estimate.getByTestId('basic-probability')).toContainText('62 %');
    await expect(estimate.getByTestId('advanced-chart')).toBeVisible();
    // S-17: evolución por cortes; el del 50 % aún no llega y sale vacío con el motivo del backend
    const history = estimate.getByTestId('history-section');
    await expect(history.getByTestId('history-chart')).toBeVisible();
    await expect(history.getByTestId('history-cut-50')).toHaveAttribute('data-available', 'false');
    await expect(history.getByTestId('history-table')).toContainText('Sin cifra: Este corte aún no ha llegado');
    await expect(history.getByTestId('history-warnings')).toContainText('la tasa de fallos es 0');

    // Cerrar: confirmación; después, sin acciones
    await page.getByRole('link', { name: 'Panel' }).click();
    await page.getByRole('link', { name: 'Convocatorias de mi organización' }).click();
    await row.getByRole('button', { name: 'Cerrar convocatoria' }).click();
    await expect(dialog.getByText(/Cerrar es definitivo/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Cerrar convocatoria' }).click();
    await expect(page.getByText('Convocatoria cerrada.')).toBeVisible();
    await expect(row.getByTestId('campaign-status')).toContainText('Cerrada');
    await expect(row.getByRole('button')).toHaveCount(0);
  });

  test('representante: estimación con la referencia escrita (el listado no le está permitido)', async ({ page }) => {
    await login(page, 'representante@demo.test', 'demo-representante');
    // Navegación de cliente: recargar perdería la sesión (JWT solo en memoria, D2)
    await page.getByRole('link', { name: 'Estimación de convocatorias' }).click();
    await page.getByLabel('Referencia de la convocatoria').fill('camp-demo-1');
    await page.getByRole('button', { name: 'Ver estimación' }).click();
    await expect(page.getByTestId('prediction-estimate').getByTestId('basic-final')).toContainText('104 %');
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
