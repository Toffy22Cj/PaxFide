// Ref: plan-fase7-fidelidad.md F-A1 y §1 (definición de terminado: ninguna superposición, E2E de cada animación con y
// sin "reducir movimiento" mirando el resultado, no la clase) y D-F2 (Auto / Noche / Día).
import { test, expect, type Page } from '@playwright/test';

const world = (page: Page) => page.getByTestId('world-background');
const root = (page: Page) => page.getByTestId('landing-root');

/** Lleva el centro de la sección `id` al centro de la ventana (sin desplazamiento suave). */
async function scrollToSection(page: Page, id: string, fraction = 0.5) {
  await page.evaluate(([i, f]) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const el = document.getElementById(i as string)!;
    window.scrollTo(0, el.offsetTop + el.offsetHeight * (f as number) - window.innerHeight / 2);
  }, [id, fraction] as const);
}

/** Entre dos paradas: un punto `p` (0–1) del camino entre el centro de `a` y el de `b`. */
async function scrollBetween(page: Page, a: string, b: string, p: number) {
  await page.evaluate(([x, y, q]) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const c = (id: string) => { const el = document.getElementById(id)!; return el.offsetTop + el.offsetHeight / 2; };
    window.scrollTo(0, c(x as string) + (c(y as string) - c(x as string)) * (q as number) - window.innerHeight / 2);
  }, [a, b, p] as const);
}

/** Huella de una franja del canvas: cambia si cambia el fotograma. */
const canvasSample = (page: Page) => world(page).evaluate((c: HTMLCanvasElement) => {
  const d = c.getContext('2d')!.getImageData(0, Math.floor(c.height * 0.3), c.width, Math.floor(c.height * 0.4)).data;
  let h = 0;
  for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0;
  return h;
});

const cardOpacity = (page: Page, i: number) =>
  page.locator(`[data-stop-card="${i}"]`).evaluate((el) => Number(getComputedStyle(el).opacity));

