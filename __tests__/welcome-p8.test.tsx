// Ref: plan-fase7-puesta-al-dia.md Anexo 2, U-15, U-16 y P-8 (tests de la bienvenida).
import React from 'react';
import { render, screen, fireEvent, waitFor, within, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Principal } from '../src/lib/api/identity';
import {
  shouldShowWelcome, markWelcomeDone, readWelcomeDone, welcomeKey, _resetWelcomeForTest, markShownThisSession,
} from '../src/lib/welcome/welcome';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/home' }));

const SURFACES = ['/home', '/account', '/campaigns', '/tracking', '/account/donations', '/panel', '/panel/campaigns', '/panel/assets'];
const donor: Principal = { accountId: 'acc-x', roles: [] };
const admin: Principal = { accountId: 'acc-y', organizationId: 'org-1', roles: ['ADMINISTRATOR'] };
const EMAIL = 'persona@demo.test';

function throwingStorage() {
  return { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
}

async function home(principal: Principal, opts: { givenName?: string; update?: ReturnType<typeof vi.fn> } = {}) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(SURFACES));
  const { HomeScreen } = await import('../src/screens/HomeScreen');
  const update = opts.update ?? vi.fn(async (g: string, f: string) => ({ kind: 'ok' as const, profile: { email: EMAIL, givenName: g, familyName: f || undefined } }));
  render(<HomeScreen meClient={async () => ({ kind: 'ok', principal } as never)}
    donationsClient={async () => ({ kind: 'ok', items: [] })} campaignsClient={async () => ({ kind: 'ok', items: [] } as never)}
    profileClient={async () => ({ kind: 'ok', profile: { email: EMAIL, ...(opts.givenName ? { givenName: opts.givenName } : {}) } })}
    impactClient={async () => ({ kind: 'error' })} updateProfileClient={update as never} />);
  return { update };
}

