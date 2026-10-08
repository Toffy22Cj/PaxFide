import { test, expect, Page, Browser } from '@playwright/test';

const API = 'http://localhost:3002';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

async function adminPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await login(page, 'admin@demo.test', 'demo-admin');
  await expect(page).toHaveURL(/\/panel$/);
  return page;
}

test.describe('P3-B — invitaciones, personas y mis convocatorias', () => {
  test('invitar → el enlace del correo (#token) → crear cuenta e iniciar sesión → aceptar; el token nunca en una URL ni en almacenamiento', async ({ browser, request }) => {
    const email = `invitada-${Date.now()}@demo.test`;
    const admin = await adminPage(browser);
    await admin.getByRole('link', { name: 'Personas de mi organización' }).click();
    await admin.getByRole('button', { name: 'Invitar' }).click();
    const dialog = admin.getByRole('dialog');
    await dialog.getByLabel('Correo electrónico').fill(email);
    await dialog.getByLabel('Papel').selectOption('EMPLOYEE');
    await dialog.getByRole('button', { name: 'Enviar invitación' }).click();
    await expect(admin.getByText('Invitación enviada.')).toBeVisible();
    await expect(admin.getByTestId('invitation').filter({ hasText: `${email[0]}***@demo.test` }).first()).toBeVisible();

    // El test hace de buzón (como Mailpit): el enlace del correo
    const { link } = await (await request.get(`${API}/__test/invitations/last?email=${encodeURIComponent(email)}`)).json();
    const token = decodeURIComponent(link.split('#token=')[1]);

    const invitee = await (await browser.newContext()).newPage();
    const urls: string[] = [];
    invitee.on('request', (r) => urls.push(r.url()));
    await invitee.goto(link);
    await expect(invitee.getByText(/inicia sesión con la cuenta del correo/)).toBeVisible();
    expect(invitee.url()).toMatch(/\/invitaciones$/);
    expect(invitee.url()).not.toContain(token);

    await invitee.getByRole('button', { name: 'Crear cuenta' }).click();
    await invitee.getByLabel('Correo electrónico').fill(email);
    await invitee.getByLabel('Contraseña', { exact: true }).fill('clave-demo-larga');
    await invitee.getByLabel('Repite la contraseña').fill('clave-demo-larga');
    await invitee.getByRole('button', { name: 'Crear cuenta' }).click();
    await invitee.getByRole('link', { name: 'Iniciar sesión' }).click();
    await invitee.getByLabel('Correo electrónico').fill(email);
    await invitee.getByLabel('Contraseña').fill('clave-demo-larga');
    await invitee.getByRole('button', { name: 'Iniciar sesión' }).click();
    // Vuelve a /invitaciones (destino en memoria) con el token aún en memoria
    await expect(invitee).toHaveURL(/\/invitaciones$/);
    const accept = invitee.waitForRequest((r) => r.url().endsWith('/invitations/accept'));
    await invitee.getByRole('button', { name: 'Aceptar invitación' }).click();
    expect((await accept).postDataJSON()).toEqual({ token });
    await expect(invitee.getByText('Invitación aceptada')).toBeVisible();

    expect(urls.filter((u) => u.includes(token))).toEqual([]);
    const stored = await invitee.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(stored).not.toContain(token);
    expect(await invitee.evaluate(() => JSON.stringify(history.state ?? ''))).not.toContain(token);

    // Ya es miembro: el panel lo refleja
    await invitee.getByRole('link', { name: 'Ir al panel' }).click();
    await expect(invitee.getByRole('link', { name: 'Mis convocatorias' })).toBeVisible();

    // La misma invitación otra vez: el mismo 403
    const again = await (await browser.newContext()).newPage();
    await again.goto(link);
    await again.getByRole('button', { name: 'Iniciar sesión' }).click();
    await again.getByLabel('Correo electrónico').fill(email);
    await again.getByLabel('Contraseña').fill('clave-demo-larga');
    await again.getByRole('button', { name: 'Iniciar sesión' }).click();
    await again.getByRole('button', { name: 'Aceptar invitación' }).click();
    await expect(again.getByText(/no es válida para tu cuenta/)).toBeVisible();
  });

  test('personas: asignar a la persona invitada, verla en "Mis convocatorias", cambiar su papel, 409 al quitarla; revocar una invitación', async ({ browser, request }) => {
    const email = `empleada-${Date.now()}@demo.test`;
    const admin = await adminPage(browser);
    await admin.getByRole('link', { name: 'Personas de mi organización' }).click();
    await admin.getByRole('button', { name: 'Invitar' }).click();
    await admin.getByRole('dialog').getByLabel('Correo electrónico').fill(email);
    await admin.getByRole('dialog').getByLabel('Papel').selectOption('EMPLOYEE');
    await admin.getByRole('dialog').getByRole('button', { name: 'Enviar invitación' }).click();
    await expect(admin.getByText('Invitación enviada.')).toBeVisible();
    const { link } = await (await request.get(`${API}/__test/invitations/last?email=${encodeURIComponent(email)}`)).json();
    const { accountId } = await (await request.post(`${API}/api/v1/auth/register`, { data: { email, password: 'clave-demo-larga' } })).json();

    const emp = await (await browser.newContext()).newPage();
    await emp.goto(link);
    await emp.getByRole('button', { name: 'Iniciar sesión' }).click();
    await emp.getByLabel('Correo electrónico').fill(email);
    await emp.getByLabel('Contraseña').fill('clave-demo-larga');
    await emp.getByRole('button', { name: 'Iniciar sesión' }).click();
    await emp.getByRole('button', { name: 'Aceptar invitación' }).click();
    await expect(emp.getByText('Invitación aceptada')).toBeVisible();

    // El administrador la ve como miembro y la asigna a una convocatoria
    await admin.getByRole('link', { name: 'Panel' }).click();
    await admin.getByRole('link', { name: 'Convocatorias de mi organización' }).click();
    const row = admin.getByTestId('org-campaign').filter({ hasText: 'camp-demo-1' });
    await row.getByRole('button', { name: 'Asignar empleado' }).click();
    await admin.getByLabel('Empleado', { exact: true }).selectOption(accountId);
    await admin.getByRole('dialog').getByRole('button', { name: 'Asignar empleado' }).click();
    await expect(admin.getByText('Empleado asignado.')).toBeVisible();

    await emp.getByRole('link', { name: 'Ir al panel' }).click();
    await emp.getByRole('link', { name: 'Mis convocatorias' }).click();
    await expect(emp.getByTestId('my-campaign').filter({ hasText: 'Mercados para adultos mayores' })).toContainText('Empleado');

    await admin.getByRole('link', { name: 'Panel' }).click();
    await admin.getByRole('link', { name: 'Personas de mi organización' }).click();
    const member = admin.getByTestId('member').filter({ hasText: accountId });
    await expect(member).toContainText('Empleado');
    await member.getByRole('button', { name: 'Hacer administrador' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Hacer administrador' }).click();
    await expect(admin.getByText('Papel cambiado.')).toBeVisible();
    await expect(member).toContainText('Empleado, Administrador');
    await member.getByRole('button', { name: 'Dejar solo como empleado' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Dejar solo como empleado' }).click();
    await expect(member).not.toContainText('Administrador');
    await member.getByRole('button', { name: 'Quitar de la organización' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Quitar' }).click();
    await expect(admin.getByRole('dialog').getByRole('alert')).toContainText('responsable de una convocatoria activa');
    await admin.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

    // Revocar una invitación pendiente
    const other = `revocar-${Date.now()}@demo.test`;
    await admin.getByRole('button', { name: 'Invitar' }).click();
    await admin.getByRole('dialog').getByLabel('Correo electrónico').fill(other);
    await admin.getByRole('dialog').getByLabel('Papel').selectOption('ADMINISTRATOR');
    await admin.getByRole('dialog').getByRole('button', { name: 'Enviar invitación' }).click();
    await expect(admin.getByText('Invitación enviada.')).toBeVisible();
    const rows = admin.getByTestId('invitation').filter({ hasText: 'Administrador' }).filter({ hasText: `${other[0]}***@demo.test` });
    await expect(rows.first()).toBeVisible();
    const before = await rows.count();
    await rows.last().getByRole('button', { name: 'Revocar' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Revocar' }).click();
    await expect(admin.getByText('Invitación revocada.')).toBeVisible();
    await expect(rows).toHaveCount(before - 1);
  });
});
