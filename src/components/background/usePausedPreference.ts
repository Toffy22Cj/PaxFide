'use client';
// Ref: sistema-visual-paxfide-web-enmienda-1.md R-F2 y R-F3; plan-fase7-pantallas.md A-1 y A-2.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getPausedSnapshot, setPausedPreference, subscribePaused } from './animationPreference';

const getStorage = () => window.localStorage;

/** ¿El usuario pausó la animación? En el servidor (y al hidratar) no hay preferencia: `false`. */
export function usePausedPreference(): boolean {
  return useSyncExternalStore(subscribePaused, () => getPausedSnapshot(getStorage), () => false);
}

export function togglePausedPreference(current: boolean): void {
  setPausedPreference(getStorage, !current);
}

/**
 * `true` con "reducir movimiento" (R-F3): no hay nada que pausar. `null` hasta montar (en el servidor no se sabe), para
 * no enseñar un instante el botón de pausa a quien tiene el movimiento reducido. Sigue los cambios del sistema.
 */
export function useReducedMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') { setReduced(false); return; }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}
