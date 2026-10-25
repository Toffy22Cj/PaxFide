// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F1, D-F2, D-F4 (§2.1 etiquetas); Documentos/paxfide-landing.html.
// Dibuja la escena isométrica en un canvas 2D nativo (R-F4). Colores exclusivamente en worldPalette.ts (D-P1).
// Las etiquetas genéricas del mapa (D-F4) no contienen cifras ni lugares reales.
import {
  HZ, STOPS, TH, TW, cameraFor, clamp01, cloudAt, ease, lerp, rectFade, road, smooth, stopProgress,
  type ScreenRect, type WorldCamera, type WorldScene,
} from './worldScene';
import { worldPalette, type WorldPalette } from './worldPalette';

/** Las 12 etiquetas genéricas de la landing (§2.1 de plan-fase7-fidelidad.md). */
export const LANDING_MAP_LABELS = [
  'Pasarela de pago',
  'Donar',
  'Fondo de la convocatoria',
  'Lote · QR',
  'Bodega',
  'Sublote',
  'Lote dividido',
  'Ruta de entrega',
  'Raíz anclada',
  'Anclaje en blockchain',
  'Entrega confirmada',
  'Centro comunitario',
] as const;

type Pt = [number, number];
type Box = readonly [string, string, string];
type Item = [number, () => void];

export class WorldRenderer {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private cam: WorldCamera = { x: 0, y: -1, k: 1, ox: 0, oy: 0 };
  private P: WorldPalette = worldPalette(0);
  private night = 0;
  private T = 0;
  private v = 0;
  private avoid: readonly ScreenRect[] = [];

  constructor(private readonly canvas: HTMLCanvasElement, private readonly scene: WorldScene) {
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  resize(width: number, height: number, dpr: number): void {
    this.W = width; this.H = height; this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr);
  }

  /**
   * Un fotograma: `view` es la vista del recorrido (0–5), `night` la mezcla día/noche, `t` el tiempo del mundo y `drift`
   * si hay bucle (vaivén y nubes). `avoid` son los bloques de contenido en pantalla.
   */
  draw(view: number, night: number, t: number, drift: boolean, avoid: readonly ScreenRect[] = []): void {
    const ctx = this.ctx;
    this.avoid = avoid;
    this.v = view; this.night = night; this.T = t; this.P = worldPalette(night);
    this.cam = cameraFor(view, this.W, this.H, t, drift);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.P.ground;
    ctx.fillRect(0, 0, this.W, this.H);
    this.drawGround();
    this.drawSky();
    this.drawSurface();
    const items: Item[] = [];
    this.collectObjects(items);
    this.collectScenes(items);
    items.sort((a, b) => a[0] - b[0]);
    for (const [, fn] of items) fn();
    // En el fotograma quieto (pausa o "reducir movimiento") no hay nubes: el contenido se desplaza sin repintar el
    // mundo y una nube podría quedar tras un bloque (R-F1). Con bucle, se apartan de los bloques en cada fotograma.
    if (drift) this.drawClouds();
  }

  // ---------------------------------------------------------------- proyección y primitivas

  private p(x: number, y: number, z = 0): Pt {
    const { k, x: cx, y: cy, ox, oy } = this.cam;
    return [ox + ((x - cx) - (y - cy)) * TW * k, oy + ((x - cx) + (y - cy)) * TH * k - z * HZ * k];
  }

  private visible(x: number, y: number, m = 140): boolean {
    const [a, b] = this.p(x, y);
    return a >= -m && a <= this.W + m && b >= -m && b <= this.H + m * 1.6;
  }

  private poly(pts: Pt[], fill: string, alpha?: number): void {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.fillStyle = fill; ctx.fill();
    if (alpha !== undefined) ctx.globalAlpha = 1;
  }

  private box(x: number, y: number, z: number, w: number, d: number, h: number, c: Box, al?: number): void {
    const A = this.p(x, y, z + h), B = this.p(x + w, y, z + h), C = this.p(x + w, y + d, z + h), D = this.p(x, y + d, z + h);
    const B0 = this.p(x + w, y, z), C0 = this.p(x + w, y + d, z), D0 = this.p(x, y + d, z);
    this.poly([D, C, C0, D0], c[1], al); this.poly([B, C, C0, B0], c[2], al); this.poly([A, B, C, D], c[0], al);
  }

  private face(x: number, y: number, z: number, w: number, d: number, h: number, u0: number, u1: number, v0: number, v1: number, fill: string): void {
    const X = x + w;
    this.poly([this.p(X, y + d * u0, z + h * v1), this.p(X, y + d * u1, z + h * v1), this.p(X, y + d * u1, z + h * v0), this.p(X, y + d * u0, z + h * v0)], fill);
  }

  private faceL(x: number, y: number, z: number, w: number, d: number, h: number, u0: number, u1: number, v0: number, v1: number, fill: string): void {
    const Y = y + d;
    this.poly([this.p(x + w * u0, Y, z + h * v1), this.p(x + w * u1, Y, z + h * v1), this.p(x + w * u1, Y, z + h * v0), this.p(x + w * u0, Y, z + h * v0)], fill);
  }

  private shadow(x: number, y: number, r: number, a: number): void {
    const ctx = this.ctx, [p, q] = this.p(x, y, 0);
    ctx.fillStyle = this.P.shadow(a);
    ctx.beginPath(); ctx.ellipse(p, q, r * TW * this.cam.k, r * TH * this.cam.k, 0, 0, 7); ctx.fill();
  }

