'use client';
// Ref: plan-fase7-pantallas.md A-2 y D-P5; prompts-agentes-estilo-v2.md VS-4 y §3.3; referencia-api-v1.md §5
// (GET /public/campaigns). plan-fase7-fidelidad.md D-F1 (paxfide-landing.html es el contrato visual), D-F2 (Auto /
// Noche / Día; las superficies toman los tokens oscuros con data-theme="dark" cuando la noche pasa de 0,5) y F-A1.
// Desviaciones (§3 del plan): X-10 cifras, lugares y fechas de ejemplo; X-11 filtros por causa y búsqueda; X-12 el
// muestrario de variantes de tarjeta (y su conmutador Grilla / Móvil); X-15 huellas en el seguimiento de ejemplo.
// D-P13: en `/` la app no pone su cabecera ni su barra; esta cabecera (la del prototipo) es la única, con la pausa (R-F2).
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as session from '../lib/auth/session';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { fetchDiscovery, type DiscoveryItem } from '../lib/api/publicCampaigns';
import { lifecycleLabel } from '../lib/labels';
import { handOffTrackingCode } from '../lib/tracking/handoff';
import { CampaignCard } from '../components/campaign/CampaignCard';
import { WorldScene } from '../components/landing/WorldScene';
import { WorldModeToggle, useSurfaceTheme } from '../components/landing/WorldModeToggle';
import { scrollProgress, stopCardOpacity } from '../components/landing/worldScene';
import { PauseButton } from '../components/background/PauseButton';
import { BrandMark } from '../components/shell/BrandMark';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import s from './landing.module.css';

/** Convocatorias que se muestran en la landing; el resto, en `/campaigns`. */
export const LANDING_CAMPAIGNS = 6;

interface Stop {
  id: string;
  index: string;
  event: string;
  title: [string, string];
  text: string;
  facts: { strong: string; span: string }[];
}

/** Las cinco paradas del prototipo. Sin las cifras ni el lugar de ejemplo (X-10): "120 kits", "100 → 60 + 40", "Lorica,
 * Córdoba" y "5 de 5 pasos". */
const STOPS: Stop[] = [
  {
    id: 'parada-1', index: '01 / 05 · DONAS', event: 'PAGO CONFIRMADO', title: ['Tu donación, ', 'de principio a fin'],
    text: 'Pagas por la pasarela. Cuando el pago se confirma, se abre el historial de tu donación y recibes un código para seguirla paso a paso.',
    facts: [],
  },
  {
    id: 'parada-2', index: '02 / 05 · SE CONVIERTE EN AYUDA', event: 'FONDOS ASIGNADOS → LOTE REGISTRADO', title: ['De saldo a ', 'cajas reales'],
    text: 'La organización compra los insumos y registra cada lote en la bodega. El dinero asignado y el lote quedan conectados, y cada lote recibe su propio QR.',
    facts: [{ strong: '1 QR', span: 'por lote, no por cada unidad' }],
  },
  {
    id: 'parada-3', index: '03 / 05 · VIAJA Y SE REPARTE', event: 'LOTE DESPACHADO · LOTE DIVIDIDO', title: ['Sigue la caja, ', 'aunque se divida'],
    text: 'Cada despacho y cada recepción se registran al escanear el QR. Si el lote se reparte entre dos destinos, cada parte conserva el vínculo con su origen.',
    facts: [{ strong: 'Puntos de control', span: 'solo paradas oficiales de la ruta' }],
  },
  {
    id: 'parada-4', index: '04 / 05 · QUEDA SELLADO', event: 'LOTE SELLADO · REGISTRO PÚBLICO', title: ['Una huella que ', 'no se puede maquillar'],
    text: 'Cada registro lleva una huella digital encadenada a la anterior. Por lotes, esas huellas se resumen en una sola y se anclan en blockchain. Si alguien cambiara un registro, la verificación lo detectaría.',
    facts: [{ strong: 'SHA-256', span: 'huella de cada registro' }, { strong: '0 datos personales', span: 'en la cadena pública' }],
  },
  {
    id: 'parada-5', index: '05 / 05 · LLEGA', event: 'ENTREGA CONFIRMADA', title: ['Entregado, ', 'y lo puedes comprobar'],
    text: 'La entrega se registra sin exponer la identidad de quien recibe. Con tu código ves el recorrido completo, desde el pago hasta la comunidad.',
    facts: [],
  },
];

