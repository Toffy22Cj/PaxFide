'use client';
// Ref: plan-fase7-pantallas.md A-2 y D-P5; plan-fase7-fidelidad.md D-F1, D-F2, D-F4; prompts-agentes-estilo-v2.md VS-4 y §3.3; referencia-api-v1.md §5
// (GET /public/campaigns). Referencia visual y contrato: paxfide-landing.html. Textos del recorrido tal cual, sin cifras ni
// nombres concretos (montos, organizaciones, ciudades). D-F2: selector Día / Ocaso / Noche (auto, night, day).
// D-P13: en `/` la app no pone su cabecera ni su barra; esta cabecera (la del prototipo) es la única, con el botón de pausa (R-F2).
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import * as session from '../lib/auth/session';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { fetchDiscovery, type DiscoveryItem } from '../lib/api/publicCampaigns';
import { custodianLabel, eventLabel, intentStatusLabel } from '../lib/labels';
import { CampaignCard } from '../components/campaign/CampaignCard';
import { WorldScene, targetView } from '../components/landing/WorldScene';
import { LandingThemeToggle } from '../components/landing/LandingThemeToggle';
import {
  calculateNightVal,
  nextWorldMode,
  readSavedWorldMode,
  saveWorldMode,
  type WorldMode,
} from '../components/landing/worldMode';
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

/** Seguimiento demostrativo (D-P5, §3.3): datos ficticios rotulados "Ejemplo", solo con categorías del enumerado. */
const EXAMPLE_STEPS = [
  { event: 'ASSET_REGISTERED', custodian: 'REGIONAL_WAREHOUSE', text: 'Compra de insumos y registro del lote en la bodega.' },
  { event: 'ASSET_DISPATCHED', custodian: 'LAST_MILE_CARRIER', text: 'QR escaneado al salir de la bodega.' },
  { event: 'ASSET_RECEIVED', custodian: 'LOCAL_ALLY', text: 'QR escaneado en un punto de control de la ruta.' },
  { event: 'ASSET_DELIVERED', custodian: 'LOCAL_ALLY', text: 'Recibido en el centro comunitario, sin exponer datos personales.' },
] as const;

function useSessionState(): session.MachineState {
  return useSyncExternalStore(session.subscribe, session.getState, () => 'RESTORING' as session.MachineState);
}

/** Anclas de la cabecera (prototipo): todas son secciones de esta página. */
const ANCHORS = [
  { href: '#parada-1', label: 'Cómo funciona' }, { href: '#parada-4', label: 'Verificación' },
  { href: '#convocatorias', label: 'Convocatorias' }, { href: '#seguir', label: 'Seguimiento' },
];

/**
 * Cabecera de la landing (prototipo `header.nav`): marca → `/`, anclas de la página, pausa de la animación y accesos
 * a Ingresar, Seguir una donación y Donar. En estrecho, las anclas y los accesos van en un menú que se despliega.
 */
