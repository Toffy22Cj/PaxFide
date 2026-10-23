import { test, expect } from '@playwright/test';

// Ref: Documentos/prompts-agentes-estilo-v2.md VS-1; Documentos/plan-fase7-pantallas.md §5 B-1.
test.describe('Tokens de movimiento y reducción de movimiento (VS-1 / B-1)', () => {
  test('con prefers-reduced-motion: reduce, la animación de BrandDots en /login no corre (está pausada)', async ({ page }) => {
    // 1. Interceptar petición de autenticación añadiendo la cabecera x-test-delay-ms para mantener el estado "Enviando"
    await page.route('**/api/v1/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        await route.continue({
          headers: {
            ...route.request().headers(),
            'x-test-delay-ms': '3000',
          },
        });
      } else {
        await route.continue();
      }
    });

    // 2. Emular reducción de movimiento
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // 3. Navegar a /login y enviar formulario
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@demo.test');
    await page.getByLabel('Contraseña').fill('demo-admin');
    const submitBtn = page.getByRole('button', { name: 'Iniciar sesión' });
    await submitBtn.click();

    // 4. Verificar estado del botón: deshabilitado y aria-busy="true"
    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toHaveAttribute('aria-busy', 'true');

    // 5. Verificar que el texto visible sigue presente intacto
    await expect(submitBtn).toHaveText(/Iniciar sesión/);

    // 6. Verificar que los puntos de marca están montados
    const firstDot = submitBtn.locator('i').first();
    await expect(firstDot).toBeVisible();

    // 7. Verificar que la animación NO corre (animation-play-state es paused por @media (prefers-reduced-motion: reduce))
    const playState = await firstDot.evaluate((el) => window.getComputedStyle(el).animationPlayState);
    expect(playState).toBe('paused');
  });

  test('sin reduced-motion (no-preference): la animación de BrandDots en /login sí corre (aserción negativa)', async ({ page }) => {
    // 1. Interceptar petición de autenticación con retraso desde la cabecera del test
    await page.route('**/api/v1/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        await route.continue({
          headers: {
            ...route.request().headers(),
            'x-test-delay-ms': '3000',
          },
        });
      } else {
        await route.continue();
      }
    });

    // 2. Emular sin reducción de movimiento
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // 3. Navegar a /login y enviar formulario
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@demo.test');
    await page.getByLabel('Contraseña').fill('demo-admin');
    const submitBtn = page.getByRole('button', { name: 'Iniciar sesión' });
    await submitBtn.click();

    // 4. Verificar que está en envío
    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toHaveAttribute('aria-busy', 'true');

    const firstDot = submitBtn.locator('i').first();
    await expect(firstDot).toBeVisible();

    // 5. Aserción negativa: la animación SÍ corre (animation-play-state es running)
    const playState = await firstDot.evaluate((el) => window.getComputedStyle(el).animationPlayState);
    expect(playState).toBe('running');
  });

  // Requisito B-1: E2E de "reducir movimiento" sobre LoadingState
  test('con prefers-reduced-motion: reduce, la animación de LoadingState está pausada', async ({ page }) => {
    // 1. Interceptar petición para retener el estado de carga
    await page.route('**/api/v1/public/campaigns*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });

    // 2. Emular reducción de movimiento
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // 3. Navegar a /campaigns
    await page.goto('/campaigns');

    // 4. Verificar que LoadingState está visible
    const loader = page.locator('[data-testid="loading-state"]');
    await expect(loader).toBeVisible();

    // 5. Verificar que el cubo SVG está pausado
    const cube = loader.locator('svg').first();
    await expect(cube).toBeVisible();
    const playState = await cube.evaluate((el) => window.getComputedStyle(el).animationPlayState);
    expect(playState).toBe('paused');
  });

  test('sin reduced-motion (no-preference): la animación de LoadingState sí corre (aserción negativa)', async ({ page }) => {
    // 1. Interceptar petición para retener el estado de carga
    await page.route('**/api/v1/public/campaigns*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });

    // 2. Emular sin reducción de movimiento
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // 3. Navegar a /campaigns
    await page.goto('/campaigns');

    // 4. Verificar que LoadingState está visible
    const loader = page.locator('[data-testid="loading-state"]');
    await expect(loader).toBeVisible();

    // 5. Aserción negativa: la animación del cubo SVG SÍ está corriendo
    const cube = loader.locator('svg').first();
    await expect(cube).toBeVisible();
    const playState = await cube.evaluate((el) => window.getComputedStyle(el).animationPlayState);
    expect(playState).toBe('running');
  });
});
