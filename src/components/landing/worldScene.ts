// Ref: plan-fase7-pantallas.md A-2 (WorldScene: el mundo del recorrido por scroll, mismas reglas R-F que la ciudad)
// y D-P1–D-P5; prototipo paxfide-landing.html (solo forma). Lógica pura: sin DOM y sin colores (los colores viven en
// worldPalette.ts y aquí solo se nombran por índice).

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const ease = {
  out: (x: number) => 1 - Math.pow(1 - x, 3),
  inOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x: number) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
};

/** Generador determinista (Park–Miller, como el prototipo): la misma semilla siembra siempre el mismo valle. */
export function parkMiller(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
export const WORLD_SEED = 17;

type Pt = readonly [number, number];

/** Las cinco paradas del recorrido (donas, bodega, ruta, sello, entrega) sobre la carretera. */
export const STOPS: readonly Pt[] = [[0, 0], [9, -3], [18, 1], [27, -3], [36, 1]];
const CTRL: readonly Pt[] = [[-12, 4], [-6, 2], ...STOPS, [42, -1], [48, -2]];
/** Número de vistas del recorrido: las cinco paradas y el panorama final. */
export const VIEW_COUNT = 6;

function catmull(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): [number, number] {
  const t2 = t * t, t3 = t2 * t;
  const k = (i: 0 | 1) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2
    + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
  return [k(0), k(1)];
}

/** Punto de la carretera para el avance `u` (0 = primera parada, 4 = última). */
export function road(u: number): [number, number] {
  const v = u + 2;
  let j = Math.floor(v);
  if (j < 1) j = 1;
  if (j > 6) j = 6;
  return catmull(CTRL[j - 1], CTRL[j], CTRL[j + 1], CTRL[j + 2], v - j);
}

export interface WorldMeadow { x: number; y: number; w: number; h: number; rot: number; day: number; night: number }
export interface WorldCrop { x: number; y: number; w: number; d: number }
export interface WorldTree { x: number; y: number; r: number; type: number }
export interface WorldBush { x: number; y: number; r: number; tone: number }
export interface WorldTuft { x: number; y: number; s: number; type: number; tone: number }
export interface WorldPuff { dx: number; dy: number; r: number }
export interface WorldCloud { bx: number; by: number; z: number; s: number; spd: number; phase: number; puffs: readonly WorldPuff[] }
export interface WorldStar { x: number; y: number; r: number; phase: number; gold: boolean }
export interface WorldFirefly { x: number; y: number; p: number }

export interface WorldScene {
  roadPts: [number, number][];
  sidePts: [number, number][];
  riverPts: [number, number][];
  meadows: WorldMeadow[];
  crops: readonly WorldCrop[];
  fincas: readonly { x: number; y: number }[];
  trees: WorldTree[];
  bushes: WorldBush[];
  tufts: WorldTuft[];
  clouds: WorldCloud[];
  stars: WorldStar[];
  fireflies: WorldFirefly[];
}

const CROPS: readonly WorldCrop[] = [
  { x: -16, y: 7, w: 4.8, d: 3.2 }, { x: 6, y: 13, w: 5.2, d: 3.5 }, { x: 34, y: -19, w: 6.0, d: 3.8 }, { x: -24, y: -14, w: 5.5, d: 3.4 },
];
const FINCAS = [{ x: -18, y: 5.5 }, { x: 12, y: 15 }, { x: 38, y: -8 }, { x: -8, y: -15.5 }] as const;

const PUFFS: readonly (readonly WorldPuff[])[] = [
  [{ dx: 0, dy: 0, r: 1.15 }, { dx: -0.95, dy: 0.12, r: 0.9 }, { dx: 0.95, dy: 0.1, r: 0.92 }, { dx: 1.75, dy: 0.22, r: 0.72 },
    { dx: -1.7, dy: 0.2, r: 0.7 }, { dx: -0.45, dy: -0.45, r: 0.85 }, { dx: 0.5, dy: -0.42, r: 0.82 }, { dx: 0, dy: -0.65, r: 0.72 }],
  [{ dx: 0, dy: 0, r: 1.05 }, { dx: -0.82, dy: 0.14, r: 0.8 }, { dx: 0.82, dy: 0.12, r: 0.82 }, { dx: 1.45, dy: 0.2, r: 0.65 },
    { dx: -1.4, dy: 0.18, r: 0.62 }, { dx: -0.22, dy: -0.42, r: 0.75 }, { dx: 0.42, dy: -0.38, r: 0.7 }],
  [{ dx: 0, dy: 0, r: 0.95 }, { dx: -0.7, dy: 0.1, r: 0.75 }, { dx: 0.7, dy: 0.08, r: 0.78 }, { dx: 1.3, dy: 0.15, r: 0.6 },
    { dx: -0.3, dy: -0.3, r: 0.68 }],
];

/** Siembra el valle del recorrido. Determinista: la misma semilla da siempre la misma escena. */
export function createWorldScene(seed = WORLD_SEED): WorldScene {
  const rnd = parkMiller(seed);
  const roadPts: [number, number][] = [];
  for (let u = -1.8; u <= 5.8; u += 0.04) roadPts.push(road(u));
  const side: readonly Pt[] = [[17, -1], STOPS[2], [19.2, 3.4], [20.6, 6.6], [21.6, 9.6], [22.4, 12]];
  const sidePts: [number, number][] = [];
  for (let j = 1; j < side.length - 2; j++) for (let t = 0; t < 1; t += 0.05) sidePts.push(catmull(side[j - 1], side[j], side[j + 1], side[j + 2], t));
  const riverPts: [number, number][] = [];
  for (let t = -3.2; t <= 6.8; t += 0.06) riverPts.push([-32 + t * 14.5, -22 + Math.sin(t * 1.35) * 4.6 + Math.cos(t * 0.8) * 3.0]);

  const zones = STOPS.map(([x, y]) => [x - 0.6, y - 2.6, 3.4] as const);
  const close = (pts: readonly Pt[], x: number, y: number, rad: number) => pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < rad);
  const nearRiver = (x: number, y: number, rad: number) => close(riverPts, x, y, rad);
  const near = (x: number, y: number, rad: number) => close(roadPts, x, y, rad) || close(sidePts, x, y, rad * 0.85)
    || zones.some((z) => Math.hypot(z[0] - x, z[1] - y) < z[2]);
  const nearRoad = (x: number, y: number, rad: number) => close(roadPts, x, y, rad) || close(sidePts, x, y, rad);
  const nearFinca = (x: number, y: number, rad: number) => FINCAS.some((f) => Math.hypot(f.x - x, f.y - y) < rad);

  const meadows: WorldMeadow[] = [];
  for (let i = 0; i < 54; i++) {
    meadows.push({
      x: -38 + rnd() * 110, y: -28 + rnd() * 66, w: 2.6 + rnd() * 4.8, h: 1.6 + rnd() * 3.2, rot: rnd() * 3.14,
      day: Math.floor(rnd() * 4), night: Math.floor(rnd() * 3),
    });
  }
  const trees: WorldTree[] = [];
  for (let i = 0; i < 680 && trees.length < 230; i++) {
    const x = -38 + rnd() * 110, y = -28 + rnd() * 66;
    if (!near(x, y, 1.8) && !nearRiver(x, y, 2.4) && !nearFinca(x, y, 2.0)) {
      const type = Math.floor(rnd() * 6); // 0..3 frondosos, 4 guayacán, 5 palma
      trees.push({ x, y, r: 0.36 + rnd() * 0.42, type });
    }
  }
  const bushes: WorldBush[] = [];
  for (let i = 0; i < 480 && bushes.length < 150; i++) {
    const x = -38 + rnd() * 110, y = -28 + rnd() * 66;
    if (!near(x, y, 1.3) && !nearRiver(x, y, 1.8) && !nearFinca(x, y, 1.5)) bushes.push({ x, y, r: 0.28 + rnd() * 0.3, tone: Math.floor(rnd() * 4) });
  }
  const tufts: WorldTuft[] = [];
  for (let i = 0; i < 1600 && tufts.length < 720; i++) {
    const x = -38 + rnd() * 110, y = -28 + rnd() * 66;
    if (!nearRoad(x, y, 0.85) && !nearRiver(x, y, 1.6)) {
      tufts.push({ x, y, s: 0.65 + rnd() * 0.65, type: Math.floor(rnd() * 3), tone: Math.floor(rnd() * 5) });
    }
  }
  const clouds: WorldCloud[] = [];
  for (let i = 0; i < 44; i++) {
    const type = i % 3;
    const [z, s, spd] = type === 0 ? [5.4 + rnd() * 2.6, 1.7 + rnd() * 0.75, 0.22 + rnd() * 0.18]
      : type === 1 ? [4.6 + rnd() * 2.4, 1.25 + rnd() * 0.45, 0.28 + rnd() * 0.24]
        : [7.5 + rnd() * 3.8, 0.85 + rnd() * 0.35, 0.16 + rnd() * 0.16];
    clouds.push({ bx: -45 + rnd() * 125, by: -28 + rnd() * 62, z, s, spd, phase: rnd() * 6.28, puffs: PUFFS[type] });
  }
  const stars: WorldStar[] = [];
  for (let i = 0; i < 75; i++) stars.push({ x: rnd(), y: rnd(), r: 0.7 + rnd() * 1.5, phase: rnd() * 6.28, gold: rnd() <= 0.2 });
  const fireflies: WorldFirefly[] = [];
  for (let i = 0; i < 26; i++) fireflies.push({ x: 23 + rnd() * 10, y: -4 + rnd() * 7, p: rnd() * 6.28 });

  return { roadPts, sidePts, riverPts, meadows, crops: CROPS, fincas: FINCAS, trees, bushes, tufts, clouds, stars, fireflies };
}

