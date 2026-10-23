'use client';

// Ref: Documentos/plan-fase7-pantallas.md §5 B-2; Documentos/prompts-agentes-estilo-v2.md §3.2, §6 VS-6;
// Documentos/sistema-visual-paxfide-web-enmienda-1.md §3.1, §4–§7.

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icons';
import { Surface, Actions, uiClasses as ui } from '../components/ui/Layout';
import { EmptyState, ErrorState, LoadingState, UnavailableState } from '../components/States';
import { LocalDate } from '../components/LocalDate';
import { RegisterAssetForm } from '../components/asset/RegisterAssetForm';
import { fetchMe, Principal } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { useRead } from '../lib/api/useRead';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import {
  AdminCampaign,
  fetchOrganizationCampaigns,
} from '../lib/api/campaignAdmin';
import {
  fetchFunds,
  fetchOrganization,
  fetchOrganizationAssets,
  Fund,
  OrgAsset,
  OrganizationDetails,
} from '../lib/api/organization';
import {
  AmbiguousCommandItem,
  getAmbiguousSessionCommands,
} from '../lib/commands/ambiguousSession';
import {
  campaignStatusLabel,
  lifecycleLabel,
  roleLabel,
  verificationStatusLabel,
} from '../lib/labels';
import { formatMinorUnits, percentOf } from '../lib/money';
import { formatQuantity } from '../lib/quantity';
import s from './panel.module.css';

export interface PanelEntry {
  id: string;
  label: string;
  href: string;
}

/**
 * Entradas de `PanelHome` (D-N1-1 (a)): una entrada se muestra si el contrato de su destino autoriza al menos uno de
 * los roles del principal. Es representación, no autorización. Cuando `/me` no está disponible solo se ofrecen las
 * entradas que no dependen de roles (DW-06).
 */
export function panelEntries(principal: Principal | null): PanelEntry[] {
  const roles = principal?.roles ?? [];
  const entries: PanelEntry[] = [];
  if (roles.includes('ADMINISTRATOR') && isSurfaceEnabled('/panel/campaigns')) {
    entries.push({ id: 'campaigns', label: 'Convocatorias de mi organización', href: '/panel/campaigns' });
  }
  if ((roles.includes('ADMINISTRATOR') || roles.includes('REPRESENTATIVE')) && isSurfaceEnabled('/panel/prediction')) {
    entries.push({ id: 'prediction', label: 'Estimación de convocatorias', href: '/panel/prediction' });
  }
  if ((roles.includes('ADMINISTRATOR') || roles.includes('EMPLOYEE')) && isSurfaceEnabled('/panel/funds')) {
    entries.push({ id: 'funds', label: 'Fondos de mi organización', href: '/panel/funds' });
  }
  if ((roles.includes('ADMINISTRATOR') || roles.includes('EMPLOYEE')) && isSurfaceEnabled('/panel/assets')) {
    entries.push({ id: 'assets', label: 'Activos de mi organización', href: '/panel/assets' });
  }
  if (principal?.platformAuthority && isSurfaceEnabled('/panel/platform')) {
    entries.push({ id: 'platform', label: 'Plataforma: verificación y administradores', href: '/panel/platform' });
  }
  if ((roles.includes('ADMINISTRATOR') || roles.includes('REPRESENTATIVE')) && isSurfaceEnabled('/panel/configuration')) {
    entries.push({ id: 'configuration', label: 'Configuración de convocatorias', href: '/panel/configuration' });
  }
  if ((roles.includes('ADMINISTRATOR') || roles.includes('REPRESENTATIVE')) && isSurfaceEnabled('/panel/members')) {
    entries.push({ id: 'members', label: 'Personas de mi organización', href: '/panel/members' });
  }
  // Cualquier miembro puede ser responsable (EMPLOYEE o ADMINISTRATOR); la lista dice si lo es
  if ((roles.includes('EMPLOYEE') || roles.includes('ADMINISTRATOR')) && isSurfaceEnabled('/panel/my-campaigns')) {
    entries.push({ id: 'my-campaigns', label: 'Mis convocatorias', href: '/panel/my-campaigns' });
  }
  // Con `/me` leído: sin organización, para crearla; con organización, para ver la cuenta en ella (R9)
  if (principal && isSurfaceEnabled('/panel/organization')) {
    entries.push(principal.organizationId
      ? { id: 'organization', label: 'Mi organización', href: '/panel/organization' }
      : { id: 'organization', label: 'Crear organización', href: '/panel/organization' });
  }
  if (isSurfaceEnabled('/account/donations')) {
    entries.push({ id: 'donations', label: 'Mis donaciones', href: '/account/donations' });
  }
  return entries;
}

