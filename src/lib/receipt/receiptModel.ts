// Ref: plan-fase7-puesta-al-dia.md Anexo 1, U-9 a U-13 y P-5 (comprobante de donación). Lógica pura, sin DOM.
import type { AccountDonation } from '../api/account';
import { formatMinorUnits } from '../money';
import { paymentMethodLabel } from '../labels';

/** U-13: tamaño fijo del PNG. */
export const RECEIPT_WIDTH = 1200;
export const RECEIPT_HEIGHT = 1600;

/** U-10: leyenda fija. */
export const RECEIPT_LEGEND =
  'Este comprobante no es un certificado de donación para efectos tributarios; ese lo expide la organización';

export interface ReceiptRow {
  label: string;
  value: string;
  /** Se dibuja en la fuente monoespaciada (referencias y enlaces). */
  mono?: boolean;
}

/**
 * Lo único que se dibuja o se imprime. U-11: nunca lleva el `trackingCode`, el correo, el `donorRef` ni el `fundId`;
 * por eso se construye campo a campo y nunca copiando la donación.
 */
export interface ReceiptModel {
  brand: 'PaxFide';
  title: 'Comprobante de donación';
  amount: string;
  rows: ReceiptRow[];
  /** Enlace a `/c/{publicCode}`, solo si llega `publicCode` (U-10). */
  link?: ReceiptRow;
  generatedAt: string;
  legend: string;
  reference: string;
  fileName: string;
}

export interface ReceiptOptions {
  /** U-12: solo si la persona marcó "Incluir mi nombre". */
  name?: string;
  /** Origen de la web para el enlace (`https://…`); sin él, el enlace es relativo. */
  origin?: string;
  /** D5: el enlace solo si la superficie `/c/:publicCode` está habilitada. */
  linkEnabled?: boolean;
  /** Fecha en que se genera (inyectable para las pruebas). */
  now?: Date;
  /** Zona horaria (inyectable para las pruebas); por defecto, la del navegador. */
  timeZone?: string;
}

/** U-10: referencia = `intentId` recortado a sus 6 últimos caracteres. */
export function receiptReference(intentId: string): string {
  return `…${Array.from(intentId).slice(-6).join('')}`;
}

/** U-10: hora local y con la zona ("28 de octubre de 2026, 3:40 p. m. GMT-5"). `null` si la fecha no es válida. */
export function formatReceiptDate(iso: string, timeZone?: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es', {
    day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(d);
}

/** U-9: solo las donaciones `CONFIRMED` tienen comprobante; el resto devuelve `null`. */
export function buildReceipt(donation: AccountDonation, options: ReceiptOptions = {}): ReceiptModel | null {
  if (donation.status !== 'CONFIRMED') return null;
  const { timeZone } = options;
  const rows: ReceiptRow[] = [];
  // U-10: si falta un campo opcional, su fila no aparece (nada de "—" ni de "Desconocido")
  const add = (label: string, value: string | null | undefined, mono = false) => {
    if (value && value.trim()) rows.push({ label, value: value.trim(), ...(mono ? { mono } : {}) });
  };
  add('Nombre', options.name);
  add('Convocatoria', donation.campaignTitle);
  add('Organización', donation.organizationName);
  add('Medio de pago', donation.paymentMethod ? paymentMethodLabel(donation.paymentMethod) : undefined);
  add('Fecha de la donación', donation.createdAt ? formatReceiptDate(donation.createdAt, timeZone) : undefined);
  add('Pago confirmado', donation.confirmedAt ? formatReceiptDate(donation.confirmedAt, timeZone) : undefined);
  const reference = receiptReference(donation.intentId);
  add('Referencia', reference, true);
  const link: ReceiptRow | undefined = donation.publicCode && options.linkEnabled !== false
    ? { label: 'Convocatoria en PaxFide', value: `${options.origin ?? ''}/c/${encodeURIComponent(donation.publicCode)}`, mono: true }
    : undefined;
  const now = options.now ?? new Date();
  return {
    brand: 'PaxFide',
    title: 'Comprobante de donación',
    amount: formatMinorUnits(donation.amount, donation.currency),
    rows,
    ...(link ? { link } : {}),
    generatedAt: `Generado el ${formatReceiptDate(now.toISOString(), timeZone) ?? ''}`.trim(),
    legend: RECEIPT_LEGEND,
    reference,
    fileName: `comprobante-paxfide-${reference.replace('…', '')}.png`,
  };
}

/** Todos los textos del modelo, en el orden en que se dibujan (lo usa el dibujo y la vista imprimible). */
export function receiptTexts(m: ReceiptModel): string[] {
  return [m.brand, m.title, m.amount, ...m.rows.flatMap((r) => [r.label, r.value]),
    ...(m.link ? [m.link.label, m.link.value] : []), m.generatedAt, m.legend];
}
