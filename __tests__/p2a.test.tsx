import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RegisterScreen } from '../src/screens/RegisterScreen';
import { DiscoveryScreen } from '../src/screens/DiscoveryScreen';
import { CampaignNarrative } from '../src/components/campaign/CampaignNarrative';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

describe('Registro de cuenta (POST /auth/register)', () => {
  function fill(email: string, p1: string, p2: string) {
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: p1 } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: p2 } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  }

  it('validación local: vacíos y contraseñas distintas no llaman al backend', () => {
    const client = vi.fn();
    render(<RegisterScreen client={client} />);
    fill('', '', 'x');
    expect(screen.getAllByText('Este campo es obligatorio.')).toHaveLength(2);
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(client).not.toHaveBeenCalled();
  });

  it('201 → cuenta creada y enlace a iniciar sesión (no inicia sesión sola)', async () => {
    const client = vi.fn().mockResolvedValue({ kind: 'ok' });
    render(<RegisterScreen client={client} />);
    fill('nueva@demo.test', 'clave', 'clave');
    expect(await screen.findByText('Cuenta creada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(client).toHaveBeenCalledWith('nueva@demo.test', 'clave');
  });

  it('409 DuplicateEmail, correo inválido, 5xx y red', async () => {
    const client = vi.fn()
      .mockResolvedValueOnce({ kind: 'duplicate-email' })
      .mockResolvedValueOnce({ kind: 'invalid-email' })
      .mockResolvedValueOnce({ kind: 'server-error' })
      .mockResolvedValueOnce({ kind: 'network' });
    render(<RegisterScreen client={client} />);
    fill('a@demo.test', 'c', 'c');
    expect(await screen.findByText('Ya existe una cuenta con ese correo.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('El correo no es válido.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'c' } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'c' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText(/No pudimos crear la cuenta/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'c' } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'c' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText(/No pudimos conectar/)).toBeInTheDocument();
  });
});

const ITEM = (n: number) => ({ publicCode: `PC${n}`, title: `Convocatoria ${n}`, organizationName: 'Fundación', status: 'OPEN',
  startDate: '2026-10-01T00:00:00Z', endDate: '2026-12-01T00:00:00Z', acceptedDonationTypes: ['MONETARY'], currency: 'COP',
  targetAmount: '100000', clearedAmount: '25000' });

describe('Descubrimiento público (GET /public/campaigns)', () => {
  it('cargando, error con reintento y vacío', async () => {
    const r1 = render(<DiscoveryScreen client={() => new Promise(() => {})} />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    r1.unmount();
    const client = vi.fn().mockResolvedValueOnce({ kind: 'error' }).mockResolvedValueOnce({ kind: 'ok', items: [] });
    render(<DiscoveryScreen client={client} />);
    fireEvent.click(await screen.findByText('Reintentar'));
    expect(await screen.findByText('No hay convocatorias abiertas en este momento.')).toBeInTheDocument();
  });

  it('lista con enlace a /c y "Cargar más" con el cursor opaco hasta la última página', async () => {
    const client = vi.fn()
      .mockResolvedValueOnce({ kind: 'ok', items: [ITEM(1)], nextCursor: 'opaco==' })
      .mockResolvedValueOnce({ kind: 'ok', items: [ITEM(2)] });
    render(<DiscoveryScreen client={client} />);
    expect(await screen.findByRole('link', { name: 'Convocatoria 1' })).toHaveAttribute('href', '/c/PC1');
    expect(screen.getByText('250 COP de 1.000 COP (25 %)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(await screen.findByRole('link', { name: 'Convocatoria 2' })).toBeInTheDocument();
    expect(client).toHaveBeenNthCalledWith(2, 'opaco==');
    expect(screen.getAllByTestId('discovery-item')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('error al cargar más: se conserva lo cargado y se puede reintentar', async () => {
    const client = vi.fn()
      .mockResolvedValueOnce({ kind: 'ok', items: [ITEM(1)], nextCursor: 'c1' })
      .mockResolvedValueOnce({ kind: 'error' });
    render(<DiscoveryScreen client={client} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));
    expect(await screen.findByText('No pudimos cargar más convocatorias.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Convocatoria 1' })).toBeInTheDocument();
  });
});

describe('Narrativa de la convocatoria (ADR-040)', () => {
  const facts = { status: 'OPEN', unitsDelivered: '12', distinctRecipients: 5 };

  it('PENDING → Actualizar → AVAILABLE; hechos separados con "receptores distintos"', async () => {
    const client = vi.fn()
      .mockResolvedValueOnce({ kind: 'ok', status: 'PENDING', facts })
      .mockResolvedValueOnce({ kind: 'ok', status: 'AVAILABLE', content: 'Relato', source: 'LLM_GENERATED', facts });
    render(<CampaignNarrative publicCode="PC" client={client} />);
    expect(await screen.findByText('El relato se está generando.')).toBeInTheDocument();
    expect(screen.getByTestId('facts-units')).toHaveTextContent('12');
    expect(screen.getByTestId('facts-recipients')).toHaveTextContent('5');
    expect(screen.getByText('Receptores distintos')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/familias/i);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByTestId('campaign-narrative')).toHaveTextContent('Relato');
  });

  it('UNAVAILABLE, 404 y error', async () => {
    const r1 = render(<CampaignNarrative publicCode="PC" client={async () => ({ kind: 'ok', status: 'UNAVAILABLE', content: 'Narrativa no disponible', facts })} />);
    expect(await screen.findByText('El relato de esta convocatoria no está disponible.')).toBeInTheDocument();
    r1.unmount();
    const r2 = render(<CampaignNarrative publicCode="PC" client={async () => ({ kind: 'not-found' })} />);
    expect(await screen.findByText('El relato de esta convocatoria no está disponible.')).toBeInTheDocument();
    r2.unmount();
    render(<CampaignNarrative publicCode="PC" client={async () => ({ kind: 'error' })} />);
    expect(await screen.findByText('Reintentar')).toBeInTheDocument();
  });
});

describe('Rutas nuevas de P2-A', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('/register es AUTH y /campaigns es PUBLIC solo si están habilitadas', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/register', '/campaigns']));
    let { classifyRoute } = await import('../src/lib/routing/classifier');
    expect(classifyRoute('/register')).toBe('AUTH');
    expect(classifyRoute('/campaigns')).toBe('PUBLIC');
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', '[]');
    ({ classifyRoute } = await import('../src/lib/routing/classifier'));
    expect(classifyRoute('/register')).toBe('NOT_APPROVED');
    expect(classifyRoute('/campaigns')).toBe('NOT_APPROVED');
  });
});
