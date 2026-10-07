'use client';

import React, { useState } from 'react';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { useRead } from '../lib/api/useRead';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { ListOutcome } from '../lib/api/campaignAdmin';
import { confirmAllocationRequest, fetchFunds, Fund, requestAllocationRequest } from '../lib/api/organization';
import { formatMinorUnits, toMinorUnits } from '../lib/money';
import { allocationStatusLabel } from '../lib/labels';
import { Actions, DefinitionList, PageHeader, Surface, uiClasses as ui } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ForbiddenState, LoadingState, StatusNotice, UnavailableState } from '../components/States';
import { CommandModal } from '../components/asset/CommandModal';

type Action = { kind: 'request'; fund: Fund } | { kind: 'confirm'; fund: Fund; allocationId: string };

/**
 * `/panel/funds` (camino A; S-04): fondos de la organización con sus asignaciones (`ADMINISTRATOR` o `EMPLOYEE`).
 * `ADMINISTRATOR` solicita una asignación (`Command-Id`) y la confirma (DD-32). Representación: el backend autoriza.
 */
export function FundsScreen({ meClient = fetchMe, fundsClient = fetchFunds }: {
  meClient?: typeof fetchMe;
  fundsClient?: typeof fetchFunds;
}) {
  const { state, reload } = usePrincipal(meClient);
  const [action, setAction] = useState<Action | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const organizationId = state.status === 'ready' ? state.data.organizationId : undefined;
  const roles = state.status === 'ready' ? state.data.roles : [];
  const isAdmin = roles.includes('ADMINISTRATOR');
  const enabled = !!organizationId && (isAdmin || roles.includes('EMPLOYEE'));

  const list = useRead<ListOutcome<Fund> | null, never>(async () => ({
    status: 'ready', data: enabled ? await fundsClient(organizationId!) : null,
  }), [enabled, organizationId]);
  const funds = list.state.status === 'ready' && list.state.data ? list.state.data : undefined;
  const canRequest = isAdmin && isSurfaceEnabled('action:request-allocation');
  const canConfirm = isAdmin && isSurfaceEnabled('action:confirm-allocation');

  return (
    <div>
      <PageHeader title="Fondos de mi organización" />
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta (organización y roles)" />}
      {state.status === 'ready' && !enabled && <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />}
      {enabled && (
        <>
          {done && <StatusNotice variant="success" text={done} />}
          {funds === undefined && <LoadingState />}
          {funds?.kind === 'forbidden' && <ForbiddenState />}
          {(funds?.kind === 'error' || funds?.kind === 'unauthorized') && <ErrorState onRetry={list.reload} />}
          {funds?.kind === 'ok' && funds.items.length === 0 && <EmptyState text="Tu organización todavía no tiene fondos." />}
          {funds?.kind === 'ok' && funds.items.length > 0 && (
            <ul className={ui.list}>
              {funds.items.map((f) => (
                <li key={f.fundId} data-testid="fund">
                  <Surface title={`Fondo ${f.fundId}`} headingLevel={3}>
                    <DefinitionList items={[
                      { label: 'Recibido', value: formatMinorUnits(f.clearedAmount, f.currency) },
                      { label: 'Disponible', value: formatMinorUnits(f.availableAmount, f.currency), testId: 'fund-available' },
                      { label: 'Convocatoria', value: f.campaignRef ? <span className={ui.mono}>{f.campaignRef}</span> : '—' },
                    ]} />
                    <h4 className={ui.sectionTitle}>Asignaciones</h4>
                    {f.allocations.length === 0 ? <p>Sin asignaciones.</p> : (
                      <ul className={ui.list}>
                        {f.allocations.map((a) => (
                          <li key={a.allocationId} data-testid="allocation">
                            <span className={ui.mono}>{a.allocationId}</span> · {formatMinorUnits(a.amount, f.currency)} · {allocationStatusLabel(a.status)}
                            {canConfirm && a.status === 'REQUESTED' && (
                              <> <Button variant="secondary" onClick={() => { setDone(null); setAction({ kind: 'confirm', fund: f, allocationId: a.allocationId }); }}>
                                Confirmar asignación</Button></>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {canRequest && (
                      <Actions>
                        <Button onClick={() => { setDone(null); setAction({ kind: 'request', fund: f }); }}>Solicitar asignación</Button>
                      </Actions>
                    )}
                  </Surface>
                </li>
              ))}
            </ul>
          )}
          {action?.kind === 'request' && (
            <CommandModal title="Solicitar asignación" submitLabel="Solicitar asignación"
              description={`Disponible: ${formatMinorUnits(action.fund.availableAmount, action.fund.currency)}.`}
              fields={[{
                name: 'amount', label: `Importe (${action.fund.currency})`,
                hint: 'Sin separador de miles (por ejemplo, 50000 o 50000,50).',
                parse: (raw) => toMinorUnits(raw, action.fund.currency), invalid: 'Escribe un importe válido mayor que cero.',
              }]}
              builder={requestAllocationRequest(action.fund.fundId)}
              onClose={() => setAction(null)}
              onSuccess={() => { setDone('Asignación solicitada.'); setAction(null); list.reload(); }} />
          )}
          {action?.kind === 'confirm' && (
            <CommandModal title="Confirmar asignación" submitLabel="Confirmar asignación" fields={[]}
              description={<>Se confirma la asignación <span className={ui.mono}>{action.allocationId}</span>.</>}
              builder={confirmAllocationRequest(action.fund.fundId, action.allocationId)}
              onClose={() => setAction(null)}
              onSuccess={() => { setDone('Asignación confirmada.'); setAction(null); list.reload(); }} />
          )}
        </>
      )}
    </div>
  );
}
