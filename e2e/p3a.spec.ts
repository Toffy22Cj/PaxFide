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

test.describe('P3-A — crear organización, cola de verificación y administradores de plataforma', () => {
  test('cuenta nueva → crea su organización (pendiente) → la plataforma la ve en la cola, pide información y la verifica', async ({ browser }) => {
    const email = `rep-${Date.now()}@demo.test`;
    const name = `Fundación e2e ${Date.now()}`;
    const reg = await (await browser.newContext()).newPage();
    await reg.goto('/register');
    await reg.getByLabel('Correo electrónico').fill(email);
    await reg.getByLabel('Contraseña', { exact: true }).fill('clave-demo-larga');
    await reg.getByLabel('Repite la contraseña').fill('clave-demo-larga');
    await reg.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(reg.getByText('Cuenta creada')).toBeVisible();

    const rep = await login(browser, email, 'clave-demo-larga');
    await rep.getByRole('link', { name: 'Crear organización' }).click();
    await rep.getByRole('button', { name: 'Crear organización' }).click();
    const dialog = rep.getByRole('dialog');
    await dialog.getByLabel('Tipo').selectOption('FOUNDATION');
    await dialog.getByLabel('Nombre').fill(name);
    await dialog.getByRole('button', { name: 'Crear organización' }).click();
    await expect(rep.getByTestId('organization-status')).toHaveText('Pendiente de verificación');
    await expect(rep.getByTestId('organization-roles')).toHaveText('Representante');

    const platform = await login(browser, 'plataforma@demo.test', 'demo-plataforma');
    await platform.getByRole('link', { name: 'Plataforma: verificación y administradores' }).click();
    const row = platform.getByTestId('queue-item').filter({ hasText: name });
    await expect(row).toContainText('Pendiente de verificación');
    await expect(platform.getByLabel('Identificador de la organización')).toHaveCount(0);
    await row.getByRole('button', { name: 'Pedir más información' }).click();
    await platform.getByRole('dialog').getByLabel('Mensaje para la organización').fill('Falta el certificado de existencia.');
    await platform.getByRole('dialog').getByRole('button', { name: 'Pedir más información' }).click();
    await expect(platform.getByText(`${name}: Se pidió más información.`)).toBeVisible();
    await expect(row).toContainText('Falta el certificado de existencia.');

    await platform.getByLabel('Mostrar').selectOption('NEEDS_MORE_INFORMATION');
    await expect(row).toBeVisible();
    await platform.getByLabel('Mostrar').selectOption('PENDING_VERIFICATION');
    await expect(row).toHaveCount(0);
    await platform.getByLabel('Mostrar').selectOption('');
    await row.getByRole('button', { name: 'Verificar' }).click();
    await platform.getByRole('dialog').getByRole('button', { name: 'Verificar organización' }).click();
    await expect(platform.getByText(`${name}: Verificada.`)).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test('administradores: añadir una cuenta, que ve la plataforma; retirarla; 409 al repetir', async ({ browser }) => {
    const platform = await login(browser, 'plataforma@demo.test', 'demo-plataforma');
    await platform.getByRole('link', { name: 'Plataforma: verificación y administradores' }).click();
    await expect(platform.getByTestId('platform-admin').filter({ hasText: 'acc-platform (tú)' })).toBeVisible();
    await platform.getByRole('button', { name: 'Añadir administrador' }).click();
    const dialog = platform.getByRole('dialog');
    await dialog.getByLabel('Cuenta (identificador)').fill('acc-platform-2');
    await dialog.getByRole('button', { name: 'Añadir administrador' }).click();
    await expect(platform.getByText('Administrador añadido.')).toBeVisible();

    const second = await login(browser, 'plataforma2@demo.test', 'demo-plataforma2');
    await expect(second.getByRole('link', { name: 'Plataforma: verificación y administradores' })).toBeVisible();

    await platform.getByRole('button', { name: 'Añadir administrador' }).click();
    await dialog.getByLabel('Cuenta (identificador)').fill('acc-platform-2');
    await dialog.getByRole('button', { name: 'Añadir administrador' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Esa cuenta ya es administradora de la plataforma.');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();

    await platform.getByTestId('platform-admin').filter({ hasText: 'acc-platform-2' }).getByRole('button', { name: 'Retirar' }).click();
    await dialog.getByRole('button', { name: 'Retirar' }).click();
    await expect(platform.getByText('Administrador retirado.')).toBeVisible();
    await expect(platform.getByTestId('platform-admin').filter({ hasText: 'acc-platform-2' })).toHaveCount(0);
  });
});
