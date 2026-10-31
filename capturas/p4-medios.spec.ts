// Ref: plan-fase7-puesta-al-dia.md §1.1 (sin boceto: capturas en claro y oscuro a 390 y 1280 px) y P-4: logo en "Mi
// organización", portada en la configuración, la portada en la tarjeta y en el detalle, la foto de la entrega y
// "Retirar una foto". Las imágenes son PNG de prueba.
import { test, expect, type Page, type Browser } from '@playwright/test';
import path from 'path';
import zlib from 'zlib';
import { attachDeliveryPhoto } from '../e2e/support/evidence';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

/** Un PNG liso de 160 × 90 en un color (para que la captura muestre algo legible). */
function solidPng(r: number, g: number, b: number, w = 160, h = 90): Buffer {
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function login(page: Page, to: string, email: string, password: string) {
  await page.goto(to);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(`${to.replace(/\//g, '\\/')}$`));
  await expect(page.getByTestId('panel-portal')).toHaveCount(0);
}
const ctx = async (browser: Browser, width: number, scheme: 'light' | 'dark') =>
  (await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme })).newPage();

for (const width of [390, 1280]) {
  for (const [scheme, tema] of [['light', 'claro'], ['dark', 'oscuro']] as const) {
    test(`p4 ${tema} ${width}`, async ({ browser }) => {
      if (test.info().project.name !== '1280') return;
      test.setTimeout(150_000);
      const shot = (p: Page, name: string, fullPage = true) => p.screenshot({ path: path.join(OUT, `p4-${name}__${tema}__${width}.png`), fullPage });

      // Logo (representante): vista previa antes de subir y logo guardado
      const rep = await ctx(browser, width, scheme);
      await login(rep, '/panel/organization', 'representante@demo.test', 'demo-representante');
      const logo = rep.getByTestId('image-editor-logo');
      await logo.getByTestId('image-file-logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: solidPng(32, 96, 76, 120, 120) });
      await expect(logo.getByTestId('image-preview')).toBeVisible();
      await logo.scrollIntoViewIfNeeded();
      await shot(rep, 'logo-vista-previa');
      await logo.getByRole('button', { name: 'Guardar logo' }).click();
      await expect(logo.getByTestId('org-logo')).toBeVisible();
      await logo.getByRole('button', { name: 'Quitar logo' }).click();
      await shot(rep, 'logo-quitar');
      await logo.getByRole('button', { name: 'Sí, quitar' }).click();
      await expect(logo.getByTestId('logo-initial')).toBeVisible();
      await rep.context().close();

      // Portada (administrador) y su aparición pública
      const admin = await ctx(browser, width, scheme);
      await login(admin, '/panel/configuration', 'admin@demo.test', 'demo-admin');
      await admin.getByRole('button', { name: 'Ver configuración' }).click();
      const cover = admin.getByTestId('image-editor-portada');
      await cover.getByTestId('image-file-portada').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: solidPng(243, 181, 68) });
      await cover.getByRole('button', { name: 'Guardar portada' }).click();
      await expect(cover.getByTestId('cover-current')).toBeVisible();
      await cover.scrollIntoViewIfNeeded();
      await shot(admin, 'portada-configuracion');
      const code = (await cover.getByTestId('cover-current').getAttribute('src'))!.match(/campaigns\/([^/]+)\/cover/)![1];
      const pub = await ctx(browser, width, scheme);
      await pub.goto(`/c/${code}`);
      await expect(pub.getByTestId('campaign-detail-cover')).toBeVisible();
      await pub.waitForTimeout(500);
      await shot(pub, 'portada-detalle', false);
      await pub.goto('/campaigns');
      await expect(pub.getByTestId('campaign-cover').first()).toBeVisible();
      await pub.waitForTimeout(500);
      await shot(pub, 'portada-tarjetas', false);
      await pub.context().close();
      await cover.getByRole('button', { name: 'Quitar portada' }).click();
      await cover.getByRole('button', { name: 'Sí, quitar' }).click();
      await admin.context().close();

      // Foto de la entrega (empleado) y su retirada (plataforma)
      const emp = await ctx(browser, width, scheme);
      await login(emp, '/panel', 'empleado@demo.test', 'demo-empleado');
      await emp.getByRole('button', { name: 'Registrar activo' }).click();
      await emp.getByLabel('Tipo de bien').fill('Mercado');
      await emp.getByLabel('Cantidad').fill('3');
      await emp.getByLabel('Unidad de medida').fill('kit');
      await emp.getByLabel('Custodio (referencia)').fill('BODEGA-1');
      await emp.getByLabel('Ubicación actual').fill('Bodega central');
      await emp.getByRole('button', { name: 'Registrar' }).click();
      await expect(emp).toHaveURL(/\/assets\//);
      await emp.getByRole('button', { name: 'Despachar', exact: true }).click();
      await emp.getByRole('dialog').getByLabel('Transportista (referencia)').fill('TRANS-1');
      await emp.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
      await expect(emp.getByTestId('field-lifecycleStatus')).toHaveText('Despachado');
      await emp.getByRole('button', { name: 'Entregar', exact: true }).click();
      const dialog = emp.getByRole('dialog');
      await dialog.getByLabel('Custodio final (referencia)').fill('ALIADO-1');
      await dialog.getByLabel('Beneficiario (referencia)').fill('BEN-1');
      await dialog.getByLabel('Lugar de entrega (referencia)').fill('LUGAR-1');
      await attachDeliveryPhoto(dialog);
      await dialog.getByRole('button', { name: 'Confirmar' }).click();
      await expect(emp.getByTestId('evidence-img')).toBeVisible();
      await emp.getByTestId('evidence-photo').scrollIntoViewIfNeeded();
      await shot(emp, 'evidencia-foto');
      await emp.context().close();

      const plat = await ctx(browser, width, scheme);
      await login(plat, '/panel/platform', 'plataforma@demo.test', 'demo-plataforma');
      const form = plat.getByTestId('remove-photo-form');
      await form.getByLabel('Organización (identificador)').fill('org-1');
      await form.getByLabel('Tipo').selectOption('CAMPAIGN_COVER');
      await form.getByLabel(/Convocatoria \(referencia\)/).fill('camp-demo-1');
      await form.getByLabel(/Motivo/).fill('Imagen con datos personales');
      await form.getByRole('button', { name: 'Retirar foto' }).click();
      await expect(plat.getByText('Foto retirada')).toBeVisible();
      await form.scrollIntoViewIfNeeded();
      await shot(plat, 'plataforma-retirar', false);
      await plat.context().close();
    });
  }
}
