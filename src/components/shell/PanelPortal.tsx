'use client';

// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F7; Documentos/paxfide-panel.html (.portal, enterPanel, exitPanel)
import React, { useEffect, useState } from 'react';
import s from './PanelPortal.module.css';

export interface PanelPortalProps {
  mode: 'enter' | 'exit' | null;
  onComplete: () => void;
}

export function PanelPortal({ mode, onComplete }: PanelPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!mode) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      onComplete();
      return;
    }
    setMounted(true);
    // calc(2 * 350ms) + 350ms + 100ms fade = ~1150ms total
    const timer = setTimeout(() => {
      setMounted(false);
      onComplete();
    }, 1150);
    return () => clearTimeout(timer);
  }, [mode, onComplete]);

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
