import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as session from '../src/lib/auth/session';
import type { PublicCampaign } from '../src/lib/api/publicCampaigns';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

const CAMPAIGN: PublicCampaign = {
  organizationName: 'Fundación Demo', title: 'Mercados', description: 'Texto', status: 'OPEN',
  startDate: '2026-10-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z', acceptedDonationTypes: ['MONETARY'],
  acceptedPaymentMethods: ['GATEWAY', 'CASH'], currency: 'COP', targetAmount: '500000000', clearedAmount: '125000000',
};

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});

async function screens() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/c/:publicCode', 'action:donate', '/tracking']));
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  const sessionMod = await import('../src/lib/auth/session');
  const pub = await import('../src/screens/CampaignPublicScreen');
  const donate = await import('../src/components/campaign/DonateSection');
  return { sessionMod, ...pub, ...donate };
}

describe('CampaignPublicPage (/c/:publicCode, CV-07)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('contenido: organización, título, recaudado/meta en unidades mínimas y medios de pago', async () => {
    const { CampaignPublicScreen } = await screens();
    render(<CampaignPublicScreen publicCode="PC" initial={{ kind: 'ok', campaign: CAMPAIGN }} />);
    expect(screen.getByText('Fundación Demo')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mercados');
    expect(screen.getByTestId('cleared-amount')).toHaveTextContent('1.250.000 COP');
    expect(screen.getByText('5.000.000 COP')).toBeInTheDocument();
    expect(screen.getByText('25 % de la meta')).toBeInTheDocument();
    const chips = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(chips).toEqual(expect.arrayContaining(['Dinero', 'Pasarela de pago', 'Efectivo']));
    expect(screen.getByRole('heading', { name: 'Donar' })).toBeInTheDocument();
  });

  it('no encontrada → estado de pantalla propio', async () => {
    const { CampaignPublicScreen } = await screens();
    render(<CampaignPublicScreen publicCode="PC" initial={{ kind: 'not-found' }} />);
    expect(screen.getByText('No encontramos esta convocatoria. Verifica el enlace.')).toBeInTheDocument();
  });

  it('error → Reintentar vuelve a leer y muestra el contenido', async () => {
    const { CampaignPublicScreen } = await screens();
    const client = vi.fn().mockResolvedValue({ kind: 'ok', campaign: CAMPAIGN });
    render(<CampaignPublicScreen publicCode="PC" initial={{ kind: 'error' }} client={client} />);
    fireEvent.click(screen.getByText('Reintentar'));
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Mercados');
    expect(client).toHaveBeenCalledWith('PC');
  });

  it('sin la acción habilitada no hay botón Donar', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/c/:publicCode']));
    const { CampaignPublicScreen } = await import('../src/screens/CampaignPublicScreen');
    render(<CampaignPublicScreen publicCode="PC" initial={{ kind: 'ok', campaign: CAMPAIGN }} />);
    expect(screen.queryByRole('heading', { name: 'Donar' })).toBeNull();
  });
});

