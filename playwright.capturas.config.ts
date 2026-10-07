import { defineConfig } from '@playwright/test';

/**
 * Capturas para validar contra Penpot (no es un test de regresión; no forma parte de `test:e2e` ni del CI local).
 * Uso: PW_CHROMIUM_PATH=… pnpm exec playwright test -c playwright.capturas.config.ts
 * Salida: Documentos/evidencia-web/capturas/<pantalla>__<estado>__<ancho>.png, contra el backend simulado.
 */
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: './capturas',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3000', launchOptions },
  projects: [
    { name: '360', use: { viewport: { width: 360, height: 780 } } },
    { name: '1280', use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: [
    {
      command: 'NEXT_PUBLIC_E2E_BUILD=true NEXT_PUBLIC_API_BASE_URL=http://localhost:3002/api/v1 pnpm build && pnpm start',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_E2E_SURFACES: JSON.stringify([
          '/login', '/panel', '/panel/campaigns', '/assets/:assetRef', '/c/:publicCode', '/tracking', '/account/donations',
          'action:donate', 'action:create-campaign', 'action:assign-employee', 'action:register-asset', 'action:split',
          'action:dispatch', 'action:receive', 'action:deliver',
          'action:designate-administrator', 'action:remove-responsible', 'action:close-campaign', '/panel/prediction',
        ]),
      },
    },
    { command: 'node scripts/fake-backend.js', url: 'http://localhost:3002', reuseExistingServer: false },
  ],
});
