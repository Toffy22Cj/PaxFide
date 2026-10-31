// Ref: plan-fase7-pantallas.md A-1 (cityScene.ts: lógica pura, siembra determinista, geografía, vegetación,
// vehículos) y D-P3; prototipo paxfide-home.html (solo forma). Sin DOM y sin colores: los colores viven en
// cityPalette.ts (D-P1) y aquí solo se nombran por clave.

/** Generador determinista (mulberry32): la misma semilla siembra siempre el mismo valle. */
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mod = (a: number, n: number) => ((a % n) + n) % n;

export const CITY_SEED = 20261018;

/** Curva del río: su centro (y) para cada x del valle. */
export const riverY = (u: number) => 5.6 + Math.sin(u * 0.25) * 1.1;

export type Segment = readonly [number, number, number, number];
export const ROADS: readonly Segment[] = [
  [-3, -3, 3, -3], [3, -3, 3, 3], [-3, 3, 3, 3], [-3, -3, -3, 3], [3, -2, 8, -2], [8, -6, 8, -2],
  [-2, 3, -2, 8], [-8, 8, -2, 8], [-6, -3, -3, -3], [-6, -6, -6, -3], [3, 2, 6, 2],
];
/** [x, y, w, d] de cada barrio: ahí no se siembra nada al azar. */
export const ZONES: readonly (readonly [number, number, number, number])[] = [
  [-8.8, -8.5, 4.6, 4.4], [5.2, -8.2, 5.2, 5.2], [-2.4, -2.4, 4.8, 4.8], [4.5, -0.2, 3.6, 3.6],
  [-10.2, 5.8, 6.0, 4.8], [0.8, 6.5, 4.8, 3.6],
];
export const PATHS: readonly (readonly (readonly [number, number])[])[] = [
  [[-1.5, 2.5], [-1.5, 4.5], [1.5, 5.0]], [[3.5, -1.0], [5.0, 0.0], [5.2, 1.2]], [[-3.0, -2.5], [-4.5, -4.0], [-5.5, -4.5]],
  [[-3.0, 7.5], [-5.0, 7.5], [-6.5, 7.0]], [[9, -2], [10.5, 0.5], [11.5, 3]],
];

export function distSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** ¿Se puede sembrar en (x, y)? Fuera del valle, del río, de los barrios y de las calles, no. */
export function isFree(x: number, y: number, m = 0.4): boolean {
  if (x < -12.8 || x > 12.8 || y < -11.8 || y > 11.8) return false;
  if (Math.abs(y - riverY(x)) < 1.7 + m) return false;
  for (const [a, b, w, d] of ZONES) if (x > a - m && x < a + w + m && y > b - m && y < b + d + m) return false;
  for (const r of ROADS) if (distSeg(x, y, r[0], r[1], r[2], r[3]) < 0.75 + m) return false;
  return true;
}

export type TreeType = 'shade' | 'guayacan' | 'jacaranda' | 'pine' | 'palm' | 'bush';
export type FlowerTone = 0 | 1 | 2 | 3 | 4;
export type PersonTone = 0 | 1 | 2 | 3 | 4;

export interface Tuft { x: number; y: number; s: number; p: number }
export interface Flower { x: number; y: number; tone: FlowerTone; s: number }
export interface WildTree { x: number; y: number; type: TreeType; s: number; p: number }
export interface Meadow { x: number; y: number; rx: number; ry: number; tone: number }

export interface Vehicle {
  route: readonly (readonly [number, number])[];
  i: number;
  t: number;
  speed: number;
  /** Clave de la paleta de la carga y de la cabina (cityPalette.ts). */
  livery: 0 | 1 | 2;
}
export interface Person { off: number; speed: number; dir: 1 | -1; tone: PersonTone }
export interface Cloud { x: number; y: number; z: number; s: number; speed: number }

