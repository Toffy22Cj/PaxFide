// Ref: plan-fase7-pantallas.md A-4 (tests); prompts-agentes-estilo-v2.md VS-7, §3.5 (T1-1 a T1-7); D2.
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:3002';

/** Una donación sin cuenta, pagada en el doble del backend: devuelve su trackingCode (solo vive en el test). */
async function paidDonation(request: APIRequestContext, title: string): Promise<string> {
  const { publicCode } = await (await request.post(`${API}/__test/campaigns`, { data: { title } })).json();
  const intent = await (await request.post(`${API}/api/v1/public/campaigns/${publicCode}/donation-intents`, {
    headers: { 'Command-Id': crypto.randomUUID() }, data: { amount: '2500000', currency: 'COP', paymentMethod: 'GATEWAY' },
  })).json();
  await request.post(`${API}/__test/payments`, { data: { intentId: intent.intentId } });
  const status = await (await request.get(`${API}/api/v1/public/donation-intents/${intent.intentId}`, {
    headers: { 'Intent-Token': intent.statusToken },
  })).json();
  return status.trackingCode;
}

async function openTracking(page: Page, code: string) {
  await page.goto('/tracking');
  await page.getByLabel('Código de seguimiento').fill(code);
  await page.getByRole('button', { name: 'Ver seguimiento' }).click();
  await expect(page.getByTestId('tracking-original')).toHaveText('25.000 COP');
}

test.describe('Línea de tiempo del seguimiento (VS-7)', () => {
  test('cabecera con la convocatoria (G-1), insignia de integridad y código enmascarado (T1)', async ({ page, request, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const code = await paidDonation(request, 'Convocatoria línea de tiempo');
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    await openTracking(page, code);
    await expect(page.getByTestId('tracking-campaign')).toHaveText('Convocatoria línea de tiempo · Fundación Demo');
    await expect(page.getByTestId('integrity-verdict')).toHaveAttribute('data-variant', 'ambiguous');
    await expect(page.getByTestId('integrity-verdict')).toContainText('Pendiente de anclaje');

    // T1-1/T1-5: oculto, solo los 4 últimos; el código completo no está en la página
    await expect(page.getByTestId('tracking-code-shown')).toHaveText(`···${code.slice(-4)}`);
    expect(await page.content()).not.toContain(code);
    // T1-3: copiar sin revelarlo
    await page.getByRole('button', { name: 'Copiar' }).click();
    await expect(page.getByTestId('tracking-code-copied')).toHaveText('Código copiado');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
    expect(await page.content()).not.toContain(code);
    // T1-2/T1-4: ver y ocultar
    await page.getByRole('button', { name: 'Ver código' }).click();
    await expect(page.getByTestId('tracking-code-shown')).toHaveText(code);
    await page.getByRole('button', { name: 'Ocultar' }).click();
    expect(await page.content()).not.toContain(code);

    // T1-7: nunca en la URL ni en el almacenamiento
    expect(page.url()).not.toContain(code);
    expect(urls.filter((u) => u.includes(code))).toEqual([]);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).not.toContain(code);
    // Sin bienes todavía: ningún carril ni camión
    await expect(page.getByText('Todavía no hay bienes asociados a tu donación.')).toBeVisible();
    await expect(page.getByTestId('tracking-truck')).toHaveCount(0);
  });

  test('con "reducir movimiento", el árbol de Merkle de la carga de integridad está detenido', async ({ page, request }) => {
    const code = await paidDonation(request, 'Convocatoria reducir movimiento');
    await page.route('**/donations/tracking/integrity', (route) =>
      route.continue({ headers: { ...route.request().headers(), 'x-test-delay-ms': '3000' } }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openTracking(page, code);
    const loader = page.getByTestId('integrity').getByRole('img', { name: 'Verificando integridad' });
    await expect(loader).toBeVisible();
    const states = await loader.locator('[class*="merkle"]').evaluateAll((els) =>
      els.filter((el) => getComputedStyle(el).animationName !== 'none').map((el) => getComputedStyle(el).animationPlayState));
    expect(states.length).toBeGreaterThan(0);
    expect(new Set(states)).toEqual(new Set(['paused']));
  });

  test('sin "reducir movimiento", el árbol de Merkle sí se anima (negativa)', async ({ page, request }) => {
    const code = await paidDonation(request, 'Convocatoria con movimiento');
    await page.route('**/donations/tracking/integrity', (route) =>
      route.continue({ headers: { ...route.request().headers(), 'x-test-delay-ms': '3000' } }));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openTracking(page, code);
    const loader = page.getByTestId('integrity').getByRole('img', { name: 'Verificando integridad' });
    await expect(loader).toBeVisible();
    const states = await loader.locator('[class*="merkle"]').evaluateAll((els) =>
      els.filter((el) => getComputedStyle(el).animationName !== 'none').map((el) => getComputedStyle(el).animationPlayState));
    expect(states).toContain('running');
  });
});

test('a 390 px con varios bienes: una pestaña por bien y solo su carril a la vista', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  const lane = (ref: string, type: string) => ({ assetRef: ref, lifecycleStatus: 'REGISTERED', assetType: type, unitOfMeasure: 'kit', quantity: '1.0000', locationZone: null, custodianCategory: 'LOCAL_ALLY' });
  await page.route('**/api/v1/donations/tracking**', (route) => {
    const u = new URL(route.request().url()).pathname;
    const body = u.endsWith('/donations/tracking')
      ? { financialSnapshot: { currency: 'COP', originalAmount: 2500000 }, status: 'EN_PROCESO', logistics: [lane('A1', 'Mercado'), lane('A2', 'Abrigo')] }
      : u.endsWith('/integrity') ? { batches: [], unanchoredEvents: 0 } : u.endsWith('/narrative') ? { status: 'PENDING' } : { history: [] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/tracking');
  await page.getByLabel('Código de seguimiento').fill('TRK.prueba-pestanas');
  await page.getByRole('button', { name: 'Ver seguimiento' }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByTestId('asset-lane').filter({ visible: true })).toHaveCount(1);
  await page.getByRole('tab', { name: 'Abrigo' }).click();
  await expect(page.getByTestId('asset-lane').filter({ visible: true })).toContainText('Abrigo');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
