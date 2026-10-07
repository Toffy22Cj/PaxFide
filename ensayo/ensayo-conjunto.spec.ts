import { test, expect, Page, Browser, APIRequestContext } from '@playwright/test';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Ensayo conjunto: golden path POR LA INTERFAZ contra el backend REAL de la demo local. Cada paso queda en
 * `pasos.json` (resultado y motivo) y cada llamada de la web al backend en `red.json` (método, ruta, código y `title`
 * del ProblemDetail). Nunca se guardan cabeceras, cuerpos, JWT, `statusToken`, `trackingCode` ni contraseñas.
 *
 * Lo que el test hace FUERA de la interfaz, con su motivo (se marca `via: "HTTP"` en `pasos.json`):
 * - pago: el test es el proveedor de pago (webhook simulado firmado, como `recorrido.py` del backend; DW-30);
 * - el identificador de la organización para la plataforma lo toma de `/me` del administrador (D-04: sin listado).
 */
const API = process.env.ENSAYO_API ?? 'http://localhost:8080/api/v1';
const PASSWORD = process.env.TRACEABILITY_DEMO_SEED_PASSWORD ?? '';
const WEBHOOK_SECRET = process.env.TRACEABILITY_DEMO_WEBHOOK_SECRET ?? '';
const OUT = process.env.ENSAYO_SALIDA ?? path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'ensayo-conjunto');
const EMAIL = (who: string) => `${who}@demo.paxfide.local`;

type Paso = { id: string; via: 'UI' | 'HTTP'; resultado: 'OK' | 'FALLO' | 'OMITIDO'; nota?: string };
const pasos: Paso[] = [];
const red: { pagina: string; metodo: string; ruta: string; codigo: number; title?: string }[] = [];

/** Ruta sin la base ni la query; los segmentos de la ruta nunca llevan secretos (DW-01). */
const ruta = (url: string) => new URL(url).pathname.replace(/^\/api\/v1/, '');

function watch(page: Page, name: string) {
  page.on('response', async (r) => {
    if (!r.url().startsWith(API)) return;
    if (r.request().method() === 'OPTIONS') return;
    let title: string | undefined;
    if (r.status() >= 400) {
      try { const b = await r.json(); title = typeof b?.title === 'string' ? b.title : undefined; } catch { /* sin cuerpo */ }
    }
    red.push({ pagina: name, metodo: r.request().method(), ruta: ruta(r.url()), codigo: r.status(), title });
  });
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(API)) red.push({ pagina: name, metodo: r.method(), ruta: ruta(r.url()), codigo: 0, title: `fallo de red: ${r.failure()?.errorText}` });
  });
}

async function shot(page: Page, id: string) {
  await page.waitForTimeout(300);
  // El trackingCode nunca queda en la evidencia: se tapa donde se muestra y donde se escribe
  await page.screenshot({
    path: path.join(OUT, 'capturas', `${String(pasos.length).padStart(2, '0')}-${id}.png`), fullPage: true,
    mask: [page.locator('[data-testid="tracking-code"], [data-testid="account-tracking-code"]'), page.getByLabel('Código de seguimiento')],
  });
}

let failed = false;
async function paso(id: string, via: 'UI' | 'HTTP', run: () => Promise<string | void>, pageOf?: () => Page | undefined) {
  if (failed) { pasos.push({ id, via, resultado: 'OMITIDO', nota: 'un paso anterior falló' }); return; }
  try {
    const nota = await run();
    pasos.push({ id, via, resultado: 'OK', ...(nota ? { nota } : {}) });
    const page = pageOf?.();
    if (page) await shot(page, id);
  } catch (e) {
    failed = true;
    // El mensaje de Playwright no contiene secretos: localizadores y textos de pantalla
    pasos.push({ id, via, resultado: 'FALLO', nota: String((e as Error).message).split('\n').slice(0, 4).join(' | ') });
    const page = pageOf?.();
    if (page) await shot(page, `${id}-FALLO`).catch(() => {});
  }
}

async function login(browser: Browser, who: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  watch(page, who);
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(EMAIL(who));
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/panel$/);
  return page;
}

/** JWT para los pasos por HTTP: solo en memoria del test. */
async function jwt(request: APIRequestContext, who: string): Promise<string> {
  const r = await request.post(`${API}/auth/login`, { data: { email: EMAIL(who), password: PASSWORD } });
  expect(r.status()).toBe(200);
  return (await r.json()).token;
}

