'use client';

// Ref: plan-fase7-puesta-al-dia.md Anexo 6, G-W1 y G-W2. El script de Google Identity Services es la única excepción a
// D8 y solo se carga donde hay un botón de Google (el acceso y "Vincular Google"). Una carga por pestaña; un fallo deja
// volver a intentarlo. Nunca One Tap ni `prompt()`: solo el botón oficial.

export const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/** Lo poco de `google.accounts.id` que usa la web. */
export interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    ux_mode?: 'popup';
    auto_select?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: {
    type?: 'standard';
    theme?: 'outline' | 'filled_black';
    size?: 'large';
    text?: 'continue_with' | 'signin_with';
    shape?: 'pill';
    locale?: string;
    width?: number;
  }): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

/** G-W1: el ID de cliente web, fijado al construir. Sin él no hay botones de Google ni se carga el script. */
export function googleClientId(): string | null {
  const id = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '').trim();
  return id ? id : null;
}

/** En el build de los E2E, un doble del script servido por el servidor falso: el E2E nunca sale a Google. */
function scriptUrl(): string {
  if (process.env.NEXT_PUBLIC_E2E_BUILD && process.env.NEXT_PUBLIC_E2E_GIS_URL) return process.env.NEXT_PUBLIC_E2E_GIS_URL;
  return GIS_SCRIPT_URL;
}

let loading: Promise<GoogleIdApi> | null = null;

export function loadGoogleIdentity(): Promise<GoogleIdApi> {
  if (loading) return loading;
  loading = new Promise<GoogleIdApi>((resolve, reject) => {
    const ready = () => {
      const api = window.google?.accounts?.id;
      if (api) resolve(api); else reject(new Error('Google Identity Services no está disponible'));
    };
    if (window.google?.accounts?.id) { ready(); return; }
    const script = document.createElement('script');
    script.src = scriptUrl();
    script.async = true;
    script.defer = true;
    script.onload = ready;
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
    document.head.appendChild(script);
  }).catch((e: unknown) => {
    loading = null;
    document.querySelectorAll(`script[src="${scriptUrl()}"]`).forEach((n) => n.remove());
    throw e;
  });
  return loading;
}

export function _resetGoogleIdentityForTest(): void {
  loading = null;
}
