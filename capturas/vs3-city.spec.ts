// Ref: prompts-agentes-estilo-v2.md §4 (EVIDENCIA); plan-fase7-pantallas.md §1.5 y A-1. Capturas en claro (DF7-17) a
// 390 y 1280 px de las pantallas que ganan el fondo animado (D-P2) y habilitadas hoy en el arnés.
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');
const API = 'http://localhost:3002';

async function shot(page: Page, name: string, width: number) {
  await page.waitForTimeout(900); // la ciudad se mueve: unos fotogramas antes de capturar
  await page.screenshot({ path: path.join(OUT, `vs3-${name}__claro__${width}.png`), fullPage: true });
}

for (const width of [390, 1280]) {
  test(`vs3 ciudad ${width}`, async ({ page, request }) => {
    if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
    await page.setViewportSize({ width, height: 860 });
    await page.goto('/campaigns');
    await expect(page.getByTestId('city-background')).toHaveCount(1);
    await shot(page, 'campaigns', width);
    const { publicCode } = await (await request.post(`${API}/__test/campaigns`, { data: { title: 'Mercados para adultos mayores' } })).json();
    await page.goto(`/c/${publicCode}`);
    await expect(page.getByTestId('city-background')).toHaveCount(1);
    await shot(page, 'campaign-public', width);
    await page.goto('/tracking');
    await shot(page, 'tracking', width);
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('donante@demo.test');
    await page.getByLabel('Contraseña').fill('demo-donante');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/panel$/);
    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Donaciones' }).click();
    await expect(page).toHaveURL(/\/account\/donations$/);
    await shot(page, 'account-donations', width);
  });
}
