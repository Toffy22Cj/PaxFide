// Ref: plan-fase7-puesta-al-dia.md Anexo 4, P-14 (U-28 a U-31): el tema del acceso sale del contenedor más cercano,
// la marca solo arriba, el marco no se desmonta al cambiar de pestaña y el cambio se anima sin parpadeo.
import { test, expect, type Page } from '@playwright/test';

const ACCESS = ['/login', '/register', '/recuperar', '/verificar-correo', '/invitaciones', '/terminos', '/privacidad', '/terminos-organizacion'];
const card = (page: Page) => page.locator('[data-testid="access-root"] main [data-world-avoid]').first();

/** App (paxfide.theme) y mundo (paxfide.world-mode) antes de cargar. */
async function prefs(page: Page, app: 'light' | 'dark', world: 'day' | 'night') {
  await page.addInitScript(([a, w]) => {
    localStorage.setItem('paxfide.theme', a);
    localStorage.setItem('paxfide.world-mode', w);
  }, [app, world]);
}

/** Contraste WCAG del texto sobre el fondo de la tarjeta (con su alfa, sobre blanco y sobre negro: el peor). */
async function worstContrast(page: Page, selector: string): Promise<number> {
  return card(page).evaluate((root, sel) => {
    const parse = (c: string) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: number[], b: number[]) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const [br, bg, bb, ba = 1] = parse(getComputedStyle(root).backgroundColor);
    const over = (u: number) => [br, bg, bb].map((v) => v * ba + u * (1 - ba));
    let worst = Infinity;
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(sel))) {
      if (!el.offsetParent) continue;
      const [r, g, b] = parse(getComputedStyle(el).color);
      worst = Math.min(worst, ratio([r, g, b], over(255)), ratio([r, g, b], over(0)));
    }
    return worst;
  }, selector);
}

test.describe('P-14 · tema cruzado (U-28)', () => {
  for (const [app, world, expected] of [['dark', 'day', 'light'], ['light', 'night', 'dark']] as const) {
    test(`app ${app} y mundo ${world}: cada pantalla toma el tema del mundo y su texto cumple 4,5`, async ({ page }) => {
      await prefs(page, app, world);
      for (const path of ACCESS) {
        await page.goto(path);
        await expect(page.getByTestId('access-root')).toHaveAttribute('data-theme', expected);
        await expect(card(page)).toBeVisible();
        const bg = await card(page).evaluate((el) => getComputedStyle(el).backgroundColor);
        // Fondo de la tarjeta según el mundo: claro (255,255,255,.95) de día; verde muy oscuro (14,34,25,.96) de noche
        expect(bg, path).toBe(expected === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(14, 34, 25, 0.96)');
        const c = await worstContrast(page, 'h1, h1 + p, label');
        expect(c, `${path}: contraste del título, el subtítulo y las etiquetas`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

test.describe('P-14 · marca (U-29)', () => {
  test('dentro de la tarjeta no hay marca; arriba hay exactamente una, "PaxFide."', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const path of ACCESS) {
      await page.goto(path);
      await expect(card(page)).toBeVisible();
      await expect(card(page).locator('svg[viewBox="0 0 48 48"], [data-testid="access-brand"]'), path).toHaveCount(0);
      // Ningún elemento de la tarjeta es la marca (texto exacto "PaxFide"); el contenido legal puede nombrarla
      expect(await card(page).evaluate((el) => Array.from(el.querySelectorAll('*')).some((n) => n.textContent?.trim() === 'PaxFide')), path).toBe(false);
      await expect(page.getByTestId('access-brand'), path).toHaveCount(1);
      await expect(page.getByTestId('access-brand')).toHaveText('PaxFide.');
    }
  });
});

test.describe('P-14 · el marco no se desmonta (U-30, U-31)', () => {
  test('de /login a /register y vuelta: el mismo canvas y la misma tarjeta; sin authCardEnter; URL, atrás, aria-selected y foco', async ({ page }) => {
    await page.goto('/login');
    await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
    const canvas = await page.locator('[data-testid="access-root"] canvas').first().elementHandle();
    const authCard = await page.getByTestId('auth-card').elementHandle();
    // La entrada inicial ya terminó
    await page.waitForFunction(() => document.querySelector('[data-testid="auth-card"]')!.getAnimations().length === 0);

    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crear cuenta');
    await expect(page.getByRole('tab', { name: 'Crear cuenta' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Iniciar sesión' })).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    expect(await canvas!.evaluate((n) => n.isConnected)).toBe(true);
    expect(await authCard!.evaluate((n) => n.isConnected)).toBe(true);
    // authCardEnter no vuelve a ejecutarse al cambiar de pestaña
    const names = await authCard!.evaluate((n) => (n as HTMLElement).getAnimations().map((a) => (a as CSSAnimation).animationName));
    expect(names).not.toContain(expect.stringContaining('authCardEnter'));
    await expect(page.getByLabel('Repite la contraseña')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Iniciar sesión');
    await expect(page.getByRole('tab', { name: 'Iniciar sesión' })).toHaveAttribute('aria-selected', 'true');
    expect(await canvas!.evaluate((n) => n.isConnected)).toBe(true);
    expect(await authCard!.evaluate((n) => n.isConnected)).toBe(true);
    // El fantasma del contenido saliente nunca duplica ids ni campos
    expect(await page.locator('#loginEmail').count()).toBe(1);
  });

  test('a otra pantalla de acceso (/recuperar) el mundo sigue montado', async ({ page }) => {
    await page.goto('/login');
    await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
    const canvas = await page.locator('[data-testid="access-root"] canvas').first().elementHandle();
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
    await expect(page).toHaveURL(/\/recuperar$/);
    expect(await canvas!.evaluate((n) => n.isConnected)).toBe(true);
  });

  test('el indicador se desliza y el contenido entra animado; con "reducir movimiento", sin animaciones de cambio', async ({ page }) => {
    await page.goto('/login');
    await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
    const indicator = page.getByTestId('auth-tab-indicator');
    expect(await indicator.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0.2s');
    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/\/register$/);
    const running = await page.getByTestId('auth-card-viewport').evaluate((el) => el.getAnimations({ subtree: true }).length);
    expect(running).toBeGreaterThan(0);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('tab', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.getByTestId('auth-card-viewport').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await indicator.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  });
});

test.describe('P-14 · sin fotograma equivocado (U-30)', () => {
  test('con "Noche" guardada, el HTML de /login (antes de cualquier JS de la app) ya trae data-theme="dark"', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('paxfide.world-mode', 'night'));
    // Sin los scripts de la app: lo que se ve es el primer pintado (HTML y el script en línea)
    await page.route('**/_next/static/**/*.js', (route) => route.abort());
    await page.goto('/login');
    await expect(page.getByTestId('access-root')).toHaveAttribute('data-theme', 'dark');
  });

  test('negativa: con "Día" guardada, claro', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('paxfide.world-mode', 'day'));
    await page.route('**/_next/static/**/*.js', (route) => route.abort());
    await page.goto('/login');
    await expect(page.getByTestId('access-root')).toHaveAttribute('data-theme', 'light');
  });
});
