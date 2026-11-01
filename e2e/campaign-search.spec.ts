// Ref: plan-fase7-puesta-al-dia.md Anexo 3, P-12 (A3.4) contra el servidor falso, que sigue la ficha R-1.
import { test, expect, type APIRequestContext } from '@playwright/test';
import crypto from 'crypto';

const API = 'http://localhost:3002';
const stamp = () => crypto.randomUUID().slice(0, 8);
async function campaign(request: APIRequestContext, data: Record<string, unknown>) {
  return (await (await request.post(`${API}/__test/campaigns`, { data })).json()).publicCode as string;
}

test.describe('P-12 · búsqueda en /campaigns', () => {
  test('validación: " a " no se envía; buscar encuentra por título sin tildes ni mayúsculas; la URL lo conserva sin cursor', async ({ page, request }) => {
    const key = `Búsqueda ${stamp()}`;
    await campaign(request, { title: `Mercados ${key}` });
    const sent: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/v1/public/campaigns')) sent.push(r.url()); });
    await page.goto('/campaigns');
    await expect(page.getByTestId('discovery-item').first()).toBeVisible();
    await page.getByLabel('Buscar por nombre').fill(' a ');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByTestId('discovery-query-error')).toHaveText('Escribe al menos 2 caracteres');
    for (const u of sent) expect(new URL(u).searchParams.has('q')).toBe(false);

    await page.getByLabel('Buscar por nombre').fill(key.toUpperCase().replace('Ú', 'U'));
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.getByTestId('discovery-item')).toHaveCount(1);
    await expect(page.getByTestId('discovery-item')).toContainText(`Mercados ${key}`);
    await expect(page).toHaveURL(/\/campaigns\?q=/);
    expect(page.url()).not.toContain('cursor');
    await page.reload();
    await expect(page.getByTestId('discovery-item')).toHaveCount(1);
    await expect(page.getByLabel('Buscar por nombre')).not.toHaveValue('');
  });

  test('PRIVATE_LINK y CLOSED nunca aparecen, tampoco al buscar su título exacto; cero resultados con "Quitar filtros"', async ({ page, request }) => {
    const key = `Oculta ${stamp()}`;
    await campaign(request, { title: `Privada ${key}`, visibility: 'PRIVATE_LINK' });
    await campaign(request, { title: `Cerrada ${key}`, status: 'CLOSED' });
    for (const exact of [`Privada ${key}`, `Cerrada ${key}`]) {
      await page.goto(`/campaigns?q=${encodeURIComponent(exact)}`);
      await expect(page.getByTestId('discovery-no-results')).toContainText('No encontramos convocatorias con esa búsqueda.');
      await expect(page.getByTestId('discovery-item')).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Quitar filtros' }).click();
    await expect(page.getByTestId('discovery-item').first()).toBeVisible();
    await expect(page).toHaveURL(/\/campaigns$/);
  });

  test('tipo de donación: "Especie (bienes)" solo trae las que lo aceptan; "atrás" sale de /campaigns (replace)', async ({ page }) => {
    await page.goto('/');
    await page.goto('/campaigns');
    await expect(page.getByTestId('discovery-item').first()).toBeVisible();
    await page.getByRole('button', { name: 'Especie (bienes)' }).click();
    await expect(page).toHaveURL(/tipo=especie/);
    await expect(page.getByTestId('discovery-item').filter({ hasText: 'Ropa de abrigo' })).toBeVisible();
    await expect(page.getByTestId('discovery-item').filter({ hasText: 'Mercados para adultos mayores' })).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/localhost:3000\/$/);
  });

  test('"Cargar más" con cursor y, al cambiar el orden, la lista empieza de nuevo sin cursor', async ({ page, request }) => {
    const key = `Página ${stamp()}`;
    for (let i = 0; i < 22; i++) await campaign(request, { title: `${key} ${String(i).padStart(2, '0')}` });
    const sent: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/v1/public/campaigns?')) sent.push(r.url()); });
    await page.goto(`/campaigns?q=${encodeURIComponent(key)}`);
    await expect(page.getByTestId('discovery-item')).toHaveCount(20);
    await page.getByRole('button', { name: 'Cargar más' }).click();
    await expect(page.getByTestId('discovery-item')).toHaveCount(22);
    expect(new URL(sent[sent.length - 1]).searchParams.has('cursor')).toBe(true);
    await page.getByLabel('Ordenar').selectOption('ending_soon');
    await expect(page.getByTestId('discovery-item')).toHaveCount(20);
    const last = new URL(sent[sent.length - 1]);
    expect(last.searchParams.get('sort')).toBe('ending_soon');
    expect(last.searchParams.has('cursor')).toBe(false);
  });

  test('la portada lleva "Buscar convocatorias" a /campaigns (U-20)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('landing-search-link').click();
    await expect(page).toHaveURL(/\/campaigns$/);
  });
});

test('U-23: "Cierran pronto" en /home viene de sort=ending_soon', async ({ page, request }) => {
  const soon = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
  const title = `Cierra en 3 días ${stamp()}`;
  await campaign(request, { title, endDate: soon });
  const sent: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/api/v1/public/campaigns')) sent.push(r.url()); });
  await page.goto('/home');
  await page.getByLabel('Correo electrónico').fill('donante@demo.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('demo-donante');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  const card = page.getByTestId('home-campaigns');
  await expect(card.getByRole('heading', { name: 'Cierran pronto' })).toBeVisible();
  await expect(card).toContainText(title);
  expect(sent.some((u) => new URL(u).searchParams.get('sort') === 'ending_soon')).toBe(true);
});
