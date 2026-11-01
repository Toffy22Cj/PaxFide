'use client';

// Ref: plan-fase7-puesta-al-dia.md Anexo 6, G-W1 a G-W3 y G-W5. El botón oficial de Google Identity Services
// (`renderButton`, ventana emergente). Entrega el `credential` (un ID token de Google) a quien lo usa; la web nunca lo
// guarda ni lo registra. Sin `NEXT_PUBLIC_GOOGLE_CLIENT_ID` no se pinta nada y el script no se carga.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { googleClientId, loadGoogleIdentity, type GoogleIdApi } from '../../lib/google/gis';
import s from './GoogleButton.module.css';

type Props = {
  onCredential: (idToken: string) => void;
  /** "Continuar con Google" en el acceso; "Iniciar sesión con Google" al vincular. */
  text?: 'continue_with' | 'signin_with';
  /** Para los tests: sustituye a la carga del script. */
  loader?: () => Promise<GoogleIdApi>;
  clientId?: string | null;
};

/** Tema del contenedor más cercano con `data-theme`; si no hay, la preferencia del sistema. */
function darkAt(el: HTMLElement): boolean {
  const themed = el.closest('[data-theme]');
  const t = themed?.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function GoogleButton({ onCredential, text = 'continue_with', loader = loadGoogleIdentity, clientId }: Props) {
  const id = clientId === undefined ? googleClientId() : clientId;
  const slot = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);

  const render = useCallback(async (cancelled: () => boolean) => {
    if (!id) return;
    setState('loading');
    let api: GoogleIdApi;
    try {
      api = await loader();
    } catch {
      if (!cancelled()) setState('failed');
      return;
    }
    const el = slot.current;
    if (cancelled() || !el) return;
    api.initialize({
      client_id: id,
      callback: (response) => { if (response.credential) callback.current(response.credential); },
      ux_mode: 'popup',
      auto_select: false,
      itp_support: true,
    });
    el.replaceChildren();
    const width = Math.max(200, Math.min(400, Math.floor(el.clientWidth || 320)));
    api.renderButton(el, {
      type: 'standard', theme: darkAt(el) ? 'filled_black' : 'outline', size: 'large', text, shape: 'pill', locale: 'es', width,
    });
    setState('ready');
  }, [id, loader, text]);

  useEffect(() => {
    let off = false;
    void render(() => off);
    return () => { off = true; };
  }, [render, attempt]);

  if (!id) return null;
  return (
    <div className={s.wrap} data-testid="google-button" aria-busy={state === 'loading' || undefined}>
      <div ref={slot} className={s.slot} hidden={state === 'failed'} />
      {state === 'failed' && (
        <>
          <p className={s.failure} role="status">No pudimos cargar el botón de Google.</p>
          <button type="button" className={s.retry} onClick={() => setAttempt((n) => n + 1)}>Reintentar</button>
        </>
      )}
    </div>
  );
}

/** El separador "o" entre el formulario y el botón de Google. */
export function GoogleDivider() {
  return <div className={s.divider} aria-hidden="true">o</div>;
}
