# 13–16. Manejo de Errores, Mantenimiento, Deuda Técnica y Glosario

---

## 13. Manejo de Errores

### 13.1 Estrategia por Tipo de Operación
1. **Lecturas (`GET`)**:
   - Los clientes en `src/lib/api/` devuelven uniones discriminadas (`ok`, `forbidden`, `not-found`, `invalid-code`, `error`).
   - Las pantallas mapean cada variante a los componentes de [`src/components/States.tsx`](../../src/components/States.tsx) (`ForbiddenState`, `NotFoundState`, `ErrorState` con reintento manual, `EmptyState`).
2. **Comandos (`POST` vía `useCommand`)**:
   - `2xx` → `SUCCESS`.
   - `401` → `AUTH_ERROR`: ejecuta `handle401(isTrackingRoute)`, descarta el comando en memoria y vuelve a `IDLE` (y `RouteGuard` lleva a `/login`).
   - `4xx` distinto de `401` → `REJECTED`: extrae `ProblemDetail.title` y muestra el texto en español de [`messages.ts`](../../src/lib/api/messages.ts) (o fallback por código HTTP). Nunca muestra `ProblemDetail.detail`.
   - `>= 500` o fallo de red → `AMBIGUOUS`: registra el intento en [`ambiguousSession.ts`](../../src/lib/commands/ambiguousSession.ts), congela `Command-Id` y payload, y ofrece *"Reintentar"* (mismo `Command-Id`) o *"Cerrar"* (sin reenviar).
3. **Subidas binarias (`deliveryEvidence.ts`, `media.ts`)**:
   - Fallos tipados (`TooLarge`, `UnsupportedFormat`, `Removed` [410], `StorageUnavailable` [503], `Forbidden` [403], `Unauthorized` [401], `Failed`, `network`), traducidos a mensajes claros sin reintentos automáticos.
4. **Errores de configuración (`config.ts`, `assetClient.ts`)**:
   - `ApiBaseUrlMisconfiguredError` falla ruidosamente si falta `NEXT_PUBLIC_API_BASE_URL` o si comparte origen con la app.
5. **Política de logs**:
   - Por requisito de privacidad y secretos al portador (`ADR-041 §2.7`), la capa HTTP no escribe rutas, cabeceras ni cuerpos en `console.*`.

---

## 14. Mantenimiento y Extensibilidad

### 14.1 Cómo Agregar una Nueva Ruta o Pantalla
1. Agregar la superficie en [`src/lib/routing/enabled-surfaces.demo.json`](../../src/lib/routing/enabled-surfaces.demo.json) (y en `playwright.config.ts` / `playwright.capturas.config.ts` si aplica).
2. Clasificar la ruta en [`src/lib/routing/classifier.ts`](../../src/lib/routing/classifier.ts) (`PUBLIC`, `AUTH` o `AUTHENTICATED`).
3. Declarar su fondo y chrome en [`src/lib/routing/backgroundRoutes.ts`](../../src/lib/routing/backgroundRoutes.ts) y, si pertenece a la barra principal, en [`src/lib/nav/navEntries.ts`](../../src/lib/nav/navEntries.ts).
4. Crear la pantalla en `src/screens/<Nombre>Screen.tsx` con su módulo CSS y envoltorio delgado en `src/app/<ruta>/page.tsx`.
5. Añadir pruebas en `__tests__/` y `e2e/`, y verificar `pnpm typecheck`, `pnpm check:server` y `pnpm test`.

### 14.2 Cómo Agregar un Nuevo Comando o Endpoint
1. Definir tipos y constructor de petición en el cliente correspondiente de `src/lib/api/` usando `apiRequest` y `segment()`.
2. Si es un comando de mutación, consumirlo exclusivamente mediante `useCommand` (garantizando `Command-Id` y manejo `AMBIGUOUS`).
3. Registrar los nuevos `ProblemDetail.title` del backend en `BY_TITLE` dentro de [`src/lib/api/messages.ts`](../../src/lib/api/messages.ts).
4. Mantener `'use client'` en cualquier archivo que importe `http.ts` o `session.ts` para no romper `check-server-imports.js`.

### 14.3 Consideraciones para Evitar Regresiones
- **No agregar dependencias en `dependencies`** de `package.json` sin un ADR que modifique `ADR-046 D8`.
- **No usar punto flotante** para importes ni cantidades físicas: emplear siempre `money.ts` (`BigInt` / strings de unidades mínimas) y `quantity.ts`.
- **No guardar secretos en `localStorage` ni en query params**.
- **Verificar `prefers-reduced-motion`** en cualquier animación nueva o elemento Canvas.

---

## 15. Limitaciones y Deuda Técnica Verificada

