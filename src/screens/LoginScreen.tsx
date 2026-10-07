'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import * as session from '../lib/auth/session';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { login as loginRequest, LoginOutcome } from '../lib/api/identity';
import { PageHeader } from '../components/ui/Layout';
import { TextField, PasswordField } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { StatusNotice } from '../components/States';
import s from './login.module.css';

type Props = { loginClient?: (email: string, password: string) => Promise<LoginOutcome> };

const REASON_TEXT: Record<session.LogoutReason, string | null> = {
  EXPIRED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  OTHER_TAB: 'Cerraste sesión en otra pestaña.',
  MANUAL: null,
};

/**
 * Login (`diseno-ux-contractual-web-v1.md` §5.2; ID-01). Un único texto para los tres fallos de autenticación
 * (ADR-038 §2.6). El token pasa directamente a la sesión en memoria (ADR-046 D2); tras el éxito, el guard navega al
 * destino retenido o a `/panel` (G-W2).
 */
export function LoginScreen({ loginClient = loginRequest }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [reason] = useState(() => session.getLastLogoutReason());

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = 'Este campo es obligatorio.';
    if (!password) nextErrors.password = 'Este campo es obligatorio.';
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setSending(true);
    setFailure(null);
    const outcome = await loginClient(email.trim(), password);
    setSending(false);
    switch (outcome.kind) {
      case 'ok':
        setPassword('');
        session.login(outcome.token);
        return;
      case 'invalid-credentials':
        setFailure('Correo o contraseña incorrectos.');
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
    }
  };

  const reasonText = reason ? REASON_TEXT[reason] : null;

  return (
    <div className={s.wrap}>
      <PageHeader title="Iniciar sesión" />
      {reasonText && <StatusNotice variant="info" text={reasonText} />}
      {failure && <StatusNotice variant="rejected" text={failure} />}
      <form onSubmit={onSubmit} noValidate>
        <TextField label="Correo electrónico" type="email" autoComplete="username" value={email}
          onChange={(e) => setEmail(e.target.value)} error={errors.email} disabled={sending} />
        <PasswordField label="Contraseña" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} error={errors.password} disabled={sending} />
        <Button type="submit" block sending={sending}>Iniciar sesión</Button>
      </form>
      {isSurfaceEnabled('/register') && <p><Link href="/register">Crear cuenta</Link></p>}
    </div>
  );
}
