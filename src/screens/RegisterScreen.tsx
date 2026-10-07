'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { registerAccount, RegisterOutcome } from '../lib/api/identity';
import { PageHeader } from '../components/ui/Layout';
import { TextField, PasswordField } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { StatusNotice } from '../components/States';
import s from './login.module.css';

/**
 * Registro de cuenta (P2; `POST /auth/register`, DD-56). No inicia sesión ni guarda nada: tras crear la cuenta se
 * entra por `/login`. El backend no fija política de contraseña (H-P2-1); la web solo exige que coincidan.
 */
/** Política del backend (H-P2-1, `PasswordTooShort`): al menos 12 caracteres. El backend valida igual. */
const MIN_PASSWORD = 12;

export function RegisterScreen({ client = registerAccount }: { client?: (e: string, p: string) => Promise<RegisterOutcome> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; repeat?: string }>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<RegisterOutcome | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (r.kind === 'ok') { setPassword(''); setRepeat(''); }
    if (r.kind === 'invalid-email') setErrors({ email: 'El correo no es válido.' });
    if (r.kind === 'password-too-short') setErrors({ password: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.` });
  };

  if (result?.kind === 'ok') {
    return (
      <div className={s.wrap}>
        <PageHeader title="Crear cuenta" />
        <StatusNotice variant="success" title="Cuenta creada" text="Ya puedes iniciar sesión con tu correo y tu contraseña." />
        <Link href="/login">Iniciar sesión</Link>
      </div>
    );
  }

  const failure: Record<string, string> = {
    'duplicate-email': 'Ya existe una cuenta con ese correo.',
    'bad-request': 'Revisa los datos: alguno no es válido.',
    'server-error': 'No pudimos crear la cuenta. Inténtalo de nuevo más tarde.',
    network: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
  };

  return (
    <div className={s.wrap}>
      <PageHeader title="Crear cuenta" />
      {result && failure[result.kind] && <StatusNotice variant="rejected" text={failure[result.kind]} />}
      <form onSubmit={submit} noValidate>
        <TextField label="Correo electrónico" type="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} error={errors.email} disabled={sending} />
        <PasswordField label="Contraseña" autoComplete="new-password" value={password} hint={`Al menos ${MIN_PASSWORD} caracteres.`}
          onChange={(e) => setPassword(e.target.value)} error={errors.password} disabled={sending} />
        <PasswordField label="Repite la contraseña" autoComplete="new-password" value={repeat}
          onChange={(e) => setRepeat(e.target.value)} error={errors.repeat} disabled={sending} />
        <Button type="submit" block sending={sending}>Crear cuenta</Button>
      </form>
      <p><Link href="/login">Ya tengo cuenta</Link></p>
    </div>
  );
}
