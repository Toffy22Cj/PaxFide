// Ref: plan-fase7-pantallas.md A-2 (tests), D-P5 y D-P10; DF7-22; prompts-agentes-estilo-v2.md VS-4 y §3.3.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { DiscoveryItem, DiscoveryOutcome } from '../src/lib/api/publicCampaigns';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
let enabled = new Set<string>();
vi.mock('../src/lib/routing/surfaces', () => ({ isSurfaceEnabled: (s: string) => enabled.has(s) }));
const apiRequest = vi.fn();
vi.mock('../src/lib/api/http', () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));

import * as session from '../src/lib/auth/session';
import { LandingScreen, LANDING_CAMPAIGNS } from '../src/screens/LandingScreen';
import { CampaignCard, organizationInitial } from '../src/components/campaign/CampaignCard';
import { fetchDiscovery } from '../src/lib/api/publicCampaigns';

const BASE = ['/', '/login', '/tracking', '/campaigns', '/register', '/c/:publicCode'];

function item(over: Partial<DiscoveryItem> = {}): DiscoveryItem {
  return {
    publicCode: 'PC1', title: 'Mercados para adultos mayores', organizationName: 'Fundación Demo', status: 'OPEN',
    startDate: '2026-10-01T00:00:00Z', endDate: '2026-12-31T23:59:59Z', acceptedDonationTypes: ['MONETARY'],
    currency: 'COP', targetAmount: '500000000', clearedAmount: '125000000', organizationVerified: true, ...over,
  };
}
const ok = (items: DiscoveryItem[]): (() => Promise<DiscoveryOutcome>) => async () => ({ kind: 'ok', items });

beforeEach(() => {
  enabled = new Set(BASE);
  session._resetForTest();
  apiRequest.mockReset();
});

describe('Landing (A-2) — convocatorias abiertas', () => {
  it('lista vacía → el estado vacío, sin tarjetas', async () => {
    render(<LandingScreen client={ok([])} />);
    expect(await screen.findByText('No hay convocatorias abiertas en este momento.')).toBeInTheDocument();
    expect(screen.queryAllByTestId('campaign-card')).toHaveLength(0);
  });

  it('error de red → el texto aprobado y Reintentar vuelve a pedir', async () => {
    const client = vi.fn().mockResolvedValueOnce({ kind: 'error' }).mockResolvedValueOnce({ kind: 'ok', items: [item()] });
    render(<LandingScreen client={client} />);
    expect(await screen.findByText('No pudimos cargar la información. Inténtalo de nuevo.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Mercados para adultos mayores')).toBeInTheDocument();
    expect(client).toHaveBeenCalledTimes(2);
  });

  it(`como mucho ${LANDING_CAMPAIGNS} tarjetas, cada una enlaza a /c/:publicCode, y "Ver todas" lleva a /campaigns`, async () => {
    const items = Array.from({ length: 9 }, (_, i) => item({ publicCode: `PC${i}`, title: `Convocatoria ${i}` }));
    render(<LandingScreen client={ok(items)} />);
    const list = await screen.findByTestId('landing-campaigns');
    expect(within(list).getAllByTestId('campaign-card')).toHaveLength(LANDING_CAMPAIGNS);
    expect(within(list).getByRole('link', { name: 'Convocatoria 0' })).toHaveAttribute('href', '/c/PC0');
    expect(screen.queryByText('Convocatoria 6')).toBeNull();
    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/campaigns');
  });

  it('sin /campaigns habilitada, no hay "Ver todas" ni "Donar"', async () => {
    enabled.delete('/campaigns');
    render(<LandingScreen client={ok([item()])} />);
    await screen.findByTestId('landing-campaigns');
    expect(screen.queryByRole('link', { name: 'Ver todas' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Donar' })).toBeNull();
  });
});

describe('Landing (A-2) — tarjeta de convocatoria (D-P10, DF7-22)', () => {
  it('campos opcionales ausentes: sin organización, sin inicial, sin montos', () => {
    render(<CampaignCard campaign={item({ organizationName: undefined, currency: undefined, targetAmount: undefined, clearedAmount: undefined, organizationVerified: false })} />);
    expect(screen.getByRole('link', { name: 'Mercados para adultos mayores' })).toBeInTheDocument();
    expect(screen.queryByTestId('campaign-initial')).toBeNull();
    expect(screen.queryByTestId('campaign-verified')).toBeNull();
    expect(screen.queryByTestId('campaign-amounts')).toBeNull();
    expect(screen.getByText(/Cierra el/)).toBeInTheDocument();
  });

  it('campos opcionales que llegan null: el mismo tratamiento que ausentes (parser)', async () => {
    apiRequest.mockResolvedValue({
      kind: 'ok', status: 200, location: null,
      data: { items: [{ publicCode: 'PC1', title: 'T', organizationName: null, status: 'OPEN', startDate: 's', endDate: 'e', acceptedDonationTypes: [],
        currency: null, targetAmount: null, clearedAmount: null, organizationLogoUrl: null }] },
    });
    const r = await fetchDiscovery();
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.items[0]).toMatchObject({ organizationName: undefined, currency: undefined, targetAmount: undefined, clearedAmount: undefined, organizationLogoUrl: undefined });
    // organizationVerified siempre llega en el contrato; si faltara, no se presenta como verificada
    expect(r.items[0].organizationVerified).toBe(false);
  });

  it('con meta: barra y montos con el porcentaje', () => {
    render(<CampaignCard campaign={item()} />);
    expect(screen.getByTestId('campaign-amounts')).toHaveTextContent('(25 %)');
  });

  it('con logo: la imagen del backend; si falla, la inicial', () => {
    render(<CampaignCard campaign={item({ organizationLogoUrl: 'http://localhost:3002/api/v1/public/campaigns/PC1/organization-logo' })} />);
    const img = screen.getByTestId('campaign-logo');
    expect(img).toHaveAttribute('src', 'http://localhost:3002/api/v1/public/campaigns/PC1/organization-logo');
    expect(img).toHaveAttribute('alt', '');
    expect(screen.queryByTestId('campaign-initial')).toBeNull();
    fireEvent.error(img);
    expect(screen.queryByTestId('campaign-logo')).toBeNull();
    expect(screen.getByTestId('campaign-initial')).toHaveTextContent('F');
  });

  it('sin logo: la inicial de la organización, decorativa (el nombre va en texto)', () => {
    render(<CampaignCard campaign={item({ organizationName: 'élan solidario' })} />);
    expect(screen.queryByTestId('campaign-logo')).toBeNull();
    const initial = screen.getByTestId('campaign-initial');
    expect(initial).toHaveTextContent('É');
    expect(initial).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('élan solidario')).toBeInTheDocument();
    expect(organizationInitial('  ')).toBeNull();
  });

  it('"Verificada" solo con organizationVerified (negativa con false), con icono y texto', () => {
    const { unmount } = render(<CampaignCard campaign={item({ organizationVerified: true })} />);
    const badge = screen.getByTestId('campaign-verified');
    expect(badge).toHaveTextContent('Verificada');
    expect(badge.querySelector('svg')).not.toBeNull();
    unmount();
    render(<CampaignCard campaign={item({ organizationVerified: false })} />);
    expect(screen.queryByText('Verificada')).toBeNull();
  });

  it('el logo solo se acepta como ruta del propio backend: otro origen o //host se descartan', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3002/api/v1');
    const logos = ['/api/v1/public/campaigns/PC1/organization-logo', 'https://cdn.example.com/x.png', '//cdn.example.com/x.png'];
    apiRequest.mockResolvedValue({
      kind: 'ok', status: 200, location: null,
      data: { items: logos.map((l, i) => ({ publicCode: `P${i}`, title: 'T', status: 'OPEN', startDate: 's', endDate: 'e', organizationVerified: true, organizationLogoUrl: l })) },
    });
    const r = await fetchDiscovery();
    vi.unstubAllEnvs();
    if (r.kind !== 'ok') throw new Error('ok esperado');
    expect(r.items.map((i) => i.organizationLogoUrl)).toEqual([
      'http://localhost:3002/api/v1/public/campaigns/PC1/organization-logo', undefined, undefined,
    ]);
  });
});

