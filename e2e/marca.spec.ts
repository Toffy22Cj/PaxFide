// Iconos de la marca (logo oficial, scripts/marca/generar-iconos.py): favicon, iconos de app y manifiesto servidos, y el
// emblema cargado de verdad (no un enlace roto) donde se muestra la marca. Con MARCA_CAPTURAS=<carpeta> guarda capturas.
import { test, expect, type Page } from '@playwright/test';

const shots = process.env.MARCA_CAPTURAS;

async function emblemLoaded(page: Page, scope = page.locator('body')) {
  const img = scope.getByTestId('brand-mark').first();
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('alt', '');
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
}

test.describe('Marca', () => {
  test('favicon, iconos de app y manifiesto: enlazados en el <head> y servidos', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('head link[rel="icon"][href^="/favicon.ico"]')).toHaveCount(1);
    await expect(page.locator('head link[rel="icon"][href^="/icon.png"]')).toHaveCount(1);
    await expect(page.locator('head link[rel="apple-touch-icon"][href^="/apple-icon.png"]')).toHaveCount(1);
    await expect(page.locator('head link[rel="manifest"]')).toHaveCount(1);

    for (const path of ['/favicon.ico', '/icon.png', '/apple-icon.png', '/marca/paxfide-emblema.png',
      '/marca/icon-192.png', '/marca/icon-512.png', '/marca/icon-maskable-512.png']) {
      const r = await request.get(path);
      expect(r.status(), path).toBe(200);
      expect(r.headers()['content-type'], path).toMatch(/^image\//);
    }
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.name).toBe('PaxFide');
    expect(manifest.icons.map((i: { src: string }) => i.src)).toEqual(
      ['/marca/icon-192.png', '/marca/icon-512.png', '/marca/icon-maskable-512.png']);
  });

  for (const [path, name] of [['/', 'landing'], ['/login', 'acceso'], ['/tracking', 'cabecera']] as const) {
    test(`el emblema se carga en ${name} (${path})`, async ({ page }) => {
      await page.goto(path);
      await emblemLoaded(page);
      if (shots) {
        for (const theme of ['light', 'dark'] as const) {
          await page.emulateMedia({ colorScheme: theme });
          await page.screenshot({ path: `${shots}/${name}-${theme}-${page.viewportSize()?.width}.png`,
            clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: 140 } });
        }
      }
    });
  }

  test('en el acceso la marca sigue siendo una sola y su texto «PaxFide.» no cambia', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('access-brand')).toHaveCount(1);
    await expect(page.getByTestId('access-brand')).toHaveText('PaxFide.');
    await emblemLoaded(page, page.getByTestId('access-brand'));
  });
});
