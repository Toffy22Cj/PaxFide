// Ref: plan-fase7-pantallas.md A-2 (WorldScene con las mismas reglas R-F que la ciudad), D-P1–D-P4; A-1 (pausa).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VIEW_COUNT, cameraFor, clampDpr, cloudAt, createWorldScene, rectFade, road, stopProgress, viewForScroll, STOPS,
  WORLD_LABELS, autoNight, scrollProgress, stopCardOpacity,
} from '../src/components/landing/worldScene';
import { WORLD_DAY, WORLD_NIGHT, worldPalette } from '../src/components/landing/worldPalette';
import {
  WORLD_MODE_KEY, nextWorldMode, parseWorldMode, readWorldMode, surfaceTheme, worldModeLook, worldNight, writeWorldMode,
} from '../src/components/landing/worldMode';
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

// ---------------------------------------------------------------------------------------------------------------
// F-A1 (plan-fase7-fidelidad.md D-F2 y D-F4): día y noche, desvanecido de tarjetas y etiquetas del mapa
// ---------------------------------------------------------------------------------------------------------------

describe('autoNight (prototipo getAutoNight)', () => {
  it('día en la parada 1, ocaso, noche en la 4 y vuelta al día en la 5', () => {
    expect(autoNight(0)).toBe(0);
    expect(autoNight(1)).toBeCloseTo(0.12, 6);
    expect(autoNight(2)).toBeCloseTo(0.65, 6);
    expect(autoNight(3)).toBeCloseTo(1, 6);
    expect(autoNight(4)).toBeCloseTo(0.15, 6);
    expect(autoNight(5)).toBe(0);
    expect(autoNight(9)).toBe(0);
  });
});

describe('scrollProgress y stopCardOpacity (prototipo readScroll)', () => {
  const centers = [100, 300, 500];
  it('el avance es lineal entre centros y se queda en los extremos', () => {
    expect(scrollProgress(centers, 0)).toBe(0);
    expect(scrollProgress(centers, 200)).toBeCloseTo(0.5, 6);
    expect(scrollProgress(centers, 400)).toBeCloseTo(1.5, 6);
    expect(scrollProgress(centers, 9000)).toBe(2);
    expect(scrollProgress([], 10)).toBe(0);
  });
  it('la tarjeta de la parada en curso se ve entera; a media parada de distancia, ya no', () => {
    expect(stopCardOpacity(2, 2)).toBe(1);
    expect(stopCardOpacity(2.2, 2)).toBe(1);
    expect(stopCardOpacity(2.5, 2)).toBe(0);
    expect(stopCardOpacity(2.33, 2)).toBeGreaterThan(0);
    expect(stopCardOpacity(2.33, 2)).toBeLessThan(1);
  });
});

describe('modo Día / Noche (D-F2)', () => {
  const mem = (init: Record<string, string> = {}) => {
    const data = { ...init };
    return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; }, removeItem: (k: string) => { delete data[k]; } };
  };
  it('ciclo Auto → Noche → Día → Auto', () => {
    expect(nextWorldMode('auto')).toBe('night');
    expect(nextWorldMode('night')).toBe('day');
    expect(nextWorldMode('day')).toBe('auto');
  });
  it('se guarda con su clave; Auto borra la clave; un almacenamiento que falla no lanza', () => {
    const st = mem();
    expect(writeWorldMode(() => st, 'night')).toEqual({ ok: true });
    expect(st.data[WORLD_MODE_KEY]).toBe('night');
    expect(readWorldMode(() => st)).toBe('night');
    writeWorldMode(() => st, 'auto');
    expect(st.data[WORLD_MODE_KEY]).toBeUndefined();
    expect(readWorldMode(() => { throw new Error('bloqueado'); })).toBe('auto');
    expect(writeWorldMode(() => { throw new Error('bloqueado'); }, 'day')).toEqual({ ok: false, error: 'StorageUnavailable' });
    expect(parseWorldMode('sepia')).toBe('auto');
  });
  it('la mezcla: fija en Noche y Día; en Auto sigue el recorrido; con "reducir movimiento" salta de parada en parada', () => {
    expect(worldNight('night', 0, false)).toBe(1);
    expect(worldNight('day', 3, false)).toBe(0);
    expect(worldNight('auto', 2.5, false)).toBeCloseTo(autoNight(2.5), 6);
    expect(worldNight('auto', 2.4, true)).toBeCloseTo(autoNight(2), 6);
    expect(worldNight('auto', 2.6, true)).toBeCloseTo(autoNight(3), 6);
  });
  it('textos e iconos del prototipo (updateThemeUI)', () => {
    expect(worldModeLook('auto', 0.29)).toEqual({ text: 'Auto (Día)', icon: 'sun' });
    expect(worldModeLook('auto', 0.3)).toEqual({ text: 'Auto (Ocaso)', icon: 'dusk' });
    expect(worldModeLook('auto', 0.69)).toEqual({ text: 'Auto (Ocaso)', icon: 'dusk' });
    expect(worldModeLook('auto', 0.7)).toEqual({ text: 'Auto (Noche)', icon: 'moon' });
    expect(worldModeLook('night', 0)).toEqual({ text: 'Noche', icon: 'moon' });
    expect(worldModeLook('day', 1)).toEqual({ text: 'Día', icon: 'sun' });
  });
  it('las superficies pasan a oscuro cuando la noche pasa de 0,5 (negativa en 0,5)', () => {
    expect(surfaceTheme(0.5)).toBe('light');
    expect(surfaceTheme(0.51)).toBe('dark');
  });
});

describe('etiquetas del mapa (D-F4, §2.1)', () => {
  const texts = Object.values(WORLD_LABELS);
  it('son las de §2.1, en el orden del recorrido', () => {
    expect(texts).toEqual(['Pasarela de pago', 'Donar', 'Fondo de la convocatoria', 'Lote · QR', 'Bodega', 'Lote dividido',
      'Sublote', 'Ruta de entrega', 'Raíz anclada', 'Anclaje en blockchain', 'Entrega confirmada', 'Centro comunitario']);
  });
  it('ninguna cifra ni ningún lugar real (negativas)', () => {
    for (const t of texts) {
      expect(t, t).not.toMatch(/\d/);
      for (const place of ['Lorica', 'Montería', 'Cereté', 'Córdoba', 'Bolívar', 'kits']) expect(t, t).not.toContain(place);
    }
  });
  const L = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
  for (const [name, pal] of [['día', WORLD_DAY], ['noche', WORLD_NIGHT]] as const) {
    it(`en ${name}, cada píldora es opaca y su texto cumple 4,5 (R-F1)`, () => {
      for (const look of [pal.label, pal.labelCompleted, pal.labelBadge]) {
        expect(look.bg).toMatch(/^#[0-9A-F]{6}$/i);
        expect(ratio(look.text, look.bg)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