export interface CityScene {
  tufts: Tuft[];
  flowers: Flower[];
  wildTrees: WildTree[];
  meadow: Meadow[];
  vehicles: Vehicle[];
  people: Person[];
  clouds: Cloud[];
  /** Generador para lo que cambia durante la animación (nubes que vuelven a entrar): también determinista. */
  next: () => number;
}

const TREE_TYPES: readonly TreeType[] = ['shade', 'shade', 'guayacan', 'jacaranda', 'pine', 'pine', 'palm', 'bush', 'bush'];

export function createCityScene(seed = CITY_SEED): CityScene {
  const R = rng(seed);
  const tufts: Tuft[] = [], flowers: Flower[] = [], wildTrees: WildTree[] = [], meadow: Meadow[] = [];
  for (let i = 0; i < 900 && tufts.length < 340; i++) {
    const x = -12.8 + R() * 25.6, y = -11.8 + R() * 23.6;
    if (isFree(x, y, 0.05)) tufts.push({ x, y, s: 0.75 + R() * 0.55, p: R() * 6 });
  }
  for (let c = 0; c < 26; c++) { // manchas de flores en grupos, no regadas al azar
    const cx = -12 + R() * 24, cy = -11 + R() * 22, tone = (c % 5) as FlowerTone;
    for (let j = 0; j < 9; j++) {
      const x = cx + (R() - 0.5) * 1.6, y = cy + (R() - 0.5) * 1.1;
      if (isFree(x, y, 0.05)) flowers.push({ x, y, tone, s: 0.7 + R() * 0.5 });
    }
  }
  for (let i = 0; i < 700 && wildTrees.length < 58; i++) {
    const x = -12.6 + R() * 25.2, y = -11.6 + R() * 23.2;
    if (!isFree(x, y, 0.45)) continue;
    if (wildTrees.some((t) => Math.hypot(t.x - x, t.y - y) < 1.15)) continue;
    wildTrees.push({ x, y, type: TREE_TYPES[Math.floor(R() * TREE_TYPES.length)], s: 0.75 + R() * 0.4, p: R() * 6 });
  }
  for (let i = 0; i < 16; i++) meadow.push({ x: -12 + R() * 24, y: -11 + R() * 22, rx: 1.6 + R() * 2.6, ry: 1.2 + R() * 2, tone: R() });

  const vehicles: Vehicle[] = [
    { route: [[8, -5], [8, -2], [3, -2], [3, 3], [-2, 3], [-2, 8], [-7, 8], [-2, 8], [-2, 3], [-3, 3], [-3, -3], [3, -3], [3, -2], [8, -2]], i: 0, t: 0, speed: 0.22, livery: 0 },
    { route: [[-3, -3], [-6, -3], [-6, -6], [-6, -3], [-3, -3], [3, -3], [3, 3], [-3, 3]], i: 2, t: 0.3, speed: 0.26, livery: 1 },
    { route: [[3, 2], [6, 2], [3, 2], [3, 3], [-3, 3], [-3, -3], [3, -3], [3, 2]], i: 0, t: 0.6, speed: 0.28, livery: 2 },
  ];
  const people: Person[] = Array.from({ length: 9 }, (_, i) => ({
    off: i / 9, speed: 0.012 + (i % 3) * 0.004, dir: i % 2 ? 1 : -1, tone: (i % 5) as PersonTone,
  }));
  const clouds: Cloud[] = [
    { x: -16, y: -12, z: 6.2, s: 2.2, speed: 0.008 }, { x: -4, y: 4, z: 6.8, s: 1.8, speed: 0.010 },
    { x: 8, y: -10, z: 5.8, s: 2.6, speed: 0.007 }, { x: 14, y: 6, z: 6.4, s: 1.6, speed: 0.009 },
  ];
  return { tufts, flowers, wildTrees, meadow, vehicles, people, clouds, next: R };
}

export function vehiclePos(v: Vehicle) {
  const A = v.route[v.i], B = v.route[(v.i + 1) % v.route.length];
  return { x: A[0] + (B[0] - A[0]) * v.t, y: A[1] + (B[1] - A[1]) * v.t, dx: B[0] - A[0], dy: B[1] - A[1] };
}

