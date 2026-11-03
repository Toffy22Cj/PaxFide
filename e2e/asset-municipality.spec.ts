// Ref: plan-fase7-puesta-al-dia.md Anexo 7 (U-44 a U-47) y A7.3; referencia-api-v1.md, nota del 2026-11-02 (ADR-029
// Enmienda 2): `municipalityCode` obligatorio al registrar (los dos caminos), recibir y entregar. El servidor falso
// responde el 400 del backend sin él. El catálogo es el de prueba (PRUEBA-NO-DIVIPOLA).
import crypto from 'crypto';
import { test, expect, type Page, type Response } from '@playwright/test';
import { chooseMunicipality } from './support/evidence';

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

const API = 'http://localhost:3002';

/** Una donación pagada y su fondo, como en tracking-p2 (servidor falso). */
async function paidDonation(request: import('@playwright/test').APIRequestContext) {
  const { publicCode } = await (await request.post(`${API}/__test/campaigns`, { data: { title: 'Convocatoria P-17' } })).json();
  const intent = await (await request.post(`${API}/api/v1/public/campaigns/${publicCode}/donation-intents`, {
    headers: { 'Command-Id': crypto.randomUUID() }, data: { amount: '2500000', currency: 'COP', paymentMethod: 'GATEWAY' },
  })).json();
  await request.post(`${API}/__test/payments`, { data: { intentId: intent.intentId } });
  const status = await (await request.get(`${API}/api/v1/public/donation-intents/${intent.intentId}`, { headers: { 'Intent-Token': intent.statusToken } })).json();
  const { fundId } = await (await request.get(`${API}/__test/intents/${intent.intentId}/fund`)).json();
  const { token } = await (await request.post(`${API}/api/v1/auth/login`, { data: { email: 'empleado@demo.test', password: 'demo-empleado' } })).json();
  return { trackingCode: status.trackingCode as string, fundId: fundId as string, token: token as string };
}

test.describe('P-17: la zona pública', () => {
  test('recibir empieza en el municipio del lote y se puede cambiar; despachar no envía municipio; el lote muestra su zona', async ({ page }) => {
    const posts: import('@playwright/test').Request[] = [];
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/physical-assets')) posts.push(r); });
    await login(page);
    await page.getByRole('button', { name: 'Registrar activo' }).click();
    for (const [l, v] of [['Tipo de bien', 'Mercado'], ['Cantidad', '2'], ['Unidad de medida', 'kit'], ['Custodio (referencia)', 'B'], ['Ubicación actual', 'Bodega']]) {
      await page.getByLabel(l).fill(v);
    }
    await chooseMunicipality(page, '05', '05001');
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page).toHaveURL(/\/assets\//);
    await expect(page.getByTestId('field-zoneName')).toHaveText('Medellín, Antioquia');

    await page.getByRole('button', { name: 'Despachar', exact: true }).click();
    await expect(page.getByRole('dialog').getByTestId('asset-municipality')).toHaveCount(0);
    await page.getByRole('dialog').getByLabel('Transportista (referencia)').fill('T');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Despachado');

    await page.getByRole('button', { name: 'Recibir', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('asset-municipality').getByLabel('Municipio')).toHaveValue('05001');
    await dialog.getByLabel('Instalación (ubicación)').fill('Centro');
    await dialog.getByLabel('Quién recibe (referencia)').fill('R');
    await dialog.getByTestId('asset-municipality').getByLabel('Municipio').selectOption('05266');
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Recibido');
    await expect(page.getByTestId('field-zoneName')).toHaveText('Envigado, Antioquia');

    const byPath = (end: string) => posts.find((r) => r.url().endsWith(end))!.postDataJSON();
    expect(byPath('/dispatch')).toEqual({ carrierRef: 'T' });
    expect(byPath('/receive')).toEqual({ facilityLocation: 'Centro', receiverRef: 'R', municipalityCode: '05266' });
  });

  test('seguimiento: cada paso con su zona presentada; el texto libre de la ubicación nunca sale (negativa)', async ({ page, request }) => {
    const { trackingCode, fundId, token } = await paidDonation(request);
    const auth = { Authorization: `Bearer ${token}` };
    const reg = await (await request.post(`${API}/api/v1/physical-assets/register`, {
      headers: { ...auth, 'Command-Id': crypto.randomUUID() },
      data: { fundId, allocationId: 'alloc-p17', assetType: 'Mercado', quantity: '3', unitOfMeasure: 'kit', custodianRef: 'B',
        currentLocation: 'Bodega secreta calle 99', municipalityCode: '11001' },
    })).json();
    for (const [step, data] of [
      ['dispatch', { carrierRef: 'T' }],
      ['receive', { facilityLocation: 'Casa privada carrera 7', receiverRef: 'R', municipalityCode: '23001' }],
    ] as const) {
      const r = await request.post(`${API}/api/v1/physical-assets/${reg.assetRef}/${step}`, { headers: { ...auth, 'Command-Id': crypto.randomUUID() }, data });
      expect(r.status()).toBe(200);
    }
    await page.goto('/tracking');
    await page.getByLabel('Código de seguimiento').fill(trackingCode);
    await page.getByRole('button', { name: 'Ver seguimiento' }).click();
    const steps = page.getByTestId('tracking-step');
    await expect(steps).toHaveCount(3);
    // Registro en Bogotá, despacho con la zona del paso anterior, recepción en Montería
    await expect(steps.nth(0)).toContainText('Bogotá, D.C.');
    await expect(steps.nth(1)).toContainText('Bogotá, D.C.');
    await expect(steps.nth(2)).toContainText('Montería, Córdoba');
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('Bodega secreta');
    expect(text).not.toContain('Casa privada');
    expect(text).not.toContain('BOGOTÁ');
  });

  test('bandeja de la plataforma: "Datos completos" o "Faltan datos", en el orden del servidor', async ({ page, request }) => {
    await page.goto('/panel/platform');
    await page.getByLabel('Correo electrónico').fill('plataforma@demo.test');
    await page.getByLabel('Contraseña').fill('demo-plataforma');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    const rows = page.getByTestId('queue-item');
    await expect(rows.first()).toBeVisible();
    const { token } = await (await request.post(`${API}/api/v1/auth/login`, { data: { email: 'plataforma@demo.test', password: 'demo-plataforma' } })).json();
    const { items } = await (await request.get(`${API}/api/v1/platform/organizations`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const names = await rows.locator('h3').allInnerTexts();
    // El servidor falso es compartido: se comparan las organizaciones sembradas, que existen desde el arranque
    const seeded = ['Fundación Sin Verificar', 'Empresa Pendiente'];
    expect(names.filter((n) => seeded.includes(n))).toEqual(items.map((i: { name?: string }) => i.name).filter((n: string) => seeded.includes(n)));
    const row = rows.filter({ hasText: 'Empresa Pendiente' });
    await expect(row.getByTestId('queue-preverification')).toContainText('Faltan datos: razón social, NIT');
    await expect(row.getByRole('button', { name: 'Verificar' })).toBeVisible();
  });
});
