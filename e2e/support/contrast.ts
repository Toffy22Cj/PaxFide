// Ref: plan-fase7-pantallas.md C-1 (búsqueda de pares fuera de tabla: "un test que recorra las pantallas en oscuro y
// falle si algún texto tiene contraste < 4,5"; axe no está permitido, D8) y sistema-visual-paxfide-web.md Anexo A
// (luminancia relativa y contraste WCAG 2.x, mezcla de una capa translúcida sobre otra).
import type { Page } from '@playwright/test';

/** Un texto visible por debajo del umbral, con lo necesario para encontrarlo. */
export type ContrastFailure = {
  text: string;
  selector: string;
  color: string;
  background: string;
  ratio: number;
};

/**
 * Recorre en la página cada elemento con texto propio visible y calcula el contraste de su color con el fondo que de
 * verdad tiene detrás: las capas `background-color` de sus ancestros, compuestas de arriba abajo, hasta una opaca (o
 * hasta `--color-bg` del documento). Si un ancestro tiene un degradado, se toma el peor de sus colores.
 *
 * Fuera del recorrido, porque WCAG 1.4.3 no los cuenta o porque no hay un fondo calculable:
 * - el texto oculto a la vista (`display`, `visibility`, `opacity` 0, recortado a 1 px como `.sr-only`);
 * - los controles deshabilitados (`:disabled`, `aria-disabled="true"`) y las `<option>`;
 * - el texto que se dibuja dentro de un `<canvas>` o un SVG (no hay estilos que leer: lo cubren R-F1 y la tabla);
 * - los textos sin ninguna letra ni cifra (el punto amarillo del logotipo "PaxFide.": parte de un logotipo, exento).
 * Las superficies translúcidas sobre la ilustración se componen sobre `--color-bg`; su peor caso sobre la ilustración
 * es el de R-F1 y está en `__tests__/design-tokens.test.ts`.
 */
export async function contrastFailures(page: Page, min = 4.5): Promise<ContrastFailure[]> {
  return page.evaluate((threshold) => {
    type RGBA = [number, number, number, number];
    const probe = document.createElement('span');
    document.body.appendChild(probe);
    const parse = (css: string): RGBA | null => {
      // Normaliza cualquier color (también color-mix) con el propio navegador
      probe.style.color = '';
      probe.style.color = css;
      const v = getComputedStyle(probe).color;
      const m = v.match(/rgba?\(([^)]+)\)/) ?? v.match(/color\(srgb ([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (v.startsWith('color(')) return [parts[0] * 255, parts[1] * 255, parts[2] * 255, parts[3] ?? 1];
      return [parts[0], parts[1], parts[2], parts[3] ?? 1];
    };
    const over = (top: RGBA, bottom: RGBA): RGBA => {
      const a = top[3];
      return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
    };
    const lum = (c: RGBA) => {
      const [r, g, b] = c.slice(0, 3).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: RGBA, b: RGBA) => {
      const [x, y] = [lum(a), lum(b)];
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const gradientStops = (image: string): RGBA[] =>
      [...image.matchAll(/(rgba?\([^)]+\)|color\(srgb [^)]+\))/g)].map((m) => parse(m[1])).filter((c): c is RGBA => !!c);
    const pageBg = parse(getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()) ?? [255, 255, 255, 1];

    /** Fondos posibles detrás de `el` (más de uno si hay un degradado por el camino). */
    const backgrounds = (el: Element): RGBA[] => {
      const layers: RGBA[][] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        const cs = getComputedStyle(node);
        const stops = cs.backgroundImage && cs.backgroundImage !== 'none' ? gradientStops(cs.backgroundImage) : [];
        if (stops.length > 0) { layers.push(stops); if (stops.every((s) => s[3] >= 1)) break; }
        const bg = parse(cs.backgroundColor);
        if (bg && bg[3] > 0) { layers.push([bg]); if (bg[3] >= 1) break; }
      }
      let result: RGBA[] = [pageBg];
      for (const layer of layers.reverse()) result = result.flatMap((under) => layer.map((c) => over(c, under)));
      return result;
    };
    const hidden = (el: Element): boolean => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const cs = getComputedStyle(node);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return true;
        if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') return true;
      }
      const r = el.getBoundingClientRect();
      return r.width <= 1 || r.height <= 1;
    };
    const selectorOf = (el: Element) => {
      const bits: string[] = [];
      for (let node: Element | null = el; node && bits.length < 4; node = node.parentElement) {
        const id = node.getAttribute('data-testid');
        bits.unshift(node.tagName.toLowerCase() + (id ? `[data-testid="${id}"]` : node.classList[0] ? `.${node.classList[0]}` : ''));
      }
      return bits.join(' > ');
    };

    const failures: { text: string; selector: string; color: string; background: string; ratio: number }[] = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (el === probe || el.closest('svg, canvas, option, script, style, noscript')) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? '').join('').trim();
      const isField = el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
      const text = own || (isField ? ((el as HTMLInputElement).value ?? '').trim() : '');
      if (!/[\p{L}\p{N}]/u.test(text)) continue;
      if (el.closest(':disabled, [aria-disabled="true"]')) continue;
      if (hidden(el)) continue;
      const fgRaw = parse(getComputedStyle(el).color);
      if (!fgRaw) continue;
      for (const bg of backgrounds(el)) {
        const fg = fgRaw[3] < 1 ? over(fgRaw, bg) : fgRaw;
        const r = ratio(fg, bg);
        if (r < threshold) {
          const hex = (c: RGBA) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
          failures.push({ text: text.slice(0, 60), selector: selectorOf(el), color: hex(fg), background: hex(bg), ratio: Math.round(r * 100) / 100 });
          break;
        }
      }
    }
    probe.remove();
    return failures;
  }, min);
}
