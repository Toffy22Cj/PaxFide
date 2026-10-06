import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as session from '../src/lib/auth/session';

describe('Session Machine (T-3)', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;
  let localStorageSpy: ReturnType<typeof vi.spyOn>;
  let sessionStorageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    session._resetForTest();
    postMessageSpy = vi.spyOn(BroadcastChannel.prototype, 'postMessage');
    localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
    sessionStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
    // document.cookie and indexedDB are checked in specific tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inicia en LOGGED_OUT por resolución inmediata de RESTORING', () => {
    expect(session.getState()).toBe('LOGGED_OUT');
  });

  it('login cambia estado a AUTHENTICATED y guarda el JWT solo en memoria', () => {
    session.login('my-jwt');
    expect(session.getState()).toBe('AUTHENTICATED');
    expect(session.getJwt()).toBe('my-jwt');
    
    // Verificamos que no se persiste (no está en localStorage/sessionStorage)
    // El DoD dice "no hacer: ningún almacenamiento del navegador"
    expect(typeof window !== 'undefined' ? window.localStorage.length : 0).toBe(0);
  });

  it('logout borra el JWT, el destino, y emite la señal de logout por BroadcastChannel con motivo MANUAL', () => {
    session.setPostLoginDestination('/panel');
    session.login('token');
    session.logout();
    
    expect(session.getState()).toBe('LOGGED_OUT');
    expect(session.getJwt()).toBeNull();
    expect(session.consumePostLoginDestination()).toBeNull();
    expect(session.getLastLogoutReason()).toBe('MANUAL');
    
    // El mensaje entre pestañas no contiene el token ni el motivo
    expect(postMessageSpy).toHaveBeenCalledWith('LOGOUT_SIGNAL');
    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    
    // Aserción negativa: ninguna API de almacenamiento
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();
  });

  it('el destino post-login retenido es de consumo único', () => {
    session.setPostLoginDestination('/panel');
    const dest1 = session.consumePostLoginDestination();
    const dest2 = session.consumePostLoginDestination();
    expect(dest1).toBe('/panel');
    expect(dest2).toBeNull();
  });

  it('el 401 de tracking no toca la sesión ni asigna motivo', () => {
    session.login('token');
    session.setPostLoginDestination('/panel');
    
    session.handle401(true); // isTrackingRoute = true
    
    expect(session.getState()).toBe('AUTHENTICATED');
    expect(session.getJwt()).toBe('token');
    expect(session.getLastLogoutReason()).toBeNull();
  });

  it('T-1 (401 con JWT fuera de tracking) causa logout local con motivo EXPIRED sin señal', () => {
    session.login('token');
    session.setPostLoginDestination('/panel');
    
    session.handle401(false); // isTrackingRoute = false
    
    expect(session.getState()).toBe('LOGGED_OUT');
    expect(session.getJwt()).toBeNull();
    expect(session.consumePostLoginDestination()).toBeNull();
    expect(session.getLastLogoutReason()).toBe('EXPIRED');
    
    // T-1 no emite la señal de logout
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('la señal de logout proveniente de otra pestaña cierra la sesión local con motivo OTHER_TAB', () => {
    session.login('token');
    session.setPostLoginDestination('/assets/123');
    
    const senderChannel = new BroadcastChannel('paxfide_logout_signal');
    senderChannel.postMessage('LOGOUT_SIGNAL');
    
    session._simulateChannelMessageForTest();
    
    expect(session.getState()).toBe('LOGGED_OUT');
    expect(session.getJwt()).toBeNull();
    expect(session.consumePostLoginDestination()).toBeNull();
    expect(session.getLastLogoutReason()).toBe('OTHER_TAB');
    
    expect(postMessageSpy).toHaveBeenCalledTimes(1); 
  });

  it('no invoca APIs de almacenamiento al iniciar sesión, cerrar sesión o recibir señal', () => {
    // Espías sobre document.cookie e indexedDB
    const cookieSpy = vi.spyOn(document, 'cookie', 'set');
    // Mock for indexedDB (doesn't exist in jsdom by default but let's check window.indexedDB)
    const indexedDBSpy = window.indexedDB ? vi.spyOn(window.indexedDB, 'open') : null;

    session.login('token');
    session.logout();
    session._simulateChannelMessageForTest();

    expect(cookieSpy).not.toHaveBeenCalled();
    if (indexedDBSpy) expect(indexedDBSpy).not.toHaveBeenCalled();
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();
  });
});
