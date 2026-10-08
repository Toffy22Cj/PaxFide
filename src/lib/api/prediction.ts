'use client';

import { apiRequest } from './http';
import { segment } from './config';

/**
 * Predicción (P3), `GET /organizations/{organizationId}/campaigns/{campaignRef}/prediction` (`CampaignPredictionController`,
 * `develop` del backend `f5266c5`). Una sola estimación: la del tiempo transcurrido actual (D-03). Escalas del código:
 * `probabilityReachTarget` 0–1, `estimatedFinalPctOfTarget` fracción (1,05 = 105 %), `pctTimeElapsed` 0–1.
 */
export interface PredictionView {
  probability: number;
  estimatedFinal: number;
  pctTimeElapsed: number;
  modelVersion?: string;
  asOf?: string;
  /** Avisos del backend (siempre incluye el de datos sintéticos; p. ej. "fuera del rango de entrenamiento"). */
  warnings: string[];
}

export type PredictionOutcome =
  | { kind: 'ok'; view: PredictionView }
  /** `available: false` (p. ej. STRICT): sin cifra; se muestra el texto del backend tal cual. */
  | { kind: 'no-figure'; reason: string }
  | { kind: 'forbidden' }
  | { kind: 'error' };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parsePrediction(d: any): PredictionOutcome {
  if (!d || d.kind !== 'ESTIMATE' || typeof d.available !== 'boolean') return { kind: 'error' };
  if (!d.available) {
    return { kind: 'no-figure', reason: typeof d.unavailableText === 'string' ? d.unavailableText : 'Sin estimación para esta convocatoria.' };
  }
  const probability = num(d.probabilityReachTarget);
  const estimatedFinal = num(d.estimatedFinalPctOfTarget);
  const pctTimeElapsed = num(d.pctTimeElapsed);
  if (probability === null || estimatedFinal === null || pctTimeElapsed === null) return { kind: 'error' };
  const warnings = Array.isArray(d.warnings) ? d.warnings.filter((w: unknown): w is string => typeof w === 'string') : [];
  return {
    kind: 'ok',
    view: {
      probability, estimatedFinal, pctTimeElapsed, warnings,
      modelVersion: typeof d.modelVersion === 'string' ? d.modelVersion : undefined,
      asOf: typeof d.asOf === 'string' ? d.asOf : undefined,
    },
  };
}

export async function fetchPrediction(organizationId: string, campaignRef: string): Promise<PredictionOutcome> {
  const r = await apiRequest<unknown>({
    path: `/organizations/${segment(organizationId)}/campaigns/${segment(campaignRef)}/prediction`, auth: 'required',
  });
  if (r.kind === 'ok') return parsePrediction(r.data);
  if (r.kind === 'error' && r.status === 403) return { kind: 'forbidden' };
  return { kind: 'error' };
}

/**
 * Estimaciones históricas por corte (S-17, backend `d169dda`):
 * `GET /organizations/{organizationId}/campaigns/{campaignRef}/prediction/history`. Lo recaudado en cada corte se
 * reconstruye con el Event Store anterior al corte (`basis: "EVENT_STORE"`). Un corte sin cifra (`FUTURE_CUT`,
 * `CAMPAIGN_ENDED`, `CONFIGURATION_CHANGED_AFTER_CUT`, `TARGET_ALREADY_REACHED`) se muestra vacío con el texto del
 * backend; nunca se rellena. Escalas: fracciones (1,05 = 105 %).
 */
export interface PredictionCut {
  t: number;
  cutAt?: string;
  available: boolean;
  reason?: string;
  probability?: number;
  estimatedFinal?: number;
  /** Hecho reconstruido: lo recaudado en ese corte (también con `TARGET_ALREADY_REACHED`). */
  raisedAtCut?: number;
}

export type PredictionHistoryOutcome =
  | { kind: 'ok'; cuts: PredictionCut[]; warnings: string[]; asOf?: string }
  | { kind: 'no-figure'; reason: string }
  | { kind: 'forbidden' }
  | { kind: 'error' };

export function parsePredictionHistory(d: any): PredictionHistoryOutcome {
  if (!d || d.kind !== 'ESTIMATE' || typeof d.available !== 'boolean') return { kind: 'error' };
  if (!d.available) {
    return { kind: 'no-figure', reason: typeof d.unavailableText === 'string' ? d.unavailableText : 'Sin estimaciones por corte para esta convocatoria.' };
  }
  if (!Array.isArray(d.cuts)) return { kind: 'error' };
  const cuts: PredictionCut[] = d.cuts.filter((c: any) => c && num(c.t) !== null).map((c: any) => {
    const probability = num(c.probabilityReachTarget) ?? undefined;
    const estimatedFinal = num(c.estimatedFinalPctOfTarget) ?? undefined;
    // Un corte "disponible" sin las dos cifras no se dibuja: se trata como sin cifra en vez de inventarla
    const available = c.available === true && probability !== undefined && estimatedFinal !== undefined;
    return {
      t: c.t, available,
      cutAt: typeof c.cutAt === 'string' ? c.cutAt : undefined,
      reason: available ? undefined : (typeof c.unavailableText === 'string' ? c.unavailableText : 'Sin cifra en este corte.'),
      probability: available ? probability : undefined,
      estimatedFinal: available ? estimatedFinal : undefined,
      raisedAtCut: num(c.pctRaisedAtCut) ?? undefined,
    };
  }).sort((a: PredictionCut, b: PredictionCut) => a.t - b.t);
  const warnings = Array.isArray(d.warnings) ? d.warnings.filter((w: unknown): w is string => typeof w === 'string') : [];
  return { kind: 'ok', cuts, warnings, asOf: typeof d.asOf === 'string' ? d.asOf : undefined };
}

export async function fetchPredictionHistory(organizationId: string, campaignRef: string): Promise<PredictionHistoryOutcome> {
  const r = await apiRequest<unknown>({
    path: `/organizations/${segment(organizationId)}/campaigns/${segment(campaignRef)}/prediction/history`, auth: 'required',
  });
  if (r.kind === 'ok') return parsePredictionHistory(r.data);
  if (r.kind === 'error' && r.status === 403) return { kind: 'forbidden' };
  return { kind: 'error' };
}
