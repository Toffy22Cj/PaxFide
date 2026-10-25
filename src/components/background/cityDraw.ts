// Ref: plan-fase7-pantallas.md A-1 y D-P1–D-P4; prototipo paxfide-home.html (motor isométrico: solo forma).
// Dibuja una escena de cityScene.ts en un canvas 2D (R-F4). Sin colores propios: todos salen de cityPalette.ts.
// Fuera, por D-P3 y R-F1: cámara movible o que orbita, arrastrar, "Ver ciudad" y las etiquetas con texto.
import { CAMERA, DISTRICTS, type DistrictKey, PATHS, ROADS, mod, riverY, ringPoint, vehiclePos, type CityScene, type TreeType, type Vehicle } from './cityScene';
import { cityPalette, type CityPalette } from './cityPalette';

type Pt = [number, number];
type Box = { top: string; left: string; right: string };

const TW = 36, TH = 18, HZ = 22;
const CACHE_HALF_W = 1000, CACHE_HALF_H = 560;
const TREE_SIZE: Record<'shade' | 'guayacan' | 'jacaranda' | 'pine', { h: number; r: number }> = {
  shade: { h: 1.4, r: 17 }, guayacan: { h: 1.35, r: 15 }, jacaranda: { h: 1.3, r: 14 }, pine: { h: 1.7, r: 11 },
};

export class CityRenderer {
  private ctx: CanvasRenderingContext2D;
  private cam: { x: number; y: number; k: number } = { x: CAMERA.x, y: CAMERA.y, k: CAMERA.k };
  private camTarget: { x: number; y: number; k: number } = { x: CAMERA.x, y: CAMERA.y, k: CAMERA.k };
  private currentDistrictKey: DistrictKey = 'welcome';
  private ox = 0;
  private oy = 0;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private P: CityPalette = cityPalette(0);
  private ground: Partial<Record<'d' | 'n', { c: HTMLCanvasElement; f: number }>> = {};

  constructor(private readonly canvas: HTMLCanvasElement, private readonly scene: CityScene) {
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  resize(width: number, height: number, dpr: number): void {
    this.W = width; this.H = height; this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr);
    this.ox = width / 2; this.oy = height / 2 + 35;
    const d = DISTRICTS[this.currentDistrictKey] || DISTRICTS.welcome;
    const scale = width < 768 ? 0.8 : 1;
    this.camTarget.k = d.k * scale;
    if (this.cam.k === CAMERA.k || this.cam.k === CAMERA.k * 0.8) {
      this.cam.k = d.k * scale;
    }
  }

  setDistrict(key: DistrictKey, jump = false): void {
    this.currentDistrictKey = key;
    const d = DISTRICTS[key] || DISTRICTS.welcome;
    const scale = this.W > 0 && this.W < 768 ? 0.8 : 1;
    this.camTarget.x = d.x;
    this.camTarget.y = d.y;
    this.camTarget.k = d.k * scale;
    if (jump) {
      this.cam.x = d.x;
      this.cam.y = d.y;
      this.cam.k = d.k * scale;
    }
  }

  getDistrict(): DistrictKey {
    return this.currentDistrictKey;
  }

  getCam(): { x: number; y: number; k: number } {
    return { ...this.cam };
  }

  updateCamera(dt: number, reducedMotion: boolean, t: number): void {
    const d = DISTRICTS[this.currentDistrictKey] || DISTRICTS.welcome;
    const scale = this.W > 0 && this.W < 768 ? 0.8 : 1;
    if (reducedMotion) {
      this.cam.x = d.x;
      this.cam.y = d.y;
      this.cam.k = d.k * scale;
      return;
    }
    if (d.orbit) {
      this.camTarget.x = Math.sin(t * 0.22) * 2.2;
      this.camTarget.y = 0.5 + Math.cos(t * 0.22) * 1.6;
    }
    const e = Math.min(1, dt * 3.8);
    this.cam.x += (this.camTarget.x - this.cam.x) * e;
    this.cam.y += (this.camTarget.y - this.cam.y) * e;
    this.cam.k += (this.camTarget.k - this.cam.k) * e;
  }

