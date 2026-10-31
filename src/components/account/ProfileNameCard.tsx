'use client';

// Ref: plan-fase7-puesta-al-dia.md P-1 (nombre y apellido editables en el Perfil, de 1 a 100 caracteres);
// paxfide-home.html (vProfile: "Tus datos", "Sin completar", "Editar datos"); referencia-api-v1.md §1, nota del
// 2026-10-25 (`PUT /account/profile`: vacío o ausente borra el campo). El nombre solo viaja en `/account/profile`.
import React, { useState } from 'react';
import { MAX_NAME, updateProfile, type PersonalProfile, type UpdateProfileOutcome } from '../../lib/api/account';
import { nameError } from '../access/NameGate';
import { TextField } from '../ui/Field';
import { Button } from '../ui/Button';
import { Actions } from '../ui/Layout';
import { StatusNotice } from '../States';
import s from './account.module.css';

export function ProfileNameCard({ email, names, namesFailed, onRetry, update = updateProfile, onSaved }: {
  email: string;
  names: PersonalProfile | null;
  namesFailed: boolean;
  onRetry: () => void;
  update?: (givenName: string, familyName: string) => Promise<UpdateProfileOutcome>;
  onSaved: (p: PersonalProfile) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [errors, setErrors] = useState<{ givenName?: string; familyName?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  const open = () => {
    setGivenName(names?.givenName ?? '');
    setFamilyName(names?.familyName ?? '');
    setErrors({});
    setFailure(null);
    setDone(false);
    setEditing(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = { givenName: nameError(givenName), familyName: nameError(familyName) };
    setErrors(next);
    setFailure(null);
    if (next.givenName || next.familyName) return;
    setSending(true);
    const r = await update(givenName, familyName);
    setSending(false);
    switch (r.kind) {
      case 'ok': onSaved(r.profile); setEditing(false); setDone(true); return;
      case 'invalid': setFailure(`Revisa los datos: cada campo admite de 1 a ${MAX_NAME} caracteres.`); return;
      case 'network': setFailure('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'); return;
      case 'unauthorized': return; // la sesión ya se cerró (T-1)
      case 'error': setFailure('No pudimos guardar tus datos. Inténtalo de nuevo.'); return;
      default: { const unreachable: never = r; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
    }
  };

  const value = (v?: string) => (v ? v : <i className={s.empty}>Sin completar</i>);

  return (
    <>
      {done && <StatusNotice variant="success" text="Guardamos tus datos." />}
      {editing ? (
        <form onSubmit={(e) => void submit(e)} noValidate data-testid="profile-name-form">
          {failure && <StatusNotice variant="rejected" text={failure} />}
          <div className={s.row2}>
            <TextField label="Nombre" autoComplete="given-name" value={givenName} error={errors.givenName} disabled={sending}
              onChange={(e) => setGivenName(e.target.value)} />
            <TextField label="Apellido" autoComplete="family-name" value={familyName} error={errors.familyName} disabled={sending}
              onChange={(e) => setFamilyName(e.target.value)} />
          </div>
          <p className={s.note}>Deja un campo vacío para borrarlo.</p>
          <Actions>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={sending}>Cancelar</Button>
            <Button type="submit" sending={sending}>Guardar</Button>
          </Actions>
        </form>
      ) : (
        <>
          <dl className={s.dl}>
            <dt className={s.dt}>Nombre</dt>
            <dd className={s.dd} data-testid="profile-given-name">{namesFailed ? '—' : value(names?.givenName)}</dd>
            <dt className={s.dt}>Apellido</dt>
            <dd className={s.dd} data-testid="profile-family-name">{namesFailed ? '—' : value(names?.familyName)}</dd>
            <dt className={s.dt}>Correo electrónico</dt>
            <dd className={[s.dd, s.mail].join(' ')} data-testid="profile-email-detail">{email}</dd>
          </dl>
          {namesFailed ? (
            <div className={s.inlineError} role="alert">
              <span>No pudimos cargar tu nombre.</span>
              <Button variant="secondary" onClick={onRetry}>Reintentar</Button>
            </div>
          ) : (
            <div className={s.cardAction}>
              <Button variant="secondary" onClick={open} disabled={!names}>Editar datos</Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
