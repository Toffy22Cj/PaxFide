// Ref: plan-fase7-puesta-al-dia.md Anexo 2, U-17 y P-9 (inicio ancho y translúcido); plan-fase7-fidelidad.md §1.4.
import { test, expect, type Page } from '@playwright/test';

async function donorHome(page: Page) {
  await page.goto('/home');
  await page.getByLabel('Correo electrónico').fill('donante@demo.test');
  await page.getByLabel('Contraseña').fill('demo-donante');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByTestId('impact-card')).toBeVisible();
}

/** §1.4: cada control visible recibe su propio clic (elementFromPoint en su centro). */
async function overlaps(page: Page, scope: string): Promise<string[]> {
  return page.evaluate(async (sel) => {
    const root = document.querySelector(sel);
    if (!root) return [`sin ${sel}`];
    const bad: string[] = [];
    const controls = [...root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; });
    for (const el of controls) {
      el.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (!hit || !(hit === el || el.contains(hit) || (el.id && hit.closest(`label[for="${el.id}"]`)))) {
        bad.push(`${el.tagName.toLowerCase()}「${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}」 tapado por ${hit ? hit.tagName.toLowerCase() : 'nada'}`);
      }
    }
    return bad;
  }, scope);
}

test.describe('P-9 · inicio ancho y translúcido', () => {
  for (const width of [1280, 1920]) {
    test(`a ${width} px la rejilla mide más de 1000 px, con dos columnas, y nada se superpone`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await donorHome(page);
      const grid = page.getByTestId('home-grid');
      const box = (await grid.boundingBox())!;
      expect(box.width).toBeGreaterThan(1000);
      expect(box.width).toBeLessThanOrEqual(1200);
      const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      expect(cols).toBe(12);
      // "Seguir una donación" más ancha que "Sellado en blockchain", en la misma fila
      const track = (await page.getByRole('region', { name: 'Seguir una donación' }).boundingBox())!;
      const seal = (await page.getByRole('region', { name: 'Sellado en blockchain' }).boundingBox())!;
      expect(track.width).toBeGreaterThan(seal.width);
      expect(Math.abs(track.y - seal.y)).toBeLessThan(2);
      // La superficie es translúcida con desenfoque
      const main = page.getByRole('main');
      expect(await main.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('blur(20px) saturate(1.2)');
      expect(await overlaps(page, 'main')).toEqual([]);
      // La píldora "Sector" y "Ver ciudad" no se tapan, ni tapan el saludo
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await overlaps(page, 'body > div')).toEqual([]);
      const hud = (await page.getByTestId('city-hud').boundingBox())!;
      for (const id of ['home-greeting', 'home-avatar']) {
        const b = (await page.getByTestId(id).boundingBox())!;
        const apart = hud.y + hud.height <= b.y || b.y + b.height <= hud.y || hud.x + hud.width <= b.x || b.x + b.width <= hud.x;
        expect(apart, `${id} bajo la píldora "Sector"`).toBe(true);
      }
    });
  }

  test('a 390 px, una sola columna y sin scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await donorHome(page);
    const cols = await page.getByTestId('home-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
