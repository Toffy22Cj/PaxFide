/**
 * Importes del backend: cadena de dígitos en **unidades mínimas** de la moneda ISO 4217 (ficha CV-01, Q-CV01-3; T-34).
 * Aquí solo se presenta y se convierte sin coma flotante: nunca se redondea (DW-14).
 */

/**
 * Exponente (decimales) de cada moneda activa según la tabla ISO 4217 (lista A1). DW-14, ratificada con ajuste por
 * Carlos: el exponente sale de esta tabla y no de `Intl`, que depende del navegador (CLDR).
 */
const ISO_4217_EXPONENT: Record<string, number> = {
  ...Object.fromEntries(['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'UYI', 'VND',
    'VUV', 'XAF', 'XOF', 'XPF'].map((c) => [c, 0])),
  ...Object.fromEntries(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'].map((c) => [c, 3])),
  ...Object.fromEntries(['CLF', 'UYW'].map((c) => [c, 4])),
  ...Object.fromEntries(['AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN',
    'BMD', 'BND', 'BOB', 'BOV', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHE', 'CHF', 'CHW', 'CNY',
    'COP', 'COU', 'CRC', 'CUP', 'CVE', 'CZK', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP',
    'GEL', 'GHS', 'GIP', 'GMD', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IRR', 'JMD', 'KES',
    'KGS', 'KHR', 'KPW', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT',
    'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MXV', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'PAB',
    'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'QAR', 'RON', 'RSD', 'RUB', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP',
    'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS',
    'UAH', 'USD', 'USN', 'UYU', 'UZS', 'VED', 'VES', 'WST', 'XCD', 'YER', 'ZAR', 'ZMW', 'ZWG'].map((c) => [c, 2])),
};

/** Decimales de la moneda según ISO 4217; `null` si el código no está en la tabla (nunca se supone). */
export function currencyExponent(currency: string): number | null {
  const exp = ISO_4217_EXPONENT[currency.toUpperCase()];
  return exp === undefined ? null : exp;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** `"150000050"`, `"COP"` → `"1.500.000,50 COP"`. Si no son dígitos, se devuelve tal cual (no se interpreta). */
export function formatMinorUnits(amount: string, currency?: string): string {
  if (!/^\d+$/.test(amount)) return currency ? `${amount} ${currency}` : amount;
  const exp = currency ? currencyExponent(currency) : 0;
  // Moneda fuera de la tabla: se muestra el entero tal cual, diciendo que son unidades mínimas (no se convierte)
  if (exp === null) return `${amount} (unidades mínimas) ${currency}`;
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
  if (exp === null) return null;
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
