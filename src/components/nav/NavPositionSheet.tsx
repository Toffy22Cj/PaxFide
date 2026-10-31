'use client';

// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F8; Documentos/paxfide-home.html (#tune, #posGroup)
import React, { useEffect, useRef } from 'react';
import type { NavPosition } from '../../lib/nav/navEntries';
import s from './NavPositionSheet.module.css';

export interface NavPositionSheetProps {
  isOpen: boolean;
  currentPosition: NavPosition;
  isCustom: boolean;
  onSelectPosition: (pos: NavPosition) => void;
  onClose: () => void;
}

const POSITIONS: readonly [NavPosition, string][] = [
  ['top', 'Arriba'],
  ['bottom', 'Abajo'],
  ['left', 'Izquierda'],
  ['right', 'Derecha'],
];

export function NavPositionSheet({
  isOpen,
  currentPosition,
  isCustom,
  onSelectPosition,
  onClose,
}: NavPositionSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (lastActiveRef.current) {
        lastActiveRef.current.focus();
        lastActiveRef.current = null;
      }
      return;
    }

    lastActiveRef.current = (document.activeElement as HTMLElement) || null;

    // Foco en la opción seleccionada al abrir
    const timer = setTimeout(() => {
      activeBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const curIdx = POSITIONS.findIndex(([p]) => p === currentPosition);
        const nextIdx = (curIdx + 1) % POSITIONS.length;
        onSelectPosition(POSITIONS[nextIdx][0]);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const curIdx = POSITIONS.findIndex(([p]) => p === currentPosition);
        const nextIdx = (curIdx - 1 + POSITIONS.length) % POSITIONS.length;
        onSelectPosition(POSITIONS[nextIdx][0]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, currentPosition, onSelectPosition, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={s.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="nav-position-sheet"
    >
      <div
        ref={dialogRef}
        className={s.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tuneTitle"
      >
        <div className={s.grab} aria-hidden="true" />
        <h2 id="tuneTitle" className={s.title}>¿Dónde quieres la barra?</h2>
        <p className={s.sub}>Se aplica al momento y se recuerda en este dispositivo.</p>

        <div
          className={s.posGroup}
          role="radiogroup"
          aria-labelledby="tuneTitle"
          id="posGroup"
        >
          {POSITIONS.map(([pos, label]) => {
            const isSelected = currentPosition === pos;
            return (
              <button
                key={pos}
                ref={isSelected ? activeBtnRef : null}
                type="button"
                role="radio"
                data-p={pos}
                aria-checked={isSelected}
                className={s.posBtn}
                onClick={() => onSelectPosition(pos)}
              >
                <span className={s.mini} data-p={pos} aria-hidden="true">
                  <i />
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className={s.foot}>
          <small className={s.hint}>
            {isCustom ? 'Elegida por ti.' : 'Automática según el tamaño de la pantalla.'}
          </small>
          <button
            type="button"
            className={s.doneBtn}
            onClick={onClose}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
