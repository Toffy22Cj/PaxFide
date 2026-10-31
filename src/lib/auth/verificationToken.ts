'use client';

/**
 * Token de verificación del correo (ADR-050 Enmienda 2; referencia-api-v1.md §1, nota del 2026-10-29;
 * plan-fase7-puesta-al-dia.md P-6). Llega en el **fragmento** (`/verificar-correo#token=…`), con el mismo trato que el de
 * `/recuperar` (`resetToken.ts`) y `/invitaciones` (DW-48):
 * 1. se lee del fragmento;
 * 2. se borra de la barra con `history.replaceState` **antes de cualquier otra cosa**;
 * 3. vive solo en esta variable de módulo (nunca en almacenamiento, cookies, URL, logs ni analítica);
 * 4. viaja solo en el cuerpo de `POST /auth/email-verification/confirm`.
 */
let token: string | null = null;

/** Lee el token del fragmento, lo borra de la barra y lo guarda en memoria. Devuelve si había uno. */
export function captureVerificationToken(): boolean {
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

/** Devuelve el token y lo descarta: se usa una sola vez. */
export function takeVerificationToken(): string | null {
  const t = token;
  token = null;
  return t;
}
