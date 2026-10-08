import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PredictionScreen, ESTIMATE_LABEL } from '../src/screens/PredictionScreen';
import { fetchPrediction, fetchPredictionHistory, parsePrediction, parsePredictionHistory } from '../src/lib/api/prediction';
import * as session from '../src/lib/auth/session';

// Datos de PRUEBA de los tests (no son del backend ni se usan en la aplicación)
const ESTIMATE = {
  kind: 'ESTIMATE', modelVersion: 'test-1', warning: 'Datos sintéticos', available: true,
  probabilityReachTarget: 0.62, estimatedFinalPctOfTarget: 1.04, pctTimeElapsed: 0.5,
  warnings: ['Aviso de prueba'], asOf: '2026-10-07T00:00:00Z',
};
const ADMIN = async () => ({ kind: 'ok' as const, principal: { accountId: 'a', organizationId: 'o', roles: ['ADMINISTRATOR' as const] } });
const LIST = async () => ({
  kind: 'ok' as const,
  items: [{ campaignRef: 'camp-1', publicCode: 'P1', title: 'Agua', status: 'OPEN', currency: 'COP', targetAmount: '1000', clearedAmount: '580', responsibles: [], assignedEmployeeCount: 0 }],
});

// Forma de `…/prediction/history` (backend d169dda): el corte del 50 % aún no llega y no tiene cifra
const HISTORY = {
  kind: 'ESTIMATE', modelVersion: 'test-1', warning: 'Datos sintéticos', basis: 'EVENT_STORE', available: true,
  cuts: [
    { t: 0.25, cutAt: '2026-09-15T00:00:00Z', available: true, probabilityReachTarget: 0.55, estimatedFinalPctOfTarget: 0.97, pctRaisedAtCut: 0.21 },
    { t: 0.15, cutAt: '2026-09-09T00:00:00Z', available: false, unavailableReason: 'TARGET_ALREADY_REACHED', unavailableText: 'La meta ya se alcanzó', pctRaisedAtCut: 1.1 },
    { t: 0.5, cutAt: '2026-10-01T00:00:00Z', available: false, unavailableReason: 'FUTURE_CUT', unavailableText: 'Este corte aún no ha llegado' },
  ],
  warnings: ['En los cortes pasados la tasa de fallos es 0'], asOf: '2026-10-08T00:00:00Z',
};
const NO_HISTORY = async () => ({ kind: 'no-figure' as const, reason: 'Sin historial de prueba' });

async function consult(client: any, opts: { me?: any; list?: any; history?: any } = {}) {
  render(<PredictionScreen meClient={opts.me ?? ADMIN} client={client} historyClient={opts.history ?? NO_HISTORY} listClient={opts.list ?? LIST} />);
  await screen.findByRole('button', { name: 'Ver estimación' });
  fireEvent.click(screen.getByRole('button', { name: 'Ver estimación' }));
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); session._resetForTest(); });

