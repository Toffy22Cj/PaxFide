// Ref: plan-fase7-puesta-al-dia.md Anexo 5, P-15 (A5.4) contra el servidor falso (ficha R-7; catálogo de PRUEBA).
import { test, expect, type Browser, type Page } from '@playwright/test';
import { acceptLegal, randomNit, verifyEmailApi } from './support/evidence';

const API = 'http://localhost:3002';
const PASSWORD = 'clave-demo-larga';

async function login(browser: Browser, email: string, password: string, destination: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(destination);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
  return page;
}

/** Una cuenta nueva que crea su organización con el perfil completo (U-32). */
async function newRepresentative(browser: Browser, opts: { withNit: boolean }) {
  const email = `p15-${Date.now()}-${Math.floor(Math.random() * 1e6)}@demo.test`;
  const reg = await (await browser.newContext()).newPage();
  await reg.goto('/register');
  await reg.getByLabel('Correo electrónico').fill(email);
  await reg.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await reg.getByLabel('Repite la contraseña').fill(PASSWORD);
  await acceptLegal(reg);
  await reg.getByRole('button', { name: 'Crear cuenta' }).click();
  await verifyEmailApi(reg.request, email);
  const page = await login(browser, email, PASSWORD, '/panel/organization');
  const locations: string[] = [];
  page.on('request', (r) => { if (r.url().endsWith('/api/v1/public/locations')) locations.push(r.url()); });
  await page.getByRole('button', { name: 'Crear organización' }).click();
  const dialog = page.getByRole('dialog');
  const name = `Fundación P-15 ${Date.now()}`;
  await dialog.getByLabel('Tipo').selectOption('FOUNDATION');
  await dialog.getByLabel('Nombre').fill(name);
  await dialog.getByLabel('Descripción').fill('Mercados para el barrio.');
  await dialog.getByLabel('Sitio web').fill('https://p15.example');
  await dialog.getByLabel('Departamento').selectOption('05');
  await dialog.getByLabel('Municipio').selectOption('05266');
  await expect(dialog.getByTestId('public-email-notice')).toHaveText('Este correo se mostrará en la página pública de tus convocatorias');
  await dialog.getByLabel('Correo de contacto').fill('hola@p15.example');
  const nit = randomNit();
  if (opts.withNit) {
    await dialog.getByLabel('Razón social').fill(`${name} S.A.S.`);
    await dialog.getByLabel('NIT', { exact: true }).fill(nit.nit);
    await dialog.getByLabel('Dígito de verificación').fill(nit.dv);
  }
  await dialog.getByLabel('Teléfono').fill('3001234567');
  await dialog.getByTestId('consent-organizationTerms').check();
  await dialog.getByRole('button', { name: 'Crear organización' }).click();
  await expect(page.getByTestId('organization-status')).toHaveText('Pendiente de verificación');
  return { page, name, email, nit, locations };
}

