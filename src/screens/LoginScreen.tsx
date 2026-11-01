'use client';

// Ref: diseno-ux-contractual-web-v1.md §5.2; ID-01; ADR-038 §2.6; ADR-046 D2;
// Documentos/plan-fase7-fidelidad.md §2 D-F5 (acceso sobre el mundo), D-F10 (bienvenida), D-F2;
// Documentos/paxfide-landing.html (.auth-card, #formLogin); plan-fase7-puesta-al-dia.md R-2 y U-2 (403
// AcceptanceRequired: "Actualizamos nuestras condiciones" en la misma tarjeta; la contraseña sigue solo en el estado);
// P-1: "¿Olvidaste tu contraseña?" (→ /recuperar) y el aviso tras recuperarla. plan-fase7-puesta-al-dia.md U-16 (P-8):
// la bienvenida de D-F10 y "¿Cómo te llamamos?" salen de aquí y pasan a /home (WelcomeOverlay). P-6 (ADR-050 Enmienda 2):
// 403 EmailNotVerified → "Antes de entrar, confirma tu correo" con "Reenviar"; la contraseña sale del estado.
// Anexo 6 (G-W3): "Continuar con Google" → `POST /auth/google`, con las mismas respuestas; el `idToken` solo vive en el
// estado del intento (para repetirlo con las versiones de U-2) y nunca se guarda.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import * as session from '../lib/auth/session';
import {
  acceptanceFor, googleSignIn, login as loginRequest,
  type GoogleSignInOutcome, type LoginAcceptance, type LoginOutcome,
} from '../lib/api/identity';
import { GoogleButton, GoogleDivider } from '../components/access/GoogleButton';
import { googleClientId as configuredGoogleClientId, type GoogleIdApi } from '../lib/google/gis';
import { LegalConsent } from '../components/access/LegalConsent';
import { ResendVerification } from '../components/access/ResendVerification';
import type { EmailVerificationRequestOutcome } from '../lib/api/account';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { BrandDots } from '../components/loaders/BrandDots';
import s from './access.module.css';

type Props = {
  loginClient?: (email: string, password: string, acceptance?: LoginAcceptance) => Promise<LoginOutcome>;
  resendClient?: (email: string) => Promise<EmailVerificationRequestOutcome>;
  googleClient?: (idToken: string, acceptance?: LoginAcceptance) => Promise<GoogleSignInOutcome>;
  /** Para los tests: la carga de Google Identity Services y el ID de cliente. */
  googleLoader?: () => Promise<GoogleIdApi>;
  googleClientId?: string | null;
};

/** G-W3: un único texto para el 401 de Google, sin revelar el motivo. */
export const GOOGLE_401 = 'No pudimos entrar con Google. Si aún no vinculaste tu cuenta de Google, entra con tu correo y contraseña y vincúlala en Configuración › Seguridad.';
export const GOOGLE_503 = 'Google no responde ahora. Entra con tu correo y contraseña.';

/** El intento en curso: con la contraseña del formulario o con un `idToken` de Google. */
type Attempt = { via: 'password' } | { via: 'google'; idToken: string };

const REASON_TEXT: Record<session.LogoutReason, string | null> = {
  EXPIRED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  OTHER_TAB: 'Cerraste sesión en otra pestaña.',
  // U-18 (plan-fase7-puesta-al-dia.md A2.5)
  MANUAL: 'Cerraste sesión.',
  PASSWORD_CHANGED: 'Tu contraseña cambió; vuelve a iniciar sesión.',
  DEACTIVATED: 'Desactivaste tu cuenta. Si fue un error, pide al administrador de la plataforma que la reactive.',
};

