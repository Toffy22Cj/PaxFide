// Ref: plan-fotos-tarea5-web.md §4 tests 3, 4, 5 y 6 (A y B); ADR-051 Enmienda 2 E2-1 (opcionales), E2-3 (nunca bloquea) y E2-8.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chooseMunicipality, locationsModuleMock } from './fixtures/locations';

vi.mock('../src/lib/api/locations', () => locationsModuleMock());
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

const REF = 'sha256:' + 'ef'.repeat(32);
const res = (status: number, body?: unknown) => ({ status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null } });
const fetchMock = vi.fn();
const photo = () => new File(['x'], 'p.jpg', { type: 'image/jpeg' });
let created = 0;

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['action:dispatch', 'action:receive', 'action:register-asset']));
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  const session = await import('../src/lib/auth/session');
  session.login('jwt-empleado');
  return {
    ...(await import('../src/components/asset/CommandModal')),
    ...(await import('../src/components/asset/AssetActions')),
    ...(await import('../src/components/asset/RegisterAssetForm')),
  };
}
const body = (i = 0) => JSON.parse(fetchMock.mock.calls[i][1].body);
const ok = { kind: 'ok' as const, evidenceRef: REF };

beforeEach(() => {
  global.fetch = fetchMock as any; fetchMock.mockReset(); created = 0;
  (URL as any).createObjectURL = () => `blob:p-${++created}`; (URL as any).revokeObjectURL = () => {};
});
afterEach(() => vi.unstubAllEnvs());

const dispatchModal = (m: any, upload: any, onSuccess = () => {}) => render(
  <m.CommandModal title="Despachar activo" fields={[{ name: 'carrierRef', label: 'Transportista (referencia)' }]} submitLabel="Confirmar"
    builder={(p: unknown) => ({ path: '/physical-assets/A1/dispatch', body: p, auth: 'required' })}
    photo={{ organizationId: 'org-1', step: 'DISPATCHED', upload }} onSuccess={onSuccess} onClose={() => {}} />,
);
const pick = () => fireEvent.change(screen.getByLabelText('Foto (opcional)'), { target: { files: [photo()] } });

