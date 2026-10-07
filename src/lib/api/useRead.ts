'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Estado de una lectura: reintentarla siempre es seguro (§6). */
export type ReadState<T, E extends string = never> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: E };

/**
 * Ejecuta una lectura al montar y cuando cambian `deps`; descarta respuestas de lecturas anteriores. Nunca reintenta
 * sola: "Reintentar" es una acción del usuario.
 */
export function useRead<T, E extends string>(load: () => Promise<ReadState<T, E>>, deps: unknown[]) {
  const [state, setState] = useState<ReadState<T, E>>({ status: 'loading' });
  const seq = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => {
    const mine = ++seq.current;
    setState({ status: 'loading' });
    loadRef.current().then(
      (next) => { if (mine === seq.current) setState(next); },
      () => { if (mine === seq.current) setState({ status: 'error' } as ReadState<T, E>); },
    );
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);

  return { state, reload };
}
