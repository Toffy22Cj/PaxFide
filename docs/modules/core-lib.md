# 05–06. Documentación Detallada del Núcleo (`src/lib/`)

> **Directorio:** [`src/lib/`](../../src/lib) — **55 archivos TypeScript**  
> **Principio rector (`ADR-046 D8`):** Lógica de dominio, transporte, criptografía y presentación sin dependencias externas adicionales en tiempo de ejecución.

---

## 1. Transporte HTTP y Clientes API (`src/lib/api/` — 22 archivos)

| Archivo | Responsabilidad Principal | Símbolos Clave |
| :--- | :--- | :--- |
| [`config.ts`](../../src/lib/api/config.ts) | Valida la frontera C1 (`NEXT_PUBLIC_API_BASE_URL` presente y de distinto `origin` que `window.location.origin`) y codifica segmentos URL. | `ApiBaseUrlMisconfiguredError`, `getApiBase()`, `segment()` |
| [`http.ts`](../../src/lib/api/http.ts) | Cliente HTTP único (`fetch` con `cache: 'no-store'`, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`). Adjunta JWT según `AuthMode` (`'required' \| 'optional' \| 'none'`), dispara `handle401(false)` si 401 con JWT y extrae solo `title`, `pendingTermsVersion`, `pendingDataPolicyVersion` del `ProblemDetail`. | `apiRequest<T>()`, `AuthMode`, `ApiRequest`, `ProblemInfo`, `ApiResult<T>` |
| [`messages.ts`](../../src/lib/api/messages.ts) | Catálogo de mensajes de rechazo en español por `ProblemDetail.title` (70+ reglas mapeadas) y fallback por código HTTP (`400`, `403`, `404`, `409`). Nunca expone `detail` crudo del backend. | `rejectionMessage(status, problem)` |
| [`useRead.ts`](../../src/lib/api/useRead.ts) | Hook reutilizable para lecturas asíncronas con control de ciclo de vida y recarga manual. | `useRead` |
| [`publicServer.ts`](../../src/lib/api/publicServer.ts) | **Único cliente de servidor** (SSR de `/c/[publicCode]`). Lee `API_INTERNAL_BASE_URL \|\| NEXT_PUBLIC_API_BASE_URL` sin credenciales ni logs. | `fetchPublicCampaignOnServer(publicCode)` |
| [`publicCampaignModel.ts`](../../src/lib/api/publicCampaignModel.ts) | Parser y modelo tipado de convocatoria pública (`parsePublicCampaign`, `PublicCampaignOutcome`). | `parsePublicCampaign()`, `PublicCampaign` |
| [`publicCampaigns.ts`](../../src/lib/api/publicCampaigns.ts) | Lecturas públicas de descubrimiento (`/public/campaigns`), detalle (`/public/campaigns/{code}`), narrativa (`/public/campaigns/{code}/narrative`), creación de intención (`/public/campaigns/{code}/donation-intents`) y consulta de intención (`/public/donation-intents/{id}`). | `fetchDiscovery()`, `fetchPublicCampaign()`, `donateCommand()`, `fetchDonationIntent()`, `fetchPublicNarrative()` |
| [`tracking.ts`](../../src/lib/api/tracking.ts) | Seguimiento público por `Authorization: Bearer <trackingCode>` (`auth: 'none'`). Consume `/donations/tracking`, `/donations/tracking/narrative`, `/donations/tracking/assets/{ref}/history` y `/donations/tracking/integrity`. | `fetchTracking()`, `fetchNarrative()`, `fetchAssetHistory()`, `fetchIntegrity()`, `parseAnchorProof()`, `parseTransition()` |
| [`identity.ts`](../../src/lib/api/identity.ts) | Autenticación y principal: `/auth/login`, `/auth/google`, `/auth/register`, `/auth/google/register` y `GET /me`. | `login()`, `loginWithGoogle()`, `register()`, `registerWithGoogle()`, `fetchMe()`, `Principal` |
| [`account.ts`](../../src/lib/api/account.ts) | Gestión de cuenta del donante: `/account`, `/account/donations`, `/account/profile` (`GET`/`PUT`), `/account/password`, `/account/deactivate`, `/account/google/link` (`POST`/`DELETE`), `/account/impact`, `/auth/password-reset*`, `/auth/email-verification*`. | `fetchAccountDonations()`, `fetchAccount()`, `changePassword()`, `deactivateAccount()`, `linkGoogle()`, `unlinkGoogle()`, `fetchImpact()`, `requestPasswordReset()`, `confirmPasswordReset()` |
| [`organization.ts`](../../src/lib/api/organization.ts) | Operación organizacional y plataforma: `/organizations`, `/organizations/{id}`, `/organizations/{id}/profile`, `/organizations/{id}/verification/resubmit`, `/organizations/{id}/funds`, `/organizations/{id}/physical-assets`, `/funds/{id}/allocations*`, `/platform/organizations*`, `/platform/administrators*`, `/platform/accounts/{id}/reactivate`. | `fetchOrgFunds()`, `fetchOrgAssets()`, `createOrganizationCommand()`, `updateOrganizationProfile()`, `fetchPlatformOrganizations()` |
| [`campaignAdmin.ts`](../../src/lib/api/campaignAdmin.ts) | Administración de convocatorias: crear, listar, listar miembros, designar administradores, asignar empleados, retirar responsables y cerrar convocatoria. | `createCampaignCommand()`, `fetchOrgCampaigns()`, `fetchOrgMembers()`, `closeCampaignCommand()` |
| [`configuration.ts`](../../src/lib/api/configuration.ts) | Configuración de convocatorias y solicitudes de cambio con aprobación (ADR-037 Enmienda 4): `/campaigns/{ref}/configuration`, `/campaigns/{ref}/configuration-change-requests*`. | `fetchChangeRequests()`, `editConfigurationCommand()`, `requestConfigurationChangeCommand()`, `decideConfigurationChangeCommand()` |
| [`members.ts`](../../src/lib/api/members.ts) | Gestión de miembros e invitaciones: listar/crear/revocar invitaciones, cambiar rol, retirar miembro, aceptar invitación (`/invitations/accept`) y `/me/campaigns`. | `fetchInvitations()`, `inviteMemberCommand()`, `acceptInvitation()`, `fetchMyCampaigns()` |
| [`assetClient.ts`](../../src/lib/api/assetClient.ts) | Lectura operativa de activo físico `GET /physical-assets/{assetRef}` con validación propia de origen C1 y manejo `401`/`403`/`404`. | `fetchAsset()`, `PhysicalAssetOperationalReadModel`, `LifecycleStatus` |
| [`assetCommands.ts`](../../src/lib/api/assetCommands.ts) | Constructores de comandos de activos: `/physical-assets/register`, `/physical-assets/from-donation`, `/{ref}/split`, `/{ref}/dispatch`, `/{ref}/receive`, `/{ref}/deliver` y consulta de estado de división `/{parent}/splits/{child}`. | `splitCommand()`, `dispatchCommand()`, `receiveCommand()`, `deliverCommand()`, `registerAssetCommand()`, `fetchSplitStatus()` |
| [`deliveryEvidence.ts`](../../src/lib/api/deliveryEvidence.ts) | Subida de foto de entrega (`POST /organizations/{id}/delivery-evidence`) vía `XMLHttpRequest` con progreso; valida JPEG/PNG <= 5 MB y formato `sha256:[0-9a-f]{64}`. | `uploadDeliveryEvidence()`, `checkEvidenceFile()`, `evidenceErrorText()`, `EVIDENCE_REF` |
| [`stepEvidence.ts`](../../src/lib/api/stepEvidence.ts) | Fotos de pasos intermedios y publicación de copia censurada: `/physical-assets/{ref}/evidence/steps` y publicación (`PUT`/`DELETE`). | `fetchStepPhotos()`, `fetchDeliveryPublication()`, `setDeliveryPublication()` |
| [`media.ts`](../../src/lib/api/media.ts) | Subida/eliminación de logo de organización y portada de convocatoria (`XHR` con progreso), descarga autenticada de imágenes privadas (`fetchPrivateImage`) y retiro administrativo (`/platform/organizations/{id}/media/remove`). | `fetchPrivateImage()`, `privateApiUrl()`, `removePlatformMedia()` |
| [`panelData.ts`](../../src/lib/api/panelData.ts) | Series mensuales de fondos (`/funds/monthly`), integridad organizacional (`/integrity`) y feed de actividad (`/activity`). | `fetchMonthlyFunds()`, `fetchOrgIntegrity()`, `fetchOrgActivity()` |
| [`prediction.ts`](../../src/lib/api/prediction.ts) | Predicción de cumplimiento de metas e historial (`/organizations/{id}/campaigns/{ref}/prediction*`). | `fetchPrediction()`, `fetchPredictionHistory()` |
| [`locations.ts`](../../src/lib/api/locations.ts) | Catálogo público DIVIPOLA (`GET /public/locations`) con caché en memoria por pestaña. | `fetchLocations()` |

---

## 2. Sesión, Identidad y Tokens Efímeros (`src/lib/auth/` y `src/lib/invitations/` — 6 archivos)

- **[`src/lib/auth/session.ts`](../../src/lib/auth/session.ts)**: Store en memoria con `MachineState` (`'RESTORING' | 'LOGGED_OUT' | 'AUTHENTICATED'`) y `LogoutReason` (`'MANUAL' | 'EXPIRED' | 'OTHER_TAB' | 'PASSWORD_CHANGED' | 'DEACTIVATED'`). Sincroniza cierres entre pestañas mediante `BroadcastChannel('paxfide_logout_signal')`. Expone `login`, `logout`, `logoutWith`, `replaceToken`, `handle401`, `getJwt`, `setLastPrincipal`/`getLastPrincipal`, `setPostLoginDestination`/`consumePostLoginDestination`, `isLogoutNavigationPending`/`clearLogoutNavigation` y `setLoginNotice`/`peekLoginNotice`/`clearLoginNotice`.
- **[`src/lib/auth/usePrincipal.ts`](../../src/lib/auth/usePrincipal.ts)**: Hook que consulta `GET /me`, cachea en `session.setLastPrincipal` para evitar parpadeos entre navegaciones y nunca sustituye la autorización del backend.
- **[`src/lib/auth/passwordStrength.ts`](../../src/lib/auth/passwordStrength.ts)**: Evaluación local de fortaleza de contraseña para registro, recuperación y cambio de contraseña.
- **[`src/lib/auth/verificationToken.ts`](../../src/lib/auth/verificationToken.ts)**, **[`src/lib/auth/resetToken.ts`](../../src/lib/auth/resetToken.ts)** y **[`src/lib/invitations/token.ts`](../../src/lib/invitations/token.ts)**: Capturan `#token=...` de `window.location.hash` en memoria y borran inmediatamente el fragmento con `history.replaceState`.

---

## 3. Motor de Comandos Idempotentes (`src/lib/commands/` — 3 archivos)

- **[`useCommand.ts`](../../src/lib/commands/useCommand.ts)**: Hook `useCommand<TRes>(builder, isTrackingRoute?)` con estados `'IDLE' | 'SENDING' | 'REJECTED' | 'AMBIGUOUS' | 'SUCCESS'`. Envía cabecera `Command-Id` (`crypto.randomUUID()`). Congela `commandIdRef` y `requestRef` en estado `AMBIGUOUS` para que `retry()` reenvíe idénticamente.
- **[`classifier.ts`](../../src/lib/commands/classifier.ts)**: `classifyCommandResponse(status, error?)` → `'SUCCESS'` (`2xx`), `'AUTH_ERROR'` (`401`), `'REJECTED'` (`4xx != 401`), `'AMBIGUOUS'` (`error`, `null`, `>= 500`).
- **[`ambiguousSession.ts`](../../src/lib/commands/ambiguousSession.ts)**: Registro en memoria de operaciones ambiguas de la sesión actual (`getAmbiguousSessionCommands`, `recordAmbiguousSessionCommand`, `clearAmbiguousSessionCommand`).

---

## 4. Enrutamiento y Superficies (`src/lib/routing/` — 4 archivos)

- **[`enabled-surfaces.demo.json`](../../src/lib/routing/enabled-surfaces.demo.json)**: Lista de 61 superficies habilitadas (26 rutas, 1 sección, 34 acciones).
- **[`surfaces.ts`](../../src/lib/routing/surfaces.ts)**: `isSurfaceEnabled(surface)`. Prioridad: `NEXT_PUBLIC_E2E_SURFACES` (JSON) → `NEXT_PUBLIC_SURFACE_PROFILE === 'none'` (vacío) → `enabled-surfaces.demo.json`.
- **[`classifier.ts`](../../src/lib/routing/classifier.ts)**: `classifyRoute(pathname)` devuelve `'PUBLIC' | 'AUTH' | 'AUTHENTICATED' | 'NOT_APPROVED'`. Garantiza que `/tracking/<lo-que-sea>` sea siempre `'NOT_APPROVED'`.
- **[`backgroundRoutes.ts`](../../src/lib/routing/backgroundRoutes.ts)**: `backgroundFor(pathname)` asigna `'world'` a `/` y rutas de acceso/legales, `'city'` a rutas del donante (`/home`, `/campaigns`, `/c/*`, `/tracking`, `/account*`), y `null` a `/panel*` y `/assets/*`. `hasAppChrome(pathname)` oculta la barra principal en `/` y rutas de acceso/legales.

---

## 5. Motores Puros de Dominio, Criptografía y Utilidades (20 archivos)

| Archivo | Propósito y Reglas Comprobadas |
| :--- | :--- |
| [`tracking/merkle.ts`](../../src/lib/tracking/merkle.ts) | `verifyAnchorProof(eventHash, proof)`: aplica `crypto.subtle.digest('SHA-256', ...)` concatenando strings hexadecimales (`LEFT`: `step.hash + node`; `RIGHT`: `node + step.hash`) y valida igualdad exacta contra `merkleRoot`. `explorerUrl(network, txHash)`: tabla cerrada solo para `sepolia` (`sepolia.etherscan.io/tx/`) y `amoy` (`amoy.polygonscan.com/tx/`). `shortHash(hash)`. |
| [`tracking/tree.ts`](../../src/lib/tracking/tree.ts) | Reconstrucción del árbol padre-hijo (`parentAssetRef`) de sublotes divididos (`split`) para visualización jerárquica en `/tracking`. |
| [`tracking/handoff.ts`](../../src/lib/tracking/handoff.ts) | Transferencia efímera en memoria de un `trackingCode` desde `/account/donations` o `HomeScreen` hacia `/tracking` sin exponerlo en la URL. |
| [`money.ts`](../../src/lib/money.ts) | Tabla cerrada ISO 4217 (`ISO_4217_EXPONENT`: 0, 2, 3 y 4 decimales). `formatMinorUnits`, `toMinorUnits` y `percentOf` (usando `BigInt`, sin punto flotante ni redondeos). |
| [`quantity.ts`](../../src/lib/quantity.ts) | `formatQuantity`: elimina ceros finales de decimales escala 4 y formatea con punto de miles y coma decimal (`"1500.1250"` → `"1.500,125"`). |
| [`qr.ts`](../../src/lib/qr.ts) | Codificador QR ISO/IEC 18004 propio (modo byte UTF-8, nivel M, versiones 1–10 hasta 213 bytes, aritmética Reed-Solomon en $GF(2^8)$ y selección óptima de máscara por penalización). |
| [`organization/profileModel.ts`](../../src/lib/organization/profileModel.ts) | Validación del perfil organizacional: dígito de verificación NIT DIAN módulo 11 (`nitCheckDigitOf`), URL `https://`, teléfono colombiano (`3\d{9}` o `60\d{8}`), bloqueo de `LOCKED_WHEN_VERIFIED` (`name`, `legalName`, `nit`, `nitCheckDigit`) y construcción de cuerpo completo `profileBody` (enviando `null` explícito para borrar campos). |
| [`google/gis.ts`](../../src/lib/google/gis.ts) | Carga perezosa de `https://accounts.google.com/gsi/client` (o doble E2E `NEXT_PUBLIC_E2E_GIS_URL`) y decodificación de correo desde JWT/token de prueba (`emailOfIdToken`, solo visual). |
| [`theme/theme.ts`](../../src/lib/theme/theme.ts) | Preferencia de tema (`'system' | 'light' | 'dark'`) en `localStorage['paxfide.theme']` y `THEME_INIT_SCRIPT` embebido en `<head>`. |
| [`nav/navEntries.ts`](../../src/lib/nav/navEntries.ts) & [`nav/navPrincipal.ts`](../../src/lib/nav/navPrincipal.ts) | Reglas de visibilidad de hasta 8 entradas activas (`inicio`, `explorar`, `donaciones`, `seguimiento`, `organizacion`, `convocatorias`, `lotes`, `perfil`), `MAX_BOTTOM_ENTRIES = 5`, posición persistida en `localStorage['paxfide.nav-position']` y `NAV_POSITION_INIT_SCRIPT`. |
| [`impact/impactModel.ts`](../../src/lib/impact/impactModel.ts) | Modelo de impacto del donante para `ImpactCard`. |
| [`receipt/receiptModel.ts`](../../src/lib/receipt/receiptModel.ts) | Estructura y normalización de datos para el recibo descargable PNG. |
| [`discovery/searchModel.ts`](../../src/lib/discovery/searchModel.ts) | Filtros, paginación por cursor y estado de búsqueda de `/campaigns`. |
| [`location/zoneLabel.ts`](../../src/lib/location/zoneLabel.ts) | Presentación de zona pública DIVIPOLA (`zoneOrNone`). |
| [`legal/versions.ts`](../../src/lib/legal/versions.ts) | Versiones vigentes de términos y política de tratamiento de datos. |
| [`welcome/welcome.ts`](../../src/lib/welcome/welcome.ts) | Control de bienvenida única por cuenta en `localStorage` (`paxfide_welcome_v1_*`). |
| [`labels.ts`](../../src/lib/labels.ts), [`campaignForm.ts`](../../src/lib/campaignForm.ts), [`useLeaveWarning.ts`](../../src/lib/useLeaveWarning.ts) | Etiquetas de dominio en español, validaciones de formulario de convocatoria y aviso `beforeunload` ante cambios sin guardar. |
