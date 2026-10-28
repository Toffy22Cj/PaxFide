// Ref: plan-fase7-fidelidad.md D-F7 (portal del panel: una capa encima que termina sola) y plan-fase7-puesta-al-dia.md
// P-0 (encontrado al capturar: el portal se quedaba tapando /panel/organization).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { PanelPortal } from '../src/components/shell/PanelPortal';

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as any;
});
afterEach(() => vi.useRealTimers());

describe('PanelPortal (D-F7)', () => {
  it('termina a su hora aunque el padre lo vuelva a pintar con otro onComplete (antes se reiniciaba y no acababa)', () => {
    const first = vi.fn();
    const { rerender } = render(<PanelPortal mode="enter" onComplete={first} />);
    expect(screen.getByTestId('panel-portal')).toBeInTheDocument();
    const second = vi.fn();
    for (let t = 0; t < 10; t++) {
      act(() => { vi.advanceTimersByTime(100); });
      rerender(<PanelPortal mode="enter" onComplete={t % 2 ? first : second} />);
    }
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByTestId('panel-portal')).toBeNull();
    expect(first.mock.calls.length + second.mock.calls.length).toBe(1);
  });

  it('con "reducir movimiento" no se monta y avisa enseguida', () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => {}, removeEventListener: () => {} })) as any;
    const done = vi.fn();
    render(<PanelPortal mode="enter" onComplete={done} />);
    expect(screen.queryByTestId('panel-portal')).toBeNull();
    expect(done).toHaveBeenCalledTimes(1);
  });
});
