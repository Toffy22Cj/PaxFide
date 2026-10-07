import { test, expect } from '@playwright/test';

test.describe('Login por la interfaz (ID-01) y PanelHome con /me (N1)', () => {
  test('credenciales correctas → /panel con las entradas del rol; JWT solo hacia el backend', async ({ page }) => {
    const nextRequestsWithAuth: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.port === '3000' && r.headers()['authorization']) nextRequestsWithAuth.push(u.pathname);
    });

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@demo.test');
    await page.getByLabel('Contraseña').fill('demo-admin');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Panel' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Convocatorias de mi organización' })).toBeVisible();
    expect(nextRequestsWithAuth).toEqual([]);
    // El JWT no aparece en la URL ni en ningún almacenamiento
    expect(page.url()).not.toContain('tok-');
    const stored = await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage) + document.cookie);
    expect(stored).not.toContain('tok-');
  });

  test('credenciales incorrectas y cuenta inexistente → el mismo mensaje', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@demo.test');
    await page.getByLabel('Contraseña').fill('mala');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.locator('main').getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');

    await page.getByLabel('Correo electrónico').fill('nadie@demo.test');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.locator('main').getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('/me no disponible en el backend → aviso "No disponible", sin inventar roles', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('sin-me@demo.test');
    await page.getByLabel('Contraseña').fill('demo-sin-me');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByTestId('unavailable-state')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Convocatorias de mi organización' })).toHaveCount(0);
  });

  test('cerrar sesión desde el Shell → /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('empleado@demo.test');
    await page.getByLabel('Contraseña').fill('demo-empleado');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/panel$/);
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0);
  });
});