test.describe('Landing — fidelidad (F-A1)', () => {
  test.beforeEach(async ({ page }) => {
    // Empieza sin preferencia guardada, pero una recarga dentro del test la conserva
    await page.addInitScript(() => {
      try {
        if (!window.sessionStorage.getItem('e2e-limpio')) { window.localStorage.removeItem('paxfide.world-mode'); window.sessionStorage.setItem('e2e-limpio', '1'); }
      } catch { /* sin almacenamiento */ }
    });
  });

  for (const width of [390, 1100, 1280, 1400, 1786, 1920]) {
    test(`a ${width} px: cada control de la cabecera recibe el toque en su centro (la pausa no pisa "Donar")`, async ({ page }) => {
      await page.setViewportSize({ width, height: 860 });
      await page.goto('/');
      await expect(page.getByTestId('city-pause')).toBeVisible();
      if (width < 1180) await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
      const report = await page.getByRole('banner').evaluate((header) => {
        const out: string[] = [];
        for (const el of header.querySelectorAll<HTMLElement>('a, button')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!(at === el || el.contains(at))) out.push(`${(el.textContent || el.getAttribute('aria-label') || '').trim()} tapado por ${at?.textContent?.trim().slice(0, 20)}`);
          if (r.height < 44) out.push(`${(el.textContent || '').trim()}: ${r.height} px de alto`);
        }
        return out;
      });
      expect(report).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

  test('D-F2: en Auto, al bajar a la parada 4 llega la noche y la landing pasa a oscuro; en la 5 vuelve el día', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 860 });
    await page.goto('/');
    const toggle = page.getByTestId('world-mode');
    await expect(toggle).toHaveText('Auto (Día)');
    await expect(root(page)).toHaveAttribute('data-theme', 'light');
    await scrollToSection(page, 'parada-4');
    await expect(toggle).toHaveText('Auto (Noche)');
    await expect(root(page)).toHaveAttribute('data-theme', 'dark');
    // Las superficies toman los tokens oscuros: el texto de la tarjeta, claro
    const color = await page.locator('[data-stop-card="3"] h2').evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(238, 246, 239)');
    await scrollToSection(page, 'parada-3');
    await expect(toggle).toHaveText('Auto (Ocaso)');
    await scrollToSection(page, 'parada-5');
    await expect(toggle).toHaveText('Auto (Día)');
    await expect(root(page)).toHaveAttribute('data-theme', 'light');
  });

  test('D-F2: con "Día", la parada 4 sigue de día (negativa) y la elección se mantiene al recargar', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 860 });
    await page.goto('/');
    const toggle = page.getByTestId('world-mode');
    await toggle.click(); // Noche
    await expect(toggle).toHaveText('Noche');
    await toggle.click(); // Día
    await expect(toggle).toHaveText('Día');
    await scrollToSection(page, 'parada-4');
    await expect(world(page)).toHaveAttribute('data-night', '0.00');
    await expect(root(page)).not.toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.getByTestId('world-mode')).toHaveText('Día');
    expect(await page.evaluate(() => window.localStorage.getItem('paxfide.world-mode'))).toBe('day');
  });

  test('D-F2: sin "reducir movimiento" la noche se mezcla con el scroll; con él, salta de parada en parada', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto('/');
    await scrollBetween(page, 'parada-2', 'parada-3', 0.5);
    // Entre la 2 (0,12) y la 3 (0,65): un valor intermedio, ni el de una parada ni el de la otra
    await expect.poll(async () => Number(await world(page).getAttribute('data-night'))).toBeGreaterThan(0.2);
    expect(Number(await world(page).getAttribute('data-night'))).toBeLessThan(0.6);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await scrollBetween(page, 'parada-2', 'parada-3', 0.4);
    await expect(world(page)).toHaveAttribute('data-night', '0.12'); // la parada 2 entera, sin mezcla
    await scrollBetween(page, 'parada-2', 'parada-3', 0.6);
    await expect(world(page)).toHaveAttribute('data-night', '0.65');
  });

  test('recorrido por scroll sin "reducir movimiento": de la parada 1 a la 2 cambia el fotograma, la vista y la tarjeta', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto('/');
    await expect(world(page)).toHaveAttribute('data-loop', 'animate');
    await expect.poll(() => cardOpacity(page, 0)).toBe(1);
    expect(await cardOpacity(page, 1)).toBe(0);
    const before = await canvasSample(page);
    await scrollToSection(page, 'parada-2');
    // La cámara vuela (vistas intermedias) hasta quedarse en 1
    await expect.poll(async () => Number(await world(page).getAttribute('data-view'))).toBe(1);
    expect(await canvasSample(page)).not.toBe(before);
    expect(await cardOpacity(page, 1)).toBe(1);
    expect(await cardOpacity(page, 0)).toBe(0);
    await expect(page.locator('[data-stop-card="1"]')).toContainText('02 / 05');
  });

  test('recorrido con "reducir movimiento": los mismos cambios, sin bucle ni vista intermedia', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto('/');
    await expect(world(page)).toHaveAttribute('data-loop', 'still');
    const before = await canvasSample(page);
    await scrollToSection(page, 'parada-2');
    await expect(world(page)).toHaveAttribute('data-view', '1.00');
    expect(await canvasSample(page)).not.toBe(before);
    expect(await cardOpacity(page, 1)).toBe(1);
    expect(await cardOpacity(page, 0)).toBe(0);
    // A mitad de camino tampoco hay vista intermedia (salta de parada en parada)
    await scrollBetween(page, 'parada-2', 'parada-3', 0.45);
    await expect(world(page)).toHaveAttribute('data-view', '1.00');
  });

  test('al llegar a las convocatorias el mundo se desenfoca, con transición; con "reducir movimiento", sin ella', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto('/');
    await expect(world(page)).toHaveAttribute('data-blurred', 'false');
    expect(await world(page).evaluate((c) => getComputedStyle(c).filter)).toBe('none');
    await scrollToSection(page, 'convocatorias', 0.2);
    await expect(world(page)).toHaveAttribute('data-blurred', 'true');
    await expect.poll(() => world(page).evaluate((c) => getComputedStyle(c).filter)).toContain('blur(5px)');
    expect(await world(page).evaluate((c) => getComputedStyle(c).transitionDuration)).not.toMatch(/^0s(, 0s)*$/);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await world(page).evaluate((c) => getComputedStyle(c).transitionDuration)).toMatch(/^0s(, 0s)*$/);
    await scrollToSection(page, 'parada-1');
    await expect(world(page)).toHaveAttribute('data-blurred', 'false');
  });
});
