import defaultSurfaces from './enabled-surfaces.json';
import demoSurfaces from './enabled-surfaces.demo.json';

/**
 * Lista de superficies habilitadas, leída en build (ADR-046 D5). **No es autorización**: solo dice qué puede
 * desplegarse. El código nunca la consulta para decidir qué puede hacer un usuario; eso lo decide el backend.
 *
 * - Build por defecto: `enabled-surfaces.json` (vacía: todo responde 404).
 * - Build de demo (`NEXT_PUBLIC_SURFACE_PROFILE=demo`): `enabled-surfaces.demo.json`. Cada entrada está
 *   justificada en `Documentos/decisiones-delegadas-web-2026-10.md` (§2, habilitaciones).
 * - Tests: `NEXT_PUBLIC_E2E_SURFACES` (JSON) sustituye a las dos.
 *
 * Las acciones transitorias se nombran `action:<nombre>`: deshabilitada ⇒ no se renderiza.
 */
function load(): Set<string> {
  const e2e = process.env.NEXT_PUBLIC_E2E_SURFACES;
  if (e2e !== undefined && e2e !== '') {
    return new Set<string>(JSON.parse(e2e));
  }
  if (e2e === '') return new Set<string>();
  if (process.env.NEXT_PUBLIC_SURFACE_PROFILE === 'demo') {
    return new Set<string>(demoSurfaces as string[]);
  }
  return new Set<string>(defaultSurfaces as string[]);
}

const enabled = load();

export function isSurfaceEnabled(surface: string): boolean {
  return enabled.has(surface);
}
