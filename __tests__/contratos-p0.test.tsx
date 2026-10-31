// Ref: plan-fase7-puesta-al-dia.md P-0 (R-1, R-2, R-3, U-1, U-2); referencia-api-v1.md §1 (notas R-5 y D3).
import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import * as session from '../src/lib/auth/session';
import { acceptanceFor, login, registerAccount } from '../src/lib/api/identity';
import { LEGAL_VERSIONS } from '../src/lib/legal/versions';
import { RegisterScreen } from '../src/screens/RegisterScreen';
import { LoginScreen } from '../src/screens/LoginScreen';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/login' }));

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});

describe('U-1: versiones legales', () => {
  it('las tres coinciden con la cabecera de Documentos/legal/*.md', () => {
    const dir = path.resolve(__dirname, '../Documentos/legal');
    const version = (file: string) => /\*\*Versión:\*\*\s*`([^`]+)`/.exec(fs.readFileSync(path.join(dir, file), 'utf-8'))![1];
    expect(LEGAL_VERSIONS.terms).toBe(version('terminos-v1-2026-10.md'));
    expect(LEGAL_VERSIONS.dataPolicy).toBe(version('autorizacion-datos-v1-2026-10.md'));
    expect(LEGAL_VERSIONS.organizationTerms).toBe(version('terminos-organizacion-v1-2026-10.md'));
  });
});

describe('Cliente de identidad (R-1, R-2)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    session._resetForTest();
    global.fetch = fetchMock as any;
    fetchMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('registro: el cuerpo lleva las dos versiones vigentes; 400 BadRequest → legal-rejected (otros 400, no)', async () => {
    fetchMock.mockResolvedValueOnce(res(201, { accountId: 'a', status: 'ACTIVE' }));
    expect(await registerAccount('n@x.co', 'clave-de-prueba')).toEqual({ kind: 'ok' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'n@x.co', password: 'clave-de-prueba', acceptedTermsVersion: 'v1-2026-10', acceptedDataPolicyVersion: 'v1-2026-10',
    });
    fetchMock.mockResolvedValueOnce(res(400, { title: 'BadRequest' }));
    expect((await registerAccount('n@x.co', 'clave-de-prueba')).kind).toBe('legal-rejected');
    fetchMock.mockResolvedValueOnce(res(400, { title: 'PasswordTooShort' }));
    expect((await registerAccount('n@x.co', 'clave-de-prueba')).kind).toBe('password-too-short');
    fetchMock.mockResolvedValueOnce(res(400, { title: 'InvalidRequestField' }));
    expect((await registerAccount('n@x.co', 'clave-de-prueba')).kind).toBe('bad-request');
  });

  it('login: sin aceptación el cuerpo es {email, password}; 403 AcceptanceRequired trae solo las pendientes, sin token', async () => {
    fetchMock.mockResolvedValueOnce(res(403, { title: 'AcceptanceRequired', pendingTermsVersion: 'v1-2026-10', token: 'NO' }));
    expect(await login('a@b.co', 'p')).toEqual({ kind: 'acceptance-required', pendingTermsVersion: 'v1-2026-10' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'a@b.co', password: 'p' });
    // Otro 403 (no debería ocurrir en el login) no es una aceptación
    fetchMock.mockResolvedValueOnce(res(403, { title: 'Forbidden' }));
    expect((await login('a@b.co', 'p')).kind).toBe('server-error');
    // El 401 sigue siendo el mismo
    fetchMock.mockResolvedValueOnce(res(401, { title: 'Unauthorized' }));
    expect((await login('a@b.co', 'p')).kind).toBe('invalid-credentials');
  });

  it('acceptanceFor: solo las pendientes y solo si son las de LEGAL_VERSIONS; otra versión → null (la web no tiene ese texto)', () => {
    expect(acceptanceFor({ pendingTermsVersion: 'v1-2026-10' })).toEqual({ acceptedTermsVersion: 'v1-2026-10' });
    expect(acceptanceFor({ pendingTermsVersion: 'v1-2026-10', pendingDataPolicyVersion: 'v1-2026-10' }))
      .toEqual({ acceptedTermsVersion: 'v1-2026-10', acceptedDataPolicyVersion: 'v1-2026-10' });
    expect(acceptanceFor({ pendingDataPolicyVersion: 'v2-2027-01' })).toBeNull();
    expect(acceptanceFor({})).toBeNull();
  });
});

describe('Registro con casillas (R-1)', () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'n@demo.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-de-prueba' } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'clave-de-prueba' } });
  };

  it('sin las dos casillas el botón está deshabilitado y no hay petición (negativa); con una sola, tampoco', () => {
    const client = vi.fn();
    const { container } = render(<RegisterScreen client={client} />);
    fill();
    const button = screen.getByRole('button', { name: 'Crear cuenta' });
    expect(screen.getByTestId('consent-terms')).not.toBeChecked();
    expect(screen.getByTestId('consent-dataPolicy')).not.toBeChecked();
    expect(button).toBeDisabled();
    fireEvent.submit(container.querySelector('form')!);
    fireEvent.click(screen.getByTestId('consent-terms'));
    expect(button).toBeDisabled();
    fireEvent.submit(container.querySelector('form')!);
    expect(client).not.toHaveBeenCalled();
  });

  it('las casillas enlazan a /terminos y /privacidad en una pestaña nueva; con las dos, se envía', async () => {
    const client = vi.fn().mockResolvedValue({ kind: 'ok' });
    render(<RegisterScreen client={client} />);
    fill();
    const terms = screen.getByRole('link', { name: /Términos y condiciones/ });
    expect(terms).toHaveAttribute('href', '/terminos');
    expect(terms).toHaveAttribute('target', '_blank');
    expect(terms).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByRole('link', { name: /tratamiento de mis datos personales/ })).toHaveAttribute('href', '/privacidad');
    fireEvent.click(screen.getByTestId('consent-terms'));
    fireEvent.click(screen.getByTestId('consent-dataPolicy'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(client).toHaveBeenCalledWith('n@demo.test', 'clave-de-prueba'));
  });

  it('400 de versión → su texto propio (no el genérico)', async () => {
    const client = vi.fn().mockResolvedValue({ kind: 'legal-rejected' });
    render(<RegisterScreen client={client} />);
    fill();
    fireEvent.click(screen.getByTestId('consent-terms'));
    fireEvent.click(screen.getByTestId('consent-dataPolicy'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText(/No pudimos registrar que aceptaste las condiciones vigentes/)).toBeInTheDocument();
    expect(screen.queryByText('Revisa los datos: alguno no es válido.')).toBeNull();
  });
});

describe('Login con re-aceptación (U-2)', () => {
  beforeEach(() => session._resetForTest());
  const fillLogin = () => {
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'semilla@demo.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-de-la-semilla' } });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  };

  it('403 → "Actualizamos nuestras condiciones" con una casilla por pendiente; "Aceptar y entrar" repite el login con las versiones', async () => {
    const client = vi.fn()
      .mockResolvedValueOnce({ kind: 'acceptance-required', pendingTermsVersion: 'v1-2026-10', pendingDataPolicyVersion: 'v1-2026-10' })
      .mockResolvedValueOnce({ kind: 'ok', token: 'tok-nuevo' });
    render(<LoginScreen loginClient={client} />);
    fillLogin();
    const box = await screen.findByTestId('acceptance-required');
    expect(within(box).getByRole('heading', { name: 'Actualizamos nuestras condiciones' })).toBeInTheDocument();
    expect(session.getState()).not.toBe('AUTHENTICATED'); // sin token todavía
    const accept = within(box).getByRole('button', { name: 'Aceptar y entrar' });
    expect(accept).toBeDisabled();
    fireEvent.click(within(box).getByTestId('consent-terms'));
    expect(accept).toBeDisabled(); // falta la de datos
    fireEvent.click(within(box).getByTestId('consent-dataPolicy'));
    expect(within(box).getByRole('link', { name: /Términos y condiciones/ })).toHaveAttribute('target', '_blank');
    fireEvent.click(accept);
    await waitFor(() => expect(client).toHaveBeenCalledTimes(2));
    expect(client.mock.calls[1]).toEqual(['semilla@demo.test', 'clave-de-la-semilla',
      { acceptedTermsVersion: 'v1-2026-10', acceptedDataPolicyVersion: 'v1-2026-10' }]);
    await waitFor(() => expect(session.getState()).toBe('AUTHENTICATED'));
  });

  it('solo una pendiente → solo esa casilla (negativa de la otra)', async () => {
    const client = vi.fn().mockResolvedValueOnce({ kind: 'acceptance-required', pendingDataPolicyVersion: 'v1-2026-10' });
    render(<LoginScreen loginClient={client} />);
    fillLogin();
    const box = await screen.findByTestId('acceptance-required');
    expect(within(box).queryByTestId('consent-terms')).toBeNull();
    expect(within(box).getByTestId('consent-dataPolicy')).toBeInTheDocument();
  });

  it('"Cancelar" vuelve al login y la contraseña ya no está en el DOM', async () => {
    const client = vi.fn().mockResolvedValueOnce({ kind: 'acceptance-required', pendingTermsVersion: 'v1-2026-10' });
    const { container } = render(<LoginScreen loginClient={client} />);
    fillLogin();
    await screen.findByTestId('acceptance-required');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByTestId('acceptance-required')).toBeNull();
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).value).toBe('');
    expect(container.innerHTML).not.toContain('clave-de-la-semilla');
  });

  it('401 tras aceptar → el mismo texto único de siempre (ADR-038 §2.6), sin la tarjeta de aceptación', async () => {
    const client = vi.fn()
      .mockResolvedValueOnce({ kind: 'acceptance-required', pendingTermsVersion: 'v1-2026-10' })
      .mockResolvedValueOnce({ kind: 'invalid-credentials' });
    render(<LoginScreen loginClient={client} />);
    fillLogin();
    const box = await screen.findByTestId('acceptance-required');
    fireEvent.click(within(box).getByTestId('consent-terms'));
    await act(async () => { fireEvent.click(within(box).getByRole('button', { name: 'Aceptar y entrar' })); });
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
    expect(screen.queryByTestId('acceptance-required')).toBeNull();
    expect(session.getState()).not.toBe('AUTHENTICATED');
  });

  it('una versión pendiente que la web no tiene → aviso y sin "Aceptar y entrar" (negativa)', async () => {
    const client = vi.fn().mockResolvedValueOnce({ kind: 'acceptance-required', pendingTermsVersion: 'v2-2027-01' });
    render(<LoginScreen loginClient={client} />);
    fillLogin();
    const box = await screen.findByTestId('acceptance-required');
    expect(box).toHaveTextContent('todavía no puede mostrar');
    expect(within(box).queryByRole('button', { name: 'Aceptar y entrar' })).toBeNull();
  });
});
