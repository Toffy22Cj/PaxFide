import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

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

// Ref: sistema-visual-paxfide-web.md §2–§3 y Anexo A; decisiones-delegadas-web-fase7.md DF7-02, DF7-03 (tabla de pares).
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
  // v2 (DF7-02, DF7-03)
  'brand-green-700': '#46824C',
  'brand-ground': '#EEF4EA',
  'dark-ground': '#07130E',
  'dark-bg': '#0D1F18',
  'dark-surface': '#132C22',
  'dark-surface-raised': '#1A3D2F',
  'dark-field': '#0F261D',
  'dark-text-secondary': '#BBCAC1',
  'dark-border-control': '#739797',
  'dark-divider': '#2B502F',
  'dark-green-300': '#69AE70',
  'dark-blue-300': '#A2CDE2',
  'dark-green-950': '#172B19',
  'dark-blue-950': '#102733',
  'dark-yellow-950': '#3A2604',
  'dark-danger-950': '#360B07',
  'dark-danger-300': '#EB766D',
};

/** Superficie translúcida (R-F1) compuesta sobre el peor fondo posible: negro en claro, blanco en oscuro. */
function over(fg: string, alpha: number, bg: string): string {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return '#' + f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('').toUpperCase();
}
const R_F1_MIN_OPACITY_LIGHT = 0.88;
const R_F1_MIN_OPACITY_DARK = 0.86;
tokens['rf1-light-worst'] = over(tokens['white'], R_F1_MIN_OPACITY_LIGHT, '#000000');
tokens['rf1-dark-worst'] = over(tokens['dark-surface'], R_F1_MIN_OPACITY_DARK, '#FFFFFF');

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
  // v2 claro (DF7-02): suelo de marca, degradado y peor caso de R-F1
  { fg: 'white', bg: 'brand-green-700', min: 4.5, val: 4.61 },
  { fg: 'brand-green-900', bg: 'brand-ground', min: 4.5, val: 8.16 },
  { fg: 'brand-neutral-700', bg: 'brand-ground', min: 4.5, val: 6.99 },
  { fg: 'brand-blue-800', bg: 'brand-ground', min: 4.5, val: 6.35 },
  { fg: 'brand-green-900', bg: 'rf1-light-worst', min: 4.5, val: 6.92 },
  { fg: 'brand-neutral-700', bg: 'rf1-light-worst', min: 4.5, val: 5.93 },
  { fg: 'brand-blue-800', bg: 'rf1-light-worst', min: 4.5, val: 5.38 },
  // v2 oscuro (DF7-03): texto
  { fg: 'brand-green-50', bg: 'dark-ground', min: 4.5, val: 17.20 },
  { fg: 'brand-green-50', bg: 'dark-bg', min: 4.5, val: 15.55 },
  { fg: 'brand-green-50', bg: 'dark-surface', min: 4.5, val: 13.51 },
  { fg: 'brand-green-50', bg: 'dark-surface-raised', min: 4.5, val: 10.88 },
  { fg: 'brand-green-50', bg: 'dark-field', min: 4.5, val: 14.49 },
  { fg: 'dark-text-secondary', bg: 'dark-bg', min: 4.5, val: 10.06 },
  { fg: 'dark-text-secondary', bg: 'dark-surface', min: 4.5, val: 8.74 },
  { fg: 'dark-text-secondary', bg: 'dark-surface-raised', min: 4.5, val: 7.04 },
  { fg: 'dark-text-secondary', bg: 'dark-field', min: 4.5, val: 9.38 },
  { fg: 'dark-blue-300', bg: 'dark-bg', min: 4.5, val: 10.08 },
  { fg: 'dark-blue-300', bg: 'dark-surface', min: 4.5, val: 8.76 },
  { fg: 'dark-blue-300', bg: 'dark-surface-raised', min: 4.5, val: 7.06 },
  { fg: 'white', bg: 'brand-green-800', min: 4.5, val: 7.40 },
  // v2 oscuro: foco y bordes de control (componentes de interfaz, 3:1)
  { fg: 'dark-green-300', bg: 'dark-bg', min: 3.0, val: 6.43 },
  { fg: 'dark-green-300', bg: 'dark-surface', min: 3.0, val: 5.59 },
  { fg: 'dark-green-300', bg: 'dark-surface-raised', min: 3.0, val: 4.50 },
  { fg: 'dark-green-300', bg: 'dark-field', min: 3.0, val: 6.00 },
  { fg: 'dark-border-control', bg: 'dark-bg', min: 3.0, val: 5.38 },
  { fg: 'dark-border-control', bg: 'dark-surface', min: 3.0, val: 4.68 },
  { fg: 'dark-border-control', bg: 'dark-surface-raised', min: 3.0, val: 3.77 },
  { fg: 'dark-border-control', bg: 'dark-field', min: 3.0, val: 5.02 },
  // v2 oscuro: estados
  { fg: 'brand-green-50', bg: 'dark-green-950', min: 4.5, val: 13.66 },
  { fg: 'dark-green-300', bg: 'dark-green-950', min: 3.0, val: 5.65 },
  { fg: 'brand-green-50', bg: 'dark-danger-950', min: 4.5, val: 15.78 },
  { fg: 'dark-danger-300', bg: 'dark-danger-950', min: 4.5, val: 6.08 },
  { fg: 'dark-danger-300', bg: 'dark-surface', min: 4.5, val: 5.21 },
  { fg: 'brand-green-50', bg: 'dark-yellow-950', min: 4.5, val: 13.07 },
  { fg: 'brand-yellow-400', bg: 'dark-yellow-950', min: 4.5, val: 7.89 },
  { fg: 'brand-green-50', bg: 'dark-blue-950', min: 4.5, val: 14.02 },
  { fg: 'dark-blue-300', bg: 'dark-blue-950', min: 4.5, val: 9.09 },
  // v2 oscuro: peor caso de R-F1
  { fg: 'brand-green-50', bg: 'rf1-dark-worst', min: 4.5, val: 8.66 },
  { fg: 'dark-text-secondary', bg: 'rf1-dark-worst', min: 4.5, val: 5.60 },
  { fg: 'dark-blue-300', bg: 'rf1-dark-worst', min: 4.5, val: 5.62 },
];

