'use client';
// Ref: plan-fase7-puesta-al-dia.md Anexo 2, U-15 y U-16 (bienvenida grande sobre el inicio; sustituye la de D-F10 en
// LoginScreen). Boceto: paxfide-home.html, #sWelcome y #sData. Tres pasos: bienvenida, la barra que la cuenta ve de
// verdad (`navEntriesFor`) y "¿Cómo te llamamos?" (`PUT /account/profile`, ADR-050 D1). El nombre solo vive en el
// estado del formulario y solo viaja en esa ruta.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MAX_NAME, updateProfile, type PersonalProfile, type UpdateProfileOutcome } from '../../lib/api/account';
import type { NavEntry } from '../../lib/nav/navEntries';
import { navEntryLine } from '../../lib/welcome/welcome';
import { nameError } from '../access/NameGate';
import { NavIconSvg } from '../nav/icons';
import { BrandMark } from '../shell/BrandMark';
import { BrandDots } from '../loaders/BrandDots';
import s from '../../screens/access.module.css';
import w from './welcome.module.css';

export type WelcomeClose = 'skip' | 'later' | 'saved';

const STEPS = 3;

function Dots({ step }: { step: number }) {
  return (
    <div className={s.welcomeDots} aria-hidden="true" data-testid="welcome-dots">
      {Array.from({ length: STEPS }, (_, i) => (
        <span key={i} className={[s.welcomeDot, i === step ? s.welcomeDotActive : ''].join(' ')} />
      ))}
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function WelcomeOverlay({ entries, email, onClose, update = updateProfile }: {
  entries: NavEntry[];
  email?: string;
  onClose: (how: WelcomeClose, profile?: PersonalProfile) => void;
  update?: (givenName: string, familyName: string) => Promise<UpdateProfileOutcome>;
}) {
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // El foco entra en la capa y se queda dentro (Tab y Mayús+Tab dan la vuelta); Escape la cierra como "Saltar"
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('h2');
    first?.focus();
  }, [step]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose('skip'); return; }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const firstItem = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const inside = active && ref.current.contains(active);
    if (e.shiftKey && (!inside || active === firstItem || active?.tagName === 'H2')) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); firstItem.focus(); }
  };

  const titleId = `welcome-step-${step}`;
  // A pantalla completa: fuera del <main> (que tiene su propio contexto de apilamiento), por encima de cabecera y barra
  return createPortal(
    <div className={w.layer} data-testid="welcome-overlay">
      <div ref={ref} className={w.card} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <div className={w.top}>
          <div className={s.brand}><BrandMark size={28} /><span>PaxFide</span></div>
          <button type="button" className={w.skip} onClick={() => onClose('skip')}>Saltar</button>
        </div>
        {step === 0 && <StepWelcome titleId={titleId} onNext={() => setStep(1)} />}
        {step === 1 && <StepNav titleId={titleId} entries={entries} onNext={() => setStep(2)} />}
        {step === 2 && <StepName titleId={titleId} email={email} update={update}
          onLater={() => onClose('later')} onSaved={(p) => onClose('saved', p)} />}
        <Dots step={step} />
      </div>
    </div>,
    document.body,
  );
}