export function LoginScreen({
  loginClient = loginRequest, resendClient, googleClient = googleSignIn, googleLoader, googleClientId,
}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [reason] = useState(() => session.getLastLogoutReason());
  // Aviso de otra pantalla (p. ej. /recuperar): se lee al montar y se borra después (StrictMode monta dos veces)
  const [notice] = useState(() => session.peekLoginNotice());
  useEffect(() => { if (notice) session.clearLoginNotice(); }, [notice]);
  /** U-2: las versiones pendientes que se aceptan al repetir el login; `unsupported` si la web no tiene ese texto. */
  const [pending, setPending] = useState<LoginAcceptance | 'unsupported' | null>(null);
  /** P-6: 403 `EmailNotVerified` (va antes que `AcceptanceRequired`): el correo al que se puede reenviar el enlace. */
  const [unverified, setUnverified] = useState<{ email: string | null } | null>(null);
  const [attempt, setAttempt] = useState<Attempt>({ via: 'password' });
  const [checks, setChecks] = useState<{ terms: boolean; data: boolean }>({ terms: false, data: false });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = 'Este campo es obligatorio.';
    if (!password) nextErrors.password = 'Este campo es obligatorio.';
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    await send({ via: 'password' });
  };

  /**
   * Envía el login; con `acceptance`, el segundo intento tras el 403 (U-2): con el mismo correo y contraseña o con el
   * mismo `idToken` de Google (G-W3).
   */
  const send = async (via: Attempt, acceptance?: LoginAcceptance) => {
    setAttempt(via);
    setSending(true);
    setFailure(null);
    const outcome: GoogleSignInOutcome = via.via === 'google'
      ? await googleClient(via.idToken, acceptance)
      : await loginClient(email.trim(), password, acceptance);
    setSending(false);
    if (outcome.kind !== 'acceptance-required') setPending(null);
    if (outcome.kind !== 'email-not-verified') setUnverified(null);
    switch (outcome.kind) {
      case 'ok':
        setPassword('');
        setAttempt({ via: 'password' });
        session.login(outcome.token);
        return;
      case 'invalid-credentials':
        setFailure(via.via === 'google' ? GOOGLE_401 : 'Correo o contraseña incorrectos.');
        return;
      case 'email-not-verified':
        // La contraseña sale del estado (y del DOM): para entrar después de confirmar se vuelve a escribir. Con Google,
        // la web no sabe el correo de la cuenta: no hay "Reenviar" (G-W3)
        setPassword('');
        setAttempt({ via: 'password' });
        setUnverified({ email: via.via === 'google' ? null : email.trim() });
        return;
      case 'acceptance-required':
        setChecks({ terms: false, data: false });
        setPending(acceptanceFor(outcome) ?? 'unsupported');
        return;
      case 'google-unavailable':
        setFailure(GOOGLE_503);
        return;
      case 'bad-request':
        if (via.via === 'google') { setFailure(GOOGLE_401); return; }
        setErrors({ email: email.trim() ? undefined : 'Este campo es obligatorio.', password: password ? undefined : 'Este campo es obligatorio.' });
        setFailure('Correo o contraseña incorrectos.');
        return;
      case 'server-error':
        setFailure('No pudimos iniciar sesión. Inténtalo de nuevo más tarde.');
        return;
      case 'network':
        setFailure('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.');
        return;
      default: {
        const unreachable: never = outcome;
        throw new Error(`Resultado de login desconocido: ${String(unreachable)}`);
      }
    }
  };

  /** "Cancelar": vuelve al formulario y la contraseña sale del estado (y del DOM). */
  const cancelAcceptance = () => {
    setPending(null);
    setPassword('');
    setAttempt({ via: 'password' });
    setFailure(null);
  };

  const acceptanceReady = pending !== null && pending !== 'unsupported'
    && (pending.acceptedTermsVersion === undefined || checks.terms)
    && (pending.acceptedDataPolicyVersion === undefined || checks.data);

  const reasonText = reason ? REASON_TEXT[reason] : null;
  // G-W1 y G-W8: la superficie y el ID de cliente; sin cualquiera de los dos, ni botón ni script
  const showGoogle = isSurfaceEnabled('action:google-sign-in')
    && Boolean(googleClientId === undefined ? configuredGoogleClientId() : googleClientId);

  return (
    <>

              {notice && <div className={[s.feedbackMsg, s.feedbackSuccess].join(' ')} role="status" data-testid="login-notice">{notice}</div>}
              {reasonText && <div className={[s.feedbackMsg, s.feedbackInfo].join(' ')} role="status">{reasonText}</div>}
              {failure && <div className={[s.feedbackMsg, s.feedbackError].join(' ')} role="alert">{failure}</div>}

              {unverified !== null ? (
                <section className={s.acceptance} aria-labelledby="unverified-title" data-testid="email-not-verified">
                  <h2 id="unverified-title" className={s.acceptanceTitle}>Antes de entrar, confirma tu correo</h2>
                  {unverified.email !== null ? (
                    <>
                      <p className={s.acceptanceText}>Te enviamos un enlace a <b>{unverified.email}</b>. Ábrelo para confirmar tu correo y vuelve a iniciar sesión.</p>
                      <ResendVerification email={unverified.email} client={resendClient} />
                    </>
                  ) : (
                    <p className={s.acceptanceText}>Abre el enlace que te enviamos al correo de tu cuenta y vuelve a entrar. Si no lo encuentras, entra con tu correo y contraseña para pedir otro.</p>
                  )}
                  <div className={s.acceptanceActions}>
                    <button type="button" className={s.secondaryBtn} onClick={() => { setUnverified(null); setFailure(null); }}>Volver</button>
                  </div>
                </section>
              ) : pending !== null ? (
                <section className={s.acceptance} aria-labelledby="acceptance-title" data-testid="acceptance-required">
                  <h2 id="acceptance-title" className={s.acceptanceTitle}>Actualizamos nuestras condiciones</h2>
                  {pending === 'unsupported' ? (
                    <p className={s.acceptanceText}>Hay condiciones nuevas que esta versión de la web todavía no puede mostrar. Inténtalo de nuevo más tarde.</p>
                  ) : (
                    <>
                      <p className={s.acceptanceText}>Para seguir usando tu cuenta, lee y acepta los textos vigentes. Puedes abrirlos en una pestaña nueva.</p>
                      {pending.acceptedTermsVersion !== undefined && (
                        <LegalConsent doc="terms" checked={checks.terms} disabled={sending}
                          onChange={(v) => setChecks((c) => ({ ...c, terms: v }))} />
                      )}
                      {pending.acceptedDataPolicyVersion !== undefined && (
                        <LegalConsent doc="dataPolicy" checked={checks.data} disabled={sending}
                          onChange={(v) => setChecks((c) => ({ ...c, data: v }))} />
                      )}
                    </>
                  )}
                  <div className={s.acceptanceActions}>
                    {pending !== 'unsupported' && (
                      <button type="button" className={s.submitBtn} disabled={sending || !acceptanceReady} aria-busy={sending || undefined}
                        onClick={() => { if (acceptanceReady) void send(attempt, pending); }}>
                        <span>Aceptar y entrar</span>
                        {sending && <BrandDots aria-hidden="true" />}
                      </button>
                    )}
                    <button type="button" className={s.secondaryBtn} onClick={cancelAcceptance} disabled={sending}>Cancelar</button>
                  </div>
                </section>
              ) : (
              <form onSubmit={onSubmit} className={s.form} noValidate>
                <div className={s.field}>
                  <label htmlFor="loginEmail" className={s.label}>Correo electrónico</label>
                  <div className={s.inputWrap}>
                    <svg className={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <input
                      id="loginEmail"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={sending}
                      placeholder="ejemplo@correo.com"
                      className={s.input}
                    />
                  </div>
                  {errors.email && <span className={s.fieldError}>{errors.email}</span>}
                </div>

                <div className={s.field}>
                  <div className={s.labelRow}>
                    <label htmlFor="loginPass" className={s.label}>Contraseña</label>
                    {isSurfaceEnabled('/recuperar') && (
                      <Link href="/recuperar" className={s.forgotLink}>¿Olvidaste tu contraseña?</Link>
                    )}
                  </div>
                  <div className={s.inputWrap}>
                    <svg className={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      id="loginPass"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={sending}
                      placeholder="Tu contraseña"
                      className={s.input}
                    />
                    <button
                      type="button"
                      className={s.toggleEye}
                      aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
                      onClick={() => setShowPassword((p) => !p)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        {showPassword ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                  {errors.password && <span className={s.fieldError}>{errors.password}</span>}
                </div>

                <button type="submit" className={s.submitBtn} disabled={sending} aria-busy={sending || undefined}>
                  <span>Iniciar sesión</span>
                  {sending ? (
                    <BrandDots aria-hidden="true" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </button>
              </form>
              )}

              {pending === null && unverified === null && showGoogle && (
                <div data-testid="google-sign-in">
                  <GoogleDivider />
                  <GoogleButton loader={googleLoader} clientId={googleClientId}
                    onCredential={(idToken) => { if (!sending) void send({ via: 'google', idToken }); }} />
                </div>
              )}

              {pending === null && unverified === null && isSurfaceEnabled('/register') && (
                <div className={s.foot}>
                  <p>
                    ¿No tienes una cuenta aún?{' '}
                    <Link href="/register" className={s.switchLink} aria-label="Crear cuenta">Regístrate gratis</Link>
                  </p>
                </div>
              )}
    </>
  );
}
