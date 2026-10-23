'use client';
// Ref: plan-fase7-pantallas.md A-2 (tarjeta compartida con A-3 y A-5), D-P10 y DF7-22 (inicial sobre
// --color-success-bg con --color-success-text); referencia-api-v1.md §5 (GET /public/campaigns, notas del 18 y del
// 21 de octubre: organizationVerified y organizationLogoUrl?). `coverImageUrl` no se usa (Tarea 3 de ADR-051).
import React, { useState } from 'react';
import Link from 'next/link';
import type { DiscoveryItem } from '../../lib/api/publicCampaigns';
import { formatMinorUnits, percentOf } from '../../lib/money';
import { LocalDate } from '../LocalDate';
import s from './campaignCard.module.css';

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Primera letra del nombre de la organización (sin nombre, no hay inicial). */
export function organizationInitial(name?: string): string | null {
  const first = name?.trim().charAt(0);
  return first ? first.toLocaleUpperCase('es') : null;
}

export function CampaignCard({ campaign: c, headingLevel = 3 }: { campaign: DiscoveryItem; headingLevel?: 2 | 3 }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const Heading = `h${headingLevel}` as const;
  const initial = organizationInitial(c.organizationName);
  const logo = c.organizationLogoUrl && !logoFailed ? c.organizationLogoUrl : null;
  const pct = c.targetAmount ? percentOf(c.clearedAmount ?? '0', c.targetAmount) : null;

  return (
    <article className={s.card} data-testid="campaign-card">
      {(logo || initial || c.organizationVerified) && (
        <div className={s.org}>
          {/* El nombre va al lado en texto: el logo y la inicial son decorativos */}
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={s.logo} src={logo} alt="" width={40} height={40} loading="lazy" decoding="async"
              referrerPolicy="no-referrer" onError={() => setLogoFailed(true)} data-testid="campaign-logo" />
          ) : initial ? (
            <span className={s.initial} aria-hidden="true" data-testid="campaign-initial">{initial}</span>
          ) : null}
          <div className={s.orgText}>
            {c.organizationName && <p className={s.orgName}>{c.organizationName}</p>}
            {c.organizationVerified && (
              <span className={s.verified} data-testid="campaign-verified"><CheckIcon />Verificada</span>
            )}
          </div>
        </div>
      )}
      <Heading className={s.title}>
        <Link href={`/c/${encodeURIComponent(c.publicCode)}`}>{c.title}</Link>
      </Heading>
      {c.currency && c.targetAmount && (
        <div className={s.progress}>
          {pct !== null && (
            <div className={s.track} aria-hidden="true"><div className={s.fill} style={{ width: `${Math.min(100, pct)}%` }} /></div>
          )}
          <p className={s.amounts} data-testid="campaign-amounts">
            {formatMinorUnits(c.clearedAmount ?? '0', c.currency)} de {formatMinorUnits(c.targetAmount, c.currency)}
            {pct !== null ? ` (${pct} %)` : ''}
          </p>
        </div>
      )}
      <p className={s.dates}>Cierra el <LocalDate iso={c.endDate} /></p>
    </article>
  );
}