/**
 * Seguimiento de ejemplo (prototipo `DEMO_CODES` y `.trk-result`; D-P5, §3.3): datos ficticios rotulados "Ejemplo".
 * Los pasos son los del prototipo; el estado sale de labels.ts. Sin horas, lugares ni huellas (X-10, X-15).
 */
export const EXAMPLE_CODES = ['EJEMPLO-1', 'EJEMPLO-2'] as const;
type ExampleCode = (typeof EXAMPLE_CODES)[number];
const EXAMPLES: Record<ExampleCode, { status: string; done: number }> = {
  'EJEMPLO-1': { status: 'DELIVERED', done: 5 },
  'EJEMPLO-2': { status: 'DISPATCHED', done: 3 },
};
const EXAMPLE_STEPS = [
  { title: '01 · Recepción de fondos', text: 'Pago confirmado por la pasarela. Se abre el historial de la donación.' },
  { title: '02 · Registro de lote y QR', text: 'Compra de insumos y registro del lote en la bodega.' },
  { title: '03 · Despachado hacia el destino', text: 'QR escaneado al salir de la bodega.' },
  { title: '04 · Sello en blockchain (Merkle)', text: 'Las huellas del lote se agrupan y la raíz se ancla para verificación pública.' },
  { title: '05 · Entrega confirmada', text: 'Recibido en el centro comunitario, sin exponer datos personales.' },
] as const;

/** El código escrito es uno de los ejemplos (sin distinguir mayúsculas, como el prototipo). */
export function exampleFor(code: string): ExampleCode | null {
  const key = code.trim().toUpperCase();
  return (EXAMPLE_CODES as readonly string[]).includes(key) ? (key as ExampleCode) : null;
}

function useSessionState(): session.MachineState {
  return useSyncExternalStore(session.subscribe, session.getState, () => 'RESTORING' as session.MachineState);
}

/** Anclas de la cabecera (prototipo): todas son secciones de esta página. */
const ANCHORS = [
  { href: '#parada-1', label: 'Cómo funciona' }, { href: '#parada-4', label: 'Verificación' },
  { href: '#convocatorias', label: 'Convocatorias' }, { href: '#seguir', label: 'Seguimiento' },
];

function PersonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  );
}

/** Accesos de la cabecera (prototipo `.acts` y `.nav-mobile-acts`): Ingresar, Seguir donación y Donar. */
function HeaderActs({ signedIn, onPick }: { signedIn: boolean; onPick: () => void }) {
  return (
    <>
      {signedIn && isSurfaceEnabled('/home') && <Link className={s.btnPrimary} href="/home">Ir a mi inicio</Link>}
      {!signedIn && isSurfaceEnabled('/login') && (
        <Link className={s.btnSecondary} href="/login"><PersonIcon /><span>Ingresar</span></Link>
      )}
      <a className={s.btnSecondary} href="#seguir" onClick={onPick}>Seguir donación</a>
      {isSurfaceEnabled('/campaigns') && <a className={s.btnPrimary} href="#convocatorias" onClick={onPick}>Donar</a>}
    </>
  );
}

/**
 * Cabecera de la landing (prototipo `header.nav`): marca, anclas de la página, el botón Día / Noche (D-F2), la pausa
 * (R-F2) y los accesos. Cada control tiene su propio sitio en la fila (F-A1: la pausa ya no pisa "Donar"). En estrecho,
 * las anclas, el botón Día / Noche y los accesos van en el menú que se despliega, como en el prototipo.
 */
function LandingHeader() {
  const signedIn = useSessionState() === 'AUTHENTICATED';
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className={s.header} data-world-avoid="">
      <a className={s.brand} href="#parada-1" aria-label="PaxFide, inicio">
        <BrandMark size={30} /><span aria-hidden="true">Pax<span className={s.brandFide}>Fide</span><span className={s.brandDot}>.</span></span>
      </a>
      <nav id="landing-menu" className={open ? `${s.menu} ${s.menuOpen}` : s.menu} aria-label="Secciones de la página de inicio">
        <ul className={s.anchors}>
          {ANCHORS.map((a) => <li key={a.href}><a href={a.href} onClick={close}>{a.label}</a></li>)}
        </ul>
        <div className={s.mobileActs}>
          <WorldModeToggle className={s.modeToggle} testId="world-mode-mobile" />
          <HeaderActs signedIn={signedIn} onPick={close} />
        </div>
      </nav>
      <div className={s.tools}>
        <WorldModeToggle className={`${s.modeToggle} ${s.modeDesktop}`} />
        <PauseButton className={s.pause} textClassName={s.pauseText} />
      </div>
      <div className={s.acts}><HeaderActs signedIn={signedIn} onPick={close} /></div>
      <button type="button" className={s.menuToggle} aria-expanded={open} aria-controls="landing-menu"
        aria-label={open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'} onClick={() => setOpen((o) => !o)}>
        <span /><span /><span />
      </button>
    </header>
  );
}

