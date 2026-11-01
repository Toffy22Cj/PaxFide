// Ref: plan-fase7-puesta-al-dia.md Anexo 3, P-12 (A3.4): validación, reinicio del cursor, respuesta tardía, cero
// resultados, URL y "Cierran pronto" con sort=ending_soon (U-23).
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DiscoveryItem, DiscoveryOutcome, DiscoveryParams } from '../src/lib/api/publicCampaigns';
import { checkQuery, filtersFromSearch, searchOf, paramsOf, DEFAULT_FILTERS } from '../src/lib/discovery/searchModel';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }), usePathname: () => '/campaigns' }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock('../src/lib/routing/surfaces', () => ({ isSurfaceEnabled: () => true }));

const item = (publicCode: string, extra: Partial<DiscoveryItem> = {}): DiscoveryItem => ({
  publicCode, title: `Convocatoria ${publicCode}`, status: 'OPEN', startDate: '2026-10-01T00:00:00Z', endDate: '2026-12-31T00:00:00Z',
  acceptedDonationTypes: ['MONETARY'], organizationVerified: true, ...extra,
} as DiscoveryItem);

beforeEach(() => { replace.mockReset(); window.history.replaceState(null, '', '/campaigns'); });
afterEach(() => vi.unstubAllEnvs());

describe('P-12 · modelo (U-24, U-26)', () => {
  it('q: se recorta y se cuentan puntos de código; vacío = sin búsqueda', () => {
    expect(checkQuery('  ')).toEqual({ ok: true, value: '' });
    expect(checkQuery(' a ')).toEqual({ ok: false, error: 'too-short' });
    expect(checkQuery(' ab ')).toEqual({ ok: true, value: 'ab' });
    expect(checkQuery('😀'.repeat(100))).toEqual({ ok: true, value: '😀'.repeat(100) });
    expect(checkQuery('😀'.repeat(101))).toEqual({ ok: false, error: 'too-long' });
  });

  it('la URL: ida y vuelta; un parámetro inválido se ignora; por defecto "Más recientes"', () => {
    const f = { q: 'agua', donationType: 'IN_KIND' as const, sort: 'ending_soon' as const };
    expect(searchOf(f)).toBe('?q=agua&tipo=especie&orden=cierran');
    expect(filtersFromSearch(searchOf(f))).toEqual(f);
    expect(filtersFromSearch('?tipo=comida&orden=raro&q=a')).toEqual(DEFAULT_FILTERS);
    expect(searchOf(DEFAULT_FILTERS)).toBe('');
    expect(paramsOf(DEFAULT_FILTERS)).toEqual({ sort: 'recent' });
  });
});

describe('P-12 · fetchDiscovery', () => {
  it('nunca envía q vacío; solo lo que tiene valor', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.test/api/v1');
    const fetchMock = vi.fn(async () => ({ status: 200, text: async () => JSON.stringify({ items: [] }), headers: { get: () => null } }));
    global.fetch = fetchMock as any;
    const { fetchDiscovery } = await import('../src/lib/api/publicCampaigns');
    await fetchDiscovery({ q: '   ', sort: 'recent' });
    await fetchDiscovery({ q: 'agua', donationType: 'IN_KIND', sort: 'ending_soon', cursor: 'c1' });
    const urls = (fetchMock.mock.calls as unknown as [string][]).map((c) => c[0]);
    expect(urls[0]).toBe('http://api.test/api/v1/public/campaigns?sort=recent');
    expect(urls[1]).toBe('http://api.test/api/v1/public/campaigns?q=agua&donationType=IN_KIND&sort=ending_soon&cursor=c1');
    for (const u of urls) expect(u).not.toMatch(/[?&]q=(&|$)/);
  });
});

