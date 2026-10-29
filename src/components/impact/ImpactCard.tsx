'use client';
// Ref: plan-fase7-puesta-al-dia.md Anexo 1, U-14 y P-7. La misma tarjeta en /home y en /account; sin ruta propia.
// Datos: `GET /account/impact` (referencia-api-v1.md §1, M-21). Entrada `rise` del inicio (F-A4).
import React from 'react';
import Link from 'next/link';
import { fetchImpact, type AccountImpact } from '../../lib/api/account';
import { useRead } from '../../lib/api/useRead';
import { DELIVERED_UNITS_LABEL, EMPTY_TEXT, impactView } from '../../lib/impact/impactModel';
import { isSurfaceEnabled } from '../../lib/routing/surfaces';
import { ErrorState } from '../States';
import { Skeleton } from '../loaders/Skeleton';
import s from './impact.module.css';

export function ImpactCard({ client = fetchImpact, cardIndex, className }: {
  client?: typeof fetchImpact;
  cardIndex?: number;
  className?: string;
}) {
  const { state, reload } = useRead<AccountImpact, 'unauthorized' | 'error'>(async () => {
    const r = await client();
    return r.kind === 'ok' ? { status: 'ready', data: r.impact } : { status: r.kind };
  }, [client]);
  // Un 401 sigue el flujo de sesión (T-1, http.ts): la tarjeta no pinta nada propio
  if (state.status === 'unauthorized') return null;
  const view = state.status === 'ready' ? impactView(state.data) : null;

  return (
    <section className={[s.card, className ?? ''].join(' ')} aria-labelledby="impact-title" data-testid="impact-card"
      style={{ '--card-index': cardIndex } as React.CSSProperties}>
      <h2 id="impact-title" className={s.title}>
        <svg className={s.icon} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M4 20h16M7 16V10M12 16V5M17 16v-4" />
        </svg>
        Mi impacto
      </h2>
      {state.status === 'loading' && (
        <div role="status" aria-label="Cargando tu impacto" className={s.loading}>
          <Skeleton height={32} width="50%" aria-hidden />
          <Skeleton height={16} width="80%" aria-hidden />
          <Skeleton height={16} width="65%" aria-hidden />
        </div>
      )}
      {state.status === 'error' && <ErrorState onRetry={reload} text="No pudimos cargar tu impacto. Inténtalo de nuevo." />}
      {view?.kind === 'empty' && (
        <div className={s.empty} data-testid="impact-empty">
          <p className={s.text}>{EMPTY_TEXT}</p>
          {isSurfaceEnabled('/campaigns') && <Link className={s.link} href="/campaigns">Explorar convocatorias</Link>}
        </div>
      )}
      {view?.kind === 'stats' && (
        <>
          <div className={s.block}>
            <span className={s.label}>Aportaste</span>
            <ul className={s.lines} data-testid="impact-totals">
              {view.totals.map((t) => <li key={t} className={s.big}>{t}</li>)}
            </ul>
          </div>
          <ul className={s.facts}>
            <li data-testid="impact-donations">{view.donations}</li>
            <li data-testid="impact-campaigns">{view.campaigns}</li>
          </ul>
          {view.units.length > 0 && (
            <div className={s.block} data-testid="impact-units">
              <span className={s.label}>{DELIVERED_UNITS_LABEL}</span>
              <ul className={s.lines}>{view.units.map((u) => <li key={u} className={s.unit}>{u}</li>)}</ul>
            </div>
          )}
          {view.note && <p className={s.note} data-testid="impact-truncated">{view.note}</p>}
        </>
      )}
    </section>
  );
}