/** Posición de una nube en el tiempo `t`: la brisa la lleva de oeste a este y vuelve a entrar por el otro lado. */
export function cloudAt(c: WorldCloud, t: number): [number, number] {
  const span = 125;
  const raw = c.bx + t * c.spd;
  return [((raw % span) + span) % span - 45, c.by + Math.sin(t * 0.12 + c.phase) * 0.5];
}

/**
 * Del avance del scroll a la vista objetivo (prototipo `readScroll`): `centers` son los centros verticales de las
 * secciones del recorrido y `y` el centro de la ventana. Entre dos paradas la vista solo se mueve en el tramo
 * central (de 0,28 a 0,72), para que cada tarjeta se lea con su escena quieta.
 */
export function viewForScroll(centers: readonly number[], y: number): number {
  if (centers.length === 0) return 0;
  let raw = 0;
  if (y <= centers[0]) raw = 0;
  else if (y >= centers[centers.length - 1]) raw = centers.length - 1;
  else for (let i = 0; i < centers.length - 1; i++) if (y < centers[i + 1]) { raw = i + (y - centers[i]) / (centers[i + 1] - centers[i]); break; }
  const i = Math.floor(raw);
  return Math.min(VIEW_COUNT - 1, i + smooth(0.28, 0.72, raw - i));
}

