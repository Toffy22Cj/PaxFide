'use client';
// Ref: sistema-visual-paxfide-web-enmienda-1.md §8 (E4: barra inferior en móvil, lateral en escritorio; mismo DOM y
// mismo orden de foco en todas las posiciones); prompts-agentes-estilo-v2.md VS-2; ADR-046 D5; DF7-20 (máximo 5
// entradas en la barra inferior: la selección la hace navEntriesFor, no el CSS).
import React from 'react';
import Link from 'next/link';
import { activeEntry, type NavEntry } from '../../lib/nav/navEntries';
import { NavIconSvg } from './icons';
import s from './AppNav.module.css';

export function AppNav({
  entries,
  pathname,
  onOpenTune,
}: {
  entries: readonly NavEntry[];
  pathname: string;
  onOpenTune?: () => void;
}) {
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
        {onOpenTune && (
          <li className={s.tuneItem}>
            <button
              type="button"
              className={s.tune}
              data-open-tune=""
              aria-label="Personalizar la barra"
              data-testid="nav-tune-btn"
              onClick={onOpenTune}
            >
              <span className={s.pill}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
                  <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
                  <circle cx="15" cy="6" r="2" />
                  <circle cx="9" cy="12" r="2" />
                  <circle cx="17" cy="18" r="2" />
                </svg>
              </span>
              <span className={s.label}>Barra</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
