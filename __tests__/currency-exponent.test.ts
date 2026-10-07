import { describe, it, expect } from 'vitest';
import { currencyExponent, formatMinorUnits, toMinorUnits } from '../src/lib/money';

describe('Exponente de la moneda desde la tabla ISO 4217 (DW-14, ratificada con ajuste)', () => {
  it('COP = 2', () => {
    expect(currencyExponent('COP')).toBe(2);
  });

  it('otras monedas de la tabla: 0, 2, 3 y 4 decimales', () => {
    expect(currencyExponent('JPY')).toBe(0);
    expect(currencyExponent('CLP')).toBe(0);
    expect(currencyExponent('USD')).toBe(2);
    expect(currencyExponent('EUR')).toBe(2);
    expect(currencyExponent('KWD')).toBe(3);
    expect(currencyExponent('CLF')).toBe(4);
  });

  it('no depende de Intl: aunque Intl dijera otra cosa, manda la tabla', () => {
    const original = Intl.NumberFormat;
    (Intl as any).NumberFormat = function () {
      return { resolvedOptions: () => ({ maximumFractionDigits: 0 }) };
    };
    try {
      expect(currencyExponent('COP')).toBe(2);
      expect(formatMinorUnits('5000050', 'COP')).toBe('50.000,50 COP');
    } finally {
      (Intl as any).NumberFormat = original;
    }
  });

  it('moneda fuera de la tabla: sin exponente; no se convierte ni se acepta un monto', () => {
    expect(currencyExponent('XYZ')).toBeNull();
    expect(formatMinorUnits('12345', 'XYZ')).toBe('12345 (unidades mínimas) XYZ');
    expect(toMinorUnits('10', 'XYZ')).toBeNull();
  });
});
