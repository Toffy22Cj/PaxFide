'use client';

/**
 * Token de recuperación de la contraseña (referencia-api-v1.md §1, nota del 2026-10-25 de R-4; ADR-050 D8;
 * plan-fase7-puesta-al-dia.md P-1). Llega en el **fragmento** (`/recuperar#token=…`), que el navegador no envía. Igual
 * que el de `/invitaciones` (DW-48):
 * 1. se lee del fragmento;
 * 2. se borra de la barra con `history.replaceState` **antes de cualquier otra cosa**;
 * 3. vive solo en esta variable de módulo (nunca en almacenamiento, cookies, URL, logs ni analítica);
 * 4. viaja solo en el cuerpo de `POST /auth/password-reset/confirm`.
 * Se descarta al confirmar, al recibir `PasswordResetTokenInvalid` y al recargar la página.
 */
let token: string | null = null;

/** Lee el token del fragmento, lo borra de la barra y lo guarda en memoria. Devuelve si había uno. */
export function captureResetToken(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return false;
  // El fragmento entero se borra en cualquier caso: nunca queda un token (válido o no) en la barra
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  const value = new URLSearchParams(hash.slice(1)).get('token');
  if (!value || value.length > 4096) return false;
  token = value;
  return true;
}

export function getResetToken(): string | null {
  return token;
}

export function clearResetToken() {
  token = null;
}
