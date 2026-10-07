'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { DiscoveryItem, fetchDiscovery } from '../lib/api/publicCampaigns';
import { formatMinorUnits, percentOf } from '../lib/money';
import { PageHeader, Actions, uiClasses as ui } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../components/States';

/**
 * Descubrimiento público (`/campaigns`, P2; `GET /public/campaigns`): solo convocatorias `PUBLIC` y `OPEN` (las de
 * enlace privado nunca aparecen, DD-52). Paginación por cursor con "Cargar más" (`diseno-ux` §1.6).
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
      {state === 'loading' && <LoadingState />}
      {state === 'error' && <ErrorState onRetry={() => void load()} />}
      {(state === 'ready' || state === 'more-error') && items.length === 0 && (
        <EmptyState text="No hay convocatorias abiertas en este momento." />
      )}
      {items.length > 0 && (
        <ul className={ui.list}>
          {items.map((c) => {
            const pct = c.targetAmount ? percentOf(c.clearedAmount ?? '0', c.targetAmount) : null;
            return (
              <li key={c.publicCode} className={ui.surface} style={{ marginBottom: 0 }} data-testid="discovery-item">
                {c.organizationName && <p className={ui.hint} style={{ margin: 0 }}>{c.organizationName}</p>}
                <h2 className={ui.sectionTitle} style={{ marginBottom: 8 }}>
                  <Link href={`/c/${encodeURIComponent(c.publicCode)}`}>{c.title}</Link>
                </h2>
                {c.currency && c.targetAmount && (
                  <p style={{ margin: 0 }}>
                    {formatMinorUnits(c.clearedAmount ?? '0', c.currency)} de {formatMinorUnits(c.targetAmount, c.currency)}
                    {pct !== null ? ` (${pct} %)` : ''}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {state === 'more-error' && <ErrorState text="No pudimos cargar más convocatorias." onRetry={() => void load(cursor)} />}
      {state === 'ready' && cursor && (
        <Actions><Button variant="secondary" sending={loadingMore} onClick={() => void load(cursor)}>Cargar más</Button></Actions>
      )}
    </div>
  );
}
