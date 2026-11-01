'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DiscoveryItem, fetchDiscovery } from '../lib/api/publicCampaigns';
import {
  checkQuery, DEFAULT_FILTERS, filtersFromSearch, filtersKey, hasFilters, paramsOf, QUERY_ERROR, searchOf,
  type DiscoveryFilters, type DonationTypeFilter, type SortFilter,
} from '../lib/discovery/searchModel';
import { donationTypeLabel } from '../lib/labels';
import { PageHeader, Actions } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState } from '../components/States';
import { CampaignCard } from '../components/campaign/CampaignCard';
import { SkeletonCard } from '../components/loaders';
import s from './discovery.module.css';

/**
 * Descubrimiento público (`/campaigns`, P2; `GET /public/campaigns`): solo convocatorias `PUBLIC` y `OPEN` (las de
 * enlace privado nunca aparecen, DD-52). Paginación por cursor con "Cargar más" (`diseno-ux` §1.6). Estilo v2 (A-5).
 * plan-fase7-puesta-al-dia.md Anexo 3 (P-12): búsqueda por nombre, filtro por tipo de donación y orden (U-21), "Más
 * recientes" por defecto (U-22), validación como el servidor (U-24), cursor por combinación (U-25) y filtros en la URL
 * con `replace` (U-26). Las categorías "por causa" del boceto no tienen contrato y no se implementan (A3.2).
 */
const TYPES: DonationTypeFilter[] = ['all', 'MONETARY', 'IN_KIND'];
const typeLabel = (t: DonationTypeFilter) => (t === 'all' ? 'Todas' : donationTypeLabel(t));

type Phase = 'loading' | 'ready' | 'error' | 'more-error';

