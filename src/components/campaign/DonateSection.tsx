'use client';

import React, { useState, useSyncExternalStore } from 'react';
import * as session from '../../lib/auth/session';
import { useCommand } from '../../lib/commands/useCommand';
import {
  CreatedIntent, donationIntentRequest, fetchIntentStatus, IntentStatusOutcome, parseCreatedIntent, PublicCampaign,
} from '../../lib/api/publicCampaigns';
import { formatMinorUnits, toMinorUnits } from '../../lib/money';
import { paymentMethodLabel } from '../../lib/labels';
import { Button } from '../ui/Button';
import { TextField, SelectField } from '../ui/Field';
import { Actions, Surface } from '../ui/Layout';
import { CommandFeedback } from '../CommandFeedback';
import { ErrorState, StatusNotice } from '../States';
import { TrackingCodeReveal } from './TrackingCodeReveal';
import { useLeaveWarning } from '../../lib/useLeaveWarning';

const LEAVE_MESSAGE = 'Si sales de esta página perderás el acceso al estado de tu donación, que todavía no está confirmada. ¿Quieres salir?';

/** La consulta queda resuelta cuando llega el trackingCode o un estado final; antes, salir pierde el acceso (A3). */
function settled(status: StatusView): boolean {
  if (!status || status.loading) return false;
  const o = status.outcome;
  if (o.kind === 'not-found') return true;
  if (o.kind !== 'ok') return false;
  return !!o.trackingCode || ['FAILED', 'FUNDING_REJECTED', 'EXPIRED_UNKNOWN'].includes(o.status);
}
import s from './campaign.module.css';

/** Medios con los que CV-11 crea una intención: el efectivo no se registra por esta vía (CashDonationIntentNotSupported). */
const INTENT_METHODS = ['GATEWAY', 'BANK_TRANSFER'];

type StatusView = { loading: true } | { loading: false; outcome: IntentStatusOutcome } | null;

/**
 * Donar (CV-11) con o sin cuenta y consulta del estado (Enmienda 3 de ADR-037). Ampliación del alcance: ADR-046
 * Enmienda 1 (borrador).
 *
 * - `Command-Id` por intención (D6): ambiguo → reintento con el mismo; un reenvío devuelve la misma intención con un
 *   `statusToken` nuevo (DD-18 sustituida), que reemplaza al anterior.
 * - El `statusToken` vive solo en el estado de este componente: nunca en almacenamiento, URL, DOM ni logs. Viaja
 *   únicamente en la cabecera `Intent-Token`.
 * - La consulta del estado es una lectura: la pide el usuario; no hay sondeo automático (DW-15).
 * - Mientras la donación no esté resuelta, salir de la página pide confirmación (A3, Enmienda 1 de ADR-046).
 */