function local(days: number) {
  const d = new Date(Date.now() + days * 86400000 + 5 * 60000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function pay(request: APIRequestContext, paymentRedirectUrl: string, amount: string) {
  const event = JSON.stringify({
    type: 'payment.confirmed', paymentSessionId: paymentRedirectUrl.split('/').pop(),
    providerEventId: `evt-${crypto.randomUUID()}`, amount, currency: 'COP',
  });
  const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(event).digest('hex');
  const r = await request.post(`${API}/webhooks/payments`, { data: event, headers: { 'Content-Type': 'application/json', 'X-Simulated-Signature': sig } });
  expect(r.status()).toBe(200);
}

async function donate(page: Page, amount: string) {
  await page.getByLabel('Monto (COP)').fill(amount);
  await page.getByLabel('Medio de pago').selectOption('GATEWAY');
  const created = page.waitForResponse((r) => r.url().includes('/donation-intents') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Donar' }).click();
  const res = await created;
  expect(res.status()).toBe(201);
  const { paymentRedirectUrl } = await res.json();
  await expect(page.getByText('Intención de donación registrada')).toBeVisible();
  return paymentRedirectUrl as string;
}

/** Consulta el estado hasta que llega el trackingCode (los fondos se aplican de forma asíncrona). */
async function waitTrackingCode(page: Page): Promise<string> {
  const code = page.getByTestId('tracking-code');
  const button = page.getByRole('button', { name: 'Consultar estado del pago' });
  for (let i = 0; i < 20; i++) {
    await button.click();
    // Espera a que termine la consulta: o llega el código (y el botón desaparece) o el botón vuelve a estar libre
    await expect(code.or(button.and(page.locator(':not([aria-busy="true"])')))).toBeVisible({ timeout: 15000 });
    if (await code.isVisible()) return (await code.textContent())!.trim();
    await page.waitForTimeout(1500);
  }
  throw new Error('el trackingCode no llegó tras 20 consultas');
}

async function act(page: Page, button: string, fields: [string, string][]) {
  await page.getByRole('button', { name: button, exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const [label, value] of fields) await dialog.getByLabel(label).fill(value);
  await dialog.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15000 });
}

const DELIVER: [string, string][] = [
  ['Custodio final (referencia)', 'ALIADO-LOCAL-1'], ['Beneficiario (referencia)', 'BEN-0001'],
  ['Lugar de entrega (referencia)', 'SALON-COMUNAL'], ['Evidencia (referencia)', 'ACTA-001'],
];

test('ensayo conjunto: golden path por la interfaz contra el backend real', async ({ browser, request }) => {
  expect(PASSWORD, 'cargar demo.env del backend (TRACEABILITY_DEMO_SEED_PASSWORD)').not.toBe('');
  fs.mkdirSync(path.join(OUT, 'capturas'), { recursive: true });
  const title = `Abrigo ensayo ${new Date().toISOString().slice(0, 19)}`;
  const s: Record<string, any> = {};

  // 0. Login y /me de cada papel (ID-01, N1)
  await paso('login-administrador', 'UI', async () => {
    s.admin = await login(browser, 'administrador');
    await expect(s.admin.getByRole('link', { name: 'Convocatorias de mi organización' })).toBeVisible();
  }, () => s.admin);

  // 1. Verificar la organización por la interfaz de plataforma. Sin listado de pendientes (D-04), el identificador lo
  // da la organización: el test lo toma de su `/me` (como haría el representante al comunicarlo)
  await paso('verificar-organizacion', 'UI', async () => {
    const t = await jwt(request, 'administrador');
    s.org = (await (await request.get(`${API}/me`, { headers: { Authorization: `Bearer ${t}` } })).json()).organizationId;
    const p = await login(browser, 'plataforma');
    s.platform = p;
    await p.getByRole('link', { name: 'Verificación de organizaciones' }).click();
    await p.getByLabel('Identificador de la organización').fill(s.org);
    await p.getByRole('button', { name: 'Verificar organización' }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Verificar organización' }).click();
    await expect(p.getByText(/: Verificada\./).or(p.getByRole('dialog').getByRole('alert'))).toBeVisible();
    const already = await p.getByRole('dialog').isVisible();
    return already ? 'ya estaba verificada (409 mostrado)' : 'Verificada; id dado por la organización (D-04)';
  }, () => s.platform);

  // Repetible: un EMPLOYEE solo es responsable de una convocatoria activa, así que se cierran por la interfaz las
  // convocatorias abiertas de ensayos anteriores (prueba también "Cerrar convocatoria" contra el backend real)
  await paso('cerrar-ensayos-anteriores', 'UI', async () => {
    const a = s.admin as Page;
    await a.getByRole('link', { name: 'Convocatorias de mi organización' }).click();
    await expect(a.getByRole('heading', { name: 'Listado' })).toBeVisible();
    await a.waitForTimeout(1500);
    let closed = 0;
    for (;;) {
      const open = a.getByTestId('org-campaign').filter({ hasText: 'Abrigo ensayo' })
        .filter({ has: a.getByRole('button', { name: 'Cerrar convocatoria' }) });
      if (await open.count() === 0) break;
      await open.first().getByRole('button', { name: 'Cerrar convocatoria' }).click();
      await a.getByRole('dialog').getByRole('button', { name: 'Cerrar convocatoria' }).click();
      await expect(a.getByText('Convocatoria cerrada.')).toBeVisible();
      await a.waitForTimeout(1000);
      closed++;
    }
    return `cerradas: ${closed}`;
  }, () => s.admin);

  // 2. Crear la convocatoria y asignar al empleado (CV-01, CV-02) por la interfaz
  await paso('crear-convocatoria', 'UI', async () => {
    const a = s.admin as Page;
    await a.getByRole('button', { name: 'Crear convocatoria' }).click();
    await a.getByLabel('Título').fill(title);
    await a.getByLabel(/Visibilidad/).selectOption('PUBLIC');
    await a.getByLabel(/^Inicio/).fill(local(0));
    await a.getByLabel(/^Fin/).fill(local(60));
    await a.getByLabel('Dinero').check();
    await a.getByLabel('Especie (bienes)').check();
    await a.getByLabel('Pasarela de pago').check();
    await a.getByLabel(/^Moneda/).fill('COP');
    await a.getByLabel(/^Meta/).fill('500000');
    await a.getByLabel('Política de meta').selectOption('FLEXIBLE');
    const created = a.waitForResponse((r) => /\/organizations\/[^/]+\/campaigns$/.test(r.url()) && r.request().method() === 'POST');
    await a.getByRole('button', { name: 'Crear convocatoria' }).last().click();
    const res = await created;
    expect(res.status()).toBe(201);
    s.publicCode = (await res.json()).publicCode;
    await expect(a.getByText('Convocatoria creada')).toBeVisible();
    await expect(a.getByTestId('org-campaign').filter({ hasText: title })).toBeVisible();
  }, () => s.admin);

  await paso('asignar-empleado', 'UI', async () => {
    const a = s.admin as Page;
    const row = a.getByTestId('org-campaign').filter({ hasText: title });
    await row.getByRole('button', { name: 'Asignar empleado' }).click();
    const select = a.getByLabel('Empleado', { exact: true });
    const value = await select.locator('option').filter({ hasText: /\(Empleado\)$/ }).first().getAttribute('value');
    await select.selectOption(value!);
    await a.getByRole('dialog').getByRole('button', { name: 'Asignar empleado' }).click();
    await expect(a.getByText('Empleado asignado.')).toBeVisible();
    await expect(row).toContainText('(Empleado)');
  }, () => s.admin);

  // 3A. Donación sin cuenta, por el enlace público (CV-07, CV-11)
  await paso('donar-sin-cuenta', 'UI', async () => {
    const anon = await (await browser.newContext()).newPage();
    watch(anon, 'anonimo');
    s.anon = anon;
    await anon.goto(`/c/${s.publicCode}`);
    await expect(anon.getByRole('heading', { level: 1, name: title })).toBeVisible();
    s.anonRedirect = await donate(anon, '60000');
  }, () => s.anon);
  await paso('pago-sin-cuenta (proveedor simulado)', 'HTTP', async () => { await pay(request, s.anonRedirect, '6000000'); return 'el test hace de proveedor de pago (DW-30)'; });
  await paso('codigo-seguimiento-sin-cuenta', 'UI', async () => { s.anonCode = await waitTrackingCode(s.anon); }, () => s.anon);

  // 3B. Donación con cuenta e historial (criterios 4 y 6)
  await paso('donar-con-cuenta', 'UI', async () => {
    const d = await login(browser, 'donante');
    s.donor = d;
    await d.getByRole('link', { name: 'Convocatorias' }).first().click();
    await d.getByRole('link', { name: title }).click();
    s.donorRedirect = await donate(d, '40000');
  }, () => s.donor);
  await paso('pago-con-cuenta (proveedor simulado)', 'HTTP', async () => { await pay(request, s.donorRedirect, '4000000'); return 'el test hace de proveedor de pago (DW-30)'; });
  await paso('historial-donante', 'UI', async () => {
    const d = s.donor as Page;
    await waitTrackingCode(d);
    await d.getByRole('link', { name: 'Panel' }).click();
    await d.getByRole('link', { name: 'Mis donaciones' }).click();
    await expect(d.getByTestId('account-donation').filter({ hasText: title })).toBeVisible();
  }, () => s.donor);

  await paso('convocatoria-publica-recaudado', 'UI', async () => {
    const p = await (await browser.newContext()).newPage();
    watch(p, 'publica');
    s.pub = p;
    await p.goto(`/c/${s.publicCode}`);
    const cleared = (await p.getByTestId('cleared-amount').textContent())?.trim();
    return `recaudado mostrado: ${cleared} (enviado: 60.000 + 40.000 COP; D-01)`;
  }, () => s.pub);

  // 4. Camino A por la interfaz: el administrador solicita y confirma una asignación; el empleado la elige al registrar
  await paso('fondo-y-asignacion', 'UI', async () => {
    const a = s.admin as Page;
    await a.getByRole('link', { name: 'Panel' }).click();
    await a.getByRole('link', { name: 'Fondos de mi organización' }).click();
    const fund = a.getByTestId('fund').filter({ hasNotText: 'Disponible0 COP' }).first();
    await expect(fund).toBeVisible();
    await fund.getByRole('button', { name: 'Solicitar asignación' }).click();
    await a.getByRole('dialog').getByLabel(/^Importe/).fill('10000');
    await a.getByRole('dialog').getByRole('button', { name: 'Solicitar asignación' }).click();
    await expect(a.getByText('Asignación solicitada.')).toBeVisible();
    await fund.getByRole('button', { name: 'Confirmar asignación' }).click();
    await a.getByRole('dialog').getByRole('button', { name: 'Confirmar asignación' }).click();
    await expect(a.getByText('Asignación confirmada.')).toBeVisible();
    await expect(fund.getByTestId('allocation')).toContainText('Confirmada');
  }, () => s.admin);

  await paso('registrar-activo-camino-A', 'UI', async () => {
    const e = await login(browser, 'empleado');
    s.employee = e;
    await e.getByRole('button', { name: 'Registrar activo' }).click();
    await e.getByLabel('Compra con fondos de una donación').check();
    await e.getByLabel('Fondo', { exact: true }).selectOption({ index: 1 });
    await e.getByLabel('Asignación de fondos', { exact: true }).selectOption({ index: 1 });
    await e.getByLabel('Tipo de bien').fill('BLANKET');
    await e.getByLabel('Cantidad').fill('10');
    await e.getByLabel('Unidad de medida').fill('UNITS');
    await e.getByLabel('Custodio (referencia)').fill('bodega-1');
    await e.getByLabel('Ubicación actual').fill('bodega-1');
    await e.getByRole('button', { name: 'Registrar' }).click();
    await expect(e).toHaveURL(/\/assets\//, { timeout: 15000 });
  }, () => s.employee);

  // 4B y 5. Logística, división y entrega
  await paso('despachar-recibir', 'UI', async () => {
    const e = s.employee as Page;
    await act(e, 'Despachar', [['Transportista (referencia)', 'transportista-1']]);
    await act(e, 'Recibir', [['Instalación (ubicación)', 'centro-1'], ['Quién recibe (referencia)', 'recibe-1']]);
  }, () => s.employee);
  await paso('dividir', 'UI', async () => {
    const e = s.employee as Page;
    await act(e, 'Dividir activo', [['Cantidad a separar', '4']]);
    await expect(e.getByText('División completada')).toBeVisible({ timeout: 60000 });
    await expect(e.getByTestId('field-quantity')).toHaveText(/^6(\.0+)?$/);
  }, () => s.employee);
  await paso('entregar-padre-e-hijo', 'UI', async () => {
    const e = s.employee as Page;
    await act(e, 'Entregar', DELIVER);
    await expect(e.getByTestId('state-content-readonly')).toBeVisible();
    await e.getByTestId('split-child-link').click();
    await expect(e.getByTestId('field-quantity')).toHaveText(/^4(\.0+)?$/);
    // El hijo nace REGISTERED: despachar y recibir antes de entregar (como recorrido.py)
    await act(e, 'Despachar', [['Transportista (referencia)', 'transportista-1']]);
    await act(e, 'Recibir', [['Instalación (ubicación)', 'centro-1'], ['Quién recibe (referencia)', 'recibe-1']]);
    await act(e, 'Entregar', DELIVER);
    await expect(e.getByTestId('state-content-readonly')).toBeVisible();
  }, () => s.employee);

  await paso('activos-organizacion', 'UI', async () => {
    const e = s.employee as Page;
    await e.getByRole('link', { name: 'Panel' }).click();
    await e.getByRole('link', { name: 'Activos de mi organización' }).click();
    await expect(e.getByTestId('org-asset')).toHaveCount(2);
    await expect(e.getByTestId('org-asset').filter({ hasText: 'Entregado' })).toHaveCount(2);
  }, () => s.employee);

  // 6/7. Seguimiento por formulario (el código nunca en la URL)
  await paso('seguimiento', 'UI', async () => {
    const t = await (await browser.newContext()).newPage();
    watch(t, 'seguimiento');
    s.tracker = t;
    await t.goto('/tracking');
    await t.getByLabel('Código de seguimiento').fill(s.anonCode);
    await t.getByRole('button', { name: 'Ver seguimiento' }).click();
    await expect(t.getByTestId('tracking-original')).toBeVisible({ timeout: 15000 });
    expect(t.url()).not.toContain(s.anonCode);
    // Relato individual: 202 PENDING al principio; "Actualizar" hasta que llega (sin clave de LLM: plantilla)
    const plantilla = t.getByText('Relato de plantilla (sin IA).');
    for (let i = 0; i < 15; i++) {
      await t.waitForTimeout(2000);
      if (await plantilla.isVisible()) return 'relato individual: plantilla (FALLBACK_TEMPLATE)';
      const again = t.getByRole('button', { name: 'Actualizar' });
      if (await again.isVisible()) await again.click();
    }
    return 'relato individual: no llegó en 30 s';
  }, () => s.tracker);

  // Panel: listado, estimación y narrativa
  await paso('estimacion', 'UI', async () => {
    const a = s.admin as Page;
    await a.getByRole('link', { name: 'Panel' }).click();
    await a.getByRole('link', { name: 'Estimación de convocatorias' }).click();
    await a.getByLabel('Convocatoria').selectOption({ label: title });
    await a.getByRole('button', { name: 'Ver estimación' }).click();
    await expect(a.getByText('ESTIMACIÓN — modelo entrenado con datos sintéticos').first()).toBeVisible();
    const figure = await a.getByTestId('prediction-estimate').isVisible();
    return figure ? 'con cifra' : `sin cifra: ${(await a.locator('main').textContent())?.match(/Sin cifra para esta convocatoria(.{0,120})/)?.[1] ?? ''}`;
  }, () => s.admin);
  await paso('narrativa-convocatoria', 'UI', async () => {
    const p = s.pub as Page;
    await p.reload();
    await expect(p.getByRole('heading', { level: 1, name: title })).toBeVisible();
    const unavailable = p.getByText('El relato de esta convocatoria no está disponible.');
    for (let i = 0; i < 15 && !(await unavailable.isVisible()); i++) {
      await p.waitForTimeout(2000);
      const again = p.getByRole('button', { name: 'Actualizar' });
      if (await again.isVisible()) await again.click();
    }
    await expect(p.getByText('El relato de esta convocatoria no está disponible.')).toBeVisible();
    return 'UNAVAILABLE sin clave de LLM, con sus hechos (lo esperado según el runbook)';
  }, () => s.pub);

  fs.writeFileSync(path.join(OUT, 'pasos.json'), JSON.stringify(pasos, null, 2) + '\n');
  fs.writeFileSync(path.join(OUT, 'red.json'), JSON.stringify(red, null, 2) + '\n');
  expect(pasos.filter((p) => p.resultado !== 'OK')).toEqual([]);
});
