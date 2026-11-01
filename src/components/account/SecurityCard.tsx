'use client';

// Ref: plan-fase7-puesta-al-dia.md P-1; plan-fase7-fidelidad.md F-C1 (R-3+R-2, D6) y X-9; paxfide-home.html (vProfile,
// "Seguridad y Criptografía"); referencia-api-v1.md §1 (`POST /account/password`, nota ADR-038 #7; nota del 2026-10-25
// de `POST /account/deactivate`). Sin `Command-Id`: sin respuesta no se repite solo; se avisa en amarillo (D6) y la
// persona decide. Las contraseñas viven solo en el estado del formulario.
// Anexo 6 (G-W5 a G-W7): "Cuenta de Google", vincular y desvincular con la contraseña actual. Ninguna ruta dice si hay un
// vínculo, así que las dos acciones están siempre y los textos no afirman el estado.
import React, { useState } from 'react';
import {
  changePassword, deactivateAccount, linkGoogle, unlinkGoogle, MIN_PASSWORD,
  type ChangePasswordOutcome, type DeactivateOutcome, type GoogleLinkOutcome, type GoogleUnlinkOutcome,
} from '../../lib/api/account';
import { googleClientId, type GoogleIdApi } from '../../lib/google/gis';
import { isSurfaceEnabled } from '../../lib/routing/surfaces';
import { GoogleButton } from '../access/GoogleButton';
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
  linkGoogle?: (idToken: string, current: string) => Promise<GoogleLinkOutcome>;
  unlinkGoogle?: (current: string) => Promise<GoogleUnlinkOutcome>;
  /** Para los tests: la carga de Google Identity Services y el ID de cliente. */
  googleLoader?: () => Promise<GoogleIdApi>;
  googleClientId?: string | null;
}

const DEFAULT_CLIENTS: SecurityClients = { changePassword, deactivate: deactivateAccount, linkGoogle, unlinkGoogle };

const REQUIRED = 'Este campo es obligatorio.';
const CURRENT_INCORRECT = 'La contraseña actual no es correcta.';
const TOO_SHORT = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;

export const DEACTIVATE_TEXT: Record<'platform-administrator' | 'representative' | 'campaign-responsible', string> = {
  'platform-administrator': 'Administras la plataforma: esta cuenta no se puede desactivar. Antes, otra persona tiene que retirarte ese permiso.',
  representative: 'Representas a tu organización. Antes de desactivar tu cuenta, transfiere ese papel a otra persona de la organización.',
  'campaign-responsible': 'Eres responsable de una convocatoria que sigue abierta. Antes de desactivar tu cuenta, pide que asignen a otra persona.',
};

