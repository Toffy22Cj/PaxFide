'use client';

import React, { useEffect, useState } from 'react';
import { fetchMe } from '../lib/api/identity';
import { fetchPrediction, PredictionOutcome } from '../lib/api/prediction';
import { AdminCampaign, fetchOrganizationCampaigns, ListOutcome } from '../lib/api/campaignAdmin';
import { percentOf } from '../lib/money';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { PageHeader } from '../components/ui/Layout';
import { TextField, SelectField } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ForbiddenState, LoadingState, StatusNotice, UnavailableState } from '../components/States';
import { AdvancedPredictionChart, BasicPredictionChart } from '../components/prediction/PredictionCharts';
import s from '../components/prediction/prediction.module.css';

export const ESTIMATE_LABEL = 'ESTIMACIÓN — modelo entrenado con datos sintéticos';

/**
 * Estimación de una convocatoria (P3), `GET /organizations/{id}/campaigns/{ref}/prediction`. Solo se ofrece a
 * `ADMINISTRATOR`/`REPRESENTATIVE` (representación; el backend autoriza). La etiqueta de estimación es visible y
 * permanente, y la estimación va en un bloque separado de los hechos verificables. Sin cifra (p. ej. `STRICT`): se
 * muestra el texto del backend, nunca un número. La convocatoria se elige del listado de la organización (solo
 * `ADMINISTRATOR`); si el listado no está permitido (`REPRESENTATIVE`), se escribe la referencia.
 */
export function PredictionScreen({ meClient = fetchMe, client = fetchPrediction, listClient = fetchOrganizationCampaigns }: {
  meClient?: typeof fetchMe;
  client?: typeof fetchPrediction;
  listClient?: typeof fetchOrganizationCampaigns;
}) {
  const { state, reload } = usePrincipal(meClient);
  const [campaigns, setCampaigns] = useState<ListOutcome<AdminCampaign> | null>(null);
  const [campaignRef, setCampaignRef] = useState('');
  const [result, setResult] = useState<PredictionOutcome | 'loading' | null>(null);
  const [consulted, setConsulted] = useState<AdminCampaign | undefined>(undefined);

  const organizationId = state.status === 'ready' ? state.data.organizationId : undefined;
  const allowed = state.status === 'ready' && !!organizationId
    && (state.data.roles.includes('ADMINISTRATOR') || state.data.roles.includes('REPRESENTATIVE'));

  useEffect(() => {
    if (!allowed || !organizationId) return;
    let live = true;
    listClient(organizationId).then((r) => { if (live) setCampaigns(r); }, () => { if (live) setCampaigns({ kind: 'error' }); });
    return () => { live = false; };
  }, [allowed, organizationId, listClient]);

  const items = campaigns?.kind === 'ok' ? campaigns.items : [];
  const selected = campaignRef || items[0]?.campaignRef || '';

  const consult = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = selected.trim();
    if (!ref || !organizationId) return;
    setConsulted(items.find((c) => c.campaignRef === ref));
    setResult('loading');
    setResult(await client(organizationId, ref));
  };

  const observed = consulted?.clearedAmount && consulted.targetAmount ? percentOf(consulted.clearedAmount, consulted.targetAmount) : null;

  return (
    <div>
      <PageHeader title="Estimación de convocatorias" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta (organización y roles)" />}
      {state.status === 'ready' && !allowed && <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />}
      {allowed && campaigns === null && <LoadingState />}
      {allowed && campaigns?.kind === 'ok' && items.length === 0 && <EmptyState text="Tu organización todavía no tiene convocatorias." />}
      {allowed && campaigns !== null && (campaigns.kind !== 'ok' || items.length > 0) && (
        <>
          <form onSubmit={consult} noValidate>
            {campaigns.kind === 'ok'
              ? <SelectField label="Convocatoria" value={selected} onChange={(e) => setCampaignRef(e.target.value)}
                  options={items.map((c) => ({ value: c.campaignRef, label: c.title }))} />
              : <TextField label="Referencia de la convocatoria" value={campaignRef} autoComplete="off"
                  hint="Tu cuenta no puede ver el listado de convocatorias; escribe la referencia."
                  onChange={(e) => setCampaignRef(e.target.value)} />}
            <Button type="submit" sending={result === 'loading'}>Ver estimación</Button>
          </form>
          <div style={{ marginTop: 24 }}>
            {result === 'loading' && <LoadingState />}
            {result !== null && result !== 'loading' && result.kind === 'forbidden' && <ForbiddenState />}
            {result !== null && result !== 'loading' && result.kind === 'error' && <ErrorState text="No pudimos cargar la estimación. Inténtalo de nuevo." />}
            {result !== null && result !== 'loading' && result.kind === 'no-figure' && (
              <section className={s.estimate} aria-label="Estimación">
                <span className={s.badge}>{ESTIMATE_LABEL}</span>
                <StatusNotice variant="info" title="Sin cifra para esta convocatoria" text={result.reason} />
              </section>
            )}
            {result !== null && result !== 'loading' && result.kind === 'ok' && (
              <section className={s.estimate} aria-label="Estimación" data-testid="prediction-estimate">
                <span className={s.badge}>{ESTIMATE_LABEL}</span>
                <p>Es una estimación, no un hecho: puede no cumplirse. Los importes reales están en la página de la convocatoria.</p>
                {result.view.warnings.length > 0 && (
                  <ul data-testid="prediction-warnings">
                    {result.view.warnings.map((w) => <li key={w}>{w}</li>)}
                  </ul>
                )}
                <h2 style={{ fontSize: 'var(--text-lg)' }}>Probabilidad y final estimado</h2>
                <BasicPredictionChart view={result.view} />
                <h2 style={{ fontSize: 'var(--text-lg)' }}>Hoy frente al final estimado</h2>
                <AdvancedPredictionChart view={result.view} observedFraction={observed === null ? undefined : observed / 100} />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
