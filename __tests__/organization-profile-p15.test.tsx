// Ref: plan-fase7-puesta-al-dia.md Anexo 5, P-15 (A5.4): perfil de la organización (ficha R-7).
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EMPTY_FORM, formFromContract, nitCheckDigitOf, profileBody, createBody, validateProfile,
} from '../src/lib/organization/profileModel';
import type { LocationsOutcome } from '../src/lib/api/locations';
import { parsePublicCampaign } from '../src/lib/api/publicCampaignModel';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/panel/organization' }));
vi.mock('../src/lib/routing/surfaces', () => ({ isSurfaceEnabled: (s: string) => s !== 'action:organization-logo' }));

const CATALOG: LocationsOutcome = {
  kind: 'ok',
  catalog: {
    catalogVersion: 'PRUEBA', departments: [
      { code: '05', name: 'Antioquia', municipalities: [{ code: '05001', name: 'Medellín' }, { code: '05266', name: 'Envigado' }] },
      { code: '11', name: 'Bogotá, D.C.', municipalities: [{ code: '11001', name: 'Bogotá, D.C.' }] },
    ],
  },
};
const FULL = {
  description: 'Mercados para el barrio', website: 'https://fundacion.example', location: { departmentCode: '05', municipalityCode: '05001' },
  contactEmail: 'hola@fundacion.example', legalName: 'Fundación Demo S.A.S.', nit: '900123456', nitCheckDigit: '8',
  specialTaxRegime: true, contactPhone: '3001234567',
};

describe('P-15 · modelo', () => {
  it('dígito de verificación con los pesos de la DIAN; uno incorrecto da el aviso', () => {
    expect(nitCheckDigitOf('900123456')).toBe(8);
    expect(nitCheckDigitOf('800197268')).toBe(4); // DIAN (NIT de la propia DIAN: 800.197.268-4)
    expect(nitCheckDigitOf('12345678')).toBeNull();
    const f = { ...EMPTY_FORM, name: 'X', nit: '900123456', nitCheckDigit: '7' };
    expect(validateProfile(f, 'FOUNDATION').nitCheckDigit).toBe('Revisa el dígito de verificación');
    expect(validateProfile({ ...f, nitCheckDigit: '8' }, 'FOUNDATION').nitCheckDigit).toBeUndefined();
  });

  it('validación como el servidor: < y > en la descripción, https, teléfono, longitudes en puntos de código', () => {
    const base = { ...EMPTY_FORM, name: 'Org' };
    expect(validateProfile({ ...base, description: 'hola <b>' }, 'FOUNDATION').description).toBeTruthy();
    expect(validateProfile({ ...base, description: '😀'.repeat(500) }, 'FOUNDATION').description).toBeUndefined();
    expect(validateProfile({ ...base, description: '😀'.repeat(501) }, 'FOUNDATION').description).toBeTruthy();
    expect(validateProfile({ ...base, website: 'http://x.example' }, 'FOUNDATION').website).toBeTruthy();
    expect(validateProfile({ ...base, website: 'https://x.example' }, 'FOUNDATION').website).toBeUndefined();
    for (const ok of ['3001234567', '6012345678']) expect(validateProfile({ ...base, contactPhone: ok }, 'FOUNDATION').contactPhone).toBeUndefined();
    for (const bad of ['2001234567', '601234567', '61012345678']) expect(validateProfile({ ...base, contactPhone: bad }, 'FOUNDATION').contactPhone).toBeTruthy();
    expect(validateProfile({ ...base, specialTaxRegime: true }, 'COMPANY').specialTaxRegime).toBeTruthy();
  });

  it('PUT siempre con todos los campos; vaciar uno lo envía como null; no tocarlo conserva su valor', () => {
    const form = formFromContract('Fundación Demo', FULL);
    const body = profileBody(form, 'FOUNDATION');
    expect(Object.keys(body).sort()).toEqual(['contactEmail', 'contactPhone', 'description', 'legalName', 'location', 'name',
      'nit', 'nitCheckDigit', 'specialTaxRegime', 'website']);
    // Sin tocar nada: todo lo que había vuelve igual (negativa: nunca se borra por omitir)
    expect(body).toEqual({ name: 'Fundación Demo', ...FULL });
    // Vaciar el teléfono → null (borrarlo es explícito); el resto, intacto
    const cleared = profileBody({ ...form, contactPhone: '' }, 'FOUNDATION');
    expect(cleared.contactPhone).toBeNull();
    expect(cleared.website).toBe(FULL.website);
    expect(cleared.legalName).toBe(FULL.legalName);
  });

  it('al crear, solo lo relleno', () => {
    expect(createBody({ ...EMPTY_FORM, name: ' Org ' }, 'COMPANY')).toEqual({ type: 'COMPANY', name: 'Org' });
  });

  it('CV-07: el modelo nunca copia NIT, razón social, teléfono ni régimen, aunque lleguen', () => {
    const c = parsePublicCampaign({
      title: 'C', status: 'OPEN', startDate: '2026-10-01T00:00:00Z', endDate: '2026-12-31T00:00:00Z',
      organizationProfile: { description: 'D', website: 'https://w.example', location: { departmentName: 'Antioquia', municipalityName: 'Medellín' },
        contactEmail: 'a@b.co', nit: '900123456', legalName: 'Secreta S.A.S.', contactPhone: '3001234567', specialTaxRegime: true },
    })!;
    expect(c.organizationProfile).toEqual({ description: 'D', website: 'https://w.example',
      location: { departmentName: 'Antioquia', municipalityName: 'Medellín' }, contactEmail: 'a@b.co' });
    expect(JSON.stringify(c)).not.toMatch(/900123456|Secreta|3001234567|specialTaxRegime/);
  });
});

