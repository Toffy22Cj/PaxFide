'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { fetchMe } from '../lib/api/identity';
import { fetchPrediction, PredictionOutcome } from '../lib/api/prediction';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { getSessionCampaigns, SessionCampaign, subscribeSessionCampaigns } from '../lib/campaigns/sessionCampaigns';
import { PageHeader } from '../components/ui/Layout';
import { TextField, SelectField } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ForbiddenState, LoadingState, StatusNotice, UnavailableState } from '../components/States';
import { AdvancedPredictionChart, BasicPredictionChart } from '../components/prediction/PredictionCharts';
import s from '../components/prediction/prediction.module.css';

const EMPTY: SessionCampaign[] = [];
export const ESTIMATE_LABEL = 'ESTIMACIÓN — modelo entrenado con datos sintéticos';

/**
 * Estimación de una convocatoria (P3). Solo se ofrece a `ADMINISTRATOR`/`REPRESENTATIVE` (representación; el backend
 * autoriza). La etiqueta de estimación es visible y permanente, y la estimación va en un bloque separado de los
 * hechos verificables. Para `STRICT` se muestra el motivo del backend, nunca un número.
 */
export function PredictionScreen({ meClient = fetchMe, client = fetchPrediction }: {
  meClient?: typeof fetchMe;
  client?: typeof fetchPrediction;
}) {
  const { state, reload } = usePrincipal(meClient);
  const created = useSyncExternalStore(subscribeSessionCampaigns, getSessionCampaigns, () => EMPTY);
  const [campaignRef, setCampaignRef] = useState('');
  const [result, setResult] = useState<PredictionOutcome | 'loading' | null>(null);

  const allowed = state.status === 'ready'
    && (state.data.roles.includes('ADMINISTRATOR') || state.data.roles.includes('REPRESENTATIVE'));

  const consult = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = (campaignRef || created[0]?.campaignRef || '').trim();
    if (!ref) return;
    setResult('loading');
    setResult(await client(ref));
  };

  return (
    <div>
      <PageHeader title="Estimación de convocatorias" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta (organización y roles)" />}
      {state.status === 'ready' && !allowed && <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />}
      {allowed && (
        <>
          <form onSubmit={consult} noValidate>
            {created.length > 0
              ? <SelectField label="Convocatoria" value={campaignRef || created[0].campaignRef} onChange={(e) => setCampaignRef(e.target.value)}
                  options={created.map((c) => ({ value: c.campaignRef, label: c.title }))} />
              : <TextField label="Referencia de la convocatoria" value={campaignRef} autoComplete="off" onChange={(e) => setCampaignRef(e.target.value)} />}
            <Button type="submit" sending={result === 'loading'}>Ver estimación</Button>
          </form>
          <div style={{ marginTop: 24 }}>
            {result === 'loading' && <LoadingState />}
            {result !== null && result !== 'loading' && result.kind === 'unavailable' && <UnavailableState what="La estimación de convocatorias" />}
            {result !== null && result !== 'loading' && result.kind === 'forbidden' && <ForbiddenState />}
            {result !== null && result !== 'loading' && result.kind === 'error' && <ErrorState text="No pudimos cargar la estimación. Inténtalo de nuevo." />}
            {result !== null && result !== 'loading' && result.kind === 'no-figure' && (
              <section className={s.estimate} aria-label="Estimación">
                <span className={s.badge}>{ESTIMATE_LABEL}</span>
                <StatusNotice variant="info" title="Sin cifra para esta convocatoria" text={result.reason} />
              </section>
            )}
            {result !== null && result !== 'loading' && result.kind === 'ok' && result.checkpoints.length > 0 && (
              <section className={s.estimate} aria-label="Estimación" data-testid="prediction-estimate">
                <span className={s.badge}>{ESTIMATE_LABEL}</span>
                <p>Es una estimación, no un hecho: puede no cumplirse. Los importes reales están en la página de la convocatoria.</p>
                <h2 style={{ fontSize: 'var(--text-lg)' }}>Probabilidad y final estimado</h2>
                <BasicPredictionChart latest={[...result.checkpoints].sort((a, b) => b.t - a.t)[0]} />
                <h2 style={{ fontSize: 'var(--text-lg)' }}>Evolución de la estimación frente a lo recaudado</h2>
                <AdvancedPredictionChart checkpoints={result.checkpoints} />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
