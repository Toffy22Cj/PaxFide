export type LifecycleStatus = 'REGISTERED' | 'DISPATCHED' | 'RECEIVED' | 'DELIVERED';

export interface PhysicalAssetOperationalReadModel {
  assetRef: string;
  lifecycleStatus: LifecycleStatus;
  currentCustodianRef: string | null;
  currentLocation: string | null;
  quantity: number;
  unitOfMeasure: string;
  campaignRef: string;
}

export class ApiBaseUrlMisconfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiBaseUrlMisconfiguredError';
  }
}

export type AssetResponse = 
  | { state: 'SUCCESS', data: PhysicalAssetOperationalReadModel }
  | { state: 'FORBIDDEN' }
  | { state: 'NOT_FOUND' }
  | { state: 'ERROR' };

import { getJwt, handle401 } from '../auth/session';

export async function fetchAsset(assetRef: string): Promise<AssetResponse> {
  const token = getJwt();
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    throw new ApiBaseUrlMisconfiguredError('NEXT_PUBLIC_API_BASE_URL no está configurada.');
  }

  if (typeof window !== 'undefined') {
    try {
      const fullUrl = new URL(baseUrl, window.location.href);
      if (fullUrl.origin === window.location.origin) {
        throw new ApiBaseUrlMisconfiguredError('NEXT_PUBLIC_API_BASE_URL no puede ser el mismo origen que la app.');
      }
    } catch (e) {
      if (e instanceof ApiBaseUrlMisconfiguredError) throw e;
    }
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${baseUrl}/physical-assets/${assetRef}`, {
      headers
    });

    if (res.status === 401) {
      handle401(false);
      return { state: 'ERROR' };
    }
    if (res.status === 403) return { state: 'FORBIDDEN' };
    if (res.status === 404) return { state: 'NOT_FOUND' };
    if (!res.ok) return { state: 'ERROR' };

    const json = await res.json();
    const data: PhysicalAssetOperationalReadModel = {
      assetRef: json.assetRef,
      lifecycleStatus: json.lifecycleStatus,
      currentCustodianRef: json.currentCustodianRef,
      currentLocation: json.currentLocation,
      quantity: json.quantity,
      unitOfMeasure: json.unitOfMeasure,
      campaignRef: json.campaignRef
    };
    return { state: 'SUCCESS', data };
  } catch (e) {
    return { state: 'ERROR' };
  }
}
