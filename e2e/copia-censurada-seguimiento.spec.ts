// Ref: ADR-021-D Enmienda 2 (E5 a E8; definición de hecho 1, 2, 5, 6 y 7) y ADR-051 Enmienda 2, Tarea 6: la copia censurada de
// la foto de entrega en el seguimiento del donante. El servidor falso reproduce el contrato del backend (Tarea 4).
import crypto from 'crypto';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { uniquePng } from './support/evidence';

const API = 'http://localhost:3002';
const CONFIRMED = { confirmNoIdentifiablePerson: true };

async function login(request: APIRequestContext, email: string, password: string) {
  const { token } = await (await request.post(`${API}/api/v1/auth/login`, { data: { email, password } })).json();
  return { Authorization: `Bearer ${token as string}` };
}

/** Una donación pagada y un activo entregado con foto; devuelve lo que hace falta para ver y publicar. */
async function deliveredAsset(request: APIRequestContext) {
  const { publicCode } = await (await request.post(`${API}/__test/campaigns`, { data: { title: 'Convocatoria de la entrega' } })).json();
  const intent = await (await request.post(`${API}/api/v1/public/campaigns/${publicCode}/donation-intents`, {
    headers: { 'Command-Id': crypto.randomUUID() }, data: { amount: '2500000', currency: 'COP', paymentMethod: 'GATEWAY' },
  })).json();
  await request.post(`${API}/__test/payments`, { data: { intentId: intent.intentId } });
  const status = await (await request.get(`${API}/api/v1/public/donation-intents/${intent.intentId}`, { headers: { 'Intent-Token': intent.statusToken } })).json();
  const { fundId } = await (await request.get(`${API}/__test/intents/${intent.intentId}/fund`)).json();
  const employee = await login(request, 'empleado@demo.test', 'demo-empleado');
  const reg = await (await request.post(`${API}/api/v1/physical-assets/register`, {
    headers: { ...employee, 'Command-Id': crypto.randomUUID() },
    data: { fundId, allocationId: 'alloc-copia', assetType: 'Mercado', quantity: '3', unitOfMeasure: 'kit', custodianRef: 'B',
      currentLocation: 'Bodega secreta', municipalityCode: '11001' },
  })).json();
  const step = (name: string, data: object) => request.post(`${API}/api/v1/physical-assets/${reg.assetRef}/${name}`, { headers: { ...employee, 'Command-Id': crypto.randomUUID() }, data });
  expect((await step('dispatch', { carrierRef: 'T' })).status()).toBe(200);
  expect((await step('receive', { facilityLocation: 'Centro', receiverRef: 'R', municipalityCode: '23001' })).status()).toBe(200);
  const up = await request.post(`${API}/api/v1/organizations/org-1/delivery-evidence`, {
    headers: employee, multipart: { file: { name: 'e.png', mimeType: 'image/png', buffer: uniquePng() } },
  });
  expect(up.status()).toBe(201);
  const { evidenceRef } = await up.json();
  expect((await step('deliver', { finalCustodianRef: 'C', beneficiaryRef: 'BEN-PRIVADO', locationRef: 'Escuela secreta', municipalityCode: '11001', evidenceRef })).status()).toBe(200);
  return { assetRef: reg.assetRef as string, trackingCode: status.trackingCode as string, evidenceRef: evidenceRef as string };
}

async function publish(request: APIRequestContext, assetRef: string) {
  const admin = await login(request, 'admin@demo.test', 'demo-admin');
  expect((await request.get(`${API}/api/v1/physical-assets/${assetRef}/evidence/redacted`, { headers: admin })).status()).toBe(200);
  expect((await request.put(`${API}/api/v1/physical-assets/${assetRef}/evidence/redacted/publication`, { headers: admin, data: CONFIRMED })).status()).toBe(204);
  return admin;
}

