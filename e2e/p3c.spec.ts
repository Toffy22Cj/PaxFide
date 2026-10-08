import { test, expect, Page, Browser } from '@playwright/test';

async function login(browser: Browser, email: string, password: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
  return page;
}

test.describe('P3-C — configuración de convocatorias con solicitud y aprobación', () => {
  test('editar sin aprobación (sin donaciones), solicitar otro cambio y que el representante lo apruebe; la propia no se aprueba', async ({ browser }) => {
    const admin = await login(browser, 'admin@demo.test', 'demo-admin');
    await admin.getByRole('link', { name: 'Configuración de convocatorias' }).click();
    await admin.getByLabel('Convocatoria').selectOption({ label: 'Ropa de abrigo' });
    await admin.getByRole('button', { name: 'Ver configuración' }).click();
    await expect(admin.getByTestId('configuration-version')).toContainText('1');

    // Añadir dinero: una sola transición con meta, política, medios y moneda
    await admin.getByLabel('Dinero').check();
    await admin.getByLabel('Pasarela de pago').check();
    await admin.getByLabel('Moneda').fill('COP');
    await admin.getByLabel('Meta', { exact: true }).fill('1000000');
    await admin.getByLabel('Política de meta').selectOption('FLEXIBLE');
    const edit = admin.waitForRequest((r) => r.url().endsWith('/campaigns/camp-demo-3/configuration'));
    await admin.getByRole('button', { name: 'Guardar sin aprobación' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
    expect((await edit).postDataJSON()).toEqual({ expectedConfigurationVersion: 1, configuration: {
      acceptedDonationTypes: ['IN_KIND', 'MONETARY'], acceptedPaymentMethods: ['GATEWAY'], currency: 'COP', targetAmount: '100000000', targetPolicy: 'FLEXIBLE',
    } });
    await expect(admin.getByText('Configuración guardada.')).toBeVisible();
    await expect(admin.getByTestId('configuration-version')).toContainText('2');

    // Otro cambio, ahora con solicitud: la propia no se puede aprobar
    await admin.getByLabel('Transferencia bancaria').check();
    await admin.getByRole('button', { name: 'Solicitar cambio' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Solicitar' }).click();
    await expect(admin.getByText('Solicitud de cambio enviada.')).toBeVisible();
    const mine = admin.getByTestId('change-request').filter({ hasText: 'Pendiente' });
    await expect(mine).toContainText('(tú)');
    await expect(mine.getByRole('button', { name: 'Aprobar' })).toHaveCount(0);
    await expect(admin.getByText(/Hay una solicitud pendiente/)).toBeVisible();

    // El representante (sin listado de convocatorias) escribe la referencia y la aprueba
    const rep = await login(browser, 'representante@demo.test', 'demo-representante');
    await rep.getByRole('link', { name: 'Configuración de convocatorias' }).click();
    await rep.getByLabel('Referencia de la convocatoria').fill('camp-demo-3');
    await rep.getByRole('button', { name: 'Ver configuración' }).click();
    const pending = rep.getByTestId('change-request').filter({ hasText: 'Pendiente' });
    await expect(pending).toContainText('Transferencia bancaria');
    await pending.getByRole('button', { name: 'Aprobar' }).click();
    await rep.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click();
    await expect(rep.getByText('Cambio aprobado.')).toBeVisible();
    await expect(rep.getByTestId('change-request').filter({ hasText: 'Aprobada' })).toBeVisible();

    // La página pública refleja la configuración nueva
    const pub = await (await browser.newContext()).newPage();
    await pub.goto('/c/01JDEMOPUBLICC0DEINKIND01');
    await expect(pub.getByRole('listitem').filter({ hasText: 'Transferencia bancaria' })).toBeVisible();
  });
});
