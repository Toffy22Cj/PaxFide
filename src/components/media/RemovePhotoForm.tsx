'use client';
// Ref: plan-fase7-puesta-al-dia.md U-7 ("Retirar una foto"): organización (de la cola o por su ID), tipo, referencia
// (`campaignRef` para la portada, `evidenceRef` para la evidencia, nada para el logo) y motivo de 1 a 500 caracteres.
// 204 → "Foto retirada". El motivo solo vive en el estado del formulario: nunca se guarda ni se registra.
import React, { useState } from 'react';
import { removePlatformMedia, type MediaPurpose, type RemoveOutcome } from '../../lib/api/media';
import { EVIDENCE_REF } from '../../lib/api/deliveryEvidence';
import { SelectField, TextArea, TextField } from '../ui/Field';
import { Button } from '../ui/Button';
import { Actions, Surface } from '../ui/Layout';
import { StatusNotice } from '../States';

const PURPOSES: { value: MediaPurpose; label: string }[] = [
  { value: 'ORGANIZATION_LOGO', label: 'Logo de la organización' },
  { value: 'CAMPAIGN_COVER', label: 'Portada de una convocatoria' },
  { value: 'DELIVERY_EVIDENCE', label: 'Foto de una entrega' },
];

export function RemovePhotoForm({ organizations, client = removePlatformMedia }: {
  /** Las de la cola de verificación, si se leyeron; si no, se escribe el identificador. */
  organizations: { organizationId: string; name?: string }[];
  client?: typeof removePlatformMedia;
}) {
  const [org, setOrg] = useState('');
  const [purpose, setPurpose] = useState<MediaPurpose>('ORGANIZATION_LOGO');
  const [ref, setRef] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ org?: string; ref?: string; reason?: string }>({});
  const [result, setResult] = useState<RemoveOutcome['kind'] | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const orgId = org.trim();
    if (!orgId) next.org = 'Este campo es obligatorio.';
    const r = ref.trim();
    if (purpose === 'CAMPAIGN_COVER' && !r) next.ref = 'Escribe la referencia de la convocatoria.';
    if (purpose === 'DELIVERY_EVIDENCE' && !EVIDENCE_REF.test(r)) next.ref = 'Escribe la huella de la foto (sha256: y 64 caracteres).';
    const why = reason.trim();
    if (!why) next.reason = 'Este campo es obligatorio.';
    else if (why.length > 500) next.reason = 'Máximo 500 caracteres.';
    setErrors(next);
    setResult(null);
    if (next.org || next.ref || next.reason) return;
    setSending(true);
    const out = await client(orgId, purpose, purpose === 'ORGANIZATION_LOGO' ? undefined : r, why);
    setSending(false);
    setResult(out.kind);
    if (out.kind === 'ok') { setReason(''); setRef(''); }
  };

  const notice = (): React.ReactNode => {
    switch (result) {
      case null: case 'unauthorized': return null;
      case 'ok': return <StatusNotice variant="success" title="Foto retirada" text="Los bytes se borraron. Si era el logo o la portada, ya no se muestra." />;
      case 'not-found': return <StatusNotice variant="rejected" text="No existe esa foto en esa organización." />;
      case 'bad-request': return <StatusNotice variant="rejected" text="Revisa el tipo, la referencia y el motivo." />;
      case 'forbidden': return <StatusNotice variant="rejected" text="Tu cuenta no puede retirar fotos." />;
      case 'storage-unavailable': return <StatusNotice variant="rejected" text="El almacenamiento no respondió. Inténtalo de nuevo en unos minutos." />;
      case 'network': return <StatusNotice variant="rejected" text="No pudimos conectar. Puedes repetirlo: retirar una foto ya retirada no cambia nada." />;
      case 'error': return <StatusNotice variant="rejected" text="No pudimos retirar la foto. Inténtalo de nuevo." />;
      default: { const unreachable: never = result; throw new Error(`Resultado desconocido: ${String(unreachable)}`); }
    }
  };

  return (
    <Surface title="Retirar una foto">
      <p>Para una imagen que incumple las normas. Se borra y queda registrado quién la retiró y por qué.</p>
      {notice()}
      <form onSubmit={(e) => void submit(e)} noValidate data-testid="remove-photo-form">
        {/* La cola solo trae las pendientes: el identificador se puede escribir siempre */}
        {organizations.length > 0 && (
          <SelectField label="De la cola de verificación" value={organizations.some((o) => o.organizationId === org) ? org : ''}
            placeholder="Elige una organización" onChange={(e) => setOrg(e.target.value)}
            options={organizations.map((o) => ({ value: o.organizationId, label: o.name ?? o.organizationId }))} />
        )}
        <TextField label="Organización (identificador)" value={org} error={errors.org} autoComplete="off" spellCheck={false}
          onChange={(e) => setOrg(e.target.value)} />
        <SelectField label="Tipo" value={purpose} onChange={(e) => { setPurpose(e.target.value as MediaPurpose); setErrors({}); }} options={PURPOSES} />
        {purpose !== 'ORGANIZATION_LOGO' && (
          <TextField label={purpose === 'CAMPAIGN_COVER' ? 'Convocatoria (referencia)' : 'Huella de la foto (sha256:…)'} value={ref}
            error={errors.ref} autoComplete="off" spellCheck={false} onChange={(e) => setRef(e.target.value)} />
        )}
        <TextArea label="Motivo" hint="De 1 a 500 caracteres. Lo ve solo la plataforma." value={reason} error={errors.reason}
          onChange={(e) => setReason(e.target.value)} />
        <Actions><Button type="submit" sending={sending}>Retirar foto</Button></Actions>
      </form>
    </Surface>
  );
}
