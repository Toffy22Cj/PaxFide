// Ref: Documentos/plan-fase7-pantallas.md §5 B-1; Documentos/sistema-visual-paxfide-web-enmienda-1.md §7.1.
import React from 'react';
import s from './ui.module.css';
import { BrandDots } from '../loaders/BrandDots';

export type ButtonVariant = 'primary' | 'secondary' | 'emphasis';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  block?: boolean;
  /** "Enviando" conserva el texto visible y añade puntos de marca (06); deshabilitar es protección de UX, no idempotencia (ADR-041 §2.6). */
  sending?: boolean;
};

export function Button({ variant = 'primary', block, sending, children, disabled, className, type, ...rest }: ButtonProps) {
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
