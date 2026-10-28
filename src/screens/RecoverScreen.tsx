'use client';

// Ref: plan-fase7-puesta-al-dia.md P-1 ("¿Olvidaste tu contraseña?" y `/recuperar`); plan-fase7-fidelidad.md F-C1 (R-4)
// y X-3; referencia-api-v1.md §1, nota del 2026-10-25 (R-4, ADR-050 D8); DW-48 (el mismo trato del token que
// `/invitaciones`); Documentos/paxfide-landing.html (.auth-card). Sin token: se pide el correo y siempre se muestra el
// mismo mensaje. Con `#token=`: el token se borra de la barra antes de nada y se pide la contraseña nueva.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  confirmPasswordReset, MIN_PASSWORD, requestPasswordReset,
  type ResetConfirmOutcome, type ResetRequestOutcome,
} from '../lib/api/account';
import { captureResetToken, clearResetToken, getResetToken } from '../lib/auth/resetToken';
import { calculateStrength } from '../lib/auth/passwordStrength';
import * as session from '../lib/auth/session';
import { BrandMark } from '../components/shell/BrandMark';
import { BrandDots } from '../components/loaders/BrandDots';
import { AccessLayout } from '../components/access/AccessLayout';
import s from './access.module.css';

/** El mismo texto exista o no la cuenta (contrato: siempre el mismo 202). */
export const RESET_SENT_TEXT = 'Si hay una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva. Vale 30 minutos. Si no llega, vuelve a pedirlo en 5 minutos.';
export const RESET_TOKEN_INVALID_TEXT = 'Este enlace ya no sirve: puede haber caducado, haberse usado o haberse sustituido por otro más reciente. Pide un enlace nuevo.';
export const RESET_DONE_TEXT = 'Ya puedes entrar con tu contraseña nueva.';

type Mode = 'request' | 'confirm' | 'invalid';

