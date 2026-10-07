import { test, expect, Page, Browser } from '@playwright/test';

/**
 * Golden path (`golden-path.md` §2 y §8) recorrido POR LA INTERFAZ contra el backend simulado que sigue los contratos
 * (opción B de Carlos). El recorrido contra el backend real queda para la ejecución final (B7).
 *
 * Fuera de la web (precondiciones o huecos con su id):
 * - Paso 1 (verificar la organización): Platform Administrator fuera de web v1 (T6); la organización ya está verificada.
 * - Pago: el test hace de proveedor de pago (webhook simulado firmado en el backend real).
 * - fundId del camino A: el test lo obtiene como operador (S-04).
 * - Pasos 6 (anclaje) y 7 (verificación de integridad, narrativa de convocatoria): sin superficie web.
 */
const API = 'http://localhost:3002';

async function login(browser: Browser, email: string, password: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
  return page;
}

function future(days: number) {
  const d = new Date(Date.now() + days * 86400000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

async function donate(page: Page, amount: string): Promise<string> {
  await page.getByLabel('Monto (COP)').fill(amount);
  await page.getByLabel('Medio de pago').selectOption('GATEWAY');
  const created = page.waitForResponse((r) => r.url().includes('/donation-intents') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Donar' }).click();
  const { intentId } = await (await created).json();
  await expect(page.getByText('Intención de donación registrada')).toBeVisible();
  return intentId;
}

async function act(page: Page, button: string, fields: [string, string][]) {
  await page.getByRole('button', { name: button, exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const [label, value] of fields) await dialog.getByLabel(label).fill(value);
  await dialog.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

const DELIVER: [string, string][] = [
  ['Custodio final (referencia)', 'ALIADO-LOCAL-1'], ['Beneficiario (referencia)', 'BEN-0001'],
  ['Lugar de entrega (referencia)', 'SALON-COMUNAL'], ['Evidencia (referencia)', 'ACTA-001'],
];

test('golden path por la interfaz: convocatoria → donaciones (sin y con cuenta) → activo → división → entrega → seguimiento', async ({ browser, request }) => {
  test.setTimeout(120_000);

  // Paso 2 — la organización crea la convocatoria (PUBLIC, FLEXIBLE) y asigna un EMPLOYEE (criterio 2)
  const admin = await login(browser, 'admin@demo.test', 'demo-admin');
  await admin.getByRole('link', { name: 'Convocatorias de mi organización' }).click();
  await admin.getByRole('button', { name: 'Crear convocatoria' }).click();
  await admin.getByLabel('Título').fill('Mercados golden path');
  await admin.getByLabel(/Visibilidad/).selectOption('PUBLIC');
  await admin.getByLabel(/^Inicio/).fill(future(1));
  await admin.getByLabel(/^Fin/).fill(future(90));
  await admin.getByLabel('Dinero').check();
  await admin.getByLabel('Pasarela de pago').check();
  await admin.getByLabel(/^Moneda/).fill('COP');
  await admin.getByLabel(/^Meta/).fill('1000000');
  await admin.getByLabel('Política de meta').selectOption('FLEXIBLE');
  const createdCampaign = admin.waitForResponse((r) => /\/organizations\/[^/]+\/campaigns$/.test(r.url()));
  await admin.getByRole('button', { name: 'Crear convocatoria' }).last().click();
  const { publicCode } = await (await createdCampaign).json();
  await expect(admin.getByText('Convocatoria creada')).toBeVisible();
  await expect(admin.getByRole('img', { name: /Código QR/ }).first()).toBeVisible();
  const row = admin.getByTestId('org-campaign').filter({ hasText: 'Mercados golden path' });
  await row.getByRole('button', { name: 'Asignar empleado' }).click();
  await admin.getByLabel('Empleado', { exact: true }).selectOption('acc-employee');
  await admin.getByRole('dialog').getByRole('button', { name: 'Asignar empleado' }).click();
  await expect(admin.getByText('Empleado asignado.')).toBeVisible();

  // Paso 3A — donante SIN cuenta, por el enlace/QR (criterio 3)
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`/c/${publicCode}`);
  await expect(anon.getByRole('heading', { level: 1, name: 'Mercados golden path' })).toBeVisible();
  const anonIntent = await donate(anon, '200000');
  await request.post(`${API}/__test/payments`, { data: { intentId: anonIntent } });
  await anon.getByRole('button', { name: 'Consultar estado del pago' }).click();
  const anonCode = (await anon.getByTestId('tracking-code').textContent())!.trim();

  // Paso 3B — donante CON cuenta; historial autenticado (criterios 4 y 6)
  const donor = await login(browser, 'donante@demo.test', 'demo-donante');
  await donor.waitForFunction(() => !!(window as any).__TEST_ROUTER__);
  await donor.evaluate((c) => (window as any).__TEST_ROUTER__.push(`/c/${c}`), publicCode);
  const donorIntent = await donate(donor, '50000');
  await request.post(`${API}/__test/payments`, { data: { intentId: donorIntent } });
  await donor.getByRole('button', { name: 'Consultar estado del pago' }).click();
  await expect(donor.getByTestId('tracking-code')).toBeVisible();
  await donor.getByRole('link', { name: 'Panel' }).click();
  await donor.getByRole('link', { name: 'Mis donaciones' }).click();
  await expect(donor.getByTestId('account-donation').filter({ hasText: 'Mercados golden path' })).toContainText('Confirmada');

  // La convocatoria refleja lo recaudado (hecho verificable)
  const after = await (await browser.newContext()).newPage();
  await after.goto(`/c/${publicCode}`);
  await expect(after.getByTestId('cleared-amount')).toHaveText('250.000 COP');

  // Paso 4 — el EMPLOYEE registra el activo comprado con el fondo (camino A) (criterio 7)
  const { fundId } = await (await request.get(`${API}/__test/intents/${anonIntent}/fund`)).json();
  const employee = await login(browser, 'empleado@demo.test', 'demo-empleado');
  await employee.getByRole('button', { name: 'Registrar activo' }).click();
  await employee.getByLabel('Compra con fondos de una donación').check();
  await employee.getByLabel('Fondo (referencia)').fill(fundId);
  await employee.getByLabel('Asignación de fondos (referencia)').fill('alloc-golden-1');
  await employee.getByLabel('Tipo de bien').fill('Mercado');
  await employee.getByLabel('Cantidad').fill('10');
  await employee.getByLabel('Unidad de medida').fill('kit');
  await employee.getByLabel('Custodio (referencia)').fill('BODEGA-1');
  await employee.getByLabel('Ubicación actual').fill('Bodega central');
  await employee.getByRole('button', { name: 'Registrar' }).click();
  await expect(employee).toHaveURL(/\/assets\//);

  // Pasos 4B y 5 — división, ciclo logístico y entrega de padre e hijo (criterios 8, 15, 16 y 17)
  await act(employee, 'Despachar', [['Transportista (referencia)', 'TRANS-1']]);
  await act(employee, 'Recibir', [['Instalación (ubicación)', 'Centro comunitario'], ['Quién recibe (referencia)', 'REC-1']]);
  await act(employee, 'Dividir activo', [['Cantidad a separar', '4']]);
  await expect(employee.getByText('División completada')).toBeVisible({ timeout: 15000 });
  await expect(employee.getByTestId('field-quantity')).toHaveText('6');
  await act(employee, 'Entregar', DELIVER);
  await expect(employee.getByTestId('state-content-readonly')).toBeVisible();
  await employee.getByTestId('split-child-link').click();
  await expect(employee.getByTestId('field-quantity')).toHaveText('4');
  await act(employee, 'Entregar', DELIVER);
  await expect(employee.getByTestId('state-content-readonly')).toBeVisible();

  // Paso 7 — vista del donante por trackingCode, en un formulario (nunca en la URL)
  const tracker = await (await browser.newContext()).newPage();
  await tracker.goto('/tracking');
  await tracker.getByLabel('Código de seguimiento').fill(anonCode);
  await tracker.getByRole('button', { name: 'Ver seguimiento' }).click();
  await expect(tracker.getByTestId('tracking-original')).toHaveText('200.000 COP');
  await expect(tracker.getByText('Mercado')).toHaveCount(2);
  await tracker.getByRole('button', { name: 'Ver recorrido' }).first().click();
  await expect(tracker.getByRole('cell', { name: 'Entregado' }).first()).toBeVisible();
  expect(tracker.url()).not.toContain(anonCode);
});
