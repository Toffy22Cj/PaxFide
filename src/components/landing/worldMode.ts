// Ref: plan-fase7-fidelidad.md D-F2 (control Auto / Noche / Día de la landing y del acceso; la elección se guarda en el
// navegador, clave `paxfide.world-mode`, con try/catch, solo como comodidad) y F-A1 (textos de `updateThemeUI` del
// prototipo). No es un secreto (D2 no aplica). El resto de la app (la ciudad) sigue el tema de la app, no esto.
import type { PreferenceStorage } from '../../lib/theme/theme';
import { autoNight } from './worldScene';

export type WorldMode = 'auto' | 'night' | 'day';
export const WORLD_MODE_KEY = 'paxfide.world-mode';

/** Fallos con nombre (regla de código 4). */
export type WorldModeStorageError = 'StorageUnavailable' | 'StorageWriteFailed';
export type WorldModeWriteResult = { ok: true } | { ok: false; error: WorldModeStorageError };

export function parseWorldMode(value: unknown): WorldMode {
  return value === 'night' || value === 'day' || value === 'auto' ? value : 'auto';
}

export function readWorldMode(getStorage: () => PreferenceStorage | null | undefined): WorldMode {
  try {
    const storage = getStorage();
    return storage ? parseWorldMode(storage.getItem(WORLD_MODE_KEY)) : 'auto';
  } catch {
    return 'auto';
  }
}

export function writeWorldMode(getStorage: () => PreferenceStorage | null | undefined, mode: WorldMode): WorldModeWriteResult {
  let storage: PreferenceStorage | null | undefined;
  try { storage = getStorage(); } catch { return { ok: false, error: 'StorageUnavailable' }; }
  if (!storage) return { ok: false, error: 'StorageUnavailable' };
  try {
    if (mode === 'auto') storage.removeItem(WORLD_MODE_KEY); else storage.setItem(WORLD_MODE_KEY, mode);
    return { ok: true };
  } catch {
    return { ok: false, error: 'StorageWriteFailed' };
  }
}

/** El ciclo del botón, como `toggleTheme` del prototipo: Auto → Noche → Día → Auto. */
export function nextWorldMode(mode: WorldMode): WorldMode {
  switch (mode) {
    case 'auto': return 'night';
    case 'night': return 'day';
    case 'day': return 'auto';
    default: {
      const unreachable: never = mode;
      throw new Error(`Modo de iluminación desconocido: ${String(unreachable)}`);
    }
  }
}

/**
 * Mezcla de noche (0 día, 1 noche). En Auto sigue el recorrido; con "reducir movimiento" salta de parada en parada,
 * sin mezcla intermedia (como la cámara, R-F3).
 */
export function worldNight(mode: WorldMode, progress: number, reducedMotion: boolean): number {
  switch (mode) {
    case 'night': return 1;
    case 'day': return 0;
    case 'auto': return autoNight(reducedMotion ? Math.round(progress) : progress);
    default: {
      const unreachable: never = mode;
      throw new Error(`Modo de iluminación desconocido: ${String(unreachable)}`);
    }
  }
}

/** Qué icono lleva el botón: sol, ocaso o luna (en SVG, no emoji). */
export type WorldModeIcon = 'sun' | 'dusk' | 'moon';

/** Texto e icono del botón (prototipo `updateThemeUI`): Auto (Día) < 0,3 ≤ Auto (Ocaso) < 0,7 ≤ Auto (Noche). */
export function worldModeLook(mode: WorldMode, night: number): { text: string; icon: WorldModeIcon } {
  switch (mode) {
    case 'night': return { text: 'Noche', icon: 'moon' };
    case 'day': return { text: 'Día', icon: 'sun' };
    case 'auto':
      if (night >= 0.7) return { text: 'Auto (Noche)', icon: 'moon' };
      if (night >= 0.3) return { text: 'Auto (Ocaso)', icon: 'dusk' };
      return { text: 'Auto (Día)', icon: 'sun' };
    default: {
      const unreachable: never = mode;
      throw new Error(`Modo de iluminación desconocido: ${String(unreachable)}`);
    }
  }
}

/** El tema de las superficies de la landing y del acceso: oscuro cuando la mezcla de noche pasa de 0,5 (D-F2). */
export function surfaceTheme(night: number): 'dark' | 'light' {
  return night > 0.5 ? 'dark' : 'light';
}

// ------------------------------------------------------------------------------------------------------------------
// Estado compartido de la pestaña: el botón (en la cabecera y en el menú estrecho), el mundo y las superficies leen el
// mismo modo y el mismo avance, y se enteran del cambio sin recargar. El modo se lee del almacenamiento una sola vez.

const listeners = new Set<() => void>();
let mode: WorldMode | null = null;
let progress = 0;
let reduced = false;

const notify = () => listeners.forEach((l) => l());

export function subscribeWorld(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getWorldMode(getStorage: () => PreferenceStorage | null | undefined): WorldMode {
  if (mode === null) mode = readWorldMode(getStorage);
  return mode;
}

export function setWorldMode(getStorage: () => PreferenceStorage | null | undefined, next: WorldMode): WorldModeWriteResult {
  mode = next;
  const result = writeWorldMode(getStorage, next);
  notify();
  return result;
}

/** El mundo publica el avance del scroll y si hay "reducir movimiento"; solo avisa si algo cambió. */
export function setWorldProgress(next: number, reducedMotion: boolean): void {
  if (next === progress && reducedMotion === reduced) return;
  progress = next;
  reduced = reducedMotion;
  notify();
}

export function getWorldNight(getStorage: () => PreferenceStorage | null | undefined): number {
  return worldNight(getWorldMode(getStorage), progress, reduced);
}

/** Solo para los tests: vuelve al estado inicial. */
export function resetWorldStateForTests(): void {
  mode = null; progress = 0; reduced = false; listeners.clear();
}
