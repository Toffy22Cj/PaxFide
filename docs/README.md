# Documento Maestro de Documentación Técnica — `paxfide-web`

> **Proyecto:** `paxfide-web` (`v0.1.0`)  
> **Tipo:** Aplicación Web Frontend (Next.js 16.3.8 App Router + React 19.2.8 + TypeScript 5 strict)  
> **Backend Par:** API REST `/api/v1` (`Donaciones` — Spring Boot / EventStore / MongoDB / Blockchain Sepolia & Polygon Amoy)  
> **Gobernanza Arquitectónica:** [`Documentos/ADR-046-frontend-web-paxfide-web.md`](../Documentos/ADR-046-frontend-web-paxfide-web.md), [`Documentos/ADR-046-enmienda-1-alcance-web.md`](../Documentos/ADR-046-enmienda-1-alcance-web.md), [`Documentos/api-contract-matrix.md`](../Documentos/api-contract-matrix.md)

---

## 1. Propósito de este Documento Maestro

Este documento centraliza la documentación técnica verificada contra el código fuente real de **`paxfide-web`**. Cada ruta, símbolo, tipo, endpoint, variable de entorno, regla de negocio y diagrama referenciado en esta suite fue inspeccionado directamente en el repositorio actual, diferenciando explícitamente **hechos comprobados en código**, **inferencias arquitectónicas** y **recomendaciones técnicas**.

### Métricas Reales del Repositorio

| Dimensión | Cantidad Verificada | Ruta Base |
| :--- | :---: | :--- |
| Enrutamiento App Router (`src/app/`) | 46 archivos | [`src/app/`](../src/app) |
| Controladores de Pantalla (`src/screens/`) | 32 archivos (24 pantallas + 8 módulos CSS) | [`src/screens/`](../src/screens) |
| Componentes UI y Motores Canvas (`src/components/`) | 117 archivos | [`src/components/`](../src/components) |
| Núcleo de Dominio e Infraestructura (`src/lib/`) | 55 archivos | [`src/lib/`](../src/lib) |
| Suites Unitarias y de Componentes (Vitest) | 73 archivos | [`__tests__/`](../__tests__) |
| Especificaciones End-to-End (Playwright) | 45 archivos | [`e2e/`](../e2e) |
| Especificaciones de Captura Visual | 21 archivos | [`capturas/`](../capturas) |
| Ensayo Conjunto contra Backend Real | 2 archivos | [`ensayo/`](../ensayo) |
| Scripts de Infraestructura y CI | 5 archivos | [`scripts/`](../scripts) |
| Superficies Habilitadas (`enabled-surfaces.demo.json`) | 61 entradas (26 rutas, 1 sección, 34 acciones) | [`src/lib/routing/enabled-surfaces.demo.json`](../src/lib/routing/enabled-surfaces.demo.json) |
| Dependencias de Runtime (`package.json`) | 3 (`next`, `react`, `react-dom`) | [`package.json`](../package.json) |

---

## 2. Mapa de Navegación (Cobertura de las 16 Secciones)

