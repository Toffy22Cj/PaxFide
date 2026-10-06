import { test, expect } from '@playwright/test';

test.describe('Security constraints (W-4 d, e)', () => {
  test('ninguna petición al origen Next lleva Authorization, pero al API sí', async ({ page }) => {
    const nextOriginPeticiones: any[] = [];
    const apiPeticiones: any[] = [];
    
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.hostname === 'localhost' && url.port === '3000') {
        nextOriginPeticiones.push(request);
      }
      if (url.hostname === 'localhost' && url.port === '3002') {
        apiPeticiones.push(request);
      }
    });

    await page.goto('/login');
    await page.waitForFunction(() => !!(window as any).__TEST_SESSION__);
    await page.evaluate(() => (window as any).__TEST_SESSION__.login('fake-jwt-token-for-security'));
    await expect(page).toHaveURL(/\/panel/);

    // Provocar la llamada sin recargar la página (SPA navigation)
    await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
    await page.evaluate(() => (window as any).__TEST_ROUTER__.push('/assets/ASSET-123'));

    // Expect navigation to happen
    await expect(page).toHaveURL(/\/assets\/ASSET-123/);

    // Wait for the content to appear
    await expect(page.locator('[data-testid^="state-content"]')).toBeVisible();

    // Revisar peticiones a Next
    for (const req of nextOriginPeticiones) {
      const headers = await req.allHeaders();
      expect(headers['authorization']).toBeUndefined();
    }

    // Revisar peticiones al API
    expect(apiPeticiones.length).toBeGreaterThan(0);
    for (const req of apiPeticiones) {
      const headers = await req.allHeaders();
      expect(headers['authorization']).toBe('Bearer fake-jwt-token-for-security');
    }
  });

  test('almacenamiento no contiene el token', async ({ page }) => {
    await page.goto('/login');
    await page.waitForFunction(() => !!(window as any).__TEST_SESSION__);
    await page.evaluate(() => (window as any).__TEST_SESSION__.login('fake-jwt-token-for-security'));
    await expect(page).toHaveURL(/\/panel/);

    // localStorage
    const ls = await page.evaluate(() => JSON.stringify(localStorage));
    expect(ls).not.toContain('fake-jwt-token');

    // sessionStorage
    const ss = await page.evaluate(() => JSON.stringify(sessionStorage));
    expect(ss).not.toContain('fake-jwt-token');

    // cookies
    const cookies = await page.context().cookies();
    const cookiesStr = JSON.stringify(cookies);
    expect(cookiesStr).not.toContain('fake-jwt-token');

    // indexedDB (verificar que no hay bases de datos creadas por nosotros que contengan el token)
    const idb = await page.evaluate(async () => {
      const dbs = await window.indexedDB.databases();
      return JSON.stringify(dbs);
    });
    expect(idb).not.toContain('fake-jwt-token');
  });
});
