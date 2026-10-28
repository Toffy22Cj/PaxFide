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
