export type MachineState = 'RESTORING' | 'LOGGED_OUT' | 'AUTHENTICATED';
/**
 * `PASSWORD_CHANGED`: el cambio de contraseña se confirmó pero la respuesta no trajo token (500 tras confirmar,
 * referencia-api-v1.md §1, nota R-3 + R-2); `DEACTIVATED`: la persona desactivó su cuenta (D6). Ref:
 * plan-fase7-puesta-al-dia.md P-1.
 */
export type LogoutReason = 'MANUAL' | 'EXPIRED' | 'OTHER_TAB' | 'PASSWORD_CHANGED' | 'DEACTIVATED';

type Listener = (state: MachineState) => void;

let currentState: MachineState = 'RESTORING';
let jwt: string | null = null;
let postLoginDestination: string | null = null;
let lastLogoutReason: LogoutReason | null = null;
// U-18 (plan-fase7-puesta-al-dia.md A2.5): tras "Cerrar sesión", la web va a /login sin guardar destino. Queda
// pendiente hasta que la ruta de acceso se monte (o la sesión vuelva), para que ninguna pasada de RouteGuard lo guarde
let logoutNavigationPending = false;
// Último principal leído de GET /me (ficha N1). Solo en memoria y solo para no parpadear entre páginas
// (D-N1-3): cada página que lo necesita lo vuelve a pedir. Nunca autoriza nada.
let lastPrincipal: unknown = null;
const listeners: Set<Listener> = new Set();

const LOGOUT_CHANNEL_NAME = 'paxfide_logout_signal';
let channel: BroadcastChannel | null = null;

if (typeof window !== 'undefined') {
  channel = new BroadcastChannel(LOGOUT_CHANNEL_NAME);
  channel.onmessage = (event) => {
    if (event.data === 'LOGOUT_SIGNAL') {
      executeLogout(false, 'OTHER_TAB');
    }
  };
  // RESTORING resuelve de inmediato a LOGGED_OUT en web
  currentState = 'LOGGED_OUT';

  if (process.env.NEXT_PUBLIC_E2E_BUILD) {
    (window as any).__TEST_SESSION__ = { login: (t: string) => login(t), logout };
  }
}

function notify() {
  listeners.forEach((l) => l(currentState));
}

function setState(newState: MachineState) {
  if (currentState !== newState) {
    currentState = newState;
    notify();
  }
}

export function getState() {
  return currentState;
}

export function subscribe(listener: Listener) {
  listener(currentState);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function login(token: string) {
  jwt = token;
  logoutNavigationPending = false;
  lastPrincipal = null;
  lastLogoutReason = null;
  setState('AUTHENTICATED');
}

export function logout() {
  executeLogout(true, 'MANUAL');
}

/** Cierre por un motivo propio (P-1): el texto lo pone el login. */
export function logoutWith(reason: Exclude<LogoutReason, 'EXPIRED' | 'OTHER_TAB'>) {
  executeLogout(true, reason);
}

/**
 * P-1 (referencia-api-v1.md §1, `POST /account/password`): la respuesta trae un token nuevo que sustituye al de la
 * sesión en memoria (D2); las demás sesiones quedan revocadas. Sin sesión no hace nada.
 */
export function replaceToken(token: string) {
  if (currentState !== 'AUTHENTICATED') return;
  jwt = token;
}

/** Un aviso para la próxima pantalla de login (p. ej. tras recuperar la contraseña). Solo en memoria. */
let loginNotice: string | null = null;
export function setLoginNotice(text: string) { loginNotice = text; }
export function peekLoginNotice(): string | null { return loginNotice; }
export function clearLoginNotice() { loginNotice = null; }

function executeLogout(broadcast: boolean, reason: LogoutReason) {
  logoutNavigationPending = reason === 'MANUAL';
  jwt = null;
  lastPrincipal = null;
  postLoginDestination = null;
  lastLogoutReason = reason;
  setState('LOGGED_OUT');
  if (broadcast && channel) {
    channel.postMessage('LOGOUT_SIGNAL');
  }
}

/** U-18: hay un cierre voluntario cuya navegación a /login no ha terminado. */
export function isLogoutNavigationPending(): boolean {
  return logoutNavigationPending;
}

/** U-18: la ruta de acceso ya está en pantalla. */
export function clearLogoutNavigation(): void {
  logoutNavigationPending = false;
}

export function getJwt() {
  return jwt;
}

export function setLastPrincipal(principal: unknown) {
  if (jwt) lastPrincipal = principal;
}

export function getLastPrincipal(): unknown {
  return lastPrincipal;
}

export function getLastLogoutReason() {
  return lastLogoutReason;
}

export function handle401(isTrackingRoute: boolean) {
  if (isTrackingRoute) {
    return; // el 401 de tracking no toca la sesión
  }
  if (jwt) {
    // T-1 expiration: local logout sin emitir señal (borra JWT y destino)
    executeLogout(false, 'EXPIRED');
  }
}

export function setPostLoginDestination(path: string) {
  postLoginDestination = path;
}

export function getPostLoginDestination(): string | null {
  return postLoginDestination;
}

export function consumePostLoginDestination() {
  const dest = postLoginDestination;
  postLoginDestination = null;
  return dest;
}

export function _resetForTest() {
  loginNotice = null;
  currentState = 'RESTORING';
  jwt = null;
  postLoginDestination = null;
  lastLogoutReason = null;
  lastPrincipal = null;
  logoutNavigationPending = false;
  if (typeof window !== 'undefined') {
    currentState = 'LOGGED_OUT';
  }
}

export function _simulateChannelMessageForTest() {
  if (channel && channel.onmessage) {
    channel.onmessage({ data: 'LOGOUT_SIGNAL' } as any);
  }
}
