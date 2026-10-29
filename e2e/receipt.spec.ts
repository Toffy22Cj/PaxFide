// Ref: plan-fase7-puesta-al-dia.md Anexo 1, P-5 (E2E del comprobante): sin botón en una donación no confirmada y, en una
// confirmada, un PNG de 1200 × 1600 descargado.
import { test, expect, type APIRequestContext } from '@playwright/test';
import crypto from 'crypto';
import fs from 'fs';

const API = 'http://localhost:3002';

async function donorToken(request: APIRequestContext): Promise<string> {
  const r = await request.post(`${API}/api/v1/auth/login`, { data: { email: 'donante@demo.test', password: 'demo-donante' } });
  return (await r.json()).token;
}

async function donate(request: APIRequestContext, token: string, publicCode: string, confirm: boolean) {
  const r = await request.post(`${API}/api/v1/public/campaigns/${publicCode}/donation-intents`, {
    data: { amount: '5000000', currency: 'COP', paymentMethod: 'GATEWAY' },
    headers: { 'Command-Id': crypto.randomUUID(), Authorization: `Bearer ${token}` },
  });
  const { intentId } = await r.json();
  if (confirm) await request.post(`${API}/__test/payments`, { data: { intentId } });
  return intentId as string;
}

/** Ancho y alto de la cabecera IHDR de un PNG. */
function pngSize(buf: Buffer) {
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('P-5: sin botón en una donación pendiente; en una confirmada se descarga un PNG de 1200 × 1600', async ({ page, request }, info) => {
  const title = `Comprobante E2E ${crypto.randomUUID().slice(0, 8)}`;
  const { publicCode } = await (await request.post(`${API}/__test/campaigns`, { data: { title } })).json();
  const token = await donorToken(request);
  const confirmedId = await donate(request, token, publicCode, true);
  await donate(request, token, publicCode, false);

  await page.goto('/account/donations');
  await page.getByLabel('Correo electrónico').fill('donante@demo.test');
  await page.getByLabel('Contraseña').fill('demo-donante');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/account\/donations$/);

  const mine = page.getByTestId('account-donation').filter({ hasText: title });
  await expect(mine).toHaveCount(2);
  const pending = mine.filter({ hasText: 'Pendiente' });
  const confirmed = mine.filter({ hasText: 'Confirmada' });
  // Negativa: la pendiente no tiene comprobante
  await expect(pending.getByRole('button', { name: 'Descargar comprobante' })).toHaveCount(0);
  await expect(pending.getByRole('button', { name: 'Imprimir' })).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    confirmed.getByRole('button', { name: 'Descargar comprobante' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`comprobante-paxfide-${confirmedId.slice(-6)}.png`);
  const file = info.outputPath('comprobante.png');
  await download.saveAs(file);
  const buf = fs.readFileSync(file);
  expect(pngSize(buf)).toEqual({ width: 1200, height: 1600 });
  // Evidencia del PR (captura del PNG generado con datos del servidor falso)
  if (process.env.RECEIPT_EVIDENCE) fs.copyFileSync(file, process.env.RECEIPT_EVIDENCE);
});
