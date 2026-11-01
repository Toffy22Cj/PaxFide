'use client';

import React, { useEffect, useState } from 'react';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import {
  createOrganizationRequest, fetchOrganization, resubmitVerificationRequest, updateOrganizationProfile,
  type OrganizationDetails, type UpdateProfileOutcome,
} from '../lib/api/organization';
import { fetchLocations } from '../lib/api/locations';
import { LEGAL_VERSIONS } from '../lib/legal/versions';
import { organizationTypeLabel, roleLabel, verificationStatusLabel } from '../lib/labels';
import {
  createBody, EMPTY_FORM, formFromContract, profileBody, validateProfile, type ProfileErrors, type ProfileForm,
} from '../lib/organization/profileModel';
import { useCommand } from '../lib/commands/useCommand';
import { Actions, DefinitionList, PageHeader, Surface, uiClasses as ui } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { SelectField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { ErrorState, LoadingState, StatusNotice, UnavailableState } from '../components/States';
import { CommandFeedback } from '../components/CommandFeedback';
import { LegalConsent } from '../components/access/LegalConsent';
import { OrganizationLogoCard } from '../components/media/OrganizationLogoCard';
import { OrganizationProfileForm } from '../components/organization/OrganizationProfileForm';

const TYPES = [{ value: 'FOUNDATION', label: 'Fundación' }, { value: 'COMPANY', label: 'Empresa' }];

/**
 * `/panel/organization` (R9, §3.1; DW-46): una cuenta sin organización la crea (`POST /organizations`) y queda como
 * `REPRESENTATIVE`, pendiente de verificación. plan-fase7-puesta-al-dia.md Anexo 5 (P-15, ficha R-7): el mismo
 * formulario de perfil para crear y para editar (U-32); con organización, `REPRESENTATIVE` y `ADMINISTRATOR` ven su
 * estado (S-18), editan el perfil (`PUT …/profile`, U-32 a U-35) y, si la plataforma pidió información, lo envían de
 * nuevo a revisión (U-36).
 */
export function OrganizationScreen({ meClient = fetchMe, orgClient = fetchOrganization, updateClient = updateOrganizationProfile, locationsClient = fetchLocations }: {
  meClient?: typeof fetchMe;
  orgClient?: typeof fetchOrganization;
  updateClient?: typeof updateOrganizationProfile;
  locationsClient?: typeof fetchLocations;
}) {
  const { state, reload } = usePrincipal(meClient);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ organizationId: string; verificationStatus: string; name: string; type: string } | null>(null);
  const canManage = state.status === 'ready' && state.data.roles.some((r) => r === 'REPRESENTATIVE' || r === 'ADMINISTRATOR');

  return (
    <div>
      <PageHeader title="Mi organización" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta" />}
      {created && (
        <StatusNotice variant="success" title="Organización creada">
          <DefinitionList items={[
            { label: 'Nombre', value: created.name },
            { label: 'Tipo', value: organizationTypeLabel(created.type) },
            { label: 'Estado', value: verificationStatusLabel(created.verificationStatus), testId: 'organization-status' },
            { label: 'Identificador', value: <span className={ui.mono}>{created.organizationId}</span> },
          ]} />
          <p>La plataforma la revisará. Hasta que esté verificada no podrás crear convocatorias. Eres su representante:
            ya puedes invitar a otras personas.</p>
        </StatusNotice>
      )}
      {state.status === 'ready' && !state.data.organizationId && !created && (
        <Surface title="Crear una organización">
          <p>Tu cuenta no pertenece a ninguna organización. Si representas a una fundación o una empresa, regístrala:
            quedará pendiente de verificación por la plataforma.</p>
          {isSurfaceEnabled('action:create-organization') && (
            <Actions><Button onClick={() => setCreating(true)}>Crear organización</Button></Actions>
          )}
        </Surface>
      )}
      {state.status === 'ready' && state.data.organizationId && (
        <Surface title="Tu cuenta en la organización">
          <DefinitionList items={[
            { label: 'Organización', value: <span className={ui.mono}>{state.data.organizationId}</span> },
            { label: 'Tus papeles', value: state.data.roles.map(roleLabel).join(', ') || '—', testId: 'organization-roles' },
          ]} />
          {!created && !canManage && <UnavailableState what="El estado de verificación de tu organización" />}
        </Surface>
      )}
      {/* U-32: REPRESENTATIVE y ADMINISTRATOR editan el perfil (S-18 da el estado y el perfil) */}
      {state.status === 'ready' && state.data.organizationId && canManage && !created && (
        <OrganizationProfileEditor organizationId={state.data.organizationId} orgClient={orgClient}
          updateClient={updateClient} locationsClient={locationsClient} />
      )}
      {/* U-5 (plan-fase7-puesta-al-dia.md): el logo, para REPRESENTATIVE y ADMINISTRATOR */}
      {state.status === 'ready' && state.data.organizationId && isSurfaceEnabled('action:organization-logo') && canManage && (
        <OrganizationLogoCard organizationId={state.data.organizationId} />
      )}
      {creating && (
        <CreateOrganizationDialog locationsClient={locationsClient} onClose={() => setCreating(false)}
          onCreated={(c) => { setCreated(c); setCreating(false); reload(); }} />
      )}
    </div>
  );
}

