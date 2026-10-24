// Ref: Documentos/plan-fase7-pantallas.md §1.5, §5 B-4; capturas de /login, /register y /invitaciones en claro a 390 y 1280 px.
import { test, expect } from '@playwright/test';
import path from 'path';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

for (const width of [390, 1280]) {
  test(`b4 pantallas de acceso claro ${width}`, async ({ page }) => {
    if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
    await page.setViewportSize({ width, height: 860 });
    const shot = (name: string) => page.screenshot({ path: path.join(OUT, `b4-${name}__claro__${width}.png`), fullPage: true });

    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
    await shot('login');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText('Este campo es obligatorio.').first()).toBeVisible();
    await shot('login-errores');

    await page.goto('/register');
    await expect(page.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeVisible();
    await shot('register');

    // Token de PRUEBA en el fragmento (la pantalla lo borra de la barra y lo guarda solo en memoria)
    await page.goto('/invitaciones#token=token-de-captura');
    await expect(page.getByRole('heading', { level: 2, name: 'Tienes una invitación' })).toBeVisible();
    await shot('invitaciones');

    await page.goto('/invitaciones');
    await expect(page.getByText('No hay ninguna invitación en esta página.', { exact: false })).toBeVisible();
    await shot('invitaciones-sin-token');
  });
}
