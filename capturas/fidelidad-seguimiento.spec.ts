// Ref: plan-fase7-fidelidad.md §1 (punto 2: lado a lado) y F-A5; plan-fase7-puesta-al-dia.md P-2. Boceto
// (paxfide-linea-tiempo.html, escenario por defecto) y app con datos de PRUEBA equivalentes: dos lotes, un sublote, un
// paso anclado con prueba, uno en revisión y la foto de una entrega. Claro y oscuro, 390 y 1280 px.
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'Documentos', 'evidencia-web', 'capturas', 'fidelidad', 'seguimiento');
const V = JSON.parse(fs.readFileSync(path.join(ROOT, '__tests__', 'fixtures', 'merkle-proof-vectors.json'), 'utf8'));
const leaf = V.find((v: { description: string }) => v.description === '5 hojas, indice 2');
const h = (c: string) => c.repeat(64);

const TRACKING = {
  financialSnapshot: { currency: 'COP', originalAmount: 30000000, clearedAmount: 30000000, pendingAllocationAmount: 0, confirmedAllocationAmount: 30000000, refundedAmount: 0, firstClearedAt: '2026-10-02T15:14:00Z', lastClearedAt: '2026-10-02T15:14:00Z' },
  campaignTitle: 'Inundaciones La Mojana', organizationName: 'Fundación Demo', status: 'EN_PROCESO',
  logistics: [
    { assetRef: 'A', lifecycleStatus: 'DELIVERED', assetType: 'Kits de alimentos', unitOfMeasure: 'kits', quantity: '120.0000', locationZone: 'Lorica', custodianCategory: 'LOCAL_ALLY' },
    { assetRef: 'B', lifecycleStatus: 'DISPATCHED', assetType: 'Kits escolares', unitOfMeasure: 'kits', quantity: '40.0000', locationZone: null, custodianCategory: 'LOGISTICS_PARTNER' },
    { assetRef: 'B1', parentAssetRef: 'B', lifecycleStatus: 'RECEIVED', assetType: 'Kits escolares', unitOfMeasure: 'kits', quantity: '40.0000', locationZone: 'Ciénaga de Oro', custodianCategory: 'LOCAL_ALLY' },
  ],
};
const HISTORY: Record<string, unknown[]> = {
  A: [
    { eventType: 'ASSET_REGISTERED', timestamp: '2026-10-03T19:20:00Z', locationZone: 'Montería', custodianCategory: 'REGIONAL_WAREHOUSE', anchorStatus: 'ANCHORED', eventHash: leaf.leaves[2], anchorProof: { merkleRoot: leaf.root, leafIndex: 2, path: leaf.path, transactionHash: '0x' + 'cd'.repeat(32), network: 'sepolia', anchoredAt: '2026-10-04T00:00:00Z' } },
    { eventType: 'ASSET_DISPATCHED', timestamp: '2026-10-06T12:30:00Z', locationZone: null, custodianCategory: 'LOGISTICS_PARTNER', anchorStatus: 'ANCHORED', eventHash: h('5') },
    { eventType: 'ASSET_RECEIVED', timestamp: '2026-10-08T16:05:00Z', locationZone: 'Lorica', custodianCategory: 'LOCAL_ALLY', anchorStatus: 'IN_BATCH', eventHash: h('6') },
    { eventType: 'ASSET_DELIVERED', timestamp: '2026-10-09T20:20:00Z', locationZone: 'Lorica', custodianCategory: 'LOCAL_ALLY', anchorStatus: 'PENDING', eventHash: h('7'), evidenceRegistered: true, evidenceRef: 'sha256:' + h('9') },
  ],
  B: [
    { eventType: 'ASSET_REGISTERED', timestamp: '2026-10-04T14:15:00Z', locationZone: 'Cereté', custodianCategory: 'REGIONAL_WAREHOUSE', anchorStatus: 'ANCHORED', eventHash: h('8') },
    { eventType: 'ASSET_SPLIT', timestamp: '2026-10-05T10:00:00Z', locationZone: 'Cereté', custodianCategory: 'REGIONAL_WAREHOUSE', anchorStatus: 'IN_BATCH', eventHash: h('a') },
    { eventType: 'ASSET_DISPATCHED', timestamp: '2026-10-07T13:00:00Z', locationZone: null, custodianCategory: 'LOGISTICS_PARTNER', anchorStatus: 'PENDING', eventHash: h('b') },
  ],
  B1: [{ eventType: 'ASSET_RECEIVED', timestamp: '2026-10-09T15:30:00Z', locationZone: 'Ciénaga de Oro', custodianCategory: 'LOCAL_ALLY', anchorStatus: 'UNDER_REVIEW', eventHash: h('c') }],
};

async function routeApp(page: Page) {
  await page.route('**/api/v1/donations/tracking**', async (route) => {
    const u = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.endsWith('/donations/tracking')) return json(TRACKING);
    if (u.endsWith('/narrative')) return json({ status: 'AVAILABLE', content: 'Tu donación se convirtió en kits que ya llegaron a la comunidad.', source: 'LLM_GENERATED' });
    if (u.endsWith('/integrity')) return json({ batches: [{ anchorStatus: 'ANCHORED', merkleRoot: leaf.root, eventsOfThisDonation: 3, verification: { result: 'MATCH' } }], unanchoredEvents: 5, checkedAt: '2026-10-11T09:00:00Z' });
    const m = u.match(/assets\/([^/]+)\/history$/);
    return json({ history: (m && HISTORY[m[1]]) || [] });
  });
}

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); });

for (const width of [390, 1280]) {
  for (const scheme of ['light', 'dark'] as const) {
    const tema = scheme === 'light' ? 'claro' : 'oscuro';
    test(`fidelidad seguimiento ${tema} ${width}`, async ({ browser }) => {
      if (test.info().project.name !== '1280') return;
      test.setTimeout(90_000);
      const sk = await (await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme })).newPage();
      await sk.goto(`file://${path.join(ROOT, 'Documentos', 'paxfide-linea-tiempo.html')}`, { waitUntil: 'load' });
      if (scheme === 'dark') await sk.click('#btnThemeToggle');
      await sk.waitForTimeout(1500);
      await sk.screenshot({ path: path.join(OUT, `seguimiento__boceto__${tema}__${width}.png`), fullPage: true });
      await sk.context().close();

      const app = await (await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme })).newPage();
      await routeApp(app);
      await app.goto('/tracking');
      await app.getByLabel('Código de seguimiento').fill('TRK-2026-8841');
      await app.getByRole('button', { name: 'Ver seguimiento' }).click();
      await expect(app.getByTestId('tracking-step')).toHaveCount(8);
      await app.getByRole('list', { name: 'Recorrido de Kits de alimentos' }).getByRole('button', { name: /Registrado/ }).click();
      await app.getByTestId('step-detail').getByRole('button', { name: 'Comprobar en mi navegador' }).click();
      await expect(app.getByTestId('verify-result')).toBeVisible();
      await app.getByTestId('snake').getByRole('tab', { name: 'Kits escolares 2' }).click();
      await app.waitForTimeout(1200);
      await app.screenshot({ path: path.join(OUT, `seguimiento__app__${tema}__${width}.png`), fullPage: true });
      await app.context().close();
    });
  }
}
