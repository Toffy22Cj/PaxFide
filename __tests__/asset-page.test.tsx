import React, { Suspense } from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import AssetPage from '../src/app/assets/[assetRef]/page';
import { createFakeClient } from './fakeAssetClient';

function createResolvedPromise<T>(value: T): Promise<T> {
  const promise = Promise.resolve(value) as any;
  promise.status = 'fulfilled';
  promise.value = value;
  return promise;
}

describe('Asset Page (T-6)', () => {
  afterEach(() => {
    cleanup();
  });

  it('Muestra estado de carga inicialmente', async () => {
    const fakeClient = () => new Promise<any>(() => {});
    render(
      <Suspense fallback={<div data-testid="suspense-loading"></div>}>
        <AssetPage params={createResolvedPromise({ assetRef: 'ASSET-123' })} fetchClient={fakeClient} />
      </Suspense>
    );
    await waitFor(() => {
      expect(screen.getByTestId('state-loading')).toBeInTheDocument();
    });
  });

  it('Muestra 404 (NOT_FOUND)', async () => {
    const fakeClient = async () => createFakeClient('NOT_FOUND', 'ASSET-123');
    render(
      <Suspense fallback={<div data-testid="suspense-loading"></div>}>
        <AssetPage params={createResolvedPromise({ assetRef: 'ASSET-123' })} fetchClient={fakeClient} />
      </Suspense>
    );
    await waitFor(() => {
      expect(screen.getByTestId('state-notfound')).toBeInTheDocument();
    });
  });

  it('Muestra 403 (FORBIDDEN)', async () => {
    const fakeClient = async () => createFakeClient('FORBIDDEN', 'ASSET-123');
    render(
      <Suspense fallback={<div data-testid="suspense-loading"></div>}>
        <AssetPage params={createResolvedPromise({ assetRef: 'ASSET-123' })} fetchClient={fakeClient} />
      </Suspense>
    );
    await waitFor(() => {
      expect(screen.getByTestId('state-forbidden')).toBeInTheDocument();
    });
  });

  it('Muestra ERROR genérico', async () => {
    const fakeClient = async () => createFakeClient('ERROR', 'ASSET-123');
    render(
      <Suspense fallback={<div data-testid="suspense-loading"></div>}>
        <AssetPage params={createResolvedPromise({ assetRef: 'ASSET-123' })} fetchClient={fakeClient} />
      </Suspense>
    );
    await waitFor(() => {
      expect(screen.getByTestId('state-error')).toBeInTheDocument();
    });
  });

  it('Muestra los 7 campos del ReadModel y oculta donorRef en SUCCESS', async () => {
    const fakeClient = async () => createFakeClient('SUCCESS', 'ASSET-123');
    
    render(
      <Suspense fallback={<div data-testid="suspense-loading"></div>}>
        <AssetPage params={createResolvedPromise({ assetRef: 'ASSET-123' })} fetchClient={fakeClient} />
      </Suspense>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('state-content')).toBeInTheDocument();
    });

    // 7 campos esperados
    expect(screen.getByText('Activo Físico: ASSET-123')).toBeInTheDocument();
    expect(screen.getByTestId('field-lifecycleStatus')).toHaveTextContent('REGISTERED');
    expect(screen.getByTestId('field-currentCustodianRef')).toHaveTextContent('EMP-123');
    expect(screen.getByTestId('field-currentLocation')).toHaveTextContent('BODEGA_CENTRAL');
    expect(screen.getByTestId('field-quantity')).toHaveTextContent('100');
    expect(screen.getByTestId('field-unitOfMeasure')).toHaveTextContent('KGS');
    expect(screen.getByTestId('field-campaignRef')).toHaveTextContent('CAMP-456');

    // Aserción negativa: donorRef ('DONOR-SECRET') NO debe ser renderizado
    expect(screen.queryByText('DONOR-SECRET')).toBeNull();
  });

  it('Muestra estado de solo lectura cuando es DELIVERED', async () => {
    const fakeClient = async () => createFakeClient('DELIVERED', 'ASSET-123');

    render(
      <Suspense fallback={<div data-testid="suspense-loading"></div>}>
        <AssetPage params={createResolvedPromise({ assetRef: 'ASSET-123' })} fetchClient={fakeClient} />
      </Suspense>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('state-content-readonly')).toBeInTheDocument();
    });

    expect(screen.getByTestId('field-lifecycleStatus')).toHaveTextContent('DELIVERED');
  });
});
