'use client';

import React, { useEffect, useState } from 'react';
import { DiscoveryItem, fetchDiscovery } from '../lib/api/publicCampaigns';
import { PageHeader, Actions } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState } from '../components/States';
import { CampaignCard } from '../components/campaign/CampaignCard';
import { SkeletonCard } from '../components/loaders';
import s from './discovery.module.css';

/**
 * Descubrimiento público (`/campaigns`, P2; `GET /public/campaigns`): solo convocatorias `PUBLIC` y `OPEN` (las de
 * enlace privado nunca aparecen, DD-52). Paginación por cursor con "Cargar más" (`diseno-ux` §1.6). Estilo v2 (A-5):
 * la tarjeta compartida de A-2 (logo o inicial, "Verificada", barra si hay meta, cierre) y carga con esqueleto.
 */
export function DiscoveryScreen({ client = fetchDiscovery }: { client?: typeof fetchDiscovery }) {
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'more-error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async (after?: string) => {
    if (after) setLoadingMore(true); else setState('loading');
    const r = await client(after);
    setLoadingMore(false);
    if (r.kind === 'error') { setState(after ? 'more-error' : 'error'); return; }
    setItems((prev) => (after ? [...prev, ...r.items] : r.items));
    setCursor(r.nextCursor);
    setState('ready');
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  return (
    <div>
      <PageHeader title="Convocatorias abiertas" />
      {/* A-5: carga con el esqueleto de VS-1 (se detiene con "reducir movimiento") */}
      {state === 'loading' && (
        <div className={s.grid}>
          <SkeletonCard aria-label="Cargando convocatorias" />
          {/* Las otras dos solo dibujan: un único anuncio de carga */}
          <div aria-hidden="true"><SkeletonCard /></div>
          <div aria-hidden="true"><SkeletonCard /></div>
        </div>
      )}
      {state === 'error' && <ErrorState onRetry={() => void load()} />}
      {(state === 'ready' || state === 'more-error') && items.length === 0 && (
        <EmptyState text="No hay convocatorias abiertas en este momento." />
      )}
      {items.length > 0 && (
        <ul className={s.grid}>
          {items.map((c) => (
            <li key={c.publicCode} className={s.item} data-testid="discovery-item"><CampaignCard campaign={c} headingLevel={2} /></li>
          ))}
        </ul>
      )}
      {state === 'more-error' && <ErrorState text="No pudimos cargar más convocatorias." onRetry={() => void load(cursor)} />}
      {state === 'ready' && cursor && (
        <Actions><Button variant="secondary" sending={loadingMore} onClick={() => void load(cursor)}>Cargar más</Button></Actions>
      )}
    </div>
  );
}
