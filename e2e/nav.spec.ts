// Ref: prompts-agentes-estilo-v2.md VS-2 (foco y landmarks a 390 y 1280 px; cambio de posición por ancho);
// sistema-visual-paxfide-web-enmienda-1.md §8 (E4); respuesta de Carlos al plan de VS-2 (B, E).
import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  // A-3: el inicio por defecto es /home; pedir /panel sin sesión lo guarda como destino y se vuelve ahí tras entrar
  await page.goto('/panel');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Principal' });
const navLabels = (page: Page) => nav(page).getByRole('link').allTextContents();

/** Ninguna entrada se sale de la pantalla ni se solapa con otra (revisión de Carlos de la entrega de VS-2). */
async function expectEntriesInside(page: Page, width: number) {
  const boxes = await nav(page).getByRole('link').evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }));
  expect(boxes.length).toBeGreaterThan(0);
  const height = page.viewportSize()!.height;
  for (const b of boxes) {
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(width);
    expect(b.top).toBeGreaterThanOrEqual(0);
    expect(b.bottom).toBeLessThanOrEqual(height);
  }
  for (let i = 1; i < boxes.length; i++) {
    const [p, c] = [boxes[i - 1], boxes[i]];
    expect(c.left >= p.right - 0.5 || c.top >= p.bottom - 0.5, `entradas ${i - 1} y ${i} solapadas`).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

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
      const expected = width >= 768
        ? ['Inicio', 'Explorar', 'Donaciones', 'Seguimiento', 'Organización', 'Convocatorias', 'Lotes']
        : ['Inicio', 'Explorar', 'Donaciones', 'Seguimiento', 'Organización']; // DF7-20: con Inicio (A-3), justo 5
      // Espera a GET /me: las entradas de organización llegan con él
      await expect(nav(page).getByRole('link')).toHaveText(expected);
      await expect(nav(page).getByRole('link', { name: 'Organización' })).toHaveAttribute('aria-current', 'page');
      expect(await tabOrder(page)).toEqual(expected);
      if (width >= 768) {
        await nav(page).getByRole('link', { name: 'Convocatorias' }).click();
        await expect(page).toHaveURL(/\/panel\/campaigns$/);
        await expect(nav(page).getByRole('link', { name: 'Convocatorias' })).toHaveAttribute('aria-current', 'page');
        await expect(nav(page).getByRole('link', { name: 'Organización' })).not.toHaveAttribute('aria-current', /.*/);
      } else {
        // DF7-20: en pantalla estrecha, Convocatorias y Lotes no están en la página; se abren desde el panel
        await expect(page.locator('[data-testid="nav-convocatorias"], [data-testid="nav-lotes"]')).toHaveCount(0);
        await page.getByRole('main').getByRole('link', { name: 'Convocatorias de mi organización' }).click();
        await expect(page).toHaveURL(/\/panel\/campaigns$/);
        await expect(nav(page).getByRole('link', { name: 'Organización' })).toHaveAttribute('aria-current', 'page');
      }
    });

    test('cada entrada queda entera dentro de la pantalla y sin solaparse', async ({ page }) => {
      await login(page, 'admin@demo.test', 'demo-admin');
      await expectEntriesInside(page, width);
    });

    test('cuenta sin organización: no ve "Organización" (B)', async ({ page }) => {
      await login(page, 'donante@demo.test', 'demo-donante');
      await expect(nav(page).getByRole('link')).toHaveText(['Inicio', 'Explorar', 'Donaciones', 'Seguimiento']);
      const labels = await navLabels(page);
      expect(labels).not.toContain('Organización');
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

test('DF7-20: con Inicio (A-3) el ADMINISTRATOR tiene exactamente 5 entradas a 390 px y caben', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await login(page, 'admin@demo.test', 'demo-admin');
  await expect(nav(page).getByRole('link')).toHaveText(['Inicio', 'Explorar', 'Donaciones', 'Seguimiento', 'Organización']);
  await expectEntriesInside(page, 390);
});

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

test('las entradas sin ruta aprobada no aparecen en la barra (D5): Perfil, Ajustes y QR', async ({ page }) => {
  await login(page, 'admin@demo.test', 'demo-admin');
  for (const name of ['Perfil', 'Ajustes', 'QR']) await expect(nav(page).getByRole('link', { name })).toHaveCount(0);
});
