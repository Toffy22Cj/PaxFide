'use client';

// Ref: referencia-api-v1.md §1 (cuenta, perfil, contraseña, desactivación y recuperación; notas del 2026-10-25);
// plan-fase7-puesta-al-dia.md P-1. Ninguna de estas rutas lleva `Command-Id`. Las contraseñas, el token de
// recuperación y el nombre solo viajan en el cuerpo y nunca se registran.
import { apiRequest } from './http';

/** `GET /account/donations` (B6-b; ADR-048): sin seudónimo ni `donorRef`; `trackingCode` solo con fondos aplicados. */
export interface AccountDonation {
  intentId: string;
  campaignTitle?: string;
  amount: string;
  currency?: string;
  status: string;
  trackingCode?: string;
  /** Nota del 2026-10-22 (§1, Enmienda 5 de ADR-037): falta en intenciones anteriores a la enmienda. */
  createdAt?: string;
  confirmedAt?: string;
  organizationName?: string;
  /** `GATEWAY`, `BANK_TRANSFER` o `CASH`; siempre en el contrato (vacío si faltara). */
  paymentMethod?: string;
  /** Solo si la convocatoria es `PUBLIC` al leer; una `PRIVATE_LINK` nunca lo trae (ADR-041 §2.7). */
  publicCode?: string;
}

export type AccountDonationsOutcome =
  | { kind: 'ok'; items: AccountDonation[] }
  | { kind: 'forbidden' }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

const opt = (v: unknown) => (typeof v === 'string' ? v : undefined);

export async function fetchAccountDonations(): Promise<AccountDonationsOutcome> {
  const r = await apiRequest<{ items?: unknown }>({ path: '/account/donations', auth: 'required' });
  if (r.kind === 'ok') {
    const items = r.data?.items;
    if (!Array.isArray(items)) return { kind: 'error' };
    return {
      kind: 'ok',
      items: items.filter((i) => i && typeof i.intentId === 'string' && typeof i.amount === 'string' && typeof i.status === 'string')
        .map((i) => ({
          intentId: i.intentId, campaignTitle: opt(i.campaignTitle), amount: i.amount, currency: opt(i.currency),
          status: i.status, trackingCode: opt(i.trackingCode), createdAt: opt(i.createdAt), confirmedAt: opt(i.confirmedAt),
          organizationName: opt(i.organizationName), paymentMethod: opt(i.paymentMethod), publicCode: opt(i.publicCode),
        })),
    };
  }
  if (r.kind === 'error' && r.status === 401) return { kind: 'unauthorized' };
  if (r.kind === 'error' && r.status === 403) return { kind: 'forbidden' };
  return { kind: 'error' };
}

/** `GET /account` (D-F9): datos básicos de la cuenta autenticada. */
export interface AccountProfile {
  accountId: string;
  email: string;
  /** ADR-050 Enmienda 2 (nota del 2026-10-29): `false` → aviso con "Reenviar" en el Perfil. Sin el campo, no se sabe. */
  emailVerified?: boolean;
}

export type FetchAccountOutcome =
  | { kind: 'ok'; account: AccountProfile }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

export async function fetchAccount(): Promise<FetchAccountOutcome> {
  const r = await apiRequest<{ accountId?: unknown; email?: unknown; emailVerified?: unknown }>({ path: '/account', auth: 'required' });
  if (r.kind === 'ok' && r.data && typeof r.data.email === 'string') {
    return {
      kind: 'ok',
      account: {
        accountId: typeof r.data.accountId === 'string' ? r.data.accountId : '',
        email: r.data.email,
        ...(typeof r.data.emailVerified === 'boolean' ? { emailVerified: r.data.emailVerified } : {}),
      },
    };
  }
  if (r.kind === 'error' && r.status === 401) return { kind: 'unauthorized' };
  return { kind: 'error' };
}

/** Mínimo del backend (`PasswordTooShort`, ADR-050). */
export const MIN_PASSWORD = 12;
/** `PUT /account/profile`: de 1 a 100 puntos de código tras recortar (un emoji cuenta uno). */
export const MAX_NAME = 100;

/** `POST /account/password`: el token de la respuesta sustituye al de la sesión (lo hace quien llama). */
export type ChangePasswordOutcome =
  | { kind: 'ok'; token: string }
  | { kind: 'current-incorrect' }
  | { kind: 'too-short' }
  | { kind: 'bad-request' }
  /** 500 tras confirmar: la contraseña SÍ cambió y todas las sesiones quedaron revocadas (nota ADR-038 #7). */
  | { kind: 'changed-without-token' }
  /** Sin respuesta: no sabemos si cambió. */
  | { kind: 'network' }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

