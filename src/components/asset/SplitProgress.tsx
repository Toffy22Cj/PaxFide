'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fetchSplitStatus, SplitStatusOutcome } from '../../lib/api/assetCommands';
import { StatusNotice } from '../States';
import { Button } from '../ui/Button';
import { Actions } from '../ui/Layout';

const INTERVAL_MS = 1500;
const MAX_POLLS = 20;

/**
 * Tras el `202` de la división, el hijo nace por una saga asíncrona (ADR-007). Se consulta el estado (lectura, sin
 * efectos) cada 1,5 s hasta que deja de estar `PENDING`, con un máximo de 20 consultas; después, "Consultar de
 * nuevo" (DW-24). Nunca se repite el comando.
 */
export function SplitProgress({ parentAssetRef, childAssetRef, client = fetchSplitStatus, intervalMs = INTERVAL_MS }: {
  parentAssetRef: string;
  childAssetRef: string;
  client?: typeof fetchSplitStatus;
  intervalMs?: number;
}) {
  const [outcome, setOutcome] = useState<SplitStatusOutcome | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [round, setRound] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;
    setExhausted(false);
    const tick = async () => {
      polls++;
      const r = await client(parentAssetRef, childAssetRef);
      if (!alive.current) return;
      setOutcome(r);
      if (r.kind === 'ok' && r.status === 'PENDING') {
        if (polls >= MAX_POLLS) setExhausted(true);
        else timer = setTimeout(tick, intervalMs);
      }
    };
    void tick();
    return () => { alive.current = false; clearTimeout(timer); };
  }, [parentAssetRef, childAssetRef, client, intervalMs, round]);

  const again = <Actions><Button variant="secondary" onClick={() => setRound((n) => n + 1)}>Consultar de nuevo</Button></Actions>;

  if (!outcome || (outcome.kind === 'ok' && outcome.status === 'PENDING')) {
    return (
      <StatusNotice variant="info" title="División en curso"
        text={exhausted ? 'La división sigue en curso. Puedes consultar de nuevo en unos momentos.' : 'Estamos creando el activo nuevo…'}>
        {exhausted && again}
      </StatusNotice>
    );
  }
  if (outcome.kind === 'ok') {
    switch (outcome.status) {
      case 'CHILD_CREATED':
        return (
          <StatusNotice variant="success" title="División completada">
            <p>Se creó el activo nuevo con la cantidad separada.</p>
            <p><Link href={`/assets/${encodeURIComponent(childAssetRef)}`} data-testid="split-child-link">Ver el activo nuevo</Link></p>
          </StatusNotice>
        );
      case 'COMPENSATED':
        return <StatusNotice variant="info" text="La división no pudo completarse y se revirtió: la cantidad volvió a este activo." />;
      case 'UNRESOLVED':
        return <StatusNotice variant="ambiguous" title="La división necesita revisión"
          text="No pudo completarse automáticamente; un operador debe resolverla. No la repitas." />;
      case 'RESOLVED_MANUALLY':
        return <StatusNotice variant="info" text="Un operador resolvió esta división manualmente." />;
      default:
        return <StatusNotice variant="info" text={`Estado de la división: ${outcome.status}`} />;
    }
  }
  if (outcome.kind === 'forbidden') return <StatusNotice variant="rejected" text="No tienes acceso a esta división." />;
  if (outcome.kind === 'not-found') return <StatusNotice variant="rejected" text="No encontramos esa división." />;
  return <StatusNotice variant="rejected" text="No pudimos consultar la división.">{again}</StatusNotice>;
}
