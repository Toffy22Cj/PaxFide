'use client';

import { useEffect, useState, use } from 'react';
import { fetchAsset, PhysicalAssetOperationalReadModel, LifecycleStatus } from '../../../lib/api/assetClient';
import { LoadingState, ErrorState, ForbiddenState, NotFoundState, StatusNotice } from '../../../components/States';

function translateStatus(status: LifecycleStatus): string {
  switch (status) {
    case 'REGISTERED': return 'Registrado';
    case 'DISPATCHED': return 'Despachado';
    case 'RECEIVED': return 'Recibido';
    case 'DELIVERED': return 'Entregado';
    default:
      const _: never = status;
      return status;
  }
}

export default function AssetPage({ params, fetchClient = fetchAsset }: { params: Promise<{ assetRef: string }>, fetchClient?: typeof fetchAsset }) {
  const resolvedParams = use(params);
  const [state, setState] = useState<'LOADING' | 'SUCCESS' | 'FORBIDDEN' | 'NOT_FOUND' | 'ERROR'>('LOADING');
  const [data, setData] = useState<PhysicalAssetOperationalReadModel | null>(null);

  const loadData = () => {
    setState('LOADING');
    fetchClient(resolvedParams.assetRef).then(res => {
      setState(res.state);
      if (res.state === 'SUCCESS') setData(res.data);
    }).catch(() => setState('ERROR'));
  };

  useEffect(() => {
    loadData();
  }, [resolvedParams.assetRef]);

  if (state === 'LOADING') return <div data-testid="state-loading"><LoadingState /></div>;
  if (state === 'FORBIDDEN') return <div data-testid="state-forbidden"><ForbiddenState /></div>;
  if (state === 'NOT_FOUND') return <div data-testid="state-notfound"><NotFoundState message="No encontramos este activo. Verifica el código QR." /></div>;
  if (state === 'ERROR') return <div data-testid="state-error"><ErrorState onRetry={loadData} /></div>;

  if (state === 'SUCCESS' && data) {
    const isReadOnly = data.lifecycleStatus === 'DELIVERED';
    return (
      <div data-testid={`state-content${isReadOnly ? '-readonly' : ''}`}>
        <h1>Activo Físico: {data.assetRef}</h1>
        {isReadOnly && <StatusNotice variant="info" text="Este activo ya fue entregado. Solo lectura." />}
        <ul>
          <li data-testid="field-lifecycleStatus">Estado: {translateStatus(data.lifecycleStatus)}</li>
          <li data-testid="field-currentCustodianRef">Custodio actual: {data.currentCustodianRef || 'Sin registrar'}</li>
          <li data-testid="field-currentLocation">Ubicación actual: {data.currentLocation || 'Sin registrar'}</li>
          <li data-testid="field-quantity">Cantidad: {data.quantity}</li>
          <li data-testid="field-unitOfMeasure">Unidad de medida: {data.unitOfMeasure}</li>
          <li data-testid="field-campaignRef">Convocatoria: {data.campaignRef}</li>
        </ul>
      </div>
    );
  }

  return null;
}
