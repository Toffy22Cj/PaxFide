/**
 * Importes del backend: cadena de dígitos en **unidades mínimas** de la moneda ISO 4217 (ficha CV-01, Q-CV01-3; T-34).
 * Aquí solo se presenta y se convierte sin coma flotante: nunca se redondea (DW-14).
 */

/** Decimales de la moneda (exponente ISO 4217) según CLDR del navegador; 2 si la moneda no se reconoce. */
export function currencyExponent(currency: string): number {
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `"150000050"`, `"COP"` → `"1.500.000,50 COP"`. Si no son dígitos, se devuelve tal cual (no se interpreta). */
export function formatMinorUnits(amount: string, currency?: string): string {
  if (!/^\d+$/.test(amount)) return currency ? `${amount} ${currency}` : amount;
  const exp = currency ? currencyExponent(currency) : 0;
  const padded = amount.padStart(exp + 1, '0');
  const intPart = padded.slice(0, padded.length - exp).replace(/^0+(?=\d)/, '');
  const frac = exp > 0 ? padded.slice(padded.length - exp) : '';
  const text = groupThousands(intPart) + (frac && !/^0+$/.test(frac) ? `,${frac}` : '');
  return currency ? `${text} ${currency}` : text;
}

/**
 * Convierte lo que escribe el donante (unidades de la moneda, con coma o punto decimal y sin separador de miles) a
 * unidades mínimas. Devuelve `null` si no es un importe válido o tiene más decimales de los que admite la moneda.
 */
export function toMinorUnits(input: string, currency: string): string | null {
  const exp = currencyExponent(currency);
  const m = input.trim().match(/^(\d{1,15})(?:[.,](\d+))?$/);
  if (!m) return null;
  const frac = m[2] ?? '';
  if (frac.length > exp) return null;
  const minor = (m[1] + frac.padEnd(exp, '0')).replace(/^0+(?=\d)/, '');
  return /^0+$/.test(minor) ? null : minor;
}

/** Porcentaje entero (truncado) de `part` sobre `total`, ambos en dígitos; `null` si no se puede calcular. */
export function percentOf(part: string, total: string): number | null {
  if (!/^\d+$/.test(part) || !/^\d+$/.test(total)) return null;
  const t = BigInt(total);
  if (t === BigInt(0)) return null;
  return Number((BigInt(part) * BigInt(100)) / t);
}
