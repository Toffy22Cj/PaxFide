import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

async function load(surfaces: string[]) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(surfaces));
  return import('../src/screens/PanelHomeScreen');
}

const ALL = ['/panel', '/panel/campaigns', '/account/donations'];

describe('PanelHome (§5.6, D-N1-1)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('cargando mientras /me está en curso', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={() => new Promise(() => {})} />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('ADMINISTRATOR: "Convocatorias de mi organización" y "Mis donaciones"', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['ADMINISTRATOR'] } })} />);
    expect(await screen.findByText('Convocatorias de mi organización')).toHaveAttribute('href', '/panel/campaigns');
    expect(screen.getByText('Mis donaciones')).toHaveAttribute('href', '/account/donations');
  });

  it('EMPLOYEE no ve la entrada de convocatorias (representa, no autoriza)', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['EMPLOYEE'] } })} />);
    await screen.findByText('Mis donaciones');
    expect(screen.queryByText('Convocatorias de mi organización')).toBeNull();
  });

  it('vacío: sin entradas aplicables → EmptyState con el texto aprobado', async () => {
    const { PanelHomeScreen } = await load(['/panel', '/panel/campaigns']);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', roles: [] } })} />);
    expect(await screen.findByText('No hay opciones disponibles para tu cuenta en este panel.')).toBeInTheDocument();
  });

  it('una superficie deshabilitada no aparece aunque el rol la permita', async () => {
    const { PanelHomeScreen } = await load(['/panel']);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['ADMINISTRATOR'] } })} />);
    await screen.findByTestId('empty-state');
    expect(screen.queryByText('Convocatorias de mi organización')).toBeNull();
  });

  it('error → ErrorState con Reintentar, que vuelve a pedir /me', async () => {
    const { PanelHomeScreen } = await load(ALL);
    const client = vi.fn().mockResolvedValueOnce({ kind: 'error' })
      .mockResolvedValueOnce({ kind: 'ok', principal: { accountId: 'a', roles: [] } });
    render(<PanelHomeScreen meClient={client} />);
    fireEvent.click(await screen.findByText('Reintentar'));
    await screen.findByText('Mis donaciones');
    expect(client).toHaveBeenCalledTimes(2);
  });

  it('/me no disponible (404) → aviso "No disponible" y solo entradas sin roles', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'unavailable' })} />);
    expect(await screen.findByTestId('unavailable-state')).toBeInTheDocument();
    expect(screen.getByText('Mis donaciones')).toBeInTheDocument();
    expect(screen.queryByText('Convocatorias de mi organización')).toBeNull();
  });

  it('401: no pinta nada propio (T-1 lo resuelve el guard)', async () => {
    const { PanelHomeScreen } = await load(ALL);
    render(<PanelHomeScreen meClient={async () => ({ kind: 'unauthorized' })} />);
    await Promise.resolve();
    expect(screen.queryByText('Mis donaciones')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