describe('Predicción (P3)', () => {
  it('parsePrediction sigue el contrato del backend (fracciones 0–1)', () => {
    expect(parsePrediction(ESTIMATE)).toMatchObject({ kind: 'ok', view: { probability: 0.62, estimatedFinal: 1.04, pctTimeElapsed: 0.5, warnings: ['Aviso de prueba'] } });
    expect(parsePrediction({ kind: 'ESTIMATE', available: false, unavailableReason: 'STRICT_POLICY_EXCLUDED', unavailableText: 'Motivo' }))
      .toEqual({ kind: 'no-figure', reason: 'Motivo' });
    expect(parsePrediction({ kind: 'OTRA', available: true })).toEqual({ kind: 'error' });
    expect(parsePrediction({ ...ESTIMATE, probabilityReachTarget: undefined })).toEqual({ kind: 'error' });
  });

  it('el cliente llama a la ruta real de la organización', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
    session.login('jwt-test');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(ESTIMATE), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await fetchPrediction('org-1', 'camp-1');
    expect(r.kind).toBe('ok');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/organizations\/org-1\/campaigns\/camp-1\/prediction$/);
  });

  it('solo ADMINISTRATOR/REPRESENTATIVE; un EMPLOYEE no ve el formulario', async () => {
    render(<PredictionScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['EMPLOYEE'] } })} listClient={LIST} />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver estimación' })).toBeNull();
  });

  it('con datos: etiqueta permanente, bloque separado, avisos del backend y dos gráficos con tabla', async () => {
    const client = vi.fn().mockResolvedValue(parsePrediction(ESTIMATE));
    await consult(client);
    const block = await screen.findByTestId('prediction-estimate');
    expect(within(block).getByText(ESTIMATE_LABEL)).toBeInTheDocument();
    expect(within(block).getByText(/Es una estimación, no un hecho/)).toBeInTheDocument();
    expect(within(block).getByTestId('prediction-warnings')).toHaveTextContent('Aviso de prueba');
    expect(within(block).getByTestId('basic-probability')).toHaveTextContent('62 %');
    expect(within(block).getByTestId('basic-final')).toHaveTextContent('104 %');
    expect(within(block).getByTestId('advanced-chart')).toHaveAttribute('role', 'img');
    // Hecho (recaudado 58 % del listado) y estimación separados en la tabla
    expect(within(block).getByText('Recaudado hoy').closest('tr')).toHaveTextContent('58 % de la metaHecho');
    expect(within(block).getByText('Final estimado').closest('tr')).toHaveTextContent('104 % de la metaEstimación');
    expect(client).toHaveBeenCalledWith('o', 'camp-1');
  });

  it('sin listado permitido (REPRESENTATIVE, 403): se escribe la referencia', async () => {
    const client = vi.fn().mockResolvedValue({ kind: 'no-figure', reason: 'x' });
    render(<PredictionScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['REPRESENTATIVE'] } })}
      client={client} historyClient={NO_HISTORY} listClient={async () => ({ kind: 'forbidden' })} />);
    fireEvent.change(await screen.findByLabelText('Referencia de la convocatoria'), { target: { value: 'camp-9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver estimación' }));
    expect(await screen.findByText('x')).toBeInTheDocument();
    expect(client).toHaveBeenCalledWith('o', 'camp-9');
  });

  it('organización sin convocatorias: estado vacío', async () => {
    render(<PredictionScreen meClient={ADMIN} listClient={async () => ({ kind: 'ok', items: [] })} />);
    expect(await screen.findByText('Tu organización todavía no tiene convocatorias.')).toBeInTheDocument();
  });

  it('STRICT: se muestra el motivo del backend, nunca un número', async () => {
    await consult(async () => ({ kind: 'no-figure', reason: 'Las convocatorias estrictas no se estiman.' }));
    expect(await screen.findByText('Las convocatorias estrictas no se estiman.')).toBeInTheDocument();
    expect(screen.getByText(ESTIMATE_LABEL)).toBeInTheDocument();
    expect(screen.queryByTestId('basic-probability')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d+ %/);
  });

  it('OUTSIDE_TRAINED_RANGE (backend 85b702b): el motivo del backend, sin cifra; la evolución por cortes sigue (S-17)', async () => {
    const outcome = parsePrediction({ kind: 'ESTIMATE', available: false, unavailableReason: 'OUTSIDE_TRAINED_RANGE',
      unavailableText: 'Fuera del rango de entrenamiento: el modelo solo estima entre el 15 % y el 50 % del tiempo.', asOf: '2026-10-08T00:00:00Z' });
    expect(outcome).toEqual({ kind: 'no-figure', reason: 'Fuera del rango de entrenamiento: el modelo solo estima entre el 15 % y el 50 % del tiempo.' });
    await consult(async () => outcome, { history: async () => parsePredictionHistory(HISTORY) });
    expect(await screen.findByText(/Fuera del rango de entrenamiento/)).toBeInTheDocument();
    expect(screen.getByText(ESTIMATE_LABEL)).toBeInTheDocument();
    expect(screen.queryByTestId('basic-probability')).toBeNull();
    expect(screen.queryByTestId('advanced-chart')).toBeNull();
    expect(screen.getByTestId('history-chart')).toBeInTheDocument();
  });

  it('S-17: parsePredictionHistory ordena los cortes y nunca da cifra a un corte sin ella', () => {
    const r = parsePredictionHistory(HISTORY);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.cuts.map((c) => c.t)).toEqual([0.15, 0.25, 0.5]);
    expect(r.cuts[0]).toMatchObject({ available: false, reason: 'La meta ya se alcanzó', raisedAtCut: 1.1, probability: undefined, estimatedFinal: undefined });
    expect(r.cuts[2]).toMatchObject({ available: false, reason: 'Este corte aún no ha llegado', raisedAtCut: undefined });
    // "Disponible" sin cifras → sin cifra (no se inventa)
    const odd = parsePredictionHistory({ ...HISTORY, cuts: [{ t: 0.15, available: true }] });
    expect(odd.kind === 'ok' && odd.cuts[0].available).toBe(false);
    expect(parsePredictionHistory({ kind: 'ESTIMATE', available: false, unavailableText: 'Estricta', cuts: [] })).toEqual({ kind: 'no-figure', reason: 'Estricta' });
    expect(parsePredictionHistory({ kind: 'ESTIMATE', available: true })).toEqual({ kind: 'error' });
  });

  it('S-17: el cliente llama a la ruta del historial', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
    session.login('jwt-test');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(HISTORY), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchPredictionHistory('org-1', 'camp-1')).kind).toBe('ok');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/organizations\/org-1\/campaigns\/camp-1\/prediction\/history$/);
  });

  it('S-17: gráfico y tabla por corte; el futuro y el de meta alcanzada salen vacíos con su motivo; avisos del backend', async () => {
    const history = vi.fn().mockResolvedValue(parsePredictionHistory(HISTORY));
    await consult(vi.fn().mockResolvedValue(parsePrediction(ESTIMATE)), { history });
    const section = await screen.findByTestId('history-section');
    expect(history).toHaveBeenCalledWith('o', 'camp-1');
    expect(within(section).getByTestId('history-warnings')).toHaveTextContent('En los cortes pasados la tasa de fallos es 0');
    expect(within(section).getByTestId('history-cut-15')).toHaveAttribute('data-available', 'false');
    expect(within(section).getByTestId('history-cut-25')).toHaveAttribute('data-available', 'true');
    expect(within(section).getByTestId('history-cut-50')).toHaveAttribute('data-available', 'false');
    const rows = within(within(section).getByTestId('history-table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('15 % del tiempo');
    expect(rows[1]).toHaveTextContent('110 % de la meta');
    expect(rows[1]).toHaveTextContent('Sin cifra: La meta ya se alcanzó');
    expect(rows[2]).toHaveTextContent('21 % de la meta97 % de la meta55 %');
    expect(rows[3]).toHaveTextContent('Sin cifra: Este corte aún no ha llegado');
    expect(rows[3]).not.toHaveTextContent(/\d+ % de la meta/);
  });

  it('S-17: sin estimaciones por corte (STRICT) → el motivo; un error del historial no tapa la estimación actual', async () => {
    await consult(vi.fn().mockResolvedValue(parsePrediction(ESTIMATE)), { history: async () => ({ kind: 'error' }) });
    expect(await screen.findByText('No pudimos cargar la evolución de la estimación. Inténtalo de nuevo.')).toBeInTheDocument();
    expect(screen.getByTestId('basic-probability')).toHaveTextContent('62 %');
  });

  it('403', async () => {
    await consult(async () => ({ kind: 'forbidden' }));
    expect(await screen.findByText('No tienes acceso a este recurso.')).toBeInTheDocument();
  });

  it('error al cargar', async () => {
    await consult(async () => ({ kind: 'error' }));
    expect(await screen.findByText('No pudimos cargar la estimación. Inténtalo de nuevo.')).toBeInTheDocument();
  });
});