export async function changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordOutcome> {
  const r = await apiRequest<{ token?: unknown }>({
    path: '/account/password', method: 'POST', body: { currentPassword, newPassword }, auth: 'required',
  });
  if (r.kind === 'network') return { kind: 'network' };
  if (r.kind === 'ok') {
    // 200 sin token legible: el cambio se confirmó pero no podemos seguir con esta sesión
    return typeof r.data?.token === 'string' && r.data.token ? { kind: 'ok', token: r.data.token } : { kind: 'changed-without-token' };
  }
  if (r.status === 400 && r.problem.title === 'CurrentPasswordIncorrect') return { kind: 'current-incorrect' };
  if (r.status === 400 && r.problem.title === 'PasswordTooShort') return { kind: 'too-short' };
  if (r.status === 400) return { kind: 'bad-request' };
  if (r.status === 401) return { kind: 'unauthorized' };
  if (r.status === 500) return { kind: 'changed-without-token' };
  return { kind: 'error' };
}

/** `POST /account/deactivate`: 204 revoca todos los tokens, también el de esta petición. */
export type DeactivateOutcome =
  | { kind: 'ok' }
  | { kind: 'current-incorrect' }
  | { kind: 'platform-administrator' }
  | { kind: 'representative' }
  | { kind: 'campaign-responsible' }
  | { kind: 'bad-request' }
  | { kind: 'network' }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

export async function deactivateAccount(currentPassword: string): Promise<DeactivateOutcome> {
  const r = await apiRequest<unknown>({ path: '/account/deactivate', method: 'POST', body: { currentPassword }, auth: 'required' });
  if (r.kind === 'network') return { kind: 'network' };
  if (r.kind === 'ok') return { kind: 'ok' };
  const t = r.problem.title;
  if (r.status === 400 && t === 'CurrentPasswordIncorrect') return { kind: 'current-incorrect' };
  if (r.status === 400) return { kind: 'bad-request' };
  if (r.status === 409 && t === 'PlatformAdministratorDeactivation') return { kind: 'platform-administrator' };
  if (r.status === 409 && t === 'RepresentativeTransferRequired') return { kind: 'representative' };
  if (r.status === 409 && t === 'ActiveCampaignResponsible') return { kind: 'campaign-responsible' };
  if (r.status === 401) return { kind: 'unauthorized' };
  return { kind: 'error' };
}

/** `GET` y `PUT /account/profile`. El nombre es privado: solo viaja en estas dos rutas (ADR-050 D1). */
export interface PersonalProfile {
  email: string;
  givenName?: string;
  familyName?: string;
}

export type ProfileOutcome =
  | { kind: 'ok'; profile: PersonalProfile }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

function profileOf(data: unknown): PersonalProfile | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.email !== 'string') return null;
  const name = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  return { email: d.email, givenName: name(d.givenName), familyName: name(d.familyName) };
}

export async function fetchProfile(): Promise<ProfileOutcome> {
  const r = await apiRequest<unknown>({ path: '/account/profile', auth: 'required' });
  if (r.kind === 'ok') {
    const profile = profileOf(r.data);
    return profile ? { kind: 'ok', profile } : { kind: 'error' };
  }
  if (r.kind === 'error' && r.status === 401) return { kind: 'unauthorized' };
  return { kind: 'error' };
}

export type UpdateProfileOutcome =
  | ProfileOutcome
  | { kind: 'invalid' }
  | { kind: 'network' };

/** Un campo vacío se envía como `null`, que **borra** ese campo (contrato). */
export async function updateProfile(givenName: string, familyName: string): Promise<UpdateProfileOutcome> {
  const v = (x: string) => (x.trim() ? x.trim() : null);
  const r = await apiRequest<unknown>({
    path: '/account/profile', method: 'PUT', body: { givenName: v(givenName), familyName: v(familyName) }, auth: 'required',
  });
  if (r.kind === 'network') return { kind: 'network' };
  if (r.kind === 'ok') {
    const profile = profileOf(r.data);
    return profile ? { kind: 'ok', profile } : { kind: 'error' };
  }
  if (r.status === 400) return { kind: 'invalid' };
  if (r.status === 401) return { kind: 'unauthorized' };
  return { kind: 'error' };
}

