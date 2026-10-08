import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as session from '../src/lib/auth/session';
import { fetchTracking, fetchAssetHistory, fetchIntegrity, fetchNarrative, parseIntegrity, parseTracking } from '../src/lib/api/tracking';
import { TrackingScreen } from '../src/screens/TrackingScreen';
import { handOffTrackingCode } from '../src/lib/tracking/handoff';

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});

const TRACKING = {
  financialSnapshot: { currency: 'COP', originalAmount: 5000000, clearedAmount: 5000000, pendingAllocationAmount: 0, confirmedAllocationAmount: 0, refundedAmount: 0 },
  campaignRef: 'camp-1',
  logistics: [{ assetRef: 'AS-1', lifecycleStatus: 'DISPATCHED', assetType: 'Mercado', unitOfMeasure: 'kit', quantity: '10', locationZone: 'Zona centro', custodianCategory: 'LOCAL_ALLY' }],
  status: 'EN_PROCESO',
};

// Datos de PRUEBA con la forma de `GET /donations/tracking/integrity` (backend d169dda)
const INTEGRITY = {
  batches: [
    { anchorStatus: 'ANCHORED', merkleRoot: '0xraiz', transactionHash: '0xtx', network: 'sepolia', anchoredAt: '2026-10-08T10:00:00Z',
      confirmedBlockNumber: 7, eventsOfThisDonation: 2, verification: { result: 'MATCH' } },
    { anchorStatus: 'ANCHORED', merkleRoot: '0xotra', eventsOfThisDonation: 1,
      verification: { result: 'MISMATCH', reason: 'ROOT_MISMATCH', reasonText: 'La raíz recalculada desde los eventos no coincide con la anclada', affectsThisDonation: false } },
    { anchorStatus: 'PENDING', eventsOfThisDonation: 1,
      verification: { result: 'INCONCLUSIVE', reason: 'NOT_ANCHORED', reasonText: 'El lote aún no está anclado en la cadena' } },
  ],
  unanchoredEvents: 3, checkedAt: '2026-10-08T11:00:00Z',
};

describe('Cliente de seguimiento (TR-01 a TR-03)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    session._resetForTest();
    global.fetch = fetchMock as any;
    fetchMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('el código va en Authorization y nunca en la URL; nunca el JWT', async () => {
    session.login('jwt-usuario');
    fetchMock.mockResolvedValue(res(200, TRACKING));
    const r = await fetchTracking('TRK.secreto');
    expect(r.kind).toBe('ok');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/donations/tracking');
    expect(url).not.toContain('TRK');
    expect(init.headers.Authorization).toBe('Bearer TRK.secreto');
  });

  it('aserción negativa: el 401 de seguimiento nunca toca la sesión', async () => {
    session.login('jwt-usuario');
    fetchMock.mockResolvedValue(res(401, { title: 'Unauthorized' }));
    expect(await fetchTracking('malo')).toEqual({ kind: 'invalid-code' });
    expect(session.getState()).toBe('AUTHENTICATED');
    expect(session.getJwt()).toBe('jwt-usuario');
  });

  it('404 → todavía sin proyección; narrativa 202 PENDING; historial con assetRef codificado', async () => {
    fetchMock.mockResolvedValueOnce(res(404));
    expect(await fetchTracking('c')).toEqual({ kind: 'not-found' });
    fetchMock.mockResolvedValueOnce(res(202, { status: 'PENDING' }));
    expect(await fetchNarrative('c')).toEqual({ kind: 'ok', data: { status: 'PENDING', content: undefined, source: undefined } });
    fetchMock.mockResolvedValueOnce(res(200, { history: [{ eventType: 'ASSET_REGISTERED', timestamp: '2026-10-07T10:00:00Z' }] }));
    const h = await fetchAssetHistory('c', 'A/1');
    expect(h.kind).toBe('ok');
    expect(fetchMock.mock.calls[2][0]).toBe('http://api.paxfide.test/api/v1/donations/tracking/assets/A%2F1/history');
  });

  it('integridad (S-22): el código va en Authorization, nunca en la URL; resultado desconocido → no concluyente', async () => {
    session.login('jwt-usuario');
    fetchMock.mockResolvedValueOnce(res(200, INTEGRITY));
    const r = await fetchIntegrity('TRK.secreto');
    expect(r.kind).toBe('ok');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/donations/tracking/integrity');
    expect(init.headers.Authorization).toBe('Bearer TRK.secreto');
    fetchMock.mockResolvedValueOnce(res(401, { title: 'Unauthorized' }));
    expect(await fetchIntegrity('malo')).toEqual({ kind: 'invalid-code' });
    expect(session.getJwt()).toBe('jwt-usuario');
    const odd = parseIntegrity({ batches: [{ anchorStatus: 'ANCHORED', eventsOfThisDonation: 1, verification: { result: 'RARO' } }], unanchoredEvents: 0 });
    expect(odd?.batches[0].result).toBe('INCONCLUSIVE');
    expect(parseIntegrity({ unanchoredEvents: 0 })).toBeNull();
  });

  it('importes fuera del rango seguro no se aproximan', () => {
    const t = parseTracking({ ...TRACKING, financialSnapshot: { ...TRACKING.financialSnapshot, originalAmount: 2 ** 60 } });
    expect(t?.financialSnapshot?.originalAmount).toBeUndefined();
  });
});

