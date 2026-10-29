'use client';
// Ref: plan-fase7-fidelidad.md F-A4 (D-F12), plan-fase7-pantallas.md A-3, D-P6, D-P7 y D-P11; DF7-21;
// prompts-agentes-estilo-v2.md VS-5 y §3.2; referencia-api-v1.md §1, §3 y §5.
// Contrato visual: paxfide-home.html (vHome). Desviación X-18 (QR sin lector: tarjeta rápida sin enlace).
// plan-fase7-puesta-al-dia.md P-1 (X-8): con `givenName` de `GET /account/profile`, saludo con el nombre e iniciales;
// sin él, D-P7 y el aviso "Completa tu perfil" (azul informativo: el amarillo queda para lo ambiguo, D6).
// plan-fase7-puesta-al-dia.md P-7 (U-14): tarjeta "Mi impacto"; P-8 (U-15, U-16): la bienvenida grande.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchMe, type Principal } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { fetchAccountDonations, fetchImpact, fetchProfile, initialsOf, updateProfile, type AccountDonation, type PersonalProfile } from '../lib/api/account';
import { fetchDiscovery, type DiscoveryItem } from '../lib/api/publicCampaigns';
import { fetchOrganizationCampaigns, type AdminCampaign } from '../lib/api/campaignAdmin';
import { fetchOrganizationAssets, type OrgAsset } from '../lib/api/organization';
import { useRead } from '../lib/api/useRead';
import { formatMinorUnits } from '../lib/money';
import { intentStatusLabel, paymentMethodLabel } from '../lib/labels';
import { handOffTrackingCode } from '../lib/tracking/handoff';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { CampaignCard } from '../components/campaign/CampaignCard';
import { ImpactCard } from '../components/impact/ImpactCard';
import { WelcomeOverlay, type WelcomeClose } from '../components/welcome/WelcomeOverlay';
import { markShownThisSession, markWelcomeDone, shouldShowWelcome } from '../lib/welcome/welcome';
import { navEntriesFor } from '../lib/nav/navEntries';
import { LocalDate } from '../components/LocalDate';
import { TextField } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from '../components/States';
import s from './home.module.css';

/** Cuántas donaciones y convocatorias muestra cada tarjeta; el resto, en su pantalla. */
export const HOME_ITEMS = 3;

