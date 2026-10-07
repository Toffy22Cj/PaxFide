import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PredictionScreen, ESTIMATE_LABEL } from '../src/screens/PredictionScreen';
import { fetchPrediction } from '../src/lib/api/prediction';

// Datos de PRUEBA de los tests (no son del backend ni se usan en la aplicación)
const FIXTURE = [
  { t: 0.15, probability: 0.62, estimatedFinalPercent: 95, observedPercent: 18 },
  { t: 0.25, probability: 0.8, estimatedFinalPercent: 112, observedPercent: 31 },
  { t: 0.5, probability: 0.6, estimatedFinalPercent: 104, observedPercent: 58 },
];
const ADMIN = async () => ({ kind: 'ok' as const, principal: { accountId: 'a', organizationId: 'o', roles: ['ADMINISTRATOR' as const] } });

async function consult(client: any, me = ADMIN) {
  render(<PredictionScreen meClient={me} client={client} />);
  fireEvent.change(await screen.findByLabelText('Referencia de la convocatoria'), { target: { value: 'camp-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ver estimación' }));
}

describe('Predicción (P3)', () => {
  it('sin endpoint en el backend: el cliente no inventa nada → "No disponible"', async () => {
    expect(await fetchPrediction('x')).toEqual({ kind: 'unavailable' });
    await consult(fetchPrediction);
    expect(await screen.findByTestId('unavailable-state')).toHaveTextContent('La estimación de convocatorias');
    expect(screen.queryByText(ESTIMATE_LABEL)).toBeNull();
  });

  it('solo ADMINISTRATOR/REPRESENTATIVE; un EMPLOYEE no ve el formulario', async () => {
    render(<PredictionScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['EMPLOYEE'] } })} />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver estimación' })).toBeNull();
  });

  it('con datos: etiqueta permanente, bloque separado y dos gráficos con tabla', async () => {
    const client = vi.fn().mockResolvedValue({ kind: 'ok', checkpoints: FIXTURE });
    await consult(client);
    const block = await screen.findByTestId('prediction-estimate');
    expect(within(block).getByText(ESTIMATE_LABEL)).toBeInTheDocument();
    expect(within(block).getByText(/Es una estimación, no un hecho/)).toBeInTheDocument();
    // Básico: último corte (t = 0.50)
    expect(within(block).getByTestId('basic-probability')).toHaveTextContent('60 %');
    expect(within(block).getByTestId('basic-final')).toHaveTextContent('104 %');
    // Avanzado: SVG accesible + tabla con los tres cortes
    expect(within(block).getByTestId('advanced-chart')).toHaveAttribute('role', 'img');
    const rows = within(block).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('15 %18 %95 %62 %');
    expect(client).toHaveBeenCalledWith('camp-1');
  });

  it('STRICT: se muestra el motivo del backend, nunca un número', async () => {
    await consult(async () => ({ kind: 'no-figure', reason: 'Las convocatorias estrictas no se estiman.' }));
    expect(await screen.findByText('Las convocatorias estrictas no se estiman.')).toBeInTheDocument();
    expect(screen.getByText(ESTIMATE_LABEL)).toBeInTheDocument();
    expect(screen.queryByTestId('basic-probability')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d+ %/);
  });

  it('403 y error', async () => {
    await consult(async () => ({ kind: 'forbidden' }));
    expect(await screen.findByText('No tienes acceso a este recurso.')).toBeInTheDocument();
  });

  it('error al cargar', async () => {
    await consult(async () => ({ kind: 'error' }));
    expect(await screen.findByText('No pudimos cargar la estimación. Inténtalo de nuevo.')).toBeInTheDocument();
  });
});
