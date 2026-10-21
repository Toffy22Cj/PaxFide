'use client';
// Ref: sistema-visual-paxfide-web-enmienda-1.md §8 (E4: barra inferior en móvil, lateral en escritorio; mismo DOM y
// mismo orden de foco en todas las posiciones); prompts-agentes-estilo-v2.md VS-2; ADR-046 D5.
import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { activeEntry, type NavEntry } from '../../lib/nav/navEntries';
import { NavIconSvg } from './icons';
import s from './AppNav.module.css';

export function AppNav({ entries, pathname }: { entries: readonly NavEntry[]; pathname: string }) {
  const list = useRef<HTMLUListElement>(null);
  const active = activeEntry(pathname, entries);
  // En la barra inferior las entradas pueden no caber y la lista se desplaza: la activa siempre queda a la vista
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);
  if (entries.length === 0) return null;
  return (
    <nav className={s.nav} aria-label="Principal" data-testid="app-nav">
      <ul className={s.items} ref={list}>
        {entries.map((e) => (
          <li key={e.id}>
            <Link href={e.href} className={s.item} aria-current={active === e.id ? 'page' : undefined}
              data-testid={`nav-${e.id}`}>
              <span className={s.pill}><NavIconSvg id={e.id} /></span>
              <span className={s.label}>{e.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
