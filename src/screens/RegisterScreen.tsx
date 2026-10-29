'use client';

// Ref: P2; POST /auth/register; DD-56; H-P2-1 (PasswordTooShort >= 12).
// Documentos/plan-fase7-fidelidad.md §2 D-F5 (acceso sobre el mundo), D-F10 (bienvenida), D-F14 (fundación), X-4..X-7;
// Documentos/paxfide-landing.html (.auth-card, #formRegister, checkPassStrength); plan-fase7-puesta-al-dia.md R-1 (las
// dos casillas legales, sin marcar; sin las dos no se envía nada; el registro lleva las dos versiones de LEGAL_VERSIONS).
import React, { useState } from 'react';
import Link from 'next/link';
import { registerAccount, RegisterOutcome } from '../lib/api/identity';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { BrandMark } from '../components/shell/BrandMark';
import { BrandDots } from '../components/loaders/BrandDots';
import { AccessLayout } from '../components/access/AccessLayout';
import { LegalConsent } from '../components/access/LegalConsent';
import { calculateStrength } from '../lib/auth/passwordStrength';
import s from './access.module.css';

const MIN_PASSWORD = 12;

export function RegisterScreen({ client = registerAccount }: { client?: (e: string, p: string) => Promise<RegisterOutcome> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; repeat?: string }>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<RegisterOutcome | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptData, setAcceptData] = useState(false);
  const consented = acceptTerms && acceptData;

  const strength = calculateStrength(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consented) return; // R-1: sin las dos casillas no hay petición
    const next = {
      email: email.trim() ? undefined : 'Este campo es obligatorio.',
      password: !password ? 'Este campo es obligatorio.'
        : password.length < MIN_PASSWORD ? `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` : undefined,
      repeat: repeat === password ? undefined : 'Las contraseñas no coinciden.',
    };
    setErrors(next);
    if (next.email || next.password || next.repeat) return;
    setSending(true);
    setResult(null);
    const r = await client(email.trim(), password);
    setSending(false);
    setResult(r);
    if (r.kind === 'ok') {
      setPassword('');
      setRepeat('');
    }
    if (r.kind === 'invalid-email') setErrors({ email: 'El correo no es válido.' });
    if (r.kind === 'password-too-short') setErrors({ password: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` });
  };

  const failure: Record<string, string> = {
    'duplicate-email': 'Ya existe una cuenta con ese correo.',
    'bad-request': 'Revisa los datos: alguno no es válido.',
    'legal-rejected': 'No pudimos registrar que aceptaste las condiciones vigentes. Recarga la página y vuelve a intentarlo.',
    'server-error': 'No pudimos crear la cuenta. Inténtalo de nuevo más tarde.',
    network: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
  };

  return (
    <AccessLayout>
      <div className={s.page}>
        <div className={s.card} data-world-avoid="">
          <div className={s.brand}><BrandMark size={32} /><span>PaxFide</span></div>
          <div className={s.badgePill}>
            <span className={s.badgeDot} />
            <span>TU CUENTA PAXFIDE</span>
          </div>
          <h1 id="authCardTitle" className={s.title}>Crear cuenta</h1>
          <p id="authCardSub" className={s.subtitle}>Únete para apoyar causas verificadas y seguir el impacto real de cada donación.</p>

          {/* Conmutador de pestañas */}
          <div className={s.tabs} role="tablist" aria-label="Acceso">
            {isSurfaceEnabled('/login') && (
              <Link href="/login" role="tab" id="tabBtnLogin" aria-selected="false" className={s.tabBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                <span>Iniciar sesión</span>
              </Link>
            )}
            <Link href="/register" role="tab" id="tabBtnRegister" aria-selected="true" className={[s.tabBtn, s.tabActive].join(' ')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <span>Crear cuenta</span>
            </Link>
          </div>

          {result?.kind === 'ok' ? (
            <div>
              <div className={[s.feedbackMsg, s.feedbackSuccess].join(' ')} role="status">
                <b>Cuenta creada</b>. Ya puedes iniciar sesión con tu correo y tu contraseña.
              </div>
              <div className={s.foot}>
                <p>
                  <Link href="/login" className={s.switchLink}>Iniciar sesión</Link>
                </p>
              </div>
            </div>
          ) : (
            <>
              {result && failure[result.kind] && (
                <div className={[s.feedbackMsg, s.feedbackError].join(' ')} role="alert">
                  {failure[result.kind]}
                </div>
              )}

              <form onSubmit={submit} className={s.form} noValidate>
                <div className={s.field}>
                  <label htmlFor="regEmail" className={s.label}>Correo electrónico</label>
                  <div className={s.inputWrap}>
                    <svg className={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <input
                      id="regEmail"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={sending}
                      placeholder="tu@correo.com"
                      className={s.input}
                    />
                  </div>
                  {errors.email && <span className={s.fieldError}>{errors.email}</span>}
                </div>

                <div className={s.field}>
                  <label htmlFor="regPass" className={s.label}>Contraseña</label>
                  <div className={s.inputWrap}>
                    <svg className={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      id="regPass"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={sending}
                      placeholder="Mínimo 12 caracteres"
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
                  <span className={s.hint}>Al menos 12 caracteres.</span>
                  {errors.password && <span className={s.fieldError}>{errors.password}</span>}

                  {/* Barra de seguridad de la contraseña (X-6) */}
                  <div className={s.passStrengthBar}>
                    <div className={s.strengthTrack}>
                      <div className={s.strengthMeter} style={{ width: strength.width, backgroundColor: strength.color }} />
                    </div>
                    <span className={s.strengthLabel} style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                </div>

                <div className={s.field}>
                  <label htmlFor="regRepeat" className={s.label}>Repite la contraseña</label>
                  <div className={s.inputWrap}>
                    <svg className={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      id="regRepeat"
                      type={showRepeat ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={repeat}
                      onChange={(e) => setRepeat(e.target.value)}
                      disabled={sending}
                      placeholder="Repite tu contraseña"
                      className={s.input}
                    />
                    <button
                      type="button"
                      className={s.toggleEye}
                      aria-label={showRepeat ? 'Ocultar clave' : 'Mostrar clave'}
                      onClick={() => setShowRepeat((p) => !p)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        {showRepeat ? (
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
                  {errors.repeat && <span className={s.fieldError}>{errors.repeat}</span>}
                </div>

                {/* Nota plegable sobre registro de fundaciones (D-F14) */}
                <details className={s.foundationDetails}>
                  <summary className={s.foundationSummary}>¿Representas una fundación?</summary>
                  <div className={s.foundationBody}>
                    <ol>
                      <li>Crea tu cuenta aquí, como cualquier donante.</li>
                      <li>Inicia sesión.</li>
                      <li>En Inicio, en la tarjeta &ldquo;¿Tienes una fundación?&rdquo;, pulsa &ldquo;Registrar organización&rdquo; y llena sus datos.</li>
                      <li>La plataforma la revisa (estado &ldquo;Pendiente de verificación&rdquo;); puede pedirte más información.</li>
                      <li>Cuando esté &ldquo;Verificada&rdquo;, puedes crear convocatorias.</li>
                    </ol>
                  </div>
                </details>

                <div className={s.consents}>
                  <LegalConsent doc="terms" checked={acceptTerms} onChange={setAcceptTerms} disabled={sending} />
                  <LegalConsent doc="dataPolicy" checked={acceptData} onChange={setAcceptData} disabled={sending} />
                </div>

                <button type="submit" className={s.submitBtn} disabled={sending || !consented} aria-busy={sending || undefined}>
                  <span>Crear cuenta</span>
                  {sending ? (
                    <BrandDots aria-hidden="true" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              </form>

              {isSurfaceEnabled('/login') && (
                <div className={s.foot}>
                  <p>
                    ¿Ya tienes cuenta?{' '}
                    <Link href="/login" className={s.switchLink} aria-label="Iniciar sesión">Ya tengo cuenta</Link>
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
