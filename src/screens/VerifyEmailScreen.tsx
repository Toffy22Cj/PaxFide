'use client';

// Ref: plan-fase7-puesta-al-dia.md Anexo 1, P-6 (`/verificar-correo`, superficie nueva autorizada por el anexo);
// ADR-050 Enmienda 2; referencia-api-v1.md §1, nota del 2026-10-29. Como `/recuperar`: el token sale de la barra antes
// de nada. 204 → al login con "Tu correo quedó verificado" (no inicia sesión); 400 → "El enlace no es válido o caducó",
// con "Reenviar". Sin token, solo "Reenviar".
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  confirmEmailVerification, type EmailVerificationConfirmOutcome, type EmailVerificationRequestOutcome,
} from '../lib/api/account';
import { captureVerificationToken, takeVerificationToken } from '../lib/auth/verificationToken';
import * as session from '../lib/auth/session';
import { ResendVerification } from '../components/access/ResendVerification';
import { BrandDots } from '../components/loaders/BrandDots';
import s from './access.module.css';

export const VERIFIED_TEXT = 'Tu correo quedó verificado';
export const VERIFY_INVALID_TEXT = 'El enlace no es válido o caducó';

type Mode = 'checking' | 'invalid' | 'no-token' | 'network';

export function VerifyEmailScreen({ confirmClient = confirmEmailVerification, resendClient }: {
  confirmClient?: (token: string) => Promise<EmailVerificationConfirmOutcome>;
  resendClient?: (email: string) => Promise<EmailVerificationRequestOutcome>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Lo primero: el token sale de la barra (antes de cualquier petición). No en el render: al hidratar, Next vuelve a
    // escribir la URL inicial en un efecto de inserción, que corre después del render
    const had = captureVerificationToken();
    if (started.current) return; // StrictMode monta dos veces: una sola petición
    started.current = true;
    const token = had ? takeVerificationToken() : null;
    if (!token) { setMode('no-token'); return; }
    setMode('checking');
    void confirmClient(token).then((r) => {
      switch (r.kind) {
        case 'ok':
          // No inicia sesión (contrato): al login con el aviso
          session.setLoginNotice(VERIFIED_TEXT);
          router.replace('/login');
          return;
        case 'token-invalid': case 'bad-request': setMode('invalid'); return;
        case 'network': case 'error': setMode('network'); return;
        default: { const unreachable: never = r; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
      }
    });
  }, [confirmClient, router]);

  return (
    <>
      <div className={s.page}>
        <div className={s.card} data-world-avoid="" data-testid="verify-email-screen">
          <div className={s.badgePill}><span className={s.badgeDot} /><span>TU CUENTA PAXFIDE</span></div>
          <h1 className={s.title}>Confirmar tu correo</h1>
          {(mode === null || mode === 'checking') && (
            <div className={[s.feedbackMsg, s.feedbackInfo].join(' ')} role="status">
              <span>Comprobando el enlace…</span> <BrandDots aria-hidden="true" />
            </div>
          )}
          {mode === 'invalid' && (
            <div className={[s.feedbackMsg, s.feedbackError].join(' ')} role="alert" data-testid="verify-invalid">{VERIFY_INVALID_TEXT}</div>
          )}
          {mode === 'network' && (
            <div className={[s.feedbackMsg, s.feedbackError].join(' ')} role="alert">No pudimos comprobar el enlace. Revisa tu conexión y vuelve a abrirlo desde el correo.</div>
          )}
          {mode === 'no-token' && (
            <p className={s.subtitle}>Abre el enlace que te enviamos por correo. Si no lo tienes, pide uno nuevo.</p>
          )}
          {(mode === 'invalid' || mode === 'no-token' || mode === 'network') && <ResendVerification client={resendClient} />}
          <div className={s.foot}>
            <p><Link href="/login" className={s.switchLink}>Volver a iniciar sesión</Link></p>
          </div>
        </div>
      </div>
    </>
  );
}
