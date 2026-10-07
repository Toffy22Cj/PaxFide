'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AccountDonation, fetchAccountDonations } from '../lib/api/account';
import { useRead } from '../lib/api/useRead';
import { formatMinorUnits } from '../lib/money';
import { intentStatusLabel } from '../lib/labels';
import { handOffTrackingCode } from '../lib/tracking/handoff';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { PageHeader, DefinitionList, Actions, uiClasses as ui } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from '../components/States';

/**
 * Mis donaciones (`/account/donations`; ampliación de alcance, Enmienda 1 de ADR-046). El `trackingCode` es una
 * credencial: oculto hasta que el usuario lo pide, y "Ver seguimiento" lo pasa en memoria (DW-16).
 */
export function AccountDonationsScreen({ client = fetchAccountDonations }: { client?: typeof fetchAccountDonations }) {
  const { state, reload } = useRead<AccountDonation[], 'forbidden' | 'unauthorized' | 'error'>(async () => {
    const r = await client();
    return r.kind === 'ok' ? { status: 'ready', data: r.items } : { status: r.kind };
  }, []);

  return (
    <div>
      <PageHeader title="Mis donaciones" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'forbidden' && <ForbiddenState />}
      {state.status === 'ready' && state.data.length === 0 && (
        <EmptyState text="Todavía no tienes donaciones hechas con esta cuenta." />
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className={ui.list}>{state.data.map((d) => <DonationItem key={d.intentId} donation={d} />)}</ul>
      )}
    </div>
  );
}

function DonationItem({ donation }: { donation: AccountDonation }) {
  const [shown, setShown] = useState(false);
  return (
    <li className={ui.surface} style={{ marginBottom: 0 }} data-testid="account-donation">
      <DefinitionList items={[
        { label: 'Convocatoria', value: donation.campaignTitle ?? '—' },
        { label: 'Monto', value: formatMinorUnits(donation.amount, donation.currency) },
        { label: 'Estado', value: intentStatusLabel(donation.status) },
      ]} />
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
