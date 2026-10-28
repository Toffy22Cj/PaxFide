// Ref: plan-fase7-puesta-al-dia.md P-2; plan-fase7-fidelidad.md F-A5 y F-C2 (E2E de cada animación: se comprueba en
// la propiedad calculada, no en la clase); referencia-api-v1.md §8 (G-2, G-3, G-4, E1.3).
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const API = 'http://localhost:3002';
const V = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '__tests__', 'fixtures', 'merkle-proof-vectors.json'), 'utf8')) as
  { description: string; leaves: string[]; index: number; path: { side: string; hash: string }[]; root: string }[];
const leaf = V.find((v) => v.description === '5 hojas, indice 4')!;
const PROOF = { merkleRoot: leaf.root, leafIndex: 4, path: leaf.path, transactionHash: '0x' + 'cd'.repeat(32), network: 'amoy', anchoredAt: '2026-10-08T10:00:00Z' };

/** Respuestas fijas del seguimiento (el código es de prueba y solo vive en el test). */
async function routeTracking(page: Page, lastB: 'ASSET_DISPATCHED' | 'ASSET_RECEIVED', proof = PROOF) {
  const lot = (ref: string, type: string, extra: Record<string, unknown> = {}) => ({ assetRef: ref, lifecycleStatus: 'DISPATCHED', assetType: type, unitOfMeasure: 'kit', quantity: '10.0000', locationZone: null, custodianCategory: 'LOGISTICS_PARTNER', ...extra });
  const hist: Record<string, unknown[]> = {
    A: [{ eventType: 'ASSET_REGISTERED', timestamp: '2026-10-03T14:20:00Z', locationZone: 'Montería', custodianCategory: 'REGIONAL_WAREHOUSE', anchorStatus: 'ANCHORED', eventHash: leaf.leaves[4], anchorProof: proof }],
    B: [
      { eventType: 'ASSET_REGISTERED', timestamp: '2026-10-04T09:15:00Z', locationZone: 'Cereté', custodianCategory: 'REGIONAL_WAREHOUSE', anchorStatus: 'IN_BATCH', eventHash: 'd'.repeat(64) },
      { eventType: lastB, timestamp: '2026-10-07T08:00:00Z', locationZone: null, custodianCategory: 'LOGISTICS_PARTNER', anchorStatus: 'PENDING', eventHash: 'e'.repeat(64) },
    ],
    B1: [{ eventType: 'ASSET_RECEIVED', timestamp: '2026-10-09T10:30:00Z', locationZone: 'Ciénaga de Oro', custodianCategory: 'LOCAL_ALLY', anchorStatus: 'UNDER_REVIEW', eventHash: 'f'.repeat(64) }],
  };
  await page.route('**/api/v1/donations/tracking**', (route) => {
    const u = new URL(route.request().url()).pathname;
    const m = u.match(/assets\/([^/]+)\/history$/);
    const body = u.endsWith('/donations/tracking')
      ? { financialSnapshot: { currency: 'COP', originalAmount: 30000000, clearedAmount: 30000000, firstClearedAt: '2026-10-02T10:14:00Z', lastClearedAt: '2026-10-02T10:14:00Z' },
        status: 'EN_PROCESO', campaignTitle: 'Inundaciones', organizationName: 'Fundación Demo',
        logistics: [lot('A', 'Kits de alimentos'), lot('B', 'Kits escolares'), lot('B1', 'Kits escolares', { parentAssetRef: 'B' })] }
      : u.endsWith('/integrity') ? { batches: [], unanchoredEvents: 0 } : u.endsWith('/narrative') ? { status: 'PENDING' } : { history: m ? hist[m[1]] ?? [] : [] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

async function open(page: Page) {
  await page.goto('/tracking');
  await page.getByLabel('Código de seguimiento').fill('TRK.prueba-arbol-8841');
  await page.getByRole('button', { name: 'Ver seguimiento' }).click();
  await expect(page.getByTestId('tracking-step')).toHaveCount(4);
}

/** La posición del camión en la carretera a lo largo de su animación (se pausa y se mueve a mano: sin carreras). */
async function truckPositions(page: Page) {
  return page.getByTestId('snake-truck').evaluate((el) => {
    const anims = el.getAnimations();
    if (anims.length === 0) return { animations: 0, samples: [getComputedStyle(el).offsetDistance] };
    const a = anims[0];
    a.pause();
    const total = Number(a.effect!.getComputedTiming().duration);
    const samples = [0, 0.5, 0.999].map((f) => { a.currentTime = total * f; return getComputedStyle(el).offsetDistance; });
    return { animations: anims.length, samples };
  });
}

test.describe('P-2: línea de tiempo verificable', () => {
  test('1280 px: tres columnas; el detalle sigue al paso elegido; la prueba se comprueba en el navegador', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await routeTracking(page, 'ASSET_DISPATCHED');
    await open(page);
    const [left, tree, right] = await Promise.all([
      page.getByRole('complementary', { name: 'Detalle y verificación' }).boundingBox(),
      page.getByTestId('tracking-tree').boundingBox(),
      page.getByRole('complementary', { name: 'Recorrido de tu donación' }).boundingBox(),
    ]);
    expect(left!.x).toBeLessThan(tree!.x);
    expect(tree!.x + tree!.width).toBeLessThanOrEqual(right!.x + 1);
    expect(Math.abs(left!.y - tree!.y)).toBeLessThan(80);

    // El sublote dentro de su padre
    await expect(page.locator('[data-testid="asset-lane"][data-depth="1"]')).toContainText('Sublote');
    const detail = page.getByTestId('step-detail');
    await expect(detail).toHaveAttribute('aria-live', 'polite');
    await page.getByRole('list', { name: 'Recorrido de Kits de alimentos' }).getByRole('button', { name: /Registrado/ }).click();
    await expect(detail).toContainText('ASSET_REGISTERED');
    await detail.getByRole('button', { name: 'Comprobar en mi navegador' }).click();
    await expect(detail.getByTestId('verify-result')).toHaveAttribute('data-result', 'match');
    await expect(detail.getByTestId('tx-link')).toHaveAttribute('href', `https://amoy.polygonscan.com/tx/${PROOF.transactionHash}`);
    // Con el teclado: Tab hasta el paso del sublote y Enter
    const sub = page.getByRole('list', { name: 'Recorrido de Kits escolares' }).last().getByRole('button', { name: /Recibido/ });
    await sub.focus();
    await page.keyboard.press('Enter');
    await expect(detail).toContainText('ASSET_RECEIVED');
    await expect(detail.getByTestId('anchor-pill')).toHaveAttribute('data-status', 'UNDER_REVIEW');
  });

  test('una prueba alterada da "No coincide" en el navegador (negativa)', async ({ page }) => {
    await routeTracking(page, 'ASSET_DISPATCHED', { ...PROOF, path: PROOF.path.map((p, i) => (i === 1 ? { ...p, hash: (p.hash[0] === 'a' ? 'b' : 'a') + p.hash.slice(1) } : p)) });
    await open(page);
    const detail = page.getByTestId('step-detail');
    await page.getByRole('list', { name: 'Recorrido de Kits de alimentos' }).getByRole('button', { name: /Registrado/ }).click();
    await detail.getByRole('button', { name: 'Comprobar en mi navegador' }).click();
    await expect(detail.getByTestId('verify-result')).toHaveAttribute('data-result', 'mismatch');
    await expect(detail.getByTestId('verify-result')).toContainText('No coincide');
  });

  test('el camión de la serpiente conduce hasta la estación del despacho (la posición calculada cambia)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await routeTracking(page, 'ASSET_DISPATCHED');
    await open(page);
    await page.getByTestId('snake').getByRole('tab', { name: 'Kits escolares 2' }).click();
    await expect(page.getByTestId('snake-truck')).toHaveAttribute('data-driving', 'true');
    const { animations, samples } = await truckPositions(page);
    expect(animations).toBe(1);
    const [a, b, c] = samples.map((x) => parseFloat(x));
    expect(a).toBeCloseTo(50, 0); // 3 estaciones (pago, registrado, despachado): de la 2.ª (50 %) a la 3.ª (100 %)
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  test('con otro evento final, el camión queda parado en esa estación (negativa del movimiento)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await routeTracking(page, 'ASSET_RECEIVED');
    await open(page);
    await page.getByTestId('snake').getByRole('tab', { name: 'Kits escolares 2' }).click();
    await expect(page.getByTestId('snake-truck')).toHaveAttribute('data-driving', 'false');
    const { animations, samples } = await truckPositions(page);
    expect(animations).toBe(0);
    expect(samples).toEqual(['100%']);
    await expect(page.getByTestId('tracking-truck')).toHaveCount(0);
  });

  test('con "reducir movimiento", sin conducción: el camión aparece ya en la estación', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await routeTracking(page, 'ASSET_DISPATCHED');
    await open(page);
    await page.getByTestId('snake').getByRole('tab', { name: 'Kits escolares 2' }).click();
    const { animations, samples } = await truckPositions(page);
    expect(animations).toBe(0);
    expect(samples).toEqual(['100%']);
  });

  test('390 px: una columna con la serpiente debajo; sin scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 860 });
    await routeTracking(page, 'ASSET_DISPATCHED');
    await open(page);
    const tree = await page.getByTestId('tracking-tree').boundingBox();
    const snake = await page.getByTestId('snake').boundingBox();
    expect(snake!.y).toBeGreaterThan(tree!.y + tree!.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('servidor falso: una donación real trae fecha del pago, huellas y una prueba que coincide en el navegador', async ({ page, request }) => {
    const code = await paidDonationWithAsset(request);
    await page.goto('/tracking');
    await page.getByLabel('Código de seguimiento').fill(code);
    await page.getByRole('button', { name: 'Ver seguimiento' }).click();
    await expect(page.getByTestId('root-date')).toBeVisible();
    const detail = page.getByTestId('step-detail');
    await page.getByTestId('tracking-step').first().getByRole('button').click();
    await detail.getByRole('button', { name: 'Comprobar en mi navegador' }).click();
    await expect(detail.getByTestId('verify-result')).toHaveAttribute('data-result', 'match');
  });
});

/** Donación pagada y un activo registrado con ella (como en golden-path), en el doble del backend. */
async function paidDonationWithAsset(request: APIRequestContext): Promise<string> {
  const { publicCode } = await (await request.post(`${API}/__test/campaigns`, { data: { title: 'Convocatoria P-2' } })).json();
  const intent = await (await request.post(`${API}/api/v1/public/campaigns/${publicCode}/donation-intents`, {
    headers: { 'Command-Id': crypto.randomUUID() }, data: { amount: '2500000', currency: 'COP', paymentMethod: 'GATEWAY' },
  })).json();
  await request.post(`${API}/__test/payments`, { data: { intentId: intent.intentId } });
  const status = await (await request.get(`${API}/api/v1/public/donation-intents/${intent.intentId}`, { headers: { 'Intent-Token': intent.statusToken } })).json();
  const { fundId } = await (await request.get(`${API}/__test/intents/${intent.intentId}/fund`)).json();
  const { token } = await (await request.post(`${API}/api/v1/auth/login`, { data: { email: 'empleado@demo.test', password: 'demo-empleado' } })).json();
  const r = await request.post(`${API}/api/v1/physical-assets/register`, {
    headers: { Authorization: `Bearer ${token}`, 'Command-Id': crypto.randomUUID() },
    data: { fundId, allocationId: 'alloc-p2', assetType: 'Mercado', quantity: '3', unitOfMeasure: 'kit', custodianRef: 'BODEGA-1', currentLocation: 'Bodega central' },
  });
  expect(r.status()).toBeLessThan(300);
  return status.trackingCode;
}
