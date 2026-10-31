import surfaceList from './enabled-surfaces.demo.json';

/**
 * Lista de superficies habilitadas, leída en build (ADR-046 D5). **No es autorización**: solo dice qué puede
 * desplegarse. El código nunca la consulta para decidir qué puede hacer un usuario; eso lo decide el backend.
 *
 * U-27 (plan-fase7-puesta-al-dia.md Anexo 4; supera a DW-02 en un punto): **una sola lista**, la de
 * `enabled-surfaces.demo.json`. Cada entrada está justificada en `Documentos/decisiones-delegadas-web-2026-10.md`
 * (§2, habilitaciones). `/panel/prediction` sigue dentro, como en la demo (DW-38; decisión de Carlos del 2026-10-31).
 * - Sin perfil o con `NEXT_PUBLIC_SURFACE_PROFILE=demo`: esa lista (el build normal ya no responde 404 en todo).
 * - `NEXT_PUBLIC_SURFACE_PROFILE=none`: lista vacía (todo responde 404), para los tests de 404.
 * - Tests: `NEXT_PUBLIC_E2E_SURFACES` (JSON) sustituye a todo lo anterior.
 *
 * Las acciones transitorias se nombran `action:<nombre>`: deshabilitada ⇒ no se renderiza.
 */
function load(): Set<string> {
  const e2e = process.env.NEXT_PUBLIC_E2E_SURFACES;
  if (e2e !== undefined && e2e !== '') {
    return new Set<string>(JSON.parse(e2e));
  }
  if (e2e === '') return new Set<string>();
  if (process.env.NEXT_PUBLIC_SURFACE_PROFILE === 'none') return new Set<string>();
  return new Set<string>(surfaceList as string[]);
}

const enabled = load();

export function isSurfaceEnabled(surface: string): boolean {
  return enabled.has(surface);
}
