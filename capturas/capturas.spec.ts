import { test, expect, Page, Route } from '@playwright/test';
import path from 'path';
import crypto from 'crypto';

/**
 * Capturas de cada pantalla del golden path en sus estados, para validar contra Penpot. Contra el backend simulado;
 * los estados difíciles de provocar (cargando, error, 403, 409, AMBIGUO) se fuerzan con `page.route` devolviendo
 * respuestas con la forma del contrato (`ProblemDetail` con `title` fijo). No cambia el código de la aplicación.
 */
const API = 'http://localhost:3002';
const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

async function shot(page: Page, pantalla: string, estado: string) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${pantalla}__${estado}__${test.info().project.name}.png`), fullPage: true });
}

const problem = (status: number, title: string) => (route: Route) =>
  route.fulfill({ status, contentType: 'application/problem+json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ type: 'about:blank', title, status, detail: 'fijo' }) });
const json = (status: number, body: unknown) => (route: Route) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
const hang = () => () => { /* nunca responde: estado "cargando" */ };

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

async function go(page: Page, to: string) {
  await page.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
  await page.evaluate((p) => (window as any).__TEST_ROUTER__.push(p), to);
}

async function newCampaign(request: any): Promise<string> {
  return (await (await request.post(`${API}/__test/campaigns`, { data: { title: 'Mercados para adultos mayores' } })).json()).publicCode;
}

function future(days: number) {
  const d = new Date(Date.now() + days * 86400000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

test('login', async ({ page }) => {
  await page.goto('/login');
  await shot(page, 'login', 'formulario');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await shot(page, 'login', 'validacion');
  await page.getByLabel('Correo electrónico').fill('admin@demo.test');
  await page.getByLabel('Contraseña').fill('incorrecta');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.locator('main').getByRole('alert')).toBeVisible();
  await shot(page, 'login', '401-credenciales');
  await page.route('**/api/v1/auth/login', (r) => r.abort());
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByText(/No pudimos conectar/)).toBeVisible();
  await shot(page, 'login', 'error-red');
});

test('login — sesión expirada (T-1)', async ({ page }) => {
  await login(page, 'admin@demo.test', 'demo-admin');
  await page.route('**/api/v1/me', problem(401, 'Unauthorized'));
  await go(page, '/panel/campaigns');
  await expect(page.getByText('Tu sesión expiró. Vuelve a iniciar sesión.')).toBeVisible();
  await shot(page, 'login', 'sesion-expirada');
});

test('panel', async ({ page }) => {
  await login(page, 'admin@demo.test', 'demo-admin');
  await expect(page.getByRole('link', { name: 'Convocatorias de mi organización' })).toBeVisible();
  await shot(page, 'panel', 'con-entradas-administrador');
  await page.route('**/api/v1/me', hang());
  await go(page, '/account/donations'); await go(page, '/panel');
  await expect(page.getByText('Cargando…').first()).toBeVisible();
  await shot(page, 'panel', 'cargando');
  await page.unroute('**/api/v1/me');
  await page.route('**/api/v1/me', problem(500, 'InternalError'));
  await go(page, '/account/donations'); await go(page, '/panel');
  await expect(page.getByText('Reintentar')).toBeVisible();
  await shot(page, 'panel', 'error');
  await page.unroute('**/api/v1/me');
  await page.route('**/api/v1/me', json(200, { accountId: 'a', roles: [] }));
  await go(page, '/account/donations'); await go(page, '/panel');
  await expect(page.getByRole('link', { name: 'Mis donaciones' })).toBeVisible();
  await shot(page, 'panel', 'sin-organizacion');
});

test('panel — empleado y /me no disponible', async ({ page, browser }) => {
  await login(page, 'empleado@demo.test', 'demo-empleado');
  await shot(page, 'panel', 'con-entradas-empleado');
  const other = await (await browser.newContext({ viewport: page.viewportSize()! })).newPage();
  await login(other, 'sin-me@demo.test', 'demo-sin-me');
  await expect(other.getByTestId('unavailable-state')).toBeVisible();
  await shot(other, 'panel', 'me-no-disponible');
});

test('convocatorias', async ({ page }) => {
  await login(page, 'admin@demo.test', 'demo-admin');
  await page.route('**/api/v1/me', hang());
  await go(page, '/panel/campaigns');
  await shot(page, 'convocatorias', 'cargando');
  await page.unroute('**/api/v1/me');
  await go(page, '/panel'); await go(page, '/panel/campaigns');
  await expect(page.getByRole('button', { name: 'Crear convocatoria' })).toBeVisible();
  await expect(page.getByTestId('org-campaign').first()).toBeVisible();
  await shot(page, 'convocatorias', 'listado');
  await page.route('**/api/v1/organizations/*/campaigns', problem(403, 'Forbidden'));
  await go(page, '/panel'); await go(page, '/panel/campaigns');
  await expect(page.getByText('No tienes acceso a este recurso.')).toBeVisible();
  await shot(page, 'convocatorias', 'listado-403');
  await page.unroute('**/api/v1/organizations/*/campaigns');
  await page.route('**/api/v1/organizations/*/campaigns', json(200, { items: [] }));
  await go(page, '/panel'); await go(page, '/panel/campaigns');
  await expect(page.getByText('Tu organización todavía no tiene convocatorias.')).toBeVisible();
  await shot(page, 'convocatorias', 'listado-vacio');
  await page.unroute('**/api/v1/organizations/*/campaigns');
  await go(page, '/panel'); await go(page, '/panel/campaigns');
  await expect(page.getByTestId('org-campaign').first()).toBeVisible();
  await page.getByRole('button', { name: 'Crear convocatoria' }).click();
  await shot(page, 'convocatorias', 'formulario');
  await page.getByRole('button', { name: 'Crear convocatoria' }).last().click();
  await shot(page, 'convocatorias', 'validacion');
  await page.getByLabel('Título').fill('Agua potable');
  await page.getByLabel(/Visibilidad/).selectOption('PUBLIC');
  await page.getByLabel(/^Inicio/).fill(future(1));
  await page.getByLabel(/^Fin/).fill(future(60));
  await page.getByLabel('Dinero').check();
  await page.getByLabel('Pasarela de pago').check();
  await page.getByLabel(/^Meta/).fill('2000000');
  await page.getByLabel('Política de meta').selectOption('FLEXIBLE');
  await page.route('**/api/v1/organizations/*/campaigns', problem(409, 'OrganizationNotVerified'));
  await page.getByRole('button', { name: 'Crear convocatoria' }).last().click();
  await expect(page.getByText(/no está verificada/)).toBeVisible();
  await shot(page, 'convocatorias', '409-organizacion-sin-verificar');
  await page.unroute('**/api/v1/organizations/*/campaigns');
  await page.route('**/api/v1/organizations/*/campaigns', problem(503, 'ServiceUnavailable'));
  await page.getByRole('button', { name: 'Crear convocatoria' }).last().click();
  await expect(page.getByText('No pudimos confirmar la operación')).toBeVisible();
  await shot(page, 'convocatorias', 'ambiguo');
  await page.unroute('**/api/v1/organizations/*/campaigns');
  await page.getByText('Reintentar').click();
  await expect(page.getByText('Convocatoria creada')).toBeVisible();
  await shot(page, 'convocatorias', 'creada-con-qr');
  const row = page.getByTestId('org-campaign').first();
  await row.getByRole('button', { name: 'Retirar responsable' }).click();
  await shot(page, 'convocatorias', 'retirar-responsable');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await row.getByRole('button', { name: 'Cerrar convocatoria' }).click();
  await shot(page, 'convocatorias', 'cerrar-confirmacion');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await row.getByRole('button', { name: 'Asignar empleado' }).click();
  await page.getByLabel('Empleado', { exact: true }).selectOption({ index: 1 });
  await page.route('**/api/v1/campaigns/*/employees', problem(409, 'InvalidResponsibleRecipient'));
  await page.getByRole('dialog').getByRole('button', { name: 'Asignar empleado' }).click();
  await expect(page.getByText('Esa cuenta no puede ser responsable de esta convocatoria.')).toBeVisible();
  await shot(page, 'convocatorias', 'asignar-409');
  await page.unroute('**/api/v1/campaigns/*/employees');
  await page.route('**/api/v1/campaigns/*/employees', problem(403, 'Forbidden'));
  await page.getByRole('dialog').getByRole('button', { name: 'Asignar empleado' }).click();
  await expect(page.getByText('No tienes acceso a esta operación.')).toBeVisible();
  await shot(page, 'convocatorias', 'asignar-403');
});

test('estimación', async ({ page }) => {
  await login(page, 'admin@demo.test', 'demo-admin');
  await go(page, '/panel/prediction');
  await page.getByLabel('Convocatoria').selectOption('camp-demo-1');
  await shot(page, 'estimacion', 'formulario');
  await page.getByRole('button', { name: 'Ver estimación' }).click();
  await expect(page.getByTestId('prediction-estimate')).toBeVisible();
  await page.getByText('Ver los datos en tabla').click();
  await shot(page, 'estimacion', 'con-cifra');
  await page.route('**/prediction', json(200, { kind: 'ESTIMATE', available: false, unavailableReason: 'STRICT_POLICY_EXCLUDED',
    unavailableText: 'Las convocatorias con meta estricta no se estiman.', asOf: '2026-10-07T00:00:00Z' }));
  await page.getByRole('button', { name: 'Ver estimación' }).click();
  await expect(page.getByText('Sin cifra para esta convocatoria')).toBeVisible();
  await shot(page, 'estimacion', 'strict-sin-cifra');
  await page.unroute('**/prediction');
  await page.route('**/prediction', problem(403, 'Forbidden'));
  await page.getByRole('button', { name: 'Ver estimación' }).click();
  await expect(page.getByText('No tienes acceso a este recurso.')).toBeVisible();
  await shot(page, 'estimacion', '403');
  await page.unroute('**/prediction');
  await page.route('**/prediction', problem(503, 'ServiceUnavailable'));
  await page.getByRole('button', { name: 'Ver estimación' }).click();
  await expect(page.getByText('No pudimos cargar la estimación. Inténtalo de nuevo.')).toBeVisible();
  await shot(page, 'estimacion', 'error');
});

test('fondos de la organización', async ({ page, request }) => {
  const r = await request.post(`${API}/api/v1/public/campaigns/01JDEMOPUBLICC0DEMONETARY1/donation-intents`, {
    data: { amount: '5000000', currency: 'COP', paymentMethod: 'GATEWAY' }, headers: { 'Command-Id': crypto.randomUUID() },
  });
  await request.post(`${API}/__test/payments`, { data: { intentId: (await r.json()).intentId } });
  await login(page, 'admin@demo.test', 'demo-admin');
  await page.route('**/api/v1/organizations/*/funds', hang());
  await go(page, '/panel/funds');
  await shot(page, 'fondos', 'cargando');
  await page.unroute('**/api/v1/organizations/*/funds');
  await page.route('**/api/v1/organizations/*/funds', json(200, { items: [] }));
  await go(page, '/panel'); await go(page, '/panel/funds');
  await expect(page.getByText('Tu organización todavía no tiene fondos.')).toBeVisible();
  await shot(page, 'fondos', 'vacio');
  await page.unroute('**/api/v1/organizations/*/funds');
  await page.route('**/api/v1/organizations/*/funds', problem(403, 'Forbidden'));
  await go(page, '/panel'); await go(page, '/panel/funds');
  await expect(page.getByText('No tienes acceso a este recurso.')).toBeVisible();
  await shot(page, 'fondos', '403');
  await page.unroute('**/api/v1/organizations/*/funds');
  await go(page, '/panel'); await go(page, '/panel/funds');
  const fund = page.getByTestId('fund').first();
  await expect(fund).toBeVisible();
  await shot(page, 'fondos', 'listado');
  await fund.getByRole('button', { name: 'Solicitar asignación' }).click();
  await page.getByRole('dialog').getByLabel(/^Importe/).fill('999999999');
  await page.getByRole('dialog').getByRole('button', { name: 'Solicitar asignación' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await shot(page, 'fondos', 'solicitar-409');
});

test('activos de la organización', async ({ page }) => {
  await login(page, 'empleado@demo.test', 'demo-empleado');
  await go(page, '/panel/assets');
  await expect(page.getByTestId('org-asset').first()).toBeVisible();
  await shot(page, 'activos-organizacion', 'listado');
  await page.route('**/api/v1/organizations/*/physical-assets', json(200, { items: [] }));
  await go(page, '/panel'); await go(page, '/panel/assets');
  await expect(page.getByText('Tu organización todavía no tiene activos registrados.')).toBeVisible();
  await shot(page, 'activos-organizacion', 'vacio');
});

test('plataforma', async ({ page }) => {
  await login(page, 'plataforma@demo.test', 'demo-plataforma');
  await shot(page, 'panel', 'plataforma');
  await page.route('**/api/v1/platform/organizations*', hang());
  await go(page, '/panel/platform');
  await shot(page, 'plataforma', 'cargando');
  await page.unroute('**/api/v1/platform/organizations*');
  await page.route('**/api/v1/platform/organizations*', json(200, { items: [] }));
  await go(page, '/panel'); await go(page, '/panel/platform');
  await expect(page.getByText('No hay organizaciones pendientes.')).toBeVisible();
  await shot(page, 'plataforma', 'cola-vacia');
  await page.unroute('**/api/v1/platform/organizations*');
  await page.route('**/api/v1/platform/organizations*', problem(403, 'Forbidden'));
  await go(page, '/panel'); await go(page, '/panel/platform');
  await expect(page.getByText('No tienes acceso a este recurso.').first()).toBeVisible();
  await shot(page, 'plataforma', 'cola-403');
  await page.unroute('**/api/v1/platform/organizations*');
  await go(page, '/panel'); await go(page, '/panel/platform');
  const row = page.getByTestId('queue-item').first();
  await expect(row).toBeVisible();
  await shot(page, 'plataforma', 'cola');
  await row.getByRole('button', { name: 'Pedir más información' }).click();
  await page.getByRole('dialog').getByLabel('Mensaje para la organización').fill('Falta el certificado de existencia.');
  await shot(page, 'plataforma', 'pedir-informacion');
  await page.getByRole('dialog').getByRole('button', { name: 'Pedir más información' }).click();
  await expect(page.getByText('Decisión registrada')).toBeVisible();
  await shot(page, 'plataforma', 'resultado');
  await page.route('**/api/v1/platform/organizations/*/verify', problem(409, 'InvalidVerificationTransition'));
  await page.getByTestId('queue-item').first().getByRole('button', { name: 'Verificar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Verificar organización' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await shot(page, 'plataforma', '409');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Añadir administrador' }).click();
  await page.getByRole('dialog').getByLabel('Cuenta (identificador)').fill('acc-platform');
  await page.getByRole('dialog').getByRole('button', { name: 'Añadir administrador' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await shot(page, 'plataforma', 'administradores-409');
});

test('mi organización', async ({ page }) => {
  const email = `capt-${Date.now()}-${test.info().project.name}@demo.test`;
  await page.goto('/register');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-demo-larga');
  await page.getByLabel('Repite la contraseña').fill('clave-demo-larga');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Cuenta creada')).toBeVisible();
  await login(page, email, 'clave-demo-larga');
  await shot(page, 'panel', 'sin-organizacion');
  await go(page, '/panel/organization');
  await expect(page.getByRole('button', { name: 'Crear organización' })).toBeVisible();
  await shot(page, 'organizacion', 'sin-organizacion');
  await page.getByRole('button', { name: 'Crear organización' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Crear organización' }).click();
  await shot(page, 'organizacion', 'validacion');
  await page.getByRole('dialog').getByLabel('Tipo').selectOption('FOUNDATION');
  await page.getByRole('dialog').getByLabel('Nombre').fill('Fundación de las capturas');
  await page.getByRole('dialog').getByRole('button', { name: 'Crear organización' }).click();
  await expect(page.getByTestId('organization-status')).toBeVisible();
  await shot(page, 'organizacion', 'creada-pendiente');
});

test('personas de la organización', async ({ page }) => {
  await login(page, 'admin@demo.test', 'demo-admin');
  await shot(page, 'panel', 'con-entradas-administrador-p3');
  await page.route('**/api/v1/organizations/*/invitations', hang());
  await go(page, '/panel/members');
  await expect(page.getByTestId('member').first()).toBeVisible();
  await shot(page, 'personas', 'invitaciones-cargando');
  await page.unroute('**/api/v1/organizations/*/invitations');
  await go(page, '/panel'); await go(page, '/panel/members');
  await page.getByRole('button', { name: 'Invitar' }).click();
  await page.getByRole('dialog').getByLabel('Correo electrónico').fill(`captura-${test.info().project.name}@demo.test`);
  await page.getByRole('dialog').getByLabel('Papel').selectOption('EMPLOYEE');
  await shot(page, 'personas', 'invitar');
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar invitación' }).click();
  await expect(page.getByText('Invitación enviada.')).toBeVisible();
  await shot(page, 'personas', 'listado-con-invitacion');
  await page.route('**/api/v1/organizations/*/members/*/remove', problem(409, 'ActiveCampaignResponsible'));
  await page.getByTestId('member').filter({ hasText: 'acc-employee-2' }).getByRole('button', { name: 'Quitar de la organización' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Quitar' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await shot(page, 'personas', 'quitar-409');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await page.route('**/api/v1/organizations/*/members', problem(403, 'Forbidden'));
  await go(page, '/panel'); await go(page, '/panel/members');
  await expect(page.getByText('No tienes acceso a este recurso.')).toBeVisible();
  await shot(page, 'personas', 'miembros-403');
});

test('invitación', async ({ page, request, browser }) => {
  const email = `invitacion-captura-${Date.now()}-${test.info().project.name}@demo.test`;
  const admin = await (await browser.newContext({ viewport: page.viewportSize() ?? undefined })).newPage();
  await login(admin, 'admin@demo.test', 'demo-admin');
  await go(admin, '/panel/members');
  await admin.getByRole('button', { name: 'Invitar' }).click();
  await admin.getByRole('dialog').getByLabel('Correo electrónico').fill(email);
  await admin.getByRole('dialog').getByLabel('Papel').selectOption('EMPLOYEE');
  await admin.getByRole('dialog').getByRole('button', { name: 'Enviar invitación' }).click();
  await expect(admin.getByText('Invitación enviada.')).toBeVisible();
  const { link } = await (await request.get(`${API}/__test/invitations/last?email=${encodeURIComponent(email)}`)).json();
  await request.post(`${API}/api/v1/auth/register`, { data: { email, password: 'clave-demo-larga' } });

  await page.goto('/invitaciones');
  await expect(page.getByText(/No hay ninguna invitación/)).toBeVisible();
  await shot(page, 'invitacion', 'sin-token');
  await page.goto(link);
  await expect(page.getByText(/inicia sesión con la cuenta del correo/)).toBeVisible();
  await shot(page, 'invitacion', 'sin-sesion');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill('clave-demo-larga');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('button', { name: 'Aceptar invitación' })).toBeVisible();
  await shot(page, 'invitacion', 'con-sesion');
  await page.route('**/api/v1/invitations/accept', problem(403, 'InvitationNotAcceptable'));
  await page.getByRole('button', { name: 'Aceptar invitación' }).click();
  await expect(page.getByText(/no es válida para tu cuenta/)).toBeVisible();
  await shot(page, 'invitacion', 'no-valida');
});

test('mis convocatorias', async ({ page }) => {
  await login(page, 'admin@demo.test', 'demo-admin');
  await go(page, '/panel/my-campaigns');
  await expect(page.getByTestId('my-campaign').first()).toBeVisible();
  await shot(page, 'mis-convocatorias', 'listado');
  await page.route('**/api/v1/me/campaigns', json(200, { items: [] }));
  await go(page, '/panel'); await go(page, '/panel/my-campaigns');
  await expect(page.getByText('No eres responsable de ninguna convocatoria.')).toBeVisible();
  await shot(page, 'mis-convocatorias', 'vacio');
});

test('convocatoria pública', async ({ page, request }) => {
  const code = await newCampaign(request);
  await page.goto(`/c/${code}`);
  await shot(page, 'convocatoria-publica', 'contenido');
  await page.goto('/c/01JDEMOPUBLICC0DECLOSED001');
  await shot(page, 'convocatoria-publica', 'cerrada');
  await page.goto('/c/01JDEMOPUBLICC0DEINKIND01');
  await shot(page, 'convocatoria-publica', 'solo-especie');
  await page.goto('/c/NOEXISTE00000000000000000000');
  await shot(page, 'convocatoria-publica', 'no-encontrada');
});

test('donar', async ({ page, request }) => {
  const code = await newCampaign(request);
  await page.goto(`/c/${code}`);
  const donar = page.getByRole('heading', { name: 'Donar' });
  await donar.scrollIntoViewIfNeeded();
  await shot(page, 'donar', 'formulario');
  await page.getByRole('button', { name: 'Donar' }).click();
  await shot(page, 'donar', 'validacion');
  await page.getByLabel('Monto (COP)').fill('50000');
  await page.getByLabel('Medio de pago').selectOption('GATEWAY');
  await page.route('**/donation-intents', problem(409, 'CampaignClosed'));
  await page.getByRole('button', { name: 'Donar' }).click();
  await expect(page.getByText('Esta convocatoria está cerrada y ya no recibe donaciones.')).toBeVisible();
  await shot(page, 'donar', '409-convocatoria-cerrada');
  await page.unroute('**/donation-intents');
  await page.route('**/donation-intents', problem(503, 'ServiceUnavailable'));
  await page.getByRole('button', { name: 'Donar' }).click();
  await expect(page.getByText('No pudimos confirmar la operación')).toBeVisible();
  await shot(page, 'donar', 'ambiguo');
  await page.unroute('**/donation-intents');
  const created = page.waitForResponse((r) => r.url().includes('/donation-intents') && r.request().method() === 'POST');
  await page.getByText('Reintentar').click();
  const { intentId } = await (await created).json();
  await expect(page.getByText('Intención de donación registrada')).toBeVisible();
  await shot(page, 'donar', 'intencion-registrada-pasarela-simulada');
  await page.getByRole('button', { name: 'Consultar estado del pago' }).click();
  await expect(page.getByText('El pago todavía está pendiente de confirmación.')).toBeVisible();
  await shot(page, 'donar', 'pago-pendiente');
  await request.post(`${API}/__test/payments`, { data: { intentId } });
  await page.getByRole('button', { name: 'Consultar estado del pago' }).click();
  await expect(page.getByTestId('tracking-code')).toBeVisible();
  await shot(page, 'donar', 'confirmada-tracking-code');
});

test('donar — pago fallido y acceso no válido', async ({ page, request }) => {
  const code = await newCampaign(request);
  await page.goto(`/c/${code}`);
  await page.getByLabel('Monto (COP)').fill('10000');
  await page.getByLabel('Medio de pago').selectOption('BANK_TRANSFER');
  const created = page.waitForResponse((r) => r.url().includes('/donation-intents') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Donar' }).click();
  const { intentId } = await (await created).json();
  await shot(page, 'donar', 'intencion-registrada-transferencia');
  await page.route('**/public/donation-intents/*', problem(404, 'NotFound'));
  await page.getByRole('button', { name: 'Consultar estado del pago' }).click();
  await expect(page.getByText(/el acceso a su estado ya no es válido/)).toBeVisible();
  await shot(page, 'donar', 'consulta-404');
  await page.unroute('**/public/donation-intents/*');
  await request.post(`${API}/__test/payments`, { data: { intentId, outcome: 'failed' } });
  await page.getByRole('button', { name: 'Consultar estado del pago' }).click();
  await expect(page.getByText('El pago no se completó.')).toBeVisible();
  await shot(page, 'donar', 'pago-fallido');
});

test('seguimiento', async ({ page, request }) => {
  const code = await newCampaign(request);
  await page.goto(`/c/${code}`);
  await page.getByLabel('Monto (COP)').fill('200000');
  await page.getByLabel('Medio de pago').selectOption('GATEWAY');
  const created = page.waitForResponse((r) => r.url().includes('/donation-intents') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Donar' }).click();
  const { intentId } = await (await created).json();
  await request.post(`${API}/__test/payments`, { data: { intentId } });
  await page.getByRole('button', { name: 'Consultar estado del pago' }).click();
  const trackingCode = (await page.getByTestId('tracking-code').textContent())!.trim();

  await page.goto('/tracking');
  await shot(page, 'seguimiento', 'formulario');
  await page.getByLabel('Código de seguimiento').fill('TRK.invalido');
  await page.getByRole('button', { name: 'Ver seguimiento' }).click();
  await expect(page.getByText('El código no es válido o expiró.')).toBeVisible();
  await shot(page, 'seguimiento', 'codigo-invalido');
  await page.route('**/api/v1/donations/tracking', problem(404, 'NotFound'));
  await page.getByLabel('Código de seguimiento').fill(trackingCode);
  await page.getByRole('button', { name: 'Ver seguimiento' }).click();
  await expect(page.getByText(/todavía se está procesando/)).toBeVisible();
  await shot(page, 'seguimiento', 'en-proceso-404');
  await page.unroute('**/api/v1/donations/tracking');
  await page.route('**/api/v1/donations/tracking', problem(500, 'InternalError'));
  await page.getByRole('button', { name: 'Volver a consultar' }).click();
  await expect(page.getByText('Reintentar')).toBeVisible();
  await shot(page, 'seguimiento', 'error');
  await page.unroute('**/api/v1/donations/tracking');
  await page.getByText('Reintentar').click();
  await expect(page.getByText('El relato se está generando.')).toBeVisible();
  await shot(page, 'seguimiento', 'contenido-relato-pendiente');
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await expect(page.getByTestId('narrative')).toBeVisible();
  await shot(page, 'seguimiento', 'contenido-relato-disponible');
});

test('mis donaciones', async ({ page }) => {
  await login(page, 'donante@demo.test', 'demo-donante');
  await page.route('**/api/v1/account/donations', hang());
  await go(page, '/account/donations');
  await shot(page, 'mis-donaciones', 'cargando');
  await page.unroute('**/api/v1/account/donations');
  await page.route('**/api/v1/account/donations', json(200, { items: [] }));
  await go(page, '/panel'); await go(page, '/account/donations');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await shot(page, 'mis-donaciones', 'vacio');
  await page.unroute('**/api/v1/account/donations');
  await page.route('**/api/v1/account/donations', problem(500, 'InternalError'));
  await go(page, '/panel'); await go(page, '/account/donations');
  await expect(page.getByText('Reintentar')).toBeVisible();
  await shot(page, 'mis-donaciones', 'error');
  await page.unroute('**/api/v1/account/donations');
  await page.route('**/api/v1/account/donations', problem(403, 'Forbidden'));
  await go(page, '/panel'); await go(page, '/account/donations');
  await expect(page.getByText('No tienes acceso a este recurso.')).toBeVisible();
  await shot(page, 'mis-donaciones', '403');
  await page.unroute('**/api/v1/account/donations');
  await page.route('**/api/v1/account/donations', json(200, { items: [
    { intentId: 'i1', campaignTitle: 'Mercados para adultos mayores', amount: '5000000', currency: 'COP', status: 'CONFIRMED', trackingCode: 'TRK.ejemplo-de-captura' },
    { intentId: 'i2', campaignTitle: 'Agua potable', amount: '2000000', currency: 'COP', status: 'PENDING' },
  ] }));
  await go(page, '/panel'); await go(page, '/account/donations');
  await expect(page.getByTestId('account-donation').first()).toBeVisible();
  await shot(page, 'mis-donaciones', 'lista');
  await page.getByRole('button', { name: 'Mostrar código de seguimiento' }).click();
  await shot(page, 'mis-donaciones', 'lista-codigo-visible');
});

async function registerAsset(page: Page) {
  await page.getByRole('button', { name: 'Registrar activo' }).click();
  await page.getByLabel('Tipo de bien').fill('Mercado');
  await page.getByLabel('Cantidad').fill('10');
  await page.getByLabel('Unidad de medida').fill('kit');
  await page.getByLabel('Custodio (referencia)').fill('BODEGA-1');
  await page.getByLabel('Ubicación actual').fill('Bodega central');
}

test('registrar activo', async ({ page }) => {
  await login(page, 'empleado@demo.test', 'demo-empleado');
  await page.getByRole('button', { name: 'Registrar activo' }).click();
  await shot(page, 'registrar-activo', 'formulario-especie');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await shot(page, 'registrar-activo', 'validacion');
  await page.getByLabel('Compra con fondos de una donación').check();
  await shot(page, 'registrar-activo', 'formulario-compra');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await registerAsset(page);
  await page.route('**/api/v1/physical-assets/from-donation', problem(409, 'CampaignNotAvailable'));
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText('La convocatoria no admite este registro.')).toBeVisible();
  await shot(page, 'registrar-activo', '409');
  await page.unroute('**/api/v1/physical-assets/from-donation');
  await page.route('**/api/v1/physical-assets/from-donation', problem(503, 'ServiceUnavailable'));
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByText('No pudimos confirmar la operación')).toBeVisible();
  await shot(page, 'registrar-activo', 'ambiguo');
});

test('activo', async ({ page }) => {
  await login(page, 'empleado@demo.test', 'demo-empleado');
  await registerAsset(page);
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page).toHaveURL(/\/assets\//);
  const assetPath = new URL(page.url()).pathname;
  await expect(page.getByTestId('field-lifecycleStatus')).toBeVisible();
  await shot(page, 'activo', 'contenido-registrado');

  // 409 de transición (como el backend real: recibir exige DISPATCHED)
  await page.getByRole('button', { name: 'Recibir', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Instalación (ubicación)').fill('Centro comunitario');
  await d.getByLabel('Quién recibe (referencia)').fill('REC-1');
  await d.getByRole('button', { name: 'Confirmar' }).click();
  await expect(d.getByRole('alert')).toBeVisible();
  await shot(page, 'activo', 'recibir-409-transicion');
  await d.getByRole('button', { name: 'Cancelar' }).click();

  const dispatch = page.getByRole('button', { name: 'Despachar', exact: true });
  await dispatch.click();
  await shot(page, 'activo', 'modal-despachar');
  await page.getByRole('dialog').getByLabel('Transportista (referencia)').fill('TRANS-1');
  await page.route('**/dispatch', problem(503, 'ServiceUnavailable'));
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('No pudimos confirmar la operación')).toBeVisible();
  await shot(page, 'activo', 'despachar-ambiguo');
  await page.unroute('**/dispatch');
  await page.getByRole('dialog').getByText('Reintentar').click();
  await expect(page.getByText('Activo despachado.')).toBeVisible();
  await shot(page, 'activo', 'despachado-exito');

  await page.getByRole('button', { name: 'Recibir', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Instalación (ubicación)').fill('Centro comunitario');
  await page.getByRole('dialog').getByLabel('Quién recibe (referencia)').fill('REC-1');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByTestId('field-lifecycleStatus')).toHaveText('Recibido');

  await page.getByRole('button', { name: 'Dividir activo', exact: true }).click();
  await shot(page, 'activo', 'modal-dividir');
  await page.getByRole('dialog').getByLabel('Cantidad a separar').fill('4');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('División en curso')).toBeVisible();
  await shot(page, 'activo', 'division-en-curso');
  await expect(page.getByText('División completada')).toBeVisible({ timeout: 15000 });
  await shot(page, 'activo', 'division-completada');

  await page.getByRole('button', { name: 'Entregar', exact: true }).click();
  for (const [l, v] of [['Custodio final (referencia)', 'C'], ['Beneficiario (referencia)', 'B'], ['Lugar de entrega (referencia)', 'L'], ['Evidencia (referencia)', 'E']]) {
    await page.getByRole('dialog').getByLabel(l).fill(v);
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByTestId('state-content-readonly')).toBeVisible();
  await shot(page, 'activo', 'entregado-solo-lectura');

  await page.route('**/api/v1/physical-assets/*', hang());
  await go(page, '/panel'); await go(page, assetPath);
  await shot(page, 'activo', 'cargando');
  await page.unroute('**/api/v1/physical-assets/*');
  await page.route('**/api/v1/physical-assets/*', problem(500, 'InternalError'));
  await go(page, '/panel'); await go(page, assetPath);
  await expect(page.getByTestId('state-error')).toBeVisible();
  await shot(page, 'activo', 'error');
  await page.unroute('**/api/v1/physical-assets/*');
  await page.route('**/api/v1/physical-assets/*', problem(404, 'NotFound'));
  await go(page, '/panel'); await go(page, assetPath);
  await expect(page.getByTestId('state-notfound')).toBeVisible();
  await shot(page, 'activo', '404');
  await page.unroute('**/api/v1/physical-assets/*');
  await go(page, '/panel'); await go(page, '/assets/de-otra-organizacion');
  await expect(page.getByTestId('state-forbidden')).toBeVisible();
  await shot(page, 'activo', '403');
});

test('página 404', async ({ page }) => {
  await page.goto('/ruta-que-no-existe');
  await shot(page, 'pagina-404', 'no-encontrada');
  await page.goto('/tracking/TRK.codigo-en-la-url');
  await shot(page, 'pagina-404', 'tracking-con-codigo-en-url');
});
