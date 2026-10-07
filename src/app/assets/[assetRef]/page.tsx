'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { fetchAsset, PhysicalAssetOperationalReadModel } from '../../../lib/api/assetClient';
import { lifecycleLabel } from '../../../lib/labels';
import { LoadingState, ErrorState, ForbiddenState, NotFoundState, StatusNotice } from '../../../components/States';
import { DefinitionList, PageHeader } from '../../../components/ui/Layout';
import { AssetActions } from '../../../components/asset/AssetActions';

type State = 'LOADING' | 'SUCCESS' | 'FORBIDDEN' | 'NOT_FOUND' | 'ERROR';

/**
 * `AssetPage` (`/assets/:assetRef`, `diseno-ux` §5.3): `PhysicalAssetOperationalReadModel` con sus 7 campos y
 * ninguno más; referencias opacas tal cual; `quantity` sin transformar; estado sin color. Acciones: ver
 * `AssetActions`. Tras un comando se vuelve a leer sin desmontar la pantalla.
 */
export default function AssetPage({ params, fetchClient = fetchAsset }: { params: Promise<{ assetRef: string }>, fetchClient?: typeof fetchAsset }) {
  const { assetRef } = use(params);
  const [state, setState] = useState<State>('LOADING');
  const [data, setData] = useState<PhysicalAssetOperationalReadModel | null>(null);

  const read = useCallback(async (silent: boolean) => {
    if (!silent) setState('LOADING');
    try {
      const res = await fetchClient(assetRef);
      if (res.state === 'SUCCESS') setData(res.data);
      if (!silent || res.state === 'SUCCESS') setState(res.state);
    } catch {
      if (!silent) setState('ERROR');
    }
  }, [assetRef, fetchClient]);

  useEffect(() => { void read(false); }, [read]);

  if (state === 'LOADING') return <div data-testid="state-loading"><LoadingState /></div>;
  if (state === 'FORBIDDEN') return <div data-testid="state-forbidden"><ForbiddenState /></div>;
  if (state === 'NOT_FOUND') return <div data-testid="state-notfound"><NotFoundState message="No encontramos este activo. Verifica el código QR." /></div>;
  if (state === 'ERROR' || !data) return <div data-testid="state-error"><ErrorState onRetry={() => void read(false)} /></div>;

  const isReadOnly = data.lifecycleStatus === 'DELIVERED';
  const orNone = (v: string | null) => (v === null || v === undefined ? 'Sin registrar' : v);
  return (
    <div data-testid={`state-content${isReadOnly ? '-readonly' : ''}`}>
      <PageHeader title="Activo" reference={data.assetRef} />
      {isReadOnly && <StatusNotice variant="info" text="Este activo ya fue entregado. Solo lectura." />}
      <DefinitionList items={[
        { label: 'Estado', value: lifecycleLabel(data.lifecycleStatus), testId: 'field-lifecycleStatus' },
        { label: 'Cantidad', value: String(data.quantity), testId: 'field-quantity' },
        { label: 'Unidad de medida', value: data.unitOfMeasure, testId: 'field-unitOfMeasure' },
        { label: 'Ubicación actual', value: orNone(data.currentLocation), testId: 'field-currentLocation' },
        { label: 'Custodio actual', value: orNone(data.currentCustodianRef), testId: 'field-currentCustodianRef' },
        { label: 'Convocatoria', value: data.campaignRef ?? 'Sin registrar', testId: 'field-campaignRef' },
      ]} />
      <AssetActions assetRef={data.assetRef} delivered={isReadOnly} onChanged={() => void read(true)} />
    </div>
  );
}