describe('P-15 · el catálogo se pide una sola vez', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('dos llamadas, una petición; un fallo no se guarda', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.test/api/v1');
    const { fetchLocations, _resetLocationsForTest } = await import('../src/lib/api/locations');
    _resetLocationsForTest();
    const fetchMock = vi.fn(async () => ({ status: 200, text: async () => JSON.stringify(CATALOG.kind === 'ok' ? CATALOG.catalog : {}), headers: { get: () => null } }));
    global.fetch = fetchMock as any;
    await fetchLocations();
    const r = await fetchLocations();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.kind).toBe('ok');
    _resetLocationsForTest();
    fetchMock.mockResolvedValueOnce({ status: 500, text: async () => '', headers: { get: () => null } } as any);
    expect((await fetchLocations()).kind).toBe('error');
    expect((await fetchLocations()).kind).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('P-15 · /panel/organization', () => {
  const me = (roles: string[]) => async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'org-1', roles } } as never);
  const org = (verificationStatus: string, extra = {}) => vi.fn(async () => ({
    kind: 'ok' as const, organization: { organizationId: 'org-1', name: 'Fundación Demo', type: 'FOUNDATION', verificationStatus, profile: FULL, ...extra },
  }));
  async function screenWith(o: ReturnType<typeof org>, update = vi.fn(async () => ({ kind: 'ok' as const, name: 'Fundación Demo', profile: FULL }))) {
    const { OrganizationScreen } = await import('../src/screens/OrganizationScreen');
    render(<OrganizationScreen meClient={me(['REPRESENTATIVE'])} orgClient={o as never} updateClient={update as never}
      locationsClient={async () => CATALOG} />);
    await screen.findByText('Datos de la organización');
    return update;
  }
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.test/api/v1');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('guardar sin tocar nada envía todos los campos con sus valores', async () => {
    const update = await screenWith(org('PENDING_VERIFICATION'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0]).toEqual(['org-1', { name: 'Fundación Demo', ...FULL }]);
    expect(await screen.findByText('Guardamos los datos de la organización.')).toBeInTheDocument();
  });

  it('el municipio depende del departamento; cambiar de departamento lo vacía', async () => {
    await screenWith(org('PENDING_VERIFICATION'));
    await waitFor(() => expect((screen.getByLabelText('Departamento') as HTMLSelectElement).value).toBe('05'));
    const dep = screen.getByLabelText('Departamento') as HTMLSelectElement;
    const mun = screen.getByLabelText('Municipio') as HTMLSelectElement;
    expect(dep.value).toBe('05');
    expect(mun.value).toBe('05001');
    expect(within(mun).getAllByRole('option').map((o) => o.textContent)).toEqual(['Elige un municipio', 'Medellín', 'Envigado']);
    fireEvent.change(dep, { target: { value: '11' } });
    expect((screen.getByLabelText('Municipio') as HTMLSelectElement).value).toBe('');
    expect(within(screen.getByLabelText('Municipio')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Elige un municipio', 'Bogotá, D.C.']);
  });

  it('el aviso del correo público está siempre visible, encima del campo', async () => {
    await screenWith(org('PENDING_VERIFICATION'));
    const notice = screen.getByTestId('public-email-notice');
    expect(notice).toHaveTextContent('Este correo se mostrará en la página pública de tus convocatorias');
    const field = screen.getByLabelText('Correo de contacto');
    expect(notice.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('verificada: nombre, razón social, NIT y dígito solo lectura', async () => {
    await screenWith(org('VERIFIED'));
    for (const l of ['Nombre', 'Razón social', 'NIT', 'Dígito de verificación']) {
      expect(screen.getByLabelText(l, { exact: true })).toHaveAttribute('readonly');
    }
    expect(screen.getAllByText('No se puede cambiar después de la verificación').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Descripción')).not.toHaveAttribute('readonly');
  });

  it.each(['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'])('"Enviar de nuevo a revisión" no aparece en %s (negativa)', async (st) => {
    await screenWith(org(st));
    expect(screen.queryByRole('button', { name: 'Enviar de nuevo a revisión' })).toBeNull();
  });

  it('NEEDS_MORE_INFORMATION: la petición y "Enviar de nuevo a revisión" guarda y después envía el comando', async () => {
    const fetchMock = vi.fn(async () => ({ status: 200, text: async () => JSON.stringify({ verificationStatus: 'PENDING_VERIFICATION' }), headers: { get: () => null } }));
    global.fetch = fetchMock as any;
    const o = org('NEEDS_MORE_INFORMATION', { informationRequest: 'Falta el NIT.' });
    const update = await screenWith(o);
    expect(screen.getByText('Falta el NIT.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar de nuevo a revisión' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(update).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/api/v1/organizations/org-1/verification/resubmit');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Command-Id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText('Enviamos la organización de nuevo a revisión.')).toBeInTheDocument();
  });

  it('el 409 OrganizationNitAlreadyRegistered tiene su texto', async () => {
    await screenWith(org('PENDING_VERIFICATION'), vi.fn(async () => ({ kind: 'nit-taken' as const })) as never);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Ya hay una organización registrada con ese NIT')).toBeInTheDocument();
  });

  it('si el catálogo falla, la ubicación queda con "Reintentar" y el resto sigue', async () => {
    const { OrganizationScreen } = await import('../src/screens/OrganizationScreen');
    const loc = vi.fn<() => Promise<LocationsOutcome>>().mockResolvedValueOnce({ kind: 'error' }).mockResolvedValueOnce(CATALOG);
    render(<OrganizationScreen meClient={me(['ADMINISTRATOR'])} orgClient={org('PENDING_VERIFICATION') as never} locationsClient={loc} />);
    const err = await screen.findByTestId('locations-error');
    expect(screen.getByLabelText('Descripción')).toBeEnabled();
    fireEvent.click(within(err).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Departamento')).toBeInTheDocument();
  });
});
