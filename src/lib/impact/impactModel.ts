// Ref: plan-fase7-puesta-al-dia.md Anexo 1, U-14 y P-7 ("Mi impacto" como tarjeta). Lógica pura, sin DOM.
import type { AccountImpact } from '../api/account';
import { formatMinorUnits } from '../money';
import { formatQuantity } from '../quantity';

/** P-M21-4: texto obligatorio de las unidades (nunca "tus unidades" ni "entregaste"). */
export const DELIVERED_UNITS_LABEL = 'Unidades entregadas en las convocatorias que apoyaste';
export const TRUNCATED_NOTE = 'Se cuentan tus 100 donaciones más recientes';
export const EMPTY_TEXT = 'Aún no tienes donaciones confirmadas';

export type ImpactView =
  | { kind: 'empty' }
  | {
    kind: 'stats';
    donations: string;
    campaigns: string;
    /** Una línea por moneda: nunca un total combinado. */
    totals: string[];
    /** Una línea por unidad de medida; vacío → la sección no aparece. */
    units: string[];
    note?: string;
  };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function impactView(i: AccountImpact): ImpactView {
  // Una cuenta sin donaciones no ve cifras en cero
  if (i.donationsCount === 0) return { kind: 'empty' };
  return {
    kind: 'stats',
    donations: plural(i.donationsCount, 'donación confirmada', 'donaciones confirmadas'),
    campaigns: plural(i.campaignsSupported, 'convocatoria apoyada', 'convocatorias apoyadas'),
    totals: i.totals.map((t) => formatMinorUnits(t.amount, t.currency)),
    units: i.deliveredUnits.map((u) => `${formatQuantity(u.quantity)} ${u.unitOfMeasure}`),
    ...(i.truncated ? { note: TRUNCATED_NOTE } : {}),
  };
}