function StepWelcome({ titleId, onNext }: { titleId: string; onNext: () => void }) {
  return (
    <div className={[s.welcomeGate, w.step].join(' ')} data-testid="welcome-step-1">
      <div className={s.chain} aria-hidden="true">
        <svg className={s.chainCube} viewBox="0 0 56 56">
          <path d="M28 6l20 11-20 11L8 17z" className={s.cubeBlueTop} />
          <path d="M8 17l20 11v22L8 39z" className={s.cubeBlueLeft} />
          <path d="M48 17L28 28v22l20-11z" className={s.cubeBlueRight} />
        </svg>
        <span className={s.chainLink} />
        <svg className={s.chainCube} viewBox="0 0 56 56">
          <path d="M28 6l20 11-20 11L8 17z" className={s.cubeGreenTop} />
          <path d="M8 17l20 11v22L8 39z" className={s.cubeGreenLeft} />
          <path d="M48 17L28 28v22l20-11z" className={s.cubeGreenRight} />
        </svg>
        <span className={s.chainLink} />
        <svg className={s.chainCube} viewBox="0 0 56 56">
          <path d="M28 6l20 11-20 11L8 17z" className={s.cubeYellowTop} />
          <path d="M8 17l20 11v22L8 39z" className={s.cubeYellowLeft} />
          <path d="M48 17L28 28v22l20-11z" className={s.cubeYellowRight} />
        </svg>
        <span className={s.seal}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
      </div>
      <h2 id={titleId} tabIndex={-1} className={s.welcomeTitle}>Te damos la bienvenida a PaxFide</h2>
      <p className={s.welcomeLead}>Esto es lo que puedes hacer aquí:</p>
      <ul className={s.featuresList}>
        <li className={s.featureItem}>
          <span className={`${s.featureIcon} ${s.featureIconGreen}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" />
            </svg>
          </span>
          <div className={s.featureText}>
            <b>Dona a convocatorias verificadas</b>
            <span>Cada organización pasa por una revisión antes de publicar.</span>
          </div>
        </li>
        <li className={s.featureItem}>
          <span className={`${s.featureIcon} ${s.featureIconBlue}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="18" r="2" />
              <circle cx="18" cy="6" r="2" />
              <path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" />
            </svg>
          </span>
          <div className={s.featureText}>
            <b>Sigue el recorrido de tu ayuda</b>
            <span>Del pago a la compra, el despacho y la entrega.</span>
          </div>
        </li>
        <li className={s.featureItem}>
          <span className={`${s.featureIcon} ${s.featureIconYellow}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
              <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
            </svg>
          </span>
          <div className={s.featureText}>
            <b>Cada paso queda sellado</b>
            <span>Se registra de forma que no se puede cambiar sin que se note.</span>
          </div>
        </li>
      </ul>
      <button type="button" className={s.submitBtn} onClick={onNext}><span>Continuar</span></button>
    </div>
  );
}

const EXTRA: { id: string; title: string; text: string; d: string }[] = [
  { id: 'city', title: 'Ver ciudad', text: 'Oculta el panel un momento para recorrer la ciudad.', d: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6' },
  { id: 'theme', title: 'Tema', text: 'Claro, oscuro o como el sistema, en la cabecera.', d: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z' },
  { id: 'pause', title: 'Pausar animación', text: 'Detén el movimiento de la ciudad cuando quieras.', d: 'M9 5v14M15 5v14' },
];

function StepNav({ titleId, entries, onNext }: { titleId: string; entries: NavEntry[]; onNext: () => void }) {
  return (
    <div className={[s.welcomeGate, w.step].join(' ')} data-testid="welcome-step-2">
      <h2 id={titleId} tabIndex={-1} className={s.welcomeTitle}>Así te mueves por PaxFide</h2>
      <ul className={w.list} data-testid="welcome-nav">
        {entries.map((e) => (
          <li key={e.id} className={w.item} data-testid={`welcome-nav-${e.id}`}>
            <span className={w.icon} aria-hidden="true"><NavIconSvg id={e.id} /></span>
            <div className={s.featureText}><b>{e.label}</b><span>{navEntryLine(e.id)}</span></div>
          </li>
        ))}
        {EXTRA.map((x) => (
          <li key={x.id} className={w.item}>
            <span className={w.icon} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={x.d} /></svg>
            </span>
            <div className={s.featureText}><b>{x.title}</b><span>{x.text}</span></div>
          </li>
        ))}
      </ul>
      <button type="button" className={s.submitBtn} onClick={onNext}><span>Continuar</span></button>
    </div>
  );
}

function StepName({ titleId, email, update, onLater, onSaved }: {
  titleId: string;
  email?: string;
  update: (givenName: string, familyName: string) => Promise<UpdateProfileOutcome>;
  onLater: () => void;
  onSaved: (p: PersonalProfile) => void;
}) {
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [errors, setErrors] = useState<{ givenName?: string; familyName?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = { givenName: nameError(givenName), familyName: nameError(familyName) };
    setErrors(next);
    setFailure(null);
    if (next.givenName || next.familyName) return;
    if (!givenName.trim() && !familyName.trim()) {
      setErrors({ givenName: 'Escribe al menos tu nombre, o elige "Después".' });
      return;
    }
    setSending(true);
    const r = await update(givenName, familyName);
    setSending(false);
    switch (r.kind) {
      case 'ok': onSaved(r.profile); return;
      case 'invalid': setFailure(`Revisa los datos: cada campo admite de 1 a ${MAX_NAME} caracteres.`); return;
      case 'network': setFailure('No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'); return;
      case 'unauthorized': return; // la sesión ya se cerró (T-1)
      case 'error': setFailure('No pudimos guardar tus datos. Puedes hacerlo más tarde desde tu perfil.'); return;
      default: { const unreachable: never = r; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
    }
  };

  return (
    <form className={[s.welcomeGate, s.nameGate, w.step].join(' ')} data-testid="welcome-step-3" onSubmit={(e) => void submit(e)} noValidate>
      <h2 id={titleId} tabIndex={-1} className={s.welcomeTitle}>¿Cómo te llamamos?</h2>
      <p className={s.welcomeLead}>Así te saludamos y te identificamos dentro de tu organización. Puedes completarlo ahora o más tarde desde tu perfil.</p>
      {failure && <div className={[s.feedbackMsg, s.feedbackError].join(' ')} role="alert">{failure}</div>}
      <div className={s.gateFields}>
        <div className={s.row2}>
          <div className={s.field}>
            <label htmlFor="wName" className={s.label}>Nombre</label>
            <input id="wName" className={[s.input, s.inputPlain].join(' ')} autoComplete="given-name" value={givenName} disabled={sending}
              onChange={(e) => setGivenName(e.target.value)} aria-invalid={errors.givenName ? true : undefined}
              aria-describedby={errors.givenName ? 'wName-e' : undefined} />
            {errors.givenName && <span id="wName-e" className={s.fieldError}>{errors.givenName}</span>}
          </div>
          <div className={s.field}>
            <label htmlFor="wFamily" className={s.label}>Apellido</label>
            <input id="wFamily" className={[s.input, s.inputPlain].join(' ')} autoComplete="family-name" value={familyName} disabled={sending}
              onChange={(e) => setFamilyName(e.target.value)} aria-invalid={errors.familyName ? true : undefined}
              aria-describedby={errors.familyName ? 'wFamily-e' : undefined} />
            {errors.familyName && <span id="wFamily-e" className={s.fieldError}>{errors.familyName}</span>}
          </div>
        </div>
        {email && (
          <div className={s.field}>
            <label htmlFor="wMail" className={s.label}>Correo de la cuenta</label>
            <input id="wMail" className={[s.input, s.inputPlain, s.readonlyInput].join(' ')} value={email} readOnly aria-readonly="true" />
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
        <button type="button" className={s.secondaryBtn} onClick={onLater} disabled={sending}>Después</button>
        <button type="submit" className={s.submitBtn} disabled={sending} aria-busy={sending || undefined}>
          <span>Guardar</span>
          {sending && <BrandDots aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}