  private strip(pts: readonly Pt[], hw: number, fill: string): void {
    const ctx = this.ctx, L: Pt[] = [], R: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      L.push(this.p(pts[i][0] - dy * hw, pts[i][1] + dx * hw)); R.push(this.p(pts[i][0] + dy * hw, pts[i][1] - dx * hw));
    }
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    for (const q of L) ctx.lineTo(q[0], q[1]);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath(); ctx.fill();
  }

  private dashes(pts: readonly Pt[], fill: string): void {
    for (let i = 0; i + 3 < pts.length; i += 6) {
      const a = pts[i], b = pts[i + 3];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * 0.06, ny = (dx / l) * 0.06;
      this.poly([this.p(a[0] + nx, a[1] + ny), this.p(b[0] + nx, b[1] + ny), this.p(b[0] - nx, b[1] - ny), this.p(a[0] - nx, a[1] - ny)], fill);
    }
  }

  private rr(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  private heart(px: number, py: number, s: number, fill: string): void {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(px, py); ctx.scale(s / 24, s / 24); ctx.fillStyle = fill; ctx.beginPath();
    ctx.moveTo(0, 8); ctx.bezierCurveTo(-12, 0, -11, -10, -4, -9); ctx.bezierCurveTo(-1.5, -8.6, 0, -6, 0, -5);
    ctx.bezierCurveTo(0, -6, 1.5, -8.6, 4, -9); ctx.bezierCurveTo(11, -10, 12, 0, 0, 8); ctx.fill(); ctx.restore();
  }

  private crate(x: number, y: number, z: number, s: number, qr: boolean, heart: boolean, al = 1): void {
    const ctx = this.ctx, P = this.P, h = s * 0.82;
    this.box(x, y, z, s, s, h, P.crate, al);
    if (al < 0.5) return;
    const [a, b] = this.p(x + s * 0.15, y + s * 0.5, z + h), [c, d] = this.p(x + s * 0.85, y + s * 0.5, z + h);
    ctx.strokeStyle = P.crateStrap; ctx.lineWidth = Math.max(1, s * TW * this.cam.k * 0.08);
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
    if (qr) {
      this.face(x, y, z, s, s, h, 0.25, 0.72, 0.25, 0.75, P.qrLight);
      this.face(x, y, z, s, s, h, 0.32, 0.46, 0.5, 0.68, P.ink);
      this.face(x, y, z, s, s, h, 0.52, 0.66, 0.5, 0.68, P.ink);
      this.face(x, y, z, s, s, h, 0.32, 0.46, 0.3, 0.44, P.ink);
    }
    if (heart) { const [p, q] = this.p(x + s * 0.5, y + s, z + s * 0.4); this.heart(p, q, s * TW * this.cam.k * 0.5, P.ink); }
  }

  private cube(cx: number, cy: number, z: number, s: number, c: Box, al?: number): void {
    this.box(cx - s / 2, cy - s / 2, z, s, s, s, c, al);
  }

  private coin(px: number, py: number, r: number, spin: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = this.P.coinEdge; ctx.beginPath(); ctx.ellipse(px + r * 0.08, py, Math.max(1, r * Math.abs(spin)), r, 0, 0, 7); ctx.fill();
    ctx.fillStyle = this.P.coinFace; ctx.beginPath(); ctx.ellipse(px, py, Math.max(0.6, r * Math.abs(spin) * 0.92), r * 0.92, 0, 0, 7); ctx.fill();
  }

  private lock(px: number, py: number, s: number, al: number): void {
    if (al <= 0) return;
    const ctx = this.ctx;
    ctx.globalAlpha = al; ctx.fillStyle = this.P.ink;
    this.rr(px - s * 0.55, py - s * 0.1, s * 1.1, s * 0.85, s * 0.15); ctx.fill();
    ctx.strokeStyle = this.P.ink; ctx.lineWidth = Math.max(1.5, s * 0.18);
    ctx.beginPath(); ctx.arc(px, py - s * 0.1, s * 0.32, Math.PI, 0); ctx.stroke(); ctx.globalAlpha = 1;
  }

  private get dark(): boolean { return this.night > 0.5; }

  // ---------------------------------------------------------------- suelo y cielo

  private drawGround(): void {
    const ctx = this.ctx, P = this.P, k = this.cam.k;
    for (const m of this.scene.meadows) {
      const [px, py] = this.p(m.x, m.y, 0);
      const kw = m.w * TW * k, kh = m.h * TH * k;
      if (px < -kw || px > this.W + kw || py < -kh || py > this.H + kh) continue;
      ctx.fillStyle = this.dark ? P.meadows[m.night % P.meadows.length] : P.meadows[m.day % P.meadows.length];
      ctx.beginPath(); ctx.ellipse(px, py, kw, kh, m.rot, 0, 7); ctx.fill();
    }
  }

  private drawSky(): void {
    const ctx = this.ctx, P = this.P, k = this.cam.k, W = this.W, H = this.H, n = this.night;
    const sunAlpha = clamp01(1 - n * 1.55);
    if (sunAlpha > 0.01) {
      const sx = W * 0.82, sy = H * 0.15 + n * 110, sr = Math.max(11, 15 * k);
      ctx.save();
      ctx.globalAlpha = sunAlpha * 0.35;
      const g = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 2.8);
      g.addColorStop(0, P.sunGlow); g.addColorStop(1, P.sunGlowEnd);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, sr * 2.8, 0, 7); ctx.fill();
      ctx.globalAlpha = sunAlpha; ctx.fillStyle = P.sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
      ctx.strokeStyle = P.sun; ctx.lineWidth = Math.max(1.8, 2.2 * k); ctx.lineCap = 'round';
      for (let a = 0; a < 8; a++) {
        const ang = (a * Math.PI) / 4 + this.T * 0.08;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(ang) * sr * 1.35, sy + Math.sin(ang) * sr * 1.35);
        ctx.lineTo(sx + Math.cos(ang) * sr * 1.8, sy + Math.sin(ang) * sr * 1.8);
        ctx.stroke();
      }
      ctx.restore();
    }
    const moonAlpha = clamp01((n - 0.25) / 0.75);
    if (moonAlpha > 0.01) {
      const mx = W * 0.82, my = H * 0.14 - (1 - n) * 35, mr = Math.max(12, 16 * k);
      ctx.save();
      ctx.globalAlpha = moonAlpha * 0.25;
      const g = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 2.5);
      g.addColorStop(0, P.moonGlow); g.addColorStop(1, P.moonGlowEnd);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, mr * 2.5, 0, 7); ctx.fill();
      ctx.globalAlpha = moonAlpha * 0.95; ctx.fillStyle = P.moon; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
      ctx.fillStyle = P.ground; ctx.beginPath(); ctx.arc(mx + mr * 0.45, my - mr * 0.1, mr * 0.88, 0, 7); ctx.fill();
      for (const st of this.scene.stars) {
        const al = moonAlpha * (0.35 + 0.55 * Math.sin(this.T * 3 + st.phase));
        if (al <= 0.05) continue;
        ctx.fillStyle = st.gold ? P.starGold : P.starWhite; ctx.globalAlpha = al;
        ctx.beginPath(); ctx.arc(st.x * W, st.y * H * 0.45, st.r, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawSurface(): void {
    const ctx = this.ctx, P = this.P, k = this.cam.k, s = this.scene;
    this.strip(s.riverPts, 2.5, P.riverBank);
    this.strip(s.riverPts, 2.0, P.riverWater);
    this.strip(s.riverPts, 1.3, P.riverDeep);
    if (P.riverGlint) {
      ctx.fillStyle = P.riverGlint((1 - this.night) * 0.42);
      for (let i = 2; i < s.riverPts.length - 2; i += 6) {
        const [rx, ry] = s.riverPts[i];
        const [rp, rq] = this.p(rx + Math.sin(this.T * 2 + i) * 0.35, ry, 0);
        if (rp > -20 && rp < this.W + 20 && rq > -20 && rq < this.H + 20) { ctx.beginPath(); ctx.ellipse(rp, rq, 4.5 * k, 1.2 * k, 0, 0, 7); ctx.fill(); }
      }
    }
    s.crops.forEach((cf, i) => {
      const [c1, c2] = P.crops[i % P.crops.length];
      this.poly([this.p(cf.x, cf.y), this.p(cf.x + cf.w, cf.y), this.p(cf.x + cf.w, cf.y + cf.d), this.p(cf.x, cf.y + cf.d)], c1);
      ctx.strokeStyle = c2; ctx.lineWidth = Math.max(1, 1.2 * k);
      for (let j = 0.3; j < cf.w - 0.2; j += 0.55) {
        const a = this.p(cf.x + j, cf.y + 0.1), b = this.p(cf.x + j, cf.y + cf.d - 0.1);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    });
    this.strip(s.roadPts, 0.82, P.roadBase);
    this.strip(s.roadPts, 0.68, P.roadSurface);
    this.dashes(s.roadPts, P.roadDash);
    this.strip(s.sidePts, 0.6, P.roadBase);
    this.strip(s.sidePts, 0.48, P.roadSurface);
    for (const g of s.tufts) {
      const [p, q] = this.p(g.x, g.y);
      if (p < -40 || p > this.W + 40 || q < -40 || q > this.H + 40) continue;
      if (g.type === 2) this.flower(p, q, g.s, P.flowers[g.tone % P.flowers.length]);
      else this.tuft(p, q, g.x, g.y, g.s, g.type);
    }
    if (P.firefliesVisible) {
      ctx.save();
      for (const f of s.fireflies) {
        const [p, q] = this.p(f.x + Math.sin(this.T * 1.5 + f.p) * 0.6, f.y + Math.cos(this.T * 1.2 + f.p) * 0.4, 0.4 + Math.sin(this.T * 2 + f.p) * 0.3);
        if (p < -20 || p > this.W + 20 || q < -20 || q > this.H + 20) continue;
        const glow = (Math.sin(this.T * 4 + f.p) + 1) / 2;
        ctx.globalAlpha = this.night * (0.35 + glow * 0.6); ctx.fillStyle = P.firefly;
        ctx.beginPath(); ctx.arc(p, q, Math.max(1.5, 2.5 * k), 0, 7); ctx.fill();
      }
      ctx.restore();
    }
  }

  private tuft(p: number, q: number, x: number, y: number, s: number, type: number): void {
    const ctx = this.ctx, k = this.cam.k, h = (type === 1 ? 9 : 7) * k * s, sway = Math.sin(this.T * 2.5 + x * 2 + y) * 1.5 * k;
    ctx.strokeStyle = this.P.tuft; ctx.lineWidth = Math.max(1, 1.2 * k * s); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p - 2.5 * k, q); ctx.quadraticCurveTo(p - 5 * k + sway, q - h * 0.7, p - 6 * k + sway * 1.3, q - h);
    ctx.moveTo(p, q); ctx.quadraticCurveTo(p + sway * 0.5, q - h * 0.8, p + sway, q - h * 1.2);
    ctx.moveTo(p + 2.5 * k, q); ctx.quadraticCurveTo(p + 4.5 * k + sway, q - h * 0.65, p + 6 * k + sway * 1.2, q - h * 0.95);
    ctx.stroke();
  }

  private flower(p: number, q: number, s: number, col: string): void {
    if (!this.P.flowersVisible) return;
    const ctx = this.ctx, k = this.cam.k, r = 2.4 * k * s, top = q - 5 * k * s;
    ctx.strokeStyle = this.P.flowerStem; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p, q); ctx.lineTo(p, top); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p, top, r, 0, 7); ctx.fill();
    ctx.fillStyle = this.P.flowerCenter; ctx.beginPath(); ctx.arc(p, top, r * 0.45, 0, 7); ctx.fill();
  }

  // ---------------------------------------------------------------- vegetación y fincas

  private collectObjects(items: Item[]): void {
    for (const b of this.scene.bushes) if (this.visible(b.x, b.y)) items.push([b.x + b.y, () => this.bush(b.x, b.y, b.r, b.tone)]);
    for (const t of this.scene.trees) {
      if (!this.visible(t.x, t.y)) continue;
      if (t.type === 5) items.push([t.x + t.y, () => this.palm(t.x, t.y, t.r)]);
      else items.push([t.x + t.y, () => this.tree(t.x, t.y, t.r, t.type)]);
    }
    for (const f of this.scene.fincas) if (this.visible(f.x, f.y)) items.push([f.x + f.y, () => this.finca(f.x, f.y)]);
  }

  private bush(x: number, y: number, r: number, tone: number): void {
    const ctx = this.ctx, P = this.P;
    this.shadow(x, y, r * 0.9, this.dark ? 0.25 : 0.08);
    const [p, q] = this.p(x, y), R = r * TW * this.cam.k * 0.8;
    ctx.fillStyle = P.bushes[tone % P.bushes.length]; ctx.beginPath();
    ctx.arc(p - R * 0.38, q - R * 0.45, R * 0.65, 0, 7); ctx.arc(p + R * 0.38, q - R * 0.5, R * 0.6, 0, 7); ctx.arc(p, q - R * 0.75, R * 0.72, 0, 7);
    ctx.fill();
    ctx.fillStyle = P.bushHighlight; ctx.beginPath(); ctx.arc(p - R * 0.2, q - R * 0.9, R * 0.35, 0, 7); ctx.fill();
  }

  private finca(x: number, y: number): void {
    const P = this.P;
    this.shadow(x, y, 1.1, this.dark ? 0.2 : 0.08);
    this.box(x, y, 0, 1.6, 1.2, 0.9, P.fincaWall);
    const top = 0.9, rh = 0.6, ym = y + 0.6;
    this.poly([this.p(x, y, top), this.p(x + 1.6, y, top), this.p(x + 1.6, ym, top + rh), this.p(x, ym, top + rh)], P.fincaRoof);
    this.poly([this.p(x + 1.6, y, top), this.p(x + 1.6, y + 1.2, top), this.p(x + 1.6, ym, top + rh)], P.fincaRoofSide);
    this.poly([this.p(x, ym, top + rh), this.p(x + 1.6, ym, top + rh), this.p(x + 1.6, y + 1.2, top), this.p(x, y + 1.2, top)], P.fincaRoof);
    this.faceL(x, y, 0, 1.6, 1.2, 0.9, 0.2, 0.45, 0.3, 0.65, P.fincaWindow);
  }

  private palm(x: number, y: number, r: number): void {
    const ctx = this.ctx, P = this.P, k = this.cam.k;
    this.shadow(x, y, r * 0.9, this.dark ? 0.22 : 0.08);
    const [a, b] = this.p(x, y), [, d] = this.p(x + 0.15, y + 0.1, 1.35 * r);
    ctx.strokeStyle = P.palmTrunk; ctx.lineWidth = Math.max(1.8, 0.14 * TW * k);
    ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo(a + 4 * k, (b + d) / 2, a + 3 * k, d); ctx.stroke();
    ctx.strokeStyle = P.palmLeaf; ctx.lineWidth = Math.max(1.4, 2.2 * k * r); ctx.lineCap = 'round';
    const px = a + 3 * k, py = d, len = 20 * k * r;
    for (let ang = 0; ang < 6.28; ang += 1.05) {
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + Math.cos(ang) * len * 0.6, py + Math.sin(ang) * len * 0.3 - 4 * k, px + Math.cos(ang) * len, py + Math.sin(ang) * len * 0.58 + 5 * k);
      ctx.stroke();
    }
  }

  /** Árbol frondoso (`type` 0–3) o guayacán en flor (`type` 4). */
  private tree(x: number, y: number, r: number, type: number): void {
    const ctx = this.ctx, P = this.P, k = this.cam.k;
    this.shadow(x + 0.1, y + 0.1, r * 0.95, this.dark ? 0.24 : 0.08);
    const [a, b] = this.p(x, y), [, d] = this.p(x, y, 0.55);
    ctx.strokeStyle = P.trunk; ctx.lineWidth = Math.max(1.8, 0.16 * TW * k);
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a, d); ctx.stroke();
    const [p, q] = this.p(x, y, 0.55 + r * 1.05), R = r * TW * k * 0.95;
    const bloom = type === 4;
    ctx.fillStyle = bloom ? P.bloomShade : P.trees[type % P.trees.length];
    ctx.beginPath();
    ctx.arc(p - R * 0.32, q + R * 0.08, R * 0.62, 0, 7); ctx.arc(p + R * 0.32, q + R * 0.08, R * 0.62, 0, 7); ctx.arc(p, q - R * 0.25, R * 0.82, 0, 7);
    ctx.fill();
    if (bloom) { ctx.fillStyle = P.bloom; ctx.beginPath(); ctx.arc(p - R * 0.15, q - R * 0.35, R * 0.68, 0, 7); ctx.fill(); return; }
    ctx.fillStyle = P.treeHighlight; ctx.beginPath(); ctx.arc(p - R * 0.24, q - R * 0.48, R * 0.42, 0, 7); ctx.fill();
  }

  private person(x: number, y: number, shirt: string, al: number, bob: number): void {
    if (al <= 0) return;
    const ctx = this.ctx, k = this.cam.k;
    ctx.globalAlpha = al;
    this.shadow(x, y, 0.2, this.dark ? 0.22 : 0.12);
    const [p, q] = this.p(x, y), w = 0.26 * TW * k, h = 0.7 * HZ * k;
    ctx.fillStyle = shirt; this.rr(p - w / 2, q - h - bob, w, h, w / 2); ctx.fill();
    const [, hq] = this.p(x, y, 0.92);
    ctx.fillStyle = this.P.skin; ctx.beginPath(); ctx.arc(p, hq - bob, 0.15 * TW * k, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  private truck(x: number, y: number, cargo: boolean): void {
    const ctx = this.ctx, P = this.P, k = this.cam.k;
    this.shadow(x - 0.1, y, 1.1, this.dark ? 0.26 : 0.12);
    if (P.headlights && this.night > 0.28) {
      const al = ((this.night - 0.28) / 0.72) * 0.42;
      const [h1, h2] = this.p(x + 0.98, y - 0.15, 0.4), [f1, f2] = this.p(x + 4.2, y - 1.2, 0), [f3, f4] = this.p(x + 4.2, y + 0.8, 0);
      ctx.save();
      const g = ctx.createRadialGradient(h1, h2, 4, (f1 + f3) / 2, (f2 + f4) / 2, 85 * k);
      g.addColorStop(0, P.beamNear(al * 0.95)); g.addColorStop(0.5, P.beamMid(al * 0.45)); g.addColorStop(1, P.beamEnd);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(h1, h2); ctx.lineTo(f1, f2); ctx.lineTo(f3, f4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    this.box(x - 1.05, y - 0.45, 0.22, 1.4, 0.9, 0.14, P.chassis);
    this.box(x + 0.38, y - 0.45, 0.22, 0.6, 0.9, 0.78, P.cab);
    this.faceL(x + 0.38, y - 0.45, 0.22, 0.6, 0.9, 0.78, 0.15, 0.85, 0.45, 0.85, P.cabWindow);
    for (const wx of [-0.7, 0.65]) {
      const [p, q] = this.p(x + wx, y + 0.45, 0.2);
      ctx.fillStyle = P.wheel; ctx.beginPath(); ctx.ellipse(p, q, 0.2 * TW * k, 0.21 * HZ * k, Math.atan2(TH, TW), 0, 7); ctx.fill();
    }
    if (cargo) this.crate(x - 0.95, y - 0.38, 0.36, 0.72, true, true);
  }

  /**
   * Dibuja una etiqueta del mapa con línea guía discontinua y píldora con texto (D-F4).
   * Ref: Documentos/paxfide-landing.html (drawMapLabel).
   */
  private drawMapLabel(
    anchorX: number, anchorY: number, anchorZ: number,
    labelX: number, labelY: number, labelZ: number,
    text: string,
    variant: 'default' | 'completed' | 'badge' = 'default',
    alpha = 1,
  ): void {
    if (alpha <= 0.01) return;
    const ctx = this.ctx, P = this.P, k = this.cam.k;
    const [lp, lq] = this.p(labelX, labelY, labelZ);
    const fs = Math.round(Math.max(10.5, Math.min(13.5, 9.8 * k)));
    ctx.font = `600 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
    const textW = ctx.measureText(text).width;
    const padX = fs * 1.05;
    const w = textW + padX * 2;
    const h = fs * 1.95;

    const [ap, aq] = this.p(anchorX, anchorY, anchorZ);
    ctx.save();
    ctx.globalAlpha = alpha;

    // Línea guía discontinua que une el objeto con la etiqueta
    const distGuide = Math.hypot(lp - ap, lq - aq);
    if (distGuide > 8) {
      ctx.strokeStyle = P.labelGuide;
      ctx.lineWidth = Math.max(1.2, 1.5 * k);
      ctx.setLineDash([3 * k, 2.5 * k]);
      ctx.beginPath();
      ctx.moveTo(ap, aq);
      ctx.lineTo(lp, lq + h * 0.42);
      ctx.stroke();
      ctx.setLineDash([]);

      // Punto de anclaje visible en el objeto
      ctx.fillStyle = P.labelAnchorDot;
      ctx.beginPath();
      ctx.arc(ap, aq, Math.max(2, 2.8 * k), 0, Math.PI * 2);
      ctx.fill();
    }

    let bgCol: string;
    let borderCol: string;
    let fgCol: string;

    if (variant === 'completed') {
      bgCol = P.labelCompletedBg;
      borderCol = P.labelCompletedBorder;
      fgCol = P.labelCompletedFg;
    } else if (variant === 'badge') {
      bgCol = P.labelBadgeBg;
      borderCol = P.labelBadgeBorder;
      fgCol = P.labelBadgeFg;
    } else {
      bgCol = P.labelDefaultBg;
      borderCol = P.labelDefaultBorder;
      fgCol = P.labelDefaultFg;
    }

    ctx.shadowColor = P.labelShadow;
    ctx.shadowBlur = 8 * k;
    ctx.shadowOffsetY = 2 * k;

    ctx.fillStyle = bgCol;
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = Math.max(1, 1.2 * k);

    this.rr(lp - w / 2, lq - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = fgCol;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, lp, lq + 0.5);

    ctx.restore();
  }

  // ---------------------------------------------------------------- escenas de las paradas

  private collectScenes(D: Item[]): void {
    const P = this.P, T = this.T, v = this.v, k = () => this.cam.k;
    const act = (i: number) => stopProgress(i, v);
    const soft = this.dark ? 0.22 : 0.1;

    // 0 · Donas: pasarela de pago, fondo de la convocatoria y monedas que van de uno a otro
    {
      const [sx, sy] = STOPS[0], a = act(0);
      D.push([sx - 1.4 + sy - 2.2, () => {
        this.shadow(sx - 1.2, sy - 1.5, 1, soft);
        this.box(sx - 1.5, sy - 2.3, 0, 0.32, 1.6, 2.7, P.terminal);
        this.face(sx - 1.5, sy - 2.3, 0, 0.32, 1.6, 2.7, 0.08, 0.92, 0.06, 0.94, P.terminalScreen);
        const [p, q] = this.p(sx - 1.18, sy - 1.5, 1.75); this.heart(p, q, 30 * k(), P.heart);
        this.drawMapLabel(sx - 1.18, sy - 1.5, 1.75, sx - 1.18, sy - 1.5, 3.1, 'Donar', 'completed', 1);
      }]);
      D.push([sx + 0.6 + sy - 2.3 + 0.7, () => {
        this.shadow(sx + 1.3, sy - 1.6, 1.1, soft);
        this.box(sx + 0.6, sy - 2.4, 0, 1.4, 1.4, 1.15, P.fund, 0.92);
        this.faceL(sx + 0.6, sy - 2.4, 0, 1.4, 1.4, 1.15, 0.15, 0.85, 0.35, 0.7, P.fundGlass);
        const n = 1 + Math.round(5 * a);
        for (let j = 0; j < n; j++) {
          const [p, q] = this.p(sx + 1.3, sy - 1.7, 1.15 + j * 0.09);
          this.ctx.fillStyle = j % 2 ? P.coinEdge : P.coinFace;
          this.ctx.beginPath(); this.ctx.ellipse(p, q, 0.32 * TW * k(), 0.16 * TW * k(), 0, 0, 7); this.ctx.fill();
        }
        this.drawMapLabel(sx + 1.3, sy - 1.7, 1.2, sx + 2.6, sy - 1.8, 3.1, 'Fondo de la convocatoria', 'default', a);
      }]);
      D.push([sx + sy + 1, () => {
        if (a < 0.2) return;
        for (let j = 0; j < 4; j++) {
          const qd = (T * 0.45 + j / 4) % 1;
          const x = lerp(sx - 1.1, sx + 1.3, qd), y = lerp(sy - 1.5, sy - 1.7, qd), z = lerp(1.6, 1.4, qd) + Math.sin(Math.PI * qd) * 1.1;
          const [p, q] = this.p(x, y, z);
          this.ctx.globalAlpha = a * Math.sin(Math.PI * qd); this.coin(p, q, 0.2 * TW * k(), Math.cos(T * 5 + j)); this.ctx.globalAlpha = 1;
        }
      }]);
      D.push([sx - 2.8 + sy - 2.5, () => {
        this.drawMapLabel(sx - 1.5, sy - 2.3, 0.8, sx - 3.4, sy - 2.6, 2.4, 'Pasarela de pago', 'default', 1);
      }]);
    }

    // 1 · Se convierte en ayuda: la bodega se llena de cajas con QR
    {
      const [sx, sy] = STOPS[1], a = act(1), bx = sx - 1.2, by = sy - 4.2;
      D.push([bx + by, () => {
        this.poly([this.p(bx, by), this.p(bx + 3.6, by), this.p(bx + 3.6, by + 2.6), this.p(bx, by + 2.6)], P.warehouseFloor);
        this.box(bx, by, 0, 3.6, 0.16, 2.5, P.warehouseWall);
        this.box(bx - 0.16, by, 0, 0.16, 2.6, 2.5, P.warehouseWall);
        for (const lv of [0.75, 1.55]) this.box(bx + 0.15, by + 0.2, lv, 3.3, 0.85, 0.07, P.shelf);
      }]);
      const slots: [number, number, number][] = [];
      for (const lv of [0.82, 1.62]) for (let j = 0; j < 4; j++) slots.push([bx + 0.3 + j * 0.8, by + 0.27, lv]);
      D.push([bx + by + 0.6, () => {
        slots.forEach((s, j) => {
          const p = ease.back(clamp01(a * 1.4 - j * 0.05));
          if (p > 0) this.crate(s[0], s[1], s[2] + (1 - p) * 0.8, 0.62, true, false, clamp01(p * 2));
        });
      }]);
      D.push([bx + 3.2 + by + 2.9, () => {
        this.drawMapLabel(bx + 1.8, by + 1.2, 1.8, bx + 1.8, by + 1.2, 3.4, 'Lote · QR', 'default', a);
      }]);
      D.push([bx + 3.8 + by + 2.8, () => {
        this.drawMapLabel(bx + 1.8, by + 1.2, 0, bx + 3.8, by + 2.8, 2.2, 'Bodega', 'default', 1);
      }]);
    }

    // 2 · Viaja y se reparte: una caja se divide en dos y cada parte sigue su camino
    {
      const [sx, sy] = STOPS[2], a = act(2), px = sx - 1.4, py = sy - 3;
      D.push([px + py, () => this.box(px - 0.1, py - 0.1, 0, 1.9, 1.3, 0.14, P.shelf)]);
      D.push([px + py + 1, () => {
        const sp = ease.inOut(smooth(0.25, 0.85, a));
        this.crate(px, py, 0.14, 1.0, true, true);
        this.crate(px + 1.0 * sp + 0.05, py + 0.15 + sp * 1.6, 0.14, 0.78, true, false, clamp01(sp * 3));
        if (sp > 0.5) {
          this.drawMapLabel(px + 0.5, py + 0.5, 0.14, px + 0.5, py + 0.5, 1.35, 'Sublote', 'default', 1);
        }
        if (sp > 0.05) {
          this.drawMapLabel(px + 1.0 * sp + 0.45, py + 0.55 + sp * 1.6, 0.14, px + 1.0 * sp + 0.45, py + 0.55 + sp * 1.6, 1.15, 'Sublote', 'badge', clamp01(sp * 2));
        }
        if (sp > 0.5) {
          this.drawMapLabel(px + 0.5, py + 0.5, 0.4, px + 0.4, py + 0.5, 2.35, 'Lote dividido', 'default', clamp01((sp - 0.5) * 3));
        }
      }]);
      D.push([sx + 3.6 + sy + 2.8, () => {
        this.drawMapLabel(sx + 1.8, sy + 1.4, 0, sx + 3.6, sy + 2.8, 1.8, 'Ruta de entrega', 'default', 1);
      }]);
    }

    // 3 · Queda sellado: la cadena de bloques se ilumina y el árbol de huellas sube hasta la raíz anclada
    {
      const [sx, sy] = STOPS[3], a = act(3), cx = sx - 0.2, cy = sy - 2.4;
      D.push([cx + cy - 1, () => {
        const n = 7;
        for (let j = 0; j < n; j++) {
          const x = sx - 4.6 + j * 0.62, y = sy - 1.25, lit = clamp01(a * 1.6 - j * 0.08), pulse = ((Math.sin(T * 3 - j * 0.9) + 1) / 2) * 0.35;
          this.cube(x, y, 0, 0.34, lit > 0 ? P.chainLit : P.chainOff, 0.5 + lit * 0.5);
          if (lit > 0 && j < n - 1) {
            const [p, q] = this.p(x + 0.17, y, 0.17), [r, s2] = this.p(x + 0.45, y, 0.17);
            this.ctx.strokeStyle = P.chainLink((this.dark ? 0.6 : 0.4) + pulse);
            this.ctx.lineWidth = 2.2; this.ctx.setLineDash([3, 3]);
            this.ctx.beginPath(); this.ctx.moveTo(p, q); this.ctx.lineTo(r, s2); this.ctx.stroke(); this.ctx.setLineDash([]);
          }
        }
        this.box(cx - 1, cy - 1, 0, 2, 2, 0.45, P.chainOff);
      }]);
      D.push([cx + cy + 2, () => {
        const L = [-1.05, -0.35, 0.35, 1.05].map((dx) => [cx + dx, cy, 1.55] as const);
        const M = [[cx - 0.7, cy, 2.75], [cx + 0.7, cy, 2.75]] as const, R = [cx, cy, 3.95] as const;
        const pl = smooth(0.05, 0.4, a), pm = smooth(0.35, 0.65, a), pr = smooth(0.6, 0.85, a), pb = smooth(0.8, 1, a);
        const line = (A: readonly number[], B: readonly number[], al: number) => {
          if (al <= 0) return;
          const [p, q] = this.p(A[0], A[1], A[2] + 0.2), [r, s2] = this.p(B[0], B[1], B[2] + 0.2);
          this.ctx.strokeStyle = P.merkleLine((this.dark ? 0.85 : 0.7) * al); this.ctx.lineWidth = Math.max(1.5, 2.4 * k());
          this.ctx.beginPath(); this.ctx.moveTo(p, q); this.ctx.lineTo(r, s2); this.ctx.stroke();
        };
        if (pb > 0) {
          const [p, q] = this.p(R[0], R[1], R[2] + 0.4);
          const g = this.ctx.createLinearGradient(0, q, 0, 0);
          g.addColorStop(0, P.anchorBeam((this.dark ? 0.6 : 0.45) * pb)); g.addColorStop(1, P.anchorBeamEnd);
          const bw = 24 * k(); this.ctx.fillStyle = g; this.ctx.fillRect(p - bw / 2, 0, bw, q);
        }
        L.forEach((l, j) => line(l, M[j >> 1], pm));
        M.forEach((m) => line(m, R, pr));
        L.forEach((l, j) => { const p = ease.back(clamp01(pl * 1.3 - j * 0.08)); if (p > 0) this.cube(l[0], l[1], l[2] + (1 - p) * 0.6, 0.36, P.chainLit, clamp01(p * 2)); });
        M.forEach((m) => { const p = ease.back(pm); if (p > 0) this.cube(m[0], m[1], m[2] + (1 - p) * 0.6, 0.44, P.chainLit, clamp01(p * 2)); });
        const p = ease.back(pr);
        if (p > 0) {
          this.cube(R[0], R[1], R[2] + (1 - p) * 0.6, 0.6, P.anchorGold, clamp01(p * 2));
          const [q1, q2] = this.p(R[0] + 0.3, R[1] + 0.3, R[2] + 0.3);
          this.lock(q1, q2, 14 * k() * Math.max(0.5, p), smooth(0.85, 1, a));
        }
      }]);
      D.push([cx + cy + 5.3, () => {
        const pb = smooth(0.8, 1, a);
        this.drawMapLabel(cx, cy, 3.95, cx, cy, 5.3, 'Raíz anclada', 'default', pb);
      }]);
      D.push([cx + 2.4 + cy + 2.0, () => {
        this.drawMapLabel(cx, cy, 0.45, cx + 2.4, cy + 2.0, 2.6, 'Anclaje en blockchain', 'default', 1);
      }]);
    }

    // 4 · Llega: la caja entra al centro comunitario, la gente se acerca y aparece la marca de entregado
    {
      const [sx, sy] = STOPS[4], a = act(4), hx = sx - 1.2, hy = sy - 4.1;
      D.push([hx + hy + 1, () => {
        this.shadow(hx + 1.4, hy + 1.2, 2, this.dark ? 0.22 : 0.08);
        this.box(hx, hy, 0, 2.8, 2.1, 1.5, P.house);
        const top = 1.5, rh = 0.9, ym = hy + 1.05;
        this.poly([this.p(hx, hy, top), this.p(hx + 2.8, hy, top), this.p(hx + 2.8, ym, top + rh), this.p(hx, ym, top + rh)], P.houseRoof);
        this.poly([this.p(hx + 2.8, hy, top), this.p(hx + 2.8, hy + 2.1, top), this.p(hx + 2.8, ym, top + rh)], P.houseRoofSide);
        this.poly([this.p(hx, ym, top + rh), this.p(hx + 2.8, ym, top + rh), this.p(hx + 2.8, hy + 2.1, top), this.p(hx, hy + 2.1, top)], P.houseRoofBack);
        this.faceL(hx, hy, 0, 2.8, 2.1, 1.5, 0.38, 0.6, 0, 0.62, P.door);
        this.faceL(hx, hy, 0, 2.8, 2.1, 1.5, 0.1, 0.28, 0.4, 0.72, P.houseWindow);
        this.faceL(hx, hy, 0, 2.8, 2.1, 1.5, 0.7, 0.88, 0.4, 0.72, P.houseWindow);
        this.face(hx, hy, 0, 2.8, 2.1, 1.5, 0.2, 0.45, 0.4, 0.72, P.houseWindow);
        this.face(hx, hy, 0, 2.8, 2.1, 1.5, 0.6, 0.85, 0.4, 0.72, P.houseWindow);
      }]);
      D.push([hx + hy + 3.2, () => {
        const st = smooth(0.3, 0.75, a);
        this.crate(hx + 0.2, hy + 2.35, 0, 0.7, true, true);
        if (st > 0) this.crate(lerp(sx - 0.95, hx + 0.2, st), lerp(sy - 0.23, hy + 2.35, st), 0.7 * st + Math.sin(Math.PI * st) * 0.6, 0.7, true, true);
      }]);
      const people: [number, number][] = [[hx + 1.4, hy + 2.7], [hx + 2.05, hy + 2.55], [hx + 1.75, hy + 3.2], [hx + 2.6, hy + 3.0], [hx + 0.95, hy + 3.35]];
      D.push([hx + hy + 5.6, () => {
        people.forEach(([x, y], j) => this.person(x, y, P.shirts[j % P.shirts.length], clamp01(a * 1.6 - j * 0.12),
          Math.abs(Math.sin(T * 2.2 + j)) * 2 * k() * smooth(0.7, 1, a)));
      }]);
      D.push([hx + hy + 6, () => {
        const p = ease.back(smooth(0.6, 0.9, a));
        if (p <= 0) return;
        const ctx = this.ctx, [q1, q2] = this.p(hx + 1.4, hy + 1.05, 4.2), r = 16 * k() * p;
        ctx.fillStyle = P.check; ctx.beginPath(); ctx.arc(q1, q2, r, 0, 7); ctx.fill();
        ctx.strokeStyle = P.checkMark; ctx.lineWidth = Math.max(2, 3 * k() * p); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(q1 - r * 0.4, q2); ctx.lineTo(q1 - r * 0.1, q2 + r * 0.32); ctx.lineTo(q1 + r * 0.42, q2 - r * 0.3); ctx.stroke();
      }]);
      D.push([hx + 1.4 + hy + 1.05 + 5.1, () => {
        const p = ease.back(smooth(0.6, 0.9, a));
        this.drawMapLabel(hx + 1.4, hy + 1.05, 2.4, hx + 1.4, hy + 1.05, 5.1, 'Entrega confirmada', 'completed', clamp01(p));
      }]);
      D.push([hx + 3.4 + hy + 3.0, () => {
        this.drawMapLabel(hx + 1.4, hy + 2.1, 0, hx + 3.4, hy + 3.0, 2.2, 'Centro comunitario', 'default', 1);
      }]);
    }

    // El camión que recorre la ruta: guiado por el scroll en las paradas; en el panorama, va y viene solo
    if (v >= 4.4) {
      const [tx, ty] = road(0.85 + ((T * 0.16) % 3.15));
      const bounce = Math.sin(T * 8) * 0.025;
      D.push([tx + ty, () => this.truck(tx, ty + 0.15 + bounce, true)]);
      const [mx, my] = road(1.1 + ((T * 0.26 + 1.6) % 2.7));
      D.push([mx + my + 0.1, () => {
        this.shadow(mx, my, 0.45, soft);
        this.box(mx - 0.25, my - 0.15, 0.15, 0.5, 0.35, 0.3, P.moto);
        this.crate(mx - 0.15, my - 0.1, 0.45, 0.32, false, false);
        const [p, q] = this.p(mx, my, 0.7);
        this.ctx.fillStyle = P.motoLight; this.ctx.beginPath(); this.ctx.arc(p + 4 * k(), q, 3 * k(), 0, 7); this.ctx.fill();
      }]);
      for (let j = 0; j < 3; j++) {
        const qd = (T * 0.32 + j / 3) % 1;
        const [cx, cy] = road(0.85 + qd * 3.1), cz = 0.55 + Math.sin(Math.PI * qd) * 0.85;
        D.push([cx + cy + 0.3, () => {
          const [p, q] = this.p(cx, cy, cz);
          this.ctx.globalAlpha = 0.85 * Math.sin(Math.PI * qd);
          this.shadow(cx, cy, 0.28, this.dark ? 0.2 : 0.08);
          this.coin(p, q, 0.3 * TW * k(), Math.cos(T * 5 + j * 2));
          this.ctx.globalAlpha = 1;
        }]);
      }
      return;
    }
    if (v > 0.12 && v < 0.98) {
      const [x, y] = road(v), al = smooth(0.12, 0.3, v) * (1 - smooth(0.85, 0.98, v));
      D.push([x + y + 0.5, () => {
        const [p, q] = this.p(x, y, 0.75 + Math.sin(T * 3) * 0.08);
        this.ctx.globalAlpha = al; this.shadow(x, y, 0.35, this.dark ? 0.22 : 0.12);
        this.coin(p, q, 0.42 * TW * k(), Math.cos(v * 24)); this.ctx.globalAlpha = 1;
      }]);
    }
    const [x, y] = road(Math.min(4, Math.max(1, v)));
    const delivered = v > 3.5 && smooth(0.3, 0.75, act(4)) > 0.02;
    D.push([x + y, () => this.truck(x, y + 0.15, !delivered)]);
  }

  // ---------------------------------------------------------------- nubes (con sombra en el suelo)

  private drawClouds(): void {
    const ctx = this.ctx, P = this.P, k = this.cam.k;
    // Las nubes se apartan de las escenas de las paradas y del haz del sello, para no taparlas
    const focus = [
      { x: STOPS[0][0], y: STOPS[0][1] - 1.5, z: 1.5, r: 52 }, { x: STOPS[1][0] + 0.6, y: STOPS[1][1] - 3, z: 1.5, r: 62 },
      { x: STOPS[2][0] - 0.9, y: STOPS[2][1] - 2.5, z: 1.0, r: 52 }, { x: STOPS[3][0] - 0.2, y: STOPS[3][1] - 2.4, z: 2.2, r: 68 },
      { x: STOPS[4][0] + 0.2, y: STOPS[4][1] - 3.05, z: 2.0, r: 68 },
    ];
    const [beamX, beamY] = this.p(STOPS[3][0] - 0.2, STOPS[3][1] - 2.4, 3.95), beamW = 26 * k;
    const fade = (cx: number, cy: number, cz: number, s: number) => {
      const [cp, cq] = this.p(cx, cy, cz), cRad = TW * k * s * 1.5;
      let f = 1;
      if (cq < beamY + 30) f = clamp01((Math.abs(cp - beamX) - (beamW * 0.6 + 24)) / Math.max(1, cRad * 0.82));
      for (const o of focus) {
        const [op, oq] = this.p(o.x, o.y, o.z);
        f = Math.min(f, clamp01((Math.hypot(cp - op, cq - oq) - o.r * k) / Math.max(1, cRad * 0.85)));
      }
      // R-F1: ni la nube ni su sombra se traslucen por los bloques de contenido
      const [sp, sq] = this.p(cx + cz * 0.26, cy + cz * 0.26, 0);
      return Math.min(f, rectFade(cp, cq, cRad, this.avoid), rectFade(sp, sq, cRad, this.avoid));
    };
    const placed = this.scene.clouds.map((c) => { const [cx, cy] = cloudAt(c, this.T); return { c, cx, cy, f: fade(cx, cy, c.z, c.s) }; })
      .filter((o) => o.f > 0.005);
    for (const { c, cx, cy, f } of placed) {
      const [sp, sq] = this.p(cx + c.z * 0.26, cy + c.z * 0.26, 0);
      if (sp < -240 || sp > this.W + 240 || sq < -240 || sq > this.H + 240) continue;
      const kw = TW * k * c.s, kh = TH * k * c.s;
      ctx.fillStyle = P.cloudShadow((this.dark ? 0.07 : 0.13) * f);
      ctx.beginPath();
      for (const pf of c.puffs) { const r = pf.r * kw * 0.72; ctx.ellipse(sp + pf.dx * kw * 0.85, sq + pf.dy * kh * 1.05, r * 1.12, r * 0.56, 0, 0, 7); }
      ctx.fill();
    }
    for (const { c, cx, cy, f } of placed) {
      const [cp, cq] = this.p(cx, cy, c.z);
      if (cp < -240 || cp > this.W + 240 || cq < -240 || cq > this.H + 240) continue;
      const kw = TW * k * c.s, kh = TH * k * c.s;
      ctx.save(); ctx.globalAlpha = P.cloudAlpha * f;
      const layer = (col: string, dx: (r: number) => number, dy: (r: number) => number, rad: number) => {
        ctx.fillStyle = col; ctx.beginPath();
        for (const pf of c.puffs) { ctx.moveTo(cp + pf.dx * kw * 0.85 + dx(pf.r) + pf.r * kw * rad, cq + pf.dy * kh * 1.05 + dy(pf.r)); ctx.arc(cp + pf.dx * kw * 0.85 + dx(pf.r), cq + pf.dy * kh * 1.05 + dy(pf.r), pf.r * kw * rad, 0, 7); }
        ctx.fill();
      };
      layer(P.cloudBase, () => 0, (r) => r * kw * 0.16, 0.74);
      layer(P.cloudBody, () => 0, () => 0, 0.72);
      layer(P.cloudHighlight, (r) => r * kw * 0.05, (r) => -r * kw * 0.12, 0.56);
      ctx.restore();
    }
  }
}
