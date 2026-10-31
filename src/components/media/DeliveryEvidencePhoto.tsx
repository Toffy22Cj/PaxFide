'use client';
// Ref: plan-fase7-puesta-al-dia.md U-8: en `/assets/:assetRef`, un lote `DELIVERED` muestra "Foto de la entrega" con
// U-4. 404 → "Sin foto", 410 → "La plataforma retiró esta foto"; referencia-api-v1.md §6 (`GET …/evidence`).
import React, { useState } from 'react';
import { fetchPrivateImage, type PrivateImageOutcome } from '../../lib/api/media';
import { segment } from '../../lib/api/config';
import { Surface } from '../ui/Layout';
import { LoadingState } from '../States';
import { PrivateImage, type PrivateImageState } from './PrivateImage';
import s from './media.module.css';

export function DeliveryEvidencePhoto({ assetRef, client = fetchPrivateImage }: { assetRef: string; client?: (path: string) => Promise<PrivateImageOutcome> }) {
  const [state, setState] = useState<PrivateImageState>('loading');
  const text = ((): string | null => {
    switch (state) {
      case 'loading': case 'ok': return null;
      case 'not-found': return 'Sin foto.';
      case 'removed': return 'La plataforma retiró esta foto.';
      case 'forbidden': return 'Tu cuenta no puede ver la foto de este lote.';
      case 'error': return 'No pudimos cargar la foto. Recarga la página para intentarlo de nuevo.';
      default: { const unreachable: never = state; throw new Error(`Estado desconocido: ${String(unreachable)}`); }
    }
  })();
  return (
    <Surface title="Foto de la entrega">
      <div data-testid="evidence-photo" data-state={state}>
        <PrivateImage path={`/physical-assets/${segment(assetRef)}/evidence`} alt="Foto de la entrega del lote"
          className={s.evidence} client={client} onState={setState} testId="evidence-img"
          fallback={state === 'loading' ? <LoadingState /> : null} />
        {text && <p className={s.hint}>{text}</p>}
      </div>
    </Surface>
  );
}