function Entries({ entries }: { entries: PanelEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />;
  }
  return (
    <ul className={ui.list}>
      {entries.map((e) => (
        <li key={e.id}>
          <Link href={e.href} className={[ui.button, ui.secondary, ui.block].join(' ')} data-testid={`${e.id}-link`}>
            {e.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Registrar activo" (D-N1-2 (a)): a `EMPLOYEE`; nunca a un principal cuyo único rol aplicable sea
 * `REPRESENTATIVE` mientras R10 siga abierto.
 */
export function canRegisterAsset(principal: Principal | null): boolean {
  return !!principal && principal.roles.includes('EMPLOYEE') && isSurfaceEnabled('action:register-asset');
}

/**
 * D-P9: "Cierra pronto" = convocatoria abierta con `endDate` dentro de los próximos 7 días (calculado en cliente).
 */
export function isClosingSoon(
  campaign: { status: string; endDate?: string },
  now: number = Date.now()
): boolean {
  if (campaign.status !== 'OPEN' || !campaign.endDate) return false;
  const endMs = new Date(campaign.endDate).getTime();
  if (Number.isNaN(endMs)) return false;
  const diffMs = endMs - now;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  return diffMs >= 0 && diffMs <= SEVEN_DAYS_MS;
}

/**
 * KPI: Recaudado total por moneda acumulado a partir de los fondos.
 */
export function computeTotalClearedByCurrency(funds: Fund[]): { currency: string; formatted: string }[] {
  const map: Record<string, bigint> = {};
  for (const f of funds) {
    const curr = f.currency;
    const amt = BigInt(f.clearedAmount || '0');
    map[curr] = (map[curr] ?? BigInt(0)) + amt;
  }
  const entries = Object.entries(map);
  if (entries.length === 0) {
    return [{ currency: 'COP', formatted: formatMinorUnits('0', 'COP') }];
  }
  return entries.map(([currency, total]) => ({
    currency,
    formatted: formatMinorUnits(total.toString(), currency),
  }));
}

/**
 * KPI: Lotes por despachar (aquellos en estado REGISTERED o RECEIVED).
 */
export function countDispatcheableAssets(assets: OrgAsset[]): number {
  return assets.filter(
    (a) => a.lifecycleStatus === 'REGISTERED' || a.lifecycleStatus === 'RECEIVED'
  ).length;
}

export interface PanelHomeScreenProps {
  meClient?: typeof fetchMe;
  orgClient?: typeof fetchOrganization;
  campaignsClient?: typeof fetchOrganizationCampaigns;
  fundsClient?: typeof fetchFunds;
  assetsClient?: typeof fetchOrganizationAssets;
  ambiguousCommands?: AmbiguousCommandItem[];
  now?: number;
}

export function PanelHomeScreen({
  meClient = fetchMe,
  orgClient = fetchOrganization,
  campaignsClient = fetchOrganizationCampaigns,
  fundsClient = fetchFunds,
  assetsClient = fetchOrganizationAssets,
  ambiguousCommands,
  now = Date.now(),
}: PanelHomeScreenProps) {
  const { state, reload } = usePrincipal(meClient);
  const router = useRouter();
  const [registering, setRegistering] = useState(false);

  const principal = state.status === 'ready' ? state.data : null;
  const roles = principal?.roles ?? [];
  const orgId = principal?.organizationId;
  const isAdmin = roles.includes('ADMINISTRATOR');
  const isEmployee = roles.includes('EMPLOYEE');
  const isRepresentative = roles.includes('REPRESENTATIVE');

  // Cada consulta según el rol: lo que el rol no puede leer no se pide (§3.2, VS-6)
  const canFetchOrg = !!orgId && (isAdmin || isRepresentative);
  const canFetchCampaigns = !!orgId && isAdmin && isSurfaceEnabled('/panel/campaigns');
  const canFetchFunds = !!orgId && (isAdmin || isEmployee) && isSurfaceEnabled('/panel/funds');
  const canFetchAssets = !!orgId && (isAdmin || isEmployee) && isSurfaceEnabled('/panel/assets');

  const orgRead = useRead<OrganizationDetails | null, never>(async () => {
    if (!canFetchOrg) return { status: 'ready', data: null };
    const r = await orgClient(orgId!);
    return { status: 'ready', data: r.kind === 'ok' ? r.organization : null };
  }, [canFetchOrg, orgId]);

  const campaignsRead = useRead<AdminCampaign[] | null, never>(async () => {
    if (!canFetchCampaigns) return { status: 'ready', data: null };
    const r = await campaignsClient(orgId!);
    return { status: 'ready', data: r.kind === 'ok' ? r.items : null };
  }, [canFetchCampaigns, orgId]);

  const fundsRead = useRead<Fund[] | null, never>(async () => {
    if (!canFetchFunds) return { status: 'ready', data: null };
    const r = await fundsClient(orgId!);
    return { status: 'ready', data: r.kind === 'ok' ? r.items : null };
  }, [canFetchFunds, orgId]);

  const assetsRead = useRead<OrgAsset[] | null, never>(async () => {
    if (!canFetchAssets) return { status: 'ready', data: null };
    const r = await assetsClient(orgId!);
    return { status: 'ready', data: r.kind === 'ok' ? r.items : null };
  }, [canFetchAssets, orgId]);

  if (state.status === 'loading') {
    return (
      <div data-testid="panel-content">
        <header className={s.orgHead}>
          <div className={s.headMain}>
            <div className={s.headText}>
              <h1 className={s.headTitle} data-testid="panel-title">Tu organización</h1>
            </div>
          </div>
        </header>
        <LoadingState />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div data-testid="panel-content">
        <header className={s.orgHead}>
          <div className={s.headMain}>
            <div className={s.headText}>
              <h1 className={s.headTitle} data-testid="panel-title">Tu organización</h1>
            </div>
          </div>
        </header>
        <ErrorState onRetry={reload} />
      </div>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <div data-testid="panel-content">
        <header className={s.orgHead}>
          <div className={s.headMain}>
            <div className={s.headText}>
              <h1 className={s.headTitle} data-testid="panel-title">Tu organización</h1>
            </div>
          </div>
        </header>
        <UnavailableState what="La información de tu cuenta (organización y roles)" />
        <Entries entries={panelEntries(null)} />
      </div>
    );
  }

  const entries = panelEntries(principal);
  const register = canRegisterAsset(principal);

  // Si no hay superficies ni opciones para este usuario, mostrar EmptyState directo
  if (entries.length === 0 && !canFetchCampaigns && !canFetchFunds && !canFetchAssets && !register) {
    return (
      <div data-testid="panel-content">
        <header className={s.orgHead}>
          <div className={s.headMain}>
            <div className={s.headText}>
              <h1 className={s.headTitle} data-testid="panel-title">Tu organización</h1>
            </div>
          </div>
        </header>
        <EmptyState text="No hay opciones disponibles para tu cuenta en este panel." />
      </div>
    );
  }

  const orgDetails = orgRead.state.status === 'ready' ? orgRead.state.data : null;
  const campaigns = campaignsRead.state.status === 'ready' ? campaignsRead.state.data : null;
  const funds = fundsRead.state.status === 'ready' ? fundsRead.state.data : null;
  const assets = assetsRead.state.status === 'ready' ? assetsRead.state.data : null;

  // Comandos ambiguos en memoria de la sesión (D6)
  const currentAmbiguous = ambiguousCommands ?? getAmbiguousSessionCommands();

  // Pendientes: Convocatorias sin empleado (assignedEmployeeCount === 0)
  const unassignedCampaigns = isAdmin && campaigns ? campaigns.filter((c) => c.status === 'OPEN' && c.assignedEmployeeCount === 0) : [];

  // Pendientes: Fondos con saldo disponible por aplicar (availableAmount > 0)
  const availableFunds = (isAdmin || isEmployee) && funds ? funds.filter((f) => BigInt(f.availableAmount || '0') > BigInt(0)) : [];

  const hasTodos = currentAmbiguous.length > 0 || unassignedCampaigns.length > 0 || availableFunds.length > 0;

  // KPIs
  const openCampaignsCount = isAdmin && campaigns ? campaigns.filter((c) => c.status === 'OPEN').length : null;
  const clearedTotals = (isAdmin || isEmployee) && funds ? computeTotalClearedByCurrency(funds) : null;
  const assetsToDispatchCount = (isAdmin || isEmployee) && assets ? countDispatcheableAssets(assets) : null;
  const hasKpis = openCampaignsCount !== null || clearedTotals !== null || assetsToDispatchCount !== null;

  return (
    <div data-testid="panel-content" className={s.container}>
      {/* Cabecera: Nombre y logo si el rol lo permite (ADMINISTRATOR o REPRESENTATIVE); D-P8 */}
      <header className={s.orgHead} data-testid="panel-header">
        <div className={s.headMain}>
          {canFetchOrg && (
            orgDetails?.logoUrl ? (
              <img src={orgDetails.logoUrl} alt={orgDetails.name ?? 'Logo'} className={s.logoImg} />
            ) : (
              <div className={s.logoInitial} aria-hidden="true" data-testid="org-initial">
                {(orgDetails?.name ?? 'O').trim().charAt(0).toUpperCase()}
              </div>
            )
          )}
          <div className={s.headText}>
            <h1 className={s.headTitle} data-testid="panel-title">
              {canFetchOrg && orgDetails?.name ? orgDetails.name : 'Tu organización'}
            </h1>
            <p className={s.headSub}>
              {roles.map(roleLabel).join(', ') || 'Organización'}
              {orgDetails?.verificationStatus ? ` · ${verificationStatusLabel(orgDetails.verificationStatus)}` : ''}
            </p>
          </div>
        </div>
        <div className={s.headActions}>
          {register && !registering && (
            <Button variant="secondary" onClick={() => setRegistering(true)}>
              Registrar activo
            </Button>
          )}
        </div>
      </header>

      {/* Si no tiene organización */}
      {!orgId && (
        <Surface title="¿Tienes una fundación?">
          <p>Regístrala, la revisamos y luego puedes publicar convocatorias.</p>
          <Actions>
            <Link href="/panel/organization" className={[ui.button, ui.secondary].join(' ')}>
              Registrar organización
            </Link>
          </Actions>
        </Surface>
      )}

      {/* KPIs según rol */}
      {hasKpis && (
        <section aria-label="Indicadores clave" className={s.kpiGrid} data-testid="panel-kpis">
          {openCampaignsCount !== null && (
            <div className={s.kpiCard} data-testid="kpi-open-campaigns">
              <span className={s.kpiLabel}>Convocatorias abiertas</span>
              <span className={s.kpiValue}>{openCampaignsCount}</span>
              <span className={s.kpiSub}>Convocatorias activas</span>
            </div>
          )}
          {clearedTotals !== null && (
            <div className={s.kpiCard} data-testid="kpi-cleared-amount">
              <span className={s.kpiLabel}>Recaudado total</span>
              <span className={s.kpiValue}>
                {clearedTotals.map((t) => t.formatted).join(' · ')}
              </span>
              <span className={s.kpiSub}>Confirmado en fondos</span>
            </div>
          )}
          {assetsToDispatchCount !== null && (
            <div className={s.kpiCard} data-testid="kpi-assets-dispatch">
              <span className={s.kpiLabel}>Lotes por despachar</span>
              <span className={s.kpiValue}>{assetsToDispatchCount}</span>
              <span className={s.kpiSub}>Listos para salida</span>
            </div>
          )}
        </section>
      )}

      {/* Pendientes (Por hacer) */}
      {hasTodos && (
        <Surface title="Por hacer" headingLevel={2}>
          <ul className={s.todoList} data-testid="panel-todos">
            {currentAmbiguous.map((amb) => (
              <li key={amb.id} className={s.todoAmbiguous} role="alert" data-testid="ambiguous-todo">
                <div className={s.todoIcon}>
                  <Icon name="warning" />
                </div>
                <div className={s.todoContent}>
                  <h3 className={s.todoAmbiguousTitle}>{amb.title}</h3>
                  <p className={s.todoAmbiguousDetail}>{amb.detail}</p>
                </div>
              </li>
            ))}
            {unassignedCampaigns.map((c) => (
              <li key={c.campaignRef} className={s.todoRegular} data-testid="unassigned-campaign-todo">
                <div className={s.todoContent}>
                  <Icon name="info" />
                  <div>
                    <h3 className={s.todoTitle}>Asignar responsable a «{c.title}»</h3>
                    <p className={s.todoDetail}>La convocatoria no tiene empleado asignado.</p>
                  </div>
                </div>
                <Link href="/panel/campaigns" className={[ui.button, ui.secondary].join(' ')}>
                  Asignar
                </Link>
              </li>
            ))}
            {availableFunds.map((f) => (
              <li key={f.fundId} className={s.todoRegular} data-testid="available-fund-todo">
                <div className={s.todoContent}>
                  <Icon name="info" />
                  <div>
                    <h3 className={s.todoTitle}>Registrar aplicación de fondos</h3>
                    <p className={s.todoDetail}>
                      {f.campaignRef ? `Convocatoria «${f.campaignRef}» · ` : ''}
                      {formatMinorUnits(f.availableAmount, f.currency)} por aplicar
                    </p>
                  </div>
                </div>
                <Link href="/panel/funds" className={[ui.button, ui.secondary].join(' ')}>
                  Ver fondos
                </Link>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      {/* Tabla de convocatorias (solo ADMINISTRATOR) */}
      {canFetchCampaigns && (
        <Surface title="Convocatorias" headingLevel={2}>
          {campaignsRead.state.status === 'loading' && <LoadingState />}
          {campaigns && campaigns.length === 0 && (
            <p className={s.emptyText}>Tu organización todavía no tiene convocatorias.</p>
          )}
          {campaigns && campaigns.length > 0 && (
            <div className={ui.tableWrap}>
              <table className={ui.table} data-testid="panel-campaigns-table">
                <thead>
                  <tr>
                    <th scope="col">Convocatoria</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Recaudado</th>
                    <th scope="col">Meta</th>
                    <th scope="col">Cierre</th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const closing = isClosingSoon(c, now);
                    const pct = c.targetAmount && c.clearedAmount ? percentOf(c.clearedAmount, c.targetAmount) : null;
                    return (
                      <tr key={c.campaignRef} data-testid="panel-campaign-row">
                        <td>
                          <strong>{c.title}</strong>
                          {closing && (
                            <div style={{ marginTop: 4 }}>
                              <span className={s.closingSoon} data-testid="closing-soon-badge">
                                <Icon name="warning" /> Cierra pronto
                              </span>
                            </div>
                          )}
                        </td>
                        <td>{campaignStatusLabel(c.status)}</td>
                        <td>
                          {pct !== null && (
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                              <span className={s.progressBar} aria-hidden="true">
                                <span className={s.progressFill} style={{ width: `${Math.min(pct, 100)}%` }} />
                              </span>
                              <span className={ui.mono}>{pct}%</span>
                            </div>
                          )}
                          <small className={ui.mono} style={{ color: 'var(--color-text-secondary)' }}>
                            {c.clearedAmount ? formatMinorUnits(c.clearedAmount, c.currency) : '—'}
                          </small>
                        </td>
                        <td className={ui.mono}>{c.targetAmount ? formatMinorUnits(c.targetAmount, c.currency) : '—'}</td>
                        <td>{c.endDate ? <LocalDate iso={c.endDate} /> : '—'}</td>
                        <td>
                          <Link href="/panel/campaigns" className={[ui.button, ui.secondary].join(' ')} style={{ minHeight: 36, padding: '0 12px' }}>
                            Ver
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      )}

      {/* Tabla de lotes (ADMINISTRATOR o EMPLOYEE) */}
      {canFetchAssets && (
        <Surface title="Lotes" headingLevel={2}>
          {assetsRead.state.status === 'loading' && <LoadingState />}
          {assets && assets.length === 0 && (
            <p className={s.emptyText}>Tu organización todavía no tiene activos registrados.</p>
          )}
          {assets && assets.length > 0 && (
            <div className={ui.tableWrap}>
              <table className={ui.table} data-testid="panel-assets-table">
                <thead>
                  <tr>
                    <th scope="col">Lote</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Ubicación</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => {
                    const location = a.lifecycleStatus === 'DISPATCHED' ? '—' : (a.currentLocation ?? '—');
                    return (
                      <tr key={a.assetRef} data-testid="panel-asset-row">
                        <td className={ui.mono}>
                          {isSurfaceEnabled('/assets/:assetRef') ? (
                            <Link href={`/assets/${encodeURIComponent(a.assetRef)}`}>{a.assetRef}</Link>
                          ) : (
                            a.assetRef
                          )}
                        </td>
                        <td data-testid="asset-type">{a.assetType ?? '—'}</td>
                        <td className={ui.mono}>
                          {a.quantity ? formatQuantity(a.quantity) : '—'} {a.unitOfMeasure ?? ''}
                        </td>
                        <td>{lifecycleLabel(a.lifecycleStatus)}</td>
                        <td data-testid="asset-location">{location}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      )}

      {/* Formulario de registro de activo para EMPLOYEE */}
      {register && registering && (
        <Surface title="Registrar activo">
          <RegisterAssetForm
            onCancel={() => setRegistering(false)}
            organizationId={orgId}
            onRegistered={(assetRef) => router.push(`/assets/${encodeURIComponent(assetRef)}`)}
          />
        </Surface>
      )}

      {/* Secciones del panel (accesos directos) */}
      <Surface title="Secciones del panel" headingLevel={2}>
        <Entries entries={entries} />
      </Surface>
    </div>
  );
}
