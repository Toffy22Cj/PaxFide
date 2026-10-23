// Ref: plan-fase7-pantallas.md A-4; prompts-agentes-estilo-v2.md VS-7 (un eventType desconocido rompe la compilación
// del mapeo: switch con never) y §3.1; referencia-api-v1.md §8 (TR-03).

/** Eventos públicos del historial de un activo (los de `labels.ts`). */
export const TRACKING_EVENTS = [
  'ASSET_REGISTERED', 'ASSET_DISPATCHED', 'ASSET_RECEIVED', 'ASSET_DELIVERED', 'ASSET_SPLIT',
  'ASSET_SPLIT_COMPENSATED', 'ASSET_CUSTODY_TRANSFERRED', 'ASSET_DEPLETED',
] as const;
export type TrackingEvent = (typeof TRACKING_EVENTS)[number];

export function asTrackingEvent(v: string): TrackingEvent | null {
  return (TRACKING_EVENTS as readonly string[]).includes(v) ? (v as TrackingEvent) : null;
}

/** Cómo se dibuja cada paso. Solo forma: el texto sale de `eventLabel()` y nunca comunica un color sin texto. */
export type StepKind = 'start' | 'moving' | 'arrived' | 'delivered' | 'split' | 'reverted' | 'custody' | 'closed';

export function stepKind(e: TrackingEvent): StepKind {
  switch (e) {
    case 'ASSET_REGISTERED': return 'start';
    case 'ASSET_DISPATCHED': return 'moving';
    case 'ASSET_RECEIVED': return 'arrived';
    case 'ASSET_DELIVERED': return 'delivered';
    case 'ASSET_SPLIT': return 'split';
    case 'ASSET_SPLIT_COMPENSATED': return 'reverted';
    case 'ASSET_CUSTODY_TRANSFERRED': return 'custody';
    case 'ASSET_DEPLETED': return 'closed';
    default: {
      const unreachable: never = e;
      throw new Error(`Evento de seguimiento sin dibujo: ${String(unreachable)}`);
    }
  }
}

/** El camión de VS-1 solo si el último evento del activo es un despacho: no se anima lo que no pasó (§3.1). */
export function showsTruck(events: readonly { eventType: string }[]): boolean {
  return events.length > 0 && events[events.length - 1].eventType === 'ASSET_DISPATCHED';
}

/** Texto para un paso o un bien sin zona pública (DF7-25). Nunca "en camino a X". */
export const NO_PUBLIC_ZONE = 'Sin zona pública';
