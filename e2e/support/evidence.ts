// Ref: plan-fase7-puesta-al-dia.md U-3 y §1.1 (el ensayo también corre contra el backend real): una foto de entrega
// válida y DISTINTA en cada llamada (una foto solo sirve para un activo: 409 EvidenceAlreadyBound). PNG de 8 × 8 hecho
// aquí, sin dependencias (D8): el backend real la decodifica y la guarda limpia.
import zlib from 'zlib';
import crypto from 'crypto';
import type { Locator, Page } from '@playwright/test';

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Un PNG de 8 × 8 con píxeles al azar: cada llamada da bytes distintos. */
export function uniquePng(): Buffer {
  const w = 8, h = 8;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const noise = crypto.randomBytes(w * 3 * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; noise.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Pone una foto nueva en "Foto de la entrega" del diálogo. */
export async function attachDeliveryPhoto(dialog: Locator): Promise<void> {
  await dialog.getByLabel('Foto de la entrega').setInputFiles({ name: 'entrega.png', mimeType: 'image/png', buffer: uniquePng() });
}

/** R-1 y U-2: marca las casillas legales que haya a la vista (registro o re-aceptación del login). */
export async function acceptLegal(scope: Page | Locator): Promise<void> {
  for (const id of ['consent-terms', 'consent-dataPolicy']) {
    const box = scope.getByTestId(id);
    if (await box.count()) await box.check();
  }
}

/** U-16 (P-8): una cuenta nueva ve la bienvenida en su primer /home; "Saltar" la cierra (los tests que no la prueban). */
export async function skipWelcome(page: Page): Promise<void> {
  const layer = page.getByTestId('welcome-overlay');
  await layer.waitFor({ state: 'visible' });
  await layer.getByRole('button', { name: 'Saltar' }).click();
  await layer.waitFor({ state: 'detached' });
}

/**
 * P-6 (ADR-050 Enmienda 2): una cuenta registrada nace sin verificar. El test hace de buzón (como Mailpit): toma el
 * último enlace de verificación y lo confirma por la API, sin pasar por la pantalla.
 */
export async function verifyEmailApi(request: import('@playwright/test').APIRequestContext, email: string): Promise<void> {
  const API = 'http://localhost:3002';
  const r = await request.get(`${API}/__test/email-verification/last?email=${encodeURIComponent(email.toLowerCase())}`);
  if (!r.ok()) throw new Error(`sin correo de verificación para ${email}`);
  const { link } = await r.json();
  const token = new URLSearchParams(String(link).split('#')[1]).get('token');
  const c = await request.post(`${API}/api/v1/auth/email-verification/confirm`, { data: { token } });
  if (c.status() !== 204) throw new Error(`confirmación ${c.status()}`);
}

/** P-15 (ficha R-7): un NIT de 9 dígitos al azar con su dígito de verificación de la DIAN (cada test, uno distinto). */
export function randomNit(): { nit: string; dv: string } {
  const nit = String(100000000 + Math.floor(Math.random() * 899999999));
  const W = [3, 7, 13, 17, 19, 23, 29, 37, 41];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(nit[8 - i]) * W[i];
  const r = sum % 11;
  return { nit, dv: String(r <= 1 ? r : 11 - r) };
}
