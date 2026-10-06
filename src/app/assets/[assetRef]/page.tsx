'use client';

import { useEffect, useState, use } from 'react';
import { fetchAsset, PhysicalAssetOperationalReadModel } from '../../../lib/api/assetClient';

export default function AssetPage({ params, fetchClient = fetchAsset }: { params: Promise<{ assetRef: string }>, fetchClient?: typeof fetchAsset }) {
  const resolvedParams = use(params);
  const [state, setState] = useState<'LOADING' | 'SUCCESS' | 'FORBIDDEN' | 'NOT_FOUND' | 'ERROR'>('LOADING');
  const [data, setData] = useState<PhysicalAssetOperationalReadModel | null>(null);

  useEffect(() => {
    fetchClient(resolvedParams.assetRef).then(res => {
      setState(res.state);
      if (res.state === 'SUCCESS') setData(res.data);
    }).catch(() => setState('ERROR'));
  }, [resolvedParams.assetRef]);

  if (state === 'LOADING') return <div data-testid="state-loading">Cargando...</div>;
  if (state === 'FORBIDDEN') return <div data-testid="state-forbidden">Acceso denegado (403)</div>;
  if (state === 'NOT_FOUND') return <div data-testid="state-notfound">Activo no encontrado (404)</div>;
  if (state === 'ERROR') return <div data-testid="state-error">Error de conexión</div>;

  if (state === 'SUCCESS' && data) {
    const isReadOnly = data.lifecycleStatus === 'DELIVERED';
    return (
      <div data-testid={`state-content${isReadOnly ? '-readonly' : ''}`}>
        <h1>Activo Físico: {data.assetRef}</h1>
        <ul>
          <li data-testid="field-lifecycleStatus">{data.lifecycleStatus}</li>
          <li data-testid="field-currentCustodianRef">{data.currentCustodianRef || 'N/A'}</li>
          <li data-testid="field-currentLocation">{data.currentLocation || 'N/A'}</li>
          <li data-testid="field-quantity">{data.quantity}</li>
          <li data-testid="field-unitOfMeasure">{data.unitOfMeasure}</li>
          <li data-testid="field-campaignRef">{data.campaignRef}</li>
        </ul>
        
        {/* Intencionalmente no se incluye donorRef según la regla T-6 */}
      </div>
    );
  }

  return null;
}
