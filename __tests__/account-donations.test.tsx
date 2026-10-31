import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/account/donations', '/tracking']));
  return import('../src/screens/AccountDonationsScreen');
}

describe('Mis donaciones (/account/donations)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('cargando', async () => {
    const { AccountDonationsScreen } = await load();
    render(<AccountDonationsScreen client={() => new Promise(() => {})} />);
    expect(screen.getByRole('status', { name: 'Cargando tus donaciones' })).toBeInTheDocument();
  });

  it('vacío', async () => {
    const { AccountDonationsScreen } = await load();
    render(<AccountDonationsScreen client={async () => ({ kind: 'ok', items: [] })} />);
    expect(await screen.findByText('Todavía no tienes donaciones hechas con esta cuenta.')).toBeInTheDocument();
  });

  it('error → Reintentar; 403 → estado de pantalla', async () => {
    const { AccountDonationsScreen } = await load();
    const client = vi.fn().mockResolvedValueOnce({ kind: 'error' }).mockResolvedValueOnce({ kind: 'forbidden' });
    render(<AccountDonationsScreen client={client} />);
    fireEvent.click(await screen.findByText('Reintentar'));
    expect(await screen.findByText('No tienes acceso a este recurso.')).toBeInTheDocument();
  });

  it('401: no pinta nada propio (T-1)', async () => {
    const { AccountDonationsScreen } = await load();
    render(<AccountDonationsScreen client={async () => ({ kind: 'unauthorized' })} />);
    await Promise.resolve();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lista: monto y estado; el código de seguimiento oculto hasta pedirlo; sin intentId visible', async () => {
    const { AccountDonationsScreen } = await load();
    render(<AccountDonationsScreen client={async () => ({ kind: 'ok', items: [
      { intentId: 'i-interno', campaignTitle: 'Mercados', amount: '5000000', currency: 'COP', status: 'CONFIRMED', trackingCode: 'TRK.x' },
      { intentId: 'i-2', campaignTitle: 'Kits', amount: '100', currency: 'COP', status: 'PENDING' },
    ] })} />);
    expect(await screen.findByText('50.000 COP')).toBeInTheDocument();
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.queryByTestId('account-tracking-code')).toBeNull();
    expect(document.body.textContent).not.toContain('i-interno');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar código de seguimiento' }));
    expect(screen.getByTestId('account-tracking-code')).toHaveTextContent('TRK.x');
    expect(screen.getAllByRole('link', { name: 'Ver seguimiento' })).toHaveLength(1);
  });

  it('D-P11 (A-5): organización, fecha y medio de pago si llegan; enlace a la convocatoria solo con publicCode', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/account/donations', '/tracking', '/c/:publicCode']));
    const { AccountDonationsScreen } = await import('../src/screens/AccountDonationsScreen');
    render(<AccountDonationsScreen client={async () => ({ kind: 'ok', items: [
      { intentId: 'a', campaignTitle: 'Pública', amount: '100', currency: 'COP', status: 'CONFIRMED',
        organizationName: 'Fundación Demo', createdAt: '2026-10-20T15:00:00Z', paymentMethod: 'BANK_TRANSFER', publicCode: 'PUB1' },
      { intentId: 'b', campaignTitle: 'Privada', amount: '100', currency: 'COP', status: 'PENDING', paymentMethod: 'GATEWAY' },
    ] })} />);
    const items = await screen.findAllByTestId('account-donation');
    expect(items[0]).toHaveTextContent('Fundación Demo');
    expect(items[0]).toHaveTextContent('Transferencia bancaria');
    expect(items[0].querySelector('time')).toHaveAttribute('datetime', '2026-10-20T15:00:00Z');
    expect(items[0].querySelector('a[href="/c/PUB1"]')).not.toBeNull();
    // Sin publicCode (p. ej. PRIVATE_LINK), sin enlace; sin organización ni fecha, sin esas filas
    expect(items[1].querySelector('a[href^="/c/"]')).toBeNull();
    expect(items[1]).not.toHaveTextContent('Organización');
    expect(items[1]).not.toHaveTextContent('Fecha');
    expect(items[1]).toHaveTextContent('Pasarela de pago');
  });

  it('D-F15: muestra enlace "Seguir con un código" hacia /tracking', async () => {
    const { AccountDonationsScreen } = await load();
    render(<AccountDonationsScreen client={async () => ({ kind: 'ok', items: [] })} />);
    const link = await screen.findByTestId('link-track-code');
    expect(link).toHaveAttribute('href', '/tracking');
    expect(link).toHaveTextContent('Seguir con un código');
  });
});
