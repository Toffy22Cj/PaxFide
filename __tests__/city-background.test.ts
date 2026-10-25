// Ref: plan-fase7-pantallas.md A-1 (tests unitarios: hasAnimatedBackground, siembra determinista) y D-P2;
// enmienda R-F2–R-F4 (pausa, reducir movimiento, pestaña oculta).
import { describe, it, expect } from 'vitest';
import { hasAnimatedBackground } from '../src/lib/routing/backgroundRoutes';
import { CITY_SEED, clampDpr, createCityScene, isFree, ringPoint, riverY, stepCityScene, vehiclePos } from '../src/components/background/cityScene';
import { CITY_DAY, CITY_NIGHT, cityPalette } from '../src/components/background/cityPalette';
import { CITY_PAUSE_KEY, loopMode, readPaused, writePaused } from '../src/components/background/animationPreference';
import type { PreferenceStorage } from '../src/lib/theme/theme';

describe('hasAnimatedBackground (D-P2, D-F5, D-F17)', () => {
  it('rutas del donante y de acceso sobre el mundo', () => {
    for (const p of ['/', '/home', '/campaigns', '/c/ABC123', '/tracking', '/account/donations', '/login', '/register', '/invitaciones', '/terminos', '/privacidad', '/terminos-organizacion']) {
      expect(hasAnimatedBackground(p), p).toBe(true);
    }
  });
  it('negativas: parte administrativa, activos y rutas no coincidentes', () => {
    for (const p of ['/panel', '/panel/campaigns', '/panel/assets', '/assets/x', '/c/', '/c/a/b', '/campaigns/x', '/tracking/x', '/homes']) {
      expect(hasAnimatedBackground(p), p).toBe(false);
    }
  });
});

describe('cityScene (lógica pura)', () => {
  it('la siembra produce siempre la misma escena', () => {
    const a = createCityScene(), b = createCityScene();
    expect(JSON.stringify({ ...a, next: null })).toBe(JSON.stringify({ ...b, next: null }));
    expect(a.tufts.length).toBe(340);
    expect(a.wildTrees.length).toBeGreaterThan(30);
    expect(a.flowers.length).toBeGreaterThan(50);
  });
  it('otra semilla, otra escena', () => {
    expect(JSON.stringify(createCityScene(CITY_SEED + 1).tufts)).not.toBe(JSON.stringify(createCityScene().tufts));
  });
  it('nada se siembra en el río, las calles ni fuera del valle', () => {
    const sc = createCityScene();
    for (const w of sc.wildTrees) expect(isFree(w.x, w.y, 0.45)).toBe(true);
    expect(isFree(0, riverY(0))).toBe(false);
    expect(isFree(0, -3)).toBe(false); // calle
    expect(isFree(20, 0)).toBe(false);
  });
  it('los vehículos avanzan por su ruta y las nubes vuelven a entrar (determinista)', () => {
    const a = createCityScene(), b = createCityScene();
    const before = vehiclePos(a.vehicles[0]);
    for (let i = 0; i < 600; i++) { stepCityScene(a, 0.05); stepCityScene(b, 0.05); }
    const after = vehiclePos(a.vehicles[0]);
    expect(after).not.toEqual(before);
    expect(a.clouds).toEqual(b.clouds);
    for (const c of a.clouds) expect(c.x).toBeLessThanOrEqual(22);
  });
  it('los peatones caminan por el perímetro de la plaza', () => {
    for (const u of [0, 0.1, 0.37, 0.5, 0.99, -0.2]) {
      const [x, y] = ringPoint(u);
      expect(Math.max(Math.abs(x), Math.abs(y))).toBeCloseTo(2.65, 6);
    }
  });
  it('densidad de píxeles como mucho 1,5 (D-P3)', () => {
    expect(clampDpr(3)).toBe(1.5); expect(clampDpr(2)).toBe(1.5); expect(clampDpr(1)).toBe(1); expect(clampDpr(undefined)).toBe(1);
  });
});

describe('cityPalette (D-P1, D-P4)', () => {
  it('día por debajo de 0,5 y noche por encima', () => {
    expect(cityPalette(0)).toBe(CITY_DAY); expect(cityPalette(0.4)).toBe(CITY_DAY); expect(cityPalette(1)).toBe(CITY_NIGHT);
  });
  it('las dos paletas tienen las mismas claves (versión oscura propia, R-F6)', () => {
    expect(Object.keys(CITY_NIGHT).sort()).toEqual(Object.keys(CITY_DAY).sort());
    expect(CITY_NIGHT.grass).not.toBe(CITY_DAY.grass);
  });
});

describe('pausa y bucle (R-F2–R-F4)', () => {
  const mem = (): PreferenceStorage & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
  };
  const throwing: PreferenceStorage = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };

  it('la pausa se recuerda y sobrevive a un almacenamiento que lanza', () => {
    const s = mem();
    expect(readPaused(() => s)).toBe(false);
    expect(writePaused(() => s, true)).toEqual({ ok: true });
    expect(s.data[CITY_PAUSE_KEY]).toBe('1');
    expect(readPaused(() => s)).toBe(true);
    writePaused(() => s, false);
    expect(CITY_PAUSE_KEY in s.data).toBe(false);
    expect(readPaused(() => throwing)).toBe(false);
    expect(writePaused(() => throwing, true)).toEqual({ ok: false, error: 'StorageWriteFailed' });
    expect(writePaused(() => { throw new Error('x'); }, true)).toEqual({ ok: false, error: 'StorageUnavailable' });
  });

  it('loopMode: pestaña oculta → off; pausa o reducir movimiento → un fotograma; si no, animación', () => {
    expect(loopMode({ paused: false, reducedMotion: false, hidden: false })).toBe('animate');
    expect(loopMode({ paused: true, reducedMotion: false, hidden: false })).toBe('still');
    expect(loopMode({ paused: false, reducedMotion: true, hidden: false })).toBe('still');
    expect(loopMode({ paused: false, reducedMotion: false, hidden: true })).toBe('off');
    expect(loopMode({ paused: true, reducedMotion: true, hidden: true })).toBe('off');
  });
});
