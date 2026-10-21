// Ref: prompts-agentes-estilo-v2.md VS-2 (foco y landmarks a 390 y 1280 px; cambio de posición por ancho);
// sistema-visual-paxfide-web-enmienda-1.md §8 (E4); respuesta de Carlos al plan de VS-2 (B, E).
import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Principal' });
const navLabels = (page: Page) => nav(page).getByRole('link').allTextContents();

/** Orden en que el tabulador recorre las entradas de la barra (desde la cabecera). */
async function tabOrder(page: Page): Promise<string[]> {
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  const seen: string[] = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el && el.closest('nav[aria-label="Principal"]') ? el.textContent?.trim() ?? '' : null;
    });
    if (info !== null && !seen.includes(info)) seen.push(info);
  }
  return seen;
}

for (const width of [390, 1280]) {
  test.describe(`Barra de navegación a ${width} px`, () => {
    test.use({ viewport: { width, height: 860 } });

    test('landmarks, posición por ancho y objetivos de 44 px', async ({ page }) => {
      await login(page, 'admin@demo.test', 'demo-admin');
      await expect(page.getByRole('banner')).toHaveCount(1);
      await expect(nav(page)).toHaveCount(1);
      await expect(page.getByRole('main')).toHaveCount(1);
      const shell = page.locator('[data-nav-position]');
      await expect(shell).toHaveAttribute('data-nav-position', width >= 768 ? 'side' : 'bottom');

      const box = (await nav(page).boundingBox())!;
      if (width >= 768) {
        expect(box.x).toBe(0);
        expect(box.height).toBeGreaterThan(box.width); // lateral
      } else {
        expect(Math.round(box.y + box.height)).toBe(860); // pegada abajo
        expect(box.width).toBe(width);
      }
      const navBox = (await nav(page).boundingBox())!;
      for (const link of await nav(page).getByRole('link').all()) {
        const b = (await link.boundingBox())!;
        if (width >= 768) { // ninguna etiqueta se sale de la barra lateral
          expect(b.x).toBeGreaterThanOrEqual(navBox.x);
          expect(b.x + b.width).toBeLessThanOrEqual(navBox.x + navBox.width);
        }
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(b.height).toBeGreaterThanOrEqual(44);
      }
      const logout = (await page.getByRole('button', { name: 'Cerrar sesión' }).boundingBox())!;
      expect(logout.height).toBeGreaterThanOrEqual(44);
    });

    test('ADMINISTRATOR: entradas, aria-current y orden de foco igual al visual', async ({ page }) => {
      await login(page, 'admin@demo.test', 'demo-admin');
      expect(await navLabels(page)).toEqual(['Explorar', 'Donaciones', 'Seguimiento', 'Organización', 'Convocatorias', 'Lotes']);
      await expect(nav(page).getByRole('link', { name: 'Organización' })).toHaveAttribute('aria-current', 'page');
      expect(await tabOrder(page)).toEqual(await navLabels(page));
      await nav(page).getByRole('link', { name: 'Convocatorias' }).click();
      await expect(page).toHaveURL(/\/panel\/campaigns$/);
      await expect(nav(page).getByRole('link', { name: 'Convocatorias' })).toHaveAttribute('aria-current', 'page');
      await expect(nav(page).getByRole('link', { name: 'Organización' })).not.toHaveAttribute('aria-current', /.*/);
    });

    test('cuenta sin organización: no ve "Organización" (B)', async ({ page }) => {
      await login(page, 'donante@demo.test', 'demo-donante');
      const labels = await navLabels(page);
      expect(labels).toEqual(['Explorar', 'Donaciones', 'Seguimiento']);
      expect(labels).not.toContain('Organización');
    });

    test('todas las entradas caben o se alcanzan desplazando la barra, y la activa queda a la vista', async ({ page }) => {
      await login(page, 'admin@demo.test', 'demo-admin');
      await nav(page).getByRole('link', { name: 'Lotes' }).click();
      await expect(page).toHaveURL(/\/panel\/assets$/);
      const lotes = nav(page).getByRole('link', { name: 'Lotes' });
      await expect(lotes).toHaveAttribute('aria-current', 'page');
      await expect(lotes).toBeInViewport({ ratio: 0.99 });
      // La página no se desplaza en horizontal por culpa de la barra
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      for (const link of await nav(page).getByRole('link').all()) {
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeInViewport({ ratio: 0.99 });
      }
    });

    test('la barra no tapa el contenido', async ({ page }) => {
      await login(page, 'admin@demo.test', 'demo-admin');
      const main = (await page.getByRole('main').boundingBox())!;
      const bar = (await nav(page).boundingBox())!;
      if (width >= 768) {
        expect(main.x).toBeGreaterThanOrEqual(bar.x + bar.width);
      } else {
        const pad = await page.getByRole('main').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
        expect(pad).toBeGreaterThanOrEqual(bar.height);
      }
    });
  });
}

test('al redimensionar, la barra cambia de posición (bottom ↔ side)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/login');
  const shell = page.locator('[data-nav-position]');
  await expect(shell).toHaveAttribute('data-nav-position', 'side');
  await page.setViewportSize({ width: 767, height: 860 });
  await expect(shell).toHaveAttribute('data-nav-position', 'bottom');
  await page.setViewportSize({ width: 768, height: 860 });
  await expect(shell).toHaveAttribute('data-nav-position', 'side');
});

test('una superficie deshabilitada no aparece en la barra (D5): Inicio (/home) no está en la lista', async ({ page }) => {
  await login(page, 'admin@demo.test', 'demo-admin');
  await expect(nav(page).getByRole('link', { name: 'Inicio' })).toHaveCount(0);
  for (const name of ['Perfil', 'Ajustes', 'QR']) await expect(nav(page).getByRole('link', { name })).toHaveCount(0);
});
