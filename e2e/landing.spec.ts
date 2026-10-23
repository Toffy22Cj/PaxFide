// Ref: plan-fase7-pantallas.md A-2 (tests), D-P2–D-P5; prompts-agentes-estilo-v2.md VS-4; enmienda R-F1–R-F7.
import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:3002';
const world = (page: Page) => page.getByTestId('world-background');
const frames = (page: Page) => world(page).evaluate((c) => Number(c.getAttribute('data-frames') ?? '0'));
const view = (page: Page) => world(page).evaluate((c) => Number(c.getAttribute('data-view') ?? '-1'));
const idle = (page: Page, ms: number) => page.evaluate((t) => new Promise((r) => setTimeout(r, t)), ms);

async function countRaf(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __raf: number };
    w.__raf = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb: FrameRequestCallback) => { w.__raf++; return orig(cb); };
  });
}
const rafCalls = (page: Page) => page.evaluate(() => (window as unknown as { __raf: number }).__raf);

test.describe('Landing (VS-4)', () => {
  test('el mundo del recorrido va detrás, animado y decorativo; en / no hay ciudad (D-P2)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu donación, de principio a fin.');
    await expect(world(page)).toHaveCount(1);
    await expect(world(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('city-background')).toHaveCount(0);
    await expect(world(page)).toHaveAttribute('data-loop', 'animate');
    const f0 = await frames(page);
    await expect.poll(() => frames(page)).toBeGreaterThan(f0 + 5);
    await expect(page.getByTestId('city-pause')).toHaveAccessibleName('Pausar animación');
  });

  test('el scroll guía la vista: arriba la primera parada, en la tercera la vista llega a 2', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => view(page)).toBe(0);
    await page.locator('#parada-3').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect.poll(() => view(page), { timeout: 5000 }).toBeCloseTo(2, 1);
  });

  test('ninguna petición sale del propio origen o del backend (sin fuentes ni imágenes externas)', async ({ page }) => {
    const hosts = new Set<string>();
    page.on('request', (r) => hosts.add(new URL(r.url()).host));
    await page.goto('/');
    await expect(page.getByTestId('landing-campaigns')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await idle(page, 500);
    expect([...hosts].sort()).toEqual(['localhost:3000', 'localhost:3002']);
  });

  test('convocatorias abiertas del backend: logo del backend, "Verificada", enlace a /c/:publicCode; nunca PRIVATE_LINK', async ({ page, request }) => {
    const stamp = Date.now();
    await request.post(`${API}/__test/campaigns`, { data: { title: `Privada ${stamp}`, visibility: 'PRIVATE_LINK' } });
    const list = await (await request.get(`${API}/api/v1/public/campaigns`)).json();
    expect(list.items.map((i: { title: string }) => i.title)).not.toContain(`Privada ${stamp}`);
    await page.goto('/');
    const cards = page.getByTestId('landing-campaigns').getByTestId('campaign-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeLessThanOrEqual(6);
    await expect(page.getByText(`Privada ${stamp}`)).toHaveCount(0);
    const demo = cards.filter({ hasText: 'Mercados para adultos mayores' });
    await expect(demo.getByTestId('campaign-verified')).toHaveText('Verificada');
    const logo = demo.getByTestId('campaign-logo');
    await expect(logo).toHaveAttribute('src', /^http:\/\/localhost:3002\/api\/v1\/public\/campaigns\/[^/]+\/organization-logo$/);
    await logo.scrollIntoViewIfNeeded(); // carga diferida: se pide al acercarse
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await demo.getByRole('link', { name: 'Mercados para adultos mayores' }).click();
    await expect(page).toHaveURL(/\/c\/[^/]+$/);
  });

  test('el seguimiento demostrativo lleva "Ejemplo" y no hace ninguna petición', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-campaigns')).toBeVisible();
    const after: string[] = [];
    // Peticiones de datos al backend (fetch/XHR). No cuentan el logo (carga diferida al desplazarse) ni la precarga
    // de enlaces de Next.js, que va al propio origen
    page.on('request', (r) => { if (r.url().startsWith(API) && ['fetch', 'xhr'].includes(r.resourceType())) after.push(r.url()); });
    await page.getByTestId('example-toggle').click();
    await expect(page.getByTestId('tracking-example')).toContainText('Ejemplo');
    await idle(page, 400);
    expect(after).toEqual([]);
    await expect(page.getByText('20.000.000')).toHaveCount(0);
  });

  test('R-F3: con "reducir movimiento", ningún requestAnimationFrame; la vista salta de parada en parada', async ({ page }) => {
    await countRaf(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(world(page)).toHaveAttribute('data-loop', 'still');
    await expect.poll(() => frames(page)).toBeGreaterThan(0);
    const r0 = await rafCalls(page), f0 = await frames(page);
    await idle(page, 1000);
    expect(await rafCalls(page)).toBe(r0);
    expect(await frames(page)).toBe(f0);
    await page.locator('#parada-2').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect.poll(() => view(page)).toBe(1);
    expect(await rafCalls(page)).toBe(r0);
    await expect(page.getByTestId('city-pause')).toHaveCount(0);
  });

  test('R-F2: la pausa es la misma que la de la ciudad y se recuerda', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('city-pause').click();
    await expect(world(page)).toHaveAttribute('data-loop', 'still');
    const f0 = await frames(page);
    await idle(page, 800);
    expect(await frames(page)).toBe(f0);
    await page.reload();
    await expect(world(page)).toHaveAttribute('data-loop', 'still');
    await page.goto('/campaigns');
    await expect(page.getByTestId('city-background')).toHaveAttribute('data-loop', 'still');
    await page.getByTestId('city-pause').click();
    await page.goto('/');
    await expect(world(page)).toHaveAttribute('data-loop', 'animate');
  });

  test('R-F4: con la pestaña oculta no hay bucle', async ({ page }) => {
    await countRaf(page);
    await page.goto('/');
    await expect(world(page)).toHaveAttribute('data-loop', 'animate');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(world(page)).toHaveAttribute('data-loop', 'off');
    await idle(page, 150);
    const r0 = await rafCalls(page);
    await idle(page, 800);
    expect(await rafCalls(page)).toBe(r0);
  });

  test('R-F7: el canvas no recibe foco con Tab', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('CANVAS');
    }
  });

  for (const width of [390, 1280]) {
    test(`a ${width} px: sin scroll horizontal y las acciones miden al menos 44 px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 860 });
      await page.goto('/');
      await expect(page.getByTestId('landing-campaigns')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      for (const name of ['Ingresar', 'Seguir una donación', 'Donar']) {
        const b = (await page.getByRole('navigation', { name: 'Secciones de la página de inicio' }).getByRole('link', { name, exact: true }).boundingBox())!;
        expect(b.height, name).toBeGreaterThanOrEqual(44);
        expect(b.x + b.width, name).toBeLessThanOrEqual(width);
      }
    });
  }
});
