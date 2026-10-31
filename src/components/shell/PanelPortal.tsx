'use client';

// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F7; Documentos/paxfide-panel.html (.portal, enterPanel, exitPanel)
import React, { useEffect, useRef, useState } from 'react';
import s from './PanelPortal.module.css';

export interface PanelPortalProps {
  mode: 'enter' | 'exit' | null;
  onComplete: () => void;
}

export function PanelPortal({ mode, onComplete }: PanelPortalProps) {
  const [mounted, setMounted] = useState(false);
  // El Shell pasa una función nueva en cada render (p. ej. al llegar GET /me): si el efecto dependiera de ella, cada
  // render reiniciaría el temporizador y el portal se quedaría tapando la pantalla. Solo el modo arranca la secuencia.
  const done = useRef(onComplete);
  done.current = onComplete;

  useEffect(() => {
    if (!mode) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      done.current();
      return;
    }
    setMounted(true);
    // calc(2 * 350ms) + 350ms + el fundido final (D-F7, paso 3) ≈ 1150 ms
    const timer = setTimeout(() => {
      setMounted(false);
      done.current();
    }, 1150);
    return () => clearTimeout(timer);
  }, [mode]);

  if (!mode || !mounted) return null;

  return (
    <div
      className={[s.wrap, mode === 'enter' ? s.enter : s.exit].join(' ')}
      data-testid="panel-portal"
      aria-hidden="true"
    >
      <div className={s.greenLayer} />
      <div className={s.panelLayer} />
    </div>
  );
}
