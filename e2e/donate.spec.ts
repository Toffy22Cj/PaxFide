import { test, expect, Request } from '@playwright/test';

const API = 'http://localhost:3002';

async function newCampaign(request: any): Promise<string> {
  const r = await request.post(`${API}/__test/campaigns`, { data: { title: 'Convocatoria e2e' } });
  return (await r.json()).publicCode;
}

test.describe('/c/:publicCode — SSR (P-W2, P-W3)', () => {
  test('SSR con noindex y Open Graph, sin og:url', async ({ request }) => {
    const code = await newCampaign(request);
    const r = await request.get(`/c/${code}`);
    expect(r.status()).toBe(200);
    const html = await r.text();
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    expect(html).toContain('<meta property="og:title" content="Convocatoria e2e"');
    expect(html).not.toContain('og:url');
    expect(html).toContain('Fundación Demo');
  });

  test('código inexistente → HTTP 404 con el estado "no encontrada"', async ({ page, request }) => {
    const r = await request.get('/c/NOEXISTE0000000000000000000');
    expect(r.status()).toBe(404);
    await page.goto('/c/NOEXISTE0000000000000000000');
    await expect(page.getByText('No encontramos esta convocatoria. Verifica el enlace.')).toBeVisible();
  });
});

test.describe('Donar sin cuenta (CV-11) → pago simulado → trackingCode', () => {
  test('recorrido completo; ningún secreto en URLs ni almacenamiento; Intent-Token solo en cabecera', async ({ page, request }) => {
    const code = await newCampaign(request);
    const requests: Request[] = [];
    page.on('request', (r) => requests.push(r));

    await page.goto(`/c/${code}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Convocatoria e2e' })).toBeVisible();
    await page.getByLabel('Monto (COP)').fill('50000');
    await page.getByLabel('Medio de pago').selectOption('GATEWAY');
    const created = page.waitForResponse((r) => r.url().includes('/donation-intents') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Donar' }).click();
    const body = await (await created).json();
    await expect(page.getByText('Intención de donación registrada')).toBeVisible();
    await expect(page.getByText('Redirección a la pasarela de pago (simulada)')).toBeVisible();

    // Antes de que el proveedor confirme: pendiente
    await page.getByRole('button', { name: 'Consultar estado del pago' }).click();
    await expect(page.getByText('El pago todavía está pendiente de confirmación.')).toBeVisible();

    // El test hace de proveedor de pago (webhook simulado)
    await request.post(`${API}/__test/payments`, { data: { intentId: body.intentId } });
    await page.getByRole('button', { name: 'Consultar estado del pago' }).click();
    const tracking = page.getByTestId('tracking-code');
    await expect(tracking).toBeVisible();
    const trackingCode = (await tracking.textContent())!.trim();
    expect(trackingCode.length).toBeGreaterThan(10);

    const statusRequests = requests.filter((r) => r.url().includes('/public/donation-intents/'));
    expect(statusRequests.length).toBe(2);
    for (const r of statusRequests) {
      expect((await r.allHeaders())['intent-token']).toBe(body.statusToken);
      expect(r.url()).not.toContain(body.statusToken);
    }
    for (const r of requests) {
      expect(r.url()).not.toContain(body.statusToken);
      expect(r.url()).not.toContain(trackingCode);
      const h = await r.allHeaders();
      if (new URL(r.url()).port === '3000') expect(h['intent-token']).toBeUndefined();
    }
    expect(page.url()).not.toContain(trackingCode);
    const stored = await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage) + document.cookie);
    expect(stored).not.toContain(body.statusToken);
    expect(stored).not.toContain(trackingCode);
  });

  test('5xx tras aplicar → ambiguo; Reintentar reenvía el MISMO Command-Id y recibe la misma intención', async ({ page, request }) => {
    const code = await newCampaign(request);
    await request.post(`${API}/__test/fail-next`, {
      data: { prefix: `/public/campaigns/${code}/donation-intents`, mode: '503', applyThenFail: true },
    });
    const posts: Request[] = [];
    page.on('request', (r) => { if (r.url().includes('/donation-intents') && r.method() === 'POST') posts.push(r); });

    await page.goto(`/c/${code}`);
    await page.getByLabel('Monto (COP)').fill('20000');
    await page.getByLabel('Medio de pago').selectOption('BANK_TRANSFER');
    await page.getByRole('button', { name: 'Donar' }).click();
    await expect(page.getByText('No pudimos confirmar la operación')).toBeVisible();
    // Nunca reintenta solo
    await page.waitForTimeout(1500);
    expect(posts.length).toBe(1);

    const second = page.waitForResponse((r) => r.url().includes('/donation-intents') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Reintentar' }).click();
    expect((await second).status()).toBe(201);
    await expect(page.getByText('Intención de donación registrada')).toBeVisible();
    expect(posts.length).toBe(2);
    const id1 = (await posts[0].allHeaders())['command-id'];
    const id2 = (await posts[1].allHeaders())['command-id'];
    expect(id1).toMatch(/^[0-9a-f-]{36}$/);
    expect(id2).toBe(id1);
  });

  test('convocatoria cerrada → sin formulario de donación', async ({ page }) => {
    await page.goto('/c/01JDEMOPUBLICC0DECLOSED001');
    await expect(page.getByText('Esta convocatoria está cerrada y ya no recibe donaciones.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Donar' })).toHaveCount(0);
  });
});
