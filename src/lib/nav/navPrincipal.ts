// Ref: respuesta de Carlos al plan de VS-2 (cambio sobre GET /me, 2026-10-21); session.ts D-N1-3; DW-06.
import type { MeOutcome, Principal } from '../api/identity';

/**
 * Principal con el que se pinta la barra tras una lectura de `GET /me`. Si la lectura falla, se queda con lo último
 * conocido; si no hay nada, `null` (solo entradas que no dependen del rol, DW-06). Nunca autoriza nada.
 */
export function nextNavPrincipal(previous: Principal | null, outcome: MeOutcome): Principal | null {
  switch (outcome.kind) {
    case 'ok':
      return outcome.principal;
    case 'unavailable':
    case 'error':
    case 'unauthorized':
      return previous;
    default: {
      const unreachable: never = outcome;
      throw new Error(`Resultado de /me desconocido: ${JSON.stringify(unreachable)}`);
    }
  }
}
