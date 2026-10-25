'use client';

// Ref: Documentos/plan-fase7-fidelidad.md §5 F-B1 (D-F12, D-F13);
// Documentos/prompts-agentes-estilo-v2.md §3.2, §6 VS-6;
// Documentos/sistema-visual-paxfide-web-enmienda-1.md §3.1, §4–§7;
// Documentos/paxfide-panel.html (boceto vPanel('org')).

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Surface, Actions, uiClasses as ui } from '../components/ui/Layout';
import { EmptyState, ErrorState, LoadingState, UnavailableState } from '../components/States';
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
  roleLabel,
  verificationStatusLabel,
} from '../lib/labels';
import { formatMinorUnits } from '../lib/money';
import s from './panel.module.css';

export type PanelIconName =
  | 'home'
  | 'explore'
  | 'heart'
  | 'route'
  | 'org'
  | 'campaign'
  | 'box'
  | 'user'
  | 'lock'
  | 'x'
  | 'info'
  | 'warning'
  | 'plus'
  | 'truck'
  | 'qr';

export function PanelIcon({ name, className }: { name: PanelIconName; className?: string }) {
  const content = (() => {
    switch (name) {
      case 'home':
        return <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />;
      case 'explore':
        return (
          <>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </>
        );
      case 'heart':
        return <path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" />;
      case 'route':
        return (
          <>
            <circle cx="6" cy="18" r="2" />
            <circle cx="18" cy="6" r="2" />
            <path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" />
          </>
        );
      case 'org':
        return <path d="M4 21V9l8-5 8 5v12M9 21v-5h6v5M3 21h18" />;
      case 'campaign':
        return (
          <>
            <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z" />
            <path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />
          </>
        );
      case 'box':
        return (
          <>
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
            <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
          </>
        );
      case 'user':
        return (
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </>
        );
      case 'lock':
        return (
          <>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </>
        );
      case 'x':
        return <path d="M6 6l12 12M18 6L6 18" />;
      case 'info':
        return (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8v.01" />
          </>
        );
      case 'warning':
        return (
          <>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </>
        );
      case 'plus':
        return <path d="M12 5v14M5 12h14" />;
      case 'truck':
        return (
          <>
            <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
            <circle cx="7" cy="17.5" r="1.8" />
            <circle cx="17" cy="17.5" r="1.8" />
          </>
        );
      case 'qr':
        return (
          <>
            <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
          </>
        );
      default: {
        const _exhaustiveCheck: never = name;
        return _exhaustiveCheck;
      }
    }
  })();

  return (
    <svg
      className={className ?? s.icoSvg}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}

/**
 * Emblema isométrico estático de cada distrito (el eco de la ciudad dentro del panel, de paxfide-panel.html).
 */
export function IsometricEmblem({ district = 'org' }: { district?: 'org' | 'campaigns' | 'assets' }) {
  const e = {
    org: {
      topClass: s.embOrgTop,
      lClass: s.embOrgLeft,
      rClass: s.embOrgRight,
      roofClass: s.embOrgRoof,
      extra: (
        <>
          <path d="M70 8v28" className={s.embFlagPole} />
          <path d="M70 8l-9-4M70 8l9-4M70 8v9" className={s.embFlag} />
          <circle cx="70" cy="8" r="2.5" className={s.embDot} />
        </>
      ),
    },
    campaigns: {
      topClass: s.embCampTop,
      lClass: s.embCampLeft,
      rClass: s.embCampRight,
      roofClass: s.embCampRoof,
      extra: <circle cx="68" cy="44" r="4" className={s.embDot} />,
    },
    assets: {
      topClass: s.embAssetTop,
      lClass: s.embAssetLeft,
      rClass: s.embAssetRight,
      roofClass: s.embAssetRoof,
      extra: (
        <>
          <path d="M64 30l8 4-8 4-8-4z" className={s.embBoxTop} />
          <path d="M56 34l8 4v8l-8-4z" className={s.embBoxLeft} />
          <path d="M72 34l-8 4v8l8-4z" className={s.embBoxRight} />
        </>
      ),
    },
  }[district];

  return (
    <svg className={s.emb} viewBox="0 0 96 78" aria-hidden="true">
      <path d="M48 46l40 20-40 12L8 66z" className={s.embBase} />
      <path d="M48 14l30 15-30 15-30-15z" className={e.topClass} />
      <path d="M18 29l30 15v22L18 51z" className={e.lClass} />
      <path d="M78 29L48 44v22l30-15z" className={e.rClass} />
      <path d="M48 10l18 9-18 9-18-9z" className={e.roofClass} />
      <g className={s.embWindow}>
        <path d="M23 40l5 2.5v5l-5-2.5zM31 44l5 2.5v5l-5-2.5zM39 48l5 2.5v5l-5-2.5z" />
      </g>
      {e.extra}
    </svg>
  );
}

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
  if ((roles.includes('EMPLOYEE') || roles.includes('ADMINISTRATOR')) && isSurfaceEnabled('/panel/my-campaigns')) {
    entries.push({ id: 'my-campaigns', label: 'Mis convocatorias', href: '/panel/my-campaigns' });
  }
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

  if (state.status === 'loading' || (canFetchOrg && orgRead.state.status === 'loading')) {
    return (
      <div data-testid="panel-content" className={s.container}>
        <LoadingState />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div data-testid="panel-content" className={s.container}>
        <ErrorState onRetry={reload} />
      </div>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <div data-testid="panel-content" className={s.container}>
        <header className={s.pnHead}>
          <div className={s.headLeft}>
            <IsometricEmblem district="org" />
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
      <div data-testid="panel-content" className={s.container}>
        <header className={s.pnHead} data-testid="panel-header">
          <div className={s.headLeft}>
            <IsometricEmblem district="org" />
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

  // Urgencia de Por hacer: 1) ambiguos, 2) fondos por aplicar, 3) convocatorias sin empleado
  const hasTodos = currentAmbiguous.length > 0 || availableFunds.length > 0 || unassignedCampaigns.length > 0;

  // KPIs (máximo 3, Integridad se omite según X-13)
  const openCampaignsCount = isAdmin && campaigns ? campaigns.filter((c) => c.status === 'OPEN').length : null;
  const clearedTotals = (isAdmin || isEmployee) && funds ? computeTotalClearedByCurrency(funds) : null;
  const assetsToDispatchCount = (isAdmin || isEmployee) && assets ? countDispatcheableAssets(assets) : null;
  const hasKpis = openCampaignsCount !== null || clearedTotals !== null || assetsToDispatchCount !== null;

  const roleText = roles.map(roleLabel).join(', ') || 'Organización';
  const orgName = canFetchOrg && orgDetails?.name ? orgDetails.name : 'Tu organización';
  const verifStatusText = orgDetails?.verificationStatus === 'VERIFIED'
    ? 'Organización verificada'
    : orgDetails?.verificationStatus
    ? `Organización (${verificationStatusLabel(orgDetails.verificationStatus)})`
    : 'Organización';
  const subtitle = canFetchOrg ? `${verifStatusText} · Tu rol: ${roleText}` : `Organización · Tu rol: ${roleText}`;

  return (
    <div data-testid="panel-content" className={s.container}>
      {/* Cabecera del panel: Emblema isométrico, logo/inicial si el rol lo autoriza, nombre y rol */}
      <header className={s.pnHead} data-testid="panel-header">
        <div className={s.headLeft}>
          <IsometricEmblem district="org" />
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
              {orgName}
            </h1>
            <p className={s.headSub}>
              {subtitle}
            </p>
          </div>
        </div>
        <div className={s.acts}>
          {isAdmin && isSurfaceEnabled('/panel/campaigns') && (
            <Link href="/panel/campaigns" className={s.pnBtnPrimary} data-testid="new-campaign-button">
              <PanelIcon name="plus" /> Nueva convocatoria
            </Link>
          )}
          {register && !registering && (
            <button
              type="button"
              className={s.pnBtnPrimary}
              onClick={() => setRegistering(true)}
              data-testid="register-asset-button"
            >
              <PanelIcon name="plus" /> Registrar activo
            </button>
          )}
        </div>
      </header>

      {/* Si no tiene organización */}
      {!orgId && (
        <Surface title="¿Tienes una fundación?">
          <p>Regístrala, la revisamos y luego puedes publicar convocatorias.</p>
          <Actions>
            <Link href="/panel/organization" className={[ui.button, ui.secondary].join(' ')}>
              Crear organización
            </Link>
          </Actions>
        </Surface>
      )}

      {/* Si es autoridad de plataforma */}
      {principal?.platformAuthority && isSurfaceEnabled('/panel/platform') && (
        <Surface title="Plataforma">
          <p>Verificación de organizaciones y administradores de la plataforma.</p>
          <Actions>
            <Link href="/panel/platform" className={[ui.button, ui.secondary].join(' ')}>
              Plataforma: verificación y administradores
            </Link>
          </Actions>
        </Surface>
      )}

      {/* KPIs según rol (X-13) */}
      {hasKpis && (
        <section aria-label="Indicadores clave" className={s.pnGrid} data-testid="panel-kpis">
          {openCampaignsCount !== null && (
            <div className={`${s.pnCard} ${s.kpi}`} data-testid="kpi-open-campaigns">
              <span className={`${s.ico} ${s.kpiOpenIco}`}>
                <PanelIcon name="campaign" />
              </span>
              <span className={s.kpiLabel}>Convocatorias abiertas</span>
              <b className={s.kpiValue}>{openCampaignsCount}</b>
              <small className={s.kpiSub}>Convocatorias activas</small>
            </div>
          )}
          {clearedTotals !== null && (
            <div className={`${s.pnCard} ${s.kpi}`} data-testid="kpi-cleared-amount">
              <span className={`${s.ico} ${s.kpiClearedIco}`}>
                <PanelIcon name="heart" />
              </span>
              <span className={s.kpiLabel}>Recaudado total</span>
              <b className={s.kpiValue}>
                {clearedTotals.map((t) => t.formatted).join(' · ')}
              </b>
              <small className={s.kpiSub}>Confirmado en fondos</small>
            </div>
          )}
          {assetsToDispatchCount !== null && (
            <div className={`${s.pnCard} ${s.kpi}`} data-testid="kpi-assets-dispatch">
              <span className={`${s.ico} ${s.kpiAssetsIco}`}>
                <PanelIcon name="box" />
              </span>
              <span className={s.kpiLabel}>Lotes por despachar</span>
              <b className={s.kpiValue}>{assetsToDispatchCount}</b>
              <small className={s.kpiSub}>Listos para salida</small>
            </div>
          )}
        </section>
      )}

      {/* Por hacer (ordenado por urgencia: 1. ambiguos, 2. fondos por aplicar, 3. convocatorias sin empleado) */}
      <section className={`${s.pnCard} ${s.cFull}`} aria-label="Tareas pendientes" data-testid="panel-todos-section">
        <div className={s.sectionHeader}>
          <h2 className={s.sectionTitle}>
            <PanelIcon name="info" /> Por hacer
          </h2>
        </div>
        <p className={s.subText}>Ordenado por urgencia.</p>
        {hasTodos ? (
          <ul className={s.todoList} data-testid="panel-todos">
            {currentAmbiguous.map((amb) => (
              <li key={amb.id} className={`${s.todoItem} ${s.todoAmbiguous}`} role="alert" data-testid="ambiguous-todo">
                <div className={`${s.ti} ${s.stAmb}`}>
                  <PanelIcon name="truck" />
                </div>
                <div className={s.tt}>
                  <b className={s.ttTitle}>{amb.title}</b>
                  <small className={s.ttSub}>{amb.detail}</small>
                </div>
                <Link href="/panel/assets" className={s.pnBtnSecondary}>
                  Revisar
                </Link>
              </li>
            ))}
            {availableFunds.map((f) => (
              <li key={f.fundId} className={s.todoItem} data-testid="available-fund-todo">
                <div className={`${s.ti} ${s.stWait}`}>
                  <PanelIcon name="box" />
                </div>
                <div className={s.tt}>
                  <b className={s.ttTitle}>Registrar aplicación de fondos</b>
                  <small className={s.ttSub}>
                    {f.campaignRef ? `Convocatoria «${f.campaignRef}» · ` : ''}
                    {formatMinorUnits(f.availableAmount, f.currency)} por aplicar
                  </small>
                </div>
                <Link href="/panel/funds" className={s.pnBtnSecondary}>
                  Registrar
                </Link>
              </li>
            ))}
            {unassignedCampaigns.map((c) => (
              <li key={c.campaignRef} className={s.todoItem} data-testid="unassigned-campaign-todo">
                <div className={`${s.ti} ${s.stInfo}`}>
                  <PanelIcon name="org" />
                </div>
                <div className={s.tt}>
                  <b className={s.ttTitle}>Asignar responsable a «{c.title}»</b>
                  <small className={s.ttSub}>La convocatoria no tiene empleado asignado.</small>
                </div>
                <Link href="/panel/campaigns" className={s.pnBtnSecondary}>
                  Asignar
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.emptyTodo} data-testid="empty-todos">
            No tienes tareas pendientes.
          </p>
        )}
      </section>

      {/* Formulario de registro de activo para EMPLOYEE si se activa */}
      {register && registering && (
        <Surface title="Registrar activo">
          <RegisterAssetForm
            onCancel={() => setRegistering(false)}
            organizationId={orgId}
            onRegistered={(assetRef) => router.push(`/assets/${encodeURIComponent(assetRef)}`)}
          />
        </Surface>
      )}
    </div>
  );
}
