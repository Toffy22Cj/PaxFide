# paxfide-web

Frontend web de PaxFide (Next.js). Los documentos que rigen están en `Documentos/` (ADR-046 y su enmienda 1, los planes
de la fase 7 y `decisiones-delegadas-web-2026-10.md`).

## Levantar la web

Requisitos: Node 22 y pnpm 11.26.0.

```bash
pnpm install --frozen-lockfile
```

La web habla con el backend (`Toffy22Cj/Donaciones`) en otro origen. Para desarrollar:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1 pnpm dev
```

Para un build de producción:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1 pnpm build && pnpm start
```

Abre <http://localhost:3000>. El backend tiene que permitir ese origen (`TRACEABILITY_CORS_ALLOWED_ORIGINS`, ver
`Donaciones/Documentos/runbook-demo-local.md`).

## Qué pantallas están activas

Desde U-27 (`plan-fase7-puesta-al-dia.md`, Anexo 4), **`pnpm dev` y `pnpm build` activan las mismas pantallas que la
demo**: ya no hace falta `pnpm build:demo` para verlas (se conserva como alias). Hay **una sola lista**,
`src/lib/routing/enabled-surfaces.demo.json`.

| Variable | Efecto |
|---|---|
| sin `NEXT_PUBLIC_SURFACE_PROFILE`, o `=demo` | la lista única |
| `NEXT_PUBLIC_SURFACE_PROFILE=none` | ninguna pantalla: todo responde 404 (lo usan los tests de 404) |
| `NEXT_PUBLIC_E2E_SURFACES='[...]'` | solo en los tests: sustituye a lo anterior |

La lista **no es autorización** (ADR-046 D5): solo dice qué pantallas existen; lo que cada cuenta puede hacer lo decide
el backend. `/tracking/<lo-que-sea>` responde 404 en todos los builds (DW-01).

## Pruebas

```bash
bash scripts/ci-local.sh
```

Réplica local de `.github/workflows/ci.yml`: typecheck, Vitest, imports del servidor y los E2E de Playwright contra el
servidor falso (`scripts/fake-backend.js`). Deja la evidencia en `Documentos/evidencia-web/`.
