'use client';

// Ref: diseno-ux-contractual-web-v1.md §5.2; ID-01; ADR-038 §2.6; ADR-046 D2;
// Documentos/plan-fase7-fidelidad.md §2 D-F5 (acceso sobre el mundo), D-F10 (bienvenida), D-F2;
// Documentos/paxfide-landing.html (.auth-card, #formLogin); plan-fase7-puesta-al-dia.md R-2 y U-2 (403
// AcceptanceRequired: "Actualizamos nuestras condiciones" en la misma tarjeta; la contraseña sigue solo en el estado);
// P-1: "¿Olvidaste tu contraseña?" (→ /recuperar), el aviso tras recuperarla y "¿Cómo te llamamos?" tras la bienvenida
// (paxfide-home.html #sData; ADR-050 D1): opcional, con "Más tarde"; el nombre solo viaja en /account/profile.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import * as session from '../lib/auth/session';
import { acceptanceFor, login as loginRequest, LoginAcceptance, LoginOutcome } from '../lib/api/identity';
import { LegalConsent } from '../components/access/LegalConsent';
import { NameGate, type NameGateClients } from '../components/access/NameGate';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { BrandMark } from '../components/shell/BrandMark';
import { BrandDots } from '../components/loaders/BrandDots';
import { AccessLayout } from '../components/access/AccessLayout';
import { defaultDestination } from '../app/RouteGuard';
import s from './access.module.css';

type Props = {
  loginClient?: (email: string, password: string, acceptance?: LoginAcceptance) => Promise<LoginOutcome>;
  onContinueWelcome?: () => void;
  profileClients?: NameGateClients;
};

const REASON_TEXT: Record<session.LogoutReason, string | null> = {
  EXPIRED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  OTHER_TAB: 'Cerraste sesión en otra pestaña.',
  MANUAL: null,
  PASSWORD_CHANGED: 'Tu contraseña cambió; vuelve a iniciar sesión.',
  DEACTIVATED: 'Desactivaste tu cuenta. Si fue un error, pide al administrador de la plataforma que la reactive.',
};

