'use client';
// Ref: plan-fase7-puesta-al-dia.md Anexo 5, U-33; referencia-api-v1.md §3, nota del 2026-10-31: `GET /public/locations`
// devuelve el catálogo DIVIPOLA del DANE. La web nunca incluye el catálogo: lo pide al backend **una vez por sesión**
// y lo guarda en memoria. Un fallo no se guarda (se puede reintentar).
import { apiRequest } from './http';

export interface Municipality { code: string; name: string }
export interface Department { code: string; name: string; municipalities: Municipality[] }
export interface LocationCatalog { catalogVersion: string; departments: Department[] }

export type LocationsOutcome = { kind: 'ok'; catalog: LocationCatalog } | { kind: 'error' };

let cached: Promise<LocationsOutcome> | null = null;

function parse(data: unknown): LocationCatalog | null {
  const d = data as { catalogVersion?: unknown; departments?: unknown } | null;
  if (!d || typeof d.catalogVersion !== 'string' || !Array.isArray(d.departments)) return null;
  const departments: Department[] = [];
  for (const dep of d.departments as Record<string, unknown>[]) {
    if (!dep || typeof dep.code !== 'string' || typeof dep.name !== 'string' || !Array.isArray(dep.municipalities)) continue;
    departments.push({
      code: dep.code, name: dep.name,
      municipalities: (dep.municipalities as Record<string, unknown>[])
        .filter((m) => m && typeof m.code === 'string' && typeof m.name === 'string')
        .map((m) => ({ code: m.code as string, name: m.name as string })),
    });
  }
  return { catalogVersion: d.catalogVersion, departments };
}

export function fetchLocations(): Promise<LocationsOutcome> {
  if (!cached) {
    cached = apiRequest<unknown>({ path: '/public/locations', auth: 'none' }).then((r) => {
      const catalog = r.kind === 'ok' ? parse(r.data) : null;
      if (!catalog) { cached = null; return { kind: 'error' as const }; }
      return { kind: 'ok' as const, catalog };
    }, () => { cached = null; return { kind: 'error' as const }; });
  }
  return cached;
}

/** Solo para las pruebas. */
export function _resetLocationsForTest() { cached = null; }
