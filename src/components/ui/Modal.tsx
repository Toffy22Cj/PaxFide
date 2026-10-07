'use client';

import React, { useEffect, useId, useRef } from 'react';
import s from './ui.module.css';
import { Icon } from './Icons';

/**
 * Modal (§4): un título, contenido, Cancelar + Primario. Foco atrapado; Escape = Cancelar; al cerrar, el foco vuelve
 * al elemento que lo abrió. No es una ruta y no se restaura.
 */
export function Modal({ title, onCancel, children }: { title: string; onCancel: () => void; children: React.ReactNode }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    return () => {
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const focusables = Array.from(ref.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className={s.overlay}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={s.modal} onKeyDown={onKeyDown}>
        <div className={s.modalHeader}>
          <h2 id={titleId} className={s.sectionTitle}>{title}</h2>
          <button type="button" className={s.iconButton} onClick={onCancel} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
