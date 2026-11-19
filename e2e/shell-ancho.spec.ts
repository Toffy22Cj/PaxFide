// 2026-11-19 (pedido de Manuel con capturas del panel a 1920 px): el contenido del shell era una columna estrecha de 720 px
// con media pantalla vacía, y una tabla ancha de un gráfico ensanchaba la tarjeta más allá de su borde. Aquí: el panel usa
// el ancho grande, el shell general es más ancho, una tabla ancha se desplaza dentro de su caja y ninguna etiqueta de eje
// se sale del gráfico. Contra el servidor falso.
import { test, expect, type Page } from '@playwright/test';

async function adminPanel(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/panel');
  await page.getByLabel('Correo electrónico').fill('admin@demo.test');
  await page.getByLabel('Contraseña').fill('demo-admin');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByTestId('charts-activity')).toBeVisible();
}

test.describe('Shell más ancho y gráficos que no se salen de su caja', () => {
  test('a 1920 px el panel usa el ancho grande (más de 1300 px) y el resto del shell supera los 1000 px', async ({ page }) => {
    await adminPanel(page, 1920);
    const panel = (await page.locator('main').first().boundingBox())!;
    expect(panel.width).toBeGreaterThan(1300);
    expect(panel.width).toBeLessThanOrEqual(1440);
    // otra pantalla del shell (el perfil de la cuenta, que antes era la más estrecha) también crece
    await page.getByRole('link', { name: 'Perfil' }).click();
    await expect(page).toHaveURL(/\/account$/);
    const account = (await page.locator('main').first().boundingBox())!;
    expect(account.width).toBeGreaterThan(1000);
  });

  test('a 1280 px el contenido llena el ancho disponible junto a la barra lateral, sin scroll horizontal', async ({ page }) => {
    await adminPanel(page, 1280);
    const main = (await page.locator('main').first().boundingBox())!;
    expect(main.width).toBeGreaterThan(1000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  });

  test('una tabla ancha de datos se desplaza dentro de su caja: no ensancha la tarjeta ni la página', async ({ page }) => {
    await adminPanel(page, 1280);
    const panel = page.getByTestId('charts-activity');
    const before = (await panel.boundingBox())!;
    // 8 columnas con encabezados largos, como los 8 tipos de evento de la captura que mandó Manuel
    await panel.evaluate((el) => {
      el.querySelectorAll('details').forEach((d) => { d.open = true; });
      const table = el.querySelector('table');
      if (!table) throw new Error('sin tabla');
      const row = table.querySelector('thead tr')!;
      for (let i = 0; i < 8; i++) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = `Convocatoria cerrada número ${i} (hecho)`;
        row.appendChild(th);
      }
      table.querySelectorAll('tbody tr').forEach((tr) => { for (let i = 0; i < 8; i++) tr.appendChild(document.createElement('td')).textContent = `${i} eventos`; });
    });
    const after = (await panel.boundingBox())!;
    expect(after.width).toBeLessThanOrEqual(before.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    // y el contenedor de la tabla es el que se desplaza
    const wrap = panel.locator('table').first().locator('xpath=..');
    expect(await wrap.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  });

  test('ninguna etiqueta de eje se sale del gráfico ni se monta con otra (antes, la última se cortaba: «sem. 19 r»)', async ({ page }) => {
    await adminPanel(page, 1280);
    const out = await page.getByTestId('charts-activity').evaluate((el) => {
      const bad: string[] = [];
      el.querySelectorAll('svg').forEach((svg) => {
        const box = svg.getBoundingClientRect();
        const rects: { text: string; r: DOMRect }[] = [];
        svg.querySelectorAll('text').forEach((t) => {
          const r = t.getBoundingClientRect();
          rects.push({ text: t.textContent ?? '', r });
          if (r.right > box.right + 0.5 || r.left < box.left - 0.5) bad.push(`${t.textContent} (${Math.round(r.left)}–${Math.round(r.right)} fuera de ${Math.round(box.left)}–${Math.round(box.right)})`);
        });
        // y dos etiquetas de la misma fila no se montan
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i].r, b = rects[j].r;
          if (Math.abs(a.bottom - b.bottom) < 1 && a.left < b.right - 0.5 && b.left < a.right - 0.5) bad.push(`«${rects[i].text}» se monta con «${rects[j].text}»`);
        }
      });
      return bad;
    });
    expect(out).toEqual([]);
  });
});
