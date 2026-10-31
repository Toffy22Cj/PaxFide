import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Ref: sistema-visual-paxfide-web.md §2–§3 y Anexo A; sistema-visual-paxfide-web-enmienda-1.md §3.2, §4.2–§4.4, §5,
// §6, §7 y Anexo A (con la fe de erratas FE-1).

// Helper functions for WCAG 2.x relative luminance and contrast
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(hex1: string, hex2: string): number {
  const lum1 = luminance(hex1);
  const lum2 = luminance(hex2);
  const lightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (lightest + 0.05) / (darkest + 0.05);
}

/** `blend` del Anexo A de la enmienda: color sólido de una capa translúcida sobre otra. */
function blend(fg: string, alpha: number, bg: string): string {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return '#' + f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const tokens: Record<string, string> = {
  'brand-green-900': '#1B5141',
  'brand-green-800': '#20604C',
  'brand-green-500': '#4E9155',
  'brand-blue-500': '#3688B0',
  'brand-yellow-400': '#F3B544',
  'brand-neutral-700': '#405656',
  'white': '#FFFFFF',
  'brand-blue-700': '#327DA2',
  'brand-blue-800': '#255E79',
  'brand-yellow-900': '#785008',
  'brand-yellow-50': '#FDF4E2',
  'brand-green-50': '#EEF6EF',
  'brand-blue-50': '#EBF5F9',
  'danger-700': '#B42318',
  'danger-50': '#FEF3F2',
  'neutral-50': '#F8FAFA',
  'neutral-100': '#F0F4F4',
  'neutral-200': '#E2E9E9',
  'neutral-400': '#739797',
  // Enmienda §5 (E3) y §3.2 (E1)
  'brand-green-700': '#297A62',
  'brand-ground': '#DCE8D6',
  // Enmienda §4.2 (E2)
  'dark-ground': '#07130E',
  'dark-bg': '#0E1B16',
  'dark-surface': '#132C22',
  'dark-surface-raised': '#192F26',
  'dark-field': '#0F261D',
  'dark-text': '#EEF6EF',
  'dark-text-secondary': '#B9C6BE',
  'dark-border-control': '#76847D',
  'dark-divider': '#2F453D',
  'dark-action': '#20604C',
  'dark-on-action': '#FFFFFF',
  'dark-link': '#8CC3DE',
  'dark-focus': '#8CD39A',
  'dark-accent-yellow': '#F3B544',
  'dark-ambiguous-bg': '#323F27',
  'dark-ambiguous-text': '#F8CF7E',
  'dark-info-bg': '#193B39',
  'dark-info-text': '#BFE0F0',
  'dark-success-bg': '#214430',
  'dark-success-text': '#A9E6B0',
  'dark-danger-bg': '#332A20',
  'dark-danger-text': '#FCA5A5',
};

/** Tokens de la revisión 1 que la enmienda retira: no pueden seguir en el archivo. */
const RETIRED = ['dark-green-300', 'dark-blue-300', 'dark-green-950', 'dark-blue-950', 'dark-yellow-950', 'dark-danger-950', 'dark-danger-300'];

const pairs = [
  { fg: 'brand-green-900', bg: 'white', min: 4.5, val: 9.13 },
  { fg: 'brand-neutral-700', bg: 'white', min: 4.5, val: 7.83 },
  { fg: 'brand-green-800', bg: 'white', min: 4.5, val: 7.40 },
  { fg: 'brand-blue-800', bg: 'white', min: 4.5, val: 7.10 },
  { fg: 'brand-blue-700', bg: 'white', min: 4.5, val: 4.57 },
  { fg: 'brand-blue-500', bg: 'white', min: 3.0, val: 3.96 }, // Only big text
  { fg: 'brand-green-500', bg: 'white', min: 3.0, val: 3.81 }, // Only big text
  { fg: 'brand-green-900', bg: 'brand-yellow-400', min: 4.5, val: 5.00 },
  { fg: 'brand-green-900', bg: 'brand-yellow-50', min: 4.5, val: 8.35 },
  { fg: 'brand-yellow-900', bg: 'brand-yellow-50', min: 4.5, val: 6.51 },
  { fg: 'brand-green-900', bg: 'brand-green-50', min: 4.5, val: 8.29 },
  { fg: 'brand-neutral-700', bg: 'brand-green-50', min: 4.5, val: 7.10 },
  { fg: 'brand-blue-800', bg: 'brand-blue-50', min: 4.5, val: 6.41 },
  { fg: 'danger-700', bg: 'danger-50', min: 4.5, val: 6.05 },
  { fg: 'danger-700', bg: 'white', min: 4.5, val: 6.57 },
  { fg: 'brand-green-900', bg: 'neutral-50', min: 4.5, val: 8.72 },
  { fg: 'brand-neutral-700', bg: 'neutral-50', min: 4.5, val: 7.47 },
  { fg: 'brand-neutral-700', bg: 'neutral-100', min: 4.5, val: 7.06 },
  { fg: 'brand-green-900', bg: 'neutral-100', min: 4.5, val: 8.24 },
  { fg: 'brand-blue-800', bg: 'neutral-50', min: 4.5, val: 6.78 },
  { fg: 'neutral-400', bg: 'white', min: 3.0, val: 3.18 },
  { fg: 'neutral-400', bg: 'neutral-50', min: 3.0, val: 3.04 },
  { fg: 'danger-700', bg: 'neutral-50', min: 4.5, val: 6.28 },
  // Enmienda §5 (claro) y §3.2 (E1, de referencia: nada va directamente sobre el fondo animado)
  { fg: 'brand-blue-800', bg: 'brand-green-50', min: 4.5, val: 6.45 },
  { fg: 'white', bg: 'brand-green-700', min: 4.5, val: 5.18 },
  { fg: 'brand-green-900', bg: 'brand-ground', min: 4.5, val: 7.20 },
  { fg: 'brand-neutral-700', bg: 'brand-ground', min: 4.5, val: 6.17 },
  // Enmienda §4.3 (oscuro)
  { fg: 'dark-text', bg: 'dark-bg', min: 4.5, val: 16.06 },
  { fg: 'dark-text', bg: 'dark-surface', min: 4.5, val: 13.51 },
  { fg: 'dark-text', bg: 'dark-surface-raised', min: 4.5, val: 12.92 },
  { fg: 'dark-text', bg: 'dark-field', min: 4.5, val: 14.49 },
  { fg: 'dark-text-secondary', bg: 'dark-bg', min: 4.5, val: 10.01 },
  { fg: 'dark-text-secondary', bg: 'dark-surface', min: 4.5, val: 8.42 },
  { fg: 'dark-text-secondary', bg: 'dark-surface-raised', min: 4.5, val: 8.05 },
  { fg: 'dark-text-secondary', bg: 'dark-field', min: 4.5, val: 9.04 },
  { fg: 'dark-link', bg: 'dark-bg', min: 4.5, val: 9.25 },
  { fg: 'dark-link', bg: 'dark-surface', min: 4.5, val: 7.78 },
  { fg: 'dark-link', bg: 'dark-surface-raised', min: 4.5, val: 7.44 },
  { fg: 'dark-on-action', bg: 'dark-action', min: 4.5, val: 7.40 },
  { fg: 'dark-border-control', bg: 'dark-bg', min: 3.0, val: 4.52 },
  { fg: 'dark-border-control', bg: 'dark-surface', min: 3.0, val: 3.80 },
  { fg: 'dark-border-control', bg: 'dark-field', min: 3.0, val: 4.08 },
  { fg: 'dark-focus', bg: 'dark-bg', min: 3.0, val: 10.02 },
  { fg: 'dark-focus', bg: 'dark-surface', min: 3.0, val: 8.43 },
  { fg: 'dark-focus', bg: 'dark-surface-raised', min: 3.0, val: 8.06 },
  { fg: 'dark-focus', bg: 'dark-action', min: 3.0, val: 4.19 },
  { fg: 'dark-accent-yellow', bg: 'dark-surface', min: 3.0, val: 8.15 }, // FE-1
  { fg: 'dark-ambiguous-text', bg: 'dark-ambiguous-bg', min: 4.5, val: 7.58 },
  { fg: 'dark-info-text', bg: 'dark-info-bg', min: 4.5, val: 8.77 },
  { fg: 'dark-success-text', bg: 'dark-success-bg', min: 4.5, val: 7.57 },
  { fg: 'dark-danger-text', bg: 'dark-danger-bg', min: 4.5, val: 7.41 },
  { fg: 'dark-text', bg: 'dark-success-bg', min: 4.5, val: 9.86 },
  { fg: 'dark-text', bg: 'dark-ambiguous-bg', min: 4.5, val: 10.16 },
  { fg: 'dark-text', bg: 'dark-info-bg', min: 4.5, val: 11.05 },
  { fg: 'dark-text', bg: 'dark-danger-bg', min: 4.5, val: 12.77 },
];

describe('Design Tokens & Contrast', () => {
  it('validates the reference formula against known values', () => {
    expect(contrast(tokens['brand-green-900'], tokens['white'])).toBeCloseTo(9.13, 2);
    expect(contrast(tokens['brand-green-900'], tokens['brand-yellow-50'])).toBeCloseTo(8.35, 2);
    expect(contrast(tokens['brand-blue-700'], tokens['white'])).toBeCloseTo(4.57, 2);
  });

  it('los tokens oscuros de estado son los del Anexo A de la enmienda (blend sobre dark-surface)', () => {
    const S = tokens['dark-surface'];
    expect(blend('#EEF6EF', 0.76, S)).toBe(tokens['dark-text-secondary']);
    expect(blend('#F3B544', 0.14, S)).toBe(tokens['dark-ambiguous-bg']);
    expect(blend('#3688B0', 0.16, S)).toBe(tokens['dark-info-bg']);
    expect(blend('#6DBF7A', 0.16, S)).toBe(tokens['dark-success-bg']);
    expect(blend('#B42318', 0.20, S)).toBe(tokens['dark-danger-bg']);
  });

  pairs.forEach(({ fg, bg, min, val }) => {
    it(`ensures ${fg} over ${bg} reaches ${min}:1 (expected ~${val})`, () => {
      const cr = contrast(tokens[fg], tokens[bg]);
      expect(cr).toBeGreaterThanOrEqual(min);
      expect(cr).toBeCloseTo(val, 2);
    });
  });

  describe('Peor caso de R-F1 (enmienda §3.3, §4.3, §5 y Anexo A)', () => {
    const UNDER = ['#FFFFFF', '#000000', '#F3B544', '#07130E', '#DCE8D6'];
    const darkCard = (under: string) => blend('#10261D', 0.86, under); // rgba(16,38,29,.86)
    const lightCard = (under: string) => blend('#FFFFFF', 0.88, under); // rgba(255,255,255,.88)

    it('dark-text sobre la tarjeta oscura translúcida: ≥ 9,42 con los cinco fondos (mínimo 9,42, máximo 15,25)', () => {
      const values = UNDER.map((u) => contrast(tokens['dark-text'], darkCard(u)));
      values.forEach((v) => expect(v).toBeGreaterThanOrEqual(9.42 - 0.005));
      expect(Math.min(...values)).toBeCloseTo(9.42, 2);
      expect(Math.max(...values)).toBeCloseTo(15.25, 2);
    });

    it('brand-green-900 sobre la tarjeta clara translúcida: ≥ 6,92 con los cinco fondos', () => {
      const values = UNDER.map((u) => contrast(tokens['brand-green-900'], lightCard(u)));
      values.forEach((v) => expect(v).toBeGreaterThanOrEqual(6.92 - 0.005));
      expect(Math.min(...values)).toBeCloseTo(6.92, 2);
    });

    it('brand-neutral-700 sobre la tarjeta clara translúcida: ≥ 5,93 con los cinco fondos', () => {
      const values = UNDER.map((u) => contrast(tokens['brand-neutral-700'], lightCard(u)));
      values.forEach((v) => expect(v).toBeGreaterThanOrEqual(5.93 - 0.005));
      expect(Math.min(...values)).toBeCloseTo(5.93, 2);
    });

    it('dark-text-secondary sobre la tarjeta oscura translúcida sigue ≥ 4,5 con los cinco fondos', () => {
      UNDER.forEach((u) => expect(contrast(tokens['dark-text-secondary'], darkCard(u))).toBeGreaterThanOrEqual(4.5));
    });
  });

  /**
   * U-17 (plan-fase7-puesta-al-dia.md A2.1): 0,82 en claro y en oscuro. Peor caso con la fórmula del Anexo A (blend) sobre
   * blanco, negro, amarillo de marca y las dos bases, con el texto principal y el secundario. Falla si baja de 4,5.
   * Los 0,88 / 0,86 de arriba siguen valiendo para el respaldo sin backdrop-filter.
   */
  describe('Peor caso de R-F1 enmendado por U-17 (0,82)', () => {
    const UNDER = ['#FFFFFF', '#000000', '#F3B544', '#07130E', '#DCE8D6'];
    const ALPHA = 0.82;
    const worst = (fg: string, card: string) => Math.min(...UNDER.map((u) => contrast(fg, blend(card, ALPHA, u))));

    it('oscuro: texto principal y secundario ≥ 4,5; el mínimo es 5,09 (dark-text-secondary)', () => {
      const text = worst(tokens['dark-text'], '#10261D');
      const secondary = worst(tokens['dark-text-secondary'], '#10261D');
      expect(text).toBeGreaterThanOrEqual(4.5);
      expect(secondary).toBeGreaterThanOrEqual(4.5);
      expect(Math.min(text, secondary)).toBeCloseTo(5.09, 2);
    });

    it('claro: texto principal y secundario ≥ 4,5; el mínimo es 5,12 (brand-neutral-700; la tabla de A2.1 lo redondea a 5,13)', () => {
      const text = worst(tokens['brand-green-900'], '#FFFFFF');
      const secondary = worst(tokens['brand-neutral-700'], '#FFFFFF');
      expect(text).toBeGreaterThanOrEqual(4.5);
      expect(secondary).toBeGreaterThanOrEqual(4.5);
      expect(Math.min(text, secondary)).toBeCloseTo(5.12, 2);
    });

    it('negativa: con 0,75 el claro ya no cumple con todos los fondos (por eso no se baja más)', () => {
      const at = (a: number) => Math.min(...UNDER.map((u) => contrast(tokens['brand-neutral-700'], blend('#FFFFFF', a, u))));
      expect(at(0.75)).toBeLessThan(4.5);
    });
  });

  describe('Restricciones negativas (W-7)', () => {
    it('brand-blue-700 sobre neutral-50 no cumple 4.5:1', () => {
      const cr = contrast(tokens['brand-blue-700'], tokens['neutral-50']);
      expect(cr).toBeLessThan(4.5);
      expect(cr).toBeCloseTo(4.37, 2);
    });

    it('neutral-400 sobre neutral-100 no cumple 3:1', () => {
      const cr = contrast(tokens['neutral-400'], tokens['neutral-100']);
      expect(cr).toBeLessThan(3.0);
      expect(cr).toBeCloseTo(2.87, 2);
    });
  });

  describe('Restricciones negativas de la enmienda (§4.3, §4.4, §5)', () => {
    const negatives: Array<{ name: string; fg: string; bg: string; max: number; val: number }> = [
      { name: 'texto blanco sobre brand-green-500 (§4.4, §5)', fg: tokens['white'], bg: tokens['brand-green-500'], max: 4.5, val: 3.81 },
      { name: 'texto blanco sobre brand-blue-500 (§4.4)', fg: tokens['white'], bg: tokens['brand-blue-500'], max: 4.5, val: 3.96 },
      { name: '#0D2119 sobre brand-green-500 (§4.4)', fg: '#0D2119', bg: tokens['brand-green-500'], max: 4.5, val: 4.41 },
      { name: 'dark-divider sobre dark-surface: solo decorativo (§4.4)', fg: tokens['dark-divider'], bg: tokens['dark-surface'], max: 3.0, val: 1.45 },
      { name: 'dark-border-control como texto normal sobre dark-surface (§4.4)', fg: tokens['dark-border-control'], bg: tokens['dark-surface'], max: 4.5, val: 3.80 },
      { name: 'dark-action sobre dark-surface: no es indicador por sí solo (§4.3)', fg: tokens['dark-action'], bg: tokens['dark-surface'], max: 3.0, val: 2.01 },
      { name: 'neutral-400 sobre brand-ground (§3.2, §4.4, §5)', fg: tokens['neutral-400'], bg: tokens['brand-ground'], max: 3.0, val: 2.51 },
      { name: 'neutral-400 sobre brand-green-50 (§5)', fg: tokens['neutral-400'], bg: tokens['brand-green-50'], max: 3.0, val: 2.89 },
      { name: 'brand-blue-700 sobre brand-green-50 (§5)', fg: tokens['brand-blue-700'], bg: tokens['brand-green-50'], max: 4.5, val: 4.15 },
      { name: 'amarillo como foco: brand-yellow-400 sobre blanco (§1.5)', fg: tokens['brand-yellow-400'], bg: tokens['white'], max: 3.0, val: 1.83 },
    ];
    negatives.forEach(({ name, fg, bg, max, val }) => {
      it(`no cumple: ${name}`, () => {
        const cr = contrast(fg, bg);
        expect(cr).toBeLessThan(max);
        expect(cr).toBeCloseTo(val, 2);
      });
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// El archivo de tokens (globals.css) es la única fuente: sus valores deben coincidir con la tabla de arriba
// ---------------------------------------------------------------------------------------------------------------
const TOKENS_FILE = path.resolve(__dirname, '../src/app/globals.css');
const tokensCss = fs.readFileSync(TOKENS_FILE, 'utf-8');

function declarations(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** Declaraciones del n-ésimo bloque (desde 0) cuyo selector es exactamente `selector`. */
function block(selector: string, nth = 0): Record<string, string> {
  let start = -1;
  for (let i = 0; i <= nth; i++) start = tokensCss.indexOf(selector + ' {', start + 1);
  expect(start, `No existe el bloque ${selector} (#${nth})`).toBeGreaterThanOrEqual(0);
  const open = tokensCss.indexOf('{', start);
  return declarations(tokensCss.slice(open + 1, tokensCss.indexOf('}', open)));
}

const SEMANTIC = [
  'color-bg', 'color-ground', 'color-surface', 'color-surface-raised', 'color-surface-translucent', 'color-field',
  'color-text', 'color-text-secondary', 'color-border-control', 'color-divider', 'color-action', 'color-on-action',
  'color-gradient-from', 'color-gradient-to', 'color-link', 'color-focus',
  'color-success-bg', 'color-success-text', 'color-success-icon', 'color-danger-bg', 'color-danger-text',
  'color-ambiguous-bg', 'color-ambiguous-text', 'color-ambiguous-title', 'color-info-bg', 'color-info-text',
  'shadow-card', 'shadow-hover', 'shadow-float',
];

/** Resuelve `var(--token)` a su hexadecimal de la tabla; null si no es un color sólido de la tabla. */
function solid(value: string): string | null {
  const m = /^var\(--([a-z0-9-]+)\)$/.exec(value);
  return m && tokens[m[1]] ? tokens[m[1]] : null;
}

const root = () => block(':root', 0);
const light = () => block(':root,\n[data-theme="light"]');
const darkMedia = () => block('  :root:not([data-theme="light"])');
const darkForced = () => block(':root[data-theme="dark"],\n[data-theme="dark"]');

describe('Archivo de tokens (enmienda §4–§7)', () => {
  it('cada token de la tabla tiene en globals.css exactamente el valor aprobado', () => {
    const r = root();
    for (const [name, hex] of Object.entries(tokens)) expect(r[name]?.toUpperCase(), `--${name}`).toBe(hex);
  });

  it('los tokens de la revisión 1 retirados ya no existen', () => {
    for (const name of RETIRED) expect(tokensCss, `--${name}`).not.toMatch(new RegExp(`--${name}\\b`));
  });

  it('radios de §7.1: control 12, botón 999, tarjeta 18, superficie 24 (opción (a) de Carlos)', () => {
    const r = root();
    expect(r['radius-control']).toBe('12px');
    expect(r['radius-button']).toBe('999px');
    expect(r['radius-card']).toBe('18px');
    expect(r['radius-surface']).toBe('24px');
  });

  it('sombras de §7.1 en claro y en oscuro (mismos desplazamientos, negro .30/.40/.45; Carlos, 2026-10-21)', () => {
    const r = root();
    expect(r['shadow-card-light']).toBe('0 12px 32px rgba(27, 81, 65, 0.08)');
    expect(r['shadow-hover-light']).toBe('0 20px 42px rgba(29, 92, 66, 0.16)');
    expect(r['shadow-float-light']).toBe('0 24px 60px rgba(27, 81, 65, 0.14)');
    expect(r['shadow-card-dark']).toBe('0 12px 32px rgba(0, 0, 0, 0.3)');
    expect(r['shadow-hover-dark']).toBe('0 20px 42px rgba(0, 0, 0, 0.4)');
    expect(r['shadow-float-dark']).toBe('0 24px 60px rgba(0, 0, 0, 0.45)');
  });

  it('movimiento de §7.2: cuatro curvas y tres duraciones; ease-back ya no existe', () => {
    const r = root();
    expect([r['duration-fast'], r['duration-normal'], r['duration-slow']]).toEqual(['150ms', '300ms', '450ms']);
    expect(r['ease-out']).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(r['ease-spring']).toBe('cubic-bezier(0.175, 0.885, 0.32, 1.275)');
    expect(r['ease-standard']).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(r['ease-in-out']).toBe('cubic-bezier(0.645, 0.045, 0.355, 1)');
    expect(r['ease-back']).toBeUndefined();
  });

  it('escala tipográfica de §6 (solo tokens), y los de v1 se quedan', () => {
    const r = root();
    expect([1, 2, 3, 4, 5].map((n) => r[`font-size-display-${n}`])).toEqual(['48px', '34px', '26px', '21px', '18px']);
    expect([1, 2, 3, 4].map((n) => r[`font-size-body-${n}`])).toEqual(['16px', '15px', '14px', '13px']);
    expect([1, 2, 3, 4].map((n) => r[`font-size-mono-${n}`])).toEqual(['15px', '13px', '12px', '11px']);
    expect([r['text-sm'], r['text-md'], r['text-lg'], r['text-xl']]).toEqual(['14px', '16px', '20px', '24px']);
  });

  it('la capa semántica está completa en claro, en oscuro por sistema y en oscuro forzado', () => {
    for (const set of [light(), darkMedia(), darkForced()]) expect(Object.keys(set).sort()).toEqual([...SEMANTIC].sort());
  });

  it('oscuro por sistema y oscuro forzado tienen los mismos valores', () => {
    expect(darkForced()).toEqual(darkMedia());
  });

  it('el oscuro por sistema va dentro de prefers-color-scheme y respeta data-theme="light" (§4.1)', () => {
    expect(tokensCss).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{/);
  });

  it('D-F11: selectores de tema por contenedor permiten [data-theme="dark"] y [data-theme="light"] en cualquier elemento', () => {
    expect(tokensCss).toMatch(/:root,\s*\[data-theme="light"\]\s*\{/);
    expect(tokensCss).toMatch(/:root\[data-theme="dark"\],\s*\[data-theme="dark"\]\s*\{/);
    expect(light()['color-text']).toBe('var(--brand-green-900)');
    expect(darkForced()['color-text']).toBe('var(--dark-text)');
  });

  it('la capa semántica solo apunta a tokens (ningún hexadecimal)', () => {
    for (const set of [light(), darkMedia(), darkForced()]) for (const v of Object.values(set)) expect(v).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('el oscuro apunta a los tokens de §4.2 (no a valores de marca sueltos)', () => {
    const d = darkForced();
    expect(d['color-bg']).toBe('var(--dark-bg)');
    expect(d['color-text']).toBe('var(--dark-text)');
    expect(d['color-action']).toBe('var(--dark-action)');
    expect(d['color-on-action']).toBe('var(--dark-on-action)');
    expect(d['color-link']).toBe('var(--dark-link)');
    expect(d['color-focus']).toBe('var(--dark-focus)');
    for (const s of ['success', 'ambiguous', 'info', 'danger']) {
      expect(d[`color-${s}-bg`]).toBe(`var(--dark-${s}-bg)`);
      expect(d[`color-${s}-text`]).toBe(`var(--dark-${s}-text)`);
    }
    // Sin valor propio en la enmienda: el texto de su estado
    expect(d['color-success-icon']).toBe('var(--dark-success-text)');
    expect(d['color-ambiguous-title']).toBe('var(--dark-ambiguous-text)');
    expect(light()['color-success-icon']).toBe('var(--brand-green-900)');
    expect(light()['color-ambiguous-title']).toBe('var(--brand-yellow-900)');
  });

  const PAIRS_SEMANTIC: Array<[string, string, number]> = [
    ['color-text', 'color-bg', 4.5], ['color-text', 'color-surface', 4.5], ['color-text', 'color-surface-raised', 4.5],
    ['color-text', 'color-field', 4.5],
    ['color-text-secondary', 'color-bg', 4.5], ['color-text-secondary', 'color-surface', 4.5],
    ['color-text-secondary', 'color-surface-raised', 4.5], ['color-text-secondary', 'color-field', 4.5],
    ['color-link', 'color-bg', 4.5], ['color-link', 'color-surface', 4.5], ['color-link', 'color-surface-raised', 4.5],
    ['color-on-action', 'color-action', 4.5], ['color-on-action', 'color-gradient-from', 4.5], ['color-on-action', 'color-gradient-to', 4.5],
    ['color-focus', 'color-bg', 3], ['color-focus', 'color-surface', 3], ['color-focus', 'color-surface-raised', 3],
    ['color-border-control', 'color-surface', 3], ['color-border-control', 'color-field', 3], ['color-border-control', 'color-bg', 3],
    ['color-success-text', 'color-success-bg', 4.5], ['color-success-icon', 'color-success-bg', 3],
    ['color-danger-text', 'color-danger-bg', 4.5],
    ['color-ambiguous-text', 'color-ambiguous-bg', 4.5], ['color-ambiguous-title', 'color-ambiguous-bg', 4.5],
    ['color-info-text', 'color-info-bg', 4.5],
  ];

  it('oscuro: el foco alrededor del botón primario cumple 3:1 (§4.3, 4,19)', () => {
    // En claro no aplica: foco y acción son brand-green-900 (v1 §3) y el contorno, separado 2 px, se ve sobre el fondo
    const d = darkForced();
    expect(contrast(solid(d['color-focus'])!, solid(d['color-action'])!)).toBeCloseTo(4.19, 2);
  });

  for (const [name, get] of [['claro', light], ['oscuro', darkForced]] as const) {
    it(`cada par semántico en ${name} resuelve a colores de la tabla y cumple su umbral`, () => {
      const set = get();
      for (const [fg, bg, min] of PAIRS_SEMANTIC) {
        const a = solid(set[fg]);
        const b = solid(set[bg]);
        expect(a, `${name}: --${fg} = ${set[fg]}`).not.toBeNull();
        expect(b, `${name}: --${bg} = ${set[bg]}`).not.toBeNull();
        expect(contrast(a!, b!), `${name}: ${fg} sobre ${bg}`).toBeGreaterThanOrEqual(min);
      }
    });
  }

  it('el foco nunca es amarillo, ni en claro ni en oscuro', () => {
    for (const set of [light(), darkMedia(), darkForced()]) expect(set['color-focus']).not.toMatch(/yellow/);
  });

  it('nunca texto blanco sobre brand-green-500 ni brand-blue-500 como acción', () => {
    for (const set of [light(), darkMedia(), darkForced()]) {
      expect(set['color-action']).not.toMatch(/green-500|blue-500/);
      expect(set['color-gradient-to']).not.toMatch(/green-500|blue-500/);
    }
  });

  it('dark-border-control y dark-divider nunca son color de texto en la capa semántica', () => {
    for (const set of [light(), darkMedia(), darkForced()]) {
      for (const k of ['color-text', 'color-text-secondary', 'color-link', 'color-success-text', 'color-danger-text',
        'color-ambiguous-text', 'color-ambiguous-title', 'color-info-text']) {
        expect(set[k]).not.toMatch(/dark-border-control|dark-divider/);
      }
    }
  });

  it('la superficie translúcida usa la opacidad de R-F1 enmendada por U-17 (0,82), literal (sin token para #10261D)', () => {
    expect(light()['color-surface-translucent']).toBe('rgba(255, 255, 255, 0.82)');
    expect(darkMedia()['color-surface-translucent']).toBe('rgba(16, 38, 29, 0.82)');
    expect(darkForced()['color-surface-translucent']).toBe('rgba(16, 38, 29, 0.82)');
    expect(tokensCss).not.toMatch(/#10261D/i);
  });

  it('U-17: siempre con desenfoque; @supports not (backdrop-filter…) devuelve la opacidad antigua (0,88 / 0,86)', () => {
    expect(/--backdrop-translucent:\s*([^;]+);/.exec(tokensCss)?.[1].trim()).toBe('blur(20px) saturate(1.2)');
    const start = tokensCss.indexOf('@supports not ((backdrop-filter: blur(1px))');
    expect(start).toBeGreaterThan(0);
    // El bloque entero (con su @media anidado) hasta la llave que lo cierra
    let depth = 0, end = start;
    for (let i = tokensCss.indexOf('{', start); i < tokensCss.length; i++) {
      if (tokensCss[i] === '{') depth++;
      if (tokensCss[i] === '}' && --depth === 0) { end = i; break; }
    }
    const body = tokensCss.slice(start, end);
    const values = [...body.matchAll(/--color-surface-translucent\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(values).toEqual(['rgba(255, 255, 255, 0.88)', 'rgba(16, 38, 29, 0.86)', 'rgba(16, 38, 29, 0.86)']);
    expect(body).toMatch(/:root,\s*\[data-theme="light"\]/);
    expect(body).toMatch(/:root:not\(\[data-theme="light"\]\)/);
    expect(body).toMatch(/\[data-theme="dark"\]/);
  });

  it('U-17: la superficie de la ciudad aplica el desenfoque del token', () => {
    const shell = fs.readFileSync(path.resolve(__dirname, '../src/components/shell/Shell.module.css'), 'utf-8');
    const onCity = /\.onCity \{([^}]*)\}/.exec(shell)![1];
    expect(onCity).toMatch(/background: var\(--color-surface-translucent\)/);
    expect(onCity).toMatch(/(^|\s)backdrop-filter: var\(--backdrop-translucent\)/);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Ningún campo de formulario por debajo de 16 px (enmienda §6: evita el zoom automático de iOS)
// ---------------------------------------------------------------------------------------------------------------
describe('Tamaño de letra de los campos (enmienda §6)', () => {
  const px = (value: string): number | null => {
    const v = value.trim();
    const m = /^var\(--([a-z0-9-]+)\)$/.exec(v);
    if (m) {
      const resolved = root()[m[1]];
      return resolved ? px(resolved) : null;
    }
    const n = /^(\d+(?:\.\d+)?)px$/.exec(v);
    return n ? Number(n[1]) : null;
  };
  const SRC = path.resolve(__dirname, '../src');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir).flatMap((f) => {
      const full = path.join(dir, f);
      return fs.statSync(full).isDirectory() ? walk(full) : [full];
    });

  it('las reglas de input, select y textarea no bajan de 16 px', () => {
    const fieldRules: string[] = [];
    for (const file of walk(SRC).filter((f) => f.endsWith('.css'))) {
      const css = fs.readFileSync(file, 'utf-8');
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = m[1].trim();
        // Reglas de campos: por elemento o por la clase de campo de ui.module.css
        if (!/(^|[\s,>+~])(input|select|textarea)\b|\.input\b|\.select\b|\.textarea\b/.test(selector)) continue;
        fieldRules.push(`${path.relative(SRC, file)} ${selector}`);
        const fs1 = /font-size\s*:\s*([^;]+);?/.exec(m[2]);
        if (!fs1) continue;
        const size = px(fs1[1]);
        expect(size, `${path.relative(SRC, file)} ${selector}: font-size ${fs1[1]}`).not.toBeNull();
        expect(size!, `${path.relative(SRC, file)} ${selector}`).toBeGreaterThanOrEqual(16);
      }
    }
    expect(fieldRules.length, 'debe haber al menos una regla de campo que comprobar').toBeGreaterThan(0);
  });

  it('la base de body (de la que heredan los campos sin font-size propio) es de 16 px', () => {
    const body = /(?:^|\n)body\s*\{([^}]*)\}/.exec(tokensCss);
    expect(body).not.toBeNull();
    expect(px(/font-size\s*:\s*([^;]+);/.exec(body![1])![1])).toBe(16);
  });
});
describe('CSS Files Strict Mode', () => {
  it('fails if any CSS file uses a hex color not in the tokens', () => {
    const cssDir = path.resolve(__dirname, '../src');
    
    // Recursive read all css
    const getCssFiles = (dir: string): string[] => {
      if (!fs.existsSync(dir)) return [];
      const files = fs.readdirSync(dir);
      return files.flatMap(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          return getCssFiles(fullPath);
        }
        return fullPath.endsWith('.css') ? [fullPath] : [];
      });
    };

    const allowedHexes = Object.values(tokens).map(h => h.toUpperCase());
    const cssFiles = getCssFiles(cssDir);

    cssFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      const hexRegex = /#[0-9a-fA-F]{3,6}/g;
      const matches = content.match(hexRegex) || [];

      matches.forEach(match => {
        // Expand 3-digit hex to 6-digit
        let hex = match.toUpperCase();
        if (hex.length === 4) {
          hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        
        expect(
          allowedHexes.includes(hex),
          `File ${file} contains unauthorized hex color ${hex}. Please use CSS variables from tokens.`
        ).toBe(true);
      });
    });
  });

  it('fails if any CSS file combines brand-blue-700 text with neutral-50 background in the same rule', () => {
    const cssDir = path.resolve(__dirname, '../src');
    
    const getCssFiles = (dir: string): string[] => {
      if (!fs.existsSync(dir)) return [];
      const files = fs.readdirSync(dir);
      return files.flatMap(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          return getCssFiles(fullPath);
        }
        return fullPath.endsWith('.css') ? [fullPath] : [];
      });
    };

    const cssFiles = getCssFiles(cssDir);

    cssFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      const rules = content.split('}');
      rules.forEach(rule => {
        if (!rule.trim()) return;
        const hasBlueText = /color\s*:\s*(var\(--brand-blue-700\)|#327DA2|#327da2)/.test(rule);
        const hasNeutralBg = /background(-color)?\s*:\s*(var\(--neutral-50\)|#F8FAFA|#f8fafa)/.test(rule);
        expect(
          hasBlueText && hasNeutralBg,
          `File ${file} invalidly combines brand-blue-700 text with neutral-50 background in the same rule.`
        ).toBe(false);
      });
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Ningún hexadecimal ni token dark-* fuera del archivo de tokens (VS-0: test existente ampliado a TS/TSX)
// ---------------------------------------------------------------------------------------------------------------
describe('Hexadecimales y tokens dark-* solo en el archivo de tokens', () => {
  const SRC = path.resolve(__dirname, '../src');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir).flatMap((f) => {
      const full = path.join(dir, f);
      return fs.statSync(full).isDirectory() ? walk(full) : [full];
    });
  const files = walk(SRC).filter((f) => /\.(css|ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));
  /**
   * Excepciones anteriores a v2, con su motivo. No se amplían: VS-8 las migra.
   * - QrCode: el QR se pinta con colores fijos para que se lea igual en cualquier tema (D-P1).
   */
  const LEGACY_HEX: Record<string, string[]> = {
    'components/QrCode.tsx': ['#FFFFFF', '#1B5141'],
  };
  /**
   * Paletas de ilustración (plan-fase7-pantallas.md D-P1): la ciudad y el mundo de la landing son ilustraciones sin
   * texto encima (R-F1); sus colores viven en UN archivo por ilustración. Ningún otro archivo de la ilustración lleva
   * hexadecimales (lo comprueba el test de arriba, que no los exime).
   */
  const ILLUSTRATION_PALETTES = new Set(['components/background/cityPalette.ts', 'components/landing/worldPalette.ts']);

  it('solo globals.css declara hexadecimales (más las excepciones anteriores listadas)', () => {
    for (const file of files) {
      const rel = path.relative(SRC, file).split(path.sep).join('/');
      if (rel === 'app/globals.css' || ILLUSTRATION_PALETTES.has(rel)) continue;
      const found = (fs.readFileSync(file, 'utf-8').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).map((h) => h.toUpperCase());
      const allowed = LEGACY_HEX[rel] ?? [];
      const unexpected = found.filter((h) => !allowed.includes(h));
      expect(unexpected, `${rel} contiene hexadecimales: usa los tokens de globals.css`).toEqual([]);
    }
  });

  it('D-P1: cada paleta de ilustración existe y su ilustración no tiene colores fuera de ella', () => {
    for (const rel of ILLUSTRATION_PALETTES) {
      expect(fs.existsSync(path.join(SRC, rel)), rel).toBe(true);
      const dir = path.dirname(path.join(SRC, rel));
      for (const f of fs.readdirSync(dir).filter((x) => /\.(ts|tsx|css)$/.test(x))) {
        const r = path.relative(SRC, path.join(dir, f)).split(path.sep).join('/');
        if (r === rel) continue;
        const txt = fs.readFileSync(path.join(dir, f), 'utf-8');
        expect(txt.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [], `${r}: hexadecimales fuera de la paleta`).toEqual([]);
        expect(txt.match(/rgba?\(\s*\d/g) ?? [], `${r}: colores rgb fuera de la paleta`).toEqual([]);
      }
    }
  });

  it('ningún componente usa un token dark-* directamente (solo la capa semántica)', () => {
    for (const file of files) {
      const rel = path.relative(SRC, file).split(path.sep).join('/');
      if (rel === 'app/globals.css') continue;
      expect(fs.readFileSync(file, 'utf-8'), rel).not.toMatch(/--dark-/);
    }
  });

  it('ningún archivo carga fuentes de Google Fonts ni de otro CDN', () => {
    for (const file of files) {
      const rel = path.relative(SRC, file).split(path.sep).join('/');
      expect(fs.readFileSync(file, 'utf-8'), rel).not.toMatch(/fonts\.googleapis|fonts\.gstatic|next\/font\/google|@import\s+url\(\s*['"]?https?:/);
    }
  });

  it('Loaders.module.css y cualquier *.module.css nuevo no contienen duraciones en ms o s sueltas fuera de tokens', () => {
    const moduleCssFiles = files.filter((f) => f.endsWith('.module.css'));
    expect(moduleCssFiles.length).toBeGreaterThan(0);
    for (const file of moduleCssFiles) {
      const rel = path.relative(SRC, file).split(path.sep).join('/');
      const content = fs.readFileSync(file, 'utf-8');
      const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');
      const rawDurations = stripped.match(/\b\d+(?:\.\d+)?(ms|s)\b/g) || [];
      expect(
        rawDurations,
        `${rel} contiene duraciones sueltas (${rawDurations.join(', ')}): deben usar var(--duration-*) o calc(... var(--duration-*))`,
      ).toEqual([]);
    }
  });
});

