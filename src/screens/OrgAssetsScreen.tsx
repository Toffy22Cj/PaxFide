'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { fetchMe } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { useRead } from '../lib/api/useRead';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { ListOutcome } from '../lib/api/campaignAdmin';
import { fetchOrganizationAssets, OrgAsset } from '../lib/api/organization';
import { lifecycleLabel } from '../lib/labels';
import { LocalDate } from '../components/LocalDate';
import { formatQuantity } from '../lib/quantity';
import { EmptyState, ErrorState, ForbiddenState, LoadingState, UnavailableState } from '../components/States';
import { RegisterAssetForm } from '../components/asset/RegisterAssetForm';
import { getAmbiguousSessionCommands } from '../lib/commands/ambiguousSession';
import { IsometricEmblem, PanelIcon } from './PanelHomeScreen';
import s from './panel.module.css';

export type AssetFilter = 'ALL' | 'STORAGE' | 'TRANSIT' | 'DELIVERED';

/**
 * Agrupación de lifecycleStatus según el boceto y Documentos/plan-fase7-fidelidad.md §5:
 * - En bodega: REGISTERED y RECEIVED;
 * - En camino: DISPATCHED;
 * - Entregados: DELIVERED.
 */
export function matchesAssetFilter(status: string, filter: AssetFilter): boolean {
  switch (filter) {
    case 'ALL':
      return true;
    case 'STORAGE':
      return status === 'REGISTERED' || status === 'RECEIVED';
    case 'TRANSIT':
      return status === 'DISPATCHED';
    case 'DELIVERED':
      return status === 'DELIVERED';
    default: {
      const _unreachable: never = filter;
      return _unreachable;
    }
  }
}

function assetStatusTone(status: string, isAmbiguous: boolean): 'ok' | 'info' | 'amb' | 'off' {
  if (isAmbiguous) return 'amb';
  switch (status) {
    case 'REGISTERED':
    case 'RECEIVED':
    case 'DELIVERED':
      return 'ok';
    case 'DISPATCHED':
      return 'info';
    default:
      return 'off';
  }
}

function stClass(tone: 'ok' | 'info' | 'amb' | 'off'): string {
  switch (tone) {
    case 'ok':
      return s.stOk;
    case 'info':
      return s.stInfo;
    case 'amb':
      return s.stAmb;
    case 'off':
      return s.stOff;
  }
}

/**
 * `/panel/assets` (F-B2, fidelidad visual a vPanel('assets') de paxfide-panel.html).
 * Cabecera con "Registrar lote", aviso amarillo de los ambiguos de la sesión (D6),
 * chips "Todos" / "En bodega" / "En camino" / "Entregados", y tabla (lote, contenido, cantidad, estado, ubicación; sin fecha, X-14).
 * Fila ambigua resaltada en amarillo.
 */
