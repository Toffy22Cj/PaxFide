'use client';
// Ref: plan-fase7-pantallas.md A-3, D-P6, D-P7 y D-P11; DF7-21 (acceso a la plataforma); prompts-agentes-estilo-v2.md
// VS-5 y §3.3; referencia-api-v1.md §1 (GET /me, GET /account/donations y su nota del 2026-10-22) y §5. Referencia
// visual: paxfide-home.html. Fuera: pantallas de entrada y términos, nombre y correo (GET /account/profile no está),
// selector de posición de la barra, ciudad navegable y los datos de ejemplo del prototipo.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchMe, type Principal } from '../lib/api/identity';
import { usePrincipal } from '../lib/auth/usePrincipal';
import { fetchAccountDonations, type AccountDonation } from '../lib/api/account';
import { fetchDiscovery, type DiscoveryItem } from '../lib/api/publicCampaigns';
import { useRead } from '../lib/api/useRead';
import { formatMinorUnits } from '../lib/money';
import { intentStatusLabel, paymentMethodLabel } from '../lib/labels';
import { handOffTrackingCode } from '../lib/tracking/handoff';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { CampaignCard } from '../components/campaign/CampaignCard';
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
      cards.push({ id: 'organization', title: 'Tu organización', text: 'Convocatorias, lotes y personas de tu organización.', action: 'Ir a tu organización', href: '/panel' });
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

function Icon({ d }: { d: string }) {
  return (
    <svg className={s.icon} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={d} /></svg>
  );
}
const ICON = {
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  campaign: 'M4 10v4h3l6 4V6L7 10H4zM16.5 9a4 4 0 0 1 0 6',
  org: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  shield: 'M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z',
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

function TrackCard() {
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
    <section className={`${s.card} ${s.hero}`} aria-labelledby="home-track">
      <h2 id="home-track" className={s.cardTitle}><Icon d={ICON.route} />Seguir una donación</h2>
      <p className={s.sub}>Escribe el código que recibiste al donar.</p>
      <form className={s.track} onSubmit={submit} noValidate>
        <TextField label="Código de seguimiento" value={code} onChange={(e) => { setCode(e.target.value); setError(undefined); }}
          autoComplete="off" spellCheck={false} autoCapitalize="off" error={error} />
        <Button type="submit">Ver recorrido</Button>
      </form>
      <p className={s.note}><Icon d={ICON.lock} />El código es la llave de la donación: no lo publiques.</p>
    </section>
  );
}

function SealCard() {
  return (
    <section className={s.card} aria-labelledby="home-seal">
      <h2 id="home-seal" className={s.cardTitle}><Icon d={ICON.lock} />Sellado en blockchain</h2>
      <SealTree />
      <p className={s.text}>Cada paso deja una huella. Las huellas se juntan en una sola y esa se ancla, para que nadie cambie la historia sin que se note.</p>
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

function DonationsCard({ client }: { client: typeof fetchAccountDonations }) {
  const { state, reload } = useRead<AccountDonation[], 'forbidden' | 'unauthorized' | 'error'>(async () => {
    const r = await client();
    return r.kind === 'ok' ? { status: 'ready', data: r.items } : { status: r.kind };
  }, []);
  return (
    <section className={`${s.card} ${s.wide}`} aria-labelledby="home-donations" data-testid="home-donations">
      <div className={s.cardHead}>
        <h2 id="home-donations" className={s.cardTitle}><Icon d={ICON.heart} />Tus donaciones</h2>
        {isSurfaceEnabled('/account/donations') && <Link className={s.linkAction} href="/account/donations">Ver todas</Link>}
      </div>
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

function CampaignsCard({ client }: { client: typeof fetchDiscovery }) {
  const { state, reload } = useRead<DiscoveryItem[], 'error'>(async () => {
    const r = await client();
    return r.kind === 'ok' ? { status: 'ready', data: r.items } : { status: 'error' };
  }, []);
  return (
    <section className={`${s.card} ${s.full}`} aria-labelledby="home-campaigns" data-testid="home-campaigns">
      <div className={s.cardHead}>
        {/* "Cierran pronto" necesita el orden de R-1, que no está en develop (D-P6): hasta entonces, "Convocatorias abiertas" */}
        <h2 id="home-campaigns" className={s.cardTitle}><Icon d={ICON.campaign} />Convocatorias abiertas</h2>
        {isSurfaceEnabled('/campaigns') && <Link className={s.linkAction} href="/campaigns">Ver todas</Link>}
      </div>
      <p className={s.sub}>Convocatorias que todavía puedes apoyar.</p>
      {state.status === 'loading' && <LoadingState />}
      {state.status === 'error' && <ErrorState onRetry={reload} />}
      {state.status === 'ready' && state.data.length === 0 && <EmptyState text="No hay convocatorias abiertas en este momento." />}
      {state.status === 'ready' && state.data.length > 0 && (
        <ul className={s.campaigns}>{state.data.slice(0, HOME_ITEMS).map((c) => <li key={c.publicCode}><CampaignCard campaign={c} /></li>)}</ul>
      )}
    </section>
  );
}

export function HomeScreen({
  meClient = fetchMe, donationsClient = fetchAccountDonations, campaignsClient = fetchDiscovery,
}: {
  meClient?: typeof fetchMe; donationsClient?: typeof fetchAccountDonations; campaignsClient?: typeof fetchDiscovery;
}) {
  const greeting = useGreeting();
  const { state } = usePrincipal(meClient);
  const cards = accountCards(state.status === 'ready' ? state.data : null);

  return (
    <div className={s.home} data-testid="home-content">
      <header className={s.head}>
        <span className={s.avatar} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
          </svg>
        </span>
        <div>
          <h1 className={s.title}>{greeting}</h1>
          <p className={s.sub}>Qué bueno verte por aquí.</p>
        </div>
      </header>
      <div className={s.grid}>
        {isSurfaceEnabled('/tracking') && <TrackCard />}
        <SealCard />
        <DonationsCard client={donationsClient} />
        {cards.map((c) => (
          <section key={c.id} className={s.card} aria-labelledby={`home-${c.id}`} data-testid={`home-card-${c.id}`}>
            <h2 id={`home-${c.id}`} className={s.cardTitle}><Icon d={c.id === 'platform' ? ICON.shield : ICON.org} />{c.title}</h2>
            <p className={s.text}>{c.text}</p>
            <Link className={s.cta} href={c.href}>{c.action}</Link>
          </section>
        ))}
        <CampaignsCard client={campaignsClient} />
      </div>
    </div>
  );
}
