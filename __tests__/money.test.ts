import { describe, it, expect } from 'vitest';
import { formatMinorUnits, toMinorUnits, percentOf } from '../src/lib/money';

describe('Importes en unidades mínimas (T-34, Q-CV01-3)', () => {
  it('formatea sin redondear ni usar coma flotante', () => {
    expect(formatMinorUnits('150000050', 'COP')).toBe('1.500.000,50 COP');
    expect(formatMinorUnits('5000000', 'COP')).toBe('50.000 COP');
    expect(formatMinorUnits('7', 'COP')).toBe('0,07 COP');
    expect(formatMinorUnits('1500', 'JPY')).toBe('1.500 JPY');
    expect(formatMinorUnits('99999999999999999999', 'USD')).toBe('999.999.999.999.999.999,99 USD');
  });

  it('lo que no son dígitos se muestra tal cual', () => {
    expect(formatMinorUnits('abc', 'COP')).toBe('abc COP');
  });

  it('convierte lo escrito por el donante a unidades mínimas', () => {
    expect(toMinorUnits('50000', 'COP')).toBe('5000000');
    expect(toMinorUnits('50000,5', 'COP')).toBe('5000050');
    expect(toMinorUnits('50000.55', 'COP')).toBe('5000055');
    expect(toMinorUnits('1500', 'JPY')).toBe('1500');
  });

  it('rechaza importes inválidos, cero o con demasiados decimales', () => {
    for (const bad of ['', '0', '0,00', '-5', '1.000.000', '12,345', 'abc', '1e5']) {
      expect(toMinorUnits(bad, 'COP')).toBeNull();
    }
    expect(toMinorUnits('15,5', 'JPY')).toBeNull();
  });

  it('porcentaje entero truncado', () => {
    expect(percentOf('2500', '10000')).toBe(25);
    expect(percentOf('9999', '10000')).toBe(99);
    expect(percentOf('15000', '10000')).toBe(150);
    expect(percentOf('1', '0')).toBeNull();
  });
});
