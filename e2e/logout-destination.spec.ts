// Ref: plan-fase7-puesta-al-dia.md Anexo 2, A2.5 (U-18, U-19) y P-11.
import { test, expect, type Page } from '@playwright/test';

async function loginAt(page: Page, path: string, email = 'admin@demo.test', password = 'demo-admin') {
  await page.goto(path);
  // Una ruta autenticada lleva sola al login (con destino); en una pública se entra por el enlace de la cabecera (U-19)
  if (path === '/campaigns') await page.getByRole('banner').getByRole('link', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test.describe('P-11 · salida al cerrar sesión', () => {
  for (const path of ['/home', '/panel', '/campaigns']) {
    test(`cerrar sesión en ${path} termina en /login con "Cerraste sesión."`, async ({ page }) => {
      await loginAt(page, path);
      if (path === '/campaigns') {
        // Desde /campaigns el enlace lleva al login sin destino: tras entrar, el inicio; se vuelve a /campaigns en la app
        await expect(page).toHaveURL(/\/home$/);
        await page.getByRole('link', { name: 'Explorar' }).first().click();
      }
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await page.getByRole('button', { name: 'Cerrar sesión' }).click();
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByText('Cerraste sesión.')).toBeVisible();
    });
  }

  test('negativa del destino guardado: tras cerrar sesión en /panel, iniciarla de nuevo lleva al inicio', async ({ page }) => {
    await loginAt(page, '/panel');
    await expect(page).toHaveURL(/\/panel$/);
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Correo electrónico').fill('admin@demo.test');
    await page.getByLabel('Contraseña').fill('demo-admin');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/home$/);
  });

  test('tras cerrar sesión, history.back() no muestra contenido con sesión', async ({ page }) => {
    await loginAt(page, '/panel');
    await expect(page).toHaveURL(/\/panel$/);
    await page.getByRole('link', { name: 'Inicio' }).first().click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId('home-content')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.evaluate(() => history.back());
    await page.waitForTimeout(800);
    await expect(page.getByTestId('home-content')).toHaveCount(0);
    await expect(page.getByTestId('profile-screen')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  for (const path of ['/campaigns', '/tracking']) {
    test(`sin sesión en ${path}, la cabecera muestra "Iniciar sesión" y lleva a /login`, async ({ page }) => {
      await page.goto(path);
      const link = page.getByRole('banner').getByRole('link', { name: 'Iniciar sesión' });
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test('en /login y /register no aparece el enlace de la cabecera', async ({ page }) => {
    for (const path of ['/login', '/register']) {
      await page.goto(path);
      await expect(page.getByTestId('login-link')).toHaveCount(0);
    }
  });
});