beforeEach(() => {
  localStorage.clear();
  _resetWelcomeForTest();
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as never;
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('P-8 · cuándo sale (puro)', () => {
  it('sale para una cuenta sin nombre que no la cerró', () => {
    expect(shouldShowWelcome({ accountId: 'a', profile: { email: EMAIL } })).toBe(true);
  });
  it('no sale si tiene nombre o apellido, ni si ya se cerró en este navegador (negativas)', () => {
    expect(shouldShowWelcome({ accountId: 'a', profile: { email: EMAIL, givenName: 'Ana' } })).toBe(false);
    expect(shouldShowWelcome({ accountId: 'a', profile: { email: EMAIL, familyName: 'Pérez' } })).toBe(false);
    markWelcomeDone('a');
    expect(shouldShowWelcome({ accountId: 'a', profile: { email: EMAIL } })).toBe(false);
    expect(shouldShowWelcome({ accountId: 'b', profile: { email: EMAIL } })).toBe(true); // por cuenta
  });
  it('sin accountId o sin perfil no decide nada', () => {
    expect(shouldShowWelcome({ accountId: undefined, profile: { email: EMAIL } })).toBe(false);
    expect(shouldShowWelcome({ accountId: 'a', profile: null })).toBe(false);
  });
  it('con un almacenamiento que lanza, sale una sola vez por sesión', () => {
    const storage = throwingStorage();
    expect(readWelcomeDone('a', storage)).toBeNull();
    expect(markWelcomeDone('a', storage)).toBe(false);
    expect(shouldShowWelcome({ accountId: 'a', profile: { email: EMAIL }, storage })).toBe(true);
    markShownThisSession('a');
    expect(shouldShowWelcome({ accountId: 'a', profile: { email: EMAIL }, storage })).toBe(false);
  });
  it('la clave es la del accountId', () => {
    expect(welcomeKey('acc-1')).toBe('paxfide.welcome-done.acc-1');
  });
});

describe('P-8 · la capa sobre /home', () => {
  it('sale para una cuenta sin nombre, con los tres pasos y sus puntos', async () => {
    await home(donor);
    const layer = await screen.findByTestId('welcome-overlay');
    const dialog = within(layer).getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { name: 'Te damos la bienvenida a PaxFide' })).toBeInTheDocument();
    expect(within(dialog).getByText('Cada paso queda sellado')).toBeInTheDocument();
    expect(screen.getByTestId('home-content')).toHaveAttribute('inert');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }));
    expect(within(dialog).getByRole('heading', { name: 'Así te mueves por PaxFide' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }));
    expect(within(dialog).getByRole('heading', { name: '¿Cómo te llamamos?' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Saltar' })).toBeInTheDocument();
  });

  it('no sale si la cuenta tiene nombre, ni si ya se cerró en este navegador (negativas)', async () => {
    await home(donor, { givenName: 'Ana' });
    await screen.findByText(/, Ana$/);
    expect(screen.queryByTestId('welcome-overlay')).toBeNull();
    localStorage.setItem(welcomeKey(admin.accountId), '1');
    await home(admin);
    await screen.findAllByTestId('home-greeting');
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByTestId('welcome-overlay')).toBeNull();
  });

  it('paso 2: el donante no ve "Organización" (negativa); el administrador sí', async () => {
    await home(donor);
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
    const nav = screen.getByTestId('welcome-nav');
    expect(within(nav).queryByText('Organización')).toBeNull();
    expect(within(nav).getByText('Inicio')).toBeInTheDocument();
    expect(within(nav).getByText('Ver ciudad')).toBeInTheDocument();
    expect(within(nav).getByText('Tema')).toBeInTheDocument();
    expect(within(nav).getByText('Pausar animación')).toBeInTheDocument();
    cleanup();
    await home(admin);
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
    expect(within(screen.getByTestId('welcome-nav')).getByText('Organización')).toBeInTheDocument();
  });

  it('"Después" no envía PUT; "Guardar" sí y el saludo usa el nombre', async () => {
    const { update } = await home(donor);
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Después' }));
    expect(update).not.toHaveBeenCalled();
    expect(screen.queryByTestId('welcome-overlay')).toBeNull();

    localStorage.clear(); _resetWelcomeForTest(); cleanup();
    const second = await home(donor);
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(second.update).toHaveBeenCalledWith('Ana', ''));
    await waitFor(() => expect(screen.queryByTestId('welcome-overlay')).toBeNull());
    expect(screen.getByTestId('home-greeting')).toHaveTextContent(', Ana');
  });

  it('en localStorage solo aparece la clave con el accountId, nunca el correo ni el nombre (negativa)', async () => {
    await home(donor);
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Zoraida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.queryByTestId('welcome-overlay')).toBeNull());
    expect(Object.keys(localStorage)).toEqual(['paxfide.welcome-done.acc-x']);
    const all = JSON.stringify({ ...localStorage });
    expect(all).not.toContain(EMAIL);
    expect(all).not.toContain('Zoraida');
  });

  it('el foco se queda dentro de la capa; Escape la cierra y el foco vuelve al inicio', async () => {
    await home(donor);
    const dialog = within(await screen.findByTestId('welcome-overlay')).getByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    const buttons = within(dialog).getAllByRole('button');
    const last = buttons[buttons.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(buttons[0], { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByTestId('welcome-overlay')).toBeNull();
    expect(localStorage.getItem('paxfide.welcome-done.acc-x')).toBe('1');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('home-greeting')));
  });

  it('con localStorage que lanza, la capa sale una vez y la página no se rompe', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    await home(donor);
    fireEvent.click(within(await screen.findByTestId('welcome-overlay')).getByRole('button', { name: 'Saltar' }));
    expect(screen.queryByTestId('welcome-overlay')).toBeNull();
    expect(screen.getByTestId('home-greeting')).toBeInTheDocument();
    cleanup();
    // Otra visita a /home en la misma sesión (mismo módulo): no vuelve a salir
    const { HomeScreen } = await import('../src/screens/HomeScreen');
    render(<HomeScreen meClient={async () => ({ kind: 'ok', principal: donor } as never)}
      donationsClient={async () => ({ kind: 'ok', items: [] })} campaignsClient={async () => ({ kind: 'ok', items: [] } as never)}
      profileClient={async () => ({ kind: 'ok', profile: { email: EMAIL } })} impactClient={async () => ({ kind: 'error' })} />);
    await screen.findByTestId('home-greeting');
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByTestId('welcome-overlay')).toBeNull();
  });
});