/** Saludo por la hora del dispositivo, sin nombre (D-P7). En el servidor, "Hola" (no hay hora local). */
export function greetingFor(hour: number): string {
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function useProfile(client: typeof fetchProfile): { profile: PersonalProfile | null; loaded: boolean } {
  const [state, setState] = useState<{ profile: PersonalProfile | null; loaded: boolean }>({ profile: null, loaded: false });
  useEffect(() => {
    let alive = true;
    void client().catch(() => null).then((r) => {
      if (alive) setState({ profile: r?.kind === 'ok' ? r.profile : null, loaded: r?.kind === 'ok' });
    });
    return () => { alive = false; };
  }, [client]);
  return state;
}

function useGreeting(): string {
  const [text, setText] = useState('Hola');
  useEffect(() => { setText(greetingFor(new Date().getHours())); }, []);
  return text;
}

export interface HomeCard { id: 'organization' | 'create-organization' | 'platform'; title: string; text: string; action: string; href: string }

/**
 * Tarjetas que dependen de la cuenta (D-P6). Representación, no autorización (ADR-046 D5): cada destino resuelve su
 * propio 403. Sin `/me` leído no se infiere nada y no se muestra ninguna (DW-06).
 */
export function accountCards(principal: Principal | null): HomeCard[] {
  if (!principal) return [];
  const cards: HomeCard[] = [];
  if (principal.organizationId) {
    if (isSurfaceEnabled('/panel')) {
      cards.push({ id: 'organization', title: 'Tu organización hoy', text: 'Convocatorias, lotes y personas de tu organización.', action: 'Ir a tu organización', href: '/panel' });
    }
  } else if (isSurfaceEnabled('/panel/organization')) {
    cards.push({ id: 'create-organization', title: '¿Tienes una fundación?', text: 'Regístrala, la revisamos y luego puedes publicar convocatorias.', action: 'Registrar organización', href: '/panel/organization' });
  }
  // DF7-21: la cuenta de plataforma no tiene entrada en la barra; llega desde aquí
  if (principal.platformAuthority && isSurfaceEnabled('/panel/platform')) {
    cards.push({ id: 'platform', title: 'Plataforma', text: 'Verificación de organizaciones y administradores de la plataforma.', action: 'Ir a la plataforma', href: '/panel/platform' });
  }
  return cards;
}

/**
 * D-F12 / D-P9: Convocatoria abierta que cierra en 7 días o menos a partir de `now`.
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

function Icon({ d }: { d: string }) {
  return (
    <svg className={s.icon} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={d} /></svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

const ICON = {
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  campaign: 'M4 10v4h3l6 4V6L7 10H4zM16.5 9a4 4 0 0 1 0 6',
  org: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  shield: 'M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0',
};

/** Árbol de huellas que se juntan en una sola raíz (ilustración estática del prototipo, sin texto). */
function SealTree() {
  return (
    <svg className={s.tree} viewBox="0 0 260 110" aria-hidden="true" focusable="false">
      <g stroke="var(--brand-blue-700)" strokeWidth="2.4" fill="none">
        <path d="M40 92 L80 60 M100 92 L80 60 M160 92 L180 60 M220 92 L180 60 M80 60 L130 26 M180 60 L130 26" />
      </g>
      {[40, 100, 160, 220].map((x) => <rect key={x} x={x - 11} y="84" width="22" height="18" rx="4" fill="var(--brand-blue-700)" />)}
      <rect x="69" y="50" width="22" height="20" rx="5" fill="var(--brand-blue-800)" />
      <rect x="169" y="50" width="22" height="20" rx="5" fill="var(--brand-blue-800)" />
      <rect x="116" y="12" width="28" height="26" rx="6" fill="var(--brand-yellow-400)" />
    </svg>
  );
}

function TrackCard({ cardIndex }: { cardIndex?: number }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = code.trim();
    if (!value) { setError('Este campo es obligatorio.'); return; }
    // El código viaja en memoria hasta /tracking (DW-16): nunca en la URL ni en el almacenamiento del navegador
    handOffTrackingCode(value);
    setCode('');
    router.push('/tracking');
  };
  return (
    <section
      className={`${s.card} ${s.hero}`}
      aria-labelledby="home-track"
      style={{ '--card-index': cardIndex } as React.CSSProperties}
    >
      <h2 id="home-track" className={s.cardTitle}><Icon d={ICON.route} />Seguir una donación</h2>
      <p className={s.sub}>Escribe el código que recibiste al donar.</p>
      <form className={s.track} onSubmit={submit} noValidate>
        <TextField
          label="Código de seguimiento"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(undefined); }}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          error={error}
        />
        <Button type="submit" variant="emphasis">Ver ruta</Button>
      </form>
      <p className={s.note}><Icon d={ICON.lock} />El código es la llave de la donación: no lo publiques.</p>
    </section>
  );
}

function SealCard({ cardIndex }: { cardIndex?: number }) {
  return (
    <section
      className={s.card}
      aria-labelledby="home-seal"
      style={{ '--card-index': cardIndex } as React.CSSProperties}
    >
      <h2 id="home-seal" className={s.cardTitle}><Icon d={ICON.lock} />Sellado en blockchain</h2>
      <div className={s.seal}>
        <SealTree />
        <p className={s.text}>Cada paso deja una huella. Las huellas se juntan en una sola y esa se ancla, para que nadie cambie la historia sin que se note.</p>
      </div>
    </section>
  );
}