| Prioridad | Hallazgo Comprobado en Código | Ubicación | Recomendación |
| :---: | :--- | :--- | :--- |
| **Alta** | **Duplicación del cliente HTTP y validación de origen en `assetClient.ts`**: `assetClient.ts` reimplementa `ApiBaseUrlMisconfiguredError`, validación de `sameOrigin` y `fetch` directo en lugar de reutilizar `apiRequest` y `getApiBase()` de `http.ts`/`config.ts`. | [`src/lib/api/assetClient.ts`](../../src/lib/api/assetClient.ts) | Refactorizar `fetchAsset()` para delegar en `apiRequest()` y eliminar la clase duplicada `ApiBaseUrlMisconfiguredError`. |
| **Alta** | **Ausencia de cabeceras de seguridad HTTP en `next.config.ts`**: `next.config.ts` no define `headers()` (`X-Content-Type-Options`, `Referrer-Policy`, `X-Robots-Tag`, `Content-Security-Policy`), delegándolo enteramente a la infraestructura externa. | [`next.config.ts`](../../next.config.ts) | Definir `headers()` en `next.config.ts` (o documentar la configuración exacta del proxy inverso en producción). |
| **Media** | **Asimetría de arquitectura en `assets/[assetRef]/page.tsx`**: Es la única ruta cuya lógica completa de pantalla vive en `src/app/` en lugar de `src/screens/AssetDetailScreen.tsx`. | [`src/app/assets/[assetRef]/page.tsx`](../../src/app/assets/%5BassetRef%5D/page.tsx) | Extraer el cuerpo a `src/screens/AssetDetailScreen.tsx` dejando `page.tsx` como envoltorio delgado. |
| **Media** | **Sin linter configurado en `package.json`**: `package.json` no incluye script `lint` ni configuración ESLint, dependiendo solo de `tsc --noEmit` y `check-server-imports.js`. | [`package.json`](../../package.json) | Evaluar la incorporación de ESLint o Biome en `devDependencies` para reglas de hooks y accesibilidad JSX. |
| **Baja** | **Avisos de tipo de módulo en Node/Vitest**: `scripts/check-server-imports.js` usa sintaxis ESM sin extensión `.mjs` ni `"type": "module"`, y `vitest.config.ts` emite advertencia de `configLoader: 'native'` en Vitest 5. | [`scripts/check-server-imports.js`](../../scripts/check-server-imports.js), [`vitest.config.ts`](../../vitest.config.ts) | Renombrar a `.mjs` o declarar `"type": "module"` cuando todos los scripts (`fake-backend.js`) sean compatibles. |
| **Baja** | **Sin recuperación automática de sesión tras recarga (limitación por diseño D2)**: Recargar la página limpia el JWT en RAM y exige volver a iniciar sesión. | [`src/lib/auth/session.ts`](../../src/lib/auth/session.ts) | Limitación intencional de seguridad (`ADR-046 D2`). Mantener documentada para usuarios y QA. |

---

## 16. Glosario Técnico

| Término | Definición en el Contexto de `paxfide-web` |
| :--- | :--- |
| **ADR-046** | Architecture Decision Record que rige el frontend web (`D1`–`D8` y Enmienda 1). |
| **AMBIGUOUS** | Estado de `useCommand` tras error de red o HTTP `>= 500`, donde no se sabe si el backend aplicó la mutación; congela `Command-Id` y payload para reintento manual. |
| **AnchorProof** | Prueba criptográfica de inclusión en un árbol de Merkle (`merkleRoot`, `leafIndex`, `path[]`, `transactionHash`, `network`, `anchoredAt`) verificable en el navegador vía SHA-256. |
| **AssetRef** | Referencia opaca de un lote o activo físico custodiado (`/assets/[assetRef]`). |
| **C1 (Sin BFF)** | Invariante arquitectónico que prohíbe que Next.js actúe como Backend-For-Frontend o reciba credenciales de sesión. |
| **Command-Id** | Identificador UUID v4 generado por intención en cliente y enviado en cabecera HTTP para garantizar idempotencia en el backend. |
| **DIVIPOLA** | Codificación oficial de departamentos y municipios de Colombia usada en perfiles organizacionales y zonas públicas de activos. |
| **EvidenceRef** | Referencia inmutable de una fotografía de entrega con formato `sha256:<64 hex>`. |
| **GIS** | Google Identity Services (`https://accounts.google.com/gsi/client`), única dependencia externa cargada perezosamente en cliente (`G-W2`). |
| **Intent-Token** | Secreto portador temporal para consultar el estado de una intención de donación pública. |
| **NIT (Módulo 11)** | Número de Identificación Tributaria colombiano de 9 dígitos más dígito de verificación validado en `profileModel.ts`. |
| **Principal** | Representación del usuario autenticado devuelta por `GET /me` (`accountId`, `organizationId`, `roles`, `platformAuthority`). Solo informativa para UI. |
| **ProblemDetail** | Respuesta de error estructurada RFC 7807 del backend; la web solo consume `title` y versiones legales pendientes. |
| **PublicCode** | Secreto portador de una convocatoria pública usado en `/c/[publicCode]`. |
| **Superficie** | Ruta, sección (`section:*`) o acción (`action:*`) controlada en tiempo de build por `enabled-surfaces.demo.json`. |
| **TrackingCode** | Credencial portadora de una donación enviada exclusivamente en `Authorization: Bearer <trackingCode>` desde `/tracking`. |
| **Unidades Mínimas** | Representación entera sin decimales de un importe monetario según el exponente ISO 4217 (ej. centavos). |
