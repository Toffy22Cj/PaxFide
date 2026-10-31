'use client';

// Ref: plan-fase7-puesta-al-dia.md Anexo 4, U-29 a U-31; Documentos/paxfide-landing.html (.auth-card-head,
// switchAuthTab). La tarjeta de "Iniciar sesión" / "Crear cuenta" la monta UNA vez el layout de `(acceso)/(cuenta)`:
// al cambiar de pestaña solo cambia el contenido (título, subtítulo y formulario), como en el boceto.
// U-31: el indicador de la pestaña se desliza; el contenido sale con un fundido y entra con fundido y 12 px en la
// dirección de la pestaña; la altura se anima (ResizeObserver). Con "reducir movimiento", todo es instantáneo (CSS).
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isSurfaceEnabled } from '../../lib/routing/surfaces';
import s from '../../screens/access.module.css';
import a from './authCard.module.css';

export type AuthTab = 'login' | 'register';

const TABS: Record<AuthTab, { href: string; label: string; title: string; subtitle: string }> = {
  login: {
    href: '/login', label: 'Iniciar sesión', title: 'Iniciar sesión',
    subtitle: 'Gestiona tus donaciones, verifica lotes en blockchain y apoya convocatorias.',
  },
  register: {
    href: '/register', label: 'Crear cuenta', title: 'Crear cuenta',
    subtitle: 'Únete para apoyar causas verificadas y seguir el impacto real de cada donación.',
  },
};
const ORDER: AuthTab[] = ['login', 'register'];

export function tabForPath(pathname: string): AuthTab {
  return pathname === '/register' ? 'register' : 'login';
}

function TabIcon({ tab }: { tab: AuthTab }) {
  return tab === 'login' ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

/** Copia del contenido saliente para su fundido: inerte, sin ids ni nombres (nunca duplica un campo ni un valor). */
function ghostOf(node: HTMLElement): HTMLElement {
  const ghost = node.cloneNode(true) as HTMLElement;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('inert', '');
  for (const el of [ghost, ...Array.from(ghost.querySelectorAll<HTMLElement>('*'))]) {
    el.removeAttribute('id');
    el.removeAttribute('name');
    el.removeAttribute('data-testid');
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = '';
  }
  return ghost;
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/login';
  const tab = tabForPath(pathname);
  const tabs = ORDER.filter((t) => t === tab || isSurfaceEnabled(TABS[t].href));
  const index = Math.max(0, tabs.indexOf(tab));
  const prevTab = useRef<AuthTab>(tab);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const ghosts = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  // La altura de la tarjeta sigue al contenido: se fija en px y la transición de CSS la anima
  useEffect(() => {
    const vp = viewport.current;
    const el = content.current;
    if (!vp || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { vp.style.height = `${el.offsetHeight}px`; });
    ro.observe(el);
    vp.style.height = `${el.offsetHeight}px`;
    return () => ro.disconnect();
  }, []);

  // Cambio de pestaña: entra el contenido nuevo desde el lado de la pestaña y el foco va al título
  useLayoutEffect(() => {
    const from = prevTab.current;
    prevTab.current = tab;
    if (from === tab) return;
    const el = content.current;
    if (el) {
      el.dataset.enter = ORDER.indexOf(tab) > ORDER.indexOf(from) ? 'from-right' : 'from-left';
      // Reinicia la animación de entrada aunque se cambie dos veces seguidas
      el.classList.remove(a.entering);
      void el.offsetWidth;
      el.classList.add(a.entering);
    }
    title.current?.focus();
  }, [tab]);

  /** Al pulsar otra pestaña, una copia del contenido saliente se desvanece encima mientras entra el nuevo. */
  const onTabClick = (target: AuthTab) => {
    if (target === tab || !content.current || !ghosts.current) return;
    const ghost = ghostOf(content.current);
    ghost.className = a.ghost;
    ghost.dataset.exit = ORDER.indexOf(target) > ORDER.indexOf(tab) ? 'to-left' : 'to-right';
    ghosts.current.appendChild(ghost);
    ghost.addEventListener('animationend', () => ghost.remove(), { once: true });
    // Sin animación (reducir movimiento), animationend no llega: se retira enseguida
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) ghost.remove();
  };

  const t = TABS[tab];
  return (
    <div className={s.page}>
      <div className={s.card} data-world-avoid="" data-testid="auth-card">
        <div className={s.badgePill}>
          <span className={s.badgeDot} />
          <span>TU CUENTA PAXFIDE</span>
        </div>
        <h1 id="authCardTitle" ref={title} tabIndex={-1} className={[s.title, a.title].join(' ')}>{t.title}</h1>
        <p id="authCardSub" className={s.subtitle}>{t.subtitle}</p>

        <div className={[s.tabs, a.tabs].join(' ')} role="tablist" aria-label="Acceso"
          style={{ '--tab-count': tabs.length, '--tab-index': index } as React.CSSProperties}>
          <span className={a.indicator} aria-hidden="true" data-testid="auth-tab-indicator" />
          {tabs.map((key) => (
            <Link key={key} href={TABS[key].href} role="tab" id={key === 'login' ? 'tabBtnLogin' : 'tabBtnRegister'}
              aria-selected={key === tab} className={[s.tabBtn, a.tabBtn, key === tab ? a.tabActive : ''].join(' ')}
              onClick={() => onTabClick(key)}>
              <TabIcon tab={key} />
              <span>{TABS[key].label}</span>
            </Link>
          ))}
        </div>

        <div className={a.viewport} ref={viewport} data-testid="auth-card-viewport">
          <div className={a.ghosts} ref={ghosts} />
          <div className={a.content} ref={content}>{children}</div>
        </div>
      </div>
    </div>
  );
}
