// Ref: plan-fase7-pantallas.md A-4 (tests); prompts-agentes-estilo-v2.md VS-7, §3.1 y §3.5 (T1-1 a T1-7).
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as session from '../src/lib/auth/session';
import { parseIntegrity, parseTracking, type DonationIntegrity, type Transition } from '../src/lib/api/tracking';
import { TrackingScreen, tabLabel } from '../src/screens/TrackingScreen';
import { TrackingCodeChip, maskTrackingCode, REVEAL_MS } from '../src/components/tracking/TrackingCodeChip';
import { integrityVerdict } from '../src/components/tracking/IntegrityBadge';
import { asTrackingEvent, showsTruck, stepKind, TRACKING_EVENTS, NO_PUBLIC_ZONE } from '../src/components/tracking/events';

const BASE = {
  financialSnapshot: { currency: 'COP', originalAmount: 5000000, clearedAmount: 5000000, pendingAllocationAmount: 0, confirmedAllocationAmount: 0, refundedAmount: 0 },
  logistics: [{ assetRef: 'AS-1', lifecycleStatus: 'DISPATCHED', assetType: 'Mercado', unitOfMeasure: 'kit', quantity: '10', locationZone: null, custodianCategory: 'UNCATEGORIZED' }],
  status: 'EN_PROCESO',
};
const integrityOf = (x: unknown) => ({ kind: 'ok' as const, data: parseIntegrity(x)! });
const MATCH = { batches: [{ anchorStatus: 'ANCHORED', merkleRoot: '0xraizunica', transactionHash: '0xtxunica', eventsOfThisDonation: 2, verification: { result: 'MATCH' } }], unanchoredEvents: 0 };
const steps = (...events: string[]): Transition[] => events.map((eventType, i) => ({
  eventType, timestamp: `2026-10-0${i + 1}T10:00:00Z`, custodianCategory: i === 0 ? 'REGIONAL_WAREHOUSE' : 'UNCATEGORIZED',
  locationZone: eventType === 'ASSET_DISPATCHED' ? undefined : 'Zona norte',
}));

