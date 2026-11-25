# 05–06. Arquitectura Modular, Patrones de Diseño e Inventario de Componentes

> Este documento resume la organización modular verificada en `src/` y los patrones de diseño reales del sistema.  
> Para la referencia detallada por archivo y función, consulte:
> - [`docs/modules/core-lib.md`](../modules/core-lib.md) (`src/lib/` — 55 archivos)
> - [`docs/modules/routes-and-screens.md`](../modules/routes-and-screens.md) (`src/app/` — 46 archivos y `src/screens/` — 32 archivos)
> - [`docs/modules/ui-and-canvas.md`](../modules/ui-and-canvas.md) (`src/components/` — 117 archivos)

---

## 1. Mapa de Módulos del Sistema (`src/`)

| Módulo / Directorio | Ruta Real | Archivos | Responsabilidad Principal | Dependencias Internas |
| :--- | :--- | :---: | :--- | :--- |
| **App Router y Shell Global** | [`src/app/`](../../src/app) | 46 | Puntos de entrada de las 26 rutas, `RootLayout`, `RouteGuard`, `globals.css`, `fonts.ts` + fuentes `.woff2`, `manifest.ts`, `not-found.tsx`. | `src/screens/*`, `src/components/shell/*`, `src/lib/routing/*`, `src/lib/auth/*`, `src/lib/theme/*`, `src/lib/nav/*` |
| **Controladores de Pantalla** | [`src/screens/`](../../src/screens) | 32 | 24 pantallas (`*Screen.tsx`) y 8 módulos CSS que orquestan lecturas, comandos idempotentes, formularios y composición visual. | `src/components/*`, `src/lib/api/*`, `src/lib/commands/*`, `src/lib/*` |
| **Primitivas UI** | [`src/components/ui/`](../../src/components/ui) | 6 | `Button`, `Field`, `Icons`, `Layout` (`PageHeader`, `Surface`, `DefinitionList`), `Modal`, `ui.module.css`. | Ninguna dependencia de dominio |
| **Shell y Navegación** | [`src/components/shell/`](../../src/components/shell), [`src/components/nav/`](../../src/components/nav) | 12 | `Shell`, `BrandMark`, `CityHud`, `PanelPortal`, `AppNav`, `NavPositionSheet`, iconos de barra. | `src/lib/nav/*`, `src/lib/routing/*`, `src/lib/auth/*`, `src/components/background/*` |
| **Motores Canvas 2D** | [`src/components/landing/`](../../src/components/landing), [`src/components/background/`](../../src/components/background), [`src/components/receipt/`](../../src/components/receipt) | 18 | Mundo isométrico de la landing (`WorldScene`, `WorldRenderer`), ciudad isométrica de fondo (`CityBackground`, `cityDraw`), generador de recibos PNG (`ReceiptCanvas.ts`). | `src/lib/receipt/*`, `src/lib/qr.ts`, `src/lib/money.ts` |
| **Componentes de Dominio** | [`src/components/`](../../src/components) (subcarpetas restantes) | 81 | Acceso (`access/`), cuenta (`account/`), activos (`asset/`), convocatorias (`campaign/`), gráficos (`charts/`), impacto (`impact/`), ubicación (`location/`), medios (`media/`), organización (`organization/`), panel (`panel/`), predicción (`prediction/`), seguimiento (`tracking/`), bienvenida (`welcome/`), loaders (`loaders/`), `States`, `QrCode`, `CommandFeedback`, `LocalDate`. | `src/lib/api/*`, `src/lib/commands/*`, `src/lib/tracking/*`, `src/components/ui/*` |
| **Clientes API y Transporte** | [`src/lib/api/`](../../src/lib/api) | 22 | Transporte `apiRequest` (`http.ts`), validación C1 (`config.ts`), SSR público (`publicServer.ts`), catálogo `ProblemDetail` (`messages.ts`), hook `useRead.ts` y 17 clientes/modelos de dominio. | `src/lib/auth/session.ts` |
| **Sesión y Tokens Efímeros** | [`src/lib/auth/`](../../src/lib/auth), [`src/lib/invitations/`](../../src/lib/invitations) | 6 | Máquina de sesión JWT en RAM (`session.ts`), hook `usePrincipal.ts`, fortaleza de contraseña (`passwordStrength.ts`), captura y borrado de `#token=` (`verificationToken.ts`, `resetToken.ts`, `invitations/token.ts`). | `react`, `src/lib/api/identity.ts` |
| **Comandos Idempotentes** | [`src/lib/commands/`](../../src/lib/commands) | 3 | Hook `useCommand.ts`, clasificador de estados HTTP (`classifier.ts`) y registro de comandos ambiguos en RAM (`ambiguousSession.ts`). | `src/lib/api/http.ts`, `src/lib/auth/session.ts` |
| **Enrutamiento y Superficies** | [`src/lib/routing/`](../../src/lib/routing) | 4 | Clasificador puro `classifyRoute` (`classifier.ts`), superficies habilitadas (`surfaces.ts`, `enabled-surfaces.demo.json`) y asignación de fondos/chrome (`backgroundRoutes.ts`). | Ninguna |
| **Modelos Puros y Utilidades** | [`src/lib/`](../../src/lib) (resto) | 20 | `money.ts`, `quantity.ts`, `qr.ts`, `labels.ts`, `campaignForm.ts`, `useLeaveWarning.ts`, `tracking/` (`merkle.ts`, `tree.ts`, `handoff.ts`), `organization/profileModel.ts`, `impact/impactModel.ts`, `receipt/receiptModel.ts`, `discovery/searchModel.ts`, `location/zoneLabel.ts`, `google/gis.ts`, `legal/versions.ts`, `nav/`, `theme/`, `welcome/`. | Solo tipos DTO cuando aplica |

