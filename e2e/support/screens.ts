// Ref: plan-fase7-pantallas.md C-1 ("capturas en claro y oscuro … de todas las pantallas" y la búsqueda de contraste
// en oscuro) y plan-fase7-fidelidad.md F-A0. Un solo recorrido para la prueba de contraste y para las capturas.
import { expect, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:3002';

/** Una pantalla del recorrido: se llega con `go` y está lista cuando se cumple `ready`. */
export type Screen = { name: string; go: (page: Page) => Promise<void> };
export type Tour = { account: 'none' | 'donante' | 'admin' | 'empleado'; screens: Screen[] };

const ACCOUNTS = {
  donante: ['donante@demo.test', 'demo-donante'],
  admin: ['admin@demo.test', 'demo-admin'],
  empleado: ['empleado@demo.test', 'demo-empleado'],
} as const;

/** Respuestas fijas del seguimiento (mismas que la captura de VS-7): el backend falso no tiene logística de ejemplo. */
const TRACKING = {
  financialSnapshot: { currency: 'COP', originalAmount: 30000000, clearedAmount: 30000000, pendingAllocationAmount: 0, confirmedAllocationAmount: 30000000, refundedAmount: 0 },
  campaignTitle: 'Mercados para adultos mayores', organizationName: 'Fundación Demo', status: 'EN_PROCESO',
  logistics: [
    { assetRef: 'A1', lifecycleStatus: 'DELIVERED', assetType: 'Mercado', unitOfMeasure: 'kit', quantity: '60.0000', locationZone: 'Zona centro', custodianCategory: 'LOCAL_ALLY' },
    { assetRef: 'A2', lifecycleStatus: 'DISPATCHED', assetType: 'Mercado', unitOfMeasure: 'kit', quantity: '40.0000', locationZone: null, custodianCategory: 'LAST_MILE_CARRIER' },
  ],
};
const HISTORY: Record<string, unknown[]> = {
  A1: [
    { eventType: 'ASSET_REGISTERED', timestamp: '2026-10-08T14:00:00Z', locationZone: 'Zona norte', custodianCategory: 'REGIONAL_WAREHOUSE', status: 'REGISTERED' },
    { eventType: 'ASSET_DISPATCHED', timestamp: '2026-10-09T09:15:00Z', locationZone: null, custodianCategory: 'LAST_MILE_CARRIER', status: 'DISPATCHED' },
    { eventType: 'ASSET_RECEIVED', timestamp: '2026-10-10T11:30:00Z', locationZone: 'Zona centro', custodianCategory: 'LOCAL_ALLY', status: 'RECEIVED' },
    { eventType: 'ASSET_DELIVERED', timestamp: '2026-10-10T15:20:00Z', locationZone: 'Zona centro', custodianCategory: 'LOCAL_ALLY', status: 'DELIVERED' },
  ],
  A2: [
    { eventType: 'ASSET_REGISTERED', timestamp: '2026-10-08T14:00:00Z', locationZone: 'Zona norte', custodianCategory: 'REGIONAL_WAREHOUSE', status: 'REGISTERED' },
    { eventType: 'ASSET_DISPATCHED', timestamp: '2026-10-11T08:00:00Z', locationZone: null, custodianCategory: 'LAST_MILE_CARRIER', status: 'DISPATCHED' },
  ],
};

export async function mockTracking(page: Page): Promise<void> {
  await page.route('**/api/v1/donations/tracking**', async (route) => {
    const u = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.endsWith('/donations/tracking')) return json(TRACKING);
    if (u.endsWith('/narrative')) return json({ status: 'AVAILABLE', content: 'Tu donación se convirtió en mercados que ya llegaron a la comunidad.', source: 'LLM_GENERATED' });
    if (u.endsWith('/integrity')) return json({ batches: [{ anchorStatus: 'ANCHORED', merkleRoot: '0x' + 'ab'.repeat(32), transactionHash: '0x' + 'cd'.repeat(32), network: 'red de prueba', anchoredAt: '2026-10-10T16:00:00Z', confirmedBlockNumber: 42, eventsOfThisDonation: 6, verification: { result: 'MATCH' } }], unanchoredEvents: 0, checkedAt: '2026-10-11T09:00:00Z' });
    const m = u.match(/assets\/([^/]+)\/history$/);
    return m ? json({ history: HISTORY[m[1]] ?? [] }) : json({}, 404);
  });
}

