// Ref: plan-fase7-puesta-al-dia.md Anexo 7 (U-44 a U-49), tests de A7.3; referencia-api-v1.md, notas del 2026-11-02
// (ADR-029 Enmienda 2 y ficha de preverificación). Cada regla con su negativa.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import * as session from '../src/lib/auth/session';
import { zoneLabel } from '../src/lib/location/zoneLabel';
import { AssetActions } from '../src/components/asset/AssetActions';
import { RegisterAssetForm } from '../src/components/asset/RegisterAssetForm';
import { DeliverModal } from '../src/components/asset/DeliverModal';
import { MUNICIPALITY_HINT, MUNICIPALITY_REQUIRED, MUNICIPALITY_NO_CATALOG } from '../src/components/asset/AssetMunicipality';
import { OrganizationProfileForm, NEEDED_FOR_VERIFICATION } from '../src/components/organization/OrganizationProfileForm';
import { EMPTY_FORM } from '../src/lib/organization/profileModel';
import { PlatformScreen, preverificationText } from '../src/screens/PlatformScreen';
import { fetchVerificationQueue } from '../src/lib/api/organization';
import { chooseMunicipality, TEST_CATALOG } from './fixtures/locations';

const locations = vi.hoisted(() => ({ fail: false }));
vi.mock('../src/lib/api/locations', async () => {
  const { TEST_CATALOG: catalog } = await import('./fixtures/locations');
  return {
    fetchLocations: () => Promise.resolve(locations.fail ? { kind: 'error' } : { kind: 'ok', catalog }),
    _resetLocationsForTest: () => {},
  };
});
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/panel' }));
vi.mock('../src/lib/routing/surfaces', () => ({ isSurfaceEnabled: () => true }));

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});
const fetchMock = vi.fn();
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const sentBody = (i: number) => JSON.parse(fetchMock.mock.calls[i][1].body);
const sentId = (i: number) => fetchMock.mock.calls[i][1].headers['Command-Id'];
const commandCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).includes('/physical-assets'));

beforeEach(() => {
  locations.fail = false;
  session._resetForTest();
  session.login('jwt-empleado');
  fetchMock.mockReset();
  global.fetch = fetchMock as any;
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
});
afterEach(() => vi.unstubAllEnvs());

describe('U-47 · zoneLabel (pura)', () => {
  it('los ejemplos del anexo', () => {
    expect(zoneLabel('BARRANQUILLA, ATLÁNTICO')).toBe('Barranquilla, Atlántico');
    expect(zoneLabel('SAN ANDRÉS DE TUMACO, NARIÑO')).toBe('San Andrés de Tumaco, Nariño');
    expect(zoneLabel('BOGOTÁ, D.C.')).toBe('Bogotá, D.C.');
  });
  it('conectores en minúscula salvo al principio de cada parte', () => {
    expect(zoneLabel('RIOHACHA, LA GUAJIRA')).toBe('Riohacha, La Guajira');
    expect(zoneLabel('EL CARMEN DE VIBORAL, ANTIOQUIA')).toBe('El Carmen de Viboral, Antioquia');
    expect(zoneLabel('SANTA ROSA DE LOS OSOS Y DEL RÍO, ANTIOQUIA')).toBe('Santa Rosa de los Osos y del Río, Antioquia');
    expect(zoneLabel('LOS PATIOS, NORTE DE SANTANDER')).toBe('Los Patios, Norte de Santander');
  });
  it('un texto ya en minúsculas o ya presentado no se rompe', () => {
    expect(zoneLabel('barranquilla, atlántico')).toBe('Barranquilla, Atlántico');
    expect(zoneLabel('San Andrés de Tumaco, Nariño')).toBe('San Andrés de Tumaco, Nariño');
    expect(zoneLabel(zoneLabel('BOGOTÁ, D.C.'))).toBe('Bogotá, D.C.');
  });
});