export function RecoverScreen({ requestClient = requestPasswordReset, confirmClient = confirmPasswordReset }: {
  requestClient?: (email: string) => Promise<ResetRequestOutcome>;
  confirmClient?: (token: string, password: string) => Promise<ResetConfirmOutcome>;
}) {
  const router = useRouter();
  // El token sale de la barra en el primer efecto, antes de cualquier petición. No en el render: al hidratar, Next
  // vuelve a escribir la URL inicial (con el fragmento) en un efecto de inserción, que corre después del render
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    setMode(captureResetToken() || getResetToken() ? 'confirm' : 'request');
    // Abrir otro enlace con esta página abierta solo cambia el fragmento
    const onHash = () => { if (captureResetToken()) setMode('confirm'); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const toRequest = () => { clearResetToken(); setMode('request'); };

  return (
    <AccessLayout>
      <div className={s.page}>
        <div className={s.card} data-world-avoid="" data-testid="recover-screen">
          <div className={s.brand}><BrandMark size={32} /><span>PaxFide</span></div>
          <div className={s.badgePill}><span className={s.badgeDot} /><span>TU CUENTA PAXFIDE</span></div>
          {mode === 'request' && <RequestForm client={requestClient} />}
          {mode === 'confirm' && (
            <ConfirmForm client={confirmClient}
              onInvalid={() => { clearResetToken(); setMode('invalid'); }}
              onDone={() => { clearResetToken(); session.setLoginNotice(RESET_DONE_TEXT); router.replace('/login'); }} />
          )}
          {mode === 'invalid' && (
            <>
              <h1 className={s.title}>Enlace no válido</h1>
              <div className={[s.feedbackMsg, s.feedbackError].join(' ')} role="alert">{RESET_TOKEN_INVALID_TEXT}</div>
              <button type="button" className={s.submitBtn} onClick={toRequest}><span>Pedir un enlace nuevo</span></button>
            </>
          )}
          <div className={s.foot}>
            <p><Link href="/login" className={s.switchLink}>Volver a iniciar sesión</Link></p>
          </div>
        </div>
      </div>
    </AccessLayout>
  );
}

function RequestForm({ client }: { client: (email: string) => Promise<ResetRequestOutcome> }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Este campo es obligatorio.'); return; }
    setError(null);
    setFailure(null);
    setSending(true);
    const r = await client(email.trim());
    setSending(false);
    switch (r.kind) {
      case 'ok': setSent(true); return;
      case 'bad-request': setError('Este campo es obligatorio.'); return;
      case 'network': setFailure('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'); return;
      case 'error': setFailure('No pudimos enviar el enlace. Inténtalo de nuevo más tarde.'); return;
      default: { const unreachable: never = r; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
    }
  };

  return (
    <>
      <h1 className={s.title}>¿Olvidaste tu contraseña?</h1>
      <p className={s.subtitle}>Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva.</p>
      {sent ? (
        <div className={[s.feedbackMsg, s.feedbackInfo].join(' ')} role="status" data-testid="reset-sent">{RESET_SENT_TEXT}</div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className={s.form} noValidate>
          {failure && <div className={[s.feedbackMsg, s.feedbackError].join(' ')} role="alert">{failure}</div>}
          <div className={s.field}>
            <label htmlFor="resetEmail" className={s.label}>Correo electrónico</label>
            <div className={s.inputWrap}>
              <svg className={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input id="resetEmail" type="email" autoComplete="username" value={email} placeholder="ejemplo@correo.com"
                onChange={(e) => setEmail(e.target.value)} disabled={sending} className={s.input}
                aria-invalid={error ? true : undefined} aria-describedby={error ? 'resetEmail-error' : undefined} />
            </div>
            {error && <span id="resetEmail-error" className={s.fieldError}>{error}</span>}
          </div>
          <button type="submit" className={s.submitBtn} disabled={sending} aria-busy={sending || undefined}>
            <span>Enviar enlace</span>
            {sending && <BrandDots aria-hidden="true" />}
          </button>
        </form>
      )}
    </>
  );
}

function ConfirmForm({ client, onInvalid, onDone }: {
  client: (token: string, password: string) => Promise<ResetConfirmOutcome>;
  onInvalid: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; repeat?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const strength = calculateStrength(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!password) next.password = 'Este campo es obligatorio.';
    else if (password.length < MIN_PASSWORD) next.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
    if (!next.password && repeat !== password) next.repeat = 'Las contraseñas no coinciden.';
    setErrors(next);
    setFailure(null);
    if (next.password || next.repeat) return;
    const token = getResetToken();
    if (!token) { onInvalid(); return; }
    setSending(true);
    const r = await client(token, password);
    setSending(false);
    switch (r.kind) {
      case 'ok': setPassword(''); setRepeat(''); onDone(); return;
      case 'token-invalid': setPassword(''); setRepeat(''); onInvalid(); return;
      // No consume el token: se corrige y se reenvía con el mismo
      case 'too-short': setErrors({ password: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` }); return;
      case 'bad-request': setErrors({ password: 'Este campo es obligatorio.' }); return;
      case 'network': setFailure('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo con el mismo enlace.'); return;
      case 'error': setFailure('No pudimos cambiar la contraseña. Inténtalo de nuevo más tarde.'); return;
      default: { const unreachable: never = r; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
    }
  };

  return (
    <>
      <h1 className={s.title}>Crea una contraseña nueva</h1>
      <p className={s.subtitle}>Al guardarla se cierran todas tus sesiones abiertas. Después inicia sesión con la nueva.</p>
      <form onSubmit={(e) => void submit(e)} className={s.form} noValidate>
        {failure && <div className={[s.feedbackMsg, s.feedbackError].join(' ')} role="alert">{failure}</div>}
        <div className={s.field}>
          <label htmlFor="resetPass" className={s.label}>Contraseña nueva</label>
          <div className={s.inputWrap}>
            <svg className={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input id="resetPass" type={visible ? 'text' : 'password'} autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} disabled={sending} className={s.input}
              aria-invalid={errors.password ? true : undefined} aria-describedby={errors.password ? 'resetPass-error' : 'resetPass-hint'} />
            <button type="button" className={s.toggleEye} aria-label={visible ? 'Ocultar clave' : 'Mostrar clave'} onClick={() => setVisible((v) => !v)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
          <span id="resetPass-hint" className={s.hint}>Al menos {MIN_PASSWORD} caracteres.</span>
          {errors.password && <span id="resetPass-error" className={s.fieldError}>{errors.password}</span>}
          <div className={s.passStrengthBar}>
            <div className={s.strengthTrack}>
              <div className={s.strengthMeter} style={{ width: strength.width, backgroundColor: strength.color }} />
            </div>
            <span className={s.strengthLabel} style={{ color: strength.color }}>{strength.label}</span>
          </div>
        </div>
        <div className={s.field}>
          <label htmlFor="resetRepeat" className={s.label}>Repite la contraseña</label>
          <div className={s.inputWrap}>
            <svg className={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input id="resetRepeat" type={visible ? 'text' : 'password'} autoComplete="new-password" value={repeat}
              onChange={(e) => setRepeat(e.target.value)} disabled={sending} className={s.input}
              aria-invalid={errors.repeat ? true : undefined} aria-describedby={errors.repeat ? 'resetRepeat-error' : undefined} />
          </div>
          {errors.repeat && <span id="resetRepeat-error" className={s.fieldError}>{errors.repeat}</span>}
        </div>
        <button type="submit" className={s.submitBtn} disabled={sending} aria-busy={sending || undefined}>
          <span>Guardar contraseña</span>
          {sending && <BrandDots aria-hidden="true" />}
        </button>
      </form>
    </>
  );
}
