// Ref: plan-fase7-puesta-al-dia.md Anexo 1, P-5 (tests del comprobante).
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { AccountDonation } from '../src/lib/api/account';
import { buildReceipt, receiptTexts, RECEIPT_LEGEND, RECEIPT_WIDTH, RECEIPT_HEIGHT } from '../src/lib/receipt/receiptModel';
import { drawReceipt, wrapText, type ReceiptContext, type ReceiptTheme } from '../src/components/receipt/ReceiptCanvas';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

const TRACKING = 'TRK.secreto-de-seguimiento-abc123';
const full: AccountDonation = {
  intentId: '0f8e2b1c-4d5a-4e6f-9a0b-1c2d3ea3f9c2', campaignTitle: 'Mercados para adultos mayores', amount: '5000050',
  currency: 'COP', status: 'CONFIRMED', trackingCode: TRACKING, createdAt: '2026-10-28T20:40:00Z',
  confirmedAt: '2026-10-28T20:45:00Z', organizationName: 'Fundación Demo', paymentMethod: 'GATEWAY',
  publicCode: '01JDEMOPUBLICC0DEMONETARY1',
};
const OPTS = { now: new Date('2026-10-29T15:00:00Z'), timeZone: 'America/Bogota', origin: 'https://paxfide.test' };
const labels = (d: AccountDonation, o = {}) => buildReceipt(d, { ...OPTS, ...o })!.rows.map((r) => r.label);

/** Contexto 2D falso: recoge todo lo que se dibuja con `fillText`. */
function spyContext() {
  const drawn: string[] = [];
  const ctx: ReceiptContext = {
    fillStyle: '', font: '', textBaseline: 'alphabetic', textAlign: 'left',
    fillRect: vi.fn(),
    fillText: vi.fn((t: string) => { drawn.push(t); }),
    measureText: ((t: string) => ({ width: t.length * 14 })) as unknown as ReceiptContext['measureText'],
  };
  return { ctx, drawn };
}
const theme: ReceiptTheme = {
  surface: 'rgb(255, 255, 255)', text: 'rgb(1, 2, 3)', textSecondary: 'rgb(4, 5, 6)', divider: 'rgb(7, 8, 9)',
  action: 'rgb(10, 11, 12)', onAction: 'rgb(255, 255, 255)', link: 'rgb(13, 14, 15)',
  fontDisplay: 'Bricolage', fontBody: 'system-ui', fontMono: 'JetBrains',
};

describe('P-5 · modelo del comprobante (buildReceipt)', () => {
  it('con todos los campos: marca, título, monto, filas, enlace, fecha de generación y leyenda', () => {
    const m = buildReceipt(full, { ...OPTS, name: 'Ana Pérez' })!;
    expect(m.brand).toBe('PaxFide');
    expect(m.title).toBe('Comprobante de donación');
    expect(m.amount).toBe('50.000,50 COP');
    expect(m.rows.map((r) => r.label)).toEqual([
      'Nombre', 'Convocatoria', 'Organización', 'Medio de pago', 'Fecha de la donación', 'Pago confirmado', 'Referencia',
    ]);
    const v = Object.fromEntries(m.rows.map((r) => [r.label, r.value]));
    expect(v['Nombre']).toBe('Ana Pérez');
    expect(v['Convocatoria']).toBe('Mercados para adultos mayores');
    expect(v['Organización']).toBe('Fundación Demo');
    expect(v['Medio de pago']).toBe('Pasarela de pago');
    // Hora local (Bogotá, UTC−5) y con la zona
    expect(v['Fecha de la donación']).toMatch(/28 de octubre de 2026.*(15:40|3:40).*GMT-5/);
    expect(v['Pago confirmado']).toMatch(/(15:45|3:45).*GMT-5/);
    expect(v['Referencia']).toBe('…a3f9c2');
    expect(m.link).toEqual({ label: 'Convocatoria en PaxFide', value: 'https://paxfide.test/c/01JDEMOPUBLICC0DEMONETARY1', mono: true });
    expect(m.generatedAt).toMatch(/^Generado el 29 de octubre de 2026/);
    expect(m.legend).toBe(RECEIPT_LEGEND);
    expect(m.fileName).toBe('comprobante-paxfide-a3f9c2.png');
  });

  it.each([
    ['campaignTitle', 'Convocatoria'], ['organizationName', 'Organización'], ['paymentMethod', 'Medio de pago'],
    ['createdAt', 'Fecha de la donación'], ['confirmedAt', 'Pago confirmado'],
  ] as const)('sin %s su fila no aparece (ni "—" ni "Desconocido")', (field, label) => {
    const d = { ...full, [field]: undefined };
    expect(labels(d)).not.toContain(label);
    const texts = receiptTexts(buildReceipt(d, OPTS)!).join(' ');
    expect(texts).not.toContain('—');
    expect(texts).not.toContain('Desconocido');
  });

  it('sin publicCode no hay enlace; con la superficie deshabilitada tampoco (D5)', () => {
    expect(buildReceipt({ ...full, publicCode: undefined }, OPTS)!.link).toBeUndefined();
    expect(buildReceipt(full, { ...OPTS, linkEnabled: false })!.link).toBeUndefined();
    expect(receiptTexts(buildReceipt({ ...full, publicCode: undefined }, OPTS)!).join(' ')).not.toContain('/c/');
  });

  it.each(['PENDING', 'FUNDING_REJECTED', 'FAILED', 'EXPIRED_UNKNOWN', 'OTRO'])('%s → null (solo CONFIRMED, U-9)', (status) => {
    expect(buildReceipt({ ...full, status }, OPTS)).toBeNull();
  });

  it('U-11: el modelo nunca lleva el trackingCode (con una donación que sí lo trae)', () => {
    const m = buildReceipt(full, { ...OPTS, name: 'Ana' })!;
    expect(JSON.stringify(m)).not.toContain(TRACKING);
    expect(JSON.stringify(m)).not.toContain('TRK.');
    // Tampoco el intentId completo: solo sus 6 últimos caracteres
    expect(JSON.stringify(m)).not.toContain(full.intentId);
  });

  it('sin nombre no hay fila de nombre', () => {
    expect(labels(full)).not.toContain('Nombre');
    expect(labels(full, { name: '   ' })).not.toContain('Nombre');
  });
});