describe('U-44 a U-46 · recibir', () => {
  const openReceive = (municipalityCode?: string) => {
    render(<AssetActions assetRef="A1" delivered={false} onChanged={() => {}} municipalityCode={municipalityCode} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recibir' }));
    fill('Instalación (ubicación)', 'Bodega privada, calle 10');
    fill('Quién recibe (referencia)', 'R');
  };

  it('la ayuda va encima del selector; sin municipio no sale ninguna petición y aparece "Elige el municipio"', async () => {
    openReceive();
    const block = await screen.findByTestId('asset-municipality');
    expect(within(block).getByText(MUNICIPALITY_HINT)).toBeTruthy();
    await within(block).findByRole('option', { name: 'Antioquia' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText(MUNICIPALITY_REQUIRED)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('U-45: empieza en el municipio del lote y lo envía; el texto libre sigue en su campo', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { assetRef: 'A1', status: 'RECEIVED' }));
    openReceive('08001');
    const block = await screen.findByTestId('asset-municipality');
    await waitFor(() => expect((within(block).getByLabelText('Municipio') as HTMLSelectElement).value).toBe('08001'));
    expect((within(block).getByLabelText('Departamento') as HTMLSelectElement).value).toBe('08');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Activo recibido.');
    expect(sentBody(0)).toEqual({ facilityLocation: 'Bodega privada, calle 10', receiverRef: 'R', municipalityCode: '08001' });
  });

  it('se puede cambiar: cambiar de departamento vacía el municipio', async () => {
    openReceive('08001');
    const block = await screen.findByTestId('asset-municipality');
    await waitFor(() => expect((within(block).getByLabelText('Municipio') as HTMLSelectElement).value).toBe('08001'));
    fireEvent.change(within(block).getByLabelText('Departamento'), { target: { value: '05' } });
    expect((within(block).getByLabelText('Municipio') as HTMLSelectElement).value).toBe('');
  });

  it('U-46: un ambiguo se reintenta con el MISMO cuerpo y Command-Id; cambiar el municipio después es un comando nuevo', async () => {
    fetchMock.mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200, { assetRef: 'A1', status: 'RECEIVED' }));
    openReceive('05001');
    const block = await screen.findByTestId('asset-municipality');
    await waitFor(() => expect((within(block).getByLabelText('Municipio') as HTMLSelectElement).value).toBe('05001'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(sentId(1)).toBe(sentId(0));
    expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
    // Mientras el ambiguo está abierto, el municipio no se puede cambiar (Reintentar repite el cuerpo enviado)
    expect((within(block).getByLabelText('Municipio') as HTMLSelectElement).disabled).toBe(true);
    // "Cerrar" abandona la intención; con otro municipio, un comando nuevo
    fireEvent.click(await screen.findByText('Cerrar', { selector: 'button' }));
    fireEvent.change(within(block).getByLabelText('Municipio'), { target: { value: '05266' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Activo recibido.');
    expect(sentBody(2).municipalityCode).toBe('05266');
    expect(sentId(2)).not.toBe(sentId(0));
  });

  it('si el catálogo falla: "Reintentar" en el bloque y no se envía nada', async () => {
    locations.fail = true;
    openReceive('05001');
    await screen.findByTestId('locations-error');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText(MUNICIPALITY_NO_CATALOG)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('U-44 · despachar y dividir no envían municipalityCode (negativa)', () => {
  it('despachar', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { assetRef: 'A1', status: 'DISPATCHED' }));
    render(<AssetActions assetRef="A1" delivered={false} onChanged={() => {}} municipalityCode="05001" />);
    fireEvent.click(screen.getByRole('button', { name: 'Despachar' }));
    expect(screen.queryByTestId('asset-municipality')).toBeNull();
    fill('Transportista (referencia)', 'T');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Activo despachado.');
    expect(sentBody(0)).toEqual({ carrierRef: 'T' });
  });
  it('dividir', async () => {
    fetchMock.mockResolvedValueOnce(res(202, { parentAssetRef: 'A1', childAssetRef: 'C1', status: 'PENDING' }));
    fetchMock.mockResolvedValue(res(200, { status: 'PENDING' }));
    render(<AssetActions assetRef="A1" delivered={false} onChanged={() => {}} municipalityCode="05001" />);
    fireEvent.click(screen.getByRole('button', { name: 'Dividir activo' }));
    expect(screen.queryByTestId('asset-municipality')).toBeNull();
    fill('Cantidad a separar', '2');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(0)).toEqual({ quantity: '2' });
  });
});

describe('U-44 y U-45 · registrar (los dos caminos)', () => {
  const COMMON: [string, string][] = [['Tipo de bien', 'Mercado'], ['Cantidad', '3'], ['Unidad de medida', 'kit'], ['Custodio (referencia)', 'C'], ['Ubicación actual', 'Bodega']];

  it('empieza vacío; sin municipio no sale ninguna petición', async () => {
    render(<RegisterAssetForm onRegistered={() => {}} onCancel={() => {}} />);
    COMMON.forEach(([l, v]) => fill(l, v));
    const block = await screen.findByTestId('asset-municipality');
    await within(block).findByRole('option', { name: 'Antioquia' });
    expect((within(block).getByLabelText('Departamento') as HTMLSelectElement).value).toBe('');
    expect((within(block).getByLabelText('Municipio') as HTMLSelectElement).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(await screen.findByText(MUNICIPALITY_REQUIRED)).toBeTruthy();
    expect(commandCalls()).toHaveLength(0);
  });

  it('camino B (from-donation) y camino A (register) envían municipalityCode', async () => {
    fetchMock.mockResolvedValueOnce(res(201, { assetRef: 'AS-1', status: 'REGISTERED' }));
    const onRegistered = vi.fn();
    const r = render(<RegisterAssetForm onRegistered={onRegistered} onCancel={() => {}} />);
    COMMON.forEach(([l, v]) => fill(l, v));
    await chooseMunicipality('08', '08001');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith('AS-1'));
    expect(fetchMock.mock.calls[0][0]).toContain('/physical-assets/from-donation');
    expect(sentBody(0).municipalityCode).toBe('08001');
    r.unmount();

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(res(201, { assetRef: 'AS-2', status: 'REGISTERED' }));
    render(<RegisterAssetForm onRegistered={onRegistered} onCancel={() => {}} />);
    fireEvent.click(screen.getByLabelText('Compra con fondos de una donación'));
    [['Fondo (referencia)', 'f'], ['Asignación de fondos (referencia)', 'a'], ...COMMON].forEach(([l, v]) => fill(l, v));
    await chooseMunicipality();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith('AS-2'));
    expect(fetchMock.mock.calls[0][0]).toContain('/physical-assets/register');
    expect(sentBody(0)).toEqual(expect.objectContaining({ municipalityCode: '05001', currentLocation: 'Bodega' }));
  });
});

describe('U-44 y U-45 · entregar', () => {
  const photo = () => new File([new Uint8Array(8)], 'e.jpg', { type: 'image/jpeg' });
  const REF = 'sha256:' + 'cd'.repeat(32);
  const fillDeliver = () => {
    fill('Custodio final (referencia)', 'F');
    fill('Beneficiario (referencia)', 'B');
    fill('Lugar de entrega (referencia)', 'Casa comunal, vereda X');
    fireEvent.change(screen.getByLabelText('Foto de la entrega'), { target: { files: [photo()] } });
  };

  it('sin municipio no se sube la foto ni se entrega (negativa)', async () => {
    const upload = vi.fn();
    render(<DeliverModal assetRef="A1" organizationId="org-1" onSuccess={() => {}} onClose={() => {}} upload={upload} />);
    fillDeliver();
    await within(await screen.findByTestId('asset-municipality')).findByRole('option', { name: 'Antioquia' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText(MUNICIPALITY_REQUIRED)).toBeTruthy();
    expect(upload).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('empieza en el municipio del lote y lo envía con la foto', async () => {
    const upload = vi.fn().mockResolvedValue({ kind: 'ok', evidenceRef: REF });
    const onSuccess = vi.fn();
    fetchMock.mockResolvedValueOnce(res(200, { assetRef: 'A1', status: 'DELIVERED' }));
    render(<DeliverModal assetRef="A1" organizationId="org-1" municipalityCode="05266" onSuccess={onSuccess} onClose={() => {}} upload={upload} />);
    fillDeliver();
    const block = await screen.findByTestId('asset-municipality');
    await waitFor(() => expect((within(block).getByLabelText('Municipio') as HTMLSelectElement).value).toBe('05266'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(sentBody(0)).toEqual({ finalCustodianRef: 'F', beneficiaryRef: 'B', locationRef: 'Casa comunal, vereda X', evidenceRef: REF, municipalityCode: '05266' });
  });

  it('un municipio del lote que no está en el catálogo no se inventa: queda vacío', async () => {
    render(<DeliverModal assetRef="A1" organizationId="org-1" municipalityCode="99999" onSuccess={() => {}} onClose={() => {}} upload={vi.fn()} />);
    const block = await screen.findByTestId('asset-municipality');
    await within(block).findByRole('option', { name: 'Antioquia' });
    await waitFor(() => expect((within(block).getByLabelText('Departamento') as HTMLSelectElement).value).toBe(''));
    expect((within(block).getByLabelText('Municipio') as HTMLSelectElement).value).toBe('');
  });
});

describe('U-48 · preverificación en la bandeja', () => {
  it('textos: [] → "Datos completos"; ["nit"] → "Faltan datos: NIT"; los dos', () => {
    expect(preverificationText([])).toBe('Datos completos');
    expect(preverificationText(['nit'])).toBe('Faltan datos: NIT');
    expect(preverificationText(['legalName', 'nit'])).toBe('Faltan datos: razón social, NIT');
  });

  it('usa la lista del backend tal cual, en el orden del servidor (negativa: no reordena ni filtra); los botones no cambian', async () => {
    const me = vi.fn().mockResolvedValue({ kind: 'ok', principal: { accountId: 'p', roles: [], platformAuthority: 'ADMINISTRATOR' } });
    const items = [
      { organizationId: 'o-3', name: 'Zeta', type: 'COMPANY', verificationStatus: 'PENDING_VERIFICATION', missingForVerification: ['legalName', 'nit'], profile: {} },
      { organizationId: 'o-1', name: 'Alfa', type: 'FOUNDATION', verificationStatus: 'PENDING_VERIFICATION', missingForVerification: [], profile: {} },
      // El perfil dice que falta el NIT, pero la web NO deduce: manda la lista del backend
      { organizationId: 'o-2', name: 'Beta', type: 'COMPANY', verificationStatus: 'NEEDS_MORE_INFORMATION', missingForVerification: ['nit'], profile: { legalName: 'Beta SAS' } },
    ];
    render(<PlatformScreen meClient={me as any} queueClient={vi.fn().mockResolvedValue({ kind: 'ok', items }) as any}
      adminsClient={vi.fn().mockResolvedValue({ kind: 'ok', items: [] }) as any} />);
    const rows = await screen.findAllByTestId('queue-item');
    expect(rows.map((r) => within(r).getByRole('heading').textContent)).toEqual(['Zeta', 'Alfa', 'Beta']);
    expect(rows.map((r) => within(r).getByTestId('queue-preverification').textContent))
      .toEqual(['Faltan datos: razón social, NITSugerencia: «Pide más información».', 'Datos completos', 'Faltan datos: NITSugerencia: «Pide más información».']);
    for (const r of rows) {
      expect(within(r).getByRole('button', { name: 'Verificar' })).toBeTruthy();
      expect(within(r).queryByText(/revisión rápida/i)).toBeNull();
    }
  });

  it('el cliente lee missingForVerification; si no llega, no se inventa', async () => {
    session.login('jwt-p');
    fetchMock.mockResolvedValueOnce(res(200, { items: [
      { organizationId: 'o-1', type: 'COMPANY', verificationStatus: 'PENDING_VERIFICATION', missingForVerification: ['nit'] },
      { organizationId: 'o-2', type: 'COMPANY', verificationStatus: 'PENDING_VERIFICATION' },
    ] }));
    const r = await fetchVerificationQueue();
    expect(r.kind === 'ok' && r.items.map((i) => i.missingForVerification)).toEqual([['nit'], undefined]);
  });
});

describe('U-49 · perfil de la organización', () => {
  it('razón social y NIT dicen "Necesarios para que la plataforma verifique la organización"', async () => {
    render(<OrganizationProfileForm value={EMPTY_FORM} onChange={() => {}} errors={{}} type="COMPANY" verified={false}
      locationsClient={async () => ({ kind: 'ok', catalog: TEST_CATALOG })} />);
    expect(screen.getByText(NEEDED_FOR_VERIFICATION)).toBeTruthy();
    expect(screen.getByText(`${NEEDED_FOR_VERIFICATION}. 9 dígitos, sin puntos ni guiones.`)).toBeTruthy();
  });
});
