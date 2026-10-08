'use client';

import * as session from '../auth/session';

/**
 * Token de invitación (Autorización (2) §2.4; ADR-049 D4; DW-48). Llega en el **fragmento** del enlace del correo
 * (`/invitaciones#token=…`), que el navegador nunca envía al servidor. Al cargar:
 * 1. se lee del fragmento;
 * 2. **se borra de la barra de direcciones** con `history.replaceState` (no queda en el historial ni en marcadores);
 * 3. se guarda **solo en esta variable de módulo** (nunca en almacenamiento, cookies, URL, logs ni analítica);
 * 4. se envía en el cuerpo de `POST /invitations/accept` (D-09).
 * Se descarta al aceptarla o rechazarla, al cerrar sesión y al recargar la página.
 */
let token: string | null = null;
let previous: session.MachineState | null = null;

session.subscribe((state) => {
  // Cerrar sesión (no "no haber iniciado"): otra cuenta en esta pestaña no hereda la invitación
  if (previous === 'AUTHENTICATED' && state === 'LOGGED_OUT') token = null;
  previous = state;
});

/** Lee el token del fragmento, lo borra de la barra y lo guarda en memoria. Devuelve si había uno. */
export function captureInvitationToken(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return false;
  const value = new URLSearchParams(hash.slice(1)).get('token');
  // Se borra el fragmento entero en cualquier caso: nunca queda un token (válido o no) en la barra
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (!value || value.length > 4096) return false;
  token = value;
  return true;
}

export function getInvitationToken(): string | null {
  return token;
}

export function clearInvitationToken() {
  token = null;
}
