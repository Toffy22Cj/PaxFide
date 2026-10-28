// Ref: plan-fase7-puesta-al-dia.md U-3 y P-0 §7 (tests de la entrega); referencia-api-v1.md §6 (ADR-051 T4).
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkEvidenceFile, EVIDENCE_MAX_BYTES, evidenceErrorFor } from '../src/lib/api/deliveryEvidence';

const res = (status: number, body?: unknown) => ({
  status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null },
});
const REF = 'sha256:' + 'ab'.repeat(32);
const fetchMock = vi.fn();

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  const session = await import('../src/lib/auth/session');
  session.login('jwt-empleado');
  return { ...(await import('../src/components/asset/DeliverModal')) };
}

function photo(size: number, type = 'image/jpeg') {
  const f = new File([new Uint8Array(Math.min(size, 16))], 'entrega.jpg', { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

function fill(file: File) {
  fireEvent.change(screen.getByLabelText('Custodio final (referencia)'), { target: { value: 'C' } });
  fireEvent.change(screen.getByLabelText('Beneficiario (referencia)'), { target: { value: 'B' } });
  fireEvent.change(screen.getByLabelText('Lugar de entrega (referencia)'), { target: { value: 'L' } });
  fireEvent.change(screen.getByLabelText('Foto de la entrega'), { target: { files: [file] } });
}

beforeEach(() => { global.fetch = fetchMock as any; fetchMock.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe('Comprobación antes de subir (pura)', () => {
  it('5 MB binarios como el backend; JPEG y PNG; el resto, no', () => {
    expect(EVIDENCE_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(checkEvidenceFile({ size: EVIDENCE_MAX_BYTES, type: 'image/png' })).toBeNull();
    expect(checkEvidenceFile({ size: EVIDENCE_MAX_BYTES + 1, type: 'image/jpeg' })).toBe('TooLarge');
    expect(checkEvidenceFile({ size: 10, type: 'image/gif' })).toBe('UnsupportedFormat');
    expect([413, 415, 410, 503, 403, 401, 500].map(evidenceErrorFor))
      .toEqual(['TooLarge', 'UnsupportedFormat', 'Removed', 'StorageUnavailable', 'Forbidden', 'Unauthorized', 'Failed']);
  });
});

describe('DeliverModal (U-3)', () => {
  it('una foto de 6 MB no se sube ni se entrega (negativa)', async () => {
    const { DeliverModal } = await load();
    const upload = vi.fn();
    render(<DeliverModal assetRef="A1" organizationId="org-1" onSuccess={() => {}} onClose={() => {}} upload={upload} />);
    fill(photo(6 * 1024 * 1024));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findAllByText('La foto pesa más de 5 MB. Elige una más liviana.')).not.toHaveLength(0);
    expect(upload).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('415 al subir → su texto; no se entrega (negativa)', async () => {
    const { DeliverModal } = await load();
    const upload = vi.fn().mockResolvedValue({ kind: 'error', error: 'UnsupportedFormat' });
    render(<DeliverModal assetRef="A1" organizationId="org-1" onSuccess={() => {}} onClose={() => {}} upload={upload} />);
    fill(photo(1000));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })); });
    expect(await screen.findByText('La foto tiene que ser JPEG o PNG.')).toBeInTheDocument();
    expect(upload).toHaveBeenCalledWith('org-1', expect.any(File), expect.any(Function));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  for (const [error, text] of [
    ['Removed', 'La plataforma retiró esta foto. Toma una nueva.'],
    ['StorageUnavailable', 'No pudimos guardar la foto en este momento. Inténtalo de nuevo en unos minutos.'],
    ['TooLarge', 'La foto pesa más de 5 MB. Elige una más liviana.'],
  ] as const) {
    it(`subida ${error} → "${text}"`, async () => {
      const { DeliverModal } = await load();
      const upload = vi.fn().mockResolvedValue({ kind: 'error', error });
      render(<DeliverModal assetRef="A1" organizationId="org-1" onSuccess={() => {}} onClose={() => {}} upload={upload} />);
      fill(photo(1000));
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })); });
      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }

  it('subida y entrega ambigua → "Reintentar" no vuelve a subir y repite el mismo evidenceRef y el mismo Command-Id', async () => {
    const { DeliverModal } = await load();
    const upload = vi.fn().mockResolvedValue({ kind: 'ok', evidenceRef: REF });
    const onSuccess = vi.fn();
    render(<DeliverModal assetRef="A1" organizationId="org-1" onSuccess={onSuccess} onClose={() => {}} upload={upload} />);
    fill(photo(1000));
    fetchMock.mockResolvedValueOnce(res(500)).mockResolvedValueOnce(res(200, { assetRef: 'A1', status: 'DELIVERED' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })); });
    fireEvent.click(await screen.findByText('Reintentar'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(upload).toHaveBeenCalledTimes(1);
    const [url, first] = fetchMock.mock.calls[0];
    const second = fetchMock.mock.calls[1][1];
    expect(url).toBe('http://api.paxfide.test/api/v1/physical-assets/A1/deliver');
    expect(JSON.parse(first.body)).toEqual({ finalCustodianRef: 'C', beneficiaryRef: 'B', locationRef: 'L', evidenceRef: REF });
    expect(second.body).toBe(first.body);
    expect(second.headers['Command-Id']).toBe(first.headers['Command-Id']);
  });

  it('400 EvidenceNotFound y 409 EvidenceAlreadyBound → su texto; un nuevo intento con la misma foto no vuelve a subirla', async () => {
    const { DeliverModal } = await load();
    const upload = vi.fn().mockResolvedValue({ kind: 'ok', evidenceRef: REF });
    render(<DeliverModal assetRef="A1" organizationId="org-1" onSuccess={() => {}} onClose={() => {}} upload={upload} />);
    fill(photo(1000));
    fetchMock.mockResolvedValueOnce(res(400, { title: 'EvidenceNotFound' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })); });
    expect(await screen.findByText('No encontramos la foto de la entrega en tu organización. Súbela de nuevo.')).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(res(409, { title: 'EvidenceAlreadyBound' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })); });
    expect(await screen.findByText('Esa foto ya se usó en otra entrega. Toma una foto de esta entrega.')).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(1);
    // Rechazo: una intención nueva lleva otro Command-Id (D6)
    expect(fetchMock.mock.calls[1][1].headers['Command-Id']).not.toBe(fetchMock.mock.calls[0][1].headers['Command-Id']);
  });

  it('otra foto → otra subida', async () => {
    const { DeliverModal } = await load();
    const upload = vi.fn().mockResolvedValue({ kind: 'ok', evidenceRef: REF });
    render(<DeliverModal assetRef="A1" organizationId="org-1" onSuccess={() => {}} onClose={() => {}} upload={upload} />);
    fill(photo(1000));
    fetchMock.mockResolvedValue(res(400, { title: 'EvidenceNotFound' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })); });
    fireEvent.change(screen.getByLabelText('Foto de la entrega'), { target: { files: [photo(2000)] } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })); });
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('sin organización conocida no se sube nada (negativa)', async () => {
    const { DeliverModal } = await load();
    const upload = vi.fn();
    render(<DeliverModal assetRef="A1" organizationId={null} onSuccess={() => {}} onClose={() => {}} upload={upload} />);
    fill(photo(1000));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })); });
    expect(screen.getByText(/No pudimos saber a qué organización pertenece tu cuenta/)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });
});