export const TW = 34, TH = 17, HZ = 36;

/** Encuadre del panorama final: toda la carretera del recorrido cabe en pantalla. */
export function overview(W: number, H: number): { k: number; x: number; y: number } {
  let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
  for (let u = -0.4; u <= 4.4; u += 0.1) {
    const [x, y] = road(u);
    const a = (x - y) * TW, b = (x + y) * TH;
    a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b - 110); b1 = Math.max(b1, b + 30);
  }
  const A = (a0 + a1) / 2 / TW, B = (b0 + b1) / 2 / TH;
  return { k: Math.min((0.88 * W) / (a1 - a0), (0.62 * H) / (b1 - b0)), x: (A + B) / 2, y: (B - A) / 2 };
}

export interface WorldCamera { x: number; y: number; k: number; ox: number; oy: number }

/**
 * Cámara para la vista `v` (0–5) y el tiempo `t` (prototipo `camera`). La cámara la guía el scroll, nunca el
 * usuario (D-P3); `drift` añade el leve vaivén del panorama y se apaga con la pausa y con "reducir movimiento".
 */
export function cameraFor(v: number, W: number, H: number, t: number, drift: boolean): WorldCamera {
  const narrow = W <= 900;
  const k0 = narrow ? Math.max(0.5, Math.min(0.72, W / 540)) : Math.max(0.78, Math.min(1.25, W / 1350));
  const fx = narrow ? W * 0.5 : W * 0.64, fy = narrow ? H * 0.36 : H * 0.56;
  if (v <= 4) {
    const [rx, ry] = road(v);
    const rest = 1 - Math.min(1, Math.abs(v - Math.round(v)) * 2);
    return { x: rx, y: ry - 1.1, k: k0 * lerp(1.1, 1.5, ease.inOut(rest)), ox: fx, oy: fy };
  }
  const p = ease.inOut(clamp01(v - 4));
  const [rx, ry] = road(4);
  const ov = overview(W, H);
  const cam = { x: lerp(rx, ov.x, p), y: lerp(ry - 1.1, ov.y, p), k: lerp(k0 * 1.5, ov.k, p), ox: lerp(fx, W * 0.5, p), oy: lerp(fy, H * 0.52, p) };
  if (v >= 4.4 && drift) { cam.x += Math.sin(t * 0.22) * 1.5; cam.y += Math.cos(t * 0.18) * 0.9; }
  return cam;
}

/** Avance de la escena de la parada `i` cuando la vista va por `v` (0 antes de acercarse, 1 al llegar). */
export const stopProgress = (i: number, v: number) => (v >= i ? 1 : ease.out(clamp01(1 - (i - v) / 0.9)));

export const MAX_DPR = 1.5;
export const clampDpr = (dpr: number | undefined) => Math.min(MAX_DPR, Math.max(1, dpr || 1));

/** Rectángulo de contenido en px CSS de la ventana (el canvas usa las mismas coordenadas). */
export interface ScreenRect { left: number; top: number; right: number; bottom: number }

/**
 * R-F1: nada se dibuja encima del contenido, ni siquiera se trasluce por su superficie. Una nube centrada en (x, y)
 * con radio `r` se desvanece al acercarse a un bloque de contenido y desaparece al tocarlo (como el prototipo hacía
 * con su tarjeta de acceso). 1 = lejos de todo, 0 = encima de algún bloque.
 */
export function rectFade(x: number, y: number, r: number, rects: readonly ScreenRect[], pad = 24): number {
  let f = 1;
  for (const b of rects) {
    const dx = Math.max(0, b.left - x, x - b.right);
    const dy = Math.max(0, b.top - y, y - b.bottom);
    f = Math.min(f, clamp01((Math.hypot(dx, dy) - r - pad) / Math.max(1, r)));
  }
  return f;
}