---

## 2. Patrones de Diseño Verificados en el Código

### 2.1 External Store en Memoria con `useSyncExternalStore`
Empleado para evitar dependencias externas de gestión de estado (`ADR-046 D8`):
- **Sesión JWT ([`src/lib/auth/session.ts`](../../src/lib/auth/session.ts))**: mantiene `currentState`, `jwt`, `lastPrincipal`, `lastLogoutReason`, `postLoginDestination` y `logoutNavigationPending` en variables privadas de módulo. Los consumidores (como `RouteGuard` y `LandingScreen`) se suscriben vía `useSyncExternalStore(session.subscribe, session.getState, () => 'RESTORING')`.
- **Pausa de animaciones ([`src/components/background/animationPreference.ts`](../../src/components/background/animationPreference.ts))**: comparte el estado de pausa entre el botón de cabecera (`PauseButton`), `WorldScene` y `CityBackground`, persistiendo la preferencia no sensible en `localStorage` (`paxfide.city.paused`).

### 2.2 Comando Idempotente con Congelación de Intento (`useCommand`)
Implementado en [`src/lib/commands/useCommand.ts`](../../src/lib/commands/useCommand.ts):
- `execute(payload)` genera `id = crypto.randomUUID()`, construye `CommandRequest` y guarda ambos en `commandIdRef` y `requestRef`.
- Envía `POST` con cabecera `Command-Id: <id>`.
- Si el clasificador devuelve `AMBIGUOUS` (error de red o HTTP `>= 500`), registra el intento en [`ambiguousSession.ts`](../../src/lib/commands/ambiguousSession.ts) y conserva `commandIdRef` y `requestRef` intactos.
- `retry()` solo actúa desde estado `AMBIGUOUS` y reenvía exactamente el mismo `Command-Id` y cuerpo.
- `REJECTED` (HTTP `4xx` distinto de `401`) exige una nueva intención (`execute` con un nuevo UUID).

### 2.3 Purga Inmediata de Secretos en Fragmento URL (`#token=`)
Implementado en [`src/lib/auth/verificationToken.ts`](../../src/lib/auth/verificationToken.ts), [`src/lib/auth/resetToken.ts`](../../src/lib/auth/resetToken.ts) y [`src/lib/invitations/token.ts`](../../src/lib/invitations/token.ts):
- Los enlaces de correo entregan el token en el fragmento `#token=...` (nunca enviado al servidor HTTP).
- Al montar la vista, el token se lee a memoria de módulo y se elimina inmediatamente de la barra de direcciones mediante `window.history.replaceState(null, '', pathname + search)`.

### 2.4 Uniones Discriminadas para Outcomes de Red
Los clientes de lectura (`tracking.ts`, `campaignAdmin.ts`, `organization.ts`, `members.ts`, `account.ts`, `assetClient.ts`) devuelven uniones discriminadas (`kind: 'ok' | 'forbidden' | 'not-found' | 'invalid-code' | 'error'`) en lugar de lanzar excepciones no tipadas, mapeándose directamente a [`src/components/States.tsx`](../../src/components/States.tsx) (`LoadingState`, `ErrorState`, `ForbiddenState`, `NotFoundState`, `EmptyState`, `StatusNotice`).

### 2.5 Imágenes Privadas vía `Blob` + `ObjectURL` (`PrivateImage`)
Implementado en [`src/components/media/PrivateImage.tsx`](../../src/components/media/PrivateImage.tsx) y [`src/lib/api/media.ts`](../../src/lib/api/media.ts):
- Descarga imágenes protegidas con `fetch` + `Authorization: Bearer <jwt>`, `credentials: 'omit'` y `referrerPolicy: 'no-referrer'`.
- Crea un `URL.createObjectURL(blob)` local para `<img>` y lo revoca al desmontar el componente, evitando tokens en query strings o cookies.

### 2.6 Subida con Progreso vía `XMLHttpRequest`
En [`src/lib/api/deliveryEvidence.ts`](../../src/lib/api/deliveryEvidence.ts) y [`src/lib/api/media.ts`](../../src/lib/api/media.ts), las subidas binarias multipart/raw usan `XMLHttpRequest` únicamente para exponer `xhr.upload.onprogress`, respetando el mismo contrato de `Authorization: Bearer <jwt>` y cierre de sesión ante HTTP `401` (`handle401(false)`).
