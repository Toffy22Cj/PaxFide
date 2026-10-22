// Ref: Documentos/prompts-agentes-estilo-v2.md VS-1; Documentos/plan-vs1-movimiento.md §1–§2.
import React from 'react';
import s from './ui.module.css';
import { BrandDots } from '../loaders/BrandDots';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  block?: boolean;
  /** "Enviando" conserva el texto visible y añade puntos de marca (06); deshabilitar es protección de UX, no idempotencia (ADR-041 §2.6). */
  sending?: boolean;
};

export function Button({ variant = 'primary', block, sending, children, disabled, className, type, ...rest }: Props) {
  return (
    <button
      type={type ?? 'button'}
      className={[s.button, s[variant], block ? s.block : '', className ?? ''].join(' ')}
      disabled={disabled || sending}
      aria-busy={sending || undefined}
      {...rest}
    >
      {children}
      {sending && <BrandDots aria-hidden="true" />}
    </button>
  );
}