/** U-32: crear con el mismo formulario; `POST /organizations` lleva solo lo relleno (todo opcional salvo tipo y nombre). */
function CreateOrganizationDialog({ onClose, onCreated, locationsClient }: {
  onClose: () => void;
  onCreated: (c: { organizationId: string; verificationStatus: string; name: string; type: string }) => void;
  locationsClient: typeof fetchLocations;
}) {
  const [type, setType] = useState('');
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<ProfileErrors & { type?: string }>({});
  const [consented, setConsented] = useState(false);
  const command = useCommand<{ organizationId?: string; verificationStatus?: string }>((payload) => createOrganizationRequest(payload));
  const sending = command.state === 'SENDING';

  useEffect(() => {
    if (command.state === 'SUCCESS') {
      onCreated({
        organizationId: String(command.data?.organizationId ?? ''), verificationStatus: String(command.data?.verificationStatus ?? ''),
        name: form.name.trim(), type,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command.state]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consented) return;
    const next: ProfileErrors & { type?: string } = { ...validateProfile(form, type) };
    if (!type) next.type = 'Este campo es obligatorio.';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    // R-3: la versión de los términos aceptada (referencia-api-v1.md §1, nota R-5)
    void command.execute({ ...createBody(form, type), acceptedOrganizationTermsVersion: LEGAL_VERSIONS.organizationTerms });
  };

  return (
    <Modal title="Crear organización" onCancel={onClose}>
      <form onSubmit={submit} noValidate>
        <SelectField label="Tipo" value={type} options={TYPES} placeholder="Elige una opción" error={errors.type}
          onChange={(e) => setType(e.target.value)} disabled={sending} />
        <OrganizationProfileForm value={form} onChange={setForm} errors={errors} type={type} verified={false}
          disabled={sending} locationsClient={locationsClient} />
        <LegalConsent doc="organizationTerms" checked={consented} onChange={setConsented} disabled={sending || command.state === 'AMBIGUOUS'} />
        <CommandFeedback command={command} />
        <Actions>
          <Button variant="secondary" onClick={onClose} disabled={sending}>Cancelar</Button>
          {command.state !== 'AMBIGUOUS' && <Button type="submit" sending={sending} disabled={!consented}>Crear organización</Button>}
        </Actions>
      </form>
    </Modal>
  );
}

const SAVE_TEXT: Record<Exclude<UpdateProfileOutcome['kind'], 'ok' | 'unauthorized'>, string> = {
  // U-34: los 400 del servidor no dicen qué campo falló
  invalid: 'Revisa los datos: alguno no es válido.',
  locked: 'La organización ya está verificada: el nombre, la razón social y el NIT no se pueden cambiar.',
  'nit-taken': 'Ya hay una organización registrada con ese NIT',
  forbidden: 'No tienes permiso para editar esta organización.',
  network: 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.',
  error: 'No pudimos guardar los datos. Inténtalo de nuevo.',
};

function OrganizationProfileEditor({ organizationId, orgClient, updateClient, locationsClient }: {
  organizationId: string;
  orgClient: typeof fetchOrganization;
  updateClient: typeof updateOrganizationProfile;
  locationsClient: typeof fetchLocations;
}) {
  const [org, setOrg] = useState<OrganizationDetails | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const resubmit = useCommand<{ verificationStatus?: string }>(resubmitVerificationRequest(organizationId));

  const load = () => {
    setLoadFailed(false);
    void orgClient(organizationId).then((r) => {
      if (r.kind !== 'ok') { setLoadFailed(r.kind !== 'unauthorized'); return; }
      setOrg(r.organization);
      setForm(formFromContract(r.organization.name, r.organization.profile ?? {}));
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [organizationId, orgClient]);

  useEffect(() => {
    if (resubmit.state === 'SUCCESS') {
      setResult({ ok: true, text: 'Enviamos la organización de nuevo a revisión.' });
      load();
    }
    // U-36: 409 VerificationResubmitNotAllowed → se refresca el estado
    if (resubmit.state === 'REJECTED' && resubmit.rejection?.problem.title === 'VerificationResubmitNotAllowed') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resubmit.state]);

  if (loadFailed) return <ErrorState onRetry={load} text="No pudimos cargar los datos de tu organización." />;
  if (!org) return <LoadingState />;
  const verified = org.verificationStatus === 'VERIFIED';
  const needsInfo = org.verificationStatus === 'NEEDS_MORE_INFORMATION';

  /** Valida y guarda con todos los campos (U-32). Devuelve si se guardó. */
  const save = async (): Promise<boolean> => {
    const next = validateProfile(form, org.type);
    setErrors(next);
    setResult(null);
    if (Object.values(next).some(Boolean)) return false;
    setSaving(true);
    const r = await updateClient(organizationId, profileBody(form, org.type));
    setSaving(false);
    if (r.kind === 'ok') {
      setForm(formFromContract(r.name ?? form.name, r.profile));
      setOrg({ ...org, name: r.name ?? org.name, profile: r.profile });
      setResult({ ok: true, text: 'Guardamos los datos de la organización.' });
      return true;
    }
    if (r.kind === 'unauthorized') return false; // la sesión ya se cerró (T-1)
    setResult({ ok: false, text: SAVE_TEXT[r.kind] });
    return false;
  };

  return (
    <Surface title="Datos de la organización">
      <DefinitionList items={[
        { label: 'Tipo', value: organizationTypeLabel(org.type) },
        { label: 'Estado', value: verificationStatusLabel(org.verificationStatus), testId: 'organization-verification-status' },
      ]} />
      {needsInfo && org.informationRequest && (
        <StatusNotice variant="info" title="La plataforma pidió más información" text={org.informationRequest} />
      )}
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
        <OrganizationProfileForm value={form} onChange={setForm} errors={errors} type={org.type} verified={verified}
          disabled={saving || resubmit.state === 'SENDING'} locationsClient={locationsClient} />
        {result && <StatusNotice variant={result.ok ? 'success' : 'rejected'} text={result.text} />}
        {/* U-36: guarda primero el perfil y después envía de nuevo a revisión (comando D6) */}
        <CommandFeedback command={resubmit} />
        <Actions>
          <Button type="submit" variant={needsInfo ? 'secondary' : 'primary'} sending={saving}>Guardar cambios</Button>
          {needsInfo && resubmit.state !== 'AMBIGUOUS' && (
            <Button sending={resubmit.state === 'SENDING'} disabled={saving}
              onClick={async () => { if (await save()) { resubmit.newIntent(); void resubmit.execute(undefined); } }}>
              Enviar de nuevo a revisión
            </Button>
          )}
        </Actions>
      </form>
    </Surface>
  );
}
