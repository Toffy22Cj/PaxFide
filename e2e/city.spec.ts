// Ref: plan-fase7-pantallas.md A-1 (E2E del fondo animado) y D-P2; sistema-visual-paxfide-web-enmienda-1.md R-F1–R-F7.
import { test, expect, type Page } from '@playwright/test';

const city = (page: Page) => page.getByTestId('city-background');
const frames = (page: Page) => city(page).evaluate((c) => Number(c.getAttribute('data-frames') ?? '0'));

/** Cuenta las llamadas a requestAnimationFrame de toda la página. */
async function countRaf(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __raf: number };
    w.__raf = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb: FrameRequestCallback) => { w.__raf++; return orig(cb); };
  });
}
const rafCalls = (page: Page) => page.evaluate(() => (window as unknown as { __raf: number }).__raf);
const idle = (page: Page, ms: number) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);

async function login(page: Page, email: string, password: string) {
  // A-3: el inicio por defecto es /home; pedir /panel sin sesión lo guarda como destino y se vuelve ahí tras entrar
  await page.goto('/panel');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test.describe('Fondo animado (VS-3)', () => {
  test('está en /campaigns, animado y decorativo; no está en /login ni en /panel (D-P2)', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(city(page)).toHaveCount(1);
    await expect(city(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(city(page)).toHaveAttribute('data-loop', 'animate');
    const f0 = await frames(page);
    await expect.poll(() => frames(page)).toBeGreaterThan(f0 + 5);
    await page.goto('/login');
    await expect(city(page)).toHaveCount(0);
    await login(page, 'admin@demo.test', 'demo-admin');
    await expect(city(page)).toHaveCount(0);
    await expect(page.getByTestId('city-pause')).toHaveCount(0);
  });

  test('R-F1: el contenido va sobre la superficie translúcida, no directamente sobre la ciudad', async ({ page }) => {
    await page.goto('/campaigns');
    const bg = await page.getByRole('main').evaluate((el) => getComputedStyle(el).backgroundColor);
    // U-17 (P-9): 0,82 con desenfoque
    expect(bg).toBe('rgba(255, 255, 255, 0.82)');
    const filter = await page.getByRole('main').evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(filter).toBe('blur(20px) saturate(1.2)');
  });

  test('R-F3: con "reducir movimiento", un fotograma quieto y ninguna llamada a requestAnimationFrame', async ({ page }) => {
    await countRaf(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/campaigns');
    await expect(city(page)).toHaveAttribute('data-loop', 'still');
    await expect.poll(() => frames(page)).toBeGreaterThan(0);
    const r0 = await rafCalls(page), f0 = await frames(page);
    await idle(page, 1200);
    expect(await rafCalls(page)).toBe(r0);
    expect(await frames(page)).toBe(f0);
    // Sin nada que pausar, no hay botón de pausa
    await expect(page.getByTestId('city-pause')).toHaveCount(0);
  });

  test('R-F2: la pausa detiene el bucle y se recuerda al recargar', async ({ page }) => {
    await countRaf(page);
    await page.goto('/campaigns');
    const pause = page.getByTestId('city-pause');
    await expect(pause).toHaveAccessibleName('Pausar animación');
    await pause.click();
    await expect(city(page)).toHaveAttribute('data-loop', 'still');
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await expect(pause).toHaveAccessibleName('Reanudar animación');
    await idle(page, 150);
    const r0 = await rafCalls(page), f0 = await frames(page);
    await idle(page, 1000);
    expect(await rafCalls(page)).toBe(r0);
    expect(await frames(page)).toBe(f0);
    await page.reload();
    await expect(city(page)).toHaveAttribute('data-loop', 'still');
    await expect(page.getByTestId('city-pause')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('city-pause').click();
    await expect(city(page)).toHaveAttribute('data-loop', 'animate');
  });

  test('R-F4: con la pestaña oculta no hay bucle; al volver, sigue', async ({ page }) => {
    await countRaf(page);
    await page.goto('/campaigns');
    await expect(city(page)).toHaveAttribute('data-loop', 'animate');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(city(page)).toHaveAttribute('data-loop', 'off');
    await idle(page, 150);
    const r0 = await rafCalls(page), f0 = await frames(page);
    await idle(page, 1000);
    expect(await rafCalls(page)).toBe(r0);
    expect(await frames(page)).toBe(f0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(city(page)).toHaveAttribute('data-loop', 'animate');
    await expect.poll(() => frames(page)).toBeGreaterThan(f0);
  });

  test('R-F7: el canvas no recibe foco con Tab', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(city(page)).toHaveCount(1);
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('CANVAS');
    }
  });

  for (const width of [390, 1280]) {
    test(`a ${width} px el botón de pausa mide al menos 44 px y la cabecera no se desborda`, async ({ page }) => {
      await page.setViewportSize({ width, height: 860 });
      await page.goto('/campaigns');
      const b = (await page.getByTestId('city-pause').boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x + b.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});
