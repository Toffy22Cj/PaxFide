// Ref: prompts-agentes-estilo-v2.md §4 (EVIDENCIA); plan-fase7-pantallas.md §1.5 y A-4. Capturas en claro (DF7-17) a
// 390 y 1280 px de la línea de tiempo. Las respuestas del seguimiento se sirven aquí con datos de PRUEBA (dos bienes,
// uno despachado) solo para la captura; el código de la captura no es real.
import { test, expect } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');
const TRACKING = {
  financialSnapshot: { currency: 'COP', originalAmount: 30000000, clearedAmount: 30000000, pendingAllocationAmount: 0, confirmedAllocationAmount: 30000000, refundedAmount: 0 },
  campaignTitle: 'Mercados para adultos mayores', organizationName: 'Fundación Demo', status: 'EN_PROCESO',
  logistics: [
    { assetRef: 'A1', lifecycleStatus: 'DELIVERED', assetType: 'Mercado', unitOfMeasure: 'kit', quantity: '60.0000', locationZone: 'Zona centro', custodianCategory: 'LOCAL_ALLY' },
    { assetRef: 'A2', lifecycleStatus: 'DISPATCHED', assetType: 'Mercado', unitOfMeasure: 'kit', quantity: '40.0000', locationZone: null, custodianCategory: 'LAST_MILE_CARRIER' },
  ],
};
const HISTORY: Record<string, unknown[]> = {
  A1: [
    { eventType: 'ASSET_REGISTERED', timestamp: '2026-10-08T14:00:00Z', locationZone: 'Zona norte', custodianCategory: 'REGIONAL_WAREHOUSE', status: 'REGISTERED' },
    { eventType: 'ASSET_DISPATCHED', timestamp: '2026-10-09T09:15:00Z', locationZone: null, custodianCategory: 'LAST_MILE_CARRIER', status: 'DISPATCHED' },
    { eventType: 'ASSET_RECEIVED', timestamp: '2026-10-10T11:30:00Z', locationZone: 'Zona centro', custodianCategory: 'LOCAL_ALLY', status: 'RECEIVED' },
    { eventType: 'ASSET_DELIVERED', timestamp: '2026-10-10T15:20:00Z', locationZone: 'Zona centro', custodianCategory: 'LOCAL_ALLY', status: 'DELIVERED' },
  ],
  A2: [
    { eventType: 'ASSET_REGISTERED', timestamp: '2026-10-08T14:00:00Z', locationZone: 'Zona norte', custodianCategory: 'REGIONAL_WAREHOUSE', status: 'REGISTERED' },
    { eventType: 'ASSET_DISPATCHED', timestamp: '2026-10-11T08:00:00Z', locationZone: null, custodianCategory: 'LAST_MILE_CARRIER', status: 'DISPATCHED' },
  ],
};

for (const width of [390, 1280]) {
  test(`vs7 seguimiento ${width}`, async ({ page }) => {
    if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
    await page.setViewportSize({ width, height: 860 });
    await page.route('**/api/v1/donations/tracking**', async (route) => {
      const u = new URL(route.request().url()).pathname;
      const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (u.endsWith('/donations/tracking')) return json(TRACKING);
      if (u.endsWith('/narrative')) return json({ status: 'AVAILABLE', content: 'Tu donación se convirtió en mercados que ya llegaron a la comunidad.', source: 'LLM_GENERATED' });
      if (u.endsWith('/integrity')) return json({ batches: [{ anchorStatus: 'ANCHORED', merkleRoot: '0x' + 'ab'.repeat(32), transactionHash: '0x' + 'cd'.repeat(32), network: 'red de prueba', anchoredAt: '2026-10-10T16:00:00Z', confirmedBlockNumber: 42, eventsOfThisDonation: 6, verification: { result: 'MATCH' } }], unanchoredEvents: 0, checkedAt: '2026-10-11T09:00:00Z' });
      const m = u.match(/assets\/([^/]+)\/history$/);
      return m ? json({ history: HISTORY[m[1]] ?? [] }) : json({}, 404);
    });
    await page.goto('/tracking');
    await page.getByLabel('Código de seguimiento').fill('TRK.captura-de-prueba-8841');
    await page.getByRole('button', { name: 'Ver seguimiento' }).click();
    await expect(page.getByTestId('integrity-verdict')).toBeVisible();
    await expect(page.getByTestId('tracking-step').first()).toBeVisible();
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `vs7-tracking__claro__${width}.png`), fullPage: true });
  });
}
