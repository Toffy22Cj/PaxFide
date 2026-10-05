import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /production\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'NEXT_PUBLIC_API_BASE_URL=http://localhost:3002 pnpm build && pnpm start',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_E2E_SURFACES: JSON.stringify(['/login', '/panel'])
      }
    },
    {
      command: 'node scripts/fake-backend.js',
      url: 'http://localhost:3002',
      reuseExistingServer: false
    }
  ]
});