  /** Un fotograma: `n` es la mezcla día/noche (0 día, 1 noche) y `t` el tiempo del mundo en segundos. */
  draw(n: number, t: number): void {
    const ctx = this.ctx;
    this.P = cityPalette(n);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, this.H);
    for (const [stop, col] of this.P.sky) bg.addColorStop(stop, col);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, this.W, this.H);
    if (n > 0.5) {
      ctx.fillStyle = this.P.star;
      for (let s = 0; s < 60; s++) {
        const x = mod(s * 197.3, this.W), y = mod(s * 83.7, this.H * 0.55);
        ctx.globalAlpha = (Math.sin(t * 2 + s) * 0.5 + 0.5) * 0.7 * n; ctx.fillRect(x, y, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }
    this.drawGround(n, t);
    for (const o of this.sceneObjects(n, t)) o.fn();
    this.drawAir(n, t);
  }

  // ---------------------------------------------------------------- primitivas
  private iso(x: number, y: number, z = 0): Pt {
    const k = this.cam.k, c = this.cam;
    return [this.ox + ((x - c.x) - (y - c.y)) * TW * k, this.oy + ((x - c.x) + (y - c.y)) * TH * k - z * HZ * k];
  }
  private poly(pts: Pt[], fill: string | null, stroke: string | null = null, strokeW = 1): void {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeW * this.cam.k; ctx.stroke(); }
  }
  private box(x: number, y: number, z: number, w: number, d: number, h: number, c: Box): void {
    const p = (a: number, b: number, cz: number) => this.iso(a, b, cz);
    const A = p(x, y, z + h), B = p(x + w, y, z + h), C = p(x + w, y + d, z + h), D = p(x, y + d, z + h);
    const B0 = p(x + w, y, z), C0 = p(x + w, y + d, z), D0 = p(x, y + d, z);
    this.poly([D, C, C0, D0], c.left); this.poly([C, B, B0, C0], c.right); this.poly([A, B, C, D], c.top);
  }
  private flat(x: number, y: number, w: number, d: number, z: number, fill: string, stroke: string): void {
    this.poly([this.iso(x, y, z), this.iso(x + w, y, z), this.iso(x + w, y + d, z), this.iso(x, y + d, z)], fill, stroke, 1.2);
  }
  private hipRoof(x: number, y: number, z: number, w: number, d: number, h: number, o: number, c: Box): void {
    const A = this.iso(x - o, y - o, z), B = this.iso(x + w + o, y - o, z), C = this.iso(x + w + o, y + d + o, z), D = this.iso(x - o, y + d + o, z);
    const R1 = this.iso(x + w * 0.28, y + d * 0.5, z + h), R2 = this.iso(x + w * 0.72, y + d * 0.5, z + h);
    this.poly([A, B, R2, R1], c.top); this.poly([A, D, R1], c.left); this.poly([D, C, R2, R1], c.left); this.poly([C, B, R2], c.right);
  }
  private windows(face: 'left' | 'right', x: number, y: number, z: number, length: number, rows: number, cols: number, wS: number, hS: number, n: number, t: number): void {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lit = n > 0.25 && Math.sin(t * 0.35 + (r * 7 + c * 13 + x * 3)) > -0.55;
      const col = lit ? this.P.windowLit(0.5 + n * 0.45) : this.P.windowOff;
      const u = (c + 0.5) / cols, wz = z + ((r + 0.5) / rows) * (rows * hS * 1.3);
      const Q: Pt[] = face === 'left'
        ? [[x + u * length - wS * 0.4, y], [x + u * length + wS * 0.4, y]]
        : [[x, y + u * length - wS * 0.4], [x, y + u * length + wS * 0.4]];
      this.poly([this.iso(Q[0][0], Q[0][1], wz), this.iso(Q[1][0], Q[1][1], wz), this.iso(Q[1][0], Q[1][1], wz + hS), this.iso(Q[0][0], Q[0][1], wz + hS)], col);
    }
  }
  private groundShadow(x: number, y: number, rx: number, ry: number, a = 0.16): void {
    const [px, py] = this.iso(x, y, 0.01), ctx = this.ctx;
    ctx.fillStyle = this.P.shadow(a);
    ctx.beginPath(); ctx.ellipse(px, py, rx * TW * this.cam.k, ry * TH * this.cam.k, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---------------------------------------------------------------- vegetación
  private trunk(base: Pt, top: Pt, w: number, col: string): void {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.lineTo(top[0], top[1]);
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, w * this.cam.k); ctx.lineCap = 'round'; ctx.stroke();
  }
  private canopy(top: Pt, rad: number, cols: readonly [string, string, string], t: number, seed: number): void {
    const ctx = this.ctx, k = this.cam.k, br = 1 + Math.sin(t * 1.3 + seed) * 0.03;
    ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(top[0], top[1] - 3 * k, rad * br, 0, 7); ctx.fill();
    ctx.fillStyle = cols[1]; ctx.beginPath();
    ctx.arc(top[0] - rad * 0.38, top[1] - rad * 0.2, rad * 0.74 * br, 0, 7);
    ctx.arc(top[0] + rad * 0.42, top[1] - rad * 0.14, rad * 0.76 * br, 0, 7); ctx.fill();
    ctx.fillStyle = cols[2]; ctx.beginPath(); ctx.arc(top[0] + rad * 0.08, top[1] - rad * 0.5, rad * 0.62 * br, 0, 7); ctx.fill();
  }
  private tree(type: TreeType, x: number, y: number, s: number, t: number): void {
    if (type === 'palm') return this.palm(x, y, s, t);
    if (type === 'bush') return this.bush(x, y, 0.45 * s);
    const T = TREE_SIZE[type], C = this.P.trees[type], ctx = this.ctx, k = this.cam.k;
    this.groundShadow(x, y, 0.8 * s, 0.42 * s, 0.24);
    const sway = Math.sin(t * 1.6 + x * 1.5 + y) * 0.08 * s;
    const base = this.iso(x, y, 0), top = this.iso(x + sway, y - sway, T.h * s);
    this.trunk(base, top, 4.6 * s, C.trunk);
    if (type === 'pine') {
      for (let i = 0; i < 3; i++) {
        const w = (T.r - i * 3) * k * s, yy = top[1] + (6 - i * 9) * k * s;
        ctx.fillStyle = C.canopy[i]; ctx.beginPath();
        ctx.moveTo(top[0] - w, yy); ctx.lineTo(top[0] + w, yy); ctx.lineTo(top[0] + sway * 20, yy - 16 * k * s); ctx.fill();
      }
      return;
    }
    this.canopy(top, T.r * k * s, C.canopy, t, x * 3 + y);
  }
  private palm(x: number, y: number, s: number, t: number): void {
    const ctx = this.ctx, k = this.cam.k;
    this.groundShadow(x, y, 0.5 * s, 0.26 * s, 0.22);
    const sway = Math.sin(t * 1.8 + x * 1.3) * 0.12 * s;
    const base = this.iso(x, y, 0), top = this.iso(x + sway, y - sway, 1.8 * s);
    ctx.beginPath(); ctx.moveTo(base[0], base[1]);
    ctx.quadraticCurveTo(base[0] + 5 * k, (base[1] + top[1]) / 2, top[0], top[1]);
    ctx.strokeStyle = this.P.palmTrunk; ctx.lineWidth = Math.max(2, 3.4 * k * s); ctx.lineCap = 'round'; ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + Math.sin(t * 0.9 + x) * 0.15;
      const len = (16 + (i % 2) * 5) * k * s;
      ctx.beginPath(); ctx.moveTo(top[0], top[1]);
      ctx.quadraticCurveTo(top[0] + Math.cos(ang) * len * 0.55, top[1] - 8 * k, top[0] + Math.cos(ang) * len, top[1] + Math.sin(ang) * len * 0.55 + 3 * k);
      ctx.strokeStyle = this.P.palmLeaves[i % 4]; ctx.lineWidth = Math.max(1.5, 2.5 * k * s); ctx.stroke();
    }
  }
  private bush(x: number, y: number, r: number, col?: string): void {
    const ctx = this.ctx, k = this.cam.k;
    this.groundShadow(x, y, r * 0.8, r * 0.4, 0.18);
    const [bx, by] = this.iso(x, y, 0.12);
    ctx.fillStyle = col || this.P.bush;
    ctx.beginPath();
    ctx.arc(bx, by, r * 14 * k, 0, 7); ctx.arc(bx - r * 5 * k, by + r * 2 * k, r * 10 * k, 0, 7); ctx.arc(bx + r * 5 * k, by + r * 2 * k, r * 10 * k, 0, 7);
    ctx.fill();
    ctx.fillStyle = this.P.bushHighlight;
    ctx.beginPath(); ctx.arc(bx - r * 3 * k, by - r * 6 * k, r * 5 * k, 0, 7); ctx.fill();
  }
  private lamp(x: number, y: number, n: number): void {
    const ctx = this.ctx, k = this.cam.k, p0 = this.iso(x, y, 0), p1 = this.iso(x, y, 1.05);
    ctx.strokeStyle = this.P.lampPole; ctx.lineWidth = Math.max(1.4, 2 * k);
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    ctx.fillStyle = n > 0.35 ? cityPalette(1).lampBulb : cityPalette(0).lampBulb;
    ctx.beginPath(); ctx.arc(p1[0], p1[1], Math.max(2, 3.2 * k), 0, 7); ctx.fill();
    if (n > 0.1) {
      const g = ctx.createRadialGradient(p0[0], p0[1], 0, p0[0], p0[1], 32 * k);
      g.addColorStop(0, this.P.lampGlow(0.45 * n)); g.addColorStop(1, this.P.lampGlowEnd);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p0[0], p0[1], 32 * k, 16 * k, 0, 0, 7); ctx.fill();
    }
  }

  // ---------------------------------------------------------------- vehículos, peatones, nubes
  private truck(v: Vehicle, n: number, t: number): void {
    const ctx = this.ctx, k = this.cam.k, L = this.P.liveries[v.livery];
    const { x, y, dx, dy } = vehiclePos(v), alongX = Math.abs(dx) >= Math.abs(dy), dir = alongX ? Math.sign(dx || 1) : Math.sign(dy || 1);
    const bump = Math.abs(Math.sin(t * 9 + v.i)) * 0.02;
    this.groundShadow(x, y, 0.65, 0.36, 0.28);
    const cab = dir > 0 ? 0.28 : -0.52, box = dir > 0 ? -0.45 : -0.15;
    if (alongX) { this.box(x + box, y - 0.24, 0.06 + bump, 0.68, 0.48, 0.48, L.cargo); this.box(x + cab, y - 0.22, 0.06 + bump, 0.32, 0.44, 0.36, L.cab); }
    else { this.box(x - 0.24, y + box, 0.06 + bump, 0.48, 0.68, 0.48, L.cargo); this.box(x - 0.22, y + cab, 0.06 + bump, 0.44, 0.32, 0.36, L.cab); }
    if (n > 0.2) {
      const [fx, fy] = this.iso(x + (alongX ? dir * 0.45 : 0), y + (alongX ? 0 : dir * 0.45), 0.22);
      const ang = Math.atan2((dx + dy) * TH, (dx - dy) * TW);
      const g = ctx.createRadialGradient(fx, fy, 2, fx, fy, 60 * k);
      g.addColorStop(0, this.P.headlight(0.7 * n)); g.addColorStop(1, this.P.headlightEnd);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.arc(fx, fy, 60 * k, ang - 0.35, ang + 0.35); ctx.closePath(); ctx.fill();
    }
  }
  private person(x: number, y: number, col: string, t: number): void {
    const ctx = this.ctx, k = this.cam.k, step = Math.abs(Math.sin(t * 10)) * 0.04;
    const [px, py] = this.iso(x, y, 0), [hx, hy] = this.iso(x, y, 0.62 + step);
    ctx.fillStyle = this.P.shadow(0.2); ctx.beginPath(); ctx.ellipse(px, py, 4 * k, 2 * k, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = this.P.personBody ?? col; ctx.lineWidth = Math.max(2, 4 * k); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px, py - 2 * k); ctx.lineTo(hx, hy + 4 * k); ctx.stroke();
    ctx.fillStyle = this.P.personHead; ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.8, 2.6 * k), 0, 7); ctx.fill();
  }

  // ---------------------------------------------------------------- pasada 1: suelo
  private groundStatic(): void {
    const ctx = this.ctx, P = this.P;
    this.box(-13.5, -12.5, -0.65, 27, 25, 0.65, { top: P.grass, left: P.soilLeft, right: P.soilRight });
    const Q = [this.iso(-13.5, -12.5, 0), this.iso(13.5, -12.5, 0), this.iso(13.5, 12.5, 0), this.iso(-13.5, 12.5, 0)];
    ctx.save();
    ctx.beginPath(); ctx.moveTo(Q[0][0], Q[0][1]); Q.slice(1).forEach((p) => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.clip();
    for (const m of this.scene.meadow) {
      const [px, py] = this.iso(m.x, m.y, 0), rx = m.rx * TW * this.cam.k, ry = m.ry * TH * this.cam.k;
      const g = ctx.createRadialGradient(px, py, 0, px, py, Math.max(rx, ry));
      g.addColorStop(0, m.tone > 0.5 ? P.meadowLight : P.meadowDark); g.addColorStop(1, P.transparent);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, rx, ry, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = P.path; ctx.lineWidth = 0.42 * TW * this.cam.k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const path of PATHS) {
      ctx.beginPath();
      path.forEach(([x, y], i) => { const p = this.iso(x, y, 0.01); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.stroke();
    }
    const band = (half: number, z: number, fill: string) => {
      const top: Pt[] = [], bot: Pt[] = [];
      for (let i = 0; i <= 54; i++) { const u = -13.5 + (i / 54) * 27, y = riverY(u); top.push(this.iso(u, y - half, z)); bot.push(this.iso(u, y + half, z)); }
      this.poly(top.concat(bot.reverse()), fill);
    };
    band(1.55, 0.02, P.sand); band(1.25, -0.06, P.water); band(0.55, -0.05, P.waterChannel);
    for (const [x1, y1, x2, y2] of ROADS) {
      const a = this.iso(x1, y1, 0.015), b = this.iso(x2, y2, 0.015);
      ctx.lineCap = 'round';
      ctx.strokeStyle = P.roadEdge; ctx.lineWidth = 1.4 * TW * this.cam.k; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = P.road; ctx.lineWidth = 1.05 * TW * this.cam.k; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = P.roadLine; ctx.lineWidth = Math.max(1, 1.8 * this.cam.k);
      ctx.setLineDash([8 * this.cam.k, 8 * this.cam.k]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
    }
    this.box(-2.65, 3.8, 0, 1.3, 2.8, 0.26, P.bridge);
    this.box(-8.8, -8.5, 0, 4.6, 4.4, 0.14, P.plazaOrg);
    this.box(5.2, -8.2, 0, 5.2, 5.2, 0.16, P.plazaHub);
    this.box(-2.4, -2.4, 0, 4.8, 4.8, 0.12, P.plazaHome);
    this.box(-1.5, -1.5, 0.12, 3, 3, 0.03, P.plazaHomeInner);
    this.box(4.5, -0.2, 0, 3.6, 3.6, 0.14, P.plazaVilla);
    this.box(-10.2, 5.8, 0, 6, 4.8, 0.15, P.plazaSchool);
    this.flat(-6.2, 6.4, 1.7, 2.4, 0.17, P.court, P.courtLine);
    this.box(0.8, 6.5, 0, 4.8, 3.6, 0.14, P.plazaRiver);
    this.box(1.8, 5.2, 0.05, 1.6, 1.5, 0.12, P.deck);
    for (const f of this.scene.flowers) {
      const [fx, fy] = this.iso(f.x, f.y, 0.02), r = Math.max(1.4, 2.2 * this.cam.k * f.s);
      ctx.fillStyle = P.flowers[f.tone]; ctx.beginPath(); ctx.arc(fx, fy - 3 * this.cam.k, r, 0, 7); ctx.fill();
    }
  }
  private groundLive(n: number, t: number): void {
    const ctx = this.ctx, k = this.cam.k, P = this.P;
    ctx.lineWidth = Math.max(1, 1.6 * k); ctx.lineCap = 'round';
    for (let j = 0; j < 14; j++) {
      const u = mod(t * 1.1 + j * 2.1, 28) - 14, lane = (((j * 7) % 5) - 2) * 0.35;
      if (u > -3.2 && u < -1.0) continue; // no pasar por encima del puente
      const a = this.iso(u, riverY(u) + lane, -0.04), b = this.iso(u + 0.9, riverY(u + 0.9) + lane, -0.04);
      ctx.strokeStyle = P.stream((Math.sin(t * 2 + j) * 0.5 + 0.5) * 0.6 + 0.2);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    const night = n > 0.5;
    const gustAt = (x: number, y: number) => { const d = mod((x + y) - t * 3.2, 30) - 15; return Math.exp((-d * d) / 6); };
    const tufts = this.scene.tufts.map((g) => { const [sx, sy] = this.iso(g.x, g.y, 0.01); return { g, sx, sy, gust: night ? 0 : gustAt(g.x, g.y) }; });
    const tip = (u: (typeof tufts)[number], side: number): [number, number, number, number] => {
      const kk = k * u.g.s, hgt = (side === 0 ? 13 : 9) * kk;
      const wind = (Math.sin(t * 2.4 + u.g.x * 2.1 + u.g.y * 1.7 + u.g.p) * 4 + u.gust * 9) * kk;
      return [u.sx + side * 6 * k + wind, u.sy - hgt * (1 - u.gust * 0.25), u.sx + side * 4 * k, u.sy - hgt * 0.6];
    };
    ctx.lineCap = 'round';
    ([[P.tuftBlades[0], -1], [P.tuftBlades[1], 0], [P.tuftBlades[2], 1]] as const).forEach(([col, side]) => {
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, 1.4 * k); ctx.beginPath();
      for (const u of tufts) { const [tx, ty, cx, cy] = tip(u, side); ctx.moveTo(u.sx + side * 3 * k, u.sy); ctx.quadraticCurveTo(cx, cy, tx, ty); }
      ctx.stroke();
    });
    if (!night) {
      ctx.strokeStyle = P.tuftGlint; ctx.lineWidth = Math.max(1, 1.5 * k); ctx.beginPath();
      for (const u of tufts) if (u.gust > 0.35) { const [tx, ty] = tip(u, 0); ctx.moveTo(tx, ty); ctx.lineTo(tx - 2 * k, ty + 4 * k * u.gust); }
      ctx.stroke();
    }
  }
  /** La proyección es afín: el suelo estático se dibuja una vez por tema y después solo se mueve y escala. */
  private groundCache(night: boolean) {
    const key = night ? 'n' : 'd', f = this.dpr, hit = this.ground[key];
    if (hit && hit.f === f) return hit;
    const c = document.createElement('canvas'); c.width = Math.ceil(CACHE_HALF_W * 2 * f); c.height = Math.ceil(CACHE_HALF_H * 2 * f);
    const real = this.ctx, saved = { ...this.cam, ox: this.ox, oy: this.oy };
    const cctx = c.getContext('2d');
    if (!cctx) return null;
    this.ctx = cctx; cctx.setTransform(f, 0, 0, f, 0, 0);
    this.cam = { x: 0, y: 0, k: 1 }; this.ox = CACHE_HALF_W; this.oy = CACHE_HALF_H;
    try { this.groundStatic(); }
    finally { this.ctx = real; this.cam = { x: saved.x, y: saved.y, k: saved.k }; this.ox = saved.ox; this.oy = saved.oy; }
    return (this.ground[key] = { c, f });
  }
  private drawGround(n: number, t: number): void {
    const G = this.groundCache(n > 0.5), [x0, y0] = this.iso(0, 0, 0), k = this.cam.k;
    if (G) this.ctx.drawImage(G.c, x0 - CACHE_HALF_W * k, y0 - CACHE_HALF_H * k, CACHE_HALF_W * 2 * k, CACHE_HALF_H * 2 * k);
    else this.groundStatic();
    this.groundLive(n, t);
  }

  // ---------------------------------------------------------------- pasada 2: objetos ordenados por profundidad
  private sceneObjects(n: number, t: number): { d: number; fn: () => void }[] {
    const O: { d: number; fn: () => void }[] = [], P = this.P, ctx = this.ctx;
    const add = (x: number, y: number, fn: () => void) => O.push({ d: x + y, fn });
    const k = () => this.cam.k;
    const tree = (type: TreeType, x: number, y: number, s: number, p = 0) => add(x, y, () => this.tree(type, x, y, s, t + p));

    // Sede de las organizaciones
    add(-6.9, -6.7, () => {
      this.groundShadow(-6.9, -6.7, 2, 1, 0.22);
      this.box(-8.2, -7.8, 0.14, 2.6, 2.2, 1.05, P.orgBase);
      this.box(-7.8, -7.4, 1.19, 1.8, 1.4, 0.65, P.orgTop);
      this.windows('left', -8.0, -5.6, 0.35, 2.2, 2, 4, 0.28, 0.28, n, t);
    });
    ([[-8.3, -4.8, 3.2], [-5.0, -7.8, 2.7]] as const).forEach(([wx, wy, wh], idx) => add(wx, wy, () => {
      const [bX, bY] = this.iso(wx, wy, 0.14), [tX, tY] = this.iso(wx, wy, wh);
      ctx.strokeStyle = P.mill; ctx.lineWidth = 3.2 * k(); ctx.beginPath(); ctx.moveTo(bX, bY); ctx.lineTo(tX, tY); ctx.stroke();
      ctx.strokeStyle = P.millBlade; ctx.lineWidth = 2.2 * k();
      for (let b = 0; b < 3; b++) { const a = t * 2.4 + idx * 1.2 + b * 2.094; ctx.beginPath(); ctx.moveTo(tX, tY); ctx.lineTo(tX + Math.cos(a) * 21 * k(), tY + Math.sin(a) * 18 * k()); ctx.stroke(); }
      ctx.fillStyle = P.millHub; ctx.beginPath(); ctx.arc(tX, tY, 3.5 * k(), 0, 7); ctx.fill();
    }));
    tree('shade', -9.5, -6.5, 1.1); tree('jacaranda', -5.2, -5.2, 1.05, 1); add(-7.0, -4.5, () => this.bush(-7.0, -4.5, 0.55));

    // Centro de trazabilidad
    add(7.4, -6.2, () => {
      this.groundShadow(7.4, -6.2, 2, 1.1, 0.22);
      this.box(5.8, -7.6, 0.16, 3.2, 2.8, 1.35, P.hubBase);
      this.box(6.1, -7.2, 1.51, 0.7, 2, 0.28, P.hubPanel);
      this.box(7.2, -7.2, 1.51, 0.7, 2, 0.28, P.hubPanel);
      this.windows('left', 6.0, -4.8, 0.4, 2.8, 2, 5, 0.26, 0.28, n, t);
    });
    add(6.6, -4.4, () => {
      this.box(6.2, -4.8, 0.16, 0.8, 0.08, 0.75, P.crateGate);
      this.box(7.4, -4.8, 0.16, 0.8, 0.08, 0.75, P.crateGate);
      this.box(5.6, -4.3, 0.16, 0.65, 0.65, 0.52, P.crate1);
      this.box(6.4, -4.2, 0.16, 0.55, 0.55, 0.42, P.crate2);
      this.box(5.7, -4.2, 0.68, 0.45, 0.45, 0.35, P.crate3);
    });
    add(9.5, -6.8, () => { // torre de anclaje: el bloque sube y baja y emite ondas
      this.box(9.1, -7.2, 0.16, 0.8, 0.8, 1.9, P.tower);
      const fz = 2.45 + Math.sin(t * 3) * 0.18;
      this.box(9.2, -7.1, fz, 0.6, 0.6, 0.55, P.towerBlock);
      const [bx, by] = this.iso(9.5, -6.8, fz + 0.3);
      for (let r = 0; r < 2; r++) {
        const ph = mod(t * 0.7 + r * 0.5, 1), rad = (6 + ph * 30) * k();
        ctx.strokeStyle = P.wave(1 - ph); ctx.lineWidth = 2 * k(); ctx.beginPath(); ctx.arc(bx, by, rad, 0, 7); ctx.stroke();
      }
    });
    tree('palm', 10.2, -5.5, 1.1); tree('guayacan', 4.6, -6.8, 1.0, 1.5);

    // Plaza fundacional
    add(0, -1.6, () => {
      this.groundShadow(0, -1.6, 2.4, 1.1, 0.22);
      this.box(-1.8, -2.3, 0.15, 3.6, 1.5, 1.45, P.hall);
      this.windows('left', -1.6, -0.8, 0.35, 3.2, 2, 5, 0.28, 0.32, n, t);
      this.hipRoof(-1.95, -2.45, 1.6, 3.9, 1.8, 0.55, 0.35, P.hallRoof);
      this.box(-0.55, -2.1, 1.6, 1.1, 1.1, 1.15, P.hallTower);
      const [cx, cy] = this.iso(0, -1.0, 2.2);
      ctx.fillStyle = P.clockFace; ctx.strokeStyle = P.clockHands; ctx.lineWidth = 1.2 * k();
      ctx.beginPath(); ctx.ellipse(cx, cy, 5 * k(), 6 * k(), 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(t * 0.5) * 4 * k(), cy + Math.sin(t * 0.5) * 4 * k()); ctx.stroke();
      this.hipRoof(-0.68, -2.22, 2.75, 1.36, 1.36, 0.5, 0.25, P.hallTowerRoof);
    });
    add(0, 0.3, () => { // fuente con chorro y gotas
      this.box(-0.75, -0.35, 0.15, 1.5, 1.5, 0.28, P.fountain);
      this.box(-0.4, 0, 0.43, 0.8, 0.8, 0.25, P.fountainInner);
      const [fx, fy] = this.iso(0, 0.4, 0.72), jh = (12 + Math.sin(t * 5) * 4) * k();
      ctx.strokeStyle = P.jet; ctx.lineWidth = 2.5 * k(); ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - jh); ctx.stroke();
      ctx.fillStyle = P.drops;
      for (let d = 0; d < 6; d++) {
        const ph = mod(t * 1.2 + d / 6, 1), a = d * 1.05;
        ctx.beginPath(); ctx.arc(fx + Math.cos(a) * ph * 12 * k(), fy - jh + ph * ph * (jh + 6 * k()), 1.4 * k(), 0, 7); ctx.fill();
      }
    });
    tree('palm', -2.0, 1.8, 1.05); tree('palm', 2.0, 1.8, 1.1, 1.2); tree('guayacan', -2.0, -0.4, 1.0); tree('shade', 2.0, -0.4, 1.0, 2);
    add(-1.3, 1.5, () => this.lamp(-1.3, 1.5, n)); add(1.3, 1.5, () => this.lamp(1.3, 1.5, n));

    // Barrio residencial
    add(6.2, 1.2, () => {
      this.groundShadow(6.2, 1.2, 1.6, 0.8, 0.2);
      this.box(5.1, 0.3, 0.14, 2.2, 1.8, 1.05, P.house);
      this.windows('left', 5.2, 2.1, 0.32, 1.8, 2, 3, 0.26, 0.28, n, t);
      this.hipRoof(4.95, 0.15, 1.19, 2.5, 2.1, 0.48, 0.25, P.houseRoof);
      const [sx, sy] = this.iso(6.6, 0.8, 1.75);
      for (let p = 0; p < 4; p++) {
        const ph = mod(t * 0.35 + p / 4, 1); ctx.fillStyle = P.smoke((1 - ph) * 0.5);
        ctx.beginPath(); ctx.arc(sx + ph * 10 * k(), sy - ph * 26 * k(), (2 + ph * 5) * k(), 0, 7); ctx.fill();
      }
    });
    tree('jacaranda', 7.5, 2.2, 1.0, 1); tree('shade', 4.2, -1.2, 0.95, 0.5); add(4.9, 2.5, () => this.lamp(4.9, 2.5, n));

    // Barrio de las escuelas
    add(-8.1, 7.3, () => {
      this.groundShadow(-8.1, 7.3, 1.8, 0.9, 0.22);
      this.box(-9.6, 6.3, 0.15, 3, 2, 1.15, P.school);
      this.box(-9.3, 6.6, 1.31, 1.1, 1.4, 0.06, P.schoolPanel);
      this.box(-7.9, 6.6, 1.31, 1.1, 1.4, 0.06, P.schoolPanel);
      this.windows('left', -9.4, 8.3, 0.32, 2.6, 2, 4, 0.3, 0.3, n, t);
    });
    add(-5.3, 7.6, () => { // balón que rebota en la cancha
      const bz = 0.2 + Math.abs(Math.sin(t * 3)) * 0.9, bxp = -5.3 + Math.sin(t * 0.8) * 0.5;
      this.groundShadow(bxp, 7.6, 0.14, 0.08, 0.3);
      const [px, py] = this.iso(bxp, 7.6, bz); ctx.fillStyle = P.ball; ctx.beginPath(); ctx.arc(px, py, 3.2 * k(), 0, 7); ctx.fill();
    });
    add(-9.5, 9.5, () => {
      const [a0, a1] = this.iso(-9.5, 9.5, 0.15), [b0, b1] = this.iso(-9.5, 9.5, 1.95);
      ctx.strokeStyle = P.mast; ctx.lineWidth = 3 * k(); ctx.beginPath(); ctx.moveTo(a0, a1); ctx.lineTo(b0, b1); ctx.stroke();
      this.box(-9.9, 9.1, 1.95, 0.85, 0.85, 0.75, P.tank);
    });
    tree('guayacan', -4.8, 9.8, 1.1, 0.5); tree('shade', -10.5, 5.5, 1.0, 1.2); tree('palm', -7.0, 5.4, 1.0);
    add(-6.5, 9.2, () => this.bush(-6.5, 9.2, 0.45, P.bushAlt));

    // Ronda del río
    add(2.7, 7.9, () => {
      this.groundShadow(2.7, 7.9, 1.6, 0.8, 0.2);
      this.box(1.5, 7.0, 0.14, 2.4, 1.8, 0.95, P.riverHouse);
      this.windows('left', 1.7, 8.8, 0.3, 2.0, 1, 4, 0.3, 0.34, n, t);
      this.hipRoof(1.35, 6.85, 1.09, 2.7, 2.1, 0.45, 0.25, P.riverHouseRoof);
    });
    tree('palm', 4.5, 7.4, 1.15, 2.1); tree('shade', 4.3, 9.1, 1.05, 1.4); tree('guayacan', 0.5, 8.2, 0.95, 0.8);
    add(1.3, 6.8, () => this.lamp(1.3, 6.8, n)); add(3.8, 6.8, () => this.lamp(3.8, 6.8, n));

    for (const w of this.scene.wildTrees) add(w.x, w.y, () => this.tree(w.type, w.x, w.y, w.s, t + w.p));

    // Lanchas en el río
    ([[-11 + mod(t * 1.05, 22), 1], [11 - mod(t * 0.8 + 6, 22), -1]] as const).forEach(([u, dir]) => add(u, riverY(u), () => {
      const ry = riverY(u), bob = Math.sin(t * 2.5 + u) * 0.03, [bx, by] = this.iso(u, ry, -0.02 + bob);
      ctx.strokeStyle = P.boatWake; ctx.lineWidth = 1.8 * k();
      ctx.beginPath(); ctx.moveTo(bx - dir * 20 * k(), by - dir * 10 * k() + 3 * k()); ctx.lineTo(bx, by + 3 * k()); ctx.stroke();
      this.box(u - 0.45, ry - 0.25, -0.04 + bob, 0.9, 0.5, 0.2, P.boatHull);
      this.box(u - 0.2, ry - 0.15, 0.16 + bob, 0.4, 0.3, 0.22, P.boatCabin);
    }));
    for (const v of this.scene.vehicles) { const p = vehiclePos(v); add(p.x, p.y, () => this.truck(v, n, t)); }
    for (const p of this.scene.people) {
      const [x, y] = ringPoint(p.off + p.dir * t * p.speed);
      add(x, y, () => this.person(x, y, P.people[p.tone], t + p.off * 9));
    }
    return O.sort((a, b) => a.d - b.d);
  }

  // ---------------------------------------------------------------- pasada 3: aire
  private drawAir(n: number, t: number): void {
    const ctx = this.ctx, k = this.cam.k, P = this.P;
    for (let f = 0; f < 2; f++) { // dos bandadas en V
      const lead = mod(t * (2 + f * 0.6) + f * 17, 40) - 20;
      for (let b = 0; b < 5; b++) {
        const side = b === 0 ? 0 : (b % 2 ? -1 : 1) * Math.ceil(b / 2);
        const bx = lead - Math.abs(side) * 0.9, by = -6 + f * 9 + side * 0.7 + Math.sin(t * 0.8 + b) * 0.25;
        const [px, py] = this.iso(bx, by, 4.6 + f * 0.8), flap = Math.sin(t * 13 + b * 1.6) * 5 * k;
        ctx.strokeStyle = P.bird; ctx.lineWidth = Math.max(1.4, 2 * k);
        ctx.beginPath(); ctx.moveTo(px - 6 * k, py - flap); ctx.quadraticCurveTo(px - k, py, px, py + 2 * k); ctx.quadraticCurveTo(px + k, py, px + 6 * k, py - flap); ctx.stroke();
      }
    }
    if (n <= 0.5) {
      const fl = this.scene.flowers;
      for (let i = 0; i < 10 && fl.length > 0; i++) { // mariposas sobre las flores
        const f = fl[(i * 23) % fl.length];
        const x = f.x + Math.sin(t * 0.7 + i) * 0.8, y = f.y + Math.cos(t * 0.5 + i * 2) * 0.6, z = 0.5 + Math.sin(t * 2 + i) * 0.25;
        const [px, py] = this.iso(x, y, z), w = Math.abs(Math.sin(t * 16 + i)) * 4 * k + k;
        ctx.fillStyle = P.butterflies[i % 4];
        ctx.beginPath(); ctx.ellipse(px - w * 0.6, py, w, 3 * k, -0.4, 0, 7); ctx.ellipse(px + w * 0.6, py, w, 3 * k, 0.4, 0, 7); ctx.fill();
      }
      for (let i = 0; i < 18; i++) { // hojas y pétalos llevados por la brisa
        const x = mod(i * 3.4 + t * 1.5, 28) - 14, y = mod(i * 2.8 - t * 0.75, 24) - 12, z = 0.5 + Math.sin(t * 2.2 + i * 1.8) * 0.3 + (i % 3) * 0.4;
        const [px, py] = this.iso(x, y, z);
        ctx.fillStyle = P.leaves[i % 3];
        ctx.beginPath(); ctx.ellipse(px, py, 3.5 * k, 1.8 * k, t * 2 + i, 0, 7); ctx.fill();
      }
    } else {
      for (let f = 0; f < 34; f++) { // luciérnagas
        const x = mod(f * 1.7 + t * 0.2, 24) - 12, y = mod(f * 2.3 - t * 0.15, 22) - 11, z = 0.3 + Math.sin(t * 3 + f * 1.5) * 0.4;
        const [px, py] = this.iso(x, y, z), glow = (Math.sin(t * 4 + f * 2) * 0.5 + 0.5) * n;
        const g = ctx.createRadialGradient(px, py, 0, px, py, 8 * k);
        g.addColorStop(0, P.firefly(glow * 0.9)); g.addColorStop(1, P.fireflyEnd);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 8 * k, 0, 7); ctx.fill();
      }
    }
    for (const c of this.scene.clouds) {
      this.groundShadow(c.x, c.y, c.s * 0.8, c.s * 0.45, P.cloudShadow);
      const [cx, cy] = this.iso(c.x, c.y, c.z), r = c.s * 15 * k;
      ctx.fillStyle = P.cloud;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.arc(cx + r * 0.75, cy - r * 0.2, r * 0.75, 0, 7); ctx.arc(cx - r * 0.65, cy - r * 0.1, r * 0.7, 0, 7); ctx.arc(cx + r * 0.3, cy - r * 0.55, r * 0.65, 0, 7); ctx.fill();
    }
    const on = (k: DistrictKey) => this.currentDistrictKey === k;
    this.drawLandmarkTag(-6.9, -6.7, 2.4, 'Sede de organizaciones', this.P.tagGreen, on('org') || on('assets'), t);
    this.drawLandmarkTag(7.4, -6.2, 2.4, 'Hub de trazabilidad', this.P.tagBlue, on('track'), t);
    this.drawLandmarkTag(0, -1.5, 3.5, 'Plaza central', this.P.tagYellow, on('home'), t);
    this.drawLandmarkTag(6.2, 1.2, 2.1, 'Barrio residencial', this.P.tagGreen, on('profile'), t);
    this.drawLandmarkTag(-7.8, 7.2, 2.2, 'Barrio escolar', this.P.tagYellow, on('explore'), t);
    this.drawLandmarkTag(2.7, 7.8, 2.0, 'Ronda del río', this.P.tagBlue, on('donations'), t);
  }

  private drawLandmarkTag(x: number, y: number, z: number, text: string, color: string, on: boolean, t: number): void {
    const ctx = this.ctx;
    const [px, py] = this.iso(x, y, z + (on ? Math.sin(t * 2.4) * 0.08 : 0));
    ctx.save();
    ctx.font = '700 11px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    const pw = ctx.measureText(text).width + 22;
    const ph = 22;
    ctx.fillStyle = on ? color : this.P.tagDarkBg;
    if (typeof (ctx as any).roundRect === 'function') {
      ctx.beginPath();
      (ctx as any).roundRect(px - pw / 2, py - ph / 2, pw, ph, 11);
      ctx.fill();
    } else {
      ctx.fillRect(px - pw / 2, py - ph / 2, pw, ph);
    }
    ctx.strokeStyle = on ? this.P.tagTextLight : this.P.tagBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = on && color === this.P.tagYellow ? this.P.tagTextDark : this.P.tagTextLight;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, px, py + 1);
    ctx.restore();
  }
}
