'use client';

import React, { useState } from 'react';
import { useCommand } from '../../lib/commands/useCommand';
import { createCampaignRequest, CreatedCampaign, parseCreatedCampaign } from '../../lib/api/campaignAdmin';
import { buildCreateCampaign, CampaignFormErrors, CampaignFormValues } from '../../lib/campaignForm';
import { donationTypeLabel, paymentMethodLabel } from '../../lib/labels';
import { TextField, TextArea, SelectField, CheckboxGroup } from '../ui/Field';
import { Button } from '../ui/Button';
import { Actions, Surface } from '../ui/Layout';
import { CommandFeedback } from '../CommandFeedback';
import { ErrorState } from '../States';

const EMPTY: CampaignFormValues = {
  title: '', description: '', visibility: '', start: '', end: '', donationTypes: [], paymentMethods: [],
  currency: 'COP', target: '', targetPolicy: '', onTargetReached: '',
};

/**
 * Crear convocatoria (CV-01, `action:create-campaign`). Comando con `Command-Id` (D6; R11 verificado). La visibilidad
 * es obligatoria y la configuración va anidada. Tras el éxito se muestra el enlace público (`front-fase2` §9).
 */
export function CreateCampaignForm({ organizationId, onCreated, onCancel }: {
  organizationId: string;
  onCreated: (c: CreatedCampaign, title: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<CampaignFormValues>(EMPTY);
  const [errors, setErrors] = useState<CampaignFormErrors>({});
  const command = useCommand<unknown>(createCampaignRequest(organizationId));
  const sending = command.state === 'SENDING';
  const set = <K extends keyof CampaignFormValues>(k: K, value: CampaignFormValues[K]) => setV((x) => ({ ...x, [k]: value }));
  const monetary = v.donationTypes.includes('MONETARY');

  React.useEffect(() => {
    if (command.state !== 'SUCCESS') return;
    const created = parseCreatedCampaign(command.data);
    if (created) onCreated(created, v.title.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command.state]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = buildCreateCampaign(v);
    setErrors(r.errors ?? {});
    if (r.body) void command.execute(r.body);
  };

  if (command.state === 'SUCCESS' && !parseCreatedCampaign(command.data)) {
    return <ErrorState text="La convocatoria pudo crearse, pero no pudimos leer la respuesta. Revisa antes de repetir." />;
  }

  return (
    <Surface title="Nueva convocatoria">
      <form onSubmit={submit} noValidate>
        <TextField label="Título" value={v.title} maxLength={200} onChange={(e) => set('title', e.target.value)} error={errors.title} disabled={sending} />
        <TextArea label="Descripción (opcional)" value={v.description} onChange={(e) => set('description', e.target.value)} disabled={sending} />
        <SelectField label="Visibilidad" value={v.visibility} onChange={(e) => set('visibility', e.target.value)} error={errors.visibility}
          disabled={sending} placeholder="Elige la visibilidad"
          hint="Pública: puede aparecer en el descubrimiento. Solo con enlace: solo quien tenga el enlace o el QR."
          options={[{ value: 'PUBLIC', label: 'Pública' }, { value: 'PRIVATE_LINK', label: 'Solo con enlace' }]} />
        <TextField label="Inicio" type="datetime-local" value={v.start} onChange={(e) => set('start', e.target.value)} error={errors.start} disabled={sending} hint="Hora local." />
        <TextField label="Fin" type="datetime-local" value={v.end} onChange={(e) => set('end', e.target.value)} error={errors.end} disabled={sending} hint="Hora local." />
        <CheckboxGroup legend="Tipos de donación" value={v.donationTypes} onChange={(x) => set('donationTypes', x)} error={errors.donationTypes}
          disabled={sending} options={['MONETARY', 'IN_KIND'].map((t) => ({ value: t, label: donationTypeLabel(t) }))} />
        {monetary && (
          <>
            <CheckboxGroup legend="Medios de pago" value={v.paymentMethods} onChange={(x) => set('paymentMethods', x)} error={errors.paymentMethods}
              disabled={sending} options={['GATEWAY', 'BANK_TRANSFER', 'CASH'].map((m) => ({ value: m, label: paymentMethodLabel(m) }))} />
            <TextField label="Moneda" value={v.currency} maxLength={3} onChange={(e) => set('currency', e.target.value)} error={errors.currency} disabled={sending} hint="Código ISO 4217, por ejemplo COP." />
            <TextField label="Meta" inputMode="decimal" value={v.target} onChange={(e) => set('target', e.target.value)} error={errors.target} disabled={sending} hint="En unidades de la moneda, sin separador de miles." />
            <SelectField label="Política de meta" value={v.targetPolicy} onChange={(e) => set('targetPolicy', e.target.value)} error={errors.targetPolicy}
              disabled={sending} placeholder="Elige la política"
              options={[
                { value: 'FLEXIBLE', label: 'Flexible: se aceptan donaciones aunque se supere la meta' },
                { value: 'STRICT', label: 'Estricta: no se acepta más de la meta' },
                { value: 'CLOSE_ON_TARGET', label: 'Cerrar al alcanzar la meta' },
              ]} />
            {v.targetPolicy === 'CLOSE_ON_TARGET' && (
              <SelectField label="Al alcanzar la meta" value={v.onTargetReached} onChange={(e) => set('onTargetReached', e.target.value)}
                error={errors.onTargetReached} disabled={sending} placeholder="Elige una opción"
                options={[
                  { value: 'CLOSE', label: 'Cerrar la convocatoria' },
                  { value: 'REJECT_EXCESS', label: 'Rechazar el exceso' },
                  { value: 'ACCEPT_EXCESS', label: 'Aceptar el exceso' },
                ]} />
            )}
          </>
        )}
        <CommandFeedback command={command} />
        <Actions>
          {command.state !== 'AMBIGUOUS' && <Button type="submit" sending={sending}>Crear convocatoria</Button>}
          <Button variant="secondary" onClick={onCancel} disabled={sending}>Cancelar</Button>
        </Actions>
      </form>
    </Surface>
  );
}
