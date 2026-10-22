'use client';
// Ref: sistema-visual-paxfide-web-enmienda-1.md §8 (E4: barra inferior en móvil, lateral en escritorio; mismo DOM y
// mismo orden de foco en todas las posiciones); prompts-agentes-estilo-v2.md VS-2; ADR-046 D5; DF7-20 (máximo 5
// entradas en la barra inferior: la selección la hace navEntriesFor, no el CSS).
import React from 'react';
import Link from 'next/link';
import { activeEntry, type NavEntry } from '../../lib/nav/navEntries';
import { NavIconSvg } from './icons';
import s from './AppNav.module.css';

export function AppNav({ entries, pathname }: { entries: readonly NavEntry[]; pathname: string }) {
  if (entries.length === 0) return null;
  const active = activeEntry(pathname, entries);
  return (
    <nav className={s.nav} aria-label="Principal" data-testid="app-nav">
      <ul className={s.items}>
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
