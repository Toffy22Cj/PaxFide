'use client';

// Ref: plan-fase7-puesta-al-dia.md P-1; plan-fase7-fidelidad.md F-C1 (R-3+R-2, D6) y X-9; paxfide-home.html (vProfile,
// "Seguridad y Criptografía"); referencia-api-v1.md §1 (`POST /account/password`, nota ADR-038 #7; nota del 2026-10-25
// de `POST /account/deactivate`). Sin `Command-Id`: sin respuesta no se repite solo; se avisa en amarillo (D6) y la
// persona decide. Las contraseñas viven solo en el estado del formulario.
import React, { useState } from 'react';
import {
  changePassword, deactivateAccount, MIN_PASSWORD,
  type ChangePasswordOutcome, type DeactivateOutcome,
} from '../../lib/api/account';
import { calculateStrength } from '../../lib/auth/passwordStrength';
import * as session from '../../lib/auth/session';
import { PasswordField } from '../ui/Field';
import { Button } from '../ui/Button';
import { Actions } from '../ui/Layout';
import { Modal } from '../ui/Modal';
import { StatusNotice } from '../States';
import s from './account.module.css';

export interface SecurityClients {
  changePassword: (current: string, next: string) => Promise<ChangePasswordOutcome>;
  deactivate: (current: string) => Promise<DeactivateOutcome>;
}

const DEFAULT_CLIENTS: SecurityClients = { changePassword, deactivate: deactivateAccount };

const REQUIRED = 'Este campo es obligatorio.';
const CURRENT_INCORRECT = 'La contraseña actual no es correcta.';
const TOO_SHORT = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;

export const DEACTIVATE_TEXT: Record<'platform-administrator' | 'representative' | 'campaign-responsible', string> = {
  'platform-administrator': 'Administras la plataforma: esta cuenta no se puede desactivar. Antes, otra persona tiene que retirarte ese permiso.',
  representative: 'Representas a tu organización. Antes de desactivar tu cuenta, transfiere ese papel a otra persona de la organización.',
  'campaign-responsible': 'Eres responsable de una convocatoria que sigue abierta. Antes de desactivar tu cuenta, pide que asignen a otra persona.',
};

export function SecurityCard({ clients = DEFAULT_CLIENTS }: { clients?: SecurityClients }) {
  return (
    <section className={[s.card, s.wide].join(' ')} aria-labelledby="cardSecurityTitle" data-testid="security-card">
      <h2 id="cardSecurityTitle" className={s.cardTitle}>Seguridad</h2>
      <p className={s.sub}>Tu contraseña y el estado de tu cuenta.</p>
      <div className={s.securityGrid}>
        <ChangePasswordForm client={clients.changePassword} />
        <DeactivateBlock client={clients.deactivate} />
      </div>
    </section>
  );
}

