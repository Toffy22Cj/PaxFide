// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F2 y §4 F-A1; Documentos/paxfide-landing.html (getAutoNight, updateThemeUI).
// Control de iluminación para la landing y el acceso: Auto (sigue el recorrido), Noche y Día.

export type WorldMode = 'auto' | 'night' | 'day';

export const WORLD_MODE_STORAGE_KEY = 'paxfide.world-mode';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Curva del boceto: día en parada 1 (0..1), ocaso en 2..3, noche en la 4 (3..4), vuelta al día en la 5. */
export function getAutoNight(u: number): number {
  if (u <= 1) return lerp(0, 0.12, u);
  if (u <= 2) return lerp(0.12, 0.65, u - 1);
  if (u <= 3) return lerp(0.65, 1.0, u - 2);
  if (u <= 4) return lerp(1.0, 0.15, u - 3);
  return lerp(0.15, 0, clamp01(u - 4));
}

/** Calcula el valor de noche (0 = día, 1 = noche) según el modo y la posición del recorrido. */
export function calculateNightVal(mode: WorldMode, u: number): number {
  if (mode === 'night') return 1;
  if (mode === 'day') return 0;
  return getAutoNight(u);
}

/** Siguiente modo en el ciclo: auto -> night -> day -> auto. */
export function nextWorldMode(current: WorldMode): WorldMode {
  if (current === 'auto') return 'night';
  if (current === 'night') return 'day';
  return 'auto';
}

export type WorldModeIcon = 'sun' | 'sunset' | 'moon';

export interface WorldModeUI {
  text: string;
  icon: WorldModeIcon;
  ariaLabel: string;
}

/** Textos del boceto (updateThemeUI): 'Auto (Día)', 'Auto (Ocaso)', 'Auto (Noche)', 'Día', 'Noche'. */
export function worldModeUI(mode: WorldMode, nightVal: number): WorldModeUI {
  if (mode === 'night') {
    return {
      text: 'Noche',
      icon: 'moon',
      ariaLabel: 'Modo de iluminación: Noche fija. Pulsa para cambiar a Día.',
    };
  }
  if (mode === 'day') {
    return {
      text: 'Día',
      icon: 'sun',
      ariaLabel: 'Modo de iluminación: Día fijo. Pulsa para cambiar a Automático.',
    };
  }
  let tx = 'Auto (Día)';
  let ic: WorldModeIcon = 'sun';
  if (nightVal >= 0.7) {
    tx = 'Auto (Noche)';
    ic = 'moon';
  } else if (nightVal >= 0.3) {
    tx = 'Auto (Ocaso)';
    ic = 'sunset';
  }
  return {
    text: tx,
    icon: ic,
    ariaLabel: `Modo de iluminación: ${tx} (sigue el recorrido). Pulsa para alternar a Noche o Día.`,
  };
}

/** Lee la preferencia guardada en localStorage (con try/catch per D-F2). */
export function readSavedWorldMode(): WorldMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = window.localStorage.getItem(WORLD_MODE_STORAGE_KEY);
    if (raw === 'auto' || raw === 'night' || raw === 'day') return raw;
  } catch {}
  return 'auto';
}

/** Guarda la preferencia en localStorage (con try/catch per D-F2). */
export function saveWorldMode(mode: WorldMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WORLD_MODE_STORAGE_KEY, mode);
  } catch {}
}

/**
 * U-30 (plan-fase7-puesta-al-dia.md Anexo 4): almacén del modo para `useSyncExternalStore`. El acceso lee el modo
 * guardado antes del primer pintado (sin un fotograma con el modo equivocado) y se entera de los cambios.
 */
const WORLD_MODE_EVENT = 'paxfide:world-mode-change';

export function subscribeWorldMode(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === WORLD_MODE_STORAGE_KEY) listener(); };
  window.addEventListener(WORLD_MODE_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(WORLD_MODE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Guarda el modo y avisa a quien lo lea con `subscribeWorldMode`. */
export function setWorldModePreference(mode: WorldMode): void {
  saveWorldMode(mode);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(WORLD_MODE_EVENT));
}

/**
 * Se ejecuta en el HTML, antes de pintar: pone en el contenedor del acceso el `data-theme` del modo guardado (en Auto,
 * la parada del acceso es de día). Con el almacenamiento bloqueado, se queda en claro, como 'auto'.
 */
export function accessThemeInitScript(rootId: string): string {
  return `(function(){try{var m=localStorage.getItem(${JSON.stringify(WORLD_MODE_STORAGE_KEY)});var r=document.getElementById(${JSON.stringify(rootId)});if(r&&m==='night')r.setAttribute('data-theme','dark');}catch(e){}})();`;
}
