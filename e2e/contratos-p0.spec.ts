// Ref: plan-fase7-puesta-al-dia.md P-0 (R-1 a R-4, U-2, U-3) y §1.2 (el servidor falso responde como el real);
// referencia-api-v1.md §1 (notas R-5 y D3) y §6 (ADR-051 T4).
import { test, expect, type Page, type Request } from '@playwright/test';
import { acceptLegal, attachDeliveryPhoto, uniquePng } from './support/evidence';

const API = 'http://localhost:3002';

async function fillRegister(page: Page, email: string) {
  await page.goto('/register');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo-larga');
  await page.getByLabel('Repite la contraseña').fill('clave-demo-larga');
}

async function loginForm(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

/** Un activo del empleado listo para entregar (registrado y despachado), en su página. */
async function assetReadyToDeliver(page: Page) {
  await page.goto('/panel');
  await page.getByLabel('Correo electrónico').fill('empleado@demo.test');
  await page.getByLabel('Contraseña').fill('demo-empleado');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await page.getByRole('button', { name: 'Registrar activo' }).click();
  await page.getByLabel('Tipo de bien').fill('Mercado');
  await page.getByLabel('Cantidad').fill('3');
  await page.getByLabel('Unidad de medida').fill('kit');
  await page.getByLabel('Custodio (referencia)').fill('BODEGA-1');
  await page.getByLabel('Ubicación actual').fill('Bodega central');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page).toHaveURL(/\/assets\/[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: 'Despachar', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Transportista (referencia)').fill('TRANS-1');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Despachado');
  return new URL(page.url()).pathname.split('/').pop()!;
}

async function fillDeliverRefs(page: Page) {
  await page.getByRole('button', { name: 'Entregar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Custodio final (referencia)').fill('ALIADO-1');
  await dialog.getByLabel('Beneficiario (referencia)').fill('BEN-1');
  await dialog.getByLabel('Lugar de entrega (referencia)').fill('LUGAR-1');
  return dialog;
}

/** Las subidas de esta página (el servidor falso es compartido por los tests en paralelo). */
function countUploads(page: Page): () => number {
  let n = 0;
  page.on('request', (r) => { if (r.url().endsWith('/delivery-evidence') && r.method() === 'POST') n++; });
  return () => n;
}

test.describe('P-0: contratos del backend', () => {
  test('R-1: sin las dos casillas, "Crear cuenta" está deshabilitado y no sale ninguna petición; con ellas, lleva las dos versiones', async ({ page }) => {
    const sent: Request[] = [];
    page.on('request', (r) => { if (r.url().endsWith('/auth/register')) sent.push(r); });
    await fillRegister(page, `p0-${Date.now()}@demo.test`);
    const button = page.getByRole('button', { name: 'Crear cuenta' });
    await expect(page.getByTestId('consent-terms')).not.toBeChecked();
    await expect(page.getByTestId('consent-dataPolicy')).not.toBeChecked();
    await expect(button).toBeDisabled();
    await page.getByTestId('consent-terms').check();
    await expect(button).toBeDisabled();
    await page.keyboard.press('Enter');
    expect(sent).toHaveLength(0);
    await expect(page.getByRole('link', { name: /Términos y condiciones/ })).toHaveAttribute('href', '/terminos');
    await expect(page.getByRole('link', { name: /tratamiento de mis datos personales/ })).toHaveAttribute('href', '/privacidad');
    await page.getByTestId('consent-dataPolicy').check();
    await button.click();
    await expect(page.getByText('Cuenta creada')).toBeVisible();
    expect(sent).toHaveLength(1);
    expect(sent[0].postDataJSON()).toMatchObject({ acceptedTermsVersion: 'v1-2026-10', acceptedDataPolicyVersion: 'v1-2026-10' });
  });

  test('R-2 / U-2: una cuenta con condiciones pendientes ve "Actualizamos nuestras condiciones" y entra tras aceptar', async ({ page, request }) => {
    const email = `semilla-${Date.now()}@demo.test`;
    await fillRegister(page, email);
    await acceptLegal(page);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Cuenta creada')).toBeVisible();
    await request.post(`${API}/__test/acceptance-pending`, { data: { email } });

    const logins: Request[] = [];
    page.on('request', (r) => { if (r.url().endsWith('/auth/login')) logins.push(r); });
    await loginForm(page, email, 'clave-demo-larga');
    const box = page.getByTestId('acceptance-required');
    await expect(box.getByRole('heading', { name: 'Actualizamos nuestras condiciones' })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    const accept = box.getByRole('button', { name: 'Aceptar y entrar' });
    await expect(accept).toBeDisabled();
    await expect(box.getByRole('link', { name: /Términos y condiciones/ })).toHaveAttribute('target', '_blank');
    await acceptLegal(box);
    await accept.click();
    await expect(page).not.toHaveURL(/\/login$/);
    expect(logins).toHaveLength(2);
    expect(logins[0].postDataJSON()).toEqual({ email, password: 'clave-demo-larga' });
    expect(logins[1].postDataJSON()).toEqual({ email, password: 'clave-demo-larga', acceptedTermsVersion: 'v1-2026-10', acceptedDataPolicyVersion: 'v1-2026-10' });
  });

  test('U-2: "Cancelar" vuelve al formulario y la contraseña ya no está en el DOM; la contraseña incorrecta sigue siendo el 401 de siempre', async ({ page, request }) => {
    // Una cuenta propia del test: el servidor falso es compartido y las demás no deben quedar pendientes
    const email = `cancelar-${Date.now()}@demo.test`;
    await fillRegister(page, email);
    await acceptLegal(page);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Cuenta creada')).toBeVisible();
    await request.post(`${API}/__test/acceptance-pending`, { data: { email } });
    await loginForm(page, email, 'clave-demo-larga');
    await expect(page.getByTestId('acceptance-required')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('acceptance-required')).toHaveCount(0);
    await expect(page.getByLabel('Contraseña')).toHaveValue('');
    expect(await page.content()).not.toContain('clave-demo-larga');
    await loginForm(page, email, 'otra-clave-distinta');
    await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
    await expect(page.getByTestId('acceptance-required')).toHaveCount(0);
  });

  test('R-3: crear organización exige su casilla y envía acceptedOrganizationTermsVersion', async ({ page }) => {
    const email = `org-${Date.now()}@demo.test`;
    await fillRegister(page, email);
    await acceptLegal(page);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Cuenta creada')).toBeVisible();
    await loginForm(page, email, 'clave-demo-larga');
    await expect(page).not.toHaveURL(/\/login$/);
    await page.evaluate(() => (window as unknown as { __TEST_ROUTER__: { push: (p: string) => void } }).__TEST_ROUTER__.push('/panel/organization'));
    await page.getByRole('button', { name: 'Crear organización' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Tipo').selectOption('FOUNDATION');
    await dialog.getByLabel('Nombre').fill('Fundación P-0');
    const submit = dialog.getByRole('button', { name: 'Crear organización' });
    await expect(submit).toBeDisabled();
    const body = page.waitForRequest((r) => r.url().endsWith('/api/v1/organizations') && r.method() === 'POST');
    await dialog.getByTestId('consent-organizationTerms').check();
    await submit.click();
    expect((await body).postDataJSON()).toEqual({ type: 'FOUNDATION', name: 'Fundación P-0', acceptedOrganizationTermsVersion: 'v1-2026-10' });
    await expect(page.getByText('Organización creada')).toBeVisible();
  });

  test('R-4 / U-3: la entrega sube la foto y entrega con su evidenceRef; "Evidencia (referencia)" ya no existe', async ({ page }) => {
    const ref = await assetReadyToDeliver(page);
    const dialog = await fillDeliverRefs(page);
    await expect(dialog.getByLabel('Evidencia (referencia)')).toHaveCount(0);
    await attachDeliveryPhoto(dialog);
    const upload = page.waitForRequest((r) => r.url().endsWith('/delivery-evidence'));
    const deliver = page.waitForRequest((r) => r.url().endsWith(`/physical-assets/${ref}/deliver`));
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    const up = await upload;
    expect(up.headers()['command-id']).toBeUndefined(); // la subida no lleva Command-Id
    expect(up.headers()['authorization']).toMatch(/^Bearer /);
    expect((await deliver).postDataJSON().evidenceRef).toMatch(/^sha256:[0-9a-f]{64}$/);
    await expect(page.getByText('Este activo ya fue entregado. Solo lectura.')).toBeVisible();
  });

  test('U-3: una foto de 6 MB no se sube (negativa); 415 y 410 del servidor tienen su texto', async ({ page, request }) => {
    await assetReadyToDeliver(page);
    const dialog = await fillDeliverRefs(page);
    const uploads = countUploads(page);
    const big = Buffer.concat([uniquePng(), Buffer.alloc(6 * 1024 * 1024)]);
    await dialog.getByLabel('Foto de la entrega').setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: big });
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(dialog.getByText('La foto pesa más de 5 MB. Elige una más liviana.').first()).toBeVisible();
    expect(uploads()).toBe(0);
    await request.post(`${API}/__test/evidence-fail`, { data: { status: 415 } });
    await attachDeliveryPhoto(dialog);
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(dialog.getByText('La foto tiene que ser JPEG o PNG.')).toBeVisible();
    await request.post(`${API}/__test/evidence-fail`, { data: { status: 410 } });
    await attachDeliveryPhoto(dialog);
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(dialog.getByText('La plataforma retiró esta foto. Toma una nueva.')).toBeVisible();
    await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Despachado');
  });

  test('U-3: entrega ambigua → "Reintentar" no vuelve a subir la foto y usa el mismo evidenceRef y Command-Id', async ({ page, request }) => {
    const ref = await assetReadyToDeliver(page);
    const dialog = await fillDeliverRefs(page);
    await attachDeliveryPhoto(dialog);
    await request.post(`${API}/__test/fail-next`, { data: { prefix: `/physical-assets/${ref}/deliver`, mode: '503', applyThenFail: true } });
    const delivers: Request[] = [];
    page.on('request', (r) => { if (r.url().endsWith(`/physical-assets/${ref}/deliver`)) delivers.push(r); });
    const uploads = countUploads(page);
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await dialog.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByText('Este activo ya fue entregado. Solo lectura.')).toBeVisible();
    expect(uploads()).toBe(1);
    expect(delivers).toHaveLength(2);
    expect(delivers[1].headers()['command-id']).toBe(delivers[0].headers()['command-id']);
    expect(delivers[1].postData()).toBe(delivers[0].postData());
  });
});
