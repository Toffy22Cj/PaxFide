import { test, expect } from '@playwright/test';

test.describe('Shell & AssetPage Visuals', () => {
  const viewports = [
    { width: 360, height: 800, name: '360px' },
    { width: 1280, height: 800, name: '1280px' },
  ];

  for (const vp of viewports) {
    test(`AssetPage States at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const goToAsset = async (assetRef: string) => {
        await page.goto('/login');
        await page.waitForFunction(() => !!(window as any).__TEST_SESSION__);
        await page.evaluate(() => {
          (window as any).__TEST_SESSION__.login('test-token-123');
        });
        await page.waitForURL('**/panel');
        await page.evaluate((ref) => {
          (window as any).__TEST_ROUTER__.push(`/assets/${ref}`);
        }, assetRef);
        await page.waitForURL(`**/assets/${assetRef}`);
      };

      // 1. Success (contenido)
      await page.route('**/physical-assets/SUCCESS', route => route.fulfill({
        status: 200,
        body: JSON.stringify({
          assetRef: 'SUCCESS',
          lifecycleStatus: 'REGISTERED',
          quantity: 50,
          unitOfMeasure: 'kg',
          currentLocation: 'Store',
          currentCustodianRef: 'CUST-1',
          campaignRef: 'CAMP-1'
        })
      }));
      await goToAsset('SUCCESS');
      await page.waitForSelector('[data-testid="state-content"]');
      await page.screenshot({ path: `screenshots/AssetPage-contenido-${vp.name}.png` });

      // 2. Entregado
      await page.route('**/physical-assets/DELIVERED', route => route.fulfill({
        status: 200,
        body: JSON.stringify({
          assetRef: 'DELIVERED',
          lifecycleStatus: 'DELIVERED',
          quantity: 100,
          unitOfMeasure: 'L',
          currentLocation: null,
          currentCustodianRef: null,
          campaignRef: 'CAMP-2'
        })
      }));
      await goToAsset('DELIVERED');
      await page.waitForSelector('[data-testid="state-content-readonly"]');
      await page.screenshot({ path: `screenshots/AssetPage-entregado-${vp.name}.png` });

      // 3. 403
      await page.route('**/physical-assets/FORBIDDEN', route => route.fulfill({ status: 403 }));
      await goToAsset('FORBIDDEN');
      await page.waitForSelector('[data-testid="state-forbidden"]');
      await page.screenshot({ path: `screenshots/AssetPage-403-${vp.name}.png` });

      // 4. 404
      await page.route('**/physical-assets/NOTFOUND', route => route.fulfill({ status: 404 }));
      await goToAsset('NOTFOUND');
      await page.waitForSelector('[data-testid="state-notfound"]');
      await page.screenshot({ path: `screenshots/AssetPage-404-${vp.name}.png` });

      // 5. Error
      await page.route('**/physical-assets/ERROR', route => route.fulfill({ status: 500 }));
      await goToAsset('ERROR');
      await page.waitForSelector('[data-testid="state-error"]');
      await page.screenshot({ path: `screenshots/AssetPage-error-${vp.name}.png` });
      
      // 6. Shell Public
      await page.goto('/c/public123');
      await page.waitForSelector('.pax-shell-header');
      await page.screenshot({ path: `screenshots/Shell-public-${vp.name}.png` });
    });
  }
});