function OrgTodayCard({
  principal,
  campaignsClient = fetchOrganizationCampaigns,
  assetsClient = fetchOrganizationAssets,
  cardIndex,
}: {
  principal: Principal;
  campaignsClient?: typeof fetchOrganizationCampaigns;
  assetsClient?: typeof fetchOrganizationAssets;
  cardIndex?: number;
}) {
  const orgId = principal.organizationId!;
  const roles = principal.roles ?? [];
  const isAdmin = roles.includes('ADMINISTRATOR');
  const isEmployee = roles.includes('EMPLOYEE');

  const [campaignsCount, setCampaignsCount] = useState<number | null>(null);
  const [dispatcheableCount, setDispatcheableCount] = useState<number | null>(null);
  const [inTransitCount, setInTransitCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(isAdmin || isEmployee);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!orgId || (!isAdmin && !isEmployee)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);

    const promises: Promise<unknown>[] = [];

    if (isAdmin) {
      promises.push(
        campaignsClient(orgId).then((r) => {
          if (cancelled) return;
          if (r.kind === 'ok') {
            const open = r.items.filter((c) => c.status === 'OPEN').length;
            setCampaignsCount(open);
          } else if (r.kind === 'error') {
            setError(true);
          }
        }).catch(() => { if (!cancelled) setError(true); })
      );
    }

    if (isAdmin || isEmployee) {
      promises.push(
        assetsClient(orgId).then((r) => {
          if (cancelled) return;
          if (r.kind === 'ok') {
            const dispatcheable = r.items.filter((a) => a.lifecycleStatus === 'REGISTERED' || a.lifecycleStatus === 'RECEIVED').length;
            const inTransit = r.items.filter((a) => a.lifecycleStatus === 'DISPATCHED').length;
            setDispatcheableCount(dispatcheable);
            setInTransitCount(inTransit);
          } else if (r.kind === 'error') {
            setError(true);
          }
        }).catch(() => { if (!cancelled) setError(true); })
      );
    }

    Promise.allSettled(promises).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [orgId, isAdmin, isEmployee, campaignsClient, assetsClient]);

  return (
    <section
      className={`${s.card} ${s.full}`}
      aria-labelledby="home-organization"
      data-testid="home-card-organization"
      style={{ '--card-index': cardIndex } as React.CSSProperties}
    >
      <div className={s.cardHead}>
        <h2 id="home-organization" className={s.cardTitle}>
          <Icon d={ICON.org} />Tu organización hoy
        </h2>
        {isSurfaceEnabled('/panel') && (
          <Link className={s.linkAction} href="/panel">
            Ir a tu organización
          </Link>
        )}
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState onRetry={() => {
        setCampaignsCount(null);
        setDispatcheableCount(null);
        setInTransitCount(null);
        setLoading(true);
      }} />}

      {!loading && !error && (
        <>
          {(isAdmin || isEmployee) && (
            <div className={s.stats}>
              {isAdmin && (
                <div className={s.stat}>
                  <b className={s.statNumber}>{campaignsCount ?? 0}</b>
                  <span className={s.statLabel}>convocatorias abiertas</span>
                </div>
              )}
              <div className={s.stat}>
                <b className={s.statNumber}>{dispatcheableCount ?? 0}</b>
                <span className={s.statLabel}>lotes por despachar</span>
              </div>
              <div className={s.stat}>
                <b className={s.statNumber}>{inTransitCount ?? 0}</b>
                <span className={s.statLabel}>lotes en camino</span>
              </div>
            </div>
          )}

          {(isAdmin || isEmployee) && (
            <div className={s.qa}>
              {isAdmin && isSurfaceEnabled('/panel/campaigns') && (
                <Link className={s.qaItem} href="/panel/campaigns">
                  <span className={`${s.qi} ${s.qiCampaign}`} aria-hidden="true"><PlusIcon /></span>
                  <span>Nueva convocatoria</span>
                  <small>Publica una necesidad</small>
                </Link>
              )}
              {isSurfaceEnabled('/panel/assets') && (
                <Link className={s.qaItem} href="/panel/assets">
                  <span className={`${s.qi} ${s.qiAsset}`} aria-hidden="true"><BoxIcon /></span>
                  <span>Registrar lote</span>
                  <small>Con lo que se compró</small>
                </Link>
              )}
              <div className={`${s.qaItem} ${s.qaDisabled}`}>
                <span className={`${s.qi} ${s.qiQr}`} aria-hidden="true"><QrIcon /></span>
                <span>Despachar o recibir</span>
                <small>Escanea el QR en la app</small>
              </div>
            </div>
          )}

          {!isAdmin && !isEmployee && (
            <p className={s.text}>Convocatorias, lotes y personas de tu organización.</p>
          )}
        </>
      )}
    </section>
  );
}

function DonationRow({ d }: { d: AccountDonation }) {
  const meta = [d.organizationName, d.paymentMethod ? paymentMethodLabel(d.paymentMethod) : undefined].filter(Boolean).join(' · ');
  return (
    <li className={s.donation} data-testid="home-donation">
      <div className={s.donationMain}>
        <b className={s.donationTitle}>{d.campaignTitle ?? 'Convocatoria'}</b>
        <span className={s.meta}>
          {d.createdAt && <LocalDate iso={d.createdAt} />}{d.createdAt && meta ? ' · ' : ''}{meta}
        </span>
        <span className={s.status}>{intentStatusLabel(d.status)}</span>
      </div>
      <span className={s.amount}>{formatMinorUnits(d.amount, d.currency)}</span>
      {(d.trackingCode || d.publicCode) && (
        <div className={s.rowActions}>
          {d.trackingCode && isSurfaceEnabled('/tracking') && (
            <Link className={s.linkAction} href="/tracking" onClick={() => handOffTrackingCode(d.trackingCode as string)}>Ver recorrido</Link>
          )}
          {/* D-P11: enlace a la convocatoria solo si llega publicCode (nunca en una PRIVATE_LINK) */}
          {d.publicCode && isSurfaceEnabled('/c/:publicCode') && (
            <Link className={s.linkAction} href={`/c/${encodeURIComponent(d.publicCode)}`}>Ver convocatoria</Link>
          )}
        </div>
      )}
    </li>
  );
}

