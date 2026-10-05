import { AssetResponse } from '../src/lib/api/assetClient';

export async function createFakeClient(fakeStatus: string = 'SUCCESS', assetRef: string = 'ASSET-123'): Promise<AssetResponse> {
  await new Promise(r => setTimeout(r, 50));

  if (fakeStatus === 'FORBIDDEN') return { state: 'FORBIDDEN' };
  if (fakeStatus === 'NOT_FOUND') return { state: 'NOT_FOUND' };
  if (fakeStatus === 'ERROR') return { state: 'ERROR' };

  const isDelivered = fakeStatus === 'DELIVERED';

  return {
    state: 'SUCCESS',
    data: {
      assetRef,
      lifecycleStatus: isDelivered ? 'DELIVERED' : 'REGISTERED',
      currentCustodianRef: 'EMP-123',
      currentLocation: 'BODEGA_CENTRAL',
      quantity: 100,
      unitOfMeasure: 'KGS',
      campaignRef: 'CAMP-456'
    }
  };
}