| Secciones | Documento | Contenido Principal |
| :--- | :--- | :--- |
| **01–04** | [`docs/architecture/overview.md`](./architecture/overview.md) | Introducción, tecnologías y herramientas, arquitectura C1/ADR-046 D1–D8, árbol de directorios y convenciones. |
| **05–06** | [`docs/architecture/components.md`](./architecture/components.md) | Mapa de módulos, matriz de responsabilidades y patrones de diseño verificados en código. |
| **07** | [`docs/architecture/diagrams.md`](./architecture/diagrams.md) | Diagramas Mermaid de contexto, capas, máquinas de estados, secuencias y modelo entidad-relación. |
| **05–06 (Detalle)** | [`docs/modules/core-lib.md`](./modules/core-lib.md) | Documentación detallada de los 55 archivos de `src/lib/` (HTTP, auth, comandos, Merkle, QR, dinero, NIT). |
| **05–07 (Detalle)** | [`docs/modules/routes-and-screens.md`](./modules/routes-and-screens.md) | Catálogo de las 26 rutas App Router, 24 pantallas y reconstrucción paso a paso de los flujos de negocio. |
| **06 (Detalle)** | [`docs/modules/ui-and-canvas.md`](./modules/ui-and-canvas.md) | Biblioteca de componentes UI, navegación adaptable y motores Canvas 2D (`WorldRenderer`, `CityBackground`, `ReceiptCanvas`). |
| **08** | [`docs/database/data-model.md`](./database/data-model.md) | Modelo de datos de proyecciones CQRS/DTOs, restricciones, reglas de integridad y estrategia de almacenamiento en navegador. |
| **09** | [`docs/api/endpoints.md`](./api/endpoints.md) | Catálogo completo de endpoints REST `/api/v1`, encabezados, contratos, errores `ProblemDetail` e integraciones externas. |
| **10** | [`docs/security/security.md`](./security/security.md) | Autenticación JWT en memoria, autorización en backend, secretos portadores, frontera C1, `PrivateImage` y riesgos. |
| **11** | [`docs/deployment/installation.md`](./deployment/installation.md) | Requisitos previos, variables de entorno, instalación, ejecución con `fake-backend.js`, builds y despliegue. |
| **12** | [`docs/testing/testing.md`](./testing/testing.md) | Estrategia de pruebas (Vitest, Playwright E2E, capturas visuales, ensayo real y `ci-local.sh`). |
| **13–16** | [`docs/maintenance/technical-debt.md`](./maintenance/technical-debt.md) | Manejo de errores, guía de mantenimiento/extensibilidad, limitaciones, deuda técnica priorizada y glosario técnico. |

---

## 3. Guía Rápida por Perfil de Ingeniería

- **Nuevo desarrollador frontend**: comienza por [`overview.md`](./architecture/overview.md) → [`installation.md`](./deployment/installation.md) → [`routes-and-screens.md`](./modules/routes-and-screens.md).
- **Arquitecto / Revisor de seguridad**: revisa [`diagrams.md`](./architecture/diagrams.md) → [`security.md`](./security/security.md) → [`technical-debt.md`](./maintenance/technical-debt.md).
- **Desarrollador backend / Integrador de contratos**: consulta [`endpoints.md`](./api/endpoints.md) → [`data-model.md`](./database/data-model.md) → [`core-lib.md`](./modules/core-lib.md).
- **QA / Automatización**: consulta [`testing.md`](./testing/testing.md) y [`scripts/ci-local.sh`](../scripts/ci-local.sh).

---

## 4. Invariantes No Negociables del Sistema (`ADR-046`)

1. **Sin BFF (C1)**: El servidor Next.js nunca recibe JWT ni actúa como proxy de negocio. `NEXT_PUBLIC_API_BASE_URL` debe apuntar a un origen distinto al de la web ([`src/lib/api/config.ts`](../src/lib/api/config.ts)), verificado estáticamente por [`scripts/check-server-imports.js`](../scripts/check-server-imports.js).
2. **Sesión JWT exclusivamente en RAM (D2)**: [`src/lib/auth/session.ts`](../src/lib/auth/session.ts) mantiene el token en una variable de módulo privada. Ningún secreto portador (`jwt`, `trackingCode`, `statusToken`, tokens de `#token=`) se persiste en `localStorage`, `sessionStorage` ni `cookies`.
3. **Comandos idempotentes sin Outbox (D6)**: Toda mutación de comando viaja mediante [`useCommand`](../src/lib/commands/useCommand.ts) con cabecera `Command-Id` (UUID v4 por intención). Ante error `5xx` o de red (`AMBIGUOUS`), se congela el `Command-Id` y payload para reintento manual; nunca hay reintento automático.
4. **Cero dependencias extra en runtime (D8)**: Solo `next`, `react` y `react-dom` en `dependencies`. El codificador QR (`qr.ts`), verificador Merkle (`merkle.ts`), aritmética monetaria ISO 4217 (`money.ts`), validador NIT DIAN (`profileModel.ts`) y motores Canvas 2D son 100 % propios. La única excepción externa perezosa es Google Identity Services (`G-W2`, [`src/lib/google/gis.ts`](../src/lib/google/gis.ts)).