function DonationsCard({
  client,
  cardIndex,
}: {
  client: typeof fetchAccountDonations;
  cardIndex?: number;
}) {
  const { state, reload } = useRead<AccountDonation[], 'forbidden' | 'unauthorized' | 'error'>(async () => {
    const r = await client();
    return r.kind === 'ok' ? { status: 'ready', data: r.items } : { status: r.kind };
  }, []);
  return (
    <section
      className={`${s.card} ${s.wide}`}
      aria-labelledby="home-donations"
      data-testid="home-donations"
      style={{ '--card-index': cardIndex } as React.CSSProperties}
    >
      <div className={s.cardHead}>
        <h2 id="home-donations" className={s.cardTitle}><Icon d={ICON.heart} />Tus donaciones</h2>
        {isSurfaceEnabled('/account/donations') && <Link className={s.linkAction} href="/account/donations">Ver todas</Link>}
      </div>
      <p className={s.sub}>Solo tú y la organización las ven.</p>
      {state.status === 'loading' && <LoadingState />}
      {(state.status === 'error' || state.status === 'unauthorized') && <ErrorState onRetry={reload} />}
      {state.status === 'forbidden' && <ForbiddenState />}
      {state.status === 'ready' && state.data.length === 0 && <EmptyState text="Todavía no tienes donaciones hechas con esta cuenta." />}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className={s.donations}>{state.data.slice(0, HOME_ITEMS).map((d) => <DonationRow key={d.intentId} d={d} />)}</ul>
      )}
    </section>
  );
}

function CampaignsCard({
  client,
  now = Date.now(),
  cardIndex,
}: {
  client: typeof fetchDiscovery;
  now?: number;
  cardIndex?: number;
}) {
  const { state, reload } = useRead<DiscoveryItem[], 'error'>(async () => {
    const r = await client();
    return r.kind === 'ok' ? { status: 'ready', data: r.items } : { status: 'error' };
  }, []);

  const items = state.status === 'ready' ? state.data : [];
  const closingSoon = items
    .filter((c) => isClosingSoon(c, now))
    .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime());
  const hasClosingSoon = closingSoon.length > 0;
  const title = hasClosingSoon ? 'Cierran pronto' : 'Convocatorias abiertas';
  const displayed = hasClosingSoon ? closingSoon.slice(0, HOME_ITEMS) : items.slice(0, HOME_ITEMS);

  return (
    <section
      className={`${s.card} ${s.full}`}
      aria-labelledby="home-campaigns"
      data-testid="home-campaigns"
      style={{ '--card-index': cardIndex } as React.CSSProperties}
    >
      <div className={s.cardHead}>
        <h2 id="home-campaigns" className={s.cardTitle}><Icon d={ICON.campaign} />{title}</h2>
        {isSurfaceEnabled('/campaigns') && <Link className={s.linkAction} href="/campaigns">Ver todas</Link>}
      </div>
      <p className={s.sub}>Convocatorias que todavía puedes apoyar.</p>
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'ready' && displayed.length === 0 && (
        <EmptyState text={hasClosingSoon ? 'No hay convocatorias próximas a cerrar.' : 'No hay convocatorias abiertas en este momento.'} />
      )}
      {state.status === 'ready' && displayed.length > 0 && (
        <ul className={s.campaigns}>{displayed.map((c) => <li key={c.publicCode}><CampaignCard campaign={c} /></li>)}</ul>
      )}
    </section>
  );
}

export interface HomeScreenProps {
  meClient?: typeof fetchMe;
  donationsClient?: typeof fetchAccountDonations;
  campaignsClient?: typeof fetchDiscovery;
  orgCampaignsClient?: typeof fetchOrganizationCampaigns;
  orgAssetsClient?: typeof fetchOrganizationAssets;
  profileClient?: typeof fetchProfile;
  impactClient?: typeof fetchImpact;
  updateProfileClient?: typeof updateProfile;
  now?: number;
}