export function SecurityCard({ clients = DEFAULT_CLIENTS }: { clients?: SecurityClients }) {
  const clientId = clients.googleClientId === undefined ? googleClientId() : clients.googleClientId;
  const showGoogle = isSurfaceEnabled('action:google-link') && Boolean(clientId);
  return (
    <section className={[s.card, s.wide].join(' ')} aria-labelledby="cardSecurityTitle" data-testid="security-card">
      <h2 id="cardSecurityTitle" className={s.cardTitle}>Seguridad</h2>
      <p className={s.sub}>Tu contraseña y el estado de tu cuenta.</p>
      <div className={s.securityGrid}>
        <ChangePasswordForm client={clients.changePassword} />
        {showGoogle && (
          <GoogleLinkBlock link={clients.linkGoogle ?? linkGoogle} unlink={clients.unlinkGoogle ?? unlinkGoogle}
            loader={clients.googleLoader} clientId={clientId} />
        )}
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

/** G-W6: los textos de los errores al vincular. */
export const GOOGLE_LINK_TEXT: Record<'google-invalid' | 'google-taken' | 'already-linked' | 'google-unavailable', string> = {
  'google-invalid': 'Google no confirmó tu cuenta. Inténtalo de nuevo.',
  'google-taken': 'Esa cuenta de Google ya está vinculada a otra cuenta de PaxFide.',
  'already-linked': 'Tu cuenta ya tiene otra cuenta de Google vinculada. Desvincúlala primero.',
  'google-unavailable': 'Google no responde ahora. Inténtalo más tarde.',
};

type LinkResult = 'linked' | 'unlinked' | 'ambiguous-link' | 'ambiguous-unlink' | 'error' | keyof typeof GOOGLE_LINK_TEXT | null;

function GoogleLinkBlock({ link, unlink, loader, clientId }: {
  link: NonNullable<SecurityClients['linkGoogle']>;
  unlink: NonNullable<SecurityClients['unlinkGoogle']>;
  loader?: () => Promise<GoogleIdApi>;
  clientId: string | null;
}) {
  const [open, setOpen] = useState<'link' | 'unlink' | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<LinkResult>(null);
  const [sending, setSending] = useState(false);

  const close = () => { setOpen(null); setPassword(''); setError(undefined); };
  const start = (which: 'link' | 'unlink') => { setResult(null); setError(undefined); setPassword(''); setOpen(which); };

  /** G-W5: la contraseña ya está escrita (el botón de Google solo aparece con ella). */
  const onCredential = async (idToken: string) => {
    if (sending) return;
    if (!password) { setError(REQUIRED); return; }
    setSending(true);
    const r = await link(idToken, password);
    setSending(false);
    switch (r.kind) {
      case 'ok': close(); setResult('linked'); return;
      case 'current-incorrect': setPassword(''); setError(CURRENT_INCORRECT); return;
      case 'google-invalid':
      case 'google-taken':
      case 'already-linked':
      case 'google-unavailable':
        close(); setResult(r.kind); return;
      case 'network': close(); setResult('ambiguous-link'); return;
      case 'unauthorized': setPassword(''); return; // T-1 ya cerró la sesión
      case 'error': close(); setResult('error'); return;
      default: { const unreachable: never = r; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
    }
  };

  const submitUnlink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError(REQUIRED); return; }
    setError(undefined);
    setSending(true);
    const r = await unlink(password);
    setSending(false);
    switch (r.kind) {
      case 'ok': close(); setResult('unlinked'); return;
      case 'current-incorrect': setPassword(''); setError(CURRENT_INCORRECT); return;
      case 'network': close(); setResult('ambiguous-unlink'); return;
      case 'unauthorized': setPassword(''); return;
      case 'error': close(); setResult('error'); return;
      default: { const unreachable: never = r; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
    }
  };

  return (
    <div aria-labelledby="googleLinkTitle" role="group" data-testid="google-link-block">
      <h3 id="googleLinkTitle" className={s.blockTitle}>Cuenta de Google</h3>
      <p className={s.note}>Vincula una cuenta de Google para entrar con ella, además de con tu contraseña. Para vincularla o desvincularla te pedimos tu contraseña actual.</p>
      {result === 'linked' && <StatusNotice variant="success" text="Vinculamos tu cuenta de Google. Ya puedes entrar con ella." />}
      {result === 'unlinked' && <StatusNotice variant="success" text="Listo. Si tenías una cuenta de Google vinculada, ya no podrás entrar con ella." />}
      {result === 'ambiguous-link' && (
        <StatusNotice variant="ambiguous" title="No sabemos si se vinculó"
          text="No llegó la respuesta. Puedes repetirlo con la misma cuenta de Google: si ya quedó vinculada, no cambia nada." />
      )}
      {result === 'ambiguous-unlink' && (
        <StatusNotice variant="ambiguous" title="No sabemos si se desvinculó"
          text="No llegó la respuesta. Puedes repetirlo: si ya no había vínculo, no cambia nada." />
      )}
      {result === 'error' && <StatusNotice variant="rejected" text="No pudimos completar el cambio. Inténtalo de nuevo." />}
      {result && result in GOOGLE_LINK_TEXT && <StatusNotice variant="rejected" text={GOOGLE_LINK_TEXT[result as keyof typeof GOOGLE_LINK_TEXT]} />}
      <Actions>
        <Button variant="secondary" onClick={() => start('link')}>Vincular Google</Button>
        <Button variant="secondary" onClick={() => start('unlink')}>Desvincular Google</Button>
      </Actions>
      {open === 'link' && (
        <Modal title="Vincular tu cuenta de Google" onCancel={close}>
          <div data-testid="google-link-form">
            <p className={s.modalText}>Escribe tu contraseña actual y después elige tu cuenta de Google. Te avisaremos por correo.</p>
            <PasswordField label="Contraseña actual" autoComplete="current-password" value={password} error={error}
              disabled={sending} onChange={(e) => { setPassword(e.target.value); setError(undefined); }} />
            {password ? (
              <GoogleButton text="signin_with" loader={loader} clientId={clientId} onCredential={(t) => void onCredential(t)} />
            ) : (
              <p className={s.note} data-testid="google-link-needs-password">Escribe tu contraseña para continuar con Google.</p>
            )}
            <Actions><Button variant="secondary" onClick={close} disabled={sending}>Cancelar</Button></Actions>
          </div>
        </Modal>
      )}
      {open === 'unlink' && (
        <Modal title="¿Desvincular tu cuenta de Google?" onCancel={close}>
          <form onSubmit={(e) => void submitUnlink(e)} noValidate data-testid="google-unlink-form">
            <p className={s.modalText}>Si tenías una cuenta de Google vinculada, ya no podrás entrar con ella; tu contraseña sigue igual. Escribe tu contraseña para confirmarlo.</p>
            <PasswordField label="Contraseña actual" autoComplete="current-password" value={password} error={error}
              disabled={sending} onChange={(e) => setPassword(e.target.value)} />
            <Actions>
              <Button variant="secondary" onClick={close} disabled={sending}>Cancelar</Button>
              <Button type="submit" sending={sending}>Desvincular</Button>
            </Actions>
          </form>
        </Modal>
      )}
    </div>
  );
}