/** Iniciales del boceto (`initials()`): solo con nombre; primera letra del nombre y del apellido. */
export function initialsOf(p: PersonalProfile | null): string | null {
  const first = p?.givenName ? Array.from(p.givenName.trim())[0] : undefined;
  if (!first) return null;
  const last = p?.familyName ? Array.from(p.familyName.trim())[0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Longitud en puntos de código (un emoji cuenta uno, como el backend). */
export function nameLength(v: string): number {
  return Array.from(v.trim()).length;
}

/** `POST /auth/password-reset`: siempre el mismo 202, exista o no la cuenta. */
export type ResetRequestOutcome = { kind: 'ok' } | { kind: 'bad-request' } | { kind: 'network' } | { kind: 'error' };

export async function requestPasswordReset(email: string): Promise<ResetRequestOutcome> {
  const r = await apiRequest<unknown>({ path: '/auth/password-reset', method: 'POST', body: { email }, auth: 'none' });
  if (r.kind === 'network') return { kind: 'network' };
  if (r.kind === 'ok') return { kind: 'ok' };
  if (r.status === 400) return { kind: 'bad-request' };
  return { kind: 'error' };
}

/** `POST /auth/password-reset/confirm`: 204 no inicia sesión. `PasswordTooShort` no consume el token. */
export type ResetConfirmOutcome =
  | { kind: 'ok' }
  | { kind: 'token-invalid' }
  | { kind: 'too-short' }
  | { kind: 'bad-request' }
  | { kind: 'network' }
  | { kind: 'error' };

export async function confirmPasswordReset(token: string, newPassword: string): Promise<ResetConfirmOutcome> {
  const r = await apiRequest<unknown>({
    path: '/auth/password-reset/confirm', method: 'POST', body: { token, newPassword }, auth: 'none',
  });
  if (r.kind === 'network') return { kind: 'network' };
  if (r.kind === 'ok') return { kind: 'ok' };
  if (r.status === 400 && r.problem.title === 'PasswordResetTokenInvalid') return { kind: 'token-invalid' };
  if (r.status === 400 && r.problem.title === 'PasswordTooShort') return { kind: 'too-short' };
  if (r.status === 400) return { kind: 'bad-request' };
  return { kind: 'error' };
}

/**
 * `GET /account/impact` (referencia-api-v1.md §1, nota del 2026-10-25, M-21; plan-fase7-puesta-al-dia.md P-7). Importes
 * en unidades mínimas por moneda y cantidades por unidad de medida, como texto: nunca se suman entre sí.
 */
export interface AccountImpact {
  donationsCount: number;
  totals: { currency: string; amount: string }[];
  campaignsSupported: number;
  deliveredUnits: { unitOfMeasure: string; quantity: string }[];
  truncated: boolean;
}

export type ImpactOutcome =
  | { kind: 'ok'; impact: AccountImpact }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

function impactOf(data: unknown): AccountImpact | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
  const donationsCount = count(d.donationsCount);
  const campaignsSupported = count(d.campaignsSupported);
  if (donationsCount === null || campaignsSupported === null || !Array.isArray(d.totals) || !Array.isArray(d.deliveredUnits)) return null;
  const rec = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
  return {
    donationsCount,
    campaignsSupported,
    totals: d.totals.map(rec).filter((t) => typeof t.currency === 'string' && typeof t.amount === 'string')
      .map((t) => ({ currency: t.currency as string, amount: t.amount as string })),
    deliveredUnits: d.deliveredUnits.map(rec).filter((u) => typeof u.unitOfMeasure === 'string' && typeof u.quantity === 'string')
      .map((u) => ({ unitOfMeasure: u.unitOfMeasure as string, quantity: u.quantity as string })),
    truncated: d.truncated === true,
  };
}

export async function fetchImpact(): Promise<ImpactOutcome> {
  const r = await apiRequest<unknown>({ path: '/account/impact', auth: 'required' });
  if (r.kind === 'ok') {
    const impact = impactOf(r.data);
    return impact ? { kind: 'ok', impact } : { kind: 'error' };
  }
  if (r.kind === 'error' && r.status === 401) return { kind: 'unauthorized' };
  return { kind: 'error' };
}

/**
 * `POST /auth/email-verification {email}` (ADR-050 Enmienda 2; referencia-api-v1.md §1, nota del 2026-10-29): siempre el
 * mismo 202 sin cuerpo, exista o no la cuenta y esté o no verificada (enfriamiento de 5 minutos en el servidor).
 */
export type EmailVerificationRequestOutcome = { kind: 'ok' } | { kind: 'bad-request' } | { kind: 'network' } | { kind: 'error' };

export async function requestEmailVerification(email: string): Promise<EmailVerificationRequestOutcome> {
  const r = await apiRequest<unknown>({ path: '/auth/email-verification', method: 'POST', body: { email }, auth: 'none' });
  if (r.kind === 'network') return { kind: 'network' };
  if (r.kind === 'ok') return { kind: 'ok' };
  if (r.status === 400) return { kind: 'bad-request' };
  return { kind: 'error' };
}

/**
 * `POST /auth/email-verification/confirm {token}`: 204 **no inicia sesión**; el mismo 400 `EmailVerificationTokenInvalid`
 * para un token desconocido, caducado, usado, sustituido o de una cuenta inactiva.
 */
export type EmailVerificationConfirmOutcome =
  | { kind: 'ok' }
  | { kind: 'token-invalid' }
  | { kind: 'bad-request' }
  | { kind: 'network' }
  | { kind: 'error' };

export async function confirmEmailVerification(token: string): Promise<EmailVerificationConfirmOutcome> {
  const r = await apiRequest<unknown>({ path: '/auth/email-verification/confirm', method: 'POST', body: { token }, auth: 'none' });
  if (r.kind === 'network') return { kind: 'network' };
  if (r.kind === 'ok') return { kind: 'ok' };
  if (r.status === 400 && r.problem.title === 'EmailVerificationTokenInvalid') return { kind: 'token-invalid' };
  if (r.status === 400) return { kind: 'bad-request' };
  return { kind: 'error' };
}
