// Ref: ADR-021-D Enmienda 2, E5 a E8 (definición de hecho, 5 y 7); ADR-051 Enmienda 2, Tarea 4 (backend) y Tarea 6 (web).
// La copia censurada de la foto de entrega en el seguimiento: se pide con `fetch` y la cabecera, se pinta con
// `URL.createObjectURL` y se revoca al desmontar; el trackingCode nunca va en la URL.
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as session from '../src/lib/auth/session';
import { fetchEvidencePreview, parseTransition, type TrackingOutcome } from '../src/lib/api/tracking';
import { StepDetail } from '../src/components/tracking/StepDetail';

const CODE = 'TRK.codigo-secreto-8841';
const URL_OK = '/api/v1/donations/tracking/assets/ref-opaca-1/evidence-preview';
const HUELLA = `sha256:${'a'.repeat(64)}`;
const delivered = (over: Record<string, unknown> = {}) => parseTransition({
  eventType: 'ASSET_DELIVERED', timestamp: '2026-10-04T10:00:00Z', status: 'DELIVERED', anchorStatus: 'PENDING',
  evidenceRegistered: true, evidenceRef: HUELLA, evidencePreviewUrl: URL_OK, ...over,
});

beforeEach(() => {
  session._resetForTest();
  process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.test/api/v1';
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('parseTransition: evidencePreviewUrl', () => {
  it('solo en la entrega y solo con la forma exacta de la ruta del backend', () => {
    expect(delivered().evidencePreviewUrl).toBe(URL_OK);
    // otro paso: nunca
    expect(parseTransition({ eventType: 'ASSET_RECEIVED', evidencePreviewUrl: URL_OK }).evidencePreviewUrl).toBeUndefined();
    // otras formas: nunca (la URL se usa con el trackingCode en la cabecera: no puede apuntar a otro sitio)
    for (const bad of [
      'https://evil.example/api/v1/donations/tracking/assets/x/evidence-preview',
      '//evil.example/api/v1/donations/tracking/assets/x/evidence-preview',
      '/api/v1/donations/tracking/assets/x/evidence-preview?code=abc',
      '/api/v1/donations/tracking/assets/x/evidence-preview#frag',
      '/api/v1/donations/tracking/assets/x/y/evidence-preview',
      '/api/v1/physical-assets/x/evidence/redacted',
      'http://api.test/api/v1/donations/tracking/assets/x/evidence-preview', '', 42, null,
    ]) {
      expect(delivered({ evidencePreviewUrl: bad }).evidencePreviewUrl, String(bad)).toBeUndefined();
    }
  });

  it('E8 (Q-21D2-1 (a)): registrar, despachar y recibir con foto llevan su huella; sin foto, evidenceRegistered: false', () => {
    for (const eventType of ['ASSET_REGISTERED', 'ASSET_DISPATCHED', 'ASSET_RECEIVED']) {
      const withPhoto = parseTransition({ eventType, evidenceRegistered: true, evidenceRef: HUELLA });
      expect(withPhoto.evidenceRegistered, eventType).toBe(true);
      expect(withPhoto.evidenceRef, eventType).toBe(HUELLA);
      const without = parseTransition({ eventType, evidenceRegistered: false });
      expect(without.evidenceRegistered, eventType).toBe(false);
      expect(without.evidenceRef, eventType).toBeUndefined();
      // un texto que no es una huella nunca aparece
      expect(parseTransition({ eventType, evidenceRegistered: true, evidenceRef: 'acta Juan Pérez' }).evidenceRef).toBeUndefined();
    }
    // un paso que no es de foto no lleva nada
    expect(parseTransition({ eventType: 'ASSET_SPLIT', evidenceRegistered: true, evidenceRef: HUELLA }).evidenceRegistered).toBeUndefined();
  });
});

describe('fetchEvidencePreview', () => {
  const okResponse = (type = 'image/png') => ({ ok: true, status: 200, blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type }) });

  it('pide la ruta con Authorization: Bearer; el código nunca va en la URL, y sin cookies ni referrer', async () => {
    const spy = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', spy);
    const r = await fetchEvidencePreview(CODE, URL_OK);
    expect(r.kind).toBe('ok');
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/api/v1/donations/tracking/assets/ref-opaca-1/evidence-preview');
    expect(url).not.toContain(CODE);
    expect(url).not.toContain('?');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${CODE}`);
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.cache).toBe('no-store');
  });

  it('una URL que no es la ruta del backend nunca se pide (y no se manda el código a ninguna parte)', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    for (const bad of ['https://evil.example/x', '/api/v1/donations/tracking/assets/x/evidence-preview?code=1', '']) {
      expect((await fetchEvidencePreview(CODE, bad)).kind).toBe('error');
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('401 → código inválido; 404 → no encontrada; otro error o sin red → error; algo que no es una imagen → error', async () => {
    const answer = async (res: unknown): Promise<TrackingOutcome<Blob>['kind']> => {
      vi.stubGlobal('fetch', vi.fn(async () => res));
      return (await fetchEvidencePreview(CODE, URL_OK)).kind;
    };
    expect(await answer({ ok: false, status: 401 })).toBe('invalid-code');
    expect(await answer({ ok: false, status: 404 })).toBe('not-found');
    expect(await answer({ ok: false, status: 503 })).toBe('error');
    expect(await answer(okResponse('text/html'))).toBe('error');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    expect((await fetchEvidencePreview(CODE, URL_OK)).kind).toBe('error');
  });
});

describe('StepDetail: la copia censurada', () => {
  let created: string[];
  let revoked: string[];
  beforeEach(() => {
    created = []; revoked = [];
    let n = 0;
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: vi.fn(() => { const u = `blob:http://app.test/${++n}`; created.push(u); return u; }),
      revokeObjectURL: vi.fn((u: string) => { revoked.push(u); }),
    }));
  });

  const show = (step = delivered(), preview = vi.fn(async (): Promise<TrackingOutcome<Blob>> => ({ kind: 'ok', data: new Blob(['x'], { type: 'image/png' }) }))) => {
    const view = render(<StepDetail step={step} payment={null} trackingCode={CODE} previewClient={preview} />);
    return { view, preview };
  };

  it('con evidencePreviewUrl: pide la imagen con el código, la pinta con createObjectURL y el src no lleva el código', async () => {
    const { preview } = show();
    const img = await screen.findByTestId('evidence-preview-img');
    expect(preview).toHaveBeenCalledWith(CODE, URL_OK);
    expect(img.getAttribute('src')).toBe(created[0]);
    expect(img.getAttribute('src')).toMatch(/^blob:/);
    expect(img.getAttribute('src')).not.toContain(CODE);
    expect(img.getAttribute('alt')).toMatch(/difuminad/i);
    // aserción negativa: el código no está en ningún atributo del detalle
    expect(document.body.innerHTML).not.toContain(CODE);
  });

  it('revoca la URL al desmontar y al cambiar de paso (y no deja ninguna sin revocar)', async () => {
    const { view } = show();
    await screen.findByTestId('evidence-preview-img');
    const first = created[0];
    // otro paso con otra imagen
    view.rerender(<StepDetail step={delivered({ evidencePreviewUrl: '/api/v1/donations/tracking/assets/ref-2/evidence-preview' })}
      payment={null} trackingCode={CODE} previewClient={async () => ({ kind: 'ok', data: new Blob(['y'], { type: 'image/png' }) })} />);
    await waitFor(() => expect(created).toHaveLength(2));
    expect(revoked).toContain(first);
    view.unmount();
    expect(revoked).toContain(created[1]);
    expect(revoked.sort()).toEqual([...created].sort());
  });

  it('un paso sin evidencePreviewUrl no pide nada y no dice que haya una copia (aserción negativa)', async () => {
    const { preview } = show(delivered({ evidencePreviewUrl: undefined }));
    expect(screen.getByTestId('detail-evidence')).toHaveTextContent('Con foto de entrega');
    expect(screen.queryByTestId('evidence-preview')).toBeNull();
    expect(preview).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
    expect(document.body.textContent ?? '').not.toMatch(/difuminad|censurad|publicad|revisi/i);
  });

  it('si la imagen no carga (404, 401, error), el paso sigue igual y no se promete nada', async () => {
    for (const kind of ['not-found', 'invalid-code', 'error'] as const) {
      cleanup();
      show(delivered(), vi.fn(async () => ({ kind }) as TrackingOutcome<Blob>));
      await waitFor(() => expect(screen.queryByTestId('evidence-preview-loading')).toBeNull());
      expect(screen.queryByTestId('evidence-preview-img'), kind).toBeNull();
      expect(screen.getByTestId('detail-evidence')).toHaveTextContent('Con foto de entrega'); // el hecho no cambia
      expect(created).toHaveLength(0);
    }
  });

  it('los otros pasos con foto muestran su huella pero nunca una imagen', async () => {
    const preview = vi.fn();
    render(<StepDetail step={parseTransition({ eventType: 'ASSET_RECEIVED', evidenceRegistered: true, evidenceRef: HUELLA })}
      payment={null} trackingCode={CODE} previewClient={preview} />);
    expect(screen.getByTestId('detail-evidence')).toHaveTextContent('Con foto');
    expect(screen.queryByTestId('evidence-preview')).toBeNull();
    expect(preview).not.toHaveBeenCalled();
  });

  it('una respuesta que llega tarde (ya se cambió de paso) no deja una URL sin revocar', async () => {
    let resolve!: (v: TrackingOutcome<Blob>) => void;
    const slow = vi.fn(() => new Promise<TrackingOutcome<Blob>>((r) => { resolve = r; }));
    const { view } = show(delivered(), slow);
    view.unmount();
    await act(async () => { resolve({ kind: 'ok', data: new Blob(['x'], { type: 'image/png' }) }); });
    expect(revoked.sort()).toEqual([...created].sort());
  });
});
