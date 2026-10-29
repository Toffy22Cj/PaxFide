// Ref: plan-fase7-puesta-al-dia.md Anexo 1, P-7 (tests de "Mi impacto").
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { AccountImpact, ImpactOutcome } from '../src/lib/api/account';
import { impactView, DELIVERED_UNITS_LABEL, TRUNCATED_NOTE } from '../src/lib/impact/impactModel';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/home' }));

const impact: AccountImpact = {
  donationsCount: 3, totals: [{ currency: 'COP', amount: '15000000' }], campaignsSupported: 2,
  deliveredUnits: [{ unitOfMeasure: 'kg', quantity: '120.5000' }, { unitOfMeasure: 'EA', quantity: '6.0000' }], truncated: false,
};
const ok = (i: AccountImpact) => async (): Promise<ImpactOutcome> => ({ kind: 'ok', impact: i });
const FORBIDDEN = /tus unidades|entregaste/i;

async function loadCard() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/home', '/account', '/campaigns', '/tracking', '/account/donations']));
  return import('../src/components/impact/ImpactCard');
}

describe('P-7 · impactView (puro)', () => {
  it('cada campo y su texto', () => {
    expect(impactView(impact)).toEqual({
      kind: 'stats', donations: '3 donaciones confirmadas', campaigns: '2 convocatorias apoyadas',
      totals: ['150.000 COP'], units: ['120,5 kg', '6 EA'],
    });
    const one = impactView({ ...impact, donationsCount: 1, campaignsSupported: 1 });
    expect(one.kind === 'stats' && [one.donations, one.campaigns]).toEqual(['1 donación confirmada', '1 convocatoria apoyada']);
  });

  it('dos monedas → dos líneas y ningún total combinado', () => {
    const v = impactView({ ...impact, totals: [{ currency: 'COP', amount: '15000000' }, { currency: 'USD', amount: '2550' }] });
    expect(v.kind === 'stats' && v.totals).toEqual(['150.000 COP', '25,50 USD']);
  });

  it('cuenta sin donaciones → vacío; truncated → nota', () => {
    expect(impactView({ donationsCount: 0, totals: [], campaignsSupported: 0, deliveredUnits: [], truncated: false })).toEqual({ kind: 'empty' });
    const t = impactView({ ...impact, truncated: true });
    expect(t.kind === 'stats' && t.note).toBe(TRUNCATED_NOTE);
    expect(DELIVERED_UNITS_LABEL).toBe('Unidades entregadas en las convocatorias que apoyaste');
  });
});