export function LoginScreen({ loginClient = loginRequest, onContinueWelcome, profileClients }: Props) {
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
  /** D-F10 + P-1: la bienvenida y, tras "Continuar", "¿Cómo te llamamos?". */
  const [welcomeStep, setWelcomeStep] = useState<'welcome' | 'name'>('welcome');
  /** U-2: las versiones pendientes que se aceptan al repetir el login; `unsupported` si la web no tiene ese texto. */
  const [pending, setPending] = useState<LoginAcceptance | 'unsupported' | null>(null);
  const [checks, setChecks] = useState<{ terms: boolean; data: boolean }>({ terms: false, data: false });
  const [showWelcome, setShowWelcome] = useState(() => session.isJustRegistered() && !session.getPostLoginDestination() && session.getState() === 'AUTHENTICATED');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = 'Este campo es obligatorio.';
    if (!password) nextErrors.password = 'Este campo es obligatorio.';
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    await send();
  };

  /** Envía el login; con `acceptance`, el segundo intento tras el 403 (U-2), con el mismo correo y contraseña. */
  const send = async (acceptance?: LoginAcceptance) => {
    setSending(true);
    setFailure(null);
    const outcome = await loginClient(email.trim(), password, acceptance);
    setSending(false);
    if (outcome.kind !== 'acceptance-required') setPending(null);
    switch (outcome.kind) {
      case 'ok':
        setPassword('');
        session.login(outcome.token);
        if (session.isJustRegistered() && !session.getPostLoginDestination()) {
          setShowWelcome(true);
          return;
        }
        return;
      case 'invalid-credentials':
        setFailure('Correo o contraseña incorrectos.');
        return;
      case 'acceptance-required':
        setChecks({ terms: false, data: false });
        setPending(acceptanceFor(outcome) ?? 'unsupported');
        return;
      case 'bad-request':
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
    setFailure(null);
  };

  const acceptanceReady = pending !== null && pending !== 'unsupported'
    && (pending.acceptedTermsVersion === undefined || checks.terms)
    && (pending.acceptedDataPolicyVersion === undefined || checks.data);

  const finishWelcome = () => {
    if (onContinueWelcome) {
      onContinueWelcome();
    } else {
      session.clearJustRegistered();
      setShowWelcome(false);
      const dest = session.consumePostLoginDestination();
      if (typeof window !== 'undefined') {
        window.location.href = dest || defaultDestination();
      }
    }
  };

  const reasonText = reason ? REASON_TEXT[reason] : null;

  return (
    <AccessLayout>
      <div className={s.page}>
        <div className={s.card} data-world-avoid="">
          {showWelcome && welcomeStep === 'name' ? (
            <NameGate clients={profileClients} onDone={finishWelcome} />
          ) : showWelcome ? (
            /* ============ Bienvenida (D-F10; paxfide-home.html §1) ============ */
            <div className={s.welcomeGate} data-testid="welcome-gate">
              <div className={s.brand}><BrandMark size={32} /><span>PaxFide</span></div>
              <div className={s.chain} aria-hidden="true">
                <svg className={s.chainCube} viewBox="0 0 56 56">
                  <path d="M28 6l20 11-20 11L8 17z" className={s.cubeBlueTop} />
                  <path d="M8 17l20 11v22L8 39z" className={s.cubeBlueLeft} />
                  <path d="M48 17L28 28v22l20-11z" className={s.cubeBlueRight} />
                </svg>
                <span className={s.chainLink} />
                <svg className={s.chainCube} viewBox="0 0 56 56">
                  <path d="M28 6l20 11-20 11L8 17z" className={s.cubeGreenTop} />
                  <path d="M8 17l20 11v22L8 39z" className={s.cubeGreenLeft} />
                  <path d="M48 17L28 28v22l20-11z" className={s.cubeGreenRight} />
                </svg>
                <span className={s.chainLink} />
                <svg className={s.chainCube} viewBox="0 0 56 56">
                  <path d="M28 6l20 11-20 11L8 17z" className={s.cubeYellowTop} />
                  <path d="M8 17l20 11v22L8 39z" className={s.cubeYellowLeft} />
                  <path d="M48 17L28 28v22l20-11z" className={s.cubeYellowRight} />
                </svg>
                <span className={s.seal}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
              </div>
              <h1 className={s.welcomeTitle}>Te damos la bienvenida a PaxFide</h1>
              <p className={s.welcomeLead}>Ya iniciaste sesión. Esto es lo que puedes hacer aquí:</p>
              <ul className={s.featuresList}>
                <li className={s.featureItem}>
                  <span className={`${s.featureIcon} ${s.featureIconGreen}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" />
                    </svg>
                  </span>
                  <div className={s.featureText}>
                    <b>Dona a convocatorias verificadas</b>
                    <span>Cada organización pasa por una revisión antes de publicar.</span>
                  </div>
                </li>
                <li className={s.featureItem}>
                  <span className={`${s.featureIcon} ${s.featureIconBlue}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="6" cy="18" r="2" />
                      <circle cx="18" cy="6" r="2" />
                      <path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" />
                    </svg>
                  </span>
                  <div className={s.featureText}>
                    <b>Sigue el recorrido de tu ayuda</b>
                    <span>Del pago a la compra, el despacho y la entrega.</span>
                  </div>
                </li>
                <li className={s.featureItem}>
                  <span className={`${s.featureIcon} ${s.featureIconYellow}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
                      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
                    </svg>
                  </span>
                  <div className={s.featureText}>
                    <b>Cada paso queda sellado</b>
                    <span>Se registra de forma que no se puede cambiar sin que se note.</span>
                  </div>
                </li>
              </ul>
              <button type="button" className={s.submitBtn} onClick={() => setWelcomeStep('name')}>
                <span>Continuar</span>
              </button>
              <div className={s.welcomeDots} aria-hidden="true">
                <span className={[s.welcomeDot, s.welcomeDotActive].join(' ')} />
                <span className={s.welcomeDot} />
                <span className={s.welcomeDot} />
              </div>
            </div>
          ) : (
            /* ============ Tarjeta de Iniciar Sesión (D-F5) ============ */
            <>
              <div className={s.brand}><BrandMark size={32} /><span>PaxFide</span></div>
              <div className={s.badgePill}>
                <span className={s.badgeDot} />
                <span>TU CUENTA PAXFIDE</span>
              </div>
              <h1 id="authCardTitle" className={s.title}>Iniciar sesión</h1>
              <p id="authCardSub" className={s.subtitle}>Gestiona tus donaciones, verifica lotes en blockchain y apoya convocatorias.</p>

              {/* Conmutador de pestañas */}
              <div className={s.tabs} role="tablist" aria-label="Acceso">
                <Link href="/login" role="tab" id="tabBtnLogin" aria-selected="true" className={[s.tabBtn, s.tabActive].join(' ')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  <span>Iniciar sesión</span>
                </Link>
                {isSurfaceEnabled('/register') && (
                  <Link href="/register" role="tab" id="tabBtnRegister" aria-selected="false" className={s.tabBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                    <span>Crear cuenta</span>
                  </Link>
                )}
              </div>

              {notice && <div className={[s.feedbackMsg, s.feedbackSuccess].join(' ')} role="status" data-testid="login-notice">{notice}</div>}
              {reasonText && <div className={[s.feedbackMsg, s.feedbackInfo].join(' ')} role="status">{reasonText}</div>}
              {failure && <div className={[s.feedbackMsg, s.feedbackError].join(' ')} role="alert">{failure}</div>}

              {pending !== null ? (
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
                        onClick={() => { if (acceptanceReady) void send(pending); }}>
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

              {pending === null && isSurfaceEnabled('/register') && (
                <div className={s.foot}>
                  <p>
                    ¿No tienes una cuenta aún?{' '}
                    <Link href="/register" className={s.switchLink} aria-label="Crear cuenta">Regístrate gratis</Link>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AccessLayout>
  );
}
