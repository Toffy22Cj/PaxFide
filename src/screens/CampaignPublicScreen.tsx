'use client';

import React, { useState } from 'react';
import { fetchPublicCampaign, PublicCampaign, PublicCampaignOutcome } from '../lib/api/publicCampaigns';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { formatMinorUnits, percentOf } from '../lib/money';
import { campaignStatusLabel, donationTypeLabel, paymentMethodLabel } from '../lib/labels';
import { DefinitionList, PageHeader } from '../components/ui/Layout';
import { ErrorState, LoadingState, NotFoundState } from '../components/States';
import { LocalDate } from '../components/LocalDate';
import { DonateSection } from '../components/campaign/DonateSection';
import s from '../components/campaign/campaign.module.css';

function Chips({ items, label }: { items: string[]; label: (v: string) => string }) {
  return <ul className={s.chips}>{items.map((i) => <li key={i} className={s.chip}>{label(i)}</li>)}</ul>;
}

function Progress({ campaign }: { campaign: PublicCampaign }) {
  if (!campaign.currency || !campaign.targetAmount) return null;
  const cleared = campaign.clearedAmount ?? '0';
  const pct = percentOf(cleared, campaign.targetAmount);
  return (
    <div className={s.progress}>
      <div className={s.figures}>
        <span>Recaudado<br /><strong data-testid="cleared-amount">{formatMinorUnits(cleared, campaign.currency)}</strong></span>
        <span>Meta<br /><strong>{formatMinorUnits(campaign.targetAmount, campaign.currency)}</strong></span>
      </div>
      {pct !== null && (
        <>
          <div className={s.bar} role="img" aria-label={`Recaudado: ${pct} % de la meta`}>
            <div className={s.fill} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <p className={s.org}>{pct} % de la meta</p>
        </>
      )}
    </div>
  );
}

export function CampaignDetails({ campaign }: { campaign: PublicCampaign }) {
  return (
    <>
      {campaign.organizationName && <p className={s.org}>{campaign.organizationName}</p>}
      <PageHeader title={campaign.title} />
      {campaign.description && <p className={s.description}>{campaign.description}</p>}
      <Progress campaign={campaign} />
      <DefinitionList items={[
        { label: 'Estado', value: campaignStatusLabel(campaign.status), testId: 'campaign-status' },
        { label: 'Inicio', value: <LocalDate iso={campaign.startDate} /> },
        { label: 'Fin', value: <LocalDate iso={campaign.endDate} /> },
        { label: 'Acepta', value: <Chips items={campaign.acceptedDonationTypes} label={donationTypeLabel} /> },
        ...(campaign.acceptedPaymentMethods.length > 0
          ? [{ label: 'Medios de pago', value: <Chips items={campaign.acceptedPaymentMethods} label={paymentMethodLabel} /> }]
          : []),
      ]} />
    </>
  );
}

/**
 * `CampaignPublicPage` (`/c/:publicCode`): CV-07 con el nombre de la organización y los medios de pago aceptados, y
 * Donar (ampliación de alcance, `action:donate`). El SSR entrega el primer resultado; si falló, el cliente puede
 * reintentar la lectura.
 */
export function CampaignPublicScreen({ publicCode, initial, client = fetchPublicCampaign }: {
  publicCode: string;
  initial: PublicCampaignOutcome;
  client?: typeof fetchPublicCampaign;
}) {
  const [state, setState] = useState<PublicCampaignOutcome | 'loading'>(initial);

  const retry = async () => {
    setState('loading');
    setState(await client(publicCode));
  };

  if (state === 'loading') return <LoadingState />;
  if (state.kind === 'not-found') return <NotFoundState message="No encontramos esta convocatoria. Verifica el enlace." />;
  if (state.kind === 'error') return <ErrorState onRetry={() => void retry()} />;
  return (
    <article>
      <CampaignDetails campaign={state.campaign} />
      {isSurfaceEnabled('action:donate') && (
        <DonateSection publicCode={publicCode} campaign={state.campaign} />
      )}
    </article>
  );
}

