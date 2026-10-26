// Ref: prompts-agentes-estilo-v2.md VS-0; sistema-visual-paxfide-web-enmienda-1.md §4.1 (tema) y §6 (fuentes, E6);
// plan-fase7-fidelidad.md F-A0, D-F11 (revoca DF7-17 y activa el modo oscuro, selectores por contenedor, ThemeSelect);
// decisiones-delegadas-web-fase7.md DF7-10 y DF7-12.
import { test, expect, type Page } from '@playwright/test';

/** Presupuesto de fuentes en la primera carga (enmienda §6, E6: ≤ 150 KB): las dos familias completas, en bytes. */
const FONT_BUDGET_BYTES = 150_000;

const cssVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().toUpperCase(), name);

test.describe('Tema oscuro activado (F-A0, D-F11)', () => {
  test('sistema oscuro (prefers-color-scheme: dark) sin data-theme → tokens oscuros y barra oscura', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/campaigns');
    // Sin data-theme forzado, manda el sistema
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    expect(await cssVar(page, '--color-bg')).toBe('#0E1B16');
    expect(await cssVar(page, '--color-text')).toBe('#EEF6EF');
    expect(await cssVar(page, '--color-focus')).toBe('#8CD39A');

    const navBg = await page.getByRole('navigation', { name: 'Principal' }).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(navBg).toBe('rgb(19, 44, 34)'); // #132C22 (--dark-surface)
    const headerBg = await page.getByRole('banner').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(headerBg).toBe('rgb(19, 44, 34)'); // #132C22 (--dark-surface)
  });

  test('sistema claro + data-theme="dark" forzado → tokens oscuros', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/campaigns');
    expect(await cssVar(page, '--color-bg')).toBe('#F8FAFA');

    // Cambiar vía ThemeSelect
    await page.getByTestId('theme-select').selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await cssVar(page, '--color-bg')).toBe('#0E1B16');
    expect(await cssVar(page, '--color-text')).toBe('#EEF6EF');
  });

  test('sistema oscuro + data-theme="light" forzado → tokens claros', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/campaigns');
    expect(await cssVar(page, '--color-bg')).toBe('#0E1B16');

    // Cambiar vía ThemeSelect
    await page.getByTestId('theme-select').selectOption('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await cssVar(page, '--color-bg')).toBe('#F8FAFA');
    expect(await cssVar(page, '--color-text')).toBe('#1B5141');
  });

  test('preferencia guardada en localStorage se aplica antes de pintar sin parpadeo (THEME_INIT_SCRIPT)', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('paxfide.theme', 'dark'));
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await cssVar(page, '--color-bg')).toBe('#0E1B16');
  });

  test('D-F11: selectores de tema por contenedor redefinen variables semánticas', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');

    const result = await page.evaluate(() => {
      // 1. Contenedor oscuro dentro de página clara
      const darkContainer = document.createElement('div');
      darkContainer.setAttribute('data-theme', 'dark');
      darkContainer.innerHTML = '<span id="dark-child">Texto</span>';
      document.body.appendChild(darkContainer);

      // 2. Contenedor claro dentro de contenedor oscuro
      const lightNested = document.createElement('div');
      lightNested.setAttribute('data-theme', 'light');
      lightNested.innerHTML = '<span id="light-child">Texto</span>';
      darkContainer.appendChild(lightNested);

      const darkChild = document.getElementById('dark-child')!;
      const lightChild = document.getElementById('light-child')!;

      const darkText = getComputedStyle(darkChild).getPropertyValue('--color-text').trim().toUpperCase();
      const lightText = getComputedStyle(lightChild).getPropertyValue('--color-text').trim().toUpperCase();

      return { darkText, lightText };
    });

    // Un contenedor con data-theme="dark" dentro de una página clara calcula --color-text = dark-text (#EEF6EF)
    expect(result.darkText).toBe('#EEF6EF');
    // Y al revés: contenedor con data-theme="light" dentro de página oscura calcula --color-text = #1B5141
    expect(result.lightText).toBe('#1B5141');
  });

  test('ThemeSelect en la cabecera fina interactúa, actualiza data-theme y guarda en localStorage', async ({ page }) => {
    await page.goto('/campaigns');
    const select = page.getByTestId('theme-select');
    await expect(select).toBeVisible();

    // Seleccionar Oscuro
    await select.selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => window.localStorage.getItem('paxfide.theme'))).toBe('dark');

    // Seleccionar Claro
    await select.selectOption('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => window.localStorage.getItem('paxfide.theme'))).toBe('light');

    // Seleccionar Como el sistema (borra de localStorage)
    await select.selectOption('system');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    expect(await page.evaluate(() => window.localStorage.getItem('paxfide.theme'))).toBeNull();
  });

  test('C-1 contraste en oscuro: los textos visibles en pantalla cumplen contraste WCAG >= 4.5', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/campaigns');

    const issues = await page.evaluate(() => {
      function rgbToLum(rgbStr: string): number {
        const m = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return 0;
        const [r, g, b] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)].map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      function contrast(c1: string, c2: string): number {
        const l1 = rgbToLum(c1);
        const l2 = rgbToLum(c2);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }
      function getEffectiveBg(el: HTMLElement): string {
        let cur: HTMLElement | null = el;
        while (cur) {
          const bg = getComputedStyle(cur).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          cur = cur.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
      }

      const elements = Array.from(document.querySelectorAll('label, button, a, h1, h2, h3, p, span'));
      const failures: Array<{ text: string; color: string; bg: string; ratio: number }> = [];

      for (const el of elements as HTMLElement[]) {
        if (!el.offsetParent || el.offsetWidth === 0 || el.offsetHeight === 0) continue;
        const text = el.textContent?.trim();
        if (!text || text.length > 50) continue;
        const fg = getComputedStyle(el).color;
        const bg = getEffectiveBg(el);
        const cr = contrast(fg, bg);
        // Umbral normal para texto es 4.5; para texto grande (>= 18px bold o >= 24px) es 3.0
        const isLarge = parseFloat(getComputedStyle(el).fontSize) >= 24;
        const minCr = isLarge ? 3.0 : 4.5;
        if (cr < minCr) {
          failures.push({ text, color: fg, bg, ratio: Math.round(cr * 100) / 100 });
        }
      }
      return failures;
    });

    expect(issues, 'Pares con contraste insuficiente en oscuro').toEqual([]);
  });

  test('no-superposición (§1.4): elementFromPoint en los controles de la cabecera devuelve el propio control (390, 1280, 1920 px)', async ({ page }) => {
    for (const width of [390, 1280, 1920]) {
      await page.setViewportSize({ width, height: 860 });
      await page.goto('/login');
      await page.getByLabel('Correo electrónico').waitFor();

      const overlaps = await page.evaluate(() => {
        const header = document.querySelector('header');
        if (!header) return [];
        const controls = Array.from(header.querySelectorAll('button, select, a'));
        const issues: string[] = [];
        for (const el of controls) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const cx = Math.floor(rect.left + rect.width / 2);
          const cy = Math.floor(rect.top + rect.height / 2);
          const top = document.elementFromPoint(cx, cy);
          if (top && top.tagName.toUpperCase().includes('NEXTJS')) continue;
          if (top !== el && !el.contains(top)) {
            issues.push(`${el.tagName} (${el.textContent?.trim()}): cubierto por ${top?.tagName} (${top?.className})`);
          }
        }
        return issues;
      });

      expect(overlaps, `Superposiciones en cabecera a ${width}px`).toEqual([]);
    }
  });
});

