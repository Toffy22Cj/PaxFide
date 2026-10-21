// Ref: prompts-agentes-estilo-v2.md VS-0; sistema-visual-paxfide-web-enmienda-1.md §4.1 (tema) y §6 (fuentes, E6);
// decisiones-delegadas-web-fase7.md DF7-12 (sin preload) y DF7-10.
import { test, expect, type Page } from '@playwright/test';

/** Presupuesto de fuentes en la primera carga (enmienda §6, E6: ≤ 150 KB): las dos familias completas, en bytes. */
const FONT_BUDGET_BYTES = 150_000;

const cssVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().toUpperCase(), name);

test.describe('Tema (VS-0)', () => {
  test('sistema oscuro → tokens semánticos oscuros', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    expect(await cssVar(page, '--color-bg')).toBe('#0E1B16');
    expect(await cssVar(page, '--color-text')).toBe('#EEF6EF');
    expect(await cssVar(page, '--color-focus')).toBe('#8CD39A');
  });

  test('sistema oscuro + data-theme="light" → tokens claros', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    expect(await cssVar(page, '--color-bg')).toBe('#F8FAFA');
    expect(await cssVar(page, '--color-text')).toBe('#1B5141');
  });

  test('sistema claro + data-theme="dark" → tokens oscuros', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');
    expect(await cssVar(page, '--color-bg')).toBe('#F8FAFA');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect(await cssVar(page, '--color-bg')).toBe('#0E1B16');
  });

  test('una preferencia guardada se aplica antes de hidratar; un valor no válido se ignora', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('paxfide.theme', 'dark'));
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.addInitScript(() => window.localStorage.setItem('paxfide.theme', 'sepia'));
    await page.goto('/login');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  });

  test('las pantallas existentes no cambian con el sistema en oscuro (DF7-09)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(248, 250, 250)');
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
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    expect(fonts).toEqual([]);
  });
});
