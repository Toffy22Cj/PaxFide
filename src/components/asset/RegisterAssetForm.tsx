'use client';

import React, { useEffect, useState } from 'react';
import { useCommand } from '../../lib/commands/useCommand';
import { normalizeQuantity, parseRegistered, registerPathARequest, registerPathBRequest } from '../../lib/api/assetCommands';
import { TextField } from '../ui/Field';
import { Button } from '../ui/Button';
import { Actions, Surface, uiClasses as ui } from '../ui/Layout';
import { CommandFeedback } from '../CommandFeedback';
import { ErrorState } from '../States';

type Path = 'B' | 'A';
type Values = Record<string, string>;

const COMMON = [
  { name: 'assetType', label: 'Tipo de bien', hint: 'Por ejemplo: mercado, kit de higiene.' },
  { name: 'quantity', label: 'Cantidad', hint: 'Número positivo, hasta 4 decimales.' },
  { name: 'unitOfMeasure', label: 'Unidad de medida', hint: 'Por ejemplo: kit, kg.' },
  { name: 'custodianRef', label: 'Custodio (referencia)' },
  { name: 'currentLocation', label: 'Ubicación actual' },
];
const PATH_A = [
  { name: 'fundId', label: 'Fondo (referencia)', hint: 'Todavía no hay lectura que lo ofrezca (S-04).' },
  { name: 'allocationId', label: 'Asignación de fondos (referencia)', hint: 'Todavía no hay lectura que la ofrezca (S-04).' },
];

/**
 * Registrar activo (acción transitoria de `PanelHome`, `action:register-asset`). Camino B: donación en especie
 * (`/from-donation`; el `donorRef` lo pone el servidor). Camino A: compra con el fondo (`/register`). La organización
 * sale del JWT en ambos (DD-10). Tras el éxito, a `/assets/{assetRef}` (`front-fase2` §9).
 */
export function RegisterAssetForm({ onRegistered, onCancel }: { onRegistered: (assetRef: string) => void; onCancel: () => void }) {
  const [path, setPath] = useState<Path>('B');
  const [v, setV] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const command = useCommand<unknown>((p) => {
    const { __path, ...body } = p as Values & { __path: Path };
    return __path === 'A' ? registerPathARequest(body) : registerPathBRequest(body);
  });
  const sending = command.state === 'SENDING';

  useEffect(() => {
    if (command.state !== 'SUCCESS') return;
    const r = parseRegistered(command.data);
    if (r) onRegistered(r.assetRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command.state]);

  const fields = path === 'A' ? [...PATH_A, ...COMMON] : COMMON;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string | undefined> = {};
    const body: Values = {};
    for (const f of fields) {
      const raw = (v[f.name] ?? '').trim();
      if (!raw) { next[f.name] = 'Este campo es obligatorio.'; continue; }
      if (raw.length > 256) { next[f.name] = 'Máximo 256 caracteres.'; continue; }
      if (f.name === 'quantity') {
        const q = normalizeQuantity(raw);
        if (!q) { next.quantity = 'Escribe una cantidad mayor que cero, con hasta 4 decimales.'; continue; }
        body.quantity = q;
      } else body[f.name] = raw;
    }
    const optional = path === 'A' ? 'sourceAllocationId' : 'campaignRef';
    if ((v[optional] ?? '').trim()) body[optional] = v[optional].trim();
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    void command.execute({ ...body, __path: path });
  };

  if (command.state === 'SUCCESS' && !parseRegistered(command.data)) {
    return <ErrorState text="El activo pudo registrarse, pero no pudimos leer la respuesta. Revisa antes de repetir." />;
  }

  const field = (f: { name: string; label: string; hint?: string }) => (
    <TextField key={f.name} label={f.label} hint={f.hint} value={v[f.name] ?? ''} autoComplete="off" disabled={sending}
      onChange={(e) => setV((x) => ({ ...x, [f.name]: e.target.value }))} error={errors[f.name]} />
  );

  return (
    <Surface title="Registrar activo">
      <form onSubmit={submit} noValidate>
        <fieldset className={ui.fieldset} disabled={sending || command.state === 'AMBIGUOUS'}>
          <legend className={ui.legend}>Origen del bien</legend>
          <label className={ui.check}>
            <input type="radio" name="path" checked={path === 'B'} onChange={() => setPath('B')} /> Donación en especie
          </label>
          <label className={ui.check}>
            <input type="radio" name="path" checked={path === 'A'} onChange={() => setPath('A')} /> Compra con fondos de una donación
          </label>
        </fieldset>
        {fields.map(field)}
        {path === 'B'
          ? field({ name: 'campaignRef', label: 'Convocatoria (referencia, opcional)' })
          : field({ name: 'sourceAllocationId', label: 'Asignación de origen (referencia, opcional)' })}
        <CommandFeedback command={command} />
        <Actions>
          {command.state !== 'AMBIGUOUS' && <Button type="submit" sending={sending}>Registrar</Button>}
          <Button variant="secondary" onClick={onCancel} disabled={sending}>Cancelar</Button>
        </Actions>
      </form>
    </Surface>
  );
}
