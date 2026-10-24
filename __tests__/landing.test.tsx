// Ref: plan-fase7-pantallas.md A-2 (tests), D-P5 y D-P10; DF7-22; prompts-agentes-estilo-v2.md VS-4 y §3.3.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { DiscoveryItem, DiscoveryOutcome } from '../src/lib/api/publicCampaigns';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
let enabled = new Set<string>();
vi.mock('../src/lib/routing/surfaces', () => ({ isSurfaceEnabled: (s: string) => enabled.has(s) }));
const apiRequest = vi.fn();
vi.mock('../src/lib/api/http', () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));

import * as session from '../src/lib/auth/session';
import { resetWorldStateForTests } from '../src/components/landing/worldMode';
import { consumeHandedOffTrackingCode } from '../src/lib/tracking/handoff';
import { LandingScreen, LANDING_CAMPAIGNS, litWords, nearestSection } from '../src/screens/LandingScreen';
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
  push.mockReset();
  resetWorldStateForTests();
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
      '5 de 5 pasos', 'Lote 142', '#142', 'Fundación Caribe', 'Hash:', 'a3f9', '14:02', 'Kits de Nutrición']) {
      expect(text, banned).not.toContain(banned);
    }
  });

  it('F-A1: los ejemplos del prototipo (EJEMPLO-1 y -2) muestran el resultado ilustrativo, sin peticiones, horas ni huellas', async () => {
    const client = vi.fn(ok([]));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<LandingScreen client={client} />);
    await screen.findByTestId('empty-state');
    expect(screen.queryByTestId('tracking-example')).toBeNull();
    const chips = screen.getAllByTestId('example-chip');
    expect(chips.map((c) => c.textContent?.replace(/\s*↗/, ''))).toEqual(['EJEMPLO-1', 'EJEMPLO-2']);
    fireEvent.click(chips[0]);
    let box = screen.getByTestId('tracking-example');
    expect(within(box).getByText('EJEMPLO ILUSTRATIVO')).toBeInTheDocument();
    expect(within(box).getByTestId('example-status')).toHaveTextContent('Entregado (5/5)');
    expect(box.querySelectorAll('li[data-done="true"]')).toHaveLength(5);
    fireEvent.click(chips[1]);
    box = screen.getByTestId('tracking-example');
    expect(within(box).getByTestId('example-status')).toHaveTextContent('Despachado (3/5)');
    expect(box.querySelectorAll('li[data-done="false"]')).toHaveLength(2);
    expect(box.textContent).not.toMatch(/\d{1,2}:\d{2}|Hash|Raíz Merkle:/);
    expect(client).toHaveBeenCalledTimes(1);
    expect(apiRequest).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('F-A1: un código que no es de ejemplo va a /tracking en memoria (nunca en la URL); vacío, el aviso del prototipo', async () => {
    render(<LandingScreen client={ok([])} />);
    await screen.findByTestId('empty-state');
    fireEvent.click(screen.getByRole('button', { name: 'Ver recorrido' }));
    expect(screen.getByText('Escribe tu código o pulsa uno de los ejemplos.')).toHaveAttribute('role', 'status');
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Código de seguimiento'), { target: { value: 'ejemplo-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver recorrido' }));
    expect(screen.getByTestId('example-status')).toHaveTextContent('Despachado (3/5)');
    fireEvent.change(screen.getByLabelText('Código de seguimiento'), { target: { value: '  TRK.codigo-real  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver recorrido' }));
    expect(push).toHaveBeenCalledWith('/tracking');
    expect(consumeHandedOffTrackingCode()).toBe('TRK.codigo-real');
  });

  it('F-A1 (D-F2): el botón Día / Noche recorre Auto → Noche → Día → Auto, se recuerda y pinta la landing en oscuro de noche', async () => {
    window.localStorage.removeItem('paxfide.world-mode');
    render(<LandingScreen client={ok([])} />);
    await screen.findByTestId('empty-state');
    const root = screen.getByTestId('landing-root');
    const toggle = screen.getByTestId('world-mode');
    expect(toggle).toHaveTextContent('Auto (Día)');
    expect(toggle).toHaveAccessibleName('Modo de iluminación: Auto (Día)');
    expect(root).toHaveAttribute('data-theme', 'light');
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent('Noche');
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('paxfide.world-mode')).toBe('night');
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent('Día');
    expect(root).toHaveAttribute('data-theme', 'light');
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent('Auto (Día)');
    expect(window.localStorage.getItem('paxfide.world-mode')).toBeNull();
    // El del menú estrecho es el mismo control
    expect(screen.getByTestId('world-mode-mobile')).toHaveTextContent('Auto (Día)');
  });

  it('sin sesión: "Ingresar", sin "Ir a mi inicio"', async () => {
    render(<LandingScreen client={ok([])} />);
    await screen.findByTestId('empty-state');
    // En la fila y en el menú estrecho (el CSS muestra uno u otro, como el prototipo)
    const links = screen.getAllByRole('link', { name: 'Ingresar' });
    expect(links).toHaveLength(2);
    for (const a of links) expect(a).toHaveAttribute('href', '/login');
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
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Ir a mi inicio' })).toHaveLength(2));
    for (const a of screen.getAllByRole('link', { name: 'Ir a mi inicio' })) expect(a).toHaveAttribute('href', '/home');
  });

  it('"Registrar mi organización" lleva a crear cuenta (/register)', async () => {
    render(<LandingScreen client={ok([])} />);
    await screen.findByTestId('empty-state');
    expect(screen.getByRole('link', { name: 'Registrar mi organización' })).toHaveAttribute('href', '/register');
  });
});

