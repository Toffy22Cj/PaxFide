import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as session from '../src/lib/auth/session';

describe('Session Machine (T-3)', () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    session._resetForTest();
    postMessageSpy = vi.spyOn(BroadcastChannel.prototype, 'postMessage');
  });

  afterEach(() => {
    vi.clearAllMocks();
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

  it('logout borra el JWT, el destino, y emite la señal de logout por BroadcastChannel', () => {
    session.setPostLoginDestination('/panel');
    session.login('token');
    session.logout();
    
    expect(session.getState()).toBe('LOGGED_OUT');
    expect(session.getJwt()).toBeNull();
    expect(session.consumePostLoginDestination()).toBeNull();
    
    // El mensaje entre pestañas no contiene el token
    expect(postMessageSpy).toHaveBeenCalledWith('LOGOUT_SIGNAL');
    expect(postMessageSpy).toHaveBeenCalledTimes(1);
  });

  it('el destino post-login retenido es de consumo único', () => {
    session.setPostLoginDestination('/panel');
    const dest1 = session.consumePostLoginDestination();
    const dest2 = session.consumePostLoginDestination();
    expect(dest1).toBe('/panel');
    expect(dest2).toBeNull();
  });

  it('el 401 de tracking no toca la sesión', () => {
    session.login('token');
    session.setPostLoginDestination('/panel');
    
    session.handle401(true); // isTrackingRoute = true
    
    expect(session.getState()).toBe('AUTHENTICATED');
    expect(session.getJwt()).toBe('token');
  });

  it('T-1 (401 con JWT fuera de tracking) causa logout local (borra intención) sin señal de BroadcastChannel', () => {
    session.login('token');
    session.setPostLoginDestination('/panel');
    
    session.handle401(false); // isTrackingRoute = false
    
    expect(session.getState()).toBe('LOGGED_OUT');
    expect(session.getJwt()).toBeNull();
    // "la intención en memoria se pierde"
    expect(session.consumePostLoginDestination()).toBeNull();
    
    // T-1 no emite la señal de logout
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('la señal de logout proveniente de otra pestaña cierra la sesión local sin reenviar mensaje', () => {
    session.login('token');
    session.setPostLoginDestination('/assets/123');
    
    // session exporta `_simulateChannelMessageForTest` si queremos, o podemos dispararlo
    // Dado que jsdom implementa BroadcastChannel real, si creamos otro canal con el mismo nombre y disparamos, 
    // el canal original debería recibirlo.
    const senderChannel = new BroadcastChannel('paxfide_logout_signal');
    senderChannel.postMessage('LOGOUT_SIGNAL');
    
    // Debido a jsdom events, necesitamos esperar un microtask (no sincrono) o invocar el onmessage mock
    session._simulateChannelMessageForTest();
    
    expect(session.getState()).toBe('LOGGED_OUT');
    expect(session.getJwt()).toBeNull();
    expect(session.consumePostLoginDestination()).toBeNull();
    // No debe reenviar el broadcast, de lo contrario habría loop infinito
    // Sin embargo, si postMessage fue llamado arriba, el count sera 1 (del senderChannel), pero
    // postMessageSpy atrapa a todos los BroadcastChannel. Lo ignoramos o comprobamos count = 1.
    expect(postMessageSpy).toHaveBeenCalledTimes(1); // El que acabamos de mandar nosotros
  });
});
