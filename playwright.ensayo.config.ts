import { defineConfig, devices } from '@playwright/test';

/**
 * Ensayo conjunto (Autorización (2) §1): la web contra el backend REAL de la demo local (`runbook-demo-local.md` del
 * backend), no contra el simulado. No forma parte de `pnpm test:e2e` ni de `scripts/ci-local.sh`: necesita el backend
 * en :8080 (perfil `dev`, semilla) y la web en :3000 construida con `NEXT_PUBLIC_SURFACE_PROFILE=demo` y
 * `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1`. Ver `ensayo/README.md`.
 */
export default defineConfig({
  testDir: './ensayo',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
    ...devices['Desktop Chrome'],
  },
});
