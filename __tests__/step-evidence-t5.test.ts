// Ref: plan-fotos-tarea5-web.md §4 test 1 (A); ADR-051 Enmienda 2 E2-1; referencia-api-v1.md §6 (notas del 2026-11-19).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const REF = 'sha256:' + 'cd'.repeat(32);

class FakeXhr {
  static last: FakeXhr | null = null;
  method = ''; url = ''; headers: Record<string, string> = {}; body: FormData | null = null; status = 0; responseText = '';
  upload: { onprogress: ((e: any) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null; onerror: (() => void) | null = null; ontimeout: (() => void) | null = null;
  constructor() { FakeXhr.last = this; }
  open(m: string, u: string) { this.method = m; this.url = u; }
  setRequestHeader(k: string, v: string) { this.headers[k] = v; }
  send(b: FormData) { this.body = b; }
  reply(status: number, body?: unknown) { this.status = status; this.responseText = body === undefined ? '' : JSON.stringify(body); this.onload?.(); }
}

async function load(jwt: string | null = 'jwt-empleado') {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  (globalThis as any).XMLHttpRequest = FakeXhr;
  const session = await import('../src/lib/auth/session');
  if (jwt) session.login(jwt);
  return import('../src/lib/api/stepEvidence');
}

const file = () => new File(['x'], 'p.jpg', { type: 'image/jpeg' });
beforeEach(() => { FakeXhr.last = null; });
afterEach(() => vi.unstubAllEnvs());

describe('uploadStepEvidence', () => {
  it.each(['REGISTERED', 'DISPATCHED', 'RECEIVED'] as const)('POST a asset-evidence con el campo step=%s y la foto', async (step) => {
    const m = await load();
    const p = m.uploadStepEvidence('org-1', step, file());
    const x = FakeXhr.last!;
    expect(x.method).toBe('POST');
    expect(x.url).toBe('http://api.paxfide.test/api/v1/organizations/org-1/asset-evidence');
    expect(x.body!.get('step')).toBe(step);
    expect(x.body!.get('file')).toBeInstanceOf(File);
    x.reply(201, { evidenceRef: REF });
    expect(await p).toEqual({ kind: 'ok', evidenceRef: REF });
  });

  it('el JWT va solo en Authorization, nunca en la URL; sin sesión no hay cabecera', async () => {
    const m = await load('jwt-secreto');
    void m.uploadStepEvidence('org-1', 'DISPATCHED', file());
    expect(FakeXhr.last!.headers.Authorization).toBe('Bearer jwt-secreto');
    expect(FakeXhr.last!.url).not.toContain('jwt-secreto');
    expect(FakeXhr.last!.url).not.toMatch(/[?&](token|jwt|access_token)=/);
    const m2 = await load(null);
    void m2.uploadStepEvidence('org-1', 'DISPATCHED', file());
    expect(FakeXhr.last!.headers.Authorization).toBeUndefined();
  });

  it('413, 415, 503, 403, 401, 410 y otros se mapean a su fallo con nombre; una respuesta sin evidenceRef válida es Failed', async () => {
    const m = await load();
    const expected: Array<[number, string]> = [[413, 'TooLarge'], [415, 'UnsupportedFormat'], [503, 'StorageUnavailable'], [403, 'Forbidden'], [401, 'Unauthorized'], [410, 'Removed'], [500, 'Failed']];
    for (const [status, error] of expected) {
      const p = m.uploadStepEvidence('org-1', 'RECEIVED', file());
      FakeXhr.last!.reply(status);
      expect(await p).toEqual({ kind: 'error', error });
    }
    const p = m.uploadStepEvidence('org-1', 'RECEIVED', file());
    FakeXhr.last!.reply(201, { evidenceRef: 'no-es-una-huella' });
    expect(await p).toEqual({ kind: 'error', error: 'Failed' });
  });

  it('un fallo de red es network y el progreso va de 0 a 1', async () => {
    const m = await load();
    const seen: number[] = [];
    const p = m.uploadStepEvidence('org-1', 'RECEIVED', file(), (f) => seen.push(f));
    FakeXhr.last!.upload.onprogress!({ lengthComputable: true, loaded: 1, total: 4 });
    FakeXhr.last!.onerror!();
    expect(await p).toEqual({ kind: 'network' });
    expect(seen).toEqual([0.25]);
  });
});

describe('textos por paso', () => {
  it('Forbidden dice lo que corresponde a cada paso (no «entregas»)', async () => {
    const m = await load();
    const t = (s: 'REGISTERED' | 'DISPATCHED' | 'RECEIVED') => m.stepEvidenceErrorText('Forbidden', s);
    expect(t('REGISTERED')).toContain('registrar');
    expect(t('DISPATCHED')).toContain('despachar');
    expect(t('RECEIVED')).toContain('recibir');
    for (const s of ['REGISTERED', 'DISPATCHED', 'RECEIVED'] as const) expect(t(s)).not.toContain('entregas');
    expect(m.stepEvidenceErrorText('TooLarge', 'DISPATCHED')).toBe('La foto pesa más de 5 MB. Elige una más liviana.');
    expect(m.stepEvidenceErrorText('UnsupportedFormat', 'DISPATCHED')).toBe('La foto tiene que ser JPEG o PNG.');
    expect(m.stepEvidenceErrorText('StorageUnavailable', 'DISPATCHED')).toContain('No pudimos guardar la foto');
    expect(m.stepEvidenceErrorText('Removed', 'DISPATCHED')).toContain('retiró');
  });
});

describe('rutas de lectura', () => {
  it('paso en minúsculas, ?sequence= solo si se pide, y la copia', async () => {
    const m = await load();
    expect(m.stepPhotoPath('A 1', 'DISPATCHED')).toBe('/physical-assets/A%201/evidence/dispatched');
    expect(m.stepPhotoPath('A1', 'received', 3)).toBe('/physical-assets/A1/evidence/received?sequence=3');
    expect(m.redactedPath('A1')).toBe('/physical-assets/A1/evidence/redacted');
  });
});

describe('lectura y publicación (cliente por defecto)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { global.fetch = fetchMock as any; fetchMock.mockReset(); });
  const res = (status: number, body?: unknown) => ({ status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null } });

  it('listado: normaliza el paso a minúsculas y descarta lo que no entiende', async () => {
    const m = await load();
    fetchMock.mockResolvedValue(res(200, [
      { step: 'REGISTERED', sequence: 1, occurredAt: '2026-11-01T10:00:00Z', hasPhoto: true, removed: false },
      { step: 'dispatched', sequence: 2, occurredAt: '2026-11-02T10:00:00Z', hasPhoto: false, removed: false },
      { step: 'OTRO', sequence: 3, occurredAt: 'x', hasPhoto: true, removed: false },
    ]));
    const r = await m.stepEvidenceClient.list('A1');
    expect(r).toEqual({ kind: 'ok', items: [
      { step: 'registered', sequence: 1, occurredAt: '2026-11-01T10:00:00Z', hasPhoto: true, removed: false },
      { step: 'dispatched', sequence: 2, occurredAt: '2026-11-02T10:00:00Z', hasPhoto: false, removed: false },
    ] });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.paxfide.test/api/v1/physical-assets/A1/evidence/steps');
  });

  it('publicar manda exactamente {confirmNoIdentifiablePerson: true}; despublicar es DELETE sin cuerpo', async () => {
    const m = await load();
    fetchMock.mockResolvedValue(res(204));
    expect(await m.stepEvidenceClient.setPublication('A1', true)).toEqual({ kind: 'ok' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.paxfide.test/api/v1/physical-assets/A1/evidence/redacted/publication');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ confirmNoIdentifiablePerson: true });
    expect(await m.stepEvidenceClient.setPublication('A1', false)).toEqual({ kind: 'ok' });
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[1][1].body).toBeUndefined();
  });

  it('403, 409 RedactedCopyNotGenerated, 410, 400 y 500 NUNCA son ok', async () => {
    const m = await load();
    const cases: Array<[number, string]> = [[403, 'forbidden'], [409, 'not-generated'], [410, 'removed'], [400, 'error'], [500, 'error']];
    for (const [status, kind] of cases) {
      fetchMock.mockResolvedValue(res(status, { title: 'x' }));
      const r = await m.stepEvidenceClient.setPublication('A1', true);
      expect(r.kind).toBe(kind);
      expect(r.kind).not.toBe('ok');
    }
  });

  it('historial: published y decisiones tal cual; 403 es forbidden', async () => {
    const m = await load();
    fetchMock.mockResolvedValue(res(200, { published: true, decisions: [{ action: 'PUBLISH', at: '2026-11-19T10:00:00Z', by: 'acct-1', confirmNoIdentifiablePerson: true }] }));
    expect(await m.stepEvidenceClient.publication('A1')).toEqual({ kind: 'ok', published: true, decisions: [{ action: 'PUBLISH', at: '2026-11-19T10:00:00Z', by: 'acct-1', confirmNoIdentifiablePerson: true }] });
    fetchMock.mockResolvedValue(res(403));
    expect((await m.stepEvidenceClient.publication('A1')).kind).toBe('forbidden');
  });
});
