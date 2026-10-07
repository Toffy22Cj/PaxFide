import { test, expect, Page, Request } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('empleado@demo.test');
  await page.getByLabel('Contraseña').fill('demo-empleado');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

async function act(page: Page, button: string, fields: [string, string][]) {
  await page.getByRole('button', { name: button, exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const [label, value] of fields) await dialog.getByLabel(label).fill(value);
  await dialog.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

const DELIVER: [string, string][] = [
  ['Custodio final (referencia)', 'ALIADO-1'], ['Beneficiario (referencia)', 'BEN-1'],
  ['Lugar de entrega (referencia)', 'LUGAR-1'], ['Evidencia (referencia)', 'EVID-1'],
];

test.describe('Panel de activos (registrar, dividir, despachar, recibir, entregar)', () => {
  test('recorrido del activo y de su hijo hasta DELIVERED, con Command-Id en cada comando', async ({ page }) => {
    const commands: Request[] = [];
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/physical-assets')) commands.push(r); });
    await login(page);

    await page.getByRole('button', { name: 'Registrar activo' }).click();
    await page.getByLabel('Tipo de bien').fill('Mercado');
    await page.getByLabel('Cantidad').fill('10');
    await page.getByLabel('Unidad de medida').fill('kit');
    await page.getByLabel('Custodio (referencia)').fill('BODEGA-1');
    await page.getByLabel('Ubicación actual').fill('Bodega central');
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page).toHaveURL(/\/assets\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Registrado');
    await expect(page.getByTestId('field-quantity')).toHaveText('10');

    await act(page, 'Despachar', [['Transportista (referencia)', 'TRANS-1']]);
    await expect(page.getByText('Activo despachado.')).toBeVisible();
    await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Despachado');

    await act(page, 'Recibir', [['Instalación (ubicación)', 'Centro comunitario'], ['Quién recibe (referencia)', 'REC-1']]);
    await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Recibido');
    await expect(page.getByTestId('field-currentLocation')).toHaveText('Centro comunitario');

    await act(page, 'Dividir activo', [['Cantidad a separar', '4']]);
    await expect(page.getByText('División en curso')).toBeVisible();
    await expect(page.getByText('División completada')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('field-quantity')).toHaveText('6');

    // Entregar el padre: queda en solo lectura y sin acciones
    await act(page, 'Entregar', DELIVER);
    await expect(page.getByText('Este activo ya fue entregado. Solo lectura.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Despachar' })).toHaveCount(0);

    // El hijo, por separado
    await page.getByTestId('split-child-link').click();
    await expect(page.getByTestId('field-quantity')).toHaveText('4');
    // El hijo nace REGISTERED (como en el backend real): despachar y recibir antes de entregar
    await act(page, 'Despachar', [['Transportista (referencia)', 'TRANS-2']]);
    await act(page, 'Recibir', [['Instalación (ubicación)', 'Centro comunitario'], ['Quién recibe (referencia)', 'REC-2']]);
    await act(page, 'Entregar', DELIVER);
    await expect(page.getByTestId('state-content-readonly')).toBeVisible();

    expect(commands.length).toBe(8);
    const ids = await Promise.all(commands.map(async (r) => (await r.allHeaders())['command-id']));
    ids.forEach((id) => expect(id).toMatch(/^[0-9a-f-]{36}$/));
    expect(new Set(ids).size).toBe(8);
  });

  test('una transición imposible → 409 con su texto; el activo no cambia', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Registrar activo' }).click();
    for (const [l, v] of [['Tipo de bien', 'Kit'], ['Cantidad', '1'], ['Unidad de medida', 'kit'], ['Custodio (referencia)', 'C'], ['Ubicación actual', 'U']]) {
      await page.getByLabel(l).fill(v);
    }
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page).toHaveURL(/\/assets\//);
    await page.getByRole('button', { name: 'Recibir', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Instalación (ubicación)').fill('X');
    await dialog.getByLabel('Quién recibe (referencia)').fill('Y');
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('El activo no está en un estado que permita esta operación.');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Registrado');
  });

  test('activo inexistente o de otra organización → 403 como estado de pantalla, sin redirigir', async ({ page }) => {
    await login(page);
    await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
    await page.evaluate(() => (window as any).__TEST_ROUTER__.push('/assets/no-existe'));
    await expect(page.getByText('No tienes acceso a este recurso.')).toBeVisible();
    await expect(page).toHaveURL(/\/assets\/no-existe$/);
  });
});
