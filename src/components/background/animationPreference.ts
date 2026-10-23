// Ref: sistema-visual-paxfide-web-enmienda-1.md R-F2 (control visible para pausar; la elección se recuerda en el
// navegador, localStorage con try/catch); plan-fase7-pantallas.md A-1. No es un secreto (D2 no aplica).
import type { PreferenceStorage } from '../../lib/theme/theme';

export const CITY_PAUSE_KEY = 'paxfide.cityPaused';

export type PauseStorageError = 'StorageUnavailable' | 'StorageWriteFailed';
export type PauseWriteResult = { ok: true } | { ok: false; error: PauseStorageError };

export function readPaused(getStorage: () => PreferenceStorage | null | undefined): boolean {
  try {
    return getStorage()?.getItem(CITY_PAUSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writePaused(getStorage: () => PreferenceStorage | null | undefined, paused: boolean): PauseWriteResult {
  let storage: PreferenceStorage | null | undefined;
  try { storage = getStorage(); } catch { return { ok: false, error: 'StorageUnavailable' }; }
  if (!storage) return { ok: false, error: 'StorageUnavailable' };
  try {
    if (paused) storage.setItem(CITY_PAUSE_KEY, '1'); else storage.removeItem(CITY_PAUSE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, error: 'StorageWriteFailed' };
  }
}

/** Qué hace el bucle (lógica pura, probada sin DOM): R-F2 pausa, R-F3 reducir movimiento, R-F4 pestaña oculta. */
export type LoopMode = 'animate' | 'still' | 'off';
export function loopMode(state: { paused: boolean; reducedMotion: boolean; hidden: boolean }): LoopMode {
  if (state.hidden) return 'off'; // sin bucle ni dibujo con la pestaña oculta
  if (state.paused || state.reducedMotion) return 'still'; // un fotograma, sin requestAnimationFrame
  return 'animate';
}

/**
 * Preferencia de pausa compartida (A-2): el botón de la cabecera y cada ilustración (la ciudad y el mundo de la
 * landing) leen el mismo valor y se enteran del cambio sin recargar. Se lee del almacenamiento una sola vez.
 */
const listeners = new Set<() => void>();
let cached: boolean | null = null;

export function subscribePaused(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getPausedSnapshot(getStorage: () => PreferenceStorage | null | undefined): boolean {
  if (cached === null) cached = readPaused(getStorage);
  return cached;
}

export function setPausedPreference(getStorage: () => PreferenceStorage | null | undefined, paused: boolean): PauseWriteResult {
  cached = paused;
  const result = writePaused(getStorage, paused);
  listeners.forEach((l) => l());
  return result;
}

/** Solo para tests: olvida el valor leído. */
export function resetPausedSnapshot(): void { cached = null; }
