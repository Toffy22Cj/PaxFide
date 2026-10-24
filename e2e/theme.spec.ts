// Ref: prompts-agentes-estilo-v2.md VS-0; sistema-visual-paxfide-web-enmienda-1.md §4.1 (tema) y §6 (fuentes, E6);
// decisiones-delegadas-web-fase7.md DF7-12 (sin preload) y DF7-10; plan-fase7-pantallas.md C-1 (se retira el claro
// forzado de DF7-17: sistema oscuro → oscuro, data-theme forzado, preferencia aplicada antes de pintar) y
// plan-fase7-fidelidad.md F-A0 (D-F11: data-theme en cualquier contenedor; la ciudad y el mundo toman la paleta de noche).
import { test, expect, type Page } from '@playwright/test';

/** Presupuesto de fuentes en la primera carga (enmienda §6, E6: ≤ 150 KB): las dos familias completas, en bytes. */
const FONT_BUDGET_BYTES = 150_000;

const cssVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().toUpperCase(), name);
const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/** Luminancia media (0–255) de una franja del canvas: basta para distinguir la paleta de día de la de noche. */
const canvasLuma = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, c.width, Math.max(1, Math.floor(c.height / 3)));
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    return sum / (data.length / 4);
  });

test.describe('Tema (C-1: sin tema forzado)', () => {
  test('sistema oscuro → tema oscuro: sin data-theme, tokens oscuros y body oscuro', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
    expect(await cssVar(page, '--color-bg')).toBe('#0E1B16');
    expect(await cssVar(page, '--color-text')).toBe('#EEF6EF');
    expect(await bodyBg(page)).toBe('rgb(14, 27, 22)');
    const headerBg = await page.getByRole('banner').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(headerBg).toBe('rgb(19, 44, 34)'); // dark-surface
  });

  test('sistema claro → tema claro (negativa: nada oscuro)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');
    expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
    expect(await cssVar(page, '--color-bg')).toBe('#F8FAFA');
    expect(await bodyBg(page)).toBe('rgb(248, 250, 250)');
  });

  test('data-theme forzado manda sobre el sistema, en los dos sentidos', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    expect(await cssVar(page, '--color-bg')).toBe('#F8FAFA');
    expect(await cssVar(page, '--color-text')).toBe('#1B5141');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect(await cssVar(page, '--color-bg')).toBe('#0E1B16');
    expect(await cssVar(page, '--color-focus')).toBe('#8CD39A');
  });

  test('una preferencia guardada se aplica antes de pintar: data-theme ya está cuando aparece <body>', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => {
      window.localStorage.setItem('paxfide.theme', 'dark');
      const w = window as unknown as { __themeAtBody?: string | null };
      new MutationObserver((_, obs) => {
        if (!document.body) return;
        w.__themeAtBody = document.documentElement.getAttribute('data-theme');
        obs.disconnect();
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/login');
    expect(await page.evaluate(() => (window as unknown as { __themeAtBody?: string | null }).__themeAtBody)).toBe('dark');
    expect(await bodyBg(page)).toBe('rgb(14, 27, 22)');
  });

  test('ThemeSelect en la cabecera: Oscuro se aplica y se recuerda; "Como el sistema" lo quita', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');
    const select = page.getByRole('banner').getByLabel('Tema');
    await expect(select).toHaveValue('system');
    await select.selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('banner').getByLabel('Tema')).toHaveValue('dark');
    await page.getByRole('banner').getByLabel('Tema').selectOption('system');
    expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
    expect(await page.evaluate(() => window.localStorage.getItem('paxfide.theme'))).toBeNull();
  });

  test('D-F11: data-theme en un contenedor redefine los tokens dentro de él, en los dos sentidos', async ({ page }) => {
    const probe = (theme: 'dark' | 'light') => page.evaluate((t) => {
      const div = document.createElement('div');
      div.setAttribute('data-theme', t);
      const inner = document.createElement('p');
      inner.textContent = 'muestra';
      div.appendChild(inner);
      document.body.appendChild(div);
      const out = {
        token: getComputedStyle(inner).getPropertyValue('--color-text').trim().toUpperCase(),
        color: getComputedStyle(inner).color,
        page: getComputedStyle(document.body).getPropertyValue('--color-text').trim().toUpperCase(),
      };
      div.remove();
      return out;
    }, theme);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');
    expect(await probe('dark')).toEqual({ token: '#EEF6EF', color: 'rgb(238, 246, 239)', page: '#1B5141' });
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await probe('light')).toEqual({ token: '#1B5141', color: 'rgb(27, 81, 65)', page: '#EEF6EF' });
  });

  for (const [route, testId] of [['/campaigns', 'city-background'], ['/', 'world-background']] as const) {
    test(`la ilustración de ${route} toma la paleta de noche con el tema oscuro, también quieta (reducir movimiento)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      await page.goto(route);
      await expect(page.getByTestId(testId)).toHaveAttribute('data-loop', 'still');
      await expect.poll(() => page.getByTestId(testId).getAttribute('data-frames')).not.toBeNull();
      const day = await canvasLuma(page, testId);
      const framesBefore = Number(await page.getByTestId(testId).getAttribute('data-frames'));
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
      // Quieta no hay bucle: se repinta una vez por el cambio de tema, sin mezcla animada
      await expect.poll(() => page.getByTestId(testId).getAttribute('data-frames').then(Number)).toBeGreaterThan(framesBefore);
      const night = await canvasLuma(page, testId);
      expect(night).toBeLessThan(day * 0.7);
      await expect(page.getByTestId(testId)).toHaveAttribute('data-loop', 'still');
    });
  }

  for (const width of [390, 1280, 1920]) {
    test(`cabecera a ${width} px: cada control recibe el toque en su centro y no hay scroll horizontal`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/login');
      await page.getByLabel('Correo electrónico').fill('admin@demo.test');
      await page.getByLabel('Contraseña').fill('demo-admin');
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
      await page.waitForURL((u) => !u.pathname.startsWith('/login'));
      // A /home por el router: la sesión vive en memoria (D2) y /home tiene ciudad, así que también hay pausa
      await page.evaluate(() => (window as unknown as { __TEST_ROUTER__: { push: (p: string) => void } }).__TEST_ROUTER__.push('/home'));
      await expect(page).toHaveURL(/\/home$/);
      await expect(page.getByTestId('city-pause')).toBeVisible();
      await expect(page.getByTestId('logout-btn')).toBeVisible();
      const controls = page.getByRole('banner').locator('select, button');
      expect(await controls.count()).toBe(3); // tema, pausa y cerrar sesión
      for (const el of await controls.all()) {
        const hit = await el.evaluate((node) => {
          const r = node.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { same: at === node || node.contains(at), w: r.width, h: r.height };
        });
        expect(hit.same).toBe(true);
        expect(hit.w).toBeGreaterThanOrEqual(44);
        expect(hit.h).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
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
