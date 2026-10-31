// Ref: plan-fase7-puesta-al-dia.md P-4 (U-4, U-5, U-6, U-7 y U-8); referencia-api-v1.md §3, §4, §6 y §2. Contra el
// servidor falso. Las imágenes son PNG de prueba hechos aquí (e2e/support/evidence.ts).
import { test, expect, type Page, type Request } from '@playwright/test';
import { attachDeliveryPhoto, uniquePng } from './support/evidence';

async function login(page: Page, path: string, email: string, password: string) {
  await page.goto(path);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
}
async function go(page: Page, to: string) {
  await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
  await page.evaluate((p) => (window as any).__TEST_ROUTER__.push(p), to);
  await expect(page).toHaveURL(new RegExp(`${to.replace(/\//g, '\\/')}$`));
}
/** U-4: ningún atributo `src` del DOM apunta a la API ni lleva un token. */
async function noApiSrc(page: Page) {
  const srcs = await page.evaluate(() => [...document.querySelectorAll('[src]')].map((e) => e.getAttribute('src') || ''));
  expect(srcs.filter((s) => /localhost:3002\/api\/v1\/(organizations|physical-assets)/.test(s) || /tok-|Bearer/.test(s))).toEqual([]);
}

test.describe('P-4: logo, portada y evidencia', () => {
  test('logo: el representante lo sube con vista previa; se ve como blob pedido con Authorization; quitar → inicial', async ({ page }) => {
    const logoReqs: Request[] = [];
    page.on('request', (r) => { if (/\/organizations\/org-1\/logo$/.test(r.url()) && r.method() === 'GET') logoReqs.push(r); });
    await login(page, '/panel/organization', 'representante@demo.test', 'demo-representante');
    const editor = page.getByTestId('image-editor-logo');
    await editor.getByTestId('image-file-logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: uniquePng() });
    await expect(editor.getByTestId('image-preview')).toHaveAttribute('src', /^blob:/);
    await editor.getByRole('button', { name: 'Guardar logo' }).click();
    await expect(editor.getByText('Guardamos el logo.')).toBeVisible();
    await expect(editor.getByTestId('org-logo')).toHaveAttribute('src', /^blob:/);
    expect(logoReqs.length).toBeGreaterThan(0);
    expect(logoReqs[0].headers()['authorization']).toMatch(/^Bearer /);
    await noApiSrc(page);
    await editor.getByRole('button', { name: 'Quitar logo' }).click();
    await editor.getByRole('button', { name: 'Sí, quitar' }).click();
    await expect(editor.getByTestId('logo-initial')).toHaveText('F');
    await expect(editor.getByTestId('org-logo')).toHaveCount(0);
  });

  test('logo: más de 2 MB no se sube (negativa)', async ({ page }) => {
    const puts: string[] = [];
    page.on('request', (r) => { if (r.method() === 'PUT') puts.push(r.url()); });
    await login(page, '/panel/organization', 'admin@demo.test', 'demo-admin');
    const editor = page.getByTestId('image-editor-logo');
    await editor.getByTestId('image-file-logo').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
    await expect(editor.getByText(/pesa más de 2 MB/)).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Guardar logo' })).toHaveCount(0);
    expect(puts).toEqual([]);
  });

  test('portada: el administrador la cambia; aparece en la tarjeta y en el detalle; quitarla vuelve al aspecto anterior', async ({ page, browser }) => {
    await login(page, '/panel/configuration', 'admin@demo.test', 'demo-admin');
    await page.getByRole('button', { name: 'Ver configuración' }).click();
    const editor = page.getByTestId('image-editor-portada');
    await expect(editor.getByTestId('cover-none')).toBeVisible();
    await editor.getByTestId('image-file-portada').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: uniquePng() });
    await editor.getByRole('button', { name: 'Guardar portada' }).click();
    await expect(editor.getByTestId('cover-current')).toBeVisible();
    const code = (await editor.getByTestId('cover-current').getAttribute('src'))!.match(/campaigns\/([^/]+)\/cover/)![1];

    const pub = await (await browser.newContext()).newPage();
    await pub.goto(`/c/${code}`);
    await expect(pub.getByTestId('campaign-detail-cover')).toHaveAttribute('src', new RegExp(`/public/campaigns/${code}/cover$`));
    await expect(pub.getByTestId('campaign-detail-cover')).toHaveAttribute('alt', /Portada de/);
    await pub.goto('/campaigns');
    const card = pub.getByTestId('campaign-card').filter({ has: pub.locator(`a[href="/c/${code}"]`) });
    await expect(card.getByTestId('campaign-cover')).toBeVisible();

    await editor.getByRole('button', { name: 'Quitar portada' }).click();
    await editor.getByRole('button', { name: 'Sí, quitar' }).click();
    await expect(editor.getByTestId('cover-none')).toBeVisible();
    await pub.reload();
    await expect(card.getByTestId('campaign-cover')).toHaveCount(0);
  });

  test('el representante no ve "Cambiar portada" (negativa)', async ({ page }) => {
    await login(page, '/panel/configuration', 'representante@demo.test', 'demo-representante');
    await page.getByLabel(/Referencia de la convocatoria|Convocatoria/).first().waitFor();
    await expect(page.getByText('Cambiar portada')).toHaveCount(0);
    await expect(page.getByTestId('image-editor-portada')).toHaveCount(0);
  });

  test('evidencia: el lote entregado muestra la foto como blob; la plataforma la retira → "La plataforma retiró esta foto"', async ({ page, browser }) => {
    await login(page, '/panel', 'empleado@demo.test', 'demo-empleado');
    await page.getByRole('button', { name: 'Registrar activo' }).click();
    await page.getByLabel('Tipo de bien').fill('Mercado');
    await page.getByLabel('Cantidad').fill('3');
    await page.getByLabel('Unidad de medida').fill('kit');
    await page.getByLabel('Custodio (referencia)').fill('BODEGA-1');
    await page.getByLabel('Ubicación actual').fill('Bodega central');
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page).toHaveURL(/\/assets\/[0-9a-f-]{36}$/);
    const assetPath = new URL(page.url()).pathname;
    await page.getByRole('button', { name: 'Despachar', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Transportista (referencia)').fill('TRANS-1');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Despachado');
    await page.getByRole('button', { name: 'Entregar', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Custodio final (referencia)').fill('ALIADO-1');
    await dialog.getByLabel('Beneficiario (referencia)').fill('BEN-1');
    await dialog.getByLabel('Lugar de entrega (referencia)').fill('LUGAR-1');
    const uploaded = page.waitForResponse((r) => r.url().endsWith('/delivery-evidence'));
    await attachDeliveryPhoto(dialog);
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    const { evidenceRef } = await (await uploaded).json();
    await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Entregado');
    await expect(page.getByTestId('evidence-img')).toHaveAttribute('src', /^blob:/);
    await noApiSrc(page);

    const admin = await (await browser.newContext()).newPage();
    await login(admin, '/panel/platform', 'plataforma@demo.test', 'demo-plataforma');
    const form = admin.getByTestId('remove-photo-form');
    await form.getByLabel('Organización (identificador)').fill('org-1');
    await form.getByLabel('Tipo').selectOption('DELIVERY_EVIDENCE');
    await form.getByLabel(/Huella de la foto/).fill(evidenceRef);
    await form.getByLabel(/Motivo/).fill('Se ve la cara de una persona');
    await form.getByRole('button', { name: 'Retirar foto' }).click();
    await expect(admin.getByText('Foto retirada')).toBeVisible();

    await go(page, '/panel');
    await go(page, assetPath);
    await expect(page.getByTestId('evidence-photo')).toContainText('La plataforma retiró esta foto.');
    await expect(page.getByTestId('evidence-img')).toHaveCount(0);
  });
});