export function OrgAssetsScreen({
  meClient = fetchMe,
  assetsClient = fetchOrganizationAssets,
}: {
  meClient?: typeof fetchMe;
  assetsClient?: typeof fetchOrganizationAssets;
}) {
  const { state, reload } = usePrincipal(meClient);
  const [registering, setRegistering] = useState(false);
  const [filter, setFilter] = useState<AssetFilter>('ALL');

  const organizationId = state.status === 'ready' ? state.data.organizationId : undefined;
  const roles = state.status === 'ready' ? state.data.roles : [];
  const isAdmin = roles.includes('ADMINISTRATOR');
  const isEmployee = roles.includes('EMPLOYEE');
  const enabled = !!organizationId && (isAdmin || isEmployee);
  const canRegister = enabled && isEmployee && isSurfaceEnabled('action:register-asset');

  const list = useRead<ListOutcome<OrgAsset> | null, never>(async () => ({
    status: 'ready',
    data: enabled ? await assetsClient(organizationId!) : null,
  }), [enabled, organizationId]);

  const assets = list.state.status === 'ready' && list.state.data ? list.state.data : undefined;
  const linkable = isSurfaceEnabled('/assets/:assetRef');

  const items = assets?.kind === 'ok' ? assets.items : [];
  const ambiguousCommands = getAmbiguousSessionCommands();
  const isAssetAmbiguous = (ref: string) =>
    ambiguousCommands.some((c) => c.id === ref || c.title.includes(ref) || c.detail.includes(ref));

  const ambiguousCount = items.filter((a) => isAssetAmbiguous(a.assetRef)).length || ambiguousCommands.length;
  const filtered = items.filter((a) => matchesAssetFilter(a.lifecycleStatus, filter));

  return (
    <div className={s.container} data-testid="panel-content">
      {/* Cabecera del panel según vPanel('assets') del boceto */}
      <header className={s.pnHead} data-testid="panel-header">
        <div className={s.headLeft}>
          <IsometricEmblem district="assets" />
          <div className={s.headText}>
            <h1 className={s.headTitle} data-testid="assets-title">
              Lotes
            </h1>
            <p className={s.headSub}>
              {enabled ? `Tu organización · Bodega central` : 'Organización'}
            </p>
          </div>
        </div>
        <div className={s.acts}>
          {canRegister && !registering && (
            <button
              type="button"
              className={s.pnBtnPrimary}
              aria-label="Registrar activo"
              onClick={() => setRegistering(true)}
              data-testid="register-asset-button"
            >
              <PanelIcon name="plus" /> Registrar lote
            </button>
          )}
        </div>
      </header>

      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'unavailable' && <UnavailableState what="La información de tu cuenta (organización y roles)" />}
      {state.status === 'ready' && !enabled && <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />}

      {enabled && (
        <>
          {registering && (
            <RegisterAssetForm
              organizationId={organizationId!}
              onRegistered={() => {
                setRegistering(false);
                list.reload();
              }}
              onCancel={() => setRegistering(false)}
            />
          )}

          {/* Aviso amarillo de ambiguos de la sesión (D6): sin controles dentro */}
          {ambiguousCount > 0 && (
            <div className={s.pnNote} role="status" data-testid="ambiguous-assets-notice">
              <PanelIcon name="info" />
              <div className={s.pnNoteContent}>
                <b>
                  {ambiguousCount} {ambiguousCount === 1 ? 'lote sin confirmar.' : 'lotes sin confirmar.'}
                </b>
                <span>Puede que la operación se haya realizado. Revísalo antes de repetirla.</span>
              </div>
            </div>
          )}

          {/* Chips de filtro de estado */}
          <div className={s.pnTabs} role="group" aria-label="Estado">
            <button
              type="button"
              className={s.pnTabBtn}
              aria-pressed={filter === 'ALL'}
              onClick={() => setFilter('ALL')}
            >
              Todos
            </button>
            <button
              type="button"
              className={s.pnTabBtn}
              aria-pressed={filter === 'STORAGE'}
              onClick={() => setFilter('STORAGE')}
            >
              En bodega
            </button>
            <button
              type="button"
              className={s.pnTabBtn}
              aria-pressed={filter === 'TRANSIT'}
              onClick={() => setFilter('TRANSIT')}
            >
              En camino
            </button>
            <button
              type="button"
              className={s.pnTabBtn}
              aria-pressed={filter === 'DELIVERED'}
              onClick={() => setFilter('DELIVERED')}
            >
              Entregados
            </button>
          </div>

          {assets === undefined && <LoadingState />}
          {assets?.kind === 'forbidden' && <ForbiddenState />}
          {(assets?.kind === 'error' || assets?.kind === 'unauthorized') && <ErrorState onRetry={list.reload} />}
          {assets?.kind === 'ok' && items.length === 0 && (
            <EmptyState text="Tu organización todavía no tiene activos registrados." />
          )}

          {assets?.kind === 'ok' && items.length > 0 && (
            <div className={s.tblWrap}>
              <table className={s.pnTable}>
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Contenido</th>
                    <th>Cantidad</th>
                    <th>Estado</th>
                    <th>Ubicación</th>
                    <th>Último cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const isAmb = isAssetAmbiguous(a.assetRef);
                    const tone = assetStatusTone(a.lifecycleStatus, isAmb);
                    return (
                      <tr
                        key={a.assetRef}
                        className={isAmb ? s.ambRow : undefined}
                        data-testid="org-asset"
                      >
                        <td className={s.mono}>
                          <b>
                            {linkable ? (
                              <Link href={`/assets/${encodeURIComponent(a.assetRef)}`}>{a.assetRef}</Link>
                            ) : (
                              a.assetRef
                            )}
                          </b>
                        </td>
                        <td>{a.assetType ?? '—'}</td>
                        <td className={s.mono}>
                          {a.quantity ? formatQuantity(a.quantity) : '—'} {a.unitOfMeasure ?? ''}
                        </td>
                        <td>
                          <span className={`${s.st} ${stClass(tone)}`}>
                            {lifecycleLabel(a.lifecycleStatus)}
                          </span>
                        </td>
                        <td>{a.currentLocation ?? '—'}</td>
                        {/* G-9: sin `lastEventAt`, vacía (nunca "hace 0 días") */}
                        <td className={s.mono} data-testid="org-asset-last-change">{a.lastEventAt ? <LocalDate iso={a.lastEventAt} withTime compact /> : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className={s.pnFoot}>
            Despachar y recibir se hacen escaneando el QR en la app móvil.
          </p>
        </>
      )}
    </div>
  );
}