export function DiscoveryScreen({ client = fetchDiscovery }: { client?: typeof fetchDiscovery }) {
  const router = useRouter();
  const id = useId();
  const [filters, setFilters] = useState<DiscoveryFilters | null>(null);
  const [draft, setDraft] = useState('');
  const [queryError, setQueryError] = useState<string | null>(null);
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [restarted, setRestarted] = useState(false);
  /** Combinación vigente: una respuesta de otra se descarta (U-25). */
  const current = useRef<string>('');

  // U-26: los filtros salen de la URL al llegar (uno inválido se ignora); la URL nunca lleva el cursor
  useEffect(() => {
    const f = filtersFromSearch(window.location.search);
    setDraft(f.q);
    setFilters(f);
  }, []);

  const loadFirst = async (f: DiscoveryFilters, notice = false) => {
    const key = filtersKey(f);
    current.current = key;
    setPhase('loading');
    setItems([]);
    setCursor(undefined);
    setRestarted(notice);
    const r = await client(paramsOf(f));
    if (current.current !== key) return;
    if (r.kind !== 'ok') { setPhase('error'); return; }
    setItems(r.items);
    setCursor(r.nextCursor);
    setPhase('ready');
  };

  const loadMore = async () => {
    if (!filters || !cursor) return;
    const key = filtersKey(filters);
    setLoadingMore(true);
    const r = await client({ ...paramsOf(filters), cursor });
    setLoadingMore(false);
    if (current.current !== key) return;
    // U-25: un 400 con cursor no se distingue del resto (A3.1): se reinicia la lista una vez, sin cursor
    if (r.kind === 'bad-request') { void loadFirst(filters, true); return; }
    if (r.kind === 'error') { setPhase('more-error'); return; }
    setItems((prev) => [...prev, ...r.items]);
    setCursor(r.nextCursor);
    setPhase('ready');
  };

  // Cada combinación nueva empieza sin cursor y queda en la URL con replace (sin pasos de "atrás")
  useEffect(() => {
    if (!filters) return;
    const search = searchOf(filters);
    if (window.location.search !== search) router.replace(`/campaigns${search}`, { scroll: false });
    void loadFirst(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters && filtersKey(filters)]);

  const apply = (next: Partial<DiscoveryFilters>) => setFilters((f) => ({ ...(f ?? DEFAULT_FILTERS), ...next }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = checkQuery(draft);
    if (!c.ok) { setQueryError(QUERY_ERROR[c.error]); return; }
    setQueryError(null);
    setDraft(c.value);
    apply({ q: c.value });
  };

  const clear = () => { setDraft(''); setQueryError(null); setFilters({ ...DEFAULT_FILTERS, sort: filters?.sort ?? DEFAULT_FILTERS.sort }); };

  const f = filters ?? DEFAULT_FILTERS;
  return (
    <div>
      <PageHeader title="Convocatorias abiertas" />
      <div className={s.controls}>
        <form role="search" className={s.search} onSubmit={submit} noValidate aria-label="Buscar convocatorias">
          <label htmlFor={`${id}-q`} className={s.label}>Buscar por nombre</label>
          <div className={s.searchRow}>
            <input id={`${id}-q`} type="search" className={s.input} value={draft} autoComplete="off"
              onChange={(e) => { setDraft(e.target.value); setQueryError(null); }}
              aria-invalid={queryError ? true : undefined} aria-describedby={queryError ? `${id}-qe` : undefined} />
            <Button type="submit" variant="secondary">Buscar</Button>
          </div>
          {queryError && <span id={`${id}-qe`} className={s.error} data-testid="discovery-query-error">{queryError}</span>}
        </form>
        <div className={s.filters}>
          <div className={s.pills} role="group" aria-label="Tipo de donación">
            {TYPES.map((t) => (
              <button key={t} type="button" className={s.pill} aria-pressed={f.donationType === t}
                onClick={() => apply({ donationType: t })}>{typeLabel(t)}</button>
            ))}
          </div>
          <label className={s.sortLabel}>
            <span>Ordenar</span>
            <select className={s.select} value={f.sort} onChange={(e) => apply({ sort: e.target.value as SortFilter })}>
              <option value="recent">Más recientes</option>
              <option value="ending_soon">Cierran pronto</option>
            </select>
          </label>
        </div>
      </div>

      {restarted && phase === 'ready' && <p className={s.notice} role="status" data-testid="discovery-restarted">La lista se actualizó</p>}
      {/* A-5: carga con el esqueleto de VS-1 (se detiene con "reducir movimiento") */}
      {phase === 'loading' && (
        <div className={s.grid}>
          <SkeletonCard aria-label="Cargando convocatorias" />
          {/* Las otras dos solo dibujan: un único anuncio de carga */}
          <div aria-hidden="true"><SkeletonCard /></div>
          <div aria-hidden="true"><SkeletonCard /></div>
        </div>
      )}
      {phase === 'error' && <ErrorState onRetry={() => void loadFirst(f)} />}
      {(phase === 'ready' || phase === 'more-error') && items.length === 0 && (
        hasFilters(f) ? (
          <div className={s.empty} data-testid="discovery-no-results">
            <EmptyState text="No encontramos convocatorias con esa búsqueda." />
            <Actions><Button variant="secondary" onClick={clear}>Quitar filtros</Button></Actions>
          </div>
        ) : (
          <EmptyState text="No hay convocatorias abiertas en este momento." />
        )
      )}
      {items.length > 0 && phase !== 'loading' && (
        <ul className={s.grid}>
          {items.map((c) => (
            <li key={c.publicCode} className={s.item} data-testid="discovery-item"><CampaignCard campaign={c} headingLevel={2} /></li>
          ))}
        </ul>
      )}
      {phase === 'more-error' && <ErrorState text="No pudimos cargar más convocatorias." onRetry={() => void loadMore()} />}
      {phase === 'ready' && cursor && (
        <Actions><Button variant="secondary" sending={loadingMore} onClick={() => void loadMore()}>Cargar más</Button></Actions>
      )}
    </div>
  );
}
