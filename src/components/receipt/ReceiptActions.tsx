'use client';
// Ref: plan-fase7-puesta-al-dia.md Anexo 1, U-9, U-12, U-13 y P-5. Botones del comprobante de una donación `CONFIRMED`.
import React, { useEffect, useId, useState } from 'react';
import type { AccountDonation } from '../../lib/api/account';
import { buildReceipt, type ReceiptModel } from '../../lib/receipt/receiptModel';
import { isSurfaceEnabled } from '../../lib/routing/surfaces';
import { Button } from '../ui/Button';
import { Actions, uiClasses as ui } from '../ui/Layout';
import { downloadReceipt } from './ReceiptCanvas';
import s from './receipt.module.css';

function modelOf(donation: AccountDonation, name: string | undefined): ReceiptModel | null {
  return buildReceipt(donation, {
    name,
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    linkEnabled: isSurfaceEnabled('/c/:publicCode'),
  });
}

/**
 * U-9: sin botones si la donación no es `CONFIRMED`. U-12: la casilla "Incluir mi nombre", sin marcar y sin guardar,
 * solo si el perfil trae nombre o apellido.
 */
export function ReceiptActions({ donation, profileName, download = downloadReceipt }: {
  donation: AccountDonation;
  profileName?: string;
  download?: (m: ReceiptModel) => Promise<void>;
}) {
  const id = useId();
  const [withName, setWithName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [printing, setPrinting] = useState<ReceiptModel | null>(null);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener('afterprint', done);
    // La vista imprimible ya está en el DOM: se imprime y se retira al terminar
    try { window.print(); } catch { done(); }
    return () => window.removeEventListener('afterprint', done);
  }, [printing]);

  if (donation.status !== 'CONFIRMED') return null;
  const name = withName && profileName ? profileName : undefined;

  const onDownload = async () => {
    const m = modelOf(donation, name);
    if (!m) return;
    setBusy(true);
    setFailed(false);
    try { await download(m); } catch { setFailed(true); } finally { setBusy(false); }
  };

  return (
    <div className={s.receipt} data-testid="receipt-actions">
      {profileName && (
        <label className={s.check} htmlFor={`${id}-name`}>
          <input id={`${id}-name`} type="checkbox" checked={withName} onChange={(e) => setWithName(e.target.checked)} />
          Incluir mi nombre
        </label>
      )}
      <Actions>
        <Button variant="secondary" onClick={onDownload} sending={busy}>Descargar comprobante</Button>
        <Button variant="secondary" onClick={() => setPrinting(modelOf(donation, name))}>Imprimir</Button>
      </Actions>
      {failed && <p className={ui.error} role="alert">No se pudo generar el comprobante. Inténtalo de nuevo.</p>}
      {printing && <ReceiptPrintView model={printing} />}
    </div>
  );
}

/** U-13: la vista imprimible, con los mismos campos que el PNG (solo se ve al imprimir). */
export function ReceiptPrintView({ model }: { model: ReceiptModel }) {
  const rows = model.link ? [...model.rows, model.link] : model.rows;
  return (
    <section className={s.print} data-testid="receipt-print" data-theme="light" aria-label={model.title}>
      <p className={s.printBrand}>{model.brand}</p>
      <h2 className={s.printTitle}>{model.title}</h2>
      <p className={s.printAmount}>{model.amount}</p>
      <dl className={s.printRows}>
        {rows.map((r) => (
          <React.Fragment key={r.label}>
            <dt>{r.label}</dt>
            <dd className={r.mono ? s.mono : undefined}>{r.value}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p className={s.printFoot}>{model.generatedAt}</p>
      <p className={s.printFoot}>{model.legend}</p>
    </section>
  );
}
