import React from 'react';
import s from './ui.module.css';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  block?: boolean;
  /** "Enviando" conserva el texto y añade "…"; deshabilitar es protección de UX, no idempotencia (ADR-041 §2.6). */
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
      {sending ? '…' : ''}
    </button>
  );
}
