// Ref: paxfide-linea-tiempo2.html (2026-11-12): la carretera del seguimiento con el camión.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoadTimeline, roadState } from '../src/components/tracking/RoadTimeline';
import type { Transition } from '../src/lib/api/tracking';

const ev = (eventType: string, timestamp: string, extra: Partial<Transition> = {}) =>
  ({ eventType, timestamp, locationZone: null, custodianCategory: 'LOGISTICS_PARTNER', ...extra }) as Transition;
const PAID = '2026-10-02T10:14:00Z';

describe('roadState', () => {
  it('sin pago confirmado no hay estación alcanzada y el camión espera antes de la primera', () => {
    const r = roadState(undefined, []);
    expect(r.current).toBe(-1);
    expect(r.stations.every((s) => !s.reached)).toBe(true);
  });

  it('pagado y sin bienes: el camión en "Pago confirmado"', () => {
    const r = roadState(PAID, []);
    expect(r.current).toBe(0);
    expect(r.truckAt).toBe(0);
  });

  it('con un despacho como último evento, el camión queda a medio camino hacia "Recibido"', () => {
    const r = roadState(PAID, [ev('ASSET_REGISTERED', '2026-10-03T00:00:00Z'), ev('ASSET_DISPATCHED', '2026-10-06T00:00:00Z')]);
    expect(r.current).toBe(2);
    expect(r.truckAt).toBe(2.5);
    expect(r.stations[2]).toMatchObject({ reached: true, stepIndex: 1 });
  });

  it('el estado es el del último evento de la carretera: recibido y despachado de nuevo vuelve a ir en camino', () => {
    const r = roadState(PAID, [ev('ASSET_REGISTERED', 'a'), ev('ASSET_DISPATCHED', 'b'), ev('ASSET_RECEIVED', 'c'),
      ev('ASSET_CUSTODY_TRANSFERRED', 'd'), ev('ASSET_DISPATCHED', 'e')]);
    expect(r.current).toBe(2);
    expect(r.stations[2].stepIndex).toBe(4);
    expect(r.stations[3].reached).toBe(false);
  });

  it('entregado: la última estación y el camión parado en ella', () => {
    const r = roadState(PAID, [ev('ASSET_REGISTERED', 'a'), ev('ASSET_DISPATCHED', 'b'), ev('ASSET_RECEIVED', 'c'), ev('ASSET_DELIVERED', 'd')]);
    expect(r.current).toBe(4);
    expect(r.truckAt).toBe(4);
  });
});

describe('RoadTimeline', () => {
  const item = { assetRef: 'A', lifecycleStatus: 'DISPATCHED', assetType: 'Kits', unitOfMeasure: 'kit', quantity: '1', locationZone: null, custodianCategory: 'LOGISTICS_PARTNER' } as any;
  const steps = [ev('ASSET_REGISTERED', '2026-10-03T00:00:00Z', { anchorStatus: 'ANCHORED' }), ev('ASSET_DISPATCHED', '2026-10-06T00:00:00Z', { anchorStatus: 'PENDING' })];

  it('pinta las cinco estaciones, el camión y la píldora "En camino"', () => {
    render(<RoadTimeline item={item} paidAt={PAID} steps={steps} isSelected={() => false} onSelect={vi.fn()} />);
    expect(screen.getAllByTestId('road-station')).toHaveLength(5);
    expect(screen.getByTestId('road-truck')).toBeTruthy();
    expect(screen.getByTestId('road-pill').textContent).toBe('En camino · 3 de 5');
  });

  it('una estación alcanzada abre su paso; una pendiente no se puede pulsar', () => {
    const onSelect = vi.fn();
    render(<RoadTimeline item={item} paidAt={PAID} steps={steps} isSelected={() => false} onSelect={onSelect} />);
    const [pay, registered, dispatched, received] = screen.getAllByTestId('road-station') as HTMLButtonElement[];
    fireEvent.click(pay);
    fireEvent.click(registered);
    fireEvent.click(dispatched);
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual([
      { kind: 'payment' }, { kind: 'step', assetRef: 'A', index: 0 }, { kind: 'step', assetRef: 'A', index: 1 }]);
    expect(received.disabled).toBe(true);
  });

  it('sin bienes todavía: solo el pago, "Esperando el lote"', () => {
    render(<RoadTimeline paidAt={PAID} steps={[]} isSelected={() => false} onSelect={vi.fn()} />);
    expect(screen.getByTestId('road-pill').textContent).toBe('Esperando el lote');
  });
});
