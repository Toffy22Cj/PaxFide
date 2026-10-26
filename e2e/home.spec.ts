// Ref: plan-fase7-pantallas.md A-3 (tests), D-P6, D-P7; DF7-20 y DF7-21; DW-16 (código de seguimiento en memoria).
import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test.describe('Inicio del donante (VS-5)', () => {
  test('sin destino guardado, iniciar sesión lleva a /home: saludo sin nombre, ciudad detrás y tarjetas del donante', async ({ page }) => {
    await page.goto('/login');
    await signIn(page, 'donante@demo.test', 'demo-donante');
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^(Buenos días|Buenas tardes|Buenas noches)$/);
    await expect(page.getByTestId('city-background')).toHaveCount(1);
    await expect(page.getByTestId('home-card-create-organization')).toBeVisible();
    await expect(page.getByTestId('home-card-organization')).toHaveCount(0);
    await expect(page.getByTestId('home-card-platform')).toHaveCount(0);
    await expect(page.getByTestId('home-campaigns').getByTestId('campaign-card').first()).toBeVisible();
    await expect(page.getByText('donante@demo.test')).toHaveCount(0);
  });

  test('un destino guardado gana: /account/donations sin sesión → login → /account/donations', async ({ page }) => {
    await page.goto('/account/donations');
    await expect(page).toHaveURL(/\/login$/);
    await signIn(page, 'donante@demo.test', 'demo-donante');
    await expect(page).toHaveURL(/\/account\/donations$/);
  });

  test('con organización: "Ir a tu organización" lleva al panel', async ({ page }) => {
    await page.goto('/login');
    await signIn(page, 'admin@demo.test', 'demo-admin');
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId('home-card-create-organization')).toHaveCount(0);
    await page.getByRole('link', { name: 'Ir a tu organización' }).click();
    await expect(page).toHaveURL(/\/panel$/);
  });

  test('DF7-21: la cuenta de plataforma llega a /panel/platform desde el inicio', async ({ page }) => {
    await page.goto('/login');
    await signIn(page, 'plataforma@demo.test', 'demo-plataforma');
    await expect(page).toHaveURL(/\/home$/);
    await page.getByRole('link', { name: 'Ir a la plataforma' }).click();
    await expect(page).toHaveURL(/\/panel\/platform$/);
  });

  test('"Seguir una donación": el código va a /tracking en memoria, nunca en la URL ni en el almacenamiento', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    await page.goto('/login');
    await signIn(page, 'donante@demo.test', 'demo-donante');
    await expect(page).toHaveURL(/\/home$/);
    await page.getByLabel('Código de seguimiento').fill('TRK.codigo-de-prueba');
    await page.getByRole('button', { name: /Ver (ruta|recorrido)/ }).click();
    await expect(page).toHaveURL(/\/tracking$/);
    await expect(page.getByText('El código no es válido o expiró.')).toBeVisible();
    expect(page.url()).not.toContain('codigo-de-prueba');
    expect(urls.filter((u) => u.includes('codigo-de-prueba'))).toEqual([]);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).not.toContain('codigo-de-prueba');
  });

  test('F-A4 (D-F12): ADMINISTRATOR ve "Tu organización hoy" con estadísticas reales y acciones rápidas', async ({ page }) => {
    await page.goto('/login');
    await signIn(page, 'admin@demo.test', 'demo-admin');
    await expect(page).toHaveURL(/\/home$/);
    const orgCard = page.getByTestId('home-card-organization');
    await expect(orgCard).toBeVisible();
    await expect(orgCard.getByRole('heading', { level: 2, name: 'Tu organización hoy' })).toBeVisible();
    await expect(orgCard.getByText('convocatorias abiertas')).toBeVisible();
    await expect(orgCard.getByText('lotes por despachar')).toBeVisible();
    await expect(orgCard.getByText('lotes en camino')).toBeVisible();
    await expect(orgCard.getByRole('link', { name: /Nueva convocatoria/ })).toHaveAttribute('href', '/panel/campaigns');
    await expect(orgCard.getByRole('link', { name: /Registrar lote/ })).toHaveAttribute('href', '/panel/assets');
    await expect(orgCard.getByText('Despachar o recibir')).toBeVisible();
    await expect(orgCard.getByText('Escanea el QR en la app')).toBeVisible();
  });

  test('F-A4: animación escalonada rise en tarjetas, desactivada con prefers-reduced-motion', async ({ page }) => {
    await page.goto('/login');
    await signIn(page, 'donante@demo.test', 'demo-donante');
    await expect(page).toHaveURL(/\/home$/);
    const donationsCard = page.getByTestId('home-donations');
    await expect(donationsCard).toBeVisible();
    const animName = await donationsCard.evaluate((el) => window.getComputedStyle(el).animationName);
    expect(animName).toContain('rise');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reducedAnim = await donationsCard.evaluate((el) => window.getComputedStyle(el).animationName);
    expect(reducedAnim).toBe('none');
  });

  test('a 390 px: el ADMINISTRATOR ve exactamente 5 entradas (DF7-20) y la página no se desborda', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 860 });
    await page.goto('/login');
    await signIn(page, 'admin@demo.test', 'demo-admin');
    await expect(page).toHaveURL(/\/home$/);
    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav.getByRole('link')).toHaveCount(5);
    await expect(nav.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