async function openTracking(page: Page, code: string) {
  await page.goto('/tracking');
  await page.getByLabel('Código de seguimiento').fill(code);
  await page.getByRole('button', { name: 'Ver seguimiento' }).click();
  await expect(page.getByTestId('tracking-step')).toHaveCount(4);
  await page.getByTestId('tracking-step').nth(3).click(); // la entrega
}

test.describe('La copia censurada de la foto de entrega en el seguimiento', () => {
  test('publicada: se ve en el detalle de la entrega; se pidió con la cabecera, sin el código en ninguna URL, y el src es un blob', async ({ page, request }) => {
    const { assetRef, trackingCode } = await deliveredAsset(request);
    await publish(request, assetRef);
    const seen: { url: string; auth: string | undefined }[] = [];
    page.on('request', (r) => { if (r.url().includes('/evidence-preview')) seen.push({ url: r.url(), auth: r.headers()['authorization'] }); });
    const allUrls: string[] = [];
    page.on('request', (r) => allUrls.push(r.url()));

    await openTracking(page, trackingCode);

    const img = page.getByTestId('evidence-preview-img');
    await expect(img).toBeVisible();
    expect(await img.getAttribute('src')).toMatch(/^blob:/);
    expect(await img.getAttribute('src')).not.toContain(trackingCode);
    expect(seen).toHaveLength(1);
    expect(seen[0].auth).toBe(`Bearer ${trackingCode}`);
    expect(seen[0].url).not.toContain(trackingCode);
    expect(seen[0].url).not.toContain('?');
    expect(allUrls.filter((u) => u.includes(trackingCode))).toEqual([]); // el código nunca viaja en una URL
    expect((await page.locator('body').innerText())).not.toContain('Escuela secreta');
    // la imagen realmente se decodificó (no es un icono roto)
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });

  test('sin publicar, despublicada o retirada: no hay imagen ni se dice que exista una copia; la huella sigue', async ({ page, request }) => {
    const { assetRef, trackingCode, evidenceRef } = await deliveredAsset(request);
    await openTracking(page, trackingCode);
    await expect(page.getByTestId('evidence-preview')).toHaveCount(0);
    await expect(page.getByTestId('detail-evidence')).toContainText('Con foto de entrega');

    const admin = await publish(request, assetRef);
    await openTracking(page, trackingCode);
    await expect(page.getByTestId('evidence-preview-img')).toBeVisible();

    expect((await request.delete(`${API}/api/v1/physical-assets/${assetRef}/evidence/redacted/publication`, { headers: admin })).status()).toBe(204);
    await openTracking(page, trackingCode);
    await expect(page.getByTestId('evidence-preview')).toHaveCount(0);
    await expect(page.getByTestId('detail-evidence')).toContainText('Con foto de entrega');
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/difuminad|copia censurada|despublic|en revisi[oó]n/i);
    expect(evidenceRef).toMatch(/^sha256:/);
  });

  test('la ruta: 401 sin código, el mismo 401 con un código que no cubre el activo, y 404 sin copia publicada', async ({ request }) => {
    const a = await deliveredAsset(request);
    const b = await deliveredAsset(request);
    const path = `${API}/api/v1/donations/tracking/assets/${a.assetRef}/evidence-preview`;
    expect((await request.get(path)).status()).toBe(401);
    expect((await request.get(`${path}?code=${a.trackingCode}`)).status()).toBe(401); // el código en la consulta no vale
    const other = await request.get(path, { headers: { Authorization: `Bearer ${b.trackingCode}` } });
    expect(other.status()).toBe(401); // nunca 404: no se puede enumerar activos
    const unpublished = await request.get(path, { headers: { Authorization: `Bearer ${a.trackingCode}` } });
    expect(unpublished.status()).toBe(404);

    await publish(request, a.assetRef);
    const ok = await request.get(path, { headers: { Authorization: `Bearer ${a.trackingCode}` } });
    expect(ok.status()).toBe(200);
    expect(ok.headers()['content-type']).toBe('image/png');
    expect(ok.headers()['cache-control']).toContain('no-store');
  });
});
