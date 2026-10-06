import { test, expect } from '@playwright/test';

test.describe('Production build (Rule 7)', () => {
  test('does not expose __TEST_SESSION__ or __TEST_ROUTER__ backdoors', async ({ page }) => {
    await page.goto('/');
    
    // Check if it's exposed
    const isSessionExposed = await page.evaluate(() => {
      return !!(window as any).__TEST_SESSION__;
    });
    const isRouterExposed = await page.evaluate(() => {
      return !!(window as any).__TEST_ROUTER__;
    });

    expect(isSessionExposed).toBe(false);
    expect(isRouterExposed).toBe(false);
  });
});