/** Una donación pagada del donante (por la API), para que `/account/donations` y `/home` tengan contenido. */
export async function seedDonation(request: APIRequestContext): Promise<void> {
  const { publicCode } = await (await request.post(`${API}/__test/campaigns`, { data: { title: 'Mercados para adultos mayores' } })).json();
  const { token } = await (await request.post(`${API}/api/v1/auth/login`, { data: { email: 'donante@demo.test', password: 'demo-donante' } })).json();
  const intent = await (await request.post(`${API}/api/v1/public/campaigns/${publicCode}/donation-intents`, {
    headers: { 'Command-Id': crypto.randomUUID(), Authorization: `Bearer ${token}` }, data: { amount: '3000000', currency: 'COP', paymentMethod: 'GATEWAY' },
  })).json();
  await request.post(`${API}/__test/payments`, { data: { intentId: intent.intentId } });
}

/** La sesión vive en memoria (D2): dentro de una cuenta se navega con el router, nunca recargando. */
async function push(page: Page, to: string) {
  await page.waitForFunction(() => !!(window as unknown as { __TEST_ROUTER__?: unknown }).__TEST_ROUTER__);
  await page.evaluate((p) => (window as unknown as { __TEST_ROUTER__: { push: (p: string) => void } }).__TEST_ROUTER__.push(p), to);
  await expect(page).toHaveURL(new RegExp(to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  await page.waitForLoadState('networkidle');
}

export async function login(page: Page, account: Exclude<Tour['account'], 'none'>): Promise<void> {
  const [email, password] = ACCOUNTS[account];
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await page.waitForLoadState('networkidle');
}

const visit = (name: string, path: string, ready: (page: Page) => Promise<void>): Screen => ({
  name,
  go: async (page) => { await page.goto(path); await ready(page); await page.waitForLoadState('networkidle'); },
});
const route = (name: string, path: string, ready?: (page: Page) => Promise<void>): Screen => ({
  name,
  go: async (page) => { await push(page, path); if (ready) await ready(page); },
});
const h1 = (page: Page) => expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

export const TOURS: Tour[] = [
  {
    account: 'none',
    screens: [
      visit('landing', '/', h1),
      visit('campaigns', '/campaigns', (p) => expect(p.getByTestId('discovery-item').first()).toBeVisible()),
      visit('campaign-public', '/c/01JDEMOPUBLICC0DEMONETARY1', h1),
      {
        name: 'tracking',
        go: async (page) => {
          await mockTracking(page);
          await page.goto('/tracking');
          await page.getByLabel('Código de seguimiento').fill('TRK.captura-de-prueba-8841');
          await page.getByRole('button', { name: 'Ver seguimiento' }).click();
          await expect(page.getByTestId('integrity-verdict')).toBeVisible();
          await expect(page.getByTestId('tracking-step').first()).toBeVisible();
        },
      },
      visit('login', '/login', (p) => expect(p.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible()),
      {
        name: 'login-errores',
        go: async (page) => {
          await page.goto('/login');
          await page.getByRole('button', { name: 'Iniciar sesión' }).click();
          await expect(page.getByText('Este campo es obligatorio.').first()).toBeVisible();
        },
      },
      visit('register', '/register', (p) => expect(p.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeVisible()),
      visit('invitaciones', '/invitaciones#token=token-de-captura', (p) => expect(p.getByRole('heading', { level: 2, name: 'Tienes una invitación' })).toBeVisible()),
      visit('no-encontrada', '/esta-ruta-no-existe', (p) => expect(p.getByText('No encontramos esta página.')).toBeVisible()),
    ],
  },
  {
    account: 'donante',
    screens: [
      route('home-donante', '/home', h1),
      route('account-donations', '/account/donations', (p) => expect(p.getByTestId('account-donation').first()).toBeVisible()),
    ],
  },
  {
    account: 'admin',
    screens: [
      route('home-admin', '/home', h1),
      route('panel', '/panel', (p) => expect(p.getByTestId('panel-content')).toBeVisible()),
      route('panel-campaigns', '/panel/campaigns', h1),
      route('panel-prediction', '/panel/prediction', h1),
      route('panel-funds', '/panel/funds', h1),
      route('panel-assets', '/panel/assets', h1),
      route('panel-configuration', '/panel/configuration', h1),
      route('panel-members', '/panel/members', h1),
      route('panel-my-campaigns', '/panel/my-campaigns', h1),
      route('panel-organization', '/panel/organization', h1),
      route('panel-platform', '/panel/platform', h1),
    ],
  },
  {
    account: 'empleado',
    screens: [
      route('asset-detail', '/assets/ASSET-123', (p) => expect(p.getByTestId('field-lifecycleStatus')).toBeVisible()),
    ],
  },
];
