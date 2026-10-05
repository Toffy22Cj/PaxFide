export type MachineState = 'RESTORING' | 'LOGGED_OUT' | 'AUTHENTICATED';

type Listener = (state: MachineState) => void;

let currentState: MachineState = 'RESTORING';
let jwt: string | null = null;
let postLoginDestination: string | null = null;
const listeners: Set<Listener> = new Set();

const LOGOUT_CHANNEL_NAME = 'paxfide_logout_signal';
let channel: BroadcastChannel | null = null;

if (typeof window !== 'undefined') {
  channel = new BroadcastChannel(LOGOUT_CHANNEL_NAME);
  channel.onmessage = (event) => {
    if (event.data === 'LOGOUT_SIGNAL') {
      executeLogout(false);
    }
  };
  // RESTORING resuelve de inmediato a LOGGED_OUT en web
  currentState = 'LOGGED_OUT';

  if (process.env.NEXT_PUBLIC_E2E_BUILD) {
    (window as any).__TEST_SESSION__ = { login: (t: string) => login(t), logout };
  }
} else {
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
  setState('AUTHENTICATED');
}

export function logout() {
  executeLogout(true);
}

function executeLogout(broadcast: boolean) {
  jwt = null;
  postLoginDestination = null;
  setState('LOGGED_OUT');
  if (broadcast && channel) {
    channel.postMessage('LOGOUT_SIGNAL');
  }
}

export function getJwt() {
  return jwt;
}

export function handle401(isTrackingRoute: boolean) {
  if (isTrackingRoute) {
    return; // el 401 de tracking no toca la sesión
  }
  if (jwt) {
    // T-1 expiration: local logout sin emitir señal (borra JWT y destino)
    executeLogout(false);
  }
}

export function setPostLoginDestination(path: string) {
  postLoginDestination = path;
}

export function consumePostLoginDestination() {
  const dest = postLoginDestination;
  postLoginDestination = null;
  return dest;
}

export function _resetForTest() {
  currentState = 'RESTORING';
  jwt = null;
  postLoginDestination = null;
  if (typeof window !== 'undefined') {
    currentState = 'LOGGED_OUT';
  }
}

export function _simulateChannelMessageForTest() {
  if (channel && channel.onmessage) {
    channel.onmessage({ data: 'LOGOUT_SIGNAL' } as any);
  }
}
