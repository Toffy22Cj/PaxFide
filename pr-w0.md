## Tarea W-0: Web Scaffold

Este PR provee el andamio inicial del proyecto, configuraciones globales y dependencias.

### Decisiones del ADR que implementa
Implementa las siguientes decisiones documentadas en `ADR-042-frontend-web-paxfide-web.md`:
- D1: Uso de Next.js (App Router) en su versión 16.3.8 (release de seguridad).
- D3 y D4: Dependencias instaladas y fijadas usando pnpm 11.26.0 (pnpm-lock.yaml), con Node 22 (.nvmrc) y configuraciones base para TypeScript.
- Configuración inicial de E2E con Playwright y Unit Testing con Vitest.

### Archivos modificados/añadidos
- .github/workflows/ci.yml
- .npmrc
- .nvmrc
- AGENTS.md
- CLAUDE.md
- Documentos/ADR-042-frontend-web-paxfide-web.md
- Documentos/Promt-maestro-front-fase2.md
- Documentos/api-contract-matrix.md
- Documentos/contract-wiring-review.md
- Documentos/delta-front-fase2-rev3.md
- Documentos/diseno-ux-contractual-web-v1.md
- Documentos/front-fase2.md
- Documentos/hallazgos-front-fase2.md
- Documentos/implementation-plan-paxfide-web.md
- Documentos/plan-ejecucion-agentes-front-fase2-iter5.md
- Documentos/plan-ejecucion-agentes-front-fase2.md
- Documentos/reglas-equipo-y-agentes.md
- Documentos/sistema-visual-paxfide-web.md
- README.md
- hallazgos-front-fase2.md
- next.config.ts
- package.json
- playwright.config.ts
- pnpm-lock.yaml
- pnpm-workspace.yaml
- src/app/globals.css
- src/app/layout.tsx
- src/app/page.test.tsx
- src/app/page.tsx
- tsconfig.json
- vitest.config.ts
- vitest.setup.ts

### devDependencies extra (Justificación V-4)
Se añadieron estas 4 herramientas de desarrollo que no figuraban en la lista de W-0 original para que la suite de Vitest / Testing Library funcione correctamente:
- `@vitejs/plugin-react`: Requerido para procesar archivos JSX/TSX en el entorno de pruebas unitarias.
- `jsdom`: Proveedor del entorno simulado del DOM en Node (indispensable para montar componentes de React Testing Library).
- `@testing-library/jest-dom`: Ofrece *matchers* semánticos (ej. `toBeInTheDocument`) fundamentales para asertar estados en el DOM.
- `@types/node`: Necesaria para la tipificación estricta de globales de Node (ej. `process.env`).
