// Ref: prompts-agentes-estilo-v2.md §4 (COLOR, CONTRASTE Y TEMA) y VS-0; decisiones-delegadas-web-fase7.md DF7-10.
/**
 * Preferencia de tema. `system` = sin `data-theme` (manda prefers-color-scheme); `light`/`dark` la fuerzan.
 * La preferencia no es un secreto (D2 no aplica) y vive en localStorage; todo acceso va con try/catch porque el
 * almacenamiento puede no existir o lanzar (modo privado, cookies bloqueadas).
 */
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
export const THEME_STORAGE_KEY = 'paxfide.theme';

/** Fallos con nombre (regla de código 4). */
export type ThemeStorageError = 'StorageUnavailable' | 'StorageWriteFailed';
export type ThemeWriteResult = { ok: true } | { ok: false; error: ThemeStorageError };

/** Lo mínimo de `Storage` que se usa: permite probar sin DOM. */
export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** Lo mínimo de `<html>` que se usa. */
export type ThemeRoot = Pick<Element, 'setAttribute' | 'removeAttribute'>;

export function parsePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

/** `getStorage` puede lanzar (acceder a `window.localStorage` lanza con el almacenamiento bloqueado). */
export function readPreference(getStorage: () => PreferenceStorage | null | undefined): ThemePreference {
  try {
    const storage = getStorage();
    return storage ? parsePreference(storage.getItem(THEME_STORAGE_KEY)) : 'system';
  } catch {
    return 'system';
  }
}

export function writePreference(
  getStorage: () => PreferenceStorage | null | undefined,
  preference: ThemePreference,
): ThemeWriteResult {
  let storage: PreferenceStorage | null | undefined;
  try {
    storage = getStorage();
  } catch {
    return { ok: false, error: 'StorageUnavailable' };
  }
  if (!storage) return { ok: false, error: 'StorageUnavailable' };
  try {
    if (preference === 'system') storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, preference);
    return { ok: true };
  } catch {
    return { ok: false, error: 'StorageWriteFailed' };
  }
}

export function applyPreference(root: ThemeRoot, preference: ThemePreference): void {
  switch (preference) {
    case 'light':
    case 'dark':
      root.setAttribute('data-theme', preference);
      return;
    case 'system':
      root.removeAttribute('data-theme');
      return;
    default: {
      const unreachable: never = preference;
      throw new Error(`Preferencia de tema desconocida: ${String(unreachable)}`);
    }
  }
}

export function preferenceLabel(preference: ThemePreference): string {
  switch (preference) {
    case 'system':
      return 'Como el sistema';
    case 'light':
      return 'Claro';
    case 'dark':
      return 'Oscuro';
    default: {
      const unreachable: never = preference;
      throw new Error(`Preferencia de tema desconocida: ${String(unreachable)}`);
    }
  }
}

/**
 * Script que se ejecuta en <head> antes de pintar, para que una preferencia forzada no parpadee.
 * Es la misma lógica que `readPreference` + `applyPreference`, autocontenida porque corre antes de React.
 */
export const THEME_INIT_SCRIPT =
  `try{var t=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
  `if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}`;
