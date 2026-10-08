/**
 * Presentación de cantidades de activos (D-07, instrucción de Carlos 2026-10-08): el backend las envía con escala 4
 * (`"6.0000"`); se muestran sin ceros sobrantes, con coma decimal y punto de miles, como los importes
 * (`"6.0000"` → `"6"`, `"2.5000"` → `"2,5"`, `"1500.1250"` → `"1.500,125"`). Solo cambia la forma: nunca se redondea
 * ni se convierte a número. Un valor que no sea un decimal de dígitos se muestra tal cual.
 */
export function formatQuantity(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const raw = String(value).trim();
  const m = raw.match(/^(\d+)(?:\.(\d+))?$/);
  if (!m) return raw;
  const intPart = m[1].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const frac = (m[2] ?? '').replace(/0+$/, '');
  return frac ? `${intPart},${frac}` : intPart;
}