export function DonateSection({ publicCode, campaign, statusClient = fetchIntentStatus }: {
  publicCode: string;
  campaign: PublicCampaign;
  statusClient?: typeof fetchIntentStatus;
}) {
  const sessionState = useSyncExternalStore(session.subscribe, session.getState, () => 'RESTORING' as session.MachineState);
  const methods = campaign.acceptedPaymentMethods.filter((m) => INTENT_METHODS.includes(m));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(methods.length === 1 ? methods[0] : '');
  const [errors, setErrors] = useState<{ amount?: string; method?: string }>({});
  const [status, setStatus] = useState<StatusView>(null);
  const command = useCommand<unknown>(donationIntentRequest(publicCode));
  const openIntent = command.state === 'SUCCESS' && !!parseCreatedIntent(command.data)?.statusToken;
  useLeaveWarning(openIntent && !settled(status), LEAVE_MESSAGE);

  const accepted = campaign.status === 'OPEN' && campaign.acceptedDonationTypes.includes('MONETARY')
    && !!campaign.currency && methods.length > 0;

  if (campaign.status === 'CLOSED') {
    return <StatusNotice variant="info" text="Esta convocatoria está cerrada y ya no recibe donaciones." />;
  }
  if (!accepted) {
    return <StatusNotice variant="info" text="Esta convocatoria no recibe donaciones en dinero por la web." />;
  }
  const currency = campaign.currency as string;

  const intent: CreatedIntent | null = command.state === 'SUCCESS' ? parseCreatedIntent(command.data) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const minor = toMinorUnits(amount, currency);
    const next = {
      amount: minor ? undefined : 'Escribe un monto válido, sin separador de miles (por ejemplo, 50000 o 50000,50).',
      method: method ? undefined : 'Elige un medio de pago.',
    };
    setErrors(next);
    if (next.amount || next.method) return;
    setStatus(null);
    void command.execute({ amount: minor, currency, paymentMethod: method });
  };

  const consult = async (i: CreatedIntent) => {
    if (!i.statusToken) return;
    setStatus({ loading: true });
    const outcome = await statusClient(i.intentId, i.statusToken);
    setStatus({ loading: false, outcome });
  };

  const restart = () => {
    setStatus(null);
    setAmount('');
    command.newIntent();
  };

  if (command.state === 'SUCCESS' && !intent) {
    return <ErrorState text="No pudimos leer la respuesta del servicio. Revisa tu donación antes de repetirla." />;
  }

  if (intent) {
    const minor = toMinorUnits(amount, currency) ?? '';
    return (
      <Surface title="Tu donación">
        <StatusNotice variant="success" title="Intención de donación registrada"
          text={`Monto: ${formatMinorUnits(minor, currency)} · Medio: ${paymentMethodLabel(method)}`} />
        <StatusNotice variant="info"
          text="No recargues ni cierres esta página: el acceso al estado de tu donación solo existe en esta pestaña." />
        {method === 'GATEWAY' && intent.paymentRedirectUrl && (
          <StatusNotice variant="info" title="Redirección a la pasarela de pago (simulada)">
            <p>Esta demo usa un proveedor de pago simulado: no se cobra dinero. El proveedor confirma el pago por su
              cuenta; cuando lo haga, consulta el estado aquí.</p>
          </StatusNotice>
        )}
        {method === 'BANK_TRANSFER' && (
          <StatusNotice variant="info" text="La organización confirmará la transferencia cuando la reciba. Después, consulta el estado aquí." />
        )}
        {!intent.statusToken && (
          <StatusNotice variant="ambiguous" text="El servicio no devolvió el acceso al estado de esta donación, así que no podemos consultarlo desde aquí." />
        )}
        <IntentStatus status={status} onRestart={restart} />
        <Actions>
          {intent.statusToken && !(status && !status.loading && status.outcome.kind === 'ok' && status.outcome.trackingCode) && (
            <Button onClick={() => void consult(intent)} sending={status?.loading}>Consultar estado del pago</Button>
          )}
        </Actions>
      </Surface>
    );
  }

  return (
    <Surface title="Donar">
      <p>
        {sessionState === 'AUTHENTICATED'
          ? 'Donarás con tu cuenta: la donación aparecerá en «Mis donaciones».'
          : 'Donarás sin cuenta. Al confirmarse el pago recibirás un código de seguimiento: guárdalo.'}
      </p>
      <form onSubmit={submit} noValidate>
        <TextField label={`Monto (${currency})`} inputMode="decimal" autoComplete="off" value={amount}
          onChange={(e) => setAmount(e.target.value)} error={errors.amount} disabled={command.state === 'SENDING'}
          hint="Sin separador de miles. Ejemplo: 50000" />
        <SelectField label="Medio de pago" value={method} onChange={(e) => setMethod(e.target.value)} error={errors.method}
          disabled={command.state === 'SENDING'} placeholder={methods.length > 1 ? 'Elige un medio' : undefined}
          options={methods.map((m) => ({ value: m, label: paymentMethodLabel(m) }))} />
        <CommandFeedback command={command} />
        {command.state !== 'AMBIGUOUS' && (
          <Button type="submit" sending={command.state === 'SENDING'}>Donar</Button>
        )}
      </form>
    </Surface>
  );
}

function IntentStatus({ status, onRestart }: { status: StatusView; onRestart: () => void }) {
  if (!status || status.loading) return null;
  const o = status.outcome;
  if (o.kind === 'error') return <ErrorState text="No pudimos consultar el estado. Inténtalo de nuevo." />;
  if (o.kind === 'not-found') {
    return <StatusNotice variant="rejected" text="No pudimos consultar esta donación: el acceso a su estado ya no es válido." />;
  }
  switch (o.status) {
    case 'PENDING':
      return <StatusNotice variant="info" text="El pago todavía está pendiente de confirmación." />;
    case 'CONFIRMED':
      return o.trackingCode
        ? <TrackingCodeReveal trackingCode={o.trackingCode} />
        : <StatusNotice variant="info" text="Pago confirmado. Estamos aplicando los fondos a la convocatoria; consulta de nuevo en unos segundos." />;
    case 'FAILED':
      return (
        <StatusNotice variant="rejected" text="El pago no se completó.">
          <Actions><Button variant="secondary" onClick={onRestart}>Hacer otra donación</Button></Actions>
        </StatusNotice>
      );
    case 'EXPIRED_UNKNOWN':
      return <StatusNotice variant="ambiguous" title="No pudimos confirmar el pago a tiempo"
        text="Si se te cobró, contacta con la organización antes de volver a donar." />;
    case 'FUNDING_REJECTED':
      return <StatusNotice variant="rejected" text="La convocatoria no pudo aceptar los fondos de esta donación." />;
    default:
      return <StatusNotice variant="info" text={`Estado de la donación: ${o.status}`} />;
  }
}
