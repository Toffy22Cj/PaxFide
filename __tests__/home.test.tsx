// Ref: plan-fase7-pantallas.md A-3 (tests), D-P6, D-P7 y D-P11; DF7-21; DW-16 (el trackingCode viaja en memoria).
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Principal, MeOutcome } from '../src/lib/api/identity';
import type { AccountDonation, AccountDonationsOutcome } from '../src/lib/api/account';
import type { DiscoveryItem, DiscoveryOutcome } from '../src/lib/api/publicCampaigns';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => '/home' }));
vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...rest }: { href: string; children: React.ReactNode; onClick?: () => void }) =>
    <a href={href} onClick={(e) => { e.preventDefault(); onClick?.(); }} {...rest}>{children}</a>,
}));
let enabled = new Set<string>();
vi.mock('../src/lib/routing/surfaces', () => ({ isSurfaceEnabled: (s: string) => enabled.has(s) }));

import { HomeScreen, accountCards, greetingFor, HOME_ITEMS } from '../src/screens/HomeScreen';
import { defaultDestination } from '../src/app/RouteGuard';
import { consumeHandedOffTrackingCode } from '../src/lib/tracking/handoff';

const ALL = ['/home', '/tracking', '/campaigns', '/account/donations', '/c/:publicCode', '/panel', '/panel/organization', '/panel/platform'];
const donor: Principal = { accountId: 'a', roles: [] };
const member: Principal = { accountId: 'a', organizationId: 'org-1', roles: ['ADMINISTRATOR'] };
const platform: Principal = { accountId: 'p', roles: [], platformAuthority: 'PLATFORM_ADMIN' };

const me = (p: Principal) => async (): Promise<MeOutcome> => ({ kind: 'ok', principal: p });
const donations = (items: AccountDonation[]) => async (): Promise<AccountDonationsOutcome> => ({ kind: 'ok', items });
const campaigns = (items: DiscoveryItem[] = []) => async (): Promise<DiscoveryOutcome> => ({ kind: 'ok', items });

function donation(over: Partial<AccountDonation> = {}): AccountDonation {
  return {
    intentId: 'i1', campaignTitle: 'Mercados para adultos mayores', amount: '5000000', currency: 'COP', status: 'CONFIRMED',
    createdAt: '2026-10-20T15:00:00Z', organizationName: 'Fundación Demo', paymentMethod: 'GATEWAY', ...over,
  };
}

function renderHome(p: Principal, items: AccountDonation[] = [], camps: DiscoveryItem[] = []) {
  return render(<HomeScreen meClient={me(p)} donationsClient={donations(items)} campaignsClient={campaigns(camps)} />);
}

