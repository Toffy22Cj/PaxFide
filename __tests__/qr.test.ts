import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { encodeQr } from '../src/lib/qr';

/**
 * Huellas de las matrices que genera la implementación de referencia (Project Nayuki, `qrcodegen` de Python, nivel M,
 * máscara automática), calculadas el 2026-10-07. La comparación completa (8 máscaras + automática, 5 textos) se
 * ejecutó contra la referencia y está en `Documentos/evidencia-web/`.
 */
const VECTORS: [string, number, string][] = [
  ['https://paxfide.org/c/01JDEMOPUBLICC0DEMONETARY1', 33, 'a6374815b673b70850ebbee3aee9e921e1adb9be446e775b38407824cf460667'],
  ['x'.repeat(150), 49, '1336208e161628515a3ac797a4b047f50e23d84e84231684e6f31c281d616932'],
  ['ñandú €', 21, '7f02936285707df2ff96da5a92867deaf41c21fdf5173bb1c12b1b3abba498bd'],
];

describe('Codificador QR propio', () => {
  it.each(VECTORS)('coincide con la referencia: %s', (text, size, sha) => {
    const m = encodeQr(text);
    expect(m.length).toBe(size);
    const flat = m.map((r) => r.map((b) => (b ? '1' : '0')).join('')).join('');
    expect(createHash('sha256').update(flat).digest('hex')).toBe(sha);
  });

  it('texto demasiado largo para la versión 10 → error explícito', () => {
    expect(() => encodeQr('x'.repeat(300))).toThrow('Texto demasiado largo para el QR');
  });
});
