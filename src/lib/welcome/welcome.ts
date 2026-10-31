// Ref: plan-fase7-puesta-al-dia.md Anexo 2, U-15 y U-16 (bienvenida grande y fiable; sustituye el disparador de D-F10).
// Lógica pura salvo el acceso a `localStorage`, que va siempre con try/catch.
import type { PersonalProfile } from '../api/account';
import type { NavIcon } from '../nav/navEntries';

/** U-16: la clave lleva solo el `accountId` (opaco); nunca el correo ni el nombre. */
export const WELCOME_KEY_PREFIX = 'paxfide.welcome-done.';
export const welcomeKey = (accountId: string) => `${WELCOME_KEY_PREFIX}${accountId}`;

/** Almacén mínimo (inyectable en las pruebas). */
export type WelcomeStorage = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): WelcomeStorage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

/** `true`/`false` si se pudo leer; `null` si el almacenamiento falla. */
export function readWelcomeDone(accountId: string, storage: WelcomeStorage | null = defaultStorage()): boolean | null {
  if (!storage) return null;
  try { return storage.getItem(welcomeKey(accountId)) === '1'; } catch { return null; }
}

/** Guarda el cierre ("Saltar", "Después" o "Guardar"). Devuelve si se pudo guardar. */
export function markWelcomeDone(accountId: string, storage: WelcomeStorage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try { storage.setItem(welcomeKey(accountId), '1'); return true; } catch { return false; }
}

// Si el almacenamiento falla, se muestra una sola vez por sesión (U-16): en memoria, por cuenta
const shownThisSession = new Set<string>();
export function markShownThisSession(accountId: string) { shownThisSession.add(accountId); }
export function _resetWelcomeForTest() { shownThisSession.clear(); }

/**
 * U-16: sale si la cuenta no tiene nombre y en este navegador no se cerró antes para esa cuenta. Sin `accountId` o sin
 * perfil leído no se decide nada (no sale).
 */
export function shouldShowWelcome(input: {
  accountId: string | null | undefined;
  profile: PersonalProfile | null;
  storage?: WelcomeStorage | null;
}): boolean {
  const { accountId, profile } = input;
  if (!accountId || !profile) return false;
  if (profile.givenName || profile.familyName) return false;
  const done = readWelcomeDone(accountId, input.storage === undefined ? defaultStorage() : input.storage);
  if (done === true) return false;
  if (done === null) return !shownThisSession.has(accountId);
  return true;
}

/** U-15, paso 2: una línea por entrada de la barra que la cuenta ve de verdad (`navEntriesFor`). */
export function navEntryLine(id: NavIcon): string {
  switch (id) {
    case 'inicio': return 'Tu resumen: donaciones, convocatorias y tu impacto.';
    case 'explorar': return 'Convocatorias verificadas que puedes apoyar.';
    case 'donaciones': return 'Lo que donaste y su comprobante.';
    case 'seguimiento': return 'El recorrido de una donación con su código.';
    case 'organizacion': return 'Convocatorias, lotes y personas de tu organización.';
    case 'convocatorias': return 'Las convocatorias de tu organización.';
    case 'lotes': return 'Los lotes que registra y mueve tu organización.';
    case 'perfil': return 'Tus datos, la apariencia y la seguridad de la cuenta.';
    case 'ajustes': return 'Ajustes de la aplicación.';
    case 'qr': return 'Escanea el código de un lote.';
    default: { const unreachable: never = id; return String(unreachable); }
  }
}
