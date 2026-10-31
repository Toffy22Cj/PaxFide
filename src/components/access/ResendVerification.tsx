'use client';
// Ref: plan-fase7-puesta-al-dia.md Anexo 1, P-6; ADR-050 Enmienda 2; referencia-api-v1.md §1, nota del 2026-10-29
// (`POST /auth/email-verification`: siempre el mismo 202). "Reenviar" muestra siempre el mismo texto, exista o no la
// cuenta y esté o no verificada; solo un fallo de red da otro mensaje. El correo solo viaja en el cuerpo.
import React, { useId, useState } from 'react';
import { requestEmailVerification, type EmailVerificationRequestOutcome } from '../../lib/api/account';
import { BrandDots } from '../loaders/BrandDots';
import s from '../../screens/access.module.css';

/** P-6: el único texto tras "Reenviar". */
export const RESEND_TEXT = 'Si no llega, revisa el spam o vuelve a pedirlo en 5 minutos';

export function ResendVerification({ email, client = requestEmailVerification }: {
  /** Con el correo conocido, solo el botón; sin él, el campo del correo. */
  email?: string;
  client?: (email: string) => Promise<EmailVerificationRequestOutcome>;
}) {
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<'sent' | 'network' | null>(null);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const target = (email ?? value).trim();
    if (!target) { setError('Este campo es obligatorio.'); return; }
    setError(null);
    setSending(true);
    const r = await client(target);
    setSending(false);
    switch (r.kind) {
      case 'network': setResult('network'); return;
      // 400 (correo vacío ya filtrado aquí) y cualquier otro: el mismo texto, sin revelar nada
      case 'ok': case 'bad-request': case 'error': setResult('sent'); return;
      default: { const unreachable: never = r; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
    }
  };

  return (
    <form className={s.form} onSubmit={(e) => void send(e)} noValidate data-testid="resend-verification">
      {email === undefined && (
        <div className={s.field}>
          <label htmlFor={`${id}-email`} className={s.label}>Correo electrónico</label>
          <input id={`${id}-email`} type="email" autoComplete="email" className={[s.input, s.inputPlain].join(' ')} value={value}
            disabled={sending} onChange={(ev) => setValue(ev.target.value)} aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-e` : undefined} />
          {error && <span id={`${id}-e`} className={s.fieldError}>{error}</span>}
        </div>
      )}
      {result === 'sent' && <div className={[s.feedbackMsg, s.feedbackInfo].join(' ')} role="status" data-testid="resend-sent">{RESEND_TEXT}</div>}
      {result === 'network' && <div className={[s.feedbackMsg, s.feedbackError].join(' ')} role="alert">No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.</div>}
      <button type="submit" className={s.secondaryBtn} disabled={sending} aria-busy={sending || undefined}>
        <span>Reenviar</span>
        {sending && <BrandDots aria-hidden="true" />}
      </button>
    </form>
  );
}
