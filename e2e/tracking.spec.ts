import { test, expect, Request } from '@playwright/test';

const API = 'http://localhost:3002';

async function newCampaign(request: any): Promise<string> {
  const r = await request.post(`${API}/__test/campaigns`, { data: { title: 'Convocatoria seguimiento' } });
  return (await r.json()).publicCode;
}

test.describe('Donante con cuenta → Mis donaciones → seguimiento por formulario', () => {
  test('el trackingCode nunca aparece en una URL; viaja en Authorization; la sesión no se toca', async ({ page, request }) => {
    const code = await newCampaign(request);
    const requests: Request[] = [];
    page.on('request', (r) => requests.push(r));

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('donante@demo.test');
    await page.getByLabel('Contraseña').fill('demo-donante');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/panel$/);

    // Navegación de cliente: recargar perdería la sesión (JWT solo en memoria)
    await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
    await page.evaluate((c) => (window as any).__TEST_ROUTER__.push(`/c/${c}`), code);
    await expect(page.getByText(/Donarás con tu cuenta/)).toBeVisible();
    await page.getByLabel('Monto (COP)').fill('30000');
    await page.getByLabel('Medio de pago').selectOption('GATEWAY');
    const created = page.waitForResponse((r) => r.url().includes('/donation-intents') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Donar' }).click();
    const { intentId } = await (await created).json();
    const post = requests.find((r) => r.url().includes('/donation-intents'))!;
    expect((await post.allHeaders())['authorization']).toMatch(/^Bearer tok-/);

    await request.post(`${API}/__test/payments`, { data: { intentId } });
    // Con la donación resuelta (trackingCode mostrado) ya no hay aviso al salir (A3)
    await page.getByRole('button', { name: 'Consultar estado del pago' }).click();
    await expect(page.getByTestId('tracking-code')).toBeVisible();

    await page.getByRole('link', { name: 'Panel' }).click();
    await page.getByRole('link', { name: 'Mis donaciones' }).click();
    await expect(page).toHaveURL(/\/account\/donations$/);
    const item = page.getByTestId('account-donation').filter({ hasText: 'Convocatoria seguimiento' });
    await expect(item).toContainText('30.000 COP');
    await expect(item).toContainText('Confirmada');
    await item.getByRole('button', { name: 'Mostrar código de seguimiento' }).click();
    const trackingCode = (await item.getByTestId('account-tracking-code').textContent())!.trim();

    await item.getByRole('link', { name: 'Ver seguimiento' }).click();
    await expect(page).toHaveURL(/\/tracking$/);
    await expect(page.getByText('Hechos verificables')).toBeVisible();
    await expect(page.getByTestId('tracking-original')).toHaveText('30.000 COP');
    await expect(page.getByText('El relato se está generando.')).toBeVisible();
    await page.getByRole('button', { name: 'Actualizar' }).click();
    await expect(page.getByTestId('narrative')).toContainText('Tu donación fue recibida');

    const trackingRequests = requests.filter((r) => r.url().includes('/donations/tracking'));
    expect(trackingRequests.length).toBeGreaterThanOrEqual(3);
    for (const r of trackingRequests) {
      expect((await r.allHeaders())['authorization']).toBe(`Bearer ${trackingCode}`);
    }
    for (const r of requests) expect(r.url()).not.toContain(trackingCode);
    // La sesión sigue intacta tras el seguimiento
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  });

  test('sin sesión: el código escrito en el formulario; un código inválido da un único mensaje', async ({ page }) => {
    await page.goto('/tracking');
    await page.getByLabel('Código de seguimiento').fill('TRK.no-existe');
    await page.getByRole('button', { name: 'Ver seguimiento' }).click();
    await expect(page.getByText('El código no es válido o expiró.')).toBeVisible();
    expect(page.url()).not.toContain('TRK');
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toHaveCount(0);
  });

  test('/tracking/<código> no existe (404) aunque /tracking esté habilitado', async ({ page }) => {
    await page.goto('/tracking/TRK.secreto');
    await expect(page.locator('main p')).toContainText('No encontramos esta página.');
  });

  test('/tracking lleva noindex', async ({ request }) => {
    const html = await (await request.get('/tracking')).text();
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  });
});