function ChangePasswordForm({ client }: { client: SecurityClients['changePassword'] }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; repeat?: string }>({});
  const [result, setResult] = useState<'ok' | 'ambiguous' | 'error' | null>(null);
  const [sending, setSending] = useState(false);
  const strength = calculateStrength(next);

  const clear = () => { setCurrent(''); setNext(''); setRepeat(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!current) errs.current = REQUIRED;
    if (!next) errs.next = REQUIRED;
    else if (next.length < MIN_PASSWORD) errs.next = TOO_SHORT;
    if (!errs.next && repeat !== next) errs.repeat = 'Las contraseñas no coinciden.';
    setErrors(errs);
    setResult(null);
    if (errs.current || errs.next || errs.repeat) return;
    setSending(true);
    const r = await client(current, next);
    setSending(false);
    switch (r.kind) {
      case 'ok':
        // La sesión sigue con el token nuevo; las demás quedan revocadas
        session.replaceToken(r.token);
        clear();
        setResult('ok');
        return;
      case 'current-incorrect': setCurrent(''); setErrors({ current: CURRENT_INCORRECT }); return; // no cierra la sesión
      case 'too-short': setErrors({ next: TOO_SHORT }); return;
      case 'bad-request': setErrors({ current: current ? undefined : REQUIRED, next: next ? undefined : REQUIRED }); return;
      case 'changed-without-token': clear(); session.logoutWith('PASSWORD_CHANGED'); return;
      case 'network': clear(); setResult('ambiguous'); return;
      case 'unauthorized': clear(); return; // T-1 ya cerró la sesión
      case 'error': setResult('error'); return;
      default: { const unreachable: never = r; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate aria-labelledby="changePassTitle" data-testid="change-password-form">
      <h3 id="changePassTitle" className={s.blockTitle}>Cambiar contraseña</h3>
      <p className={s.note}>Al cambiarla se cierran tus otras sesiones; esta sigue abierta.</p>
      {result === 'ok' && <StatusNotice variant="success" text="Cambiamos tu contraseña. Cerramos tus otras sesiones." />}
      {result === 'ambiguous' && (
        <StatusNotice variant="ambiguous" title="No sabemos si tu contraseña cambió"
          text="No llegó la respuesta. Si cambió, tu sesión se cerrará y tendrás que entrar con la nueva. Si sigues dentro, inténtalo de nuevo." />
      )}
      {result === 'error' && <StatusNotice variant="rejected" text="No pudimos cambiar tu contraseña. Inténtalo de nuevo." />}
      <PasswordField label="Contraseña actual" autoComplete="current-password" value={current} error={errors.current}
        disabled={sending} onChange={(e) => setCurrent(e.target.value)} />
      <PasswordField label="Contraseña nueva" hint={`Al menos ${MIN_PASSWORD} caracteres.`} autoComplete="new-password" value={next}
        error={errors.next} disabled={sending} onChange={(e) => setNext(e.target.value)} />
      <div className={s.strength} aria-hidden="true">
        <div className={s.strengthTrack}><div className={s.strengthMeter} style={{ width: strength.width, backgroundColor: strength.color }} /></div>
        <span className={s.strengthLabel} style={{ color: strength.color }}>{strength.label}</span>
      </div>
      <PasswordField label="Repite la contraseña nueva" autoComplete="new-password" value={repeat} error={errors.repeat}
        disabled={sending} onChange={(e) => setRepeat(e.target.value)} />
      <Actions><Button type="submit" sending={sending}>Cambiar contraseña</Button></Actions>
    </form>
  );
}

function DeactivateBlock({ client }: { client: SecurityClients['deactivate'] }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<keyof typeof DEACTIVATE_TEXT | 'ambiguous' | 'error' | null>(null);
  const [sending, setSending] = useState(false);

  const close = () => { setOpen(false); setPassword(''); setError(undefined); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError(REQUIRED); return; }
    setError(undefined);
    setResult(null);
    setSending(true);
    const r = await client(password);
    setSending(false);
    switch (r.kind) {
      case 'ok': setPassword(''); session.logoutWith('DEACTIVATED'); return;
      case 'current-incorrect': setPassword(''); setError(CURRENT_INCORRECT); return;
      case 'bad-request': setError(REQUIRED); return;
      case 'platform-administrator':
      case 'representative':
      case 'campaign-responsible':
        close(); setResult(r.kind); return;
      case 'network': close(); setResult('ambiguous'); return;
      case 'unauthorized': setPassword(''); return;
      case 'error': close(); setResult('error'); return;
      default: { const unreachable: never = r; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
    }
  };

  return (
    <div aria-labelledby="deactivateTitle" role="group" data-testid="deactivate-block">
      <h3 id="deactivateTitle" className={s.blockTitle}>Desactivar mi cuenta</h3>
      <p className={s.note}>No podrás volver a entrar. No se borra nada: si fue un error, el administrador de la plataforma puede reactivarla.</p>
      {result === 'ambiguous' && (
        <StatusNotice variant="ambiguous" title="No sabemos si tu cuenta se desactivó"
          text="No llegó la respuesta. Si se desactivó, tu sesión se cerrará en cuanto sigas navegando." />
      )}
      {result === 'error' && <StatusNotice variant="rejected" text="No pudimos desactivar tu cuenta. Inténtalo de nuevo." />}
      {result && result !== 'ambiguous' && result !== 'error' && <StatusNotice variant="rejected" text={DEACTIVATE_TEXT[result]} />}
      <Actions><Button variant="secondary" className={s.danger} onClick={() => { setResult(null); setOpen(true); }}>Desactivar mi cuenta</Button></Actions>
      {open && (
        <Modal title="¿Desactivar tu cuenta?" onCancel={close}>
          <form onSubmit={(e) => void submit(e)} noValidate data-testid="deactivate-form">
            <p className={s.modalText}>Se cerrarán todas tus sesiones y no podrás volver a entrar. Tus donaciones y su recorrido no cambian. Escribe tu contraseña para confirmarlo.</p>
            <PasswordField label="Contraseña actual" autoComplete="current-password" value={password} error={error}
              disabled={sending} onChange={(e) => setPassword(e.target.value)} />
            <Actions>
              <Button variant="secondary" onClick={close} disabled={sending}>Cancelar</Button>
              <Button type="submit" className={s.dangerSolid} sending={sending}>Desactivar</Button>
            </Actions>
          </form>
        </Modal>
      )}
    </div>
  );
}