/** Avanza la escena `dt` segundos (vehículos y nubes). Solo se llama cuando hay animación. */
export function stepCityScene(scene: CityScene, dt: number): void {
  for (const v of scene.vehicles) {
    const A = v.route[v.i], B = v.route[(v.i + 1) % v.route.length];
    v.t += (v.speed * dt * 8) / Math.max(0.5, Math.hypot(B[0] - A[0], B[1] - A[1]));
    if (v.t >= 1) { v.t = 0; v.i = (v.i + 1) % v.route.length; }
  }
  for (const c of scene.clouds) {
    c.x += c.speed * dt * 60;
    c.y -= c.speed * 0.35 * dt * 60;
    if (c.x > 22) { c.x = -22; c.y = scene.next() * 24 - 12; }
  }
}

/** Punto del perímetro de la plaza (a 2,65 del centro) por donde caminan los peatones. */
export function ringPoint(u: number): [number, number] {
  const s = 2.65, p = mod(u, 1) * 4, side = Math.floor(p), f = p - side;
  const pts: [number, number][] = [[-s + 2 * s * f, -s], [s, -s + 2 * s * f], [s - 2 * s * f, s], [-s, s - 2 * s * f]];
  return pts[side];
}

/** Cámara fija (D-P3: sin cámara movible): panorama del valle. */
export const CAMERA = { x: 0, y: 0.5, k: 0.9 } as const;

export type DistrictKey = 'welcome' | 'home' | 'explore' | 'donations' | 'track' | 'org' | 'assets' | 'profile';

export interface DistrictInfo {
  x: number;
  y: number;
  k: number;
  name: string;
  type: string;
  orbit?: boolean;
}

/**
 * Distritos de la ciudad isométrica (D-F3, plan-fase7-fidelidad.md §2.1; prototipo paxfide-home.html).
 */
export const DISTRICTS: Record<DistrictKey, DistrictInfo> = {
  welcome:   { x: 0,    y: 0.5,  k: 0.9,  name: 'Ciudad PaxFide', type: 'Panorama', orbit: true },
  home:      { x: -0.5, y: -0.8, k: 1.08, name: 'Plaza central', type: 'Centro cívico' },
  explore:   { x: -6.8, y: 6.2,  k: 1.16, name: 'Barrio escolar', type: 'Causas y educación' },
  donations: { x: 2.2,  y: 6.0,  k: 1.15, name: 'Ronda del río', type: 'Impacto' },
  track:     { x: 7.2,  y: -4.8, k: 1.16, name: 'Hub de trazabilidad', type: 'Anclaje' },
  org:       { x: -6.5, y: -5.5, k: 1.15, name: 'Sede de organizaciones', type: 'Organizaciones' },
  assets:    { x: 7.2,  y: -4.8, k: 1.16, name: 'Bodega de lotes', type: 'Logística' },
  profile:   { x: 5.5,  y: 1.8,  k: 1.22, name: 'Barrio residencial', type: 'Tu perfil' },
};

/** Mapeo oficial de ruta a distrito (D-F3, plan-fase7-fidelidad.md §2.1). */
export function districtForRoute(pathname: string): DistrictKey {
  if (pathname === '/home') return 'home';
  if (pathname === '/campaigns' || pathname.startsWith('/c/')) return 'explore';
  if (pathname === '/account/donations') return 'donations';
  if (pathname === '/tracking') return 'track';
  if (pathname === '/account') return 'profile';
  if (pathname.startsWith('/assets')) return 'assets';
  if (pathname.startsWith('/panel')) return 'org';
  return 'welcome';
}

/** Densidad de píxeles como mucho 1,5 (D-P3, D-F3). */
export const MAX_DPR = 1.5;
export const clampDpr = (dpr: number | undefined) => Math.min(MAX_DPR, Math.max(1, dpr || 1));
