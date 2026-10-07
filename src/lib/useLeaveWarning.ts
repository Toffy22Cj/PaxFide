'use client';

import { useEffect } from 'react';

/**
 * A3 (Enmienda 1 de ADR-046, APROBADA): mientras `active`, avisa antes de salir de la página.
 * - Recargar, cerrar o salir del sitio: `beforeunload` (el navegador muestra su propio texto).
 * - Enlaces de la propia web (navegación de cliente, que también desmonta la página): confirmación con `message`.
 * No guarda nada: solo evita perder por accidente lo que vive en memoria.
 */
export function useLeaveWarning(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    // Fase de captura en el documento: corre antes que el manejador de `next/link`, que respeta `defaultPrevented`
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [active, message]);
}
