import { test, expect } from '@playwright/test';

test.describe('Session Guards (T-4)', () => {
  test('logout → atrás ⇒ sin contenido autenticado (bfcache invariant)', async ({ page }) => {
    // 1. Ir a login y loguearse en una sola pestaña
    await page.goto('/login');
    await page.waitForFunction(() => !!(window as any).__TEST_SESSION__);
    await page.evaluate(() => (window as any).__TEST_SESSION__.login('fake-jwt-token'));
    await expect(page).toHaveURL(/\/panel/);
    await expect(page.locator('data-testid=panel-content')).toBeVisible();

    // 2. Navegar a otra página protegida para guardar /panel en el historial
    await page.click('data-testid=campaigns-link');
    await expect(page).toHaveURL(/\/panel\/campaigns/);
    await expect(page.locator('data-testid=campaigns-title')).toBeVisible();

    // 3. Hacer logout desde la segunda página protegida
    await page.evaluate(() => (window as any).__TEST_SESSION__.logout());
    await page.waitForURL(/\/login/);

    // 4. Ir atrás (debería intentar ir a /panel)
    await page.evaluate(() => window.history.back());

    // 5. Deberíamos ser expulsados inmediatamente a /login (o no ver el contenido)
    await expect(page.locator('data-testid=panel-content')).not.toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout en la pestaña A ⇒ la pestaña B pasa a LOGGED_OUT', async ({ context }) => {
    // Pestaña A: login
    const pageA = await context.newPage();
    await pageA.goto('/login');
    await pageA.waitForFunction(() => !!(window as any).__TEST_SESSION__);
    await pageA.evaluate(() => (window as any).__TEST_SESSION__.login('fake-jwt-token'));
    await expect(pageA).toHaveURL(/\/panel/);

    // Pestaña B: ir a login y establecer su propia sesión
    const pageB = await context.newPage();
    await pageB.goto('/login');
    await pageB.waitForFunction(() => !!(window as any).__TEST_SESSION__);
    await pageB.evaluate(() => (window as any).__TEST_SESSION__.login('fake-jwt-token'));
    await expect(pageB).toHaveURL(/\/panel/);
    await expect(pageB.locator('data-testid=panel-content')).toBeVisible();

    // Pestaña A: hacer logout
    await pageA.evaluate(() => (window as any).__TEST_SESSION__.logout());
    await expect(pageA).toHaveURL(/\/login/);

    // Pestaña B: debería ser redirigida a /login sin interacción porque recibe el LOGOUT_SIGNAL
    await expect(pageB).toHaveURL(/\/login/);
  });

  test('superficie deshabilitada ⇒ 404 también con sesión', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.waitForFunction(() => !!(window as any).__TEST_SESSION__);
    await page.evaluate(() => (window as any).__TEST_SESSION__.login('fake-jwt-token'));
    await expect(page).toHaveURL(/\/panel/);

    // 2. Ir a una superficie que NO está habilitada (por ejemplo, /panel/disabled-route)
    await page.goto('/panel/disabled-route');

    // 3. Verificar que vemos la página 404
    await expect(page.locator('p')).toContainText('No encontramos esta página.');
  });
});
