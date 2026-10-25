// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F2 y §4 F-A1.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  WORLD_MODE_STORAGE_KEY,
  calculateNightVal,
  getAutoNight,
  nextWorldMode,
  readSavedWorldMode,
  saveWorldMode,
  worldModeUI,
  type WorldMode,
} from '../src/components/landing/worldMode';

describe('Landing World Mode (D-F2)', () => {
  describe('getAutoNight & calculateNightVal', () => {
    it('sigue la curva del boceto en modo auto', () => {
      // Parada 1 (u = 0): día completo (0)
      expect(getAutoNight(0)).toBe(0);
      expect(calculateNightVal('auto', 0)).toBe(0);

      // Parada 2 (u = 1): tenue noche (0.12)
      expect(getAutoNight(1)).toBeCloseTo(0.12, 3);
      expect(calculateNightVal('auto', 1)).toBeCloseTo(0.12, 3);

      // Parada 3 (u = 2): ocaso avanzado (0.65)
      expect(getAutoNight(2)).toBeCloseTo(0.65, 3);
      expect(calculateNightVal('auto', 2)).toBeCloseTo(0.65, 3);

      // Parada 4 (u = 3): noche completa (1.0)
      expect(getAutoNight(3)).toBe(1.0);
      expect(calculateNightVal('auto', 3)).toBe(1.0);

      // Parada 5 (u = 4): vuelta al día (0.15)
      expect(getAutoNight(4)).toBeCloseTo(0.15, 3);
      expect(calculateNightVal('auto', 4)).toBeCloseTo(0.15, 3);

      // Overview (u = 5): día completo (0)
      expect(getAutoNight(5)).toBe(0);
      expect(calculateNightVal('auto', 5)).toBe(0);
    });

    it('en modo night es siempre 1 independientemente de u', () => {
      expect(calculateNightVal('night', 0)).toBe(1);
      expect(calculateNightVal('night', 3)).toBe(1);
      expect(calculateNightVal('night', 5)).toBe(1);
    });

    it('en modo day es siempre 0 independientemente de u', () => {
      expect(calculateNightVal('day', 0)).toBe(0);
      expect(calculateNightVal('day', 3)).toBe(0);
      expect(calculateNightVal('day', 5)).toBe(0);
    });
  });

  describe('nextWorldMode', () => {
    it('cicla auto -> night -> day -> auto', () => {
      expect(nextWorldMode('auto')).toBe('night');
      expect(nextWorldMode('night')).toBe('day');
      expect(nextWorldMode('day')).toBe('auto');
    });
  });

  describe('worldModeUI', () => {
    it('muestra los textos exactos del boceto (updateThemeUI)', () => {
      // Modos fijos
      expect(worldModeUI('night', 0)).toEqual({
        text: 'Noche',
        icon: 'moon',
        ariaLabel: expect.stringContaining('Noche fija'),
      });
      expect(worldModeUI('day', 1)).toEqual({
        text: 'Día',
        icon: 'sun',
        ariaLabel: expect.stringContaining('Día fijo'),
      });

      // Modo auto
      expect(worldModeUI('auto', 0.1)).toEqual({
        text: 'Auto (Día)',
        icon: 'sun',
        ariaLabel: expect.stringContaining('Auto (Día)'),
      });
      expect(worldModeUI('auto', 0.29)).toEqual({
        text: 'Auto (Día)',
        icon: 'sun',
        ariaLabel: expect.stringContaining('Auto (Día)'),
      });
      expect(worldModeUI('auto', 0.3)).toEqual({
        text: 'Auto (Ocaso)',
        icon: 'sunset',
        ariaLabel: expect.stringContaining('Auto (Ocaso)'),
      });
      expect(worldModeUI('auto', 0.69)).toEqual({
        text: 'Auto (Ocaso)',
        icon: 'sunset',
        ariaLabel: expect.stringContaining('Auto (Ocaso)'),
      });
      expect(worldModeUI('auto', 0.7)).toEqual({
        text: 'Auto (Noche)',
        icon: 'moon',
        ariaLabel: expect.stringContaining('Auto (Noche)'),
      });
      expect(worldModeUI('auto', 1.0)).toEqual({
        text: 'Auto (Noche)',
        icon: 'moon',
        ariaLabel: expect.stringContaining('Auto (Noche)'),
      });
    });
  });

  describe('localStorage persistence', () => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    it('lee y guarda la preferencia en paxfide.world-mode con fallback a auto', () => {
      expect(readSavedWorldMode()).toBe('auto');
      saveWorldMode('night');
      expect(window.localStorage.getItem(WORLD_MODE_STORAGE_KEY)).toBe('night');
      expect(readSavedWorldMode()).toBe('night');
      saveWorldMode('day');
      expect(readSavedWorldMode()).toBe('day');
    });

    it('ignora valores invalidos en localStorage y devuelve auto', () => {
      window.localStorage.setItem(WORLD_MODE_STORAGE_KEY, 'invalid-mode');
      expect(readSavedWorldMode()).toBe('auto');
    });
  });
});
