'use client';

import React, { useState } from 'react';
import { useCommand } from '../../lib/commands/useCommand';
import { assignEmployeeRequest } from '../../lib/api/campaignAdmin';
import type { SessionCampaign } from '../../lib/campaigns/sessionCampaigns';
import { TextField, SelectField } from '../ui/Field';
import { Button } from '../ui/Button';
import { Actions, Surface } from '../ui/Layout';
import { CommandFeedback } from '../CommandFeedback';
import { StatusNotice } from '../States';

/**
 * Asignar responsable (CV-02, `action:assign-employee`). Sin lectura de miembros (R6, S-08), el responsable se
 * identifica por el id de su cuenta; la convocatoria, entre las creadas en esta sesión o por su referencia (S-02).
 */
export function AssignEmployeeForm({ campaigns }: { campaigns: SessionCampaign[] }) {
  const [campaignRef, setCampaignRef] = useState(campaigns[0]?.campaignRef ?? '');
  const [employeeRef, setEmployeeRef] = useState('');
  const [errors, setErrors] = useState<{ campaignRef?: string; employeeRef?: string }>({});
  const command = useCommand<unknown>((p) => assignEmployeeRequest(p as { campaignRef: string; employeeRef: string }));
  const sending = command.state === 'SENDING';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      campaignRef: campaignRef.trim() ? undefined : 'Este campo es obligatorio.',
      employeeRef: employeeRef.trim() ? undefined : 'Este campo es obligatorio.',
    };
    setErrors(next);
    if (next.campaignRef || next.employeeRef) return;
    void command.execute({ campaignRef: campaignRef.trim(), employeeRef: employeeRef.trim() });
  };

  return (
    <Surface title="Asignar responsable">
      {command.state === 'SUCCESS' && (
        <StatusNotice variant="success" text="Responsable asignado.">
          <Actions><Button variant="secondary" onClick={() => { setEmployeeRef(''); command.newIntent(); }}>Asignar otro</Button></Actions>
        </StatusNotice>
      )}
      {command.state !== 'SUCCESS' && (
        <form onSubmit={submit} noValidate>
          {campaigns.length > 0 ? (
            <SelectField label="Convocatoria" value={campaignRef} onChange={(e) => setCampaignRef(e.target.value)} disabled={sending}
              error={errors.campaignRef} options={campaigns.map((c) => ({ value: c.campaignRef, label: c.title }))} />
          ) : (
            <TextField label="Referencia de la convocatoria" value={campaignRef} onChange={(e) => setCampaignRef(e.target.value)}
              error={errors.campaignRef} disabled={sending} autoComplete="off"
              hint="Todavía no hay listado de convocatorias: usa la referencia que se mostró al crearla." />
          )}
          <TextField label="Cuenta del responsable" value={employeeRef} onChange={(e) => setEmployeeRef(e.target.value)}
            error={errors.employeeRef} disabled={sending} autoComplete="off"
            hint="Identificador de la cuenta de la persona de tu organización. Todavía no hay listado de miembros." />
          <CommandFeedback command={command} />
          {command.state !== 'AMBIGUOUS' && <Button type="submit" sending={sending}>Asignar</Button>}
        </form>
      )}
    </Surface>
  );
}
