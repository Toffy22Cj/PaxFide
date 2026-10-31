'use client';

// Ref: plan-fase7-puesta-al-dia.md P-1; plan-fase7-fidelidad.md F-C1 (R-5 + D1) y X-8; Documentos/paxfide-home.html
// (#sData, "¿Cómo te llamamos?"); referencia-api-v1.md §1, nota del 2026-10-25 (`GET`/`PUT /account/profile`). Paso
// opcional tras la bienvenida (D-F10): "Más tarde" sigue sin guardar nada. El nombre vive solo en el estado del
// formulario y solo viaja en `PUT /account/profile`; nunca en la URL ni en el almacenamiento.
import React, { useEffect, useState } from 'react';
import {
  fetchProfile, MAX_NAME, nameLength, updateProfile,
  type ProfileOutcome, type UpdateProfileOutcome,
} from '../../lib/api/account';
import { BrandDots } from '../loaders/BrandDots';
import s from '../../screens/access.module.css';

export interface NameGateClients {
  fetch: () => Promise<ProfileOutcome>;
  update: (givenName: string, familyName: string) => Promise<UpdateProfileOutcome>;
}

const DEFAULT_CLIENTS: NameGateClients = { fetch: fetchProfile, update: updateProfile };

/** Comprobación previa (el backend decide): de 1 a 100 puntos de código tras recortar; vacío = sin dato. */
export function nameError(v: string): string | undefined {
  return nameLength(v) > MAX_NAME ? `Escribe como máximo ${MAX_NAME} caracteres.` : undefined;
}

export function NameGate({ clients = DEFAULT_CLIENTS, onDone }: { clients?: NameGateClients; onDone: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [errors, setErrors] = useState<{ givenName?: string; familyName?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    void clients.fetch().catch(() => null).then((r) => {
      if (!alive || r?.kind !== 'ok') return;
      setEmail(r.profile.email);
      setGivenName((v) => v || r.profile.givenName || '');
      setFamilyName((v) => v || r.profile.familyName || '');
    });
    return () => { alive = false; };
  }, [clients]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = { givenName: nameError(givenName), familyName: nameError(familyName) };
    setErrors(next);
    setFailure(null);
    if (next.givenName || next.familyName) return;
    // Nada escrito (como el boceto): se pide al menos el nombre; "Más tarde" es la salida sin datos
    if (!givenName.trim() && !familyName.trim()) {
      setErrors({ givenName: 'Escribe al menos tu nombre, o elige "Más tarde".' });
      return;
    }
    setSending(true);
    const r = await clients.update(givenName, familyName);
    setSending(false);
    switch (r.kind) {
      case 'ok': onDone(); return;
      case 'invalid': setFailure(`Revisa los datos: cada campo admite de 1 a ${MAX_NAME} caracteres.`); return;
      case 'network': setFailure('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'); return;
      case 'unauthorized': return; // la sesión ya se cerró (T-1)
      case 'error': setFailure('No pudimos guardar tus datos. Puedes hacerlo más tarde desde tu perfil.'); return;
      default: { const unreachable: never = r; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
    }
  };

  return (
    <form className={[s.welcomeGate, s.nameGate].join(' ')} data-testid="name-gate" onSubmit={(e) => void submit(e)} noValidate aria-labelledby="nameGateTitle">
      <h1 id="nameGateTitle" className={s.welcomeTitle}>¿Cómo te llamamos?</h1>
      <p className={s.welcomeLead}>Así te saludamos y te identificamos dentro de tu organización. Puedes completarlo ahora o más tarde desde tu perfil.</p>
      {failure && <div className={[s.feedbackMsg, s.feedbackError].join(' ')} role="alert">{failure}</div>}
      <div className={s.gateFields}>
      <div className={s.row2}>
        <div className={s.field}>
          <label htmlFor="gName" className={s.label}>Nombre</label>
          <input id="gName" className={[s.input, s.inputPlain].join(' ')} autoComplete="given-name" value={givenName} disabled={sending}
            onChange={(e) => setGivenName(e.target.value)} aria-invalid={errors.givenName ? true : undefined}
            aria-describedby={errors.givenName ? 'gName-e' : undefined} />
          {errors.givenName && <span id="gName-e" className={s.fieldError}>{errors.givenName}</span>}
        </div>
        <div className={s.field}>
          <label htmlFor="fName" className={s.label}>Apellido</label>
          <input id="fName" className={[s.input, s.inputPlain].join(' ')} autoComplete="family-name" value={familyName} disabled={sending}
            onChange={(e) => setFamilyName(e.target.value)} aria-invalid={errors.familyName ? true : undefined}
            aria-describedby={errors.familyName ? 'fName-e' : undefined} />
          {errors.familyName && <span id="fName-e" className={s.fieldError}>{errors.familyName}</span>}
        </div>
      </div>
      {email && (
        <div className={s.field}>
          <label htmlFor="gMail" className={s.label}>Correo de la cuenta</label>
          <input id="gMail" className={[s.input, s.inputPlain, s.readonlyInput].join(' ')} value={email} readOnly aria-readonly="true" />
        </div>
      )}
      </div>
      <div className={s.privacy}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l7 4v5c0 4-3 7.5-7 9-4-1.5-7-5-7-9V7z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <span>Tu nombre se queda en tu cuenta. No aparece en el recorrido público de las donaciones ni en la blockchain.</span>
      </div>
      <div className={s.gateActions}>
        <button type="button" className={s.secondaryBtn} onClick={onDone} disabled={sending}>Más tarde</button>
        <button type="submit" className={s.submitBtn} disabled={sending} aria-busy={sending || undefined}>
          <span>Guardar y continuar</span>
          {sending && <BrandDots aria-hidden="true" />}
        </button>
      </div>
      <div className={s.welcomeDots} aria-hidden="true">
        <span className={s.welcomeDot} />
        <span className={[s.welcomeDot, s.welcomeDotActive].join(' ')} />
        <span className={s.welcomeDot} />
      </div>
    </form>
  );
}
