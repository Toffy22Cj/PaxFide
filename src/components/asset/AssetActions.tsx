'use client';

import React, { useState } from 'react';
import { isSurfaceEnabled } from '../../lib/routing/surfaces';
import {
  deliverRequest, dispatchRequest, normalizeQuantity, parseSplitAccepted, receiveRequest, splitRequest,
} from '../../lib/api/assetCommands';
import { Button } from '../ui/Button';
import { Actions } from '../ui/Layout';
import { StatusNotice } from '../States';
import { CommandModal, FieldSpec } from './CommandModal';
import { SplitProgress } from './SplitProgress';
import type { PrincipalState } from '../../lib/auth/usePrincipal';

type ActionId = 'split' | 'dispatch' | 'receive' | 'deliver';

/** Acciones logísticas: su contrato exige `EMPLOYEE` (`RoleAuthorizationPolicy` del backend). */
const LOGISTIC: ActionId[] = ['dispatch', 'receive', 'deliver'];

/**
 * A1 (Enmienda 1 de ADR-046, APROBADA): con `/me` disponible, las acciones logísticas solo se muestran a quien tiene
 * `EMPLOYEE`. Mientras `/me` carga, no se muestran; si `/me` no está disponible (404) o falla, se mantiene el
 * comportamiento anterior y el backend responde 403. Es representación: el backend sigue autorizando.
 */
function logisticVisible(principal?: PrincipalState): boolean {
  if (!principal) return true;
  if (principal.status === 'loading') return false;
  if (principal.status === 'ready') return principal.data.roles.includes('EMPLOYEE');
  return true;
}

const QUANTITY_FIELD: FieldSpec = {
  name: 'quantity', label: 'Cantidad a separar', hint: 'Número positivo, hasta 4 decimales.',
  parse: normalizeQuantity, invalid: 'Escribe una cantidad mayor que cero, con hasta 4 decimales.',
};

const SPECS: Record<ActionId, { label: string; title: string; description: string; fields: FieldSpec[]; done: string }> = {
  split: {
    label: 'Dividir activo', title: 'Dividir activo',
    description: 'Separa una parte de la cantidad de este activo en un activo nuevo.',
    fields: [QUANTITY_FIELD], done: '',
  },
  dispatch: {
    label: 'Despachar', title: 'Despachar activo', description: 'Registra que el activo sale hacia su destino.',
    fields: [{ name: 'carrierRef', label: 'Transportista (referencia)' }], done: 'Activo despachado.',
  },
  receive: {
    label: 'Recibir', title: 'Recibir activo', description: 'Registra que el activo llegó a una instalación.',
    fields: [
      { name: 'facilityLocation', label: 'Instalación (ubicación)' },
      { name: 'receiverRef', label: 'Quién recibe (referencia)' },
    ], done: 'Activo recibido.',
  },
  deliver: {
    label: 'Entregar', title: 'Entregar activo',
    description: 'Registra la entrega final. Después el activo queda en solo lectura. La hora la pone el servidor.',
    fields: [
      { name: 'finalCustodianRef', label: 'Custodio final (referencia)' },
      { name: 'beneficiaryRef', label: 'Beneficiario (referencia)', hint: 'Una referencia, nunca datos personales.' },
      { name: 'locationRef', label: 'Lugar de entrega (referencia)' },
      { name: 'evidenceRef', label: 'Evidencia (referencia)' },
    ], done: 'Activo entregado.',
  },
};

const BUILDERS: Record<ActionId, (assetRef: string) => (p: unknown) => any> = {
  split: splitRequest, dispatch: dispatchRequest, receive: receiveRequest, deliver: deliverRequest,
};

/**
 * Acciones de `AssetPage` (T3 sustituido por la Enmienda 1 de ADR-046, E1-2). La web no decide qué acción admite
 * cada estado (sin `ActionResolver`): ofrece las habilitadas, salvo en `DELIVERED` (matriz §4b: solo lectura), y el
 * backend rechaza con 409 lo que no corresponda.
 */
export function AssetActions({ assetRef, delivered, onChanged, principal }: {
  assetRef: string;
  delivered: boolean;
  onChanged: () => void;
  principal?: PrincipalState;
}) {
  const [open, setOpen] = useState<ActionId | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [split, setSplit] = useState<{ parentAssetRef: string; childAssetRef: string } | null>(null);

  // En DELIVERED no hay acciones, pero los avisos de lo ya hecho (p. ej. el enlace al hijo) se conservan
  const showLogistic = logisticVisible(principal);
  const available = delivered ? [] : (Object.keys(SPECS) as ActionId[])
    .filter((a) => isSurfaceEnabled(`action:${a}`))
    .filter((a) => showLogistic || !LOGISTIC.includes(a));
  if (available.length === 0 && !done && !split) return null;

  return (
    <section aria-label="Acciones del activo">
      {done && <StatusNotice variant="success" text={done} />}
      {split && <SplitProgress parentAssetRef={split.parentAssetRef} childAssetRef={split.childAssetRef} />}
      {available.length > 0 && <Actions>
        {available.map((a) => (
          <Button key={a} variant="secondary" onClick={() => { setDone(null); setOpen(a); }}>{SPECS[a].label}</Button>
        ))}
      </Actions>}
      {open && (
        <CommandModal
          key={open}
          title={SPECS[open].title}
          description={SPECS[open].description}
          fields={SPECS[open].fields}
          submitLabel="Confirmar"
          builder={BUILDERS[open](assetRef)}
          onClose={() => setOpen(null)}
          onSuccess={(data) => {
            const action = open;
            setOpen(null);
            if (action === 'split') {
              const accepted = parseSplitAccepted(data);
              if (accepted) setSplit(accepted);
              else setDone('La división fue aceptada, pero no pudimos leer la respuesta. Revisa antes de repetirla.');
            } else {
              setDone(SPECS[action].done);
            }
            onChanged();
          }}
        />
      )}
    </section>
  );
}