describe('P-5 · dibujo del comprobante (drawReceipt)', () => {
  it('el trackingCode nunca llega a fillText (espía sobre el contexto)', () => {
    const { ctx, drawn } = spyContext();
    drawReceipt(ctx, buildReceipt(full, { ...OPTS, name: 'Ana Pérez' })!, theme);
    expect(drawn.length).toBeGreaterThan(10);
    expect(drawn.join('\n')).not.toContain(TRACKING);
    expect(drawn.join('\n')).not.toContain('TRK.');
  });

  it('solo dibuja textos del modelo', () => {
    const { ctx, drawn } = spyContext();
    const m = buildReceipt(full, OPTS)!;
    drawReceipt(ctx, m, theme);
    const allowed = receiptTexts(m).join(' ');
    for (const t of drawn) expect(allowed).toContain(t);
  });

  it('sin la casilla no se dibuja el nombre; con ella sí', () => {
    const without = spyContext();
    drawReceipt(without.ctx, buildReceipt(full, OPTS)!, theme);
    expect(without.drawn).not.toContain('Ana Pérez');
    const withName = spyContext();
    drawReceipt(withName.ctx, buildReceipt(full, { ...OPTS, name: 'Ana Pérez' })!, theme);
    expect(withName.drawn).toContain('Ana Pérez');
  });

  it('sin publicCode no se dibuja ningún enlace', () => {
    const { ctx, drawn } = spyContext();
    drawReceipt(ctx, buildReceipt({ ...full, publicCode: undefined }, OPTS)!, theme);
    expect(drawn.join(' ')).not.toContain('/c/');
  });

  it('pinta todo el lienzo de 1200 × 1600 con los tokens del tema (sin hexadecimales)', () => {
    const { ctx } = spyContext();
    const styles: string[] = [];
    const fill = ctx.fillRect as ReturnType<typeof vi.fn>;
    fill.mockImplementation(() => { styles.push(String(ctx.fillStyle)); });
    drawReceipt(ctx, buildReceipt(full, OPTS)!, theme);
    expect(fill).toHaveBeenCalledWith(0, 0, RECEIPT_WIDTH, RECEIPT_HEIGHT);
    for (const st of styles) expect(Object.values(theme)).toContain(st);
  });

  it('wrapText parte por palabras y corta una palabra que no cabe', () => {
    const { ctx } = spyContext();
    expect(wrapText(ctx, 'uno dos tres', 100)).toEqual(['uno dos', 'tres']);
    expect(wrapText(ctx, 'abcdefghijklmnop', 70)).toEqual(['abcde', 'fghij', 'klmno', 'p']);
  });

  it('el código del dibujo y del modelo no tiene hexadecimales de color', async () => {
    const fs = await import('fs');
    const path = await import('path');
    for (const f of ['src/components/receipt/ReceiptCanvas.ts', 'src/lib/receipt/receiptModel.ts', 'src/components/receipt/receipt.module.css']) {
      expect(fs.readFileSync(path.resolve(__dirname, '..', f), 'utf-8')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
});

describe('P-5 · botones en /account/donations', () => {
  afterEach(() => vi.unstubAllEnvs());

  async function load() {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/account/donations', '/tracking', '/c/:publicCode']));
    return import('../src/screens/AccountDonationsScreen');
  }
  const pending: AccountDonation = { ...full, intentId: 'i-pend', status: 'PENDING', trackingCode: undefined, campaignTitle: 'Pendiente X' };

  it('solo la donación CONFIRMED tiene "Descargar comprobante" e "Imprimir" (negativa en la PENDING)', async () => {
    const { AccountDonationsScreen } = await load();
    render(<AccountDonationsScreen client={async () => ({ kind: 'ok', items: [full, pending] })}
      profileClient={async () => ({ kind: 'ok', profile: { email: 'x@y.z' } })} />);
    const items = await screen.findAllByTestId('account-donation');
    expect(items[0].querySelector('[data-testid="receipt-actions"]')).not.toBeNull();
    expect(items[1].querySelector('[data-testid="receipt-actions"]')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Descargar comprobante' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Imprimir' })).toHaveLength(1);
  });

  it('U-12: sin nombre en el perfil no hay casilla; con nombre, sin marcar, y el nombre solo va si se marca', async () => {
    const { AccountDonationsScreen } = await load();
    const { unmount } = render(<AccountDonationsScreen client={async () => ({ kind: 'ok', items: [full] })}
      profileClient={async () => ({ kind: 'ok', profile: { email: 'x@y.z' } })} />);
    await screen.findByRole('button', { name: 'Descargar comprobante' });
    await Promise.resolve();
    expect(screen.queryByLabelText('Incluir mi nombre')).toBeNull();
    unmount();

    const { ReceiptActions } = await import('../src/components/receipt/ReceiptActions');
    const download = vi.fn(async () => {});
    render(<ReceiptActions donation={full} profileName="Ana Pérez" download={download} />);
    const box = screen.getByLabelText('Incluir mi nombre') as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar comprobante' }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(download.mock.calls[0])).not.toContain('Ana Pérez');
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar comprobante' }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
    expect(JSON.stringify((download.mock.calls as unknown[][])[1])).toContain('Ana Pérez');
    expect(JSON.stringify(download.mock.calls)).not.toContain(TRACKING);
  });

  it('la pantalla pide el perfil y muestra la casilla si trae nombre', async () => {
    const { AccountDonationsScreen } = await load();
    render(<AccountDonationsScreen client={async () => ({ kind: 'ok', items: [full] })}
      profileClient={async () => ({ kind: 'ok', profile: { email: 'x@y.z', givenName: 'Ana', familyName: 'Pérez' } })} />);
    expect(await screen.findByLabelText('Incluir mi nombre')).toBeInTheDocument();
  });

  it('sin donaciones confirmadas no se pide el perfil', async () => {
    const { AccountDonationsScreen } = await load();
    const profileClient = vi.fn(async () => ({ kind: 'ok' as const, profile: { email: 'x@y.z', givenName: 'Ana' } }));
    render(<AccountDonationsScreen client={async () => ({ kind: 'ok', items: [pending] })} profileClient={profileClient} />);
    await screen.findAllByTestId('account-donation');
    expect(profileClient).not.toHaveBeenCalled();
  });

  it('"Imprimir" monta la vista imprimible con los mismos campos y sin el trackingCode', async () => {
    const { ReceiptActions } = await import('../src/components/receipt/ReceiptActions');
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<ReceiptActions donation={full} />);
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));
    const view = await screen.findByTestId('receipt-print');
    expect(print).toHaveBeenCalled();
    expect(view).toHaveAttribute('data-theme', 'light');
    expect(view.textContent).toContain('Comprobante de donación');
    expect(view.textContent).toContain('…a3f9c2');
    expect(view.textContent).toContain(RECEIPT_LEGEND);
    expect(view.textContent).not.toContain(TRACKING);
    window.dispatchEvent(new Event('afterprint'));
    await waitFor(() => expect(screen.queryByTestId('receipt-print')).toBeNull());
    print.mockRestore();
  });

  it('si el dibujo falla, un error con texto y el botón sigue disponible', async () => {
    const { ReceiptActions } = await import('../src/components/receipt/ReceiptActions');
    render(<ReceiptActions donation={full} download={async () => { throw new Error('x'); }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar comprobante' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo generar el comprobante');
    expect(screen.getByRole('button', { name: 'Descargar comprobante' })).toBeEnabled();
  });
});
