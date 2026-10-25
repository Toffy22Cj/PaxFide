// Ref: Documentos/plan-fase7-fidelidad.md §4 F-A3 (D-F3, D-F6, D-F7, D-F8, D-F9, D-F15)
import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test.describe('F-A3 · Fidelidad de la estructura, navegación, portal y perfil', () => {
  test('cámara: cambia de distrito de /home a /tracking; con reduce salta sin volar (D-F3)', async ({ page }) => {
    await login(page, 'donante@demo.test', 'demo-donante');
    const canvas = page.locator('[data-testid="city-background"]');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('data-district', 'home');

    // Navega a /tracking
    await page.getByRole('link', { name: 'Seguimiento' }).click();
    await expect(page).toHaveURL(/\/tracking$/);
    await expect(canvas).toHaveAttribute('data-district', 'track');

    // Con reduce motion salta inmediatamente
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('link', { name: 'Inicio' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(canvas).toHaveAttribute('data-district', 'home');
  });

  test('"Ver ciudad": el contenido queda inert y "Mostrar panel" lo devuelve (D-F3)', async ({ page }) => {
    await login(page, 'donante@demo.test', 'demo-donante');
    const hud = page.locator('[data-testid="city-hud"]');
    await expect(hud).toBeVisible();
    await expect(page.locator('[data-testid="hud-zone-name"]')).toHaveText('Plaza central');

    const peekBtn = page.locator('[data-testid="btn-peek-city"]');
    await expect(peekBtn).toHaveText('Ver ciudad');
    await expect(peekBtn).toHaveAttribute('aria-pressed', 'false');

    // Activar Ver ciudad
    await peekBtn.click();
    await expect(peekBtn).toHaveText('Mostrar panel');
    await expect(peekBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    await expect(page.locator('[data-testid="hud-zone-name"]')).toHaveText('Ciudad PaxFide');

    // Desactivar Ver ciudad (Mostrar panel)
    await peekBtn.click();
    await expect(peekBtn).toHaveText('Ver ciudad');
    await expect(peekBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('main')).not.toHaveAttribute('inert', '');
    await expect(page.locator('[data-testid="hud-zone-name"]')).toHaveText('Plaza central');
  });

  test('portal: aparece al ir de /home a /panel y no aparece en enlace directo a /panel (D-F7)', async ({ page }) => {
    // 1. Enlace directo a /panel (llegando a /panel sin venir de una ruta con ciudad):
    // Pedir /panel sin sesión redirige a /login y tras iniciar sesión vuelve a /panel.
    // La ruta previa no tenía ciudad (era /login con mundo), por lo que el portal NO debe aparecer.
    await page.goto('/panel');
    await page.getByLabel('Correo electrónico').fill('admin@demo.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('demo-admin');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.locator('[data-testid="panel-portal"]')).toHaveCount(0);

    // 2. Transición hacia ruta con ciudad (/home):
    await page.getByRole('link', { name: 'Inicio' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('[data-testid="city-background"]')).toBeVisible();

    // 3. Transición desde ruta con ciudad (/home) hacia /panel: el portal sí aparece
    await page.getByRole('link', { name: 'Organización' }).click();
    await expect(page).toHaveURL(/\/panel$/);
    // El portal se renderiza con modo enter
    await expect(page.locator('[data-testid="panel-portal"]')).toBeAttached();
  });

  test('entrada suave entre rutas corre con viewIn y no con reduce (D-F6)', async ({ page }) => {
    await login(page, 'donante@demo.test', 'demo-donante');
    const viewContainer = page.locator('main > div');
    const className = await viewContainer.getAttribute('class');
    expect(className).toMatch(/viewIn/);

    // Con reduce motion, animation en CSS es none
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const anim = await viewContainer.evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe('none');
  });

  test('barra en cuatro posiciones y anti-flicker: posición guardada en "top" (D-F8)', async ({ page }) => {
    // Guarda 'top' en localStorage antes de pintar
    await page.addInitScript(() => {
      localStorage.setItem('paxfide.nav-position', 'top');
    });

    await login(page, 'admin@demo.test', 'demo-admin');
    await expect(page.locator('html')).toHaveAttribute('data-nav-position', 'top');
    const shell = page.locator('div[data-has-nav]');
    await expect(shell).toHaveAttribute('data-nav-position', 'top');

    // Abre personalizador y cambia a 'left'
    const tuneBtn = page.locator('[data-testid="nav-tune-btn"]');
    await tuneBtn.click();
    const sheet = page.locator('[data-testid="nav-position-sheet"]');
    await expect(sheet).toBeVisible();

    await page.getByRole('radio', { name: /Izquierda/i }).click();
    await sheet.getByRole('button', { name: 'Listo' }).click();
    await expect(sheet).toBeHidden();

    await expect(shell).toHaveAttribute('data-nav-position', 'left');
    const saved = await page.evaluate(() => localStorage.getItem('paxfide.nav-position'));
    expect(saved).toBe('left');
  });

  test('/account muestra el correo y no muestra nombre ni "Seguridad" (D-F9)', async ({ page }) => {
    await login(page, 'donante@demo.test', 'demo-donante');
    await page.getByRole('link', { name: 'Perfil' }).click();
    await expect(page).toHaveURL(/\/account$/);

    const screen = page.locator('[data-testid="profile-screen"]');
    await expect(screen).toBeVisible();
    await expect(page.locator('[data-testid="profile-email-header"]')).toHaveText('donante@demo.test');
    await expect(page.locator('[data-testid="profile-email-detail"]')).toHaveText('donante@demo.test');

    // Negativas estrictas de D-F9 y X-8, X-9: sin nombre, apellido ni seguridad
    await expect(page.locator('text=Nombre')).toHaveCount(0);
    await expect(page.locator('text=Apellido')).toHaveCount(0);
    await expect(page.locator('text=Seguridad')).toHaveCount(0);
    await expect(page.locator('text=Próximamente')).toHaveCount(0);
  });

  test('en 390 px (D-F15): admin tiene exactamente 5 entradas y Donaciones queda activa en /tracking', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 860 });
    await login(page, 'admin@demo.test', 'demo-admin');

    const nav = page.getByRole('navigation', { name: 'Principal' });
    const links = nav.getByRole('link');
    await expect(links).toHaveCount(5);
    await expect(links).toHaveText(['Inicio', 'Explorar', 'Donaciones', 'Organización', 'Perfil']);

    // Donaciones contiene el enlace a Seguimiento en /account/donations
    await nav.getByRole('link', { name: 'Donaciones' }).click();
    await expect(page).toHaveURL(/\/account\/donations$/);
    const trackLink = page.locator('[data-testid="link-track-code"]');
    await expect(trackLink).toBeVisible();
    await expect(trackLink).toHaveText('Seguir con un código');

    // Al ir a /tracking, Donaciones queda activa en la barra (D-F15)
    await trackLink.click();
    await expect(page).toHaveURL(/\/tracking$/);
    await expect(nav.getByRole('link', { name: 'Donaciones' })).toHaveAttribute('aria-current', 'page');

    // Negativa cruzada: cuenta sin organización mantiene Seguimiento
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('donante@demo.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('demo-donante');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(nav.getByRole('link')).toHaveText(['Inicio', 'Explorar', 'Donaciones', 'Seguimiento', 'Perfil']);
  });
});
