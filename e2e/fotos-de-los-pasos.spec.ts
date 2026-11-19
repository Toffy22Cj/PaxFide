// Tarea 5 (ADR-051 Enmienda 2; plan-fotos-tarea5-web.md §4 tests 14, 15 y 16). Contra el servidor falso ampliado, que IMITA el
// contrato de las Tareas 2 y 3 del backend; las capturas y una pasada contra el backend real van aparte (§4 F).
import { test, expect, type Page, type Browser } from '@playwright/test';
import { attachDeliveryPhoto, chooseMunicipality, municipalityReady, uniquePng } from './support/evidence';

async function login(page: Page, email: string, password: string) {
  await page.goto('/panel');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

const photo = () => ({ name: 'paso.png', mimeType: 'image/png', buffer: uniquePng() });

async function registerWithPhoto(page: Page) {
  await page.getByRole('button', { name: 'Registrar activo' }).click();
  await page.getByLabel('Tipo de bien').fill('Mercado');
  await page.getByLabel('Cantidad').fill('10');
  await page.getByLabel('Unidad de medida').fill('kit');
  await page.getByLabel('Custodio (referencia)').fill('BODEGA-1');
  await page.getByLabel('Ubicación actual').fill('Bodega central');
  await chooseMunicipality(page);
  await page.getByLabel('Foto (opcional)').setInputFiles(photo());
  await expect(page.getByTestId('photo-preview')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page).toHaveURL(/\/assets\/[0-9a-f-]{36}$/);
}

async function step(page: Page, button: string, fields: [string, string][], withPhoto: boolean) {
  await page.getByRole('button', { name: button, exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const [label, value] of fields) await dialog.getByLabel(label).fill(value);
  if (withPhoto) await dialog.getByLabel('Foto (opcional)').setInputFiles(photo());
  await municipalityReady(dialog);
  await dialog.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

const DISPATCH: [string, string][] = [['Transportista (referencia)', 'TRANS-1']];
const RECEIVE: [string, string][] = [['Instalación (ubicación)', 'Centro comunitario'], ['Quién recibe (referencia)', 'REC-1']];
const DELIVER: [string, string][] = [['Custodio final (referencia)', 'ALIADO-1'], ['Beneficiario (referencia)', 'BEN-1'], ['Lugar de entrega (referencia)', 'LUGAR-1']];

test.describe('Fotos de los pasos', () => {
  test('registrar con foto, despachar sin foto y recibir con foto: «Pasos y fotos» muestra solo las que hay (test 14)', async ({ page }) => {
    const uploads: string[] = [];
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/asset-evidence')) uploads.push(r.url()); });
    await login(page, 'empleado@demo.test', 'demo-empleado');
    await registerWithPhoto(page);
    const section = page.getByRole('heading', { name: 'Pasos y fotos' });
    await expect(section).toBeVisible();
    await expect(page.getByTestId('step-photo').getByRole('img')).toHaveCount(1);

    await step(page, 'Despachar', DISPATCH, false); // sin foto: ni se sube ni se manda evidenceRef
    expect(uploads).toHaveLength(1);
    await expect(page.getByText('Sin foto en este paso.')).toBeVisible();

    await step(page, 'Recibir', RECEIVE, true);
    expect(uploads).toHaveLength(2);
    await expect(page.getByTestId('step-photo').getByRole('img')).toHaveCount(2);
    await expect(page.getByTestId('step-photo')).toHaveCount(3);
  });

  test('un fallo de la subida deja elegir: «Seguir sin foto» y el paso se confirma (E2-3)', async ({ page, request }) => {
    // Cuenta propia de este test y fallo solo para ella: los e2e corren en paralelo contra el mismo servidor falso
    await login(page, 'empleado3@demo.test', 'demo-empleado3');
    await registerWithPhoto(page);
    await request.post('http://localhost:3002/__test/evidence-fail', { data: { status: 503, accountId: 'acc-employee-3' } });
    await page.getByRole('button', { name: 'Despachar', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Transportista (referencia)').fill('TRANS-1');
    await dialog.getByLabel('Foto (opcional)').setInputFiles(photo());
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(dialog.getByText(/No pudimos guardar la foto/)).toBeVisible();
    await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Registrado'); // el comando no salió
    await dialog.getByRole('button', { name: 'Seguir sin foto' }).click();
    await dialog.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Despachado');
  });

  test('el administrador abre la copia, publica con la casilla, despublica y vuelve a publicar: tres entradas (test 15)', async ({ page, browser }: { page: Page; browser: Browser }) => {
    await login(page, 'empleado@demo.test', 'demo-empleado');
    await registerWithPhoto(page);
    const assetUrl = new URL(page.url()).pathname;
    await step(page, 'Despachar', DISPATCH, false);
    await step(page, 'Entregar', DELIVER, false).catch(() => undefined);
    // la entrega lleva su propia foto (obligatoria), no la opcional de los otros pasos
    if (await page.getByRole('dialog').count()) {
      const dialog = page.getByRole('dialog');
      await attachDeliveryPhoto(dialog);
      await municipalityReady(dialog);
      await dialog.getByRole('button', { name: 'Confirmar' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Entregado');
    // el empleado ve la copia pero no el control de publicar
    await expect(page.getByTestId('redacted-copy')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publicar para el donante' })).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);

    const ctx = await browser.newContext({ storageState: 'e2e/support/welcome-done.json' });
    const admin = await ctx.newPage();
    // ADR-032 Enmienda 1: un ADMINISTRATOR sin EMPLOYEE abre la ficha de su organización
    await login(admin, 'admin@demo.test', 'demo-admin');
    await admin.evaluate((url) => (window as any).__TEST_ROUTER__.push(url), assetUrl);
    // ADR-032 Enmienda 1: el ADMINISTRATOR sin EMPLOYEE abre la ficha pero no ve ninguna acción logística (aserción negativa)
    await expect(admin.getByTestId('field-lifecycleStatus')).toHaveText('Entregado');
    for (const name of ['Despachar', 'Recibir', 'Entregar']) await expect(admin.getByRole('button', { name, exact: true })).toHaveCount(0);
    const copy = admin.getByTestId('redacted-copy');
    await expect(copy.getByRole('img')).toBeVisible();
    await expect(copy).toContainText('no sirve para leer ni verificar');

    const publish = async () => {
      await copy.getByRole('button', { name: 'Publicar para el donante' }).click();
      const go = copy.getByRole('button', { name: 'Publicar', exact: true });
      await expect(go).toBeDisabled();
      await copy.getByLabel('Revisé la copia y no se reconoce a ninguna persona').check();
      await go.click();
      await expect(copy.getByText('Publicada para el donante.')).toBeVisible();
    };
    await publish();
    await copy.getByRole('button', { name: 'Despublicar' }).click();
    await copy.getByRole('button', { name: 'Sí, despublicar' }).click();
    await expect(copy.getByText(/No está publicada/)).toBeVisible();
    await publish();
    const rows = copy.getByTestId('publication-decision');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Publicó');
    await expect(rows.nth(1)).toContainText('Despublicó');
    await expect(rows.nth(2)).toContainText('Publicó');

    // ADR-032 Enmienda 1: un REPRESENTATIVE abre la misma ficha, ve la copia y NO el control de publicar ni la casilla
    const repCtx = await browser.newContext({ storageState: 'e2e/support/welcome-done.json' });
    const rep = await repCtx.newPage();
    await login(rep, 'representante@demo.test', 'demo-representante');
    await rep.evaluate((url) => (window as any).__TEST_ROUTER__.push(url), assetUrl);
    await expect(rep.getByTestId('field-lifecycleStatus')).toHaveText('Entregado');
    await expect(rep.getByTestId('redacted-copy').getByRole('img')).toBeVisible();
    await expect(rep.getByRole('button', { name: /Publicar|Despublicar/ })).toHaveCount(0);
    await expect(rep.getByRole('checkbox')).toHaveCount(0);
    for (const name of ['Despachar', 'Recibir', 'Entregar']) await expect(rep.getByRole('button', { name, exact: true })).toHaveCount(0);
    await repCtx.close();
    await ctx.close();
  });

  test('390 px: sin scroll horizontal en la ficha con la sección de fotos (test 16)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, 'empleado@demo.test', 'demo-empleado');
    await registerWithPhoto(page);
    await step(page, 'Despachar', DISPATCH, true);
    await expect(page.getByTestId('step-photo').getByRole('img')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'Recibir', exact: true }).click();
    await expect(page.getByRole('dialog').getByLabel('Foto (opcional)')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
