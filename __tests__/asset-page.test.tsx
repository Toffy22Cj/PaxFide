import React, { Suspense } from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
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
    expect(screen.queryByRole('button', { name: /Dividir activo/i })).toBeNull();
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
    expect(screen.queryByRole('button', { name: /Dividir activo/i })).toBeNull();
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
    expect(screen.queryByRole('button', { name: /Dividir activo/i })).toBeNull();
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
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Activo');
    expect(screen.getByText('ASSET-123')).toBeInTheDocument();
    expect(screen.getByTestId('field-lifecycleStatus')).toHaveTextContent('Registrado');
    // Cada valor va junto a su etiqueta (dt → dd)
    const labelOf = (id: string) => screen.getByTestId(id).previousElementSibling?.textContent;
    expect(labelOf('field-lifecycleStatus')).toBe('Estado');
    expect(labelOf('field-currentCustodianRef')).toBe('Custodio actual');
    expect(labelOf('field-currentLocation')).toBe('Ubicación actual');
    expect(labelOf('field-quantity')).toBe('Cantidad');
    expect(labelOf('field-unitOfMeasure')).toBe('Unidad de medida');
    expect(labelOf('field-campaignRef')).toBe('Convocatoria');
    expect(screen.getByTestId('field-currentCustodianRef')).toHaveTextContent('EMP-123');
    expect(screen.getByTestId('field-currentLocation')).toHaveTextContent('BODEGA_CENTRAL');
    expect(screen.getByTestId('field-quantity')).toHaveTextContent('100');
    expect(screen.getByTestId('field-unitOfMeasure')).toHaveTextContent('KGS');
    expect(screen.getByTestId('field-campaignRef')).toHaveTextContent('CAMP-456');

    // Aserción negativa: donorRef ('DONOR-SECRET') NO debe ser renderizado
    expect(screen.queryByText('DONOR-SECRET')).toBeNull();

    // Aserción negativa: no color style, no "Dividir activo" button
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

    expect(screen.getByTestId('field-currentCustodianRef')).toHaveTextContent('Sin registrar');
    expect(screen.getByTestId('field-currentLocation')).toHaveTextContent('Sin registrar');
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

    expect(screen.getByTestId('field-lifecycleStatus')).toHaveTextContent('Entregado');
    expect(screen.getByText('Este activo ya fue entregado. Solo lectura.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dividir activo/i })).toBeNull();
  });

  describe('Manejo de errores reales de API con Problem Detail', () => {
    let originalEnv: string | undefined;
    
    beforeEach(() => {
      originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.paxfide.com';
    });
    
    afterEach(() => {
      process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
    });

    const errorBody = {
      type: "about:blank",
      title: "Internal",
      status: 500,
      detail: "java.lang.NullPointerException at X"
    };

    it('no filtra detalles del error 500 a la interfaz', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => errorBody
      } as Response);

      render(
        <Suspense fallback={<div data-testid="suspense-loading"></div>}>
          <AssetPage params={createResolvedPromise({ assetRef: 'ASSET-123' })} />
        </Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByText('No pudimos cargar la información. Inténtalo de nuevo.')).toBeInTheDocument();
      });
      
      expect(screen.queryByText(/NullPointerException/)).toBeNull();
      expect(screen.queryByText('Internal')).toBeNull();
    });

    it('no filtra detalles del error 403 a la interfaz', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ ...errorBody, status: 403 })
      } as Response);

      render(
        <Suspense fallback={<div data-testid="suspense-loading"></div>}>
          <AssetPage params={createResolvedPromise({ assetRef: 'ASSET-123' })} />
        </Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByText('No tienes acceso a este recurso.')).toBeInTheDocument();
      });
      
      expect(screen.queryByText(/NullPointerException/)).toBeNull();
      expect(screen.queryByText('Internal')).toBeNull();
    });

    it('no filtra detalles del error 404 a la interfaz', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ ...errorBody, status: 404 })
      } as Response);

      render(
        <Suspense fallback={<div data-testid="suspense-loading"></div>}>
          <AssetPage params={createResolvedPromise({ assetRef: 'ASSET-123' })} />
        </Suspense>
      );
      
      await waitFor(() => {
        expect(screen.getByText('No encontramos este activo. Verifica el código QR.')).toBeInTheDocument();
      });
      
      expect(screen.queryByText(/NullPointerException/)).toBeNull();
      expect(screen.queryByText('Internal')).toBeNull();
    });
  });
});
