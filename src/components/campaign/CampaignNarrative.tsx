'use client';

import React, { useEffect, useState } from 'react';
import { CampaignNarrativeOutcome, fetchCampaignNarrative } from '../../lib/api/publicCampaigns';
import { DefinitionList, Surface, Actions, uiClasses as ui } from '../ui/Layout';
import { Button } from '../ui/Button';
import { ErrorState, LoadingState, StatusNotice } from '../States';

/**
 * Narrativa de la convocatoria (ADR-040; `front-fase2` §9: estados disponible / pendiente / no disponible). Los hechos
 * deterministas (`facts`) van separados del relato generado; se dice "receptores distintos", nunca "familias".
 */
export function CampaignNarrative({ publicCode, client = fetchCampaignNarrative }: {
  publicCode: string;
  client?: typeof fetchCampaignNarrative;
}) {
  const [state, setState] = useState<CampaignNarrativeOutcome | 'loading'>('loading');
  const load = async () => {
    setState('loading');
    setState(await client(publicCode));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [publicCode]);

  return (
    <Surface title="Lo que se ha logrado">
      {state === 'loading' && <LoadingState />}
      {state !== 'loading' && state.kind === 'error' && <ErrorState onRetry={() => void load()} />}
      {state !== 'loading' && state.kind === 'not-found' && <p>El relato de esta convocatoria no está disponible.</p>}
      {state !== 'loading' && state.kind === 'ok' && (
        <>
          {state.facts && (state.facts.unitsDelivered !== undefined || state.facts.distinctRecipients !== undefined) && (
            <DefinitionList items={[
              ...(state.facts.unitsDelivered !== undefined ? [{ label: 'Unidades entregadas', value: state.facts.unitsDelivered, testId: 'facts-units' }] : []),
              ...(state.facts.distinctRecipients !== undefined ? [{ label: 'Receptores distintos', value: String(state.facts.distinctRecipients), testId: 'facts-recipients' }] : []),
            ]} />
          )}
          {state.status === 'PENDING' && (
            <StatusNotice variant="info" text="El relato se está generando.">
              <Actions><Button variant="secondary" onClick={() => void load()}>Actualizar</Button></Actions>
            </StatusNotice>
          )}
          {state.status === 'UNAVAILABLE' && <p>El relato de esta convocatoria no está disponible.</p>}
          {state.status === 'AVAILABLE' && state.content && (
            <>
              <p className={ui.hint}>Texto generado automáticamente a partir de los hechos. Si algo no coincide, mandan los hechos.</p>
              <p data-testid="campaign-narrative" style={{ whiteSpace: 'pre-line' }}>{state.content}</p>
            </>
          )}
        </>
      )}
    </Surface>
  );
}