function open(over: Partial<typeof BASE> & Record<string, unknown> = {}, history: Transition[] = steps('ASSET_REGISTERED', 'ASSET_DISPATCHED'), integrity: unknown = MATCH) {
  const tracking = { kind: 'ok' as const, data: parseTracking({ ...BASE, ...over })! };
  render(<TrackingScreen clients={{
    tracking: async () => tracking, narrative: async () => ({ kind: 'ok', data: { status: 'AVAILABLE', content: 'Resumen', source: 'LLM_GENERATED' } }),
    history: async () => ({ kind: 'ok', data: history }), integrity: async () => integrityOf(integrity),
  }} />);
  fireEvent.change(screen.getByLabelText('Código de seguimiento'), { target: { value: 'TRK.abcdef8841' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ver seguimiento' }));
}

beforeEach(() => session._resetForTest());

describe('Pasos del recorrido (VS-7)', () => {
  it('cada evento conocido tiene su dibujo (switch con never); uno desconocido no se inventa', () => {
    for (const e of TRACKING_EVENTS) expect(typeof stepKind(e)).toBe('string');
    expect(asTrackingEvent('ASSET_TELEPORTED')).toBeNull();
    expect(asTrackingEvent('ASSET_DELIVERED')).toBe('ASSET_DELIVERED');
  });

  it('camión solo si el último evento es ASSET_DISPATCHED', () => {
    expect(showsTruck(steps('ASSET_REGISTERED', 'ASSET_DISPATCHED'))).toBe(true);
    expect(showsTruck(steps('ASSET_DISPATCHED', 'ASSET_RECEIVED'))).toBe(false);
    expect(showsTruck([])).toBe(false);
  });

  it('pasos con evento, fecha, zona (o "sin zona pública") y categoría del custodio, incluida UNCATEGORIZED', async () => {
    open();
    const items = await screen.findAllByTestId('tracking-step');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Registrado');
    expect(items[0]).toHaveTextContent('Zona norte');
    expect(items[0]).toHaveTextContent('Bodega regional');
    expect(items[1]).toHaveTextContent('Despachado');
    expect(items[1]).toHaveTextContent(NO_PUBLIC_ZONE);
    expect(items[1]).toHaveTextContent('Sin categoría');
    expect(items[1].querySelector('time')).not.toBeNull();
    // El bien sin zona pública tampoco la inventa
    expect(screen.getByTestId('asset-lane')).toHaveTextContent(NO_PUBLIC_ZONE);
    expect(screen.getByTestId('tracking-truck')).toBeInTheDocument();
  });

  it('sin camión cuando el último evento no es un despacho (negativa)', async () => {
    open({}, steps('ASSET_DISPATCHED', 'ASSET_RECEIVED'));
    await screen.findAllByTestId('tracking-step');
    expect(screen.queryByTestId('tracking-truck')).toBeNull();
  });

  it('activo sin historial → "Sin movimientos registrados."', async () => {
    open({}, []);
    expect(await screen.findByText('Sin movimientos registrados.')).toBeInTheDocument();
    expect(screen.queryByTestId('tracking-truck')).toBeNull();
  });

  it('varios bienes: una pestaña por bien; la pestaña elige el carril activo', async () => {
    open({ logistics: [BASE.logistics[0], { ...BASE.logistics[0], assetRef: 'AS-2', assetType: undefined }] as any });
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Mercado', 'Bien 2']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByTestId('asset-lane')).toHaveLength(2);
    // Mismo nombre: la pestaña lleva el número
    expect(tabLabel([BASE.logistics[0], BASE.logistics[0]] as any, 1)).toBe('Mercado 2');
  });
});

describe('Cabecera (G-1) y resumen', () => {
  it('con campaignTitle y organizationName: los dos en la cabecera', async () => {
    open({ campaignTitle: 'Mercados para adultos mayores', organizationName: 'Fundación Demo' });
    expect(await screen.findByTestId('tracking-campaign')).toHaveTextContent('Mercados para adultos mayores · Fundación Demo');
    expect(screen.getByTestId('tracking-pill')).toHaveTextContent('En proceso · 1 bien');
  });

  it('sin campaignTitle: sin subtítulo, sin inventar nada', async () => {
    open();
    await screen.findByTestId('tracking-pill');
    expect(screen.queryByTestId('tracking-campaign')).toBeNull();
  });

  it('el resumen PENDING no muestra contenido; solo AVAILABLE, rotulado', async () => {
    const narrative = vi.fn().mockResolvedValue({ kind: 'ok', data: { status: 'PENDING', content: 'no debe verse' } });
    render(<TrackingScreen clients={{ tracking: async () => ({ kind: 'ok', data: parseTracking(BASE)! }), narrative,
      history: async () => ({ kind: 'ok', data: [] }), integrity: async () => integrityOf(MATCH) }} />);
    fireEvent.change(screen.getByLabelText('Código de seguimiento'), { target: { value: 'TRK.x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver seguimiento' }));
    expect(await screen.findByText('El relato se está generando.')).toBeInTheDocument();
    expect(screen.queryByText('no debe verse')).toBeNull();
    expect(screen.queryByTestId('narrative')).toBeNull();
  });

  it('ningún hash en el DOM fuera de la insignia de integridad (G-3)', async () => {
    open();
    await screen.findAllByTestId('integrity-batch');
    const badge = screen.getByTestId('integrity');
    expect(badge).toHaveTextContent('0xraizunica');
    const outside = document.body.cloneNode(true) as HTMLElement;
    outside.querySelector('[data-testid="integrity"]')!.remove();
    expect(outside.textContent).not.toMatch(/0x[0-9a-z]+/);
  });
});

describe('Insignia de integridad (P4)', () => {
  const v = (x: unknown) => integrityVerdict(parseIntegrity(x) as DonationIntegrity);
  const batch = (result: string, reason?: string, extra: Record<string, unknown> = {}) =>
    ({ anchorStatus: result === 'INCONCLUSIVE' && reason === 'NOT_ANCHORED' ? 'PENDING' : 'ANCHORED', eventsOfThisDonation: 1, verification: { result, reason, ...extra } });

  it('MATCH → "Coincide" en verde (success)', () => {
    expect(v({ batches: [batch('MATCH')], unanchoredEvents: 0 })).toMatchObject({ variant: 'success', title: 'Coincide' });
  });
  it('MISMATCH → "No coincide" en rojo (rejected), y manda sobre todo lo demás', () => {
    expect(v({ batches: [batch('MATCH'), batch('MISMATCH', 'ROOT_MISMATCH', { affectsThisDonation: true }), batch('INCONCLUSIVE', 'NOT_ANCHORED')], unanchoredEvents: 2 }))
      .toMatchObject({ variant: 'rejected', title: 'No coincide' });
  });
  it('INCONCLUSIVE por otro motivo → "No se pudo comprobar" (info)', () => {
    expect(v({ batches: [batch('INCONCLUSIVE', 'LEGACY_BATCH')], unanchoredEvents: 0 })).toMatchObject({ variant: 'info', title: 'No se pudo comprobar' });
  });
  it('NOT_ANCHORED o unanchoredEvents → "Pendiente de anclaje" en amarillo (ambiguous), nunca rojo', () => {
    expect(v({ batches: [batch('INCONCLUSIVE', 'NOT_ANCHORED')], unanchoredEvents: 0 })).toMatchObject({ variant: 'ambiguous', title: 'Pendiente de anclaje' });
    const partial = v({ batches: [batch('MATCH')], unanchoredEvents: 1 });
    expect(partial).toMatchObject({ variant: 'ambiguous', title: 'Pendiente de anclaje' });
    expect(partial.text).toContain('Lo que ya se ancló coincide');
  });
  it('sin lotes ni eventos → nada que comprobar (info)', () => {
    expect(v({ batches: [], unanchoredEvents: 0 })).toMatchObject({ variant: 'info', title: 'Sin eventos que comprobar' });
  });
});

describe('Código de seguimiento en pantalla (T1-1 a T1-7)', () => {
  const CODE = 'TRK.secreto-completo-8841';
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  });
  afterEach(() => vi.useRealTimers());

  it('T1-1/T1-5: oculto muestra solo los 4 últimos y el código completo no está en el DOM (ni atributos)', () => {
    const { container } = render(<TrackingCodeChip code={CODE} />);
    expect(screen.getByTestId('tracking-code-shown')).toHaveTextContent('···8841');
    expect(container.innerHTML).not.toContain('secreto-completo');
    expect(maskTrackingCode('abc')).toBe('····');
  });

  it('T1-2/T1-4: "Ver código" lo muestra; "Ocultar" lo tapa', () => {
    const { container } = render(<TrackingCodeChip code={CODE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver código' }));
    expect(screen.getByTestId('tracking-code-shown')).toHaveTextContent(CODE);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));
    expect(container.innerHTML).not.toContain('secreto-completo');
  });

  it('T1-4: se vuelve a ocultar a los 30 s y al cambiar de pestaña', () => {
    vi.useFakeTimers();
    const { container } = render(<TrackingCodeChip code={CODE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver código' }));
    act(() => { vi.advanceTimersByTime(REVEAL_MS - 1); });
    expect(container.innerHTML).toContain('secreto-completo');
    act(() => { vi.advanceTimersByTime(1); });
    expect(container.innerHTML).not.toContain('secreto-completo');
    fireEvent.click(screen.getByRole('button', { name: 'Ver código' }));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    expect(container.innerHTML).not.toContain('secreto-completo');
  });

  it('T1-3: "Copiar" copia desde memoria sin revelarlo y lo anuncia', async () => {
    const { container } = render(<TrackingCodeChip code={CODE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await waitFor(() => expect(screen.getByTestId('tracking-code-copied')).toHaveTextContent('Código copiado'));
    expect(writeText).toHaveBeenCalledWith(CODE);
    expect(screen.getByTestId('tracking-code-copied')).toHaveAttribute('aria-live', 'polite');
    expect(container.innerHTML).not.toContain('secreto-completo');
  });

  it('T1-6: aviso junto a los botones', () => {
    render(<TrackingCodeChip code={CODE} />);
    expect(screen.getByText('Este código abre tu seguimiento. No lo compartas en capturas.')).toBeInTheDocument();
  });

  it('en la pantalla: el chip lleva el código escrito, enmascarado; 401 del seguimiento no toca la sesión', async () => {
    open();
    expect(await screen.findByTestId('tracking-code-shown')).toHaveTextContent('···8841');
    expect(document.body.innerHTML).not.toContain('TRK.abcdef8841');
    session.login('jwt');
    const { unmount } = render(<TrackingScreen clients={{ tracking: async () => ({ kind: 'invalid-code' }) }} />);
    const forms = screen.getAllByLabelText('Código de seguimiento');
    fireEvent.change(forms[forms.length - 1], { target: { value: 'malo' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver seguimiento' }).slice(-1)[0]);
    expect(await screen.findByText('El código no es válido o expiró.')).toBeInTheDocument();
    expect(session.getState()).toBe('AUTHENTICATED');
    unmount();
    expect(within(document.body).queryByText('secreto')).toBeNull();
  });
});
