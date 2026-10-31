// Ref: prompts-agentes-estilo-v2.md VS-0 (tema); decisiones-delegadas-web-fase7.md DF7-10.
import { describe, it, expect, vi } from 'vitest';
import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyPreference,
  parsePreference,
  readPreference,
  writePreference,
  type PreferenceStorage,
} from '../src/lib/theme/theme';

function memoryStorage(initial: Record<string, string> = {}): PreferenceStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

const throwing: PreferenceStorage = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
};

describe('parsePreference', () => {
  it('acepta solo light, dark y system; lo demás es system', () => {
    expect(parsePreference('light')).toBe('light');
    expect(parsePreference('dark')).toBe('dark');
    expect(parsePreference('system')).toBe('system');
    for (const v of [null, undefined, '', 'DARK', 'sepia', 1, {}]) expect(parsePreference(v)).toBe('system');
  });
});

describe('readPreference', () => {
  it('lee la preferencia guardada', () => {
    expect(readPreference(() => memoryStorage({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark');
  });
  it('sin preferencia o sin almacenamiento: system', () => {
    expect(readPreference(() => memoryStorage())).toBe('system');
    expect(readPreference(() => null)).toBe('system');
  });
  it('sobrevive a un localStorage que lanza al leer', () => {
    expect(readPreference(() => throwing)).toBe('system');
  });
  it('sobrevive a que acceder a localStorage lance', () => {
    expect(readPreference(() => { throw new Error('SecurityError'); })).toBe('system');
  });
});

describe('writePreference', () => {
  it('guarda light/dark y borra la clave con system', () => {
    const s = memoryStorage();
    expect(writePreference(() => s, 'dark')).toEqual({ ok: true });
    expect(s.data[THEME_STORAGE_KEY]).toBe('dark');
    expect(writePreference(() => s, 'system')).toEqual({ ok: true });
    expect(THEME_STORAGE_KEY in s.data).toBe(false);
  });
  it('devuelve un fallo con nombre, sin lanzar, si el almacenamiento falla', () => {
    expect(writePreference(() => throwing, 'light')).toEqual({ ok: false, error: 'StorageWriteFailed' });
    expect(writePreference(() => { throw new Error('x'); }, 'light')).toEqual({ ok: false, error: 'StorageUnavailable' });
    expect(writePreference(() => null, 'light')).toEqual({ ok: false, error: 'StorageUnavailable' });
  });
});

describe('applyPreference', () => {
  it('light/dark ponen data-theme; system lo quita', () => {
    const root = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
    applyPreference(root, 'light');
    expect(root.setAttribute).toHaveBeenLastCalledWith('data-theme', 'light');
    applyPreference(root, 'dark');
    expect(root.setAttribute).toHaveBeenLastCalledWith('data-theme', 'dark');
    applyPreference(root, 'system');
    expect(root.removeAttribute).toHaveBeenCalledWith('data-theme');
  });
});

describe('THEME_INIT_SCRIPT', () => {
  function run(getItem: () => string | null) {
    const root = { setAttribute: vi.fn() };
    const fn = new Function('window', 'document', THEME_INIT_SCRIPT);
    fn({ localStorage: { getItem } }, { documentElement: root });
    return root.setAttribute;
  }
  it('aplica una preferencia forzada antes de pintar', () => {
    expect(run(() => 'dark')).toHaveBeenCalledWith('data-theme', 'dark');
  });
  it('ignora valores no válidos y no lanza si localStorage lanza', () => {
    expect(run(() => 'sepia')).not.toHaveBeenCalled();
    expect(() => run(() => { throw new Error('SecurityError'); })).not.toThrow();
  });
});
