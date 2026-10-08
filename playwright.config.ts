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
    // Solo en local: un Chromium preinstalado (PW_CHROMIUM_PATH). En CI se usa el que instala Playwright.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /routing\.spec\.ts|production\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'NEXT_PUBLIC_E2E_BUILD=true NEXT_PUBLIC_API_BASE_URL=http://localhost:3002/api/v1 pnpm build && pnpm start',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_E2E_SURFACES: JSON.stringify([
          '/login',
          '/panel',
          '/panel/campaigns',
          '/assets/:assetRef',
          '/c/:publicCode',
          'action:donate',
          '/tracking',
          '/account/donations',
          'action:create-campaign',
          'action:assign-employee',
          'action:register-asset',
          'action:split',
          'action:dispatch',
          'action:receive',
          'action:deliver',
          '/register',
          '/campaigns',
          'section:campaign-narrative',
          'action:designate-administrator',
          'action:remove-responsible',
          'action:close-campaign',
          '/panel/prediction',
          '/panel/funds',
          '/panel/assets',
          '/panel/platform',
          'action:request-allocation',
          'action:confirm-allocation',
          'action:platform-verify',
          'action:platform-reject',
          'action:platform-request-information',
          '/panel/organization',
          'action:create-organization',
          'action:platform-grant-admin',
          'action:platform-revoke-admin',
          '/panel/members',
          '/panel/my-campaigns',
          '/invitaciones',
          'action:member-invite',
          'action:invitation-revoke',
          'action:member-change-role',
          'action:member-remove',
          '/panel/configuration',
          'action:configuration-edit',
          'action:configuration-request',
          'action:configuration-approve',
          'action:configuration-reject'
        ])
      }
    },
    {
      command: 'node scripts/fake-backend.js',
      url: 'http://localhost:3002',
      reuseExistingServer: false
    }
  ]
});
