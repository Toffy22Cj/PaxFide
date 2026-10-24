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
    await page.getByTestId('example-chip').first().click();
    await expect(page.getByTestId('tracking-example')).toContainText('EJEMPLO ILUSTRATIVO');
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
      // En estrecho, las secciones y los accesos van en el menú de la cabecera
      if (width < 1180) await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
      for (const name of ['Ingresar', 'Seguir donación', 'Donar']) {
        const b = (await page.getByRole('banner').getByRole('link', { name, exact: true }).filter({ visible: true }).boundingBox())!;
        expect(b.height, name).toBeGreaterThanOrEqual(44);
        expect(b.x + b.width, name).toBeLessThanOrEqual(width);
      }
    });
  }

  test('D-P13: en / una sola cabecera, la de la landing, con la pausa; sin la barra de la app; en /campaigns, la de siempre', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toHaveCount(1);
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'PaxFide, inicio' })).toHaveAttribute('href', '#parada-1');
    await expect(header.getByTestId('city-pause')).toHaveAccessibleName('Pausar animación');
    await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Seguimiento', exact: true })).toHaveCount(1);
    await page.goto('/campaigns');
    await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(1);
    await expect(page.getByTestId('city-pause')).toHaveCount(1);
  });

  test('a 390 px: menú desplegable con las secciones; un ancla lleva a su sección y cierra el menú', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 860 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Secciones de la página de inicio' });
    await expect(nav).toBeHidden();
    await expect(page.getByRole('banner').getByTestId('city-pause')).toBeVisible();
    await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
    await expect(nav).toBeVisible();
    await nav.getByRole('link', { name: 'Verificación' }).click();
    await expect(nav).toBeHidden();
    await expect(page).toHaveURL(/#parada-4$/);
  });

  test('R-F1: el canvas está detrás de cada bloque (nada del mundo por encima del contenido)', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('#parada-1 article');
    const b = (await card.boundingBox())!;
    for (const [x, y] of [[b.x + 30, b.y + 30], [b.x + b.width - 30, b.y + b.height - 30], [b.x + b.width / 2, b.y + b.height / 2]]) {
      // El primer elemento en ese punto es la tarjeta (el canvas no recibe eventos y está debajo)
      const inCard = await page.evaluate(([px, py]) => !!document.elementFromPoint(px, py)?.closest('#parada-1 article'), [x, y]);
      expect(inCard).toBe(true);
    }
    // Orden de apilado: el mundo (fijo, z-index 0) por debajo del contenido (z-index 1) y de la cabecera (20)
    const z = await page.evaluate(() => ({
      world: getComputedStyle(document.querySelector('[data-testid="world-background"]')!).zIndex,
      content: getComputedStyle(document.getElementById('contenido')!).zIndex,
      header: getComputedStyle(document.querySelector('header')!).zIndex,
    }));
    expect(z).toEqual({ world: '0', content: '1', header: '20' });
  });

  test('R-F3: con "reducir movimiento", cada parada es un fotograma quieto: a mitad de camino, ninguna vista intermedia ni transición', async ({ page }) => {
    await countRaf(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(world(page)).toHaveAttribute('data-loop', 'still');
    const r0 = await rafCalls(page);
    for (const id of ['#parada-2', '#parada-3']) {
      // A mitad entre dos paradas la vista sigue en una parada entera
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        window.scrollTo(0, el.offsetTop - window.innerHeight * 0.1);
      }, id);
      await idle(page, 300);
      expect(Number.isInteger(await view(page))).toBe(true);
    }
    expect(await rafCalls(page)).toBe(r0);
    // Sin transiciones en las tarjetas ni en el manifiesto, que está encendido entero desde el principio
    const card = await page.locator('#parada-2 article').evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(card.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
    const mani = page.getByTestId('manifesto');
    const words = await mani.evaluate((el) => (el.textContent ?? '').trim().split(/\s+/).length);
    await expect(mani).toHaveAttribute('data-lit', String(words));
  });

  test('sin "reducir movimiento", el manifiesto se enciende al llegar (negativa: arriba está apagado)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('manifesto')).toHaveAttribute('data-lit', '0');
    await page.locator('#recorrido').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect.poll(async () => Number(await page.getByTestId('manifesto').getAttribute('data-lit'))).toBeGreaterThan(10);
  });
});

