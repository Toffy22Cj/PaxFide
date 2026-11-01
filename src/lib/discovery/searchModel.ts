// Ref: plan-fase7-puesta-al-dia.md Anexo 3, U-21 a U-26 (búsqueda, filtro y orden de convocatorias); ficha R-1 del
// backend (`referencia-api-v1.md` §5, nota del 2026-10-29). Lógica pura, sin DOM.
import type { DiscoveryParams } from '../api/publicCampaigns';

export const Q_MIN = 2;
export const Q_MAX = 100;

export type DonationTypeFilter = 'all' | 'MONETARY' | 'IN_KIND';
export type SortFilter = 'recent' | 'ending_soon';

export interface DiscoveryFilters {
  /** Texto tal como se buscó (ya recortado y válido), o '' sin búsqueda. */
  q: string;
  donationType: DonationTypeFilter;
  sort: SortFilter;
}

/** U-22: "Más recientes" por defecto. */
export const DEFAULT_FILTERS: DiscoveryFilters = { q: '', donationType: 'all', sort: 'recent' };

export type QueryCheck = { ok: true; value: string } | { ok: false; error: 'too-short' | 'too-long' };

/**
 * U-24: como el servidor, se recorta y se cuentan **puntos de código** (un emoji cuenta uno). Vacío = sin búsqueda
 * (`value: ''`), nunca un `q` vacío.
 */
export function checkQuery(raw: string): QueryCheck {
  const value = raw.trim();
  if (!value) return { ok: true, value: '' };
  const n = Array.from(value).length;
  if (n < Q_MIN) return { ok: false, error: 'too-short' };
  if (n > Q_MAX) return { ok: false, error: 'too-long' };
  return { ok: true, value };
}

export const QUERY_ERROR: Record<'too-short' | 'too-long', string> = {
  'too-short': `Escribe al menos ${Q_MIN} caracteres`,
  'too-long': `Escribe como máximo ${Q_MAX} caracteres`,
};

/** Parámetros de la petición (sin cursor): solo los que tienen valor. */
export function paramsOf(f: DiscoveryFilters): DiscoveryParams {
  return {
    ...(f.q ? { q: f.q } : {}),
    ...(f.donationType !== 'all' ? { donationType: f.donationType } : {}),
    sort: f.sort,
  };
}

/** U-25: un cursor solo vale con la misma combinación. */
export function filtersKey(f: DiscoveryFilters): string {
  return JSON.stringify([f.q, f.donationType, f.sort]);
}

const TIPO: Record<string, DonationTypeFilter> = { dinero: 'MONETARY', especie: 'IN_KIND' };
const ORDEN: Record<string, SortFilter> = { recientes: 'recent', cierran: 'ending_soon' };

/**
 * U-26: `?q=…&tipo=dinero|especie&orden=recientes|cierran`. Un parámetro inválido se ignora (nunca se reenvía). El
 * cursor nunca está en la URL.
 */
export function filtersFromSearch(search: string): DiscoveryFilters {
  const p = new URLSearchParams(search);
  const q = checkQuery(p.get('q') ?? '');
  return {
    q: q.ok ? q.value : '',
    donationType: TIPO[p.get('tipo') ?? ''] ?? 'all',
    sort: ORDEN[p.get('orden') ?? ''] ?? DEFAULT_FILTERS.sort,
  };
}

export function searchOf(f: DiscoveryFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.donationType !== 'all') p.set('tipo', f.donationType === 'MONETARY' ? 'dinero' : 'especie');
  if (f.sort !== DEFAULT_FILTERS.sort) p.set('orden', 'cierran');
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function hasFilters(f: DiscoveryFilters): boolean {
  return f.q !== '' || f.donationType !== 'all';
}
