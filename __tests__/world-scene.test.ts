// Ref: plan-fase7-pantallas.md A-2 (WorldScene con las mismas reglas R-F que la ciudad), D-P1–D-P4; A-1 (pausa).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VIEW_COUNT, cameraFor, clampDpr, cloudAt, createWorldScene, rectFade, road, stopProgress, viewForScroll, STOPS,
} from '../src/components/landing/worldScene';
import { WORLD_DAY, WORLD_NIGHT, worldPalette } from '../src/components/landing/worldPalette';
import { backgroundFor, hasAppChrome } from '../src/lib/routing/backgroundRoutes';
import {
  getPausedSnapshot, resetPausedSnapshot, setPausedPreference, subscribePaused, CITY_PAUSE_KEY,
} from '../src/components/background/animationPreference';

describe('Mundo de la landing — escena pura (A-2)', () => {
  it('la siembra es determinista: la misma semilla da la misma escena; otra semilla, otra', () => {
    const a = createWorldScene(), b = createWorldScene();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.trees.length).toBeGreaterThan(100);
    expect(a.clouds).toHaveLength(44);
    expect(JSON.stringify(createWorldScene(99).trees)).not.toBe(JSON.stringify(a.trees));
  });

  it('la carretera pasa por las cinco paradas', () => {
    STOPS.forEach(([x, y], i) => {
      const [rx, ry] = road(i);
      expect(rx).toBeCloseTo(x, 6);
      expect(ry).toBeCloseTo(y, 6);
    });
  });

  it('ningún árbol sobre la carretera', () => {
    const s = createWorldScene();
    for (const t of s.trees) {
      expect(s.roadPts.some(([x, y]) => Math.hypot(x - t.x, y - t.y) < 1.7)).toBe(false);
    }
  });

  it('scroll → vista: 0 arriba, 5 al final, quieta en el centro de cada parada y solo se mueve en el tramo central', () => {
    const centers = [100, 300, 500, 700, 900, 1100];
    expect(viewForScroll(centers, 0)).toBe(0);
    expect(viewForScroll(centers, 5000)).toBe(VIEW_COUNT - 1);
    expect(viewForScroll(centers, 300)).toBe(1);
    expect(viewForScroll(centers, 340)).toBe(1); // 20 % del tramo: todavía en la parada
    expect(viewForScroll(centers, 400)).toBeCloseTo(1.5, 6);
    expect(viewForScroll(centers, 460)).toBe(2);
    expect(viewForScroll([], 10)).toBe(0);
  });

  it('cámara: la guía la vista; el vaivén del panorama solo con drift (pausa y "reducir movimiento" lo apagan)', () => {
    const still1 = cameraFor(5, 1280, 900, 3, false), still2 = cameraFor(5, 1280, 900, 9, false);
    expect(still1).toEqual(still2);
    expect(cameraFor(5, 1280, 900, 3, true)).not.toEqual(still1);
    expect(cameraFor(2, 1280, 900, 3, true)).toEqual(cameraFor(2, 1280, 900, 9, true));
    const narrow = cameraFor(0, 390, 844, 0, false), wide = cameraFor(0, 1280, 900, 0, false);
    expect(narrow.ox).toBe(195);
    expect(wide.ox).toBeCloseTo(1280 * 0.64, 6);
  });

  it('avance de cada parada: 0 lejos, 1 al llegar', () => {
    expect(stopProgress(3, 1)).toBe(0);
    expect(stopProgress(3, 3)).toBe(1);
    expect(stopProgress(3, 4)).toBe(1);
    expect(stopProgress(3, 2.5)).toBeGreaterThan(0);
  });

  it('las nubes vuelven a entrar por el otro lado (dentro del valle)', () => {
    const [c] = createWorldScene().clouds;
    for (const t of [0, 100, 1e4]) {
      const [x] = cloudAt(c, t);
      expect(x).toBeGreaterThanOrEqual(-45);
      expect(x).toBeLessThan(80);
    }
  });

  it('densidad de píxeles como mucho 1,5 (D-P3)', () => {
    expect(clampDpr(3)).toBe(1.5);
    expect(clampDpr(undefined)).toBe(1);
  });

  it('D-P1/D-P4: paleta de día y de noche con las mismas claves; la de noche solo con night > 0,5', () => {
    expect(Object.keys(WORLD_NIGHT).sort()).toEqual(Object.keys(WORLD_DAY).sort());
    expect(worldPalette(0)).toBe(WORLD_DAY);
    expect(worldPalette(1)).toBe(WORLD_NIGHT);
  });
});

describe('R-F1: las nubes se apartan del contenido', () => {
  const card = { left: 100, top: 100, right: 400, bottom: 300 };
  it('encima de un bloque, 0; lejos, 1; cerca, entre los dos', () => {
    expect(rectFade(250, 200, 40, [card])).toBe(0);
    expect(rectFade(410, 200, 40, [card])).toBe(0); // el borde de la nube toca el bloque
    expect(rectFade(1000, 1000, 40, [card])).toBe(1);
    const near = rectFade(400 + 40 + 24 + 20, 200, 40, [card]);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(1);
    expect(rectFade(250, 200, 40, [])).toBe(1);
  });
});

describe('D-P13: estructura de la app', () => {
  it('en / no hay cabecera ni barra de la app; en el resto, sí', () => {
    expect(hasAppChrome('/')).toBe(false);
    for (const r of ['/home', '/campaigns', '/c/x', '/tracking', '/login', '/panel', '/assets/a']) expect(hasAppChrome(r)).toBe(true);
  });
});

describe('Rutas con ilustración (D-P2, A-2)', () => {
  it('en / el mundo; en las demás rutas del donante, la ciudad; fuera, nada', () => {
    expect(backgroundFor('/')).toBe('world');
    for (const r of ['/home', '/campaigns', '/c/ABC', '/tracking', '/account/donations']) expect(backgroundFor(r)).toBe('city');
    for (const r of ['/login', '/register', '/invitaciones', '/panel', '/assets/x', '/c/x/y']) expect(backgroundFor(r)).toBeNull();
  });
});

describe('Pausa compartida (R-F2): el botón de la cabecera y cada ilustración leen el mismo valor', () => {
  beforeEach(() => resetPausedSnapshot());

  it('cambiarla avisa a quien escucha y se guarda', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
    const listener = vi.fn();
    const off = subscribePaused(listener);
    expect(getPausedSnapshot(() => storage)).toBe(false);
    expect(setPausedPreference(() => storage, true)).toEqual({ ok: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getPausedSnapshot(() => storage)).toBe(true);
    expect(store.get(CITY_PAUSE_KEY)).toBe('1');
    off();
    setPausedPreference(() => storage, false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.has(CITY_PAUSE_KEY)).toBe(false);
  });

  it('sin almacenamiento, la pausa funciona igual en la página (solo no se recuerda)', () => {
    const broken = () => { throw new Error('bloqueado'); };
    expect(setPausedPreference(broken, true)).toEqual({ ok: false, error: 'StorageUnavailable' });
    expect(getPausedSnapshot(broken)).toBe(true);
  });
});

describe('Ruta / (A-2)', () => {
  it('pública solo si está habilitada; en el build por defecto, 404', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/']));
    const on = await import('../src/lib/routing/classifier');
    expect(on.classifyRoute('/')).toBe('PUBLIC');
    expect(on.classifyRoute('//')).toBe('NOT_APPROVED');
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', '[]');
    const off = await import('../src/lib/routing/classifier');
    expect(off.classifyRoute('/')).toBe('NOT_APPROVED');
    vi.unstubAllEnvs();
  });
});