export function HomeScreen({
  meClient = fetchMe,
  donationsClient = fetchAccountDonations,
  campaignsClient = fetchDiscovery,
  orgCampaignsClient = fetchOrganizationCampaigns,
  orgAssetsClient = fetchOrganizationAssets,
  profileClient = fetchProfile,
  impactClient = fetchImpact,
  updateProfileClient = updateProfile,
  now,
}: HomeScreenProps) {
  const greeting = useGreeting();
  const read = useProfile(profileClient);
  const [savedProfile, setSavedProfile] = useState<PersonalProfile | null>(null);
  const profile = savedProfile ?? read.profile;
  const loaded = read.loaded;
  const [nudgeHidden, setNudgeHidden] = useState(false);
  const initials = initialsOf(profile);
  const { state } = usePrincipal(meClient);
  const principal = state.status === 'ready' ? state.data : null;
  const cards = accountCards(principal);
  const accountCardsList = cards.filter((c) => c.id !== 'organization');
  const isMember = !!principal?.organizationId;

  // P-8 (U-16): la bienvenida sale en /home si la cuenta no tiene nombre y en este navegador no se cerró para esa cuenta
  const accountId = principal?.accountId;
  const [welcome, setWelcome] = useState(false);
  const greetingRef = React.useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!loaded || !accountId) return;
    if (shouldShowWelcome({ accountId, profile: read.profile })) {
      markShownThisSession(accountId);
      setWelcome(true);
    }
  }, [loaded, accountId, read.profile]);
  const closeWelcome = (how: WelcomeClose, saved?: PersonalProfile) => {
    if (accountId) markWelcomeDone(accountId);
    if (how === 'saved' && saved) setSavedProfile(saved);
    setWelcome(false);
    // El foco vuelve al inicio
    setTimeout(() => greetingRef.current?.focus(), 0);
  };

  let cardIdx = 0;

  return (
    <>
    {welcome && principal && (
      <WelcomeOverlay
        entries={navEntriesFor({ authenticated: true, principal }, isSurfaceEnabled, 'side')}
        email={profile?.email}
        update={updateProfileClient}
        onClose={closeWelcome}
      />
    )}
    <div className={s.home} data-testid="home-content" inert={welcome ? true : undefined}>
      <header className={s.head}>
        <span className={s.avatar} aria-hidden="true" data-testid="home-avatar">
          {initials ?? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </svg>
          )}
        </span>
        <div>
          <h1 ref={greetingRef} tabIndex={-1} className={s.title} data-testid="home-greeting">{profile?.givenName ? `${greeting}, ${profile.givenName}` : greeting}</h1>
          <p className={s.sub}>Qué bueno verte por aquí.</p>
        </div>
      </header>
      {loaded && !profile?.givenName && !nudgeHidden && isSurfaceEnabled('/account') && (
        <div className={s.nudge} role="status" data-testid="profile-nudge">
          <Icon d={ICON.user} />
          <div className={s.nudgeText}>
            <b>Completa tu perfil</b>
            <span>Agrega tu nombre para que te saludemos como se debe.</span>
          </div>
          <Link className={s.nudgeCta} href="/account">Agregar</Link>
          <button type="button" className={s.nudgeClose} aria-label="Ocultar aviso" onClick={() => setNudgeHidden(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
      <div className={s.grid} data-testid="home-grid">
        {isSurfaceEnabled('/tracking') && <TrackCard cardIndex={cardIdx++} />}
        <SealCard cardIndex={cardIdx++} />
        {isMember && isSurfaceEnabled('/panel') && principal && (
          <OrgTodayCard
            principal={principal}
            campaignsClient={orgCampaignsClient}
            assetsClient={orgAssetsClient}
            cardIndex={cardIdx++}
          />
        )}
        <CampaignsCard client={campaignsClient} now={now} cardIndex={cardIdx++} />
        <DonationsCard client={donationsClient} cardIndex={cardIdx++} />
        {/* P-7 (U-14): "Mi impacto", la misma tarjeta que en el Perfil */}
        <ImpactCard client={impactClient} cardIndex={cardIdx++} />
        {accountCardsList.map((c) => (
          <section
            key={c.id}
            className={s.card}
            aria-labelledby={`home-${c.id}`}
            data-testid={`home-card-${c.id}`}
            style={{ '--card-index': cardIdx++ } as React.CSSProperties}
          >
            <h2 id={`home-${c.id}`} className={s.cardTitle}><Icon d={c.id === 'platform' ? ICON.shield : ICON.org} />{c.title}</h2>
            <p className={s.text}>{c.text}</p>
            <Link className={s.cta} href={c.href}>{c.action}</Link>
          </section>
        ))}
      </div>
    </div>
    </>
  );
}