describe('Landing (D-P13) — su propia cabecera, puntos del recorrido y manifiesto', () => {
  it('una sola cabecera: la marca lleva al principio, anclas de la página y accesos; nada de la barra de la app', async () => {
    render(<LandingScreen client={ok([])} />);
    await screen.findByTestId('empty-state');
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'PaxFide, inicio' })).toHaveAttribute('href', '#parada-1');
    // Prototipo: "Seguir donación" y "Donar" son anclas de la página; "Ingresar" va al acceso
    const nav = screen.getByRole('navigation', { name: 'Secciones de la página de inicio' });
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href')))
      .toEqual(['#parada-1', '#parada-4', '#convocatorias', '#seguir', '/login', '#seguir', '#convocatorias']);
    const banner = screen.getByRole('banner');
    expect(within(banner).getAllByRole('link', { name: 'Seguir donación' })).toHaveLength(2);
    expect(within(banner).getByRole('button', { name: /^Pausar animación$|^Reanudar animación$/ })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
  });

  it('menú en estrecho: el botón abre y cierra las secciones (aria-expanded)', async () => {
    render(<LandingScreen client={ok([])} />);
    const toggle = screen.getByRole('button', { name: 'Abrir menú de navegación' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Cerrar menú de navegación' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('link', { name: 'Verificación' }));
    expect(screen.getByRole('button', { name: 'Abrir menú de navegación' })).toHaveAttribute('aria-expanded', 'false');
    await screen.findByTestId('empty-state');
  });

  it('puntos: uno por vista y el de convocatorias; el más cercano al centro es el actual', async () => {
    render(<LandingScreen client={ok([])} />);
    await screen.findByTestId('empty-state');
    const dots = within(screen.getByRole('navigation', { name: 'Paradas del recorrido' })).getAllByRole('link');
    expect(dots).toHaveLength(7);
    expect(dots[0]).toHaveAttribute('aria-current', 'step');
    expect(nearestSection([100, 500, 900], 480)).toBe(1);
    expect(nearestSection([100, 500, 900], 5000)).toBe(2);
  });

  it('manifiesto: se enciende con el scroll; todas las palabras al llegar', () => {
    expect(litWords(1000, 800, 20)).toBe(0);
    expect(litWords(0, 800, 20)).toBe(20);
    expect(litWords(800 * 0.78 - 800 * 0.45 / 2, 800, 20)).toBe(10);
  });
});

