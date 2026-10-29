// Ref: plan-fase7-puesta-al-dia.md Anexo 1, U-13 y P-5. El dibujo solo dibuja el modelo (`receiptModel.ts`): no lee la
// donación ni decide qué campos van. Canvas 2D sin dependencias (ADR-046 D8); colores y fuentes son tokens del tema
// claro leídos con `getComputedStyle` (sin hexadecimales).
import { RECEIPT_HEIGHT, RECEIPT_WIDTH, type ReceiptModel } from '../../lib/receipt/receiptModel';

/** Lo que el dibujo necesita del contexto 2D (permite probarlo con un espía, sin canvas real). */
export type ReceiptContext = Pick<CanvasRenderingContext2D,
  'fillStyle' | 'font' | 'textBaseline' | 'textAlign' | 'fillRect' | 'fillText' | 'measureText'>;

/** Tokens semánticos del tema claro (sistema-visual-paxfide-web-enmienda-1.md §4.3). */
export interface ReceiptTheme {
  surface: string;
  text: string;
  textSecondary: string;
  divider: string;
  action: string;
  onAction: string;
  link: string;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
}

const TOKENS: Record<keyof ReceiptTheme, string> = {
  surface: '--color-surface', text: '--color-text', textSecondary: '--color-text-secondary', divider: '--color-divider',
  action: '--color-action', onAction: '--color-on-action', link: '--color-link',
  fontDisplay: '--font-display', fontBody: '--font-body', fontMono: '--font-mono',
};

/** U-13: siempre el tema claro, leído de un contenedor con `data-theme="light"` (D-F11), sea cual sea el de la página. */
export function readReceiptTheme(doc: Document = document): ReceiptTheme {
  const probe = doc.createElement('div');
  probe.setAttribute('data-theme', 'light');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.display = 'none';
  doc.body.appendChild(probe);
  try {
    const cs = getComputedStyle(probe);
    const out = {} as ReceiptTheme;
    for (const [k, token] of Object.entries(TOKENS) as [keyof ReceiptTheme, string][]) {
      out[k] = cs.getPropertyValue(token).trim();
    }
    // Sin la fuente autoalojada (no debería pasar), la pila del sistema de --font-body
    if (!out.fontDisplay) out.fontDisplay = out.fontBody || 'sans-serif';
    if (!out.fontMono) out.fontMono = 'monospace';
    if (!out.fontBody) out.fontBody = 'sans-serif';
    return out;
  } finally {
    probe.remove();
  }
}

const MARGIN = 96;
const CONTENT = RECEIPT_WIDTH - MARGIN * 2;

/** Parte un texto en líneas que caben en `max` px (por palabras; una palabra más larga se corta por caracteres). */
export function wrapText(ctx: Pick<ReceiptContext, 'measureText'>, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  const push = (word: string) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= max) { line = next; return; }
    if (line) lines.push(line);
    line = '';
    if (ctx.measureText(word).width <= max) { line = word; return; }
    let chunk = '';
    for (const ch of Array.from(word)) {
      if (ctx.measureText(chunk + ch).width > max && chunk) { lines.push(chunk); chunk = ''; }
      chunk += ch;
    }
    line = chunk;
  };
  for (const word of text.split(/\s+/).filter(Boolean)) push(word);
  if (line) lines.push(line);
  return lines;
}

/** Dibuja el comprobante en un lienzo de 1200 × 1600. Solo usa los textos del modelo. */
export function drawReceipt(ctx: ReceiptContext, model: ReceiptModel, theme: ReceiptTheme): void {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = theme.surface;
  ctx.fillRect(0, 0, RECEIPT_WIDTH, RECEIPT_HEIGHT);

  // Banda de marca
  ctx.fillStyle = theme.action;
  ctx.fillRect(0, 0, RECEIPT_WIDTH, 168);
  ctx.fillStyle = theme.onAction;
  ctx.font = `800 64px ${theme.fontDisplay}`;
  ctx.fillText(model.brand, MARGIN, 108);

  let y = 270;
  ctx.fillStyle = theme.text;
  ctx.font = `800 56px ${theme.fontDisplay}`;
  for (const l of wrapText(ctx, model.title, CONTENT)) { ctx.fillText(l, MARGIN, y); y += 66; }

  y += 30;
  ctx.font = `600 72px ${theme.fontMono}`;
  for (const l of wrapText(ctx, model.amount, CONTENT)) { ctx.fillText(l, MARGIN, y); y += 82; }

  ctx.fillStyle = theme.divider;
  ctx.fillRect(MARGIN, y, CONTENT, 2);
  y += 62;

  const rows = model.link ? [...model.rows, model.link] : model.rows;
  for (const row of rows) {
    ctx.fillStyle = theme.textSecondary;
    ctx.font = `600 24px ${theme.fontBody}`;
    ctx.fillText(row.label, MARGIN, y);
    y += 40;
    ctx.fillStyle = row === model.link ? theme.link : theme.text;
    ctx.font = row.mono ? `500 28px ${theme.fontMono}` : `400 30px ${theme.fontBody}`;
    for (const l of wrapText(ctx, row.value, CONTENT)) { ctx.fillText(l, MARGIN, y); y += 40; }
    y += 20;
  }

  // Pie: fecha de generación y leyenda fija, pegados al borde inferior
  ctx.font = `400 24px ${theme.fontBody}`;
  const legend = wrapText(ctx, model.legend, CONTENT);
  let fy = RECEIPT_HEIGHT - MARGIN - (legend.length - 1) * 34;
  ctx.fillStyle = theme.divider;
  ctx.fillRect(MARGIN, fy - 100, CONTENT, 2);
  ctx.fillStyle = theme.textSecondary;
  ctx.fillText(model.generatedAt, MARGIN, fy - 50);
  for (const l of legend) { ctx.fillText(l, MARGIN, fy); fy += 34; }
}

/** U-13: espera a las fuentes autoalojadas (`document.fonts.ready`) antes de dibujar. */
async function fontsReady(theme: ReceiptTheme): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  // `preload: false` (DF7-12): se piden aquí las caras que usa el dibujo
  await Promise.all([`800 64px ${theme.fontDisplay}`, `600 72px ${theme.fontMono}`].map((f) => fonts.load(f).catch(() => [])));
  await fonts.ready;
}

/** Genera el PNG del comprobante. Falla con `ReceiptRenderError` si el navegador no da un canvas 2D. */
export class ReceiptRenderError extends Error {
  constructor() { super('ReceiptRenderError'); this.name = 'ReceiptRenderError'; }
}

export async function renderReceiptPng(model: ReceiptModel): Promise<Blob> {
  const theme = readReceiptTheme();
  await fontsReady(theme);
  const canvas = document.createElement('canvas');
  canvas.width = RECEIPT_WIDTH;
  canvas.height = RECEIPT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ReceiptRenderError();
  drawReceipt(ctx, model, theme);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new ReceiptRenderError())), 'image/png'));
}

/** Descarga el PNG como `comprobante-paxfide-<referencia>.png` (U-13). */
export async function downloadReceipt(model: ReceiptModel): Promise<void> {
  const blob = await renderReceiptPng(model);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = model.fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
