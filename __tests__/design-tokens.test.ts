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
};

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
      expect(cr).toBeCloseTo(val, 1);
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
