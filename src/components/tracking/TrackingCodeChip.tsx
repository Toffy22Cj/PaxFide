'use client';
// Ref: prompts-agentes-estilo-v2.md §3.5 (T1-1 a T1-7, Carlos 2026-10-21); plan-fase7-pantallas.md A-4.
import React, { useEffect, useRef, useState } from 'react';
import s from './tracking.module.css';

/** T1-4: el código revelado vuelve a ocultarse a los 30 s. */
export const REVEAL_MS = 30_000;

/** T1-1: solo los 4 últimos caracteres. Un código más corto se tapa entero. */
export function maskTrackingCode(code: string): string {
  return code.length > 4 ? `···${code.slice(-4)}` : '····';
}

/**
 * El código de seguimiento en pantalla. Oculto por defecto; mientras lo está, el código completo no está en el DOM
 * (T1-5): solo en la memoria de esta pantalla. "Copiar" no lo revela (T1-3).
 */
export function TrackingCodeChip({ code }: { code: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setRevealed(false);
  };

  useEffect(() => {
    if (!revealed) return;
    timer.current = setTimeout(hide, REVEAL_MS);
    const onVisibility = () => { if (document.hidden) hide(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [revealed]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  return (
    <div className={s.code}>
      <span className={s.codeLabel}>Código de seguimiento</span>
      <span className={s.codeValue} data-testid="tracking-code-shown">{revealed ? code : maskTrackingCode(code)}</span>
      <div className={s.codeActions}>
        <button type="button" className={s.smallButton} onClick={() => (revealed ? hide() : setRevealed(true))} aria-pressed={revealed}>
          {revealed ? 'Ocultar' : 'Ver código'}
        </button>
        <button type="button" className={s.smallButton} onClick={() => void copy()}>Copiar</button>
      </div>
      <p className={s.codeWarning}>Este código abre tu seguimiento. No lo compartas en capturas.</p>
      <p className={s.codeStatus} aria-live="polite" data-testid="tracking-code-copied">
        {copied === 'ok' ? 'Código copiado' : copied === 'fail' ? 'No pudimos copiar el código.' : ''}
      </p>
    </div>
  );
}
