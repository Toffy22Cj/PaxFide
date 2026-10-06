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
      expect(screen.getByText('No encontramos este activo. Verifica el código QR.')).toBeInTheDocument();
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
      expect(screen.getByText('No tienes acceso a este recurso.')).toBeInTheDocument();
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
      expect(screen.getByText('No pudimos cargar la información. Inténtalo de nuevo.')).toBeInTheDocument();
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
    expect(screen.getByText('Activo ASSET-123')).toBeInTheDocument();
    expect(screen.getByTestId('field-lifecycleStatus')).toHaveTextContent('Estado: Registrado');
    expect(screen.getByTestId('field-currentCustodianRef')).toHaveTextContent('Custodio actual: EMP-123');
    expect(screen.getByTestId('field-currentLocation')).toHaveTextContent('Ubicación actual: BODEGA_CENTRAL');
    expect(screen.getByTestId('field-quantity')).toHaveTextContent('Cantidad: 100');
    expect(screen.getByTestId('field-unitOfMeasure')).toHaveTextContent('Unidad de medida: KGS');
    expect(screen.getByTestId('field-campaignRef')).toHaveTextContent('Convocatoria: CAMP-456');

    // Aserción negativa: donorRef ('DONOR-SECRET') NO debe ser renderizado
    expect(screen.queryByText('DONOR-SECRET')).toBeNull();

    // Aserción negativa: no stack trace, no color style, no "Dividir activo" button
    expect(screen.queryByText(/stack trace/i)).toBeNull();
    expect(screen.getByTestId('field-lifecycleStatus').style.color).toBe('');
    expect(screen.queryByRole('button', { name: /Dividir activo/i })).toBeNull();
  });

  it('Muestra "Sin registrar" para currentLocation y currentCustodianRef null', async () => {
    const fakeClient = async () => {
      const resp = await createFakeClient('SUCCESS', 'ASSET-123');
      if (resp.state === 'SUCCESS') {
        resp.data.currentCustodianRef = null as any;
        resp.data.currentLocation = null as any;
      }
      return resp;
    };
    
    render(
      <Suspense fallback={<div data-testid="suspense-loading"></div>}>
        <AssetPage params={createResolvedPromise({ assetRef: 'ASSET-123' })} fetchClient={fakeClient} />
      </Suspense>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('state-content')).toBeInTheDocument();
    });

    expect(screen.getByTestId('field-currentCustodianRef')).toHaveTextContent('Custodio actual: Sin registrar');
    expect(screen.getByTestId('field-currentLocation')).toHaveTextContent('Ubicación actual: Sin registrar');
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

    expect(screen.getByTestId('field-lifecycleStatus')).toHaveTextContent('Estado: Entregado');
    expect(screen.getByText('Este activo ya fue entregado. Solo lectura.')).toBeInTheDocument();
  });
});