describe('Design Tokens & Contrast', () => {
  it('validates the reference formula against known values', () => {
    expect(contrast(tokens['brand-green-900'], tokens['white'])).toBeCloseTo(9.13, 2);
    expect(contrast(tokens['brand-green-900'], tokens['brand-yellow-50'])).toBeCloseTo(8.35, 2);
    expect(contrast(tokens['brand-blue-700'], tokens['white'])).toBeCloseTo(4.57, 2);
  });

  pairs.forEach(({ fg, bg, min, val }) => {
    it(`ensures ${fg} over ${bg} reaches ${min}:1 (expected ~${val})`, () => {
      const cr = contrast(tokens[fg], tokens[bg]);
      expect(cr).toBeGreaterThanOrEqual(min);
      expect(cr).toBeCloseTo(val, 2);
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

  describe('Restricciones negativas v2 (DF7-03)', () => {
    it('texto blanco sobre brand-green-500 no cumple 4.5:1 (prohibido)', () => {
      const cr = contrast(tokens['white'], tokens['brand-green-500']);
      expect(cr).toBeLessThan(4.5);
      expect(cr).toBeCloseTo(3.81, 2);
    });

    it('dark-border-control no sirve como texto: no llega a 4.5:1 sobre dark-surface-raised', () => {
      const cr = contrast(tokens['dark-border-control'], tokens['dark-surface-raised']);
      expect(cr).toBeLessThan(4.5);
      expect(cr).toBeCloseTo(3.77, 2);
    });

    it('dark-divider es decorativo: no llega a 3:1 sobre dark-surface', () => {
      const cr = contrast(tokens['dark-divider'], tokens['dark-surface']);
      expect(cr).toBeLessThan(3.0);
      expect(cr).toBeCloseTo(1.62, 2);
    });

    it('amarillo como foco: brand-yellow-400 no llega a 3:1 sobre blanco', () => {
      const cr = contrast(tokens['brand-yellow-400'], tokens['white']);
      expect(cr).toBeLessThan(3.0);
      expect(cr).toBeCloseTo(1.83, 2);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// El archivo de tokens (globals.css) es la única fuente: sus valores deben coincidir con la tabla de arriba
// ---------------------------------------------------------------------------------------------------------------
const TOKENS_FILE = path.resolve(__dirname, '../src/app/globals.css');
const tokensCss = fs.readFileSync(TOKENS_FILE, 'utf-8');

/** Declaraciones `--x: valor;` de un bloque cuyo selector es exactamente `selector`. */
function block(selector: string): Record<string, string> {
  const start = tokensCss.indexOf(selector + ' {');
  expect(start, `No existe el bloque ${selector}`).toBeGreaterThanOrEqual(0);
  const open = tokensCss.indexOf('{', start);
  const close = tokensCss.indexOf('}', open);
  const body = tokensCss.slice(open + 1, close);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
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

describe('Archivo de tokens (DF7-02, DF7-03, DF7-07, DF7-08)', () => {
  it('cada token de la tabla tiene en globals.css exactamente el valor aprobado', () => {
    const root = block(':root');
    for (const [name, hex] of Object.entries(tokens)) {
      if (name.startsWith('rf1-')) continue;
      expect(root[name]?.toUpperCase(), `--${name}`).toBe(hex);
    }
  });

  it('define radios, sombras claras y oscuras, tres duraciones y cuatro curvas', () => {
    const root = block(':root');
    expect(root['radius-card']).toBe('20px');
    expect(root['radius-button']).toBe('999px');
    expect(root['radius-surface']).toBe('8px');
    for (const k of ['card', 'hover', 'float']) {
      expect(root[`shadow-${k}-light`]).toBeTruthy();
      expect(root[`shadow-${k}-dark`]).toBeTruthy();
    }
    expect([root['duration-fast'], root['duration-normal'], root['duration-slow']]).toEqual(['150ms', '300ms', '450ms']);
    expect(root['ease-standard']).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(root['ease-out']).toBe('cubic-bezier(0.215, 0.61, 0.355, 1)');
    expect(root['ease-in-out']).toBe('cubic-bezier(0.645, 0.045, 0.355, 1)');
    expect(root['ease-back']).toBe('cubic-bezier(0.175, 0.885, 0.32, 1.275)');
  });

  const light = () => {
    // El segundo `:root {` es la capa semántica clara
    const first = tokensCss.indexOf(':root {');
    const second = tokensCss.indexOf(':root {', first + 1);
    const open = tokensCss.indexOf('{', second);
    const body = tokensCss.slice(open + 1, tokensCss.indexOf('}', open));
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
    return out;
  };
  const darkMedia = () => block('  :root:not([data-theme="light"])');
  const darkForced = () => block(':root[data-theme="dark"]');

  it('la capa semántica está completa en claro, en oscuro por sistema y en oscuro forzado', () => {
    for (const set of [light(), darkMedia(), darkForced()]) {
      expect(Object.keys(set).sort()).toEqual([...SEMANTIC].sort());
    }
  });

  it('oscuro por sistema y oscuro forzado tienen los mismos valores', () => {
    expect(darkForced()).toEqual(darkMedia());
  });

  it('el oscuro por sistema va dentro de prefers-color-scheme y respeta data-theme="light"', () => {
    expect(tokensCss).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{/);
  });

  it('la capa semántica solo apunta a tokens (ningún hexadecimal)', () => {
    for (const set of [light(), darkMedia(), darkForced()]) {
      for (const v of Object.values(set)) expect(v).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    }
  });

  const PAIRS_SEMANTIC: Array<[string, string, number]> = [
    ['color-text', 'color-bg', 4.5], ['color-text', 'color-surface', 4.5], ['color-text', 'color-surface-raised', 4.5],
    ['color-text', 'color-field', 4.5], ['color-text', 'color-ground', 4.5],
    ['color-text-secondary', 'color-bg', 4.5], ['color-text-secondary', 'color-surface', 4.5],
    ['color-text-secondary', 'color-surface-raised', 4.5], ['color-text-secondary', 'color-field', 4.5],
    ['color-link', 'color-bg', 4.5], ['color-link', 'color-surface', 4.5], ['color-link', 'color-surface-raised', 4.5],
    ['color-on-action', 'color-action', 4.5], ['color-on-action', 'color-gradient-from', 4.5], ['color-on-action', 'color-gradient-to', 4.5],
    ['color-focus', 'color-bg', 3], ['color-focus', 'color-surface', 3], ['color-focus', 'color-surface-raised', 3], ['color-focus', 'color-field', 3],
    ['color-border-control', 'color-surface', 3], ['color-border-control', 'color-field', 3],
    ['color-success-text', 'color-success-bg', 4.5], ['color-danger-text', 'color-danger-bg', 4.5],
    ['color-ambiguous-text', 'color-ambiguous-bg', 4.5], ['color-ambiguous-title', 'color-ambiguous-bg', 4.5],
    ['color-info-text', 'color-info-bg', 4.5],
  ];

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

  it('en oscuro no se pone texto blanco sobre brand-green-500 como acción', () => {
    for (const set of [light(), darkMedia(), darkForced()]) expect(set['color-action']).not.toBe('var(--brand-green-500)');
  });

  it('dark-border-control nunca es un color de texto en la capa semántica', () => {
    for (const set of [light(), darkMedia(), darkForced()]) {
      for (const k of ['color-text', 'color-text-secondary', 'color-link', 'color-success-text', 'color-danger-text',
        'color-ambiguous-text', 'color-ambiguous-title', 'color-info-text']) {
        expect(set[k]).not.toBe('var(--dark-border-control)');
      }
    }
  });

  it('la superficie translúcida usa como mínimo la opacidad de R-F1', () => {
    expect(light()['color-surface-translucent']).toBe('color-mix(in srgb, var(--white) 88%, transparent)');
    expect(darkForced()['color-surface-translucent']).toBe('color-mix(in srgb, var(--dark-surface) 86%, transparent)');
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
   * - QrCode: el QR se pinta con colores fijos para que se lea igual en cualquier tema.
   * - PredictionCharts: borde blanco de los marcadores (pantalla existente, fuera de VS-0).
   */
  const LEGACY_HEX: Record<string, string[]> = {
    'components/QrCode.tsx': ['#FFFFFF', '#1B5141'],
    'components/prediction/PredictionCharts.tsx': ['#FFFFFF'],
  };

  it('solo globals.css declara hexadecimales (más las excepciones anteriores listadas)', () => {
    for (const file of files) {
      const rel = path.relative(SRC, file).split(path.sep).join('/');
      if (rel === 'app/globals.css') continue;
      const found = (fs.readFileSync(file, 'utf-8').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).map((h) => h.toUpperCase());
      const allowed = LEGACY_HEX[rel] ?? [];
      const unexpected = found.filter((h) => !allowed.includes(h));
      expect(unexpected, `${rel} contiene hexadecimales: usa los tokens de globals.css`).toEqual([]);
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
});