/** Puntos del recorrido (prototipo `nav.dots`): uno por vista y el de convocatorias. */
const DOTS = [
  { id: 'parada-1', label: 'Parada 1: Donas' }, { id: 'parada-2', label: 'Parada 2: Se convierte en ayuda' },
  { id: 'parada-3', label: 'Parada 3: Viaja y se reparte' }, { id: 'parada-4', label: 'Parada 4: Queda sellado' },
  { id: 'parada-5', label: 'Parada 5: Llega' }, { id: 'recorrido', label: 'Todo el recorrido' },
  { id: 'convocatorias', label: 'Convocatorias abiertas' },
];

/** Índice de la sección cuyo centro está más cerca del centro de la ventana. */
export function nearestSection(centers: readonly number[], y: number): number {
  let best = 0;
  centers.forEach((c, i) => { if (Math.abs(c - y) < Math.abs(centers[best] - y)) best = i; });
  return best;
}

function useScroll(fn: () => void) {
  useEffect(() => {
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    window.addEventListener('resize', fn);
    return () => { window.removeEventListener('scroll', fn); window.removeEventListener('resize', fn); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function StopDots() {
  const [active, setActive] = useState(0);
  useScroll(() => {
    const centers = DOTS.map((d) => {
      const r = document.getElementById(d.id)?.getBoundingClientRect();
      return r ? r.top + r.height / 2 : Number.POSITIVE_INFINITY;
    });
    setActive(nearestSection(centers, window.innerHeight / 2));
  });
  return (
    <nav className={s.dots} aria-label="Paradas del recorrido" data-world-avoid="">
      {DOTS.map((d, i) => (
        <a key={d.id} href={`#${d.id}`} aria-label={d.label} aria-current={i === active ? 'step' : undefined}
          className={i === active ? s.dotOn : undefined} />
      ))}
    </nav>
  );
}

/**
 * Las tarjetas de las paradas se desvanecen al alejarse de su parada (prototipo `readScroll`: `cards[j].style.opacity`).
 * Sigue al scroll, no al tiempo: con "reducir movimiento" pasa igual, sin transición.
 */
function useStopCardFade() {
  useScroll(() => {
    const views = [...document.querySelectorAll<HTMLElement>('[data-world-view]')];
    const centers = views.map((el) => { const r = el.getBoundingClientRect(); return r.top + window.scrollY + r.height / 2; });
    const raw = scrollProgress(centers, window.scrollY + window.innerHeight / 2);
    document.querySelectorAll<HTMLElement>('[data-stop-card]').forEach((card) => {
      card.style.opacity = stopCardOpacity(raw, Number(card.dataset.stopCard)).toFixed(3);
    });
  });
}

const MANIFESTO = 'Cada paso queda registrado. Nadie lo puede cambiar sin que se note. Y tú lo puedes comprobar cuando quieras.';
const HIGHLIGHT = new Set(['registrado.', 'cambiar', 'comprobar']);

/** Cuántas palabras del manifiesto se encienden según su posición en la ventana (prototipo `readScroll`). */
export function litWords(top: number, viewport: number, words: number): number {
  const p = Math.min(1, Math.max(0, (viewport * 0.78 - top) / (viewport * 0.45)));
  return Math.round(p * words);
}

/**
 * "Todo el recorrido": las palabras se encienden al desplazarse. Apagadas van en el color secundario (sigue legible,
 * R-F1); con "reducir movimiento" están todas encendidas desde el principio.
 */
function Manifesto() {
  const words = MANIFESTO.split(' ');
  const [lit, setLit] = useState(words.length);
  useScroll(() => {
    const el = document.getElementById('manifiesto');
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setLit(words.length); return; }
    setLit(litWords(el.getBoundingClientRect().top, window.innerHeight, words.length));
  });
  return (
    <p id="manifiesto" data-testid="manifesto" data-lit={lit}>
      {words.map((w, i) => {
        const cls = i < lit ? s.wordLit : s.word;
        const word = HIGHLIGHT.has(w) ? <em>{w}</em> : w;
        return <React.Fragment key={i}><span className={cls}>{word}</span>{i < words.length - 1 ? ' ' : ''}</React.Fragment>;
      })}
    </p>
  );
}

function StopCard({ stop, index }: { stop: Stop; index: number }) {
  const first = index === 0;
  const Heading = first ? 'h1' : 'h2';
  return (
    <section className={first ? `${s.stop} ${s.stopFirst}` : s.stop} id={stop.id} data-world-view="">
      <article className={s.card} data-world-avoid="" data-stop-card={index}>
        <div className={s.idx}><b>{stop.index}</b><span className={s.ev}>{stop.event}</span></div>
        <Heading className={first ? s.h1 : s.h2}>{stop.title[0]}<em>{stop.title[1]}</em>.</Heading>
        <p className={s.text}>{stop.text}</p>
        {stop.facts.length > 0 && (
          <div className={s.facts}>
            {stop.facts.map((f) => <div key={f.strong}><strong>{f.strong}</strong><span>{f.span}</span></div>)}
          </div>
        )}
        {first && (
          <div className={s.ctas}>
            {isSurfaceEnabled('/campaigns') && <a className={s.btnPrimary} href="#convocatorias">Donar a una convocatoria</a>}
            <a className={s.btnSecondary} href="#seguir">Seguir mi donación</a>
          </div>
        )}
        {first && <p className={s.hint}><i aria-hidden="true" />Desliza y acompaña su recorrido</p>}
      </article>
    </section>
  );
}

function CodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3M21 14v.01M14 21h7v-4" />
    </svg>
  );
}

/**
 * Buscador del prototipo (`form.trk` y `.trk-demo-chips`). Un código de ejemplo muestra el resultado ilustrativo;
 * cualquier otro se lleva a `/tracking` en memoria (DW-16, D2: nunca por la URL) y allí se consulta.
 */
function TrackingSearch() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [example, setExample] = useState<ExampleCode | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!example) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    resultRef.current?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }, [example]);
  const show = (value: string) => {
    if (!value.trim()) { setMsg('Escribe tu código o pulsa uno de los ejemplos.'); setExample(null); return; }
    const ex = exampleFor(value);
    if (ex) { setMsg(''); setExample(ex); return; }
    if (!isSurfaceEnabled('/tracking')) { setMsg('El seguimiento no está disponible en este momento.'); setExample(null); return; }
    handOffTrackingCode(value.trim());
    router.push('/tracking');
  };
  const current = example ? EXAMPLES[example] : null;
  return (
    <>
      <form className={s.trk} autoComplete="off" role="search" onSubmit={(e) => { e.preventDefault(); show(code); }}>
        <label htmlFor="landing-trk" className={s.srOnly}>Código de seguimiento</label>
        <div className={s.capsule}>
          <CodeIcon />
          <input id="landing-trk" name="trk" placeholder="Código de seguimiento" spellCheck={false} autoCapitalize="characters"
            value={code} onChange={(e) => setCode(e.target.value)} data-testid="landing-trk" />
          <button type="submit" className={s.btnYellow}>Ver recorrido <span aria-hidden="true">→</span></button>
        </div>
      </form>
      <div className={s.demoChips}>
        <span className={s.demoLabel}>¿No tienes código? Prueba:</span>
        {EXAMPLE_CODES.map((c) => (
          <button key={c} type="button" className={s.demoChip} data-testid="example-chip"
            onClick={() => { setCode(c); show(c); }}>{c} <span aria-hidden="true">↗</span></button>
        ))}
      </div>
      <p className={s.trkMsg} role="status">{msg}</p>
      {current && (
        <div ref={resultRef} className={s.result} data-testid="tracking-example" aria-live="polite">
          <div className={s.resultBadge}>
            <span className={s.evExample}>EJEMPLO ILUSTRATIVO</span>
            <small>Datos ficticios. No es una consulta a la plataforma.</small>
          </div>
          <dl className={s.summary}>
            <div><dt>Lote</dt><dd>Lote de ejemplo</dd></div>
            <div><dt>Destino</dt><dd>Centro comunitario</dd></div>
            <div><dt>Estado</dt><dd><span className={s.statusTag} data-testid="example-status">{lifecycleLabel(current.status)} ({current.done}/5)</span></dd></div>
          </dl>
          <ol className={s.timeline}>
            {EXAMPLE_STEPS.map((st, i) => (
              <li key={st.title} className={i < current.done ? undefined : s.stepPending} data-done={i < current.done ? 'true' : 'false'}>
                <span className={s.tlDot} aria-hidden="true" />
                <b>{st.title}</b>
                <p>{st.text}</p>
              </li>
            ))}
          </ol>
          <p className={s.disclaimer}>En la plataforma real, el código de seguimiento es una credencial privada: no lo compartas ni lo publiques.</p>
        </div>
      )}
    </>
  );
}

function OrgIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3 21h18" /><path d="M5 21V9l7-5 7 5v12" /><path d="M9 21v-6h6v6" /></svg>
  );
}

function OpenCampaigns({ client }: { client: typeof fetchDiscovery }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const load = async () => {
    setState('loading');
    const r = await client();
    if (r.kind === 'error') { setState('error'); return; }
    setItems(r.items.slice(0, LANDING_CAMPAIGNS));
    setState('ready');
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  return (
    <section className={s.campaigns} id="convocatorias" aria-labelledby="convocatorias-titulo">
      <div className={s.panel} data-world-avoid="">
        <div className={s.convHead}>
          <span className={s.ev}>CATÁLOGO OFICIAL DE CONVOCATORIAS</span>
          <h2 id="convocatorias-titulo" className={s.h2}>Causas abiertas con <em>trazabilidad garantizada</em></h2>
          <p className={s.text}>Explora convocatorias activas con trazabilidad lote a lote. Cada donación genera un recibo digital enlazado a kits físicos verificados en blockchain.</p>
        </div>
        {state === 'loading' && <LoadingState />}
        {state === 'error' && <ErrorState onRetry={() => void load()} />}
        {state === 'ready' && items.length === 0 && <EmptyState text="No hay convocatorias abiertas en este momento." />}
        {state === 'ready' && items.length > 0 && (
          <ul className={s.grid} data-testid="landing-campaigns">
            {items.map((c) => <li key={c.publicCode}><CampaignCard campaign={c} /></li>)}
          </ul>
        )}
        {state === 'ready' && isSurfaceEnabled('/campaigns') && (
          <p className={s.more}><Link className={s.btnSecondary} href="/campaigns">Ver todas</Link></p>
        )}
        <footer className={s.footer}>
          <p>PaxFide · plataforma de trazabilidad de donaciones</p>
        </footer>
      </div>
    </section>
  );
}

export function LandingScreen({ client = fetchDiscovery }: { client?: typeof fetchDiscovery }) {
  // D-F2: las superficies de la landing siguen el modo Día / Noche, no el tema de la app
  const theme = useSurfaceTheme();
  useStopCardFade();
  return (
    <div className={s.landing} data-theme={theme} data-testid="landing-root">
      <WorldScene blurUnder="convocatorias" />
      <LandingHeader />
      <StopDots />
      {/* D-P13: en `/` la estructura no pone su <main>; la landing lo abre tras su cabecera */}
      <main className={s.content} id="contenido">
      {STOPS.map((st, i) => <StopCard key={st.id} stop={st} index={i} />)}
      <section className={s.overview} id="recorrido" data-world-view="">
        <div className={s.mani} data-world-avoid="">
          <span className={s.ev}>TODO EL RECORRIDO</span>
          <Manifesto />
        </div>
      </section>

      <section className={s.cta} id="seguir" aria-labelledby="seguir-titulo">
        <div className={s.island} data-world-avoid="">
          <div className={s.ctaMain}>
            <span className={`${s.ev} ${s.ctaEv}`}><i className={s.liveDot} aria-hidden="true" />SEGUIMIENTO DE DONACIÓN</span>
            <h2 id="seguir-titulo" className={s.h2}>¿Ya donaste? <em>Sigue tu donación.</em></h2>
            <p className={s.text}>Escribe el código que recibiste al donar. Verás en qué punto va y cuándo quedó sellada.</p>
            <TrackingSearch />
          </div>
          <aside className={s.org} aria-labelledby="organizacion-titulo">
            <div className={s.orgIcon}><OrgIcon /></div>
            <h3 id="organizacion-titulo" className={s.h3}>¿Eres una organización?</h3>
            <p>Crea tu cuenta y registra la organización. Un administrador la verifica antes de que publique convocatorias.</p>
            <ul className={s.checks}>
              <li>Convocatorias con meta y fechas</li>
              <li>Lotes con QR y recorrido visible</li>
              <li>Historial que cualquiera puede verificar</li>
            </ul>
            {isSurfaceEnabled('/register') && <Link className={s.btnSecondary} href="/register">Registrar mi organización <span aria-hidden="true">→</span></Link>}
          </aside>
        </div>
      </section>

      <OpenCampaigns client={client} />
      </main>
    </div>
  );
}