test.describe('P-15 · perfil de la organización', () => {
  test('el catálogo de ubicaciones se pide una sola vez por sesión, también al navegar dentro de la app', async ({ browser }) => {
    const { page, locations } = await newRepresentative(browser, { withNit: true });
    expect(locations).toHaveLength(1);
    // Navegación dentro de la app (la sesión y el catálogo viven en memoria): el editor ya no lo vuelve a pedir
    await page.evaluate(() => (window as unknown as { __TEST_ROUTER__: { push: (p: string) => void } }).__TEST_ROUTER__.push('/panel'));
    await expect(page).toHaveURL(/\/panel$/);
    await page.evaluate(() => (window as unknown as { __TEST_ROUTER__: { push: (p: string) => void } }).__TEST_ROUTER__.push('/panel/organization'));
    await expect(page.getByLabel('Municipio')).toHaveValue('05266');
    expect(locations).toHaveLength(1);
  });

  test('editor: los valores guardados, PUT con todos los campos, null al vaciar; verificada → solo lectura', async ({ browser }) => {
    const { name, email } = await newRepresentative(browser, { withNit: true });
    const page = await login(browser, email, PASSWORD, '/panel/organization');
    const puts: Record<string, unknown>[] = [];
    page.on('request', (r) => { if (r.method() === 'PUT' && r.url().endsWith('/profile')) puts.push(r.postDataJSON()); });
    await expect(page.getByLabel('Nombre')).toHaveValue(name);
    await expect(page.getByLabel('Municipio')).toHaveValue('05266');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Guardamos los datos de la organización.')).toBeVisible();
    expect(Object.keys(puts[0]).sort()).toEqual(['contactEmail', 'contactPhone', 'description', 'legalName', 'location', 'name', 'nit',
      'nitCheckDigit', 'specialTaxRegime', 'website']);
    expect(puts[0].contactPhone).toBe('3001234567');
    await page.getByLabel('Teléfono').fill('');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Guardamos los datos de la organización.')).toBeVisible();
    expect(puts[1].contactPhone).toBeNull();
    expect(puts[1].website).toBe('https://p15.example');

    // La plataforma la verifica: nombre, razón social, NIT y dígito pasan a solo lectura
    const platform = await login(browser, 'plataforma@demo.test', 'demo-plataforma', '/panel/platform');
    const row = platform.getByTestId('queue-item').filter({ hasText: name });
    await expect(row.getByTestId('queue-legal-name')).toHaveText(`${name} S.A.S.`);
    await row.getByRole('button', { name: 'Verificar' }).click();
    await platform.getByRole('dialog').getByRole('button', { name: 'Verificar organización' }).click();
    await expect(platform.getByText(`${name}: Verificada.`)).toBeVisible();
    const again = await login(browser, email, PASSWORD, '/panel/organization');
    for (const l of ['Nombre', 'Razón social', 'NIT', 'Dígito de verificación']) {
      await expect(again.getByLabel(l, { exact: true })).toHaveAttribute('readonly', '');
    }
  });

  test('plataforma: sin razón social ni NIT, "Verificar" explica que faltan; pedir información → la organización reenvía a revisión', async ({ browser }) => {
    const { name, email } = await newRepresentative(browser, { withNit: false });
    const platform = await login(browser, 'plataforma@demo.test', 'demo-plataforma', '/panel/platform');
    const row = platform.getByTestId('queue-item').filter({ hasText: name });
    await expect(row.getByTestId('queue-nit')).toHaveText('Sin dato');
    await row.getByRole('button', { name: 'Verificar' }).click();
    await platform.getByRole('dialog').getByRole('button', { name: 'Verificar organización' }).click();
    await expect(platform.getByText('Faltan la razón social o el NIT: pide más información')).toBeVisible();
    await platform.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    await row.getByRole('button', { name: 'Pedir más información' }).click();
    await platform.getByRole('dialog').getByLabel('Mensaje para la organización').fill('Falta el NIT.');
    await platform.getByRole('dialog').getByRole('button', { name: 'Pedir más información' }).click();
    await expect(platform.getByText(`${name}: Se pidió más información.`)).toBeVisible();

    const rep = await login(browser, email, PASSWORD, '/panel/organization');
    await expect(rep.getByText('Falta el NIT.')).toBeVisible();
    const nit = randomNit();
    await rep.getByLabel('Razón social').fill(`${name} S.A.S.`);
    await rep.getByLabel('NIT', { exact: true }).fill(nit.nit);
    await rep.getByLabel('Dígito de verificación').fill(nit.dv);
    await rep.getByRole('button', { name: 'Enviar de nuevo a revisión' }).click();
    await expect(rep.getByText('Enviamos la organización de nuevo a revisión.')).toBeVisible();
    await expect(rep.getByTestId('organization-verification-status')).toHaveText('Pendiente de verificación');
    await expect(rep.getByRole('button', { name: 'Enviar de nuevo a revisión' })).toHaveCount(0);
  });

  test('CV-07: "Sobre la organización" con lo público; nunca NIT, razón social ni teléfono, aunque el servidor los meta', async ({ page, request }) => {
    await request.post(`${API}/__test/leak-private-profile`, { data: { organizationId: 'org-1' } });
    await page.goto('/c/01JDEMOPUBLICC0DEMONETARY1');
    const about = page.getByTestId('about-organization');
    await expect(about).toContainText('Fundación de demostración del servidor falso.');
    await expect(about).toContainText('Medellín (prueba), Antioquia (prueba)');
    const web = about.getByRole('link', { name: 'https://fundacion-demo.example' });
    await expect(web).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(web).toHaveAttribute('target', '_blank');
    await expect(about.getByRole('link', { name: 'contacto@fundacion-demo.example' })).toHaveAttribute('href', 'mailto:contacto@fundacion-demo.example');
    const html = await page.content();
    for (const secret of ['900123456', 'Fundación Demo S.A.S. (prueba)', '3001234567']) expect(html).not.toContain(secret);
  });
});
