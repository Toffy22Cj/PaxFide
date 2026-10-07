'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { StatusNotice } from '../States';
import { Button } from '../ui/Button';
import { Actions, uiClasses as ui } from '../ui/Layout';
import { handOffTrackingCode } from '../../lib/tracking/handoff';
import { isSurfaceEnabled } from '../../lib/routing/surfaces';

/**
 * Entrega del `trackingCode` (Enmienda 3 de ADR-037, D6). Es una credencial: quien lo tiene ve el seguimiento. Se
 * muestra una vez con un aviso claro; nunca se guarda ni se pone en una URL. "Ver seguimiento" lo pasa en memoria a
 * `/tracking` (consumo único, DW-16).
 */
export function TrackingCodeReveal({ trackingCode }: { trackingCode: string }) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // A3: el código se destaca en cuanto llega (foco y desplazamiento hasta él)
  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView?.({ block: 'center' });
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  return (
    <div ref={ref} tabIndex={-1} data-testid="tracking-reveal" aria-label="Código de seguimiento de tu donación">
    <StatusNotice variant="success" title="Donación confirmada">
      <p><strong>Este es tu código de seguimiento. Es la llave para ver el recorrido de tu donación.</strong></p>
      <p data-testid="tracking-code" className={ui.secret}>{trackingCode}</p>
      <p>Guárdalo en un lugar seguro. Quien lo tenga puede ver el seguimiento: no lo publiques ni lo compartas. No
        podremos volver a mostrártelo en esta página.</p>
      <Actions>
        <Button variant="secondary" onClick={() => void copy()}>Copiar código</Button>
        {isSurfaceEnabled('/tracking') && (
          <Link href="/tracking" className={[ui.button, ui.secondary].join(' ')} onClick={() => handOffTrackingCode(trackingCode)}>
            Ver seguimiento
          </Link>
        )}
      </Actions>
      {copied === 'ok' && <p role="status">Código copiado.</p>}
      {copied === 'fail' && <p role="status">No pudimos copiarlo; cópialo a mano.</p>}
    </StatusNotice>
    </div>
  );
}
