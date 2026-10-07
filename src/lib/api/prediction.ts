import type { PredictionCheckpoint } from '../../components/prediction/PredictionCharts';

/**
 * Predicción (P3; ADR-044 PROPUESTO). **El backend todavía no expone el endpoint (S-06)**: este cliente no llama a
 * nada y devuelve "no disponible". Cuando exista, aquí irá el adaptador de su respuesta a `PredictionCheckpoint`,
 * sin inventar campos. Nunca se fabrica una cifra (ni de ejemplo).
 */
export type PredictionOutcome =
  | { kind: 'ok'; checkpoints: PredictionCheckpoint[] }
  /** `targetPolicy = STRICT`: el backend no da cifra; se muestra su motivo tal cual. */
  | { kind: 'no-figure'; reason: string }
  | { kind: 'unavailable' }
  | { kind: 'forbidden' }
  | { kind: 'error' };

export async function fetchPrediction(_campaignRef: string): Promise<PredictionOutcome> {
  return { kind: 'unavailable' };
}