describe('P-12 · /campaigns', () => {
  async function screenWith(client: (p: DiscoveryParams) => Promise<DiscoveryOutcome>) {
    const { DiscoveryScreen } = await import('../src/screens/DiscoveryScreen');
    render(<DiscoveryScreen client={client as never} />);
  }

  it('por defecto pide sort=recent; " a " no se envía y da el aviso; "ab" sí', async () => {
    const client = vi.fn(async (_p: DiscoveryParams): Promise<DiscoveryOutcome> => ({ kind: 'ok', items: [item('A')] }));
    await screenWith(client);
    await screen.findByText('Convocatoria A');
    expect(client).toHaveBeenLastCalledWith({ sort: 'recent' });
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: ' a ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByTestId('discovery-query-error')).toHaveTextContent('Escribe al menos 2 caracteres');
    expect(client).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: ' ab ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(client).toHaveBeenLastCalledWith({ q: 'ab', sort: 'recent' }));
    expect(replace).toHaveBeenLastCalledWith('/campaigns?q=ab', { scroll: false });
    // El cursor nunca va en la URL
    for (const c of replace.mock.calls) expect(c[0]).not.toContain('cursor');
  });

  it('cambiar el tipo con una página cargada pide sin cursor', async () => {
    const client = vi.fn(async (p: DiscoveryParams): Promise<DiscoveryOutcome> =>
      p.cursor ? { kind: 'ok', items: [item('C')] } : { kind: 'ok', items: [item(p.donationType ?? 'A')], nextCursor: 'cur-1' });
    await screenWith(client);
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));
    await screen.findByText('Convocatoria C');
    expect(client).toHaveBeenLastCalledWith({ sort: 'recent', cursor: 'cur-1' });
    fireEvent.click(screen.getByRole('button', { name: 'Especie (bienes)' }));
    await screen.findByText('Convocatoria IN_KIND');
    expect(client).toHaveBeenLastCalledWith({ donationType: 'IN_KIND', sort: 'recent' });
    expect(screen.queryByText('Convocatoria C')).toBeNull();
    expect(screen.getByRole('button', { name: 'Especie (bienes)' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('un 400 en "Cargar más" reinicia la lista una sola vez, sin cursor y con el aviso', async () => {
    let calls = 0;
    const client = vi.fn(async (p: DiscoveryParams): Promise<DiscoveryOutcome> => {
      calls++;
      if (p.cursor) return { kind: 'bad-request' };
      return { kind: 'ok', items: [item(`P${calls}`)], nextCursor: 'cur-viejo' };
    });
    await screenWith(client);
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));
    expect(await screen.findByTestId('discovery-restarted')).toHaveTextContent('La lista se actualizó');
    // Petición 1 (inicial), 2 (con cursor, 400), 3 (reinicio sin cursor): sin bucle
    expect(client).toHaveBeenCalledTimes(3);
    expect(client.mock.calls[2][0]).toEqual({ sort: 'recent' });
  });

  it('respuesta tardía: la de la combinación anterior no se mezcla con la nueva', async () => {
    let resolveSlow!: (v: DiscoveryOutcome) => void;
    const client = vi.fn((p: DiscoveryParams): Promise<DiscoveryOutcome> => {
      if (p.donationType === 'MONETARY') return new Promise((r) => { resolveSlow = r; });
      return Promise.resolve({ kind: 'ok', items: [item(p.donationType ?? 'TODAS')] });
    });
    await screenWith(client);
    await screen.findByText('Convocatoria TODAS');
    fireEvent.click(screen.getByRole('button', { name: 'Dinero' }));
    fireEvent.click(screen.getByRole('button', { name: 'Especie (bienes)' }));
    await screen.findByText('Convocatoria IN_KIND');
    await act(async () => { resolveSlow({ kind: 'ok', items: [item('LENTA')] }); });
    expect(screen.queryByText('Convocatoria LENTA')).toBeNull();
    expect(screen.getByText('Convocatoria IN_KIND')).toBeInTheDocument();
  });

  it('cero resultados con filtros: el texto y "Quitar filtros" vuelve a la lista sin filtros', async () => {
    window.history.replaceState(null, '', '/campaigns?q=nada&tipo=dinero');
    const client = vi.fn(async (p: DiscoveryParams): Promise<DiscoveryOutcome> => ({ kind: 'ok', items: p.q ? [] : [item('A')] }));
    await screenWith(client);
    expect(await screen.findByTestId('discovery-no-results')).toHaveTextContent('No encontramos convocatorias con esa búsqueda.');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    await screen.findByText('Convocatoria A');
    expect(client).toHaveBeenLastCalledWith({ sort: 'recent' });
  });

  it('la URL de llegada se aplica; un ?tipo= inválido se ignora', async () => {
    window.history.replaceState(null, '', '/campaigns?q=agua&tipo=comida&orden=cierran');
    const client = vi.fn(async (): Promise<DiscoveryOutcome> => ({ kind: 'ok', items: [] }));
    await screenWith(client);
    await waitFor(() => expect(client).toHaveBeenCalledWith({ q: 'agua', sort: 'ending_soon' }));
    expect((screen.getByLabelText('Buscar por nombre') as HTMLInputElement).value).toBe('agua');
  });
});

describe('P-12 · "Cierran pronto" en /home con sort=ending_soon (U-23)', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  async function home(client: (p?: DiscoveryParams) => Promise<DiscoveryOutcome>) {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/home', '/campaigns']));
    const { HomeScreen } = await import('../src/screens/HomeScreen');
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as never;
    render(<HomeScreen now={now} meClient={async () => ({ kind: 'error' } as never)} donationsClient={async () => ({ kind: 'ok', items: [] })}
      campaignsClient={client as never} profileClient={async () => ({ kind: 'error' })} impactClient={async () => ({ kind: 'error' })} />);
  }

  it('pide sort=ending_soon y muestra las que cierran en 7 días (aunque en orden por código estuvieran en la página 2)', async () => {
    const client = vi.fn(async (p?: DiscoveryParams): Promise<DiscoveryOutcome> =>
      p?.sort === 'ending_soon'
        ? { kind: 'ok', items: [item('ZZZ', { endDate: '2026-11-03T00:00:00Z' }), item('AAA', { endDate: '2026-12-31T00:00:00Z' })] }
        : { kind: 'ok', items: [item('AAA')] });
    await home(client);
    expect(await screen.findByRole('heading', { name: 'Cierran pronto' })).toBeInTheDocument();
    expect(screen.getByText('Convocatoria ZZZ')).toBeInTheDocument();
    expect(screen.queryByText('Convocatoria AAA')).toBeNull();
    expect(client).toHaveBeenCalledTimes(1);
    expect(client).toHaveBeenCalledWith({ sort: 'ending_soon' });
  });

  it('sin ninguna a 7 días, una segunda petición sin sort da "Convocatorias abiertas"', async () => {
    const client = vi.fn(async (p?: DiscoveryParams): Promise<DiscoveryOutcome> =>
      ({ kind: 'ok', items: [item(p?.sort ? 'LEJANA' : 'B')] }));
    await home(client);
    expect(await screen.findByRole('heading', { name: 'Convocatorias abiertas' })).toBeInTheDocument();
    expect(client).toHaveBeenCalledTimes(2);
    expect(client.mock.calls[1]).toEqual([]);
  });
});
