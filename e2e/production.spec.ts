import { test, expect } from '@playwright/test';

test.describe('Production build (Rule 7)', () => {
  test('does not expose __TEST_SESSION__ backdoor', async ({ page }) => {
    await page.goto('/');
    
    // Check if it's exposed
    const isExposed = await page.evaluate(() => {
      return !!(window as any).__TEST_SESSION__;
    });

    expect(isExposed).toBe(false);
  });
});
