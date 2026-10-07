import { test, expect, Page } from '@playwright/test';

function future(days: number) {
  const d = new Date(Date.now() + days * 86400000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

async function createCampaign(page: Page, title: string, visibility: 'PUBLIC' | 'PRIVATE_LINK') {
  await page.getByRole('button', { name: 'Crear convocatoria' }).click();
  await page.getByLabel('Título').fill(title);
  await page.getByLabel(/Visibilidad/).selectOption(visibility);
  await page.getByLabel(/^Inicio/).fill(future(1));
  await page.getByLabel(/^Fin/).fill(future(30));
  await page.getByLabel('Especie (bienes)').check();
  await page.getByRole('button', { name: 'Crear convocatoria' }).last().click();
  await expect(page.getByText('Convocatoria creada')).toBeVisible();
}

async function allDiscoveryTitles(page: Page): Promise<string[]> {
  await page.goto('/campaigns');
  await expect(page.getByTestId('discovery-item').first()).toBeVisible();
  for (let i = 0; i < 20; i++) {
    const more = page.getByRole('button', { name: 'Cargar más' });
    if (!(await more.isVisible())) break;
    const before = await page.getByTestId('discovery-item').count();
    await more.click();
    await expect.poll(() => page.getByTestId('discovery-item').count()).toBeGreaterThan(before);
  }
  return page.getByTestId('discovery-item').getByRole('heading').allTextContents();
}

test.describe('P2-A — registro, descubrimiento y narrativa', () => {
  test('crear cuenta por la interfaz y entrar con ella (sin organización: sin entradas de organización)', async ({ page }) => {
    const email = `nueva-${Date.now()}@demo.test`;
    await page.goto('/login');
    await page.getByRole('link', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo-larga');
    await page.getByLabel('Repite la contraseña').fill('clave-demo-larga');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Cuenta creada')).toBeVisible();

    // El mismo correo otra vez → 409
    await page.goto('/register');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo-larga');
    await page.getByLabel('Repite la contraseña').fill('clave-demo-larga');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Ya existe una cuenta con ese correo.')).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill('clave-demo-larga');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByRole('link', { name: 'Mis donaciones' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Convocatorias de mi organización' })).toHaveCount(0);
  });

  test('descubrimiento: aparece la convocatoria pública y nunca la de enlace privado', async ({ page, browser }) => {
    const stamp = Date.now();
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@demo.test');
    await page.getByLabel('Contraseña').fill('demo-admin');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.getByRole('link', { name: 'Convocatorias de mi organización' }).click();
    await createCampaign(page, `Pública ${stamp}`, 'PUBLIC');
    await createCampaign(page, `Privada ${stamp}`, 'PRIVATE_LINK');

    const visitor = await (await browser.newContext()).newPage();
    const titles = await allDiscoveryTitles(visitor);
    expect(titles).toContain(`Pública ${stamp}`);
    expect(titles).not.toContain(`Privada ${stamp}`);
    await visitor.getByRole('link', { name: `Pública ${stamp}` }).click();
    await expect(visitor.getByRole('heading', { level: 1, name: `Pública ${stamp}` })).toBeVisible();
  });

  test('narrativa de la convocatoria: pendiente → Actualizar → disponible, con los hechos aparte', async ({ page }) => {
    await page.goto('/c/01JDEMOPUBLICC0DEINKIND01');
    await expect(page.getByText('El relato se está generando.')).toBeVisible();
    await expect(page.getByText('Receptores distintos')).toBeVisible();
    await page.getByRole('button', { name: 'Actualizar' }).click();
    await expect(page.getByTestId('campaign-narrative')).toContainText('La convocatoria avanza');
  });
});
