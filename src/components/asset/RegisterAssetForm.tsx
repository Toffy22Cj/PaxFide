'use client';

import React, { useEffect, useState } from 'react';
import { useCommand } from '../../lib/commands/useCommand';
import { normalizeQuantity, parseRegistered, registerPathARequest, registerPathBRequest } from '../../lib/api/assetCommands';
import { TextField, SelectField } from '../ui/Field';
import { fetchFunds, Fund } from '../../lib/api/organization';
import { formatMinorUnits } from '../../lib/money';
import { allocationStatusLabel } from '../../lib/labels';
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
  { name: 'fundId', label: 'Fondo (referencia)', hint: 'No se pudo leer el listado de fondos: escribe la referencia.' },
  { name: 'allocationId', label: 'Asignación de fondos (referencia)', hint: 'No se pudo leer el listado de fondos: escribe la referencia.' },
];

/**
 * Registrar activo (acción transitoria de `PanelHome`, `action:register-asset`). Camino B: donación en especie
 * (`/from-donation`; el `donorRef` lo pone el servidor). Camino A: compra con el fondo (`/register`). La organización
 * sale del JWT en ambos (DD-10). Tras el éxito, a `/assets/{assetRef}` (`front-fase2` §9).
 */
export function RegisterAssetForm({ onRegistered, onCancel, organizationId, fundsClient = fetchFunds }: {
  onRegistered: (assetRef: string) => void;
  onCancel: () => void;
  /** Con organización, el camino A elige fondo y asignación de `GET /organizations/{id}/funds` (S-04). */
  organizationId?: string;
  fundsClient?: typeof fetchFunds;
}) {
  const [path, setPath] = useState<Path>('B');
  const [funds, setFunds] = useState<Fund[] | null | 'loading'>(null);
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

  useEffect(() => {
    if (path !== 'A' || !organizationId || funds !== null) return;
    setFunds('loading');
    fundsClient(organizationId).then((r) => setFunds(r.kind === 'ok' ? r.items : []), () => setFunds([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, organizationId]);

  // Fondos leídos con alguna asignación: desplegables; si no, texto (sin lectura o lectura fallida)
  const withAllocations = Array.isArray(funds) ? funds.filter((f) => f.allocations.length > 0) : [];
  const pick = path === 'A' && withAllocations.length > 0;
  const chosenFund = withAllocations.find((f) => f.fundId === v.fundId);
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
        {path === 'A' && funds === 'loading' && <p className={ui.hint}>Cargando fondos…</p>}
        {path === 'A' && Array.isArray(funds) && funds.length > 0 && !pick && (
          <p className={ui.hint}>Ningún fondo de tu organización tiene asignaciones: pide una en «Fondos de mi organización».</p>
        )}
        {pick && (
          <>
            <SelectField label="Fondo" value={v.fundId ?? ''} disabled={sending} error={errors.fundId} placeholder="Elige un fondo"
              onChange={(e) => setV((x) => ({ ...x, fundId: e.target.value, allocationId: '' }))}
              options={withAllocations.map((f) => ({
                value: f.fundId, label: `${f.fundId} · disponible ${formatMinorUnits(f.availableAmount, f.currency)}`,
              }))} />
            <SelectField label="Asignación de fondos" value={v.allocationId ?? ''} disabled={sending || !chosenFund} error={errors.allocationId}
              placeholder={chosenFund ? 'Elige una asignación' : 'Elige antes el fondo'}
              onChange={(e) => setV((x) => ({ ...x, allocationId: e.target.value }))}
              options={(chosenFund?.allocations ?? []).map((a) => ({
                value: a.allocationId, label: `${a.allocationId} · ${formatMinorUnits(a.amount, chosenFund!.currency)} · ${allocationStatusLabel(a.status)}`,
              }))} />
          </>
        )}
        {(pick ? COMMON : fields).map(field)}
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
