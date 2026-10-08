import { describe, it, expect } from 'vitest';
import { formatQuantity } from '../src/lib/quantity';

describe('formatQuantity (D-07): sin ceros sobrantes, coma decimal y punto de miles', () => {
  it('quita los ceros de la escala 4 del backend', () => {
    expect(formatQuantity('6.0000')).toBe('6');
    expect(formatQuantity('4.0000')).toBe('4');
    expect(formatQuantity('2.5000')).toBe('2,5');
    expect(formatQuantity('0.1250')).toBe('0,125');
    expect(formatQuantity('10')).toBe('10');
  });
  it('agrupa miles y nunca redondea', () => {
    expect(formatQuantity('1500.1250')).toBe('1.500,125');
    expect(formatQuantity('123456789.0001')).toBe('123.456.789,0001');
    expect(formatQuantity('007.10')).toBe('7,1');
  });
  it('lo que no es un decimal de dígitos se muestra tal cual', () => {
    expect(formatQuantity('abc')).toBe('abc');
    expect(formatQuantity('-1.50')).toBe('-1.50');
    expect(formatQuantity(undefined)).toBe('');
    expect(formatQuantity(3)).toBe('3');
  });
});