describe('P-7 · ImpactCard', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('pinta cada dato con su texto; el de las unidades es el obligatorio', async () => {
    const { ImpactCard } = await loadCard();
    render(<ImpactCard client={ok(impact)} />);
    expect(await screen.findByText('150.000 COP')).toBeInTheDocument();
    expect(screen.getByText('Aportaste')).toBeInTheDocument();
    expect(screen.getByTestId('impact-donations')).toHaveTextContent('3 donaciones confirmadas');
    expect(screen.getByTestId('impact-campaigns')).toHaveTextContent('2 convocatorias apoyadas');
    expect(screen.getByText(DELIVERED_UNITS_LABEL)).toBeInTheDocument();
    expect(screen.getByText('120,5 kg')).toBeInTheDocument();
    expect(screen.queryByTestId('impact-truncated')).toBeNull();
    // Negativa sobre el DOM
    expect(document.body.textContent).not.toMatch(FORBIDDEN);
  });

  it('dos monedas → dos líneas y ningún total combinado (negativa)', async () => {
    const { ImpactCard } = await loadCard();
    render(<ImpactCard client={ok({ ...impact, totals: [{ currency: 'COP', amount: '15000000' }, { currency: 'USD', amount: '2550' }] })} />);
    const totals = await screen.findByTestId('impact-totals');
    const lines = within(totals).getAllByRole('listitem').map((l) => l.textContent);
    expect(lines).toEqual(['150.000 COP', '25,50 USD']);
    // Ningún importe que sume las dos (ni 150.025,50 ni otro texto con las dos monedas)
    expect(totals.textContent).not.toMatch(/150\.025/);
    for (const l of lines) expect(l).not.toMatch(/COP.*USD|USD.*COP/);
  });

  it('deliveredUnits vacío → la sección no aparece', async () => {
    const { ImpactCard } = await loadCard();
    render(<ImpactCard client={ok({ ...impact, deliveredUnits: [] })} />);
    await screen.findByText('150.000 COP');
    expect(screen.queryByTestId('impact-units')).toBeNull();
    expect(screen.queryByText(DELIVERED_UNITS_LABEL)).toBeNull();
  });

  it('cuenta sin donaciones → el estado vacío, sin "0"', async () => {
    const { ImpactCard } = await loadCard();
    render(<ImpactCard client={ok({ donationsCount: 0, totals: [], campaignsSupported: 0, deliveredUnits: [], truncated: false })} />);
    expect(await screen.findByText('Aún no tienes donaciones confirmadas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar convocatorias' })).toHaveAttribute('href', '/campaigns');
    expect(screen.getByTestId('impact-card').textContent).not.toMatch(/\d/);
  });

  it('truncated con y sin la nota', async () => {
    const { ImpactCard } = await loadCard();
    render(<ImpactCard client={ok({ ...impact, truncated: true })} />);
    expect(await screen.findByTestId('impact-truncated')).toHaveTextContent(TRUNCATED_NOTE);
  });

  it('carga con esqueleto; error con "Reintentar"; 401 no pinta nada propio', async () => {
    const { ImpactCard } = await loadCard();
    const { unmount } = render(<ImpactCard client={() => new Promise(() => {})} />);
    expect(screen.getByRole('status', { name: 'Cargando tu impacto' })).toBeInTheDocument();
    unmount();
    const client = vi.fn<() => Promise<ImpactOutcome>>().mockResolvedValueOnce({ kind: 'error' }).mockResolvedValueOnce({ kind: 'ok', impact });
    const r2 = render(<ImpactCard client={client} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('150.000 COP')).toBeInTheDocument();
    r2.unmount();
    render(<ImpactCard client={async () => ({ kind: 'unauthorized' })} />);
    await waitFor(() => expect(screen.queryByTestId('impact-card')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('P-7 · la tarjeta en /home y en /account', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('/home: aparece, y si falla el resto del inicio sigue visible', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/home', '/account', '/campaigns', '/tracking', '/account/donations']));
    const { HomeScreen } = await import('../src/screens/HomeScreen');
    render(<HomeScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', roles: [] } } as never)}
      donationsClient={async () => ({ kind: 'ok', items: [] })} campaignsClient={async () => ({ kind: 'ok', items: [] } as never)}
      profileClient={async () => ({ kind: 'ok', profile: { email: 'x@y.z', givenName: 'Ana' } })}
      impactClient={async () => ({ kind: 'error' })} />);
    const card = await screen.findByTestId('impact-card');
    expect(await within(card).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByTestId('home-donations')).toBeInTheDocument();
    expect(screen.getByTestId('home-campaigns')).toBeInTheDocument();
    expect(screen.getByTestId('home-greeting')).toBeInTheDocument();
  });

  it('/account: aparece la misma tarjeta', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/home', '/account', '/campaigns']));
    const { ProfileScreen } = await import('../src/screens/ProfileScreen');
    render(<ProfileScreen client={async () => ({ kind: 'ok', account: { accountId: 'a', email: 'x@y.z' } })}
      profileClients={{ fetch: async () => ({ kind: 'ok', profile: { email: 'x@y.z' } }), update: async () => ({ kind: 'error' }) }}
      impactClient={ok(impact)} />);
    const card = await screen.findByTestId('impact-card');
    expect(await within(card).findByText('150.000 COP')).toBeInTheDocument();
    expect(screen.getByTestId('profile-screen')).toBeInTheDocument();
  });
});