describe('Donar (CV-11) y consulta del estado', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    global.fetch = fetchMock as any;
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  function donate(amount = '50000', method?: string) {
    fireEvent.change(screen.getByLabelText('Monto (COP)'), { target: { value: amount } });
    if (method) fireEvent.change(screen.getByLabelText('Medio de pago'), { target: { value: method } });
    fireEvent.click(screen.getByRole('button', { name: 'Donar' }));
  }

  it('convocatoria cerrada o solo en especie → aviso, sin formulario', async () => {
    const { DonateSection } = await screens();
    const { unmount } = render(<DonateSection publicCode="PC" campaign={{ ...CAMPAIGN, status: 'CLOSED' }} />);
    expect(screen.getByText('Esta convocatoria está cerrada y ya no recibe donaciones.')).toBeInTheDocument();
    unmount();
    render(<DonateSection publicCode="PC" campaign={{ ...CAMPAIGN, acceptedDonationTypes: ['IN_KIND'] }} />);
    expect(screen.queryByLabelText('Monto (COP)')).toBeNull();
  });

  it('el efectivo no se ofrece (CV-11 no lo registra) y un monto inválido no llama al backend', async () => {
    const { DonateSection } = await screens();
    render(<DonateSection publicCode="PC" campaign={CAMPAIGN} />);
    expect(screen.queryByRole('option', { name: 'Efectivo' })).toBeNull();
    donate('1.000.000');
    expect(screen.getByText(/Escribe un monto válido/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('éxito: cuerpo en unidades mínimas, Command-Id, sin JWT si no hay sesión; luego estado con Intent-Token', async () => {
    const { DonateSection, sessionMod } = await screens();
    sessionMod._resetForTest();
    fetchMock.mockResolvedValueOnce(res(201, { intentId: 'i-1', statusToken: 'tok-secreto', paymentRedirectUrl: '/demo/checkout/sim_x' }));
    const statusClient = vi.fn().mockResolvedValue({ kind: 'ok', status: 'PENDING' });
    render(<DonateSection publicCode="PC 1" campaign={CAMPAIGN} statusClient={statusClient} />);
    donate('50000,5');
    expect(await screen.findByText('Intención de donación registrada')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/public/campaigns/PC%201/donation-intents');
    expect(JSON.parse(init.body)).toEqual({ amount: '5000050', currency: 'COP', paymentMethod: 'GATEWAY' });
    expect(init.headers['Command-Id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(init.headers.Authorization).toBeUndefined();
    expect(screen.getByText('Redirección a la pasarela de pago (simulada)')).toBeInTheDocument();
    // El token nunca llega al DOM
    expect(document.body.innerHTML).not.toContain('tok-secreto');

    fireEvent.click(screen.getByRole('button', { name: 'Consultar estado del pago' }));
    expect(await screen.findByText('El pago todavía está pendiente de confirmación.')).toBeInTheDocument();
    expect(statusClient).toHaveBeenCalledWith('i-1', 'tok-secreto');
  });

  it('con sesión: envía el JWT (donación con cuenta)', async () => {
    const { DonateSection, sessionMod } = await screens();
    sessionMod.login('jwt-donante');
    fetchMock.mockResolvedValueOnce(res(201, { intentId: 'i-1', statusToken: 't' }));
    render(<DonateSection publicCode="PC" campaign={{ ...CAMPAIGN, acceptedPaymentMethods: ['GATEWAY', 'BANK_TRANSFER'] }} />);
    expect(screen.getByText(/Donarás con tu cuenta/)).toBeInTheDocument();
    donate('50000', 'BANK_TRANSFER');
    await screen.findByText('Intención de donación registrada');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-donante');
    expect(screen.getByText(/La organización confirmará la transferencia/)).toBeInTheDocument();
  });

  it('confirmada con trackingCode: se muestra con el aviso de que es la llave del seguimiento', async () => {
    const { DonateSection, sessionMod } = await screens();
    sessionMod._resetForTest();
    fetchMock.mockResolvedValueOnce(res(201, { intentId: 'i-1', statusToken: 't' }));
    const statusClient = vi.fn().mockResolvedValue({ kind: 'ok', status: 'CONFIRMED', trackingCode: 'TRK.abc' });
    render(<DonateSection publicCode="PC" campaign={CAMPAIGN} statusClient={statusClient} />);
    donate();
    fireEvent.click(await screen.findByRole('button', { name: 'Consultar estado del pago' }));
    expect(await screen.findByTestId('tracking-code')).toHaveTextContent('TRK.abc');
    expect(screen.getByText(/Es la llave para ver el recorrido de tu donación/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Consultar estado del pago' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Ver seguimiento' })).toHaveAttribute('href', '/tracking');
  });

  it('estados de la intención: confirmada sin fondos aplicados, fallida, 404 y error', async () => {
    const { DonateSection, sessionMod } = await screens();
    sessionMod._resetForTest();
    fetchMock.mockResolvedValueOnce(res(201, { intentId: 'i-1', statusToken: 't' }));
    const statusClient = vi.fn()
      .mockResolvedValueOnce({ kind: 'ok', status: 'CONFIRMED' })
      .mockResolvedValueOnce({ kind: 'not-found' })
      .mockResolvedValueOnce({ kind: 'error' })
      .mockResolvedValueOnce({ kind: 'ok', status: 'FAILED' });
    render(<DonateSection publicCode="PC" campaign={CAMPAIGN} statusClient={statusClient} />);
    donate();
    const consult = await screen.findByRole('button', { name: 'Consultar estado del pago' });
    fireEvent.click(consult);
    expect(await screen.findByText(/Estamos aplicando los fondos/)).toBeInTheDocument();
    fireEvent.click(consult);
    expect(await screen.findByText(/el acceso a su estado ya no es válido/)).toBeInTheDocument();
    fireEvent.click(consult);
    expect(await screen.findByText('No pudimos consultar el estado. Inténtalo de nuevo.')).toBeInTheDocument();
    fireEvent.click(consult);
    expect(await screen.findByText('El pago no se completó.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hacer otra donación' }));
    expect(screen.getByRole('heading', { name: 'Donar' })).toBeInTheDocument();
  });

  it('409 CampaignClosed → rechazo con su texto; otra intención lleva un Command-Id nuevo', async () => {
    const { DonateSection, sessionMod } = await screens();
    sessionMod._resetForTest();
    fetchMock.mockResolvedValueOnce(res(409, { title: 'CampaignClosed', detail: 'interno' }))
      .mockResolvedValueOnce(res(201, { intentId: 'i-2', statusToken: 't' }));
    render(<DonateSection publicCode="PC" campaign={CAMPAIGN} />);
    donate();
    expect(await screen.findByText('Esta convocatoria está cerrada y ya no recibe donaciones.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('interno');
    donate();
    await screen.findByText('Intención de donación registrada');
    expect(fetchMock.mock.calls[1][1].headers['Command-Id']).not.toBe(fetchMock.mock.calls[0][1].headers['Command-Id']);
  });

  it('403 → rechazo "No tienes acceso"', async () => {
    const { DonateSection, sessionMod } = await screens();
    sessionMod._resetForTest();
    fetchMock.mockResolvedValueOnce(res(403, { title: 'Forbidden' }));
    render(<DonateSection publicCode="PC" campaign={CAMPAIGN} />);
    donate();
    expect(await screen.findByText('No tienes acceso a esta operación.')).toBeInTheDocument();
  });

  it('ambiguo (red) → Reintentar con el mismo Command-Id; nunca solo', async () => {
    const { DonateSection, sessionMod } = await screens();
    sessionMod._resetForTest();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(res(201, { intentId: 'i-1', statusToken: 't-nuevo' }));
    render(<DonateSection publicCode="PC" campaign={CAMPAIGN} />);
    donate();
    expect(await screen.findByText('No pudimos confirmar la operación')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Reintentar'));
    await screen.findByText('Intención de donación registrada');
    expect(fetchMock.mock.calls[1][1].headers['Command-Id']).toBe(fetchMock.mock.calls[0][1].headers['Command-Id']);
  });

  it('401 con JWT → T-1 (la sesión se cierra) y la intención se pierde', async () => {
    const { DonateSection, sessionMod } = await screens();
    sessionMod.login('jwt-caducado');
    fetchMock.mockResolvedValueOnce(res(401, { title: 'Unauthorized' }));
    render(<DonateSection publicCode="PC" campaign={CAMPAIGN} />);
    donate();
    await waitFor(() => expect(sessionMod.getState()).toBe('LOGGED_OUT'));
    expect(screen.getByRole('button', { name: 'Donar' })).toBeEnabled();
  });
});

describe('fetchIntentStatus', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('el token va en la cabecera Intent-Token, nunca en la URL, y sin JWT', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
    session.login('jwt');
    const fetchMock = vi.fn().mockResolvedValue(res(200, { status: 'CONFIRMED', trackingCode: 'TRK' }));
    global.fetch = fetchMock as any;
    const { fetchIntentStatus } = await import('../src/lib/api/publicCampaigns');
    expect(await fetchIntentStatus('i 1', 'tok')).toEqual({ kind: 'ok', status: 'CONFIRMED', trackingCode: 'TRK' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/public/donation-intents/i%201');
    expect(url).not.toContain('tok');
    expect(init.headers['Intent-Token']).toBe('tok');
    expect(init.headers.Authorization).toBeUndefined();
    fetchMock.mockResolvedValue(res(404));
    expect(await fetchIntentStatus('i', 'tok')).toEqual({ kind: 'not-found' });
  });
});

describe('A3 — aviso antes de salir con una donación sin confirmar', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { global.fetch = fetchMock as any; fetchMock.mockReset(); });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  const unloadCancelled = () => {
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  };

  async function startDonation(statusClient: any) {
    const { DonateSection, sessionMod } = await screens();
    sessionMod._resetForTest();
    fetchMock.mockResolvedValueOnce(res(201, { intentId: 'i-1', statusToken: 't' }));
    const view = render(
      <>
        <a href="/panel">Salir</a>
        <DonateSection publicCode="PC" campaign={CAMPAIGN} statusClient={statusClient} />
      </>,
    );
    expect(unloadCancelled()).toBe(false);
    fireEvent.change(screen.getByLabelText('Monto (COP)'), { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Donar' }));
    await screen.findByText('Intención de donación registrada');
    return view;
  }

  it('con la intención abierta: recargar o cerrar pide confirmación', async () => {
    await startDonation(vi.fn());
    expect(unloadCancelled()).toBe(true);
  });

  it('un enlace de la propia web pide confirmación; si se cancela, no se navega', async () => {
    await startDonation(vi.fn());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByText('Salir').dispatchEvent(click);
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/perderás el acceso al estado de tu donación/));
    expect(click.defaultPrevented).toBe(true);
  });

  it('con el trackingCode ya mostrado, deja de avisar', async () => {
    await startDonation(vi.fn().mockResolvedValue({ kind: 'ok', status: 'CONFIRMED', trackingCode: 'TRK.x' }));
    fireEvent.click(screen.getByRole('button', { name: 'Consultar estado del pago' }));
    await screen.findByTestId('tracking-code');
    expect(unloadCancelled()).toBe(false);
  });

  it('el trackingCode se destaca en cuanto llega: recibe el foco', async () => {
    await startDonation(vi.fn().mockResolvedValue({ kind: 'ok', status: 'CONFIRMED', trackingCode: 'TRK.x' }));
    fireEvent.click(screen.getByRole('button', { name: 'Consultar estado del pago' }));
    const code = await screen.findByTestId('tracking-code');
    await waitFor(() => expect(document.activeElement).toBe(code.closest('[data-testid="tracking-reveal"]')));
  });
});