describe('TrackingScreen (formulario)', () => {
  const ok = { kind: 'ok' as const, data: parseTracking(TRACKING)! };

  function submit(code: string) {
    fireEvent.change(screen.getByLabelText('Código de seguimiento'), { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver seguimiento' }));
  }

  it('validación: vacío no consulta', () => {
    const tracking = vi.fn();
    render(<TrackingScreen clients={{ tracking }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver seguimiento' }));
    expect(screen.getByText('Este campo es obligatorio.')).toBeInTheDocument();
    expect(tracking).not.toHaveBeenCalled();
  });

  it('código inválido → un único mensaje y el formulario sigue', async () => {
    render(<TrackingScreen clients={{ tracking: async () => ({ kind: 'invalid-code' }) }} />);
    submit('malo');
    expect(await screen.findByText('El código no es válido o expiró.')).toBeInTheDocument();
    expect(screen.getByLabelText('Código de seguimiento')).toHaveValue('');
  });

  it('todavía en proceso (404) → "Volver a consultar" repite con el mismo código', async () => {
    const tracking = vi.fn().mockResolvedValueOnce({ kind: 'not-found' }).mockResolvedValueOnce(ok);
    render(<TrackingScreen clients={{ tracking, narrative: async () => ({ kind: 'not-found' }) }} />);
    submit('TRK.1');
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a consultar' }));
    expect(await screen.findByText('Hechos verificables')).toBeInTheDocument();
    expect(tracking).toHaveBeenNthCalledWith(2, 'TRK.1');
  });

  it('error → Reintentar', async () => {
    const tracking = vi.fn().mockResolvedValueOnce({ kind: 'error' }).mockResolvedValueOnce(ok);
    render(<TrackingScreen clients={{ tracking, narrative: async () => ({ kind: 'not-found' }) }} />);
    submit('TRK.1');
    fireEvent.click(await screen.findByText('Reintentar'));
    expect(await screen.findByText('Hechos verificables')).toBeInTheDocument();
  });

  it('contenido: hechos, bienes con recorrido y relato separado (PENDING → Actualizar)', async () => {
    const narrative = vi.fn()
      .mockResolvedValueOnce({ kind: 'ok', data: { status: 'PENDING' } })
      .mockResolvedValueOnce({ kind: 'ok', data: { status: 'AVAILABLE', content: 'Relato', source: 'LLM_GENERATED' } });
    const history = vi.fn().mockResolvedValue({ kind: 'ok', data: [{ eventType: 'ASSET_DISPATCHED', timestamp: '2026-10-07T10:00:00Z', custodianCategory: 'LOCAL_ALLY' }] });
    render(<TrackingScreen clients={{ tracking: async () => ok, narrative, history }} />);
    submit('TRK.1');
    expect(await screen.findByTestId('tracking-original')).toHaveTextContent('50.000 COP');
    // S-22: la integridad se pide a petición; antes de pedirla no hay ningún resultado
    expect(screen.getByRole('button', { name: 'Comprobar integridad' })).toBeInTheDocument();
    expect(screen.queryByText(/MATCH|Coincide/)).toBeNull();
    expect(screen.getByTestId('tracking-status')).toHaveTextContent('En proceso');
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(await screen.findByText('El relato se está generando.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByTestId('narrative')).toHaveTextContent('Relato');
    expect(screen.getByText('Relato redactado con IA.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver recorrido' }));
    expect(await screen.findByText('Despachado')).toBeInTheDocument();
    expect(history).toHaveBeenCalledWith('TRK.1', 'AS-1');
    // El código no se pinta en la pantalla
    expect(document.body.textContent).not.toContain('TRK.1');
  });

  it('integridad (S-22): a petición, en lenguaje llano, por grupo; 401 → mensaje del código', async () => {
    const integrity = vi.fn()
      .mockResolvedValueOnce({ kind: 'ok', data: parseIntegrity(INTEGRITY)! })
      .mockResolvedValueOnce({ kind: 'invalid-code' });
    render(<TrackingScreen clients={{ tracking: async () => ok, narrative: async () => ({ kind: 'not-found' }), integrity }} />);
    submit('TRK.2');
    fireEvent.click(await screen.findByRole('button', { name: 'Comprobar integridad' }));
    const groups = await screen.findAllByTestId('integrity-batch');
    expect(integrity).toHaveBeenCalledWith('TRK.2');
    expect(groups.map((g) => g.getAttribute('data-result'))).toEqual(['MATCH', 'MISMATCH', 'INCONCLUSIVE']);
    expect(groups[0]).toHaveTextContent('Coincide');
    expect(groups[0]).toHaveTextContent('Anclado en la cadena de bloques');
    expect(groups[0]).toHaveTextContent('0xraiz');
    expect(groups[0]).toHaveTextContent('0xtx');
    expect(groups[0]).toHaveTextContent('sepolia');
    expect(groups[1]).toHaveTextContent('No coincide');
    expect(groups[1]).toHaveTextContent('No afecta a los eventos de tu donación.');
    expect(groups[1]).toHaveTextContent('La raíz recalculada desde los eventos no coincide con la anclada');
    expect(groups[2]).toHaveTextContent('No se pudo comprobar');
    expect(groups[2]).toHaveTextContent('El lote aún no está anclado en la cadena');
    expect(screen.getByText(/Hay 3 eventos de tu donación que todavía no se han anclado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a comprobar' }));
    expect(await screen.findByText('El código no es válido o expiró.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('TRK.2');
  });

  it('código entregado en memoria desde la donación → se abre solo, una vez', async () => {
    handOffTrackingCode('TRK.mem');
    const tracking = vi.fn().mockResolvedValue(ok);
    const { unmount } = render(<TrackingScreen clients={{ tracking, narrative: async () => ({ kind: 'not-found' }) }} />);
    await screen.findByText('Hechos verificables');
    expect(tracking).toHaveBeenCalledWith('TRK.mem');
    unmount();
    render(<TrackingScreen clients={{ tracking }} />);
    expect(screen.getByLabelText('Código de seguimiento')).toBeInTheDocument();
    expect(tracking).toHaveBeenCalledTimes(1);
  });
});
