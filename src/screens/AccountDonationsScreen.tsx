'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AccountDonation, fetchAccountDonations } from '../lib/api/account';
import { useRead } from '../lib/api/useRead';
import { formatMinorUnits } from '../lib/money';
import { intentStatusLabel, paymentMethodLabel } from '../lib/labels';
import { handOffTrackingCode } from '../lib/tracking/handoff';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { PageHeader, DefinitionList, Actions, uiClasses as ui } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ForbiddenState } from '../components/States';
import { SkeletonList } from '../components/loaders';
import { LocalDate } from '../components/LocalDate';
import s from './accountDonations.module.css';

/**
 * Mis donaciones (`/account/donations`; ampliación de alcance, Enmienda 1 de ADR-046). El `trackingCode` es una
 * credencial: oculto hasta que el usuario lo pide, y "Ver seguimiento" lo pasa en memoria (DW-16). Estilo v2 y campos de
 * D-P11 (A-5, plan-fase7-pantallas.md).
 */
export function AccountDonationsScreen({ client = fetchAccountDonations }: { client?: typeof fetchAccountDonations }) {
  const { state, reload } = useRead<AccountDonation[], 'forbidden' | 'unauthorized' | 'error'>(async () => {
    const r = await client();
    return r.kind === 'ok' ? { status: 'ready', data: r.items } : { status: r.kind };
  }, []);

  return (
    <div>
      <PageHeader title="Mis donaciones" />
      {/* A-5: carga con el esqueleto de VS-1 (se detiene con "reducir movimiento") */}
      {state.status === 'loading' && <SkeletonList aria-label="Cargando tus donaciones" />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'forbidden' && <ForbiddenState />}
      {state.status === 'ready' && state.data.length === 0 && (
        <EmptyState text="Todavía no tienes donaciones hechas con esta cuenta." />
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className={s.list}>{state.data.map((d) => <DonationItem key={d.intentId} donation={d} />)}</ul>
      )}
    </div>
  );
}

function DonationItem({ donation }: { donation: AccountDonation }) {
  const [shown, setShown] = useState(false);
  return (
    <li className={s.item} data-testid="account-donation">
      <DefinitionList items={[
        { label: 'Convocatoria', value: donation.campaignTitle ?? '—' },
        // D-P11 (nota del 2026-10-22): organización, fecha y medio de pago, cada uno solo si llega
        ...(donation.organizationName ? [{ label: 'Organización', value: donation.organizationName }] : []),
        ...(donation.createdAt ? [{ label: 'Fecha', value: <LocalDate iso={donation.createdAt} withTime /> }] : []),
        { label: 'Monto', value: formatMinorUnits(donation.amount, donation.currency) },
        ...(donation.paymentMethod ? [{ label: 'Medio de pago', value: paymentMethodLabel(donation.paymentMethod) }] : []),
        { label: 'Estado', value: intentStatusLabel(donation.status) },
      ]} />
      {/* D-P11: enlace a la convocatoria solo si llega publicCode (nunca en una PRIVATE_LINK) */}
      {donation.publicCode && isSurfaceEnabled('/c/:publicCode') && (
        <p className={s.link}><Link href={`/c/${encodeURIComponent(donation.publicCode)}`}>Ver convocatoria</Link></p>
      )}
      {donation.trackingCode && (
        <>
          {shown && (
            <>
              <p className={ui.hint}>Es la llave de tu seguimiento: no la compartas.</p>
              <p className={ui.secret} data-testid="account-tracking-code">{donation.trackingCode}</p>
            </>
          )}
          <Actions>
            <Button variant="secondary" onClick={() => setShown((v) => !v)} aria-expanded={shown}>
              {shown ? 'Ocultar código de seguimiento' : 'Mostrar código de seguimiento'}
            </Button>
            {isSurfaceEnabled('/tracking') && (
              <Link href="/tracking" className={[ui.button, ui.secondary].join(' ')}
                onClick={() => handOffTrackingCode(donation.trackingCode as string)}>
                Ver seguimiento
              </Link>
            )}
          </Actions>
        </>
      )}
    </li>
  );
}