function LandingHeader({
  worldMode,
  nightVal,
  onToggleMode,
}: {
  worldMode: WorldMode;
  nightVal: number;
  onToggleMode: () => void;
}) {
  const signedIn = useSessionState() === 'AUTHENTICATED';
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className={s.header} data-world-avoid="">
      <Link className={s.brand} href="/" aria-label="PaxFide, inicio">
        <BrandMark size={30} /><span aria-hidden="true">Pax<span className={s.brandFide}>Fide</span><span className={s.brandDot}>.</span></span>
      </Link>
      <nav id="landing-menu" className={open ? `${s.menu} ${s.menuOpen}` : s.menu} aria-label="Secciones de la página de inicio">
        <ul className={s.anchors}>
          {ANCHORS.map((a) => <li key={a.href}><a href={a.href} onClick={close}>{a.label}</a></li>)}
        </ul>
        <div className={s.acts}>
          <LandingThemeToggle mode={worldMode} nightVal={nightVal} onToggle={onToggleMode} />
          {signedIn && isSurfaceEnabled('/home') && <Link className={s.btnPrimary} href="/home">Ir a mi inicio</Link>}
          {!signedIn && isSurfaceEnabled('/login') && <Link className={s.btnSecondary} href="/login">Ingresar</Link>}
          {isSurfaceEnabled('/tracking') && <Link className={s.btnSecondary} href="/tracking">Seguir una donación</Link>}
          {isSurfaceEnabled('/campaigns') && <Link className={s.btnPrimary} href="/campaigns">Donar</Link>}
        </div>
      </nav>
      <PauseButton className={s.pause} textClassName={s.pauseText} />
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

function StopCard({ stop, first }: { stop: Stop; first: boolean }) {
  const Heading = first ? 'h1' : 'h2';
  return (
    <section className={first ? `${s.stop} ${s.stopFirst}` : s.stop} id={stop.id} data-world-view="">
      <article className={s.card} data-world-avoid="">
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

function TrackingExample() {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.example}>
      <p className={s.exampleLead}>
        ¿No tienes código?{' '}
        <button type="button" className={s.linkButton} aria-expanded={open} aria-controls="seguimiento-ejemplo"
          onClick={() => setOpen((o) => !o)} data-testid="example-toggle">
          {open ? 'Ocultar el ejemplo' : 'Ver un ejemplo'}
        </button>
      </p>
      {open && (
        <div id="seguimiento-ejemplo" className={s.exampleBox} data-testid="tracking-example">
          <p className={s.exampleBadge}><span className={s.ev}>Ejemplo</span> Datos ficticios. No es una consulta a la plataforma.</p>
          <p className={s.exampleIntro}>Donación {intentStatusLabel('CONFIRMED').toLocaleLowerCase('es')}: el pago llegó por la pasarela y se abre su historial.</p>
          <ol className={s.timeline}>
            {EXAMPLE_STEPS.map((st) => (
              <li key={st.event}>
                <b>{eventLabel(st.event)}</b> · <span>{custodianLabel(st.custodian)}</span>
                <p>{st.text}</p>
              </li>
            ))}
          </ol>
          <p className={s.disclaimer}>En la plataforma real, el código de seguimiento es una credencial privada: no lo compartas ni lo publiques.</p>
        </div>
      )}
    </div>
  );
}

function OpenCampaigns({ client }: { client: typeof fetchDiscovery }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const load = async () => {
    setState('loading');
    const r = await client();
    if (r.kind !== 'ok') { setState('error'); return; }
    setItems(r.items.slice(0, LANDING_CAMPAIGNS));
    setState('ready');
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  return (
    <section className={s.campaigns} id="convocatorias" aria-labelledby="convocatorias-titulo">
      <div className={s.panel} data-world-avoid="">
        <span className={s.ev}>CONVOCATORIAS</span>
        <h2 id="convocatorias-titulo" className={s.h2}>Convocatorias <em>abiertas</em></h2>
        <p className={s.text}>Explora convocatorias activas con trazabilidad lote a lote.</p>
        {state === 'loading' && <LoadingState />}
        {state === 'error' && <ErrorState onRetry={() => void load()} />}
        {state === 'ready' && items.length === 0 && <EmptyState text="No hay convocatorias abiertas en este momento." />}
        {state === 'ready' && items.length > 0 && (
          <ul className={s.grid} data-testid="landing-campaigns">
            {items.map((c) => <li key={c.publicCode}><CampaignCard campaign={c} /></li>)}
          </ul>
        )}
        {/* U-20 (plan-fase7-puesta-al-dia.md Anexo 3): la búsqueda vive solo en /campaigns; aquí, el enlace */}
        {state === 'ready' && isSurfaceEnabled('/campaigns') && (
          <p className={s.more}>
            <Link className={s.btnSecondary} href="/campaigns">Ver todas</Link>
            <Link className={s.btnSecondary} href="/campaigns" data-testid="landing-search-link">Buscar convocatorias</Link>
          </p>
        )}
      </div>
    </section>
  );
}

export function LandingScreen({ client = fetchDiscovery }: { client?: typeof fetchDiscovery }) {
  const [worldMode, setWorldMode] = useState<WorldMode>('auto');
  const [currentView, setCurrentView] = useState(0);

  useEffect(() => {
    setWorldMode(readSavedWorldMode());
  }, []);

  useScroll(() => {
    setCurrentView(targetView());
  });

  const handleToggleMode = () => {
    const next = nextWorldMode(worldMode);
    setWorldMode(next);
    saveWorldMode(next);
  };

  const nightVal = calculateNightVal(worldMode, currentView);
  const isDark = nightVal >= 0.5;

  return (
    // U-28 (plan-fase7-puesta-al-dia.md Anexo 4): el tema lo decide este contenedor también de día. Con `undefined`,
    // de día la landing heredaba el tema de <html> (la app en oscuro) y salía oscura con el mundo claro
    <div className={s.landing} data-theme={isDark ? 'dark' : 'light'} data-testid="landing-root">
      <WorldScene mode={worldMode} onViewChange={setCurrentView} />
      <LandingHeader worldMode={worldMode} nightVal={nightVal} onToggleMode={handleToggleMode} />
      <StopDots />
      {/* D-P13: en `/` la estructura no pone su <main>; la landing lo abre tras su cabecera */}
      <main className={s.content} id="contenido">
      {STOPS.map((st, i) => <StopCard key={st.id} stop={st} first={i === 0} />)}
      <section className={s.overview} id="recorrido" data-world-view="">
        <div className={s.mani} data-world-avoid="">
          <span className={s.ev}>TODO EL RECORRIDO</span>
          <Manifesto />
        </div>
      </section>

      <section className={s.cta} id="seguir" aria-labelledby="seguir-titulo">
        <div className={s.island} data-world-avoid="">
          <div className={s.ctaMain}>
            <span className={s.ev}>SEGUIMIENTO DE DONACIÓN</span>
            <h2 id="seguir-titulo" className={s.h2}>¿Ya donaste? <em>Sigue tu donación.</em></h2>
            <p className={s.text}>Escribe el código que recibiste al donar. Verás en qué punto va y cuándo quedó sellada.</p>
            <div className={s.ctas}>
              {isSurfaceEnabled('/tracking') && <Link className={s.btnPrimary} href="/tracking">Seguir una donación</Link>}
              {isSurfaceEnabled('/campaigns') && <Link className={s.btnSecondary} href="/campaigns">Donar</Link>}
            </div>
            <TrackingExample />
          </div>
          <aside className={s.org} aria-labelledby="organizacion-titulo">
            <h3 id="organizacion-titulo" className={s.h3}>¿Eres una organización?</h3>
            <p>Crea tu cuenta y registra la organización. Un administrador la verifica antes de que publique convocatorias.</p>
            <ul className={s.checks}>
              <li>Convocatorias con meta y fechas</li>
              <li>Lotes con QR y recorrido visible</li>
              <li>Historial que cualquiera puede verificar</li>
            </ul>
            {isSurfaceEnabled('/register') && <Link className={s.btnSecondary} href="/register">Registrar mi organización</Link>}
          </aside>
        </div>
      </section>

      <OpenCampaigns client={client} />

      </main>
      <footer className={s.footer} data-world-avoid="">
        <p><b>PaxFide</b> · Donaciones que llegan: trazabilidad verificable de donaciones.</p>
      </footer>
    </div>
  );
}
