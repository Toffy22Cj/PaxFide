// Ref: plan del paso 3 (decisión 9 de Manuel del 2026-11-15 y condición del 2026-11-16): la elección del gráfico se
// guarda en el navegador, por cuenta y por panel, con el identificador opaco de la cuenta (`accountId` de `/me`),
// nunca el correo. No es un secreto ni una autorización: solo qué tipo se dibuja. Patrón de animationPreference.ts.
import type { PreferenceStorage } from '../../lib/theme/theme';

export type ChartPanelId = 'prediction' | 'funds' | 'assets' | 'activity';
export interface ChartChoice { simple?: string; advanced?: string }

export function chartPreferenceKey(accountId: string, panel: ChartPanelId): string {
  return `paxfide.charts.v1.${accountId}.${panel}`;
}

/** Lee la elección; un valor que ya no está entre los tipos permitidos se ignora (vuelve el predeterminado). */
export function readChartChoice(getStorage: () => PreferenceStorage | null | undefined, accountId: string,
  panel: ChartPanelId, allowed: { simple: string[]; advanced: string[] }): ChartChoice {
  try {
    const raw = getStorage()?.getItem(chartPreferenceKey(accountId, panel));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      simple: typeof parsed.simple === 'string' && allowed.simple.includes(parsed.simple) ? parsed.simple : undefined,
      advanced: typeof parsed.advanced === 'string' && allowed.advanced.includes(parsed.advanced) ? parsed.advanced : undefined,
    };
  } catch {
    return {};
  }
}

export type ChartStorageError = 'StorageUnavailable' | 'StorageWriteFailed';

export function writeChartChoice(getStorage: () => PreferenceStorage | null | undefined, accountId: string,
  panel: ChartPanelId, choice: ChartChoice): { ok: true } | { ok: false; error: ChartStorageError } {
  let storage: PreferenceStorage | null | undefined;
  try { storage = getStorage(); } catch { return { ok: false, error: 'StorageUnavailable' }; }
  if (!storage) return { ok: false, error: 'StorageUnavailable' };
  try {
    storage.setItem(chartPreferenceKey(accountId, panel), JSON.stringify(choice));
    return { ok: true };
  } catch {
    return { ok: false, error: 'StorageWriteFailed' };
  }
}

/** El almacenamiento del navegador, si existe y se puede leer (modo privado, cookies bloqueadas → null). */
export function browserStorage(): PreferenceStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
