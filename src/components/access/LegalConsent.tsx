'use client';
// Ref: plan-fase7-puesta-al-dia.md R-1, R-3 y U-2; referencia-api-v1.md §1 (nota R-5 y nota D3); plan-fase7-fidelidad.md
// X-5 y D-F17 (los textos en /terminos, /privacidad y /terminos-organizacion). Una casilla sin marcar por cada texto,
// con enlace a su texto en una pestaña nueva. Quien la monta decide qué hacer con `checked`.
import React, { useId } from 'react';
import { LEGAL_PATHS, type LegalDocumentKey } from '../../lib/legal/versions';
import s from './LegalConsent.module.css';

const TEXT: Record<LegalDocumentKey, { before: string; link: string; after: string }> = {
  terms: { before: 'Acepto los ', link: 'Términos y condiciones', after: '' },
  dataPolicy: { before: 'Autorizo el ', link: 'tratamiento de mis datos personales', after: '' },
  organizationTerms: { before: 'Acepto los ', link: 'Términos para organizaciones', after: '' },
};

/** El texto accesible de cada casilla (para los tests y para quien lo cite). */
export function consentLabel(doc: LegalDocumentKey): string {
  const t = TEXT[doc];
  return `${t.before}${t.link}${t.after}`;
}

export function LegalConsent({ doc, checked, onChange, disabled }: {
  doc: LegalDocumentKey;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const t = TEXT[doc];
  return (
    <div className={s.consent}>
      <input id={id} type="checkbox" className={s.box} checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} data-testid={`consent-${doc}`} />
      <label htmlFor={id} className={s.label}>
        {t.before}
        <a href={LEGAL_PATHS[doc]} target="_blank" rel="noopener noreferrer" className={s.link}>
          {t.link}<span className={s.srOnly}> (se abre en una pestaña nueva)</span>
        </a>
        {t.after}
      </label>
    </div>
  );
}