describe('Despachar con y sin foto (CommandModal)', () => {
  it('SIN foto: no se sube nada (never) y el cuerpo NO lleva evidenceRef', async () => {
    const m = await load();
    const upload = vi.fn();
    fetchMock.mockResolvedValueOnce(res(202, {}));
    dispatchModal(m, upload);
    fireEvent.change(screen.getByLabelText('Transportista (referencia)'), { target: { value: 'T-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(upload).not.toHaveBeenCalled();
    expect(body()).toEqual({ carrierRef: 'T-1' });
    expect(Object.keys(body())).not.toContain('evidenceRef');
  });

  it('CON foto: primero la subida (paso DISPATCHED, su organización), después el comando con su evidenceRef', async () => {
    const m = await load();
    const order: string[] = [];
    const upload = vi.fn(async () => { order.push('upload'); return ok; });
    fetchMock.mockImplementationOnce(async () => { order.push('command'); return res(202, {}); });
    dispatchModal(m, upload);
    fireEvent.change(screen.getByLabelText('Transportista (referencia)'), { target: { value: 'T-1' } });
    pick();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['upload', 'command']);
    expect(upload).toHaveBeenCalledWith('org-1', 'DISPATCHED', expect.any(File), expect.any(Function));
    expect(body()).toEqual({ carrierRef: 'T-1', evidenceRef: REF });
  });

  it('si la subida falla, el comando NO se manda hasta que la persona elige «Seguir sin foto»', async () => {
    const m = await load();
    const upload = vi.fn(async () => ({ kind: 'error' as const, error: 'StorageUnavailable' as const }));
    fetchMock.mockResolvedValueOnce(res(202, {}));
    dispatchModal(m, upload);
    fireEvent.change(screen.getByLabelText('Transportista (referencia)'), { target: { value: 'T-1' } });
    pick();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText(/No pudimos guardar la foto/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir sin foto' }));
    expect(fetchMock).not.toHaveBeenCalled(); // elegir no confirma por sí solo
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(upload).toHaveBeenCalledTimes(1);
    expect(body()).toEqual({ carrierRef: 'T-1' });
  });

  it('un reintento tras fallo sube otra vez; tras una subida buena y un comando ambiguo NO vuelve a subir y repite el mismo cuerpo', async () => {
    const m = await load();
    const upload = vi.fn()
      .mockResolvedValueOnce({ kind: 'error', error: 'Failed' })
      .mockResolvedValueOnce(ok);
    fetchMock.mockRejectedValueOnce(new Error('red')).mockResolvedValueOnce(res(202, {}));
    dispatchModal(m, upload);
    fireEvent.change(screen.getByLabelText('Transportista (referencia)'), { target: { value: 'T-1' } });
    pick();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('No pudimos subir la foto. Inténtalo de nuevo.');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1)); // comando ambiguo (red)
    expect(upload).toHaveBeenCalledTimes(2);
    fireEvent.click(await screen.findByRole('button', { name: /Reintentar/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(upload).toHaveBeenCalledTimes(2); // sin subir otra vez
    expect(body(1)).toEqual(body(0));
    expect(body(1).evidenceRef).toBe(REF);
  });

  it('mensajes propios: 413, 415 y 503 (cada uno el suyo) y 410', async () => {
    const m = await load();
    const texts: Record<string, string> = {
      TooLarge: 'La foto pesa más de 5 MB. Elige una más liviana.',
      UnsupportedFormat: 'La foto tiene que ser JPEG o PNG.',
      StorageUnavailable: 'No pudimos guardar la foto en este momento. Inténtalo de nuevo en unos minutos.',
      Removed: 'La plataforma retiró esta foto. Toma una nueva.',
    };
    for (const [error, text] of Object.entries(texts)) {
      const upload = vi.fn(async () => ({ kind: 'error' as const, error }));
      const r = dispatchModal(m, upload);
      fireEvent.change(screen.getByLabelText('Transportista (referencia)'), { target: { value: 'T' } });
      pick();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
      expect(await screen.findByText(text)).toBeTruthy();
      r.unmount();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin organización conocida el campo de foto no se ofrece', async () => {
    const m = await load();
    render(<m.CommandModal title="Despachar activo" fields={[]} submitLabel="Confirmar" builder={() => ({ path: '/x', body: {} })}
      photo={{ organizationId: null, step: 'DISPATCHED' }} onSuccess={() => {}} onClose={() => {}} />);
    expect(screen.queryByLabelText('Foto (opcional)')).toBeNull();
  });
});

describe('Recibir con foto', () => {
  it('con foto: paso RECEIVED y evidenceRef junto al municipio; sin foto: ninguna de las dos cosas extra', async () => {
    const m = await load();
    const upload = vi.fn(async () => ok);
    fetchMock.mockResolvedValue(res(202, {}));
    const principal = { status: 'ready' as const, data: { accountId: 'a', organizationId: 'org-1', roles: ['EMPLOYEE'] as any } };
    const r = render(<m.AssetActions assetRef="A1" delivered={false} onChanged={() => {}} principal={principal} photoUpload={upload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recibir' }));
    fireEvent.change(screen.getByLabelText('Instalación (ubicación)'), { target: { value: 'Bodega' } });
    fireEvent.change(screen.getByLabelText('Quién recibe (referencia)'), { target: { value: 'R-1' } });
    await chooseMunicipality();
    pick();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(upload).toHaveBeenCalledWith('org-1', 'RECEIVED', expect.any(File), expect.any(Function));
    expect(body()).toMatchObject({ facilityLocation: 'Bodega', receiverRef: 'R-1', municipalityCode: '05001', evidenceRef: REF });
    r.unmount();

    fetchMock.mockClear(); upload.mockClear();
    render(<m.AssetActions assetRef="A1" delivered={false} onChanged={() => {}} principal={principal} photoUpload={upload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recibir' }));
    fireEvent.change(screen.getByLabelText('Instalación (ubicación)'), { target: { value: 'Bodega' } });
    fireEvent.change(screen.getByLabelText('Quién recibe (referencia)'), { target: { value: 'R-1' } });
    await chooseMunicipality();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(upload).not.toHaveBeenCalled();
    expect(Object.keys(body())).not.toContain('evidenceRef');
  });

  it('despachar desde la ficha usa el paso DISPATCHED', async () => {
    const m = await load();
    const upload = vi.fn(async () => ok);
    fetchMock.mockResolvedValue(res(202, {}));
    const principal = { status: 'ready' as const, data: { accountId: 'a', organizationId: 'org-1', roles: ['EMPLOYEE'] as any } };
    render(<m.AssetActions assetRef="A1" delivered={false} onChanged={() => {}} principal={principal} photoUpload={upload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Despachar' }));
    fireEvent.change(screen.getByLabelText('Transportista (referencia)'), { target: { value: 'T-1' } });
    pick();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(upload).toHaveBeenCalledWith('org-1', 'DISPATCHED', expect.any(File), expect.any(Function)));
  });
});

describe('Registrar con foto (RegisterAssetForm)', () => {
  const COMMON: Array<[string, string]> = [['Tipo de bien', 'Mercado'], ['Cantidad', '10'], ['Unidad de medida', 'kit'], ['Custodio (referencia)', 'CUS'], ['Ubicación actual', 'Bodega']];
  const fill = () => COMMON.forEach(([l, v]) => fireEvent.change(screen.getByLabelText(l), { target: { value: v } }));

  it('con foto: paso REGISTERED y evidenceRef en el cuerpo; sin foto: no se sube ni se manda', async () => {
    const m = await load();
    const upload = vi.fn(async () => ok);
    fetchMock.mockResolvedValue(res(201, { assetRef: 'AS-9' }));
    const r = render(<m.RegisterAssetForm organizationId="org-1" onRegistered={() => {}} onCancel={() => {}} photoUpload={upload} />);
    fill(); await chooseMunicipality(); pick();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(upload).toHaveBeenCalledWith('org-1', 'REGISTERED', expect.any(File), expect.any(Function));
    expect(body().evidenceRef).toBe(REF);
    r.unmount();

    fetchMock.mockClear(); upload.mockClear();
    render(<m.RegisterAssetForm organizationId="org-1" onRegistered={() => {}} onCancel={() => {}} photoUpload={upload} />);
    fill(); await chooseMunicipality();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(upload).not.toHaveBeenCalled();
    expect(Object.keys(body())).not.toContain('evidenceRef');
  });

  it('subida fallida: el registro no se manda; «Seguir sin foto» y confirmar sí lo manda, sin evidenceRef', async () => {
    const m = await load();
    const upload = vi.fn(async () => ({ kind: 'error' as const, error: 'UnsupportedFormat' as const }));
    fetchMock.mockResolvedValue(res(201, { assetRef: 'AS-9' }));
    render(<m.RegisterAssetForm organizationId="org-1" onRegistered={() => {}} onCancel={() => {}} photoUpload={upload} />);
    fill(); await chooseMunicipality(); pick();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    expect((await screen.findAllByText('La foto tiene que ser JPEG o PNG.')).length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir sin foto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(Object.keys(body())).not.toContain('evidenceRef');
  });

  it('el aviso de que la foto no se puede cambiar después se dice en pantalla', async () => {
    const m = await load();
    render(<m.RegisterAssetForm organizationId="org-1" onRegistered={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/Después de confirmar el paso, la foto ya no se puede cambiar/)).toBeTruthy();
  });
});
