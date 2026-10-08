'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { AdminCampaign, fetchOrganizationCampaigns, ListOutcome } from '../lib/api/campaignAdmin';
import { fetchPublicCampaign } from '../lib/api/publicCampaigns';
import {
  CampaignConfiguration, ChangeRequest, currentConfiguration, decideChangeRequest, deriveVersion, editConfigurationRequest,
  fetchChangeRequests, rememberVersion, requestConfigurationChangeRequest,
} from '../lib/api/configuration';
import { formatMinorUnits, toMinorUnits } from '../lib/money';
import { donationTypeLabel, paymentMethodLabel } from '../lib/labels';
import { Actions, DefinitionList, PageHeader, Surface, uiClasses as ui } from '../components/ui/Layout';
import { CheckboxGroup, SelectField, TextField } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ForbiddenState, LoadingState, StatusNotice, UnavailableState } from '../components/States';
import { CommandModal } from '../components/asset/CommandModal';
import { LocalDate } from '../components/LocalDate';

const POLICY: Record<string, string> = {
  FLEXIBLE: 'Flexible', STRICT: 'Estricta', CLOSE_ON_TARGET: 'Cerrar al alcanzar la meta',
};
const REQUEST_STATUS: Record<string, string> = { PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada' };

function summary(c: CampaignConfiguration) {
  const items = [
    { label: 'Tipos de donación', value: c.acceptedDonationTypes.map(donationTypeLabel).join(', ') || '—' },
    { label: 'Medios de pago', value: c.acceptedPaymentMethods.map(paymentMethodLabel).join(', ') || '—' },
  ];
  if (c.acceptedDonationTypes.includes('MONETARY')) {
    items.push({ label: 'Meta', value: c.targetAmount && c.currency ? formatMinorUnits(c.targetAmount, c.currency) : '—' });
    items.push({ label: 'Política de meta', value: c.targetPolicy ? POLICY[c.targetPolicy] ?? c.targetPolicy : '—' });
  }
  return <DefinitionList items={items} />;
}

const same = (a: CampaignConfiguration, b: CampaignConfiguration) => JSON.stringify(a) === JSON.stringify(b);

/** Formulario de la nueva configuración (DW-51): con dinero mantenido, sus condiciones no se editan (backend). */
function ConfigurationForm({ current, onSubmit }: {
  current: CampaignConfiguration;
  onSubmit: (configuration: CampaignConfiguration, mode: 'edit' | 'request') => void;
}) {
  const hadMonetary = current.acceptedDonationTypes.includes('MONETARY');
  const [types, setTypes] = useState<string[]>(current.acceptedDonationTypes);
  const [methods, setMethods] = useState<string[]>(current.acceptedPaymentMethods);
  const [terms, setTerms] = useState({ currency: '', target: '', targetPolicy: '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const monetary = types.includes('MONETARY');

  const build = (): CampaignConfiguration | null => {
    const next: Record<string, string> = {};
    if (types.length === 0) next.types = 'Elige al menos un tipo de donación.';
    if (monetary && methods.length === 0) next.methods = 'Elige al menos un medio de pago.';
    const configuration: CampaignConfiguration = {
      acceptedDonationTypes: [...types].sort(), acceptedPaymentMethods: monetary ? [...methods].sort() : [],
    };
    if (monetary && hadMonetary) {
      Object.assign(configuration, { currency: current.currency, targetAmount: current.targetAmount, targetPolicy: current.targetPolicy });
    } else if (monetary) {
      const currency = terms.currency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) next.currency = 'Código ISO 4217 de tres letras (por ejemplo, COP).';
      const targetAmount = /^[A-Z]{3}$/.test(currency) ? toMinorUnits(terms.target, currency) : null;
      if (!targetAmount) next.target = 'Escribe una meta mayor que cero, sin separador de miles.';
      if (!['FLEXIBLE', 'STRICT'].includes(terms.targetPolicy)) next.targetPolicy = 'Elige la política de meta.';
      Object.assign(configuration, { currency, targetAmount: targetAmount ?? undefined, targetPolicy: terms.targetPolicy });
    }
    if (Object.keys(next).length === 0 && same(configuration, current)) next.types = 'No hay cambios respecto a la configuración actual.';
    setErrors(next);
    return Object.keys(next).length === 0 ? configuration : null;
  };

  const submit = (mode: 'edit' | 'request') => {
    const c = build();
    if (c) onSubmit(c, mode);
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      <CheckboxGroup legend="Tipos de donación" value={types} onChange={setTypes} error={errors.types}
        options={['MONETARY', 'IN_KIND'].map((t) => ({ value: t, label: donationTypeLabel(t) }))} />
      {monetary && (
        <CheckboxGroup legend="Medios de pago" value={methods} onChange={setMethods} error={errors.methods}
          options={['GATEWAY', 'BANK_TRANSFER', 'CASH'].map((m) => ({ value: m, label: paymentMethodLabel(m) }))} />
      )}
      {monetary && hadMonetary && (
        <p className={ui.hint}>La meta, la política y la moneda no se pueden cambiar mientras se acepten donaciones en dinero.</p>
      )}
      {monetary && !hadMonetary && (
        <>
          <TextField label="Moneda" value={terms.currency} maxLength={3} error={errors.currency} hint="Código ISO 4217, por ejemplo COP."
            onChange={(e) => setTerms((t) => ({ ...t, currency: e.target.value }))} />
          <TextField label="Meta" inputMode="decimal" value={terms.target} error={errors.target} hint="En unidades de la moneda, sin separador de miles."
            onChange={(e) => setTerms((t) => ({ ...t, target: e.target.value }))} />
          <SelectField label="Política de meta" value={terms.targetPolicy} error={errors.targetPolicy} placeholder="Elige la política"
            hint="Cerrar al alcanzar la meta no se ofrece aquí: su configuración no se puede leer después (D-10)."
            options={[{ value: 'FLEXIBLE', label: 'Flexible' }, { value: 'STRICT', label: 'Estricta' }]}
            onChange={(e) => setTerms((t) => ({ ...t, targetPolicy: e.target.value }))} />
        </>
      )}
      <Actions>
        {isSurfaceEnabled('action:configuration-request') && <Button onClick={() => submit('request')}>Solicitar cambio</Button>}
        {isSurfaceEnabled('action:configuration-edit') && <Button variant="secondary" onClick={() => submit('edit')}>Guardar sin aprobación</Button>}
      </Actions>
      <p className={ui.hint}>"Guardar sin aprobación" solo es posible mientras la convocatoria no tenga donaciones; después, el cambio
        necesita que otra persona lo apruebe.</p>
    </form>
  );
}

type Loaded = {
  requests: ListOutcome<ChangeRequest>;
  current?: CampaignConfiguration | null | 'unavailable';
};

/**
 * `/panel/configuration` (Enmienda 4 de ADR-037; DW-51): `ADMINISTRATOR` elige la convocatoria de su listado, ve la
 * configuración actual (compuesta, D-10) y edita directamente o solicita el cambio; `ADMINISTRATOR` o
 * `REPRESENTATIVE` ven las solicitudes y aprueban (nunca la propia) o rechazan. El representante no tiene listado de
 * convocatorias (S-20): escribe la referencia.
 */
export function ConfigurationScreen({
  meClient = fetchMe, listClient = fetchOrganizationCampaigns, requestsClient = fetchChangeRequests, publicClient = fetchPublicCampaign,
}: {
  meClient?: typeof fetchMe;
  listClient?: typeof fetchOrganizationCampaigns;
  requestsClient?: typeof fetchChangeRequests;
  publicClient?: typeof fetchPublicCampaign;
}) {
  const { state, reload } = usePrincipal(meClient);
  const [campaigns, setCampaigns] = useState<ListOutcome<AdminCampaign> | null>(null);
  const [refInput, setRefInput] = useState('');
  const [selected, setSelected] = useState<{ ref: string; campaign?: AdminCampaign } | null>(null);
  const [loaded, setLoaded] = useState<Loaded | 'loading' | null>(null);
  const [action, setAction] = useState<
    | { kind: 'submit'; mode: 'edit' | 'request'; configuration: CampaignConfiguration; version: number }
    | { kind: 'decide'; request: ChangeRequest; decision: 'approve' | 'reject' } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const organizationId = state.status === 'ready' ? state.data.organizationId : undefined;
  const selfId = state.status === 'ready' ? state.data.accountId : '';
  const roles = state.status === 'ready' ? state.data.roles : [];
  const enabled = !!organizationId && (roles.includes('ADMINISTRATOR') || roles.includes('REPRESENTATIVE'));

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    listClient(organizationId!).then((r) => { if (live) setCampaigns(r); }, () => { if (live) setCampaigns({ kind: 'error' }); });
    return () => { live = false; };
  }, [enabled, organizationId, listClient]);

  const load = useCallback(async (sel: { ref: string; campaign?: AdminCampaign }) => {
    setLoaded('loading');
    const requests = await requestsClient(sel.ref);
    let current: Loaded['current'];
    if (sel.campaign && organizationId) {
      // Se relee el listado: tras un cambio, la política de meta (que solo trae el listado) puede ser otra
      const list = await listClient(organizationId);
      if (list.kind === 'ok') setCampaigns(list);
      const campaign = list.kind === 'ok' ? list.items.find((c) => c.campaignRef === sel.ref) : undefined;
      const pub = campaign ? await publicClient(campaign.publicCode) : null;
      current = campaign && pub?.kind === 'ok' ? currentConfiguration(campaign, pub.campaign) : 'unavailable';
    }
    setLoaded({ requests, current });
  }, [requestsClient, publicClient, listClient, organizationId]);

  const items = campaigns?.kind === 'ok' ? campaigns.items.filter((c) => c.status === 'OPEN') : [];
  const choose = (e: React.FormEvent) => {
    e.preventDefault();
    setDone(null);
    const ref = (campaigns?.kind === 'ok' ? (refInput || items[0]?.campaignRef) : refInput.trim()) ?? '';
    if (!ref) return;
    const sel = { ref, campaign: items.find((c) => c.campaignRef === ref) };
    setSelected(sel);
    void load(sel);
  };

  const requests = loaded && loaded !== 'loading' && loaded.requests.kind === 'ok' ? loaded.requests.items : [];
  const version = selected ? deriveVersion(selected.ref, requests) : 1;
  const pendingExists = requests.some((r) => r.status === 'PENDING');

  return (
    <div>
      <PageHeader title="Configuración de convocatorias" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta (organización y roles)" />}
      {state.status === 'ready' && !enabled && <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />}
      {enabled && campaigns === null && <LoadingState />}
      {enabled && campaigns !== null && (
        <form onSubmit={choose} noValidate>
          {campaigns.kind === 'ok'
            ? (items.length === 0
              ? <EmptyState text="Tu organización no tiene convocatorias abiertas." />
              : <SelectField label="Convocatoria" value={refInput || items[0].campaignRef} onChange={(e) => setRefInput(e.target.value)}
                  options={items.map((c) => ({ value: c.campaignRef, label: c.title }))} />)
            : <TextField label="Referencia de la convocatoria" value={refInput} autoComplete="off" onChange={(e) => setRefInput(e.target.value)}
                hint="Tu cuenta no puede ver el listado de convocatorias: escribe la referencia (la del correo o la que te dio un administrador)." />}
          {(campaigns.kind !== 'ok' || items.length > 0) && <Button type="submit">Ver configuración</Button>}
        </form>
      )}
      {done && <StatusNotice variant="success" text={done} />}
      {loaded === 'loading' && <LoadingState />}
      {selected && loaded && loaded !== 'loading' && (
        <>
          {selected.campaign && (
            <Surface title="Configuración actual">
              {loaded.current === 'unavailable' && <UnavailableState what="La configuración actual de esta convocatoria" />}
              {loaded.current === null && (
                <StatusNotice variant="info" text="Esta convocatoria cierra al alcanzar la meta: su configuración no se puede leer completa y la web no la edita (D-10)." />
              )}
              {loaded.current && loaded.current !== 'unavailable' && (
                <>
                  {summary(loaded.current)}
                  <p className={ui.hint} data-testid="configuration-version">Versión de la configuración (deducida): {version}</p>
                  {pendingExists
                    ? <StatusNotice variant="info" text="Hay una solicitud pendiente: decide sobre ella antes de pedir otro cambio." />
                    : <ConfigurationForm key={`${selected.ref}-${version}`} current={loaded.current}
                        onSubmit={(configuration, mode) => { setDone(null); setAction({ kind: 'submit', mode, configuration, version }); }} />}
                </>
              )}
            </Surface>
          )}
          <Surface title="Solicitudes de cambio">
            {loaded.requests.kind === 'forbidden' && <ForbiddenState />}
            {(loaded.requests.kind === 'error' || loaded.requests.kind === 'unauthorized') && <ErrorState onRetry={() => void load(selected)} />}
            {loaded.requests.kind === 'ok' && requests.length === 0 && <EmptyState text="No hay solicitudes de cambio." />}
            {requests.length > 0 && (
              <ul className={ui.list}>
                {requests.map((r) => (
                  <li key={r.requestId} data-testid="change-request">
                    <p><strong>{REQUEST_STATUS[r.status] ?? r.status}</strong> · solicitada por{' '}
                      <span className={ui.mono}>{r.requestedBy ?? '—'}</span>{r.requestedBy === selfId ? ' (tú)' : ''}
                      {r.requestedAt && <> · <LocalDate iso={r.requestedAt} withTime /></>}</p>
                    {summary(r.proposedConfiguration)}
                    {r.status === 'PENDING' && (
                      <Actions>
                        {r.requestedBy !== selfId && isSurfaceEnabled('action:configuration-approve') && (
                          <Button onClick={() => { setDone(null); setAction({ kind: 'decide', request: r, decision: 'approve' }); }}>Aprobar</Button>
                        )}
                        {isSurfaceEnabled('action:configuration-reject') && (
                          <Button variant="secondary" onClick={() => { setDone(null); setAction({ kind: 'decide', request: r, decision: 'reject' }); }}>
                            {r.requestedBy === selfId ? 'Retirar' : 'Rechazar'}</Button>
                        )}
                      </Actions>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </>
      )}
      {action?.kind === 'submit' && selected && (
        <CommandModal<{ configurationVersion?: number }>
          title={action.mode === 'edit' ? 'Guardar sin aprobación' : 'Solicitar cambio'}
          submitLabel={action.mode === 'edit' ? 'Guardar' : 'Solicitar'} fields={[]}
          description={<>{action.mode === 'edit'
            ? 'La configuración cambia ya (solo si la convocatoria no tiene donaciones).'
            : 'El cambio se aplica cuando otro administrador o el representante lo apruebe.'}{summary(action.configuration)}</>}
          builder={() => (action.mode === 'edit' ? editConfigurationRequest : requestConfigurationChangeRequest)(selected.ref)({
            expectedConfigurationVersion: action.version, configuration: action.configuration,
          })}
          onClose={() => setAction(null)}
          onSuccess={(data) => {
            if (action.mode === 'edit') rememberVersion(selected.ref, data?.configurationVersion);
            setDone(action.mode === 'edit' ? 'Configuración guardada.' : 'Solicitud de cambio enviada.');
            setAction(null);
            void load(selected);
          }} />
      )}
      {action?.kind === 'decide' && selected && (
        <CommandModal<{ configurationVersion?: number }>
          title={action.decision === 'approve' ? 'Aprobar el cambio' : action.request.requestedBy === selfId ? 'Retirar la solicitud' : 'Rechazar el cambio'}
          submitLabel={action.decision === 'approve' ? 'Aprobar' : action.request.requestedBy === selfId ? 'Retirar' : 'Rechazar'} fields={[]}
          description={<>{action.decision === 'approve' ? 'La nueva configuración se aplica desde ahora:' : 'La configuración no cambia. Se proponía:'}
            {summary(action.request.proposedConfiguration)}</>}
          builder={decideChangeRequest(selected.ref, action.request.requestId, action.decision)}
          onClose={() => setAction(null)}
          onSuccess={(data) => {
            rememberVersion(selected.ref, data?.configurationVersion);
            setDone(action.decision === 'approve' ? 'Cambio aprobado.' : 'Solicitud cerrada sin cambios.');
            setAction(null);
            void load(selected);
          }} />
      )}
    </div>
  );
}
