import { test, expect } from '@playwright/test';

// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F5, D-F10, D-F14, D-F17, X-6, X-7;
// Documentos/paxfide-landing.html (.auth-top-bar, .auth-card).

test.describe('Fidelidad de Acceso, Bienvenida y Rutas Legales (F-A2)', () => {
  test('D-F5: /login sobre el mundo isométrico, sin app chrome y con barra de acceso', async ({ page }) => {
    await page.goto('/login');

    // 1. Fondo animado del mundo
    await expect(page.locator('canvas[data-testid="world-background"]')).toBeVisible();

    // 2. Sin app chrome (barra ni cabecera de la app)
    await expect(page.locator('nav[aria-label="Principal"]')).toHaveCount(0);
    await expect(page.locator('header[data-testid="app-header"]')).toHaveCount(0);

    // 3. Barra de acceso superior con botones >= 44px
    const backBtn = page.getByRole('link', { name: /Volver al recorrido/i });
    await expect(backBtn).toBeVisible();
    await expect(backBtn).toHaveAttribute('href', '/');

    const brand = page.locator('[data-testid="access-top-bar"]').getByText('PaxFide');
    await expect(brand).toBeVisible();

    const themeToggle = page.locator('[data-testid="access-top-bar"] [data-testid="landing-theme-toggle"]');
    await expect(themeToggle).toBeVisible();

    const pauseBtn = page.locator('[data-testid="access-top-bar"] [data-testid="city-pause"]');
    await expect(pauseBtn).toBeVisible();

    // 4. Tarjeta de acceso centrada con píldora
    await expect(page.getByText('TU CUENTA PAXFIDE')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Crear cuenta' })).toBeVisible();
  });

  test('D-F5: alternancia Día / Noche en la barra de acceso', async ({ page }) => {
    await page.goto('/login');

    const root = page.locator('[data-testid="access-root"]');
    const toggle = page.locator('[data-testid="access-top-bar"] [data-testid="landing-theme-toggle"]');

    // Estado inicial claro
    await expect(root).not.toHaveAttribute('data-theme', 'dark');

    // Alternar a noche
    await toggle.click();
    await expect(root).toHaveAttribute('data-theme', 'dark');

    // Alternar de vuelta a día
    await toggle.click();
    await expect(root).toHaveAttribute('data-theme', 'light');
  });

  test('Pestañas de acceso: navegación fluida entre /login y /register', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/\/register$/);

    // En /register, enlace a Iniciar sesión
    await page.getByRole('tab', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('X-6 y D-F14: Registro con medidor de contraseña (min 12) y nota de fundación (sin rol ni enlace directo)', async ({ page }) => {
    await page.goto('/register');

    // X-6: Medidor de contraseña
    const passInput = page.getByLabel('Contraseña', { exact: true });
    await passInput.fill('corta');
    await expect(page.getByText(/Seguridad: Débil \(al menos 12 caracteres\)/i)).toBeVisible();

    await passInput.fill('LargaYFuerte2026!');
    await expect(page.getByText(/Seguridad: (Segura|¡Excelente y robusta!)/i)).toBeVisible();

    // D-F14: Desplegable de fundación
    const foundationDetails = page.getByRole('group').filter({ hasText: '¿Representas una fundación?' });
    await expect(foundationDetails).toBeVisible();
    await foundationDetails.locator('summary').click();
    await expect(foundationDetails.getByText(/Crea tu cuenta/i)).toBeVisible();
    await expect(foundationDetails.getByText(/Pendiente de verificación/i)).toBeVisible();

    // X-7: Restricciones negativas: sin selector de rol ni enlace a /panel/organization
    await expect(page.locator('select[name="role"]')).toHaveCount(0);
    await expect(page.locator('input[type="radio"][name="role"]')).toHaveCount(0);
    await expect(page.locator('a[href="/panel/organization"]')).toHaveCount(0);
  });

  test('D-F10: Bienvenida (Welcome Gate) en el primer login tras registrarse en la pestaña', async ({ page }) => {
    const email = `bienvenida-${Date.now()}@test.paxfide.local`;
    const password = 'PasswordFuerte2026!';

    // 1. Registro
    await page.goto('/register');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByLabel('Repite la contraseña').fill(password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByText('Cuenta creada')).toBeVisible();

    // 2. Iniciar sesión en la misma pestaña
    await page.getByRole('tab', { name: 'Iniciar sesión' }).click();
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    // 3. Welcome Gate visible con cubos, título y 3 características
    const welcome = page.getByTestId('welcome-gate');
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole('heading', { level: 1, name: 'Te damos la bienvenida a PaxFide' })).toBeVisible();
    await expect(welcome.getByText('Dona a convocatorias verificadas')).toBeVisible();
    await expect(welcome.getByText('Sigue el recorrido de tu ayuda')).toBeVisible();
    await expect(welcome.getByText('Cada paso queda sellado')).toBeVisible();

    // 4. Continuar navega a /home
    const continueBtn = welcome.getByRole('button', { name: 'Continuar' });
    await continueBtn.click();
    await expect(page).toHaveURL(/\/home$/);

    // 5. Un login posterior en la misma pestaña ya NO muestra la bienvenida
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    // Va directo a /home sin bienvenida
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId('welcome-gate')).toHaveCount(0);
  });

  test('D-F17: Rutas legales públicas con versión v1-2026-10 y sin app chrome', async ({ page }) => {
    for (const path of ['/terminos', '/privacidad', '/terminos-organizacion']) {
      await page.goto(path);
      await expect(page.locator('canvas[data-testid="world-background"]')).toBeVisible();
      await expect(page.locator('nav[aria-label="Principal"]')).toHaveCount(0);
      await expect(page.getByTestId('legal-version')).toBeVisible();
      await expect(page.getByText(/BORRADOR ACADÉMICO/i).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Volver al recorrido/i })).toBeVisible();
    }
  });

  test('Sin solapamientos a 390 px, 1280 px y 1920 px (elementFromPoint)', async ({ page }) => {
    for (const width of [390, 1280, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/login');

      // Botón volver
      const backBox = await page.getByRole('link', { name: /Volver al recorrido/i }).boundingBox();
      expect(backBox).not.toBeNull();
      const backHit = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? el.closest('a')?.getAttribute('href') : null;
      }, { x: backBox!.x + 10, y: backBox!.y + 10 });
      expect(backHit).toBe('/');

      // Botón submit
      const submitBox = await page.getByRole('button', { name: 'Iniciar sesión' }).boundingBox();
      expect(submitBox).not.toBeNull();
      const submitHit = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? el.closest('button')?.getAttribute('type') : null;
      }, { x: submitBox!.x + submitBox!.width / 2, y: submitBox!.y + submitBox!.height / 2 });
      expect(submitHit).toBe('submit');
    }
  });
});