beforeEach(() => {
  enabled = new Set(ALL);
  push.mockReset();
  consumeHandedOffTrackingCode();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('Home (A-3) — tarjetas por cuenta (D-P6)', () => {
  it('sin organización: "¿Tienes una fundación?" → /panel/organization; ni organización ni plataforma', () => {
    const ids = accountCards(donor).map((c) => c.id);
    expect(ids).toEqual(['create-organization']);
    expect(accountCards(donor)[0].href).toBe('/panel/organization');
  });

  it('con organización: "Ir a tu organización" → /panel; ni crear organización ni plataforma', () => {
    const cards = accountCards(member);
    expect(cards.map((c) => c.id)).toEqual(['organization']);
    expect(cards[0]).toMatchObject({ action: 'Ir a tu organización', href: '/panel' });
  });

  it('con platformAuthority (DF7-21): "Plataforma" → /panel/platform, además de su tarjeta de organización', () => {
    expect(accountCards(platform).map((c) => c.id)).toEqual(['create-organization', 'platform']);
    expect(accountCards({ ...member, platformAuthority: 'PLATFORM_ADMIN' }).map((c) => c.id)).toEqual(['organization', 'platform']);
    expect(accountCards(platform).find((c) => c.id === 'platform')?.href).toBe('/panel/platform');
  });

  it('sin /me leído no se infiere ninguna; con el destino deshabilitado, la tarjeta no aparece', () => {
    expect(accountCards(null)).toEqual([]);
    enabled.delete('/panel/platform');
    expect(accountCards(platform).map((c) => c.id)).toEqual(['create-organization']);
  });

  it('en pantalla: las tarjetas de cada cuenta, con negativas cruzadas', async () => {
    const { unmount } = renderHome(member);
    expect(await screen.findByTestId('home-card-organization')).toBeInTheDocument();
    expect(screen.queryByTestId('home-card-create-organization')).toBeNull();
    expect(screen.queryByTestId('home-card-platform')).toBeNull();
    expect(screen.getByRole('link', { name: 'Ir a tu organización' })).toHaveAttribute('href', '/panel');
    unmount();
    renderHome(platform);
    expect(await screen.findByTestId('home-card-platform')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a la plataforma' })).toHaveAttribute('href', '/panel/platform');
    expect(screen.queryByTestId('home-card-organization')).toBeNull();
  });
});

describe('Home (A-3) — saludo, seguimiento y sellado (D-P7)', () => {
  it('saludo por la hora, sin nombre ni correo', async () => {
    expect([greetingFor(8), greetingFor(13), greetingFor(21)]).toEqual(['Buenos días', 'Buenas tardes', 'Buenas noches']);
    renderHome(donor);
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(['Buenos días', 'Buenas tardes', 'Buenas noches']).toContain(h1.textContent);
    expect(screen.queryByText(/@/)).toBeNull();
  });

  it('"Seguir una donación": vacío → obligatorio; con código → /tracking por memoria, nunca en la URL ni en el almacenamiento', async () => {
    renderHome(donor);
    fireEvent.click(screen.getByRole('button', { name: 'Ver recorrido' }));
    expect(screen.getByText('Este campo es obligatorio.')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Código de seguimiento'), { target: { value: '  TRK.secreto-1  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver recorrido' }));
    expect(push).toHaveBeenCalledWith('/tracking');
    expect(consumeHandedOffTrackingCode()).toBe('TRK.secreto-1');
    expect(screen.getByLabelText('Código de seguimiento')).toHaveValue('');
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('secreto');
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain('secreto');
  });

  it('sin /tracking habilitada, no hay tarjeta de seguimiento', async () => {
    enabled.delete('/tracking');
    renderHome(donor);
    await screen.findByTestId('home-donations');
    expect(screen.queryByRole('heading', { name: 'Seguir una donación' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Sellado en blockchain' })).toBeInTheDocument();
  });
});

describe('Home (A-3) — tus donaciones (D-P11) y convocatorias', () => {
  it('vacía → el texto aprobado', async () => {
    renderHome(donor, []);
    expect(await screen.findByText('Todavía no tienes donaciones hechas con esta cuenta.')).toBeInTheDocument();
  });

  it(`las ${HOME_ITEMS} primeras, con fecha, organización y medio de pago; "Ver todas" → /account/donations`, async () => {
    const items = Array.from({ length: 5 }, (_, i) => donation({ intentId: `i${i}`, campaignTitle: `Convocatoria ${i}` }));
    renderHome(donor, items);
    const rows = await screen.findAllByTestId('home-donation');
    expect(rows).toHaveLength(HOME_ITEMS);
    expect(rows[0]).toHaveTextContent('Fundación Demo');
    expect(rows[0]).toHaveTextContent('Pasarela de pago');
    expect(rows[0]).toHaveTextContent('Confirmada');
    expect(rows[0].querySelector('time')).toHaveAttribute('datetime', '2026-10-20T15:00:00Z');
    expect(screen.queryByText('Convocatoria 3')).toBeNull();
    expect(within(screen.getByTestId('home-donations')).getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/account/donations');
  });

  it('enlace a la convocatoria solo con publicCode (negativa sin él)', async () => {
    renderHome(donor, [donation({ intentId: 'a', publicCode: 'PUB1' }), donation({ intentId: 'b', campaignTitle: 'Privada' })]);
    const rows = await screen.findAllByTestId('home-donation');
    expect(within(rows[0]).getByRole('link', { name: 'Ver convocatoria' })).toHaveAttribute('href', '/c/PUB1');
    expect(within(rows[1]).queryByRole('link', { name: 'Ver convocatoria' })).toBeNull();
  });

  it('el trackingCode no se pinta; "Ver recorrido" lo pasa en memoria y el enlace es /tracking sin código', async () => {
    const { container } = renderHome(donor, [donation({ trackingCode: 'TRK.secreto-2' })]);
    const row = await screen.findByTestId('home-donation');
    expect(container.textContent).not.toContain('TRK.secreto-2');
    const link = within(row).getByRole('link', { name: 'Ver recorrido' });
    expect(link).toHaveAttribute('href', '/tracking');
    fireEvent.click(link);
    expect(consumeHandedOffTrackingCode()).toBe('TRK.secreto-2');
  });

  it('sin trackingCode, no hay "Ver recorrido"', async () => {
    renderHome(donor, [donation({ status: 'PENDING' })]);
    const row = await screen.findByTestId('home-donation');
    expect(within(row).queryByRole('link', { name: 'Ver recorrido' })).toBeNull();
  });

  it(`convocatorias abiertas: las ${HOME_ITEMS} primeras con la tarjeta compartida; "Ver todas" → /campaigns`, async () => {
    const camps = Array.from({ length: 5 }, (_, i) => ({
      publicCode: `PC${i}`, title: `Abierta ${i}`, status: 'OPEN', startDate: 's', endDate: '2026-12-31T00:00:00Z',
      acceptedDonationTypes: [], organizationVerified: true,
    }));
    renderHome(donor, [], camps);
    const section = await screen.findByTestId('home-campaigns');
    await waitFor(() => expect(within(section).getAllByTestId('campaign-card')).toHaveLength(HOME_ITEMS));
    expect(within(section).getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/campaigns');
    expect(within(section).queryByText('Cierran pronto')).toBeNull();
  });
});

describe('Destino tras iniciar sesión (A-3)', () => {
  it('/home por defecto cuando está habilitada; si no, /panel como hasta ahora', () => {
    expect(defaultDestination()).toBe('/home');
    enabled.delete('/home');
    expect(defaultDestination()).toBe('/panel');
  });
});