describe('Landing (A-2) — recorrido, ejemplo y cabecera (D-P5)', () => {
  it('el recorrido en cinco paradas más el panorama, con un h1', async () => {
    const { container } = render(<LandingScreen client={ok([])} />);
    await screen.findByTestId('empty-state');
    expect(container.querySelectorAll('[data-world-view]')).toHaveLength(6);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tu donación, de principio a fin.');
  });

  it('ninguna cifra ni nombre concreto del prototipo (negativas)', async () => {
    const { container } = render(<LandingScreen client={ok([])} />);
    await screen.findByTestId('empty-state');
    const text = container.textContent ?? '';
    for (const banned of ['20.000.000', '18.000.000', '120 kits', '100 → 60 + 40', 'Lorica', 'Córdoba', 'Montería', 'Cereté',
      '5 de 5 pasos', 'Lote 142', '#142', 'Fundación Caribe', 'EJEMPLO-1', 'Hash:', 'a3f9']) {
      expect(text, banned).not.toContain(banned);
    }
  });

  it('el seguimiento demostrativo lleva "Ejemplo", usa categorías del enumerado y no hace ninguna petición', async () => {
    const client = vi.fn(ok([]));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<LandingScreen client={client} />);
    await screen.findByTestId('empty-state');
    expect(screen.queryByTestId('tracking-example')).toBeNull();
    fireEvent.click(screen.getByTestId('example-toggle'));
    const box = screen.getByTestId('tracking-example');
    expect(within(box).getByText('Ejemplo')).toBeInTheDocument();
    for (const t of ['Registrado', 'Despachado', 'Recibido', 'Entregado', 'Bodega regional', 'Transporte de última milla']) {
      expect(box).toHaveTextContent(t);
    }
    expect(client).toHaveBeenCalledTimes(1);
    expect(apiRequest).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('sin sesión: "Ingresar", sin "Ir a mi inicio"', async () => {
    render(<LandingScreen client={ok([])} />);
    await screen.findByTestId('empty-state');
    expect(screen.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: 'Ir a mi inicio' })).toBeNull();
  });

  it('con sesión y /home sin habilitar (hasta A-3): ni "Ir a mi inicio" ni "Ingresar"', async () => {
    act(() => session.login('tok'));
    render(<LandingScreen client={ok([])} />);
    await screen.findByTestId('empty-state');
    expect(screen.queryByRole('link', { name: 'Ir a mi inicio' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ingresar' })).toBeNull();
  });

  it('con sesión y /home habilitada: "Ir a mi inicio" → /home', async () => {
    enabled.add('/home');
    act(() => session.login('tok'));
    render(<LandingScreen client={ok([])} />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Ir a mi inicio' })).toHaveAttribute('href', '/home'));
  });

  it('"Registrar mi organización" lleva a crear cuenta (/register)', async () => {
    render(<LandingScreen client={ok([])} />);
    await screen.findByTestId('empty-state');
    expect(screen.getByRole('link', { name: 'Registrar mi organización' })).toHaveAttribute('href', '/register');
  });
});