test.describe('Fuentes autoalojadas (VS-0)', () => {
  test('cargar las dos familias cabe en el presupuesto y no pide nada fuera del propio origen', async ({ page }) => {
    const external: string[] = [];
    const fontBytes: Record<string, number> = {};
    page.on('request', (r) => {
      const host = new URL(r.url()).hostname;
      if (host !== 'localhost' && host !== '127.0.0.1') external.push(host);
    });
    page.on('response', async (r) => {
      if (r.request().resourceType() === 'font') fontBytes[r.url()] = (await r.body()).length;
    });
    await page.goto('/login');
    const loaded = await page.evaluate(async () => {
      const css = getComputedStyle(document.documentElement);
      // Solo la familia principal: la de respaldo (local(Arial)) puede no existir en la máquina
      const first = (v: string) => v.split(',')[0].trim();
      const display = first(css.getPropertyValue('--font-display'));
      const mono = first(css.getPropertyValue('--font-mono'));
      const a = await document.fonts.load(`700 32px ${display}`, 'Donaciones que llegan ñ');
      const b = await document.fonts.load(`500 16px ${mono}`, 'COP 300.000');
      return { display, mono, a: a.length, b: b.length };
    });
    expect(loaded.display).toMatch(/fontDisplay/);
    expect(loaded.mono).toMatch(/fontMono/);
    expect(loaded.a).toBeGreaterThan(0);
    expect(loaded.b).toBeGreaterThan(0);
    await expect.poll(() => Object.keys(fontBytes).length).toBe(2);
    const total = Object.values(fontBytes).reduce((s, n) => s + n, 0);
    console.log(`fuentes: ${Object.keys(fontBytes).length} archivos, ${total} bytes (presupuesto ${FONT_BUDGET_BYTES})`);
    expect(total).toBeLessThanOrEqual(FONT_BUDGET_BYTES);
    expect(external.filter((h) => /fonts\.(googleapis|gstatic)\.com/.test(h))).toEqual([]);
    expect(external, 'peticiones a dominios externos').toEqual([]);
  });

  test('sin preload: la primera carga de una pantalla existente no descarga fuentes (DF7-12)', async ({ page }) => {
    const fonts: string[] = [];
    page.on('request', (r) => { if (r.resourceType() === 'font') fonts.push(r.url()); });
    await page.goto('/tracking');
    await page.waitForLoadState('networkidle');
    expect(fonts).toEqual([]);
  });
});
