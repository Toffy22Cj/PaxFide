import { test, expect } from '@playwright/test';

const ROUTES = [
  '/c/123',
  '/tracking/123',
  '/assets/abc',
  '/panel/campaigns'
];

test.describe('Route Enablement', () => {
  for (const route of ROUTES) {
    test(`Route ${route} should 404 when not enabled`, async ({ page }, testInfo) => {
      await page.goto(route);
      await expect(page.locator('h2')).toContainText('404');
    });
  }

  test.describe('404 con la lista vacía', () => {

    test('404 para /login, /panel y /panel/platform/x con la lista vacía sin sesión', async ({ page }) => {
      await page.goto('/login');
      await expect(page.locator('h2')).toContainText('404');

      await page.goto('/panel');
      await expect(page.locator('h2')).toContainText('404');

      await page.goto('/panel/platform/x');
      await expect(page.locator('h2')).toContainText('404');
    });

    test('404 para /login, /panel y /panel/platform/x con la lista vacía con sesión', async ({ page }) => {
      // Iniciar sesión
      await page.goto('/login');
      await page.waitForFunction(() => !!(window as any).__TEST_SESSION__);
      await page.evaluate(() => (window as any).__TEST_SESSION__?.login('fake-jwt-token'));

      await page.goto('/login');
      await expect(page.locator('h2')).toContainText('404');

      await page.goto('/panel');
      await expect(page.locator('h2')).toContainText('404');

      await page.goto('/panel/platform/x');
      await expect(page.locator('h2')).toContainText('404');
    });
  });
});
