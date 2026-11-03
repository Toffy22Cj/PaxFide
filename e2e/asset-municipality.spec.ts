// Ref: plan-fase7-puesta-al-dia.md Anexo 7 (U-44 a U-47) y A7.3; referencia-api-v1.md, nota del 2026-11-02 (ADR-029
// Enmienda 2): `municipalityCode` obligatorio al registrar (los dos caminos), recibir y entregar. El servidor falso
// responde el 400 del backend sin él. El catálogo es el de prueba (PRUEBA-NO-DIVIPOLA).
import { test, expect, type Page, type Response } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/panel');
  await page.getByLabel('Correo electrónico').fill('empleado@demo.test');
  await page.getByLabel('Contraseña').fill('demo-empleado');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test.describe('P-17: municipio obligatorio en los pasos del lote', () => {
  test('ANTES/DESPUÉS: registrar sin municipio no envía nada (antes: 400 del backend); con municipio → 201 con municipalityCode', async ({ page }) => {
    const registers: Response[] = [];
    page.on('response', (r) => { if (/\/physical-assets\/(register|from-donation)$/.test(r.url())) registers.push(r); });
    await login(page);
    await page.getByRole('button', { name: 'Registrar activo' }).click();
    await page.getByLabel('Tipo de bien').fill('Mercado');
    await page.getByLabel('Cantidad').fill('3');
    await page.getByLabel('Unidad de medida').fill('kit');
    await page.getByLabel('Custodio (referencia)').fill('BODEGA-1');
    await page.getByLabel('Ubicación actual').fill('Bodega central, calle 10');
    await page.getByRole('button', { name: 'Registrar' }).click();
    await page.waitForTimeout(800);
    // Sin municipio no sale ninguna petición: antes del arreglo, aquí salía y el backend respondía 400
    expect(registers.map((r) => r.status())).toEqual([]);
    await expect(page.getByText('Elige el municipio')).toBeVisible();

    await page.getByLabel('Departamento').selectOption('05');
    await page.getByLabel('Municipio').selectOption('05001');
    const sent = page.waitForResponse((r) => /\/physical-assets\/from-donation$/.test(r.url()));
    await page.getByRole('button', { name: 'Registrar' }).click();
    const r = await sent;
    expect(r.status()).toBe(201);
    expect(r.request().postDataJSON()).toEqual(expect.objectContaining({ municipalityCode: '05001', currentLocation: 'Bodega central, calle 10' }));
    await expect(page).toHaveURL(/\/assets\/[0-9a-f-]{36}$/);
  });
});
