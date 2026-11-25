# 05–07. Rutas, Pantallas y Flujos de Negocio (`src/app/` y `src/screens/`)

> **Directorios:** [`src/app/`](../../src/app) (46 archivos) y [`src/screens/`](../../src/screens) (32 archivos: 24 pantallas `*Screen.tsx` + 8 hojas `*.module.css`).

---

## 1. Catálogo Completo de las 26 Rutas de la Aplicación

| Ruta URL | Categoría (`classifier.ts`) | Fondo (`backgroundRoutes.ts`) | Archivo App Router | Pantalla Renderizada |
| :--- | :--- | :---: | :--- | :--- |
| `/` | `PUBLIC` | `world` (sin chrome app) | [`src/app/page.tsx`](../../src/app/page.tsx) | [`LandingScreen.tsx`](../../src/screens/LandingScreen.tsx) |
| `/campaigns` | `PUBLIC` | `city` | [`src/app/campaigns/page.tsx`](../../src/app/campaigns/page.tsx) | [`DiscoveryScreen.tsx`](../../src/screens/DiscoveryScreen.tsx) |
| `/c/[publicCode]` | `PUBLIC` (SSR + OG `noindex`) | `city` | [`src/app/c/[publicCode]/page.tsx`](../../src/app/c/%5BpublicCode%5D/page.tsx) | [`CampaignPublicScreen.tsx`](../../src/screens/CampaignPublicScreen.tsx) |
| `/tracking` | `PUBLIC` (`/tracking/*` → 404) | `city` | [`src/app/tracking/page.tsx`](../../src/app/tracking/page.tsx) | [`TrackingScreen.tsx`](../../src/screens/TrackingScreen.tsx) |
| `/login` | `AUTH` | `world` (sin chrome app) | [`src/app/(acceso)/(cuenta)/login/page.tsx`](../../src/app/(acceso)/(cuenta)/login/page.tsx) | [`LoginScreen.tsx`](../../src/screens/LoginScreen.tsx) |
| `/register` | `AUTH` | `world` (sin chrome app) | [`src/app/(acceso)/(cuenta)/register/page.tsx`](../../src/app/(acceso)/(cuenta)/register/page.tsx) | [`RegisterScreen.tsx`](../../src/screens/RegisterScreen.tsx) |
| `/recuperar` | `PUBLIC` (`#token=`) | `world` (sin chrome app) | [`src/app/(acceso)/recuperar/page.tsx`](../../src/app/(acceso)/recuperar/page.tsx) | [`RecoverScreen.tsx`](../../src/screens/RecoverScreen.tsx) |
| `/verificar-correo` | `PUBLIC` (`#token=`) | `world` (sin chrome app) | [`src/app/(acceso)/verificar-correo/page.tsx`](../../src/app/(acceso)/verificar-correo/page.tsx) | [`VerifyEmailScreen.tsx`](../../src/screens/VerifyEmailScreen.tsx) |
| `/invitaciones` | `PUBLIC` (`#token=`) | `world` (sin chrome app) | [`src/app/(acceso)/invitaciones/page.tsx`](../../src/app/(acceso)/invitaciones/page.tsx) | [`InvitationScreen.tsx`](../../src/screens/InvitationScreen.tsx) |
| `/terminos` | `PUBLIC` | `world` (sin chrome app) | [`src/app/(acceso)/terminos/page.tsx`](../../src/app/(acceso)/terminos/page.tsx) | [`LegalScreen.tsx`](../../src/screens/LegalScreen.tsx) |
| `/privacidad` | `PUBLIC` | `world` (sin chrome app) | [`src/app/(acceso)/privacidad/page.tsx`](../../src/app/(acceso)/privacidad/page.tsx) | [`LegalScreen.tsx`](../../src/screens/LegalScreen.tsx) |
| `/terminos-organizacion` | `PUBLIC` | `world` (sin chrome app) | [`src/app/(acceso)/terminos-organizacion/page.tsx`](../../src/app/(acceso)/terminos-organizacion/page.tsx) | [`LegalScreen.tsx`](../../src/screens/LegalScreen.tsx) |
| `/home` | `AUTHENTICATED` | `city` | [`src/app/home/page.tsx`](../../src/app/home/page.tsx) | [`HomeScreen.tsx`](../../src/screens/HomeScreen.tsx) |
| `/account` | `AUTHENTICATED` | `city` | [`src/app/account/page.tsx`](../../src/app/account/page.tsx) | [`ProfileScreen.tsx`](../../src/screens/ProfileScreen.tsx) |
| `/account/donations` | `AUTHENTICATED` | `city` | [`src/app/account/donations/page.tsx`](../../src/app/account/donations/page.tsx) | [`AccountDonationsScreen.tsx`](../../src/screens/AccountDonationsScreen.tsx) |
| `/panel` | `AUTHENTICATED` | `null` | [`src/app/panel/page.tsx`](../../src/app/panel/page.tsx) | [`PanelHomeScreen.tsx`](../../src/screens/PanelHomeScreen.tsx) |
| `/panel/campaigns` | `AUTHENTICATED` | `null` | [`src/app/panel/campaigns/page.tsx`](../../src/app/panel/campaigns/page.tsx) | [`CampaignsScreen.tsx`](../../src/screens/CampaignsScreen.tsx) |
| `/panel/my-campaigns` | `AUTHENTICATED` | `null` | [`src/app/panel/my-campaigns/page.tsx`](../../src/app/panel/my-campaigns/page.tsx) | [`MyCampaignsScreen.tsx`](../../src/screens/MyCampaignsScreen.tsx) |
| `/panel/configuration` | `AUTHENTICATED` | `null` | [`src/app/panel/configuration/page.tsx`](../../src/app/panel/configuration/page.tsx) | [`ConfigurationScreen.tsx`](../../src/screens/ConfigurationScreen.tsx) |
| `/panel/funds` | `AUTHENTICATED` | `null` | [`src/app/panel/funds/page.tsx`](../../src/app/panel/funds/page.tsx) | [`FundsScreen.tsx`](../../src/screens/FundsScreen.tsx) |
| `/panel/assets` | `AUTHENTICATED` | `null` | [`src/app/panel/assets/page.tsx`](../../src/app/panel/assets/page.tsx) | [`OrgAssetsScreen.tsx`](../../src/screens/OrgAssetsScreen.tsx) |
| `/panel/members` | `AUTHENTICATED` | `null` | [`src/app/panel/members/page.tsx`](../../src/app/panel/members/page.tsx) | [`MembersScreen.tsx`](../../src/screens/MembersScreen.tsx) |
| `/panel/organization` | `AUTHENTICATED` | `null` | [`src/app/panel/organization/page.tsx`](../../src/app/panel/organization/page.tsx) | [`OrganizationScreen.tsx`](../../src/screens/OrganizationScreen.tsx) |
| `/panel/platform` | `AUTHENTICATED` | `null` | [`src/app/panel/platform/page.tsx`](../../src/app/panel/platform/page.tsx) | [`PlatformScreen.tsx`](../../src/screens/PlatformScreen.tsx) |
| `/panel/prediction` | `AUTHENTICATED` | `null` | [`src/app/panel/prediction/page.tsx`](../../src/app/panel/prediction/page.tsx) | [`PredictionScreen.tsx`](../../src/screens/PredictionScreen.tsx) |
| `/assets/[assetRef]` | `AUTHENTICATED` | `null` | [`src/app/assets/[assetRef]/page.tsx`](../../src/app/assets/%5BassetRef%5D/page.tsx) | Directa en `page.tsx` (`AssetPage`) |

---

## 2. Flujos de Negocio Reconstruidos Paso a Paso (Sección 07)

### Flujo 1: Exploración y Donación a una Convocatoria Pública
1. **Inicio**: Usuario entra a `/` (`LandingScreen`) o `/campaigns` (`DiscoveryScreen`) y selecciona una convocatoria abierta (`PUBLIC_DISCOVERABLE`).
2. **Carga SSR + Hidratación**: Next.js ejecuta [`src/app/c/[publicCode]/page.tsx`](../../src/app/c/%5BpublicCode%5D/page.tsx) → `fetchPublicCampaignOnServer(publicCode)` (`GET /public/campaigns/{code}`, `cache: 'no-store'`, sin credenciales). Genera `Metadata` con `robots: { index: false, follow: false }` y Open Graph sin `og:url`. Si responde 404, invoca `notFound()`.
3. **Donación (`DonateSection.tsx`)**: El donante elige monto (validado con `toMinorUnits` de `money.ts`) o donación en especie y ejecuta `useCommand` hacia `POST /public/campaigns/{publicCode}/donation-intents` con cabecera `Command-Id` y `auth: 'optional'` (si hay JWT en memoria, la donación se asocia a su cuenta).
4. **Confirmación y Revelación**: El backend responde `201 Created`; si la intención requiere sondeo/consulta, se usa `GET /public/donation-intents/{intentId}`. `TrackingCodeReveal` muestra el `trackingCode` con aviso de copia segura (nunca se persiste en `localStorage`).
5. **Errores**: `4xx` (`CampaignClosed`, `DonationCurrencyMismatch`, etc.) muestra mensaje de `rejectionMessage()`; `5xx`/red entra en `AMBIGUOUS` permitiendo reintentar con el mismo `Command-Id`.

### Flujo 2: Seguimiento de Donación y Verificación Criptográfica Merkle
1. **Inicio**: Usuario llega a `/tracking` (`TrackingScreen`), ingresa el `trackingCode` en el formulario (o lo recibe por transferencia en memoria desde `handoff.ts` al hacer clic desde `/account/donations`).
2. **Lecturas**: `tracking.ts` envía `Authorization: Bearer <trackingCode>` (`auth: 'none'`, un 401 **no** cierra sesión JWT) a:
   - `GET /donations/tracking` (estado, `financialSnapshot` y `logistics[]`).
   - `GET /donations/tracking/narrative` (200 disponible o 202 `PENDING`).
   - `GET /donations/tracking/integrity` (resumen de lotes anclados y eventos sin anclar).
   - `GET /donations/tracking/assets/{assetRef}/history` (transiciones con `eventHash`, `anchorStatus`, `anchorProof`, `evidenceRegistered`, `evidenceRef`).
3. **Verificación Local (`StepDetail.tsx` + `merkle.ts`)**: En cualquier transición `ANCHORED` con `anchorProof` íntegro, el donante pulsa *"Comprobar en mi navegador"*. `verifyAnchorProof(eventHash, proof)` ejecuta `SHA-256` iterativo vía Web Crypto API sin enviar datos por red y compara el resultado con `merkleRoot`. Además, si `network` es `sepolia` o `amoy` y `transactionHash` coincide con `/^0x[0-9a-fA-F]{64}$/`, ofrece enlace externo al explorador.
4. **Recibo PNG**: `ReceiptActions` + `ReceiptCanvas.ts` + `encodeQr()` generan un PNG descargable localmente.

### Flujo 3: Autenticación, Registro, Recuperación e Invitaciones
1. **Login clásico / Google (`LoginScreen.tsx`)**: Envía `POST /auth/login` o `POST /auth/google` (con `idToken` obtenido de GIS). Si responde `403 AcceptanceRequired` con `pendingTermsVersion`/`pendingDataPolicyVersion`, presenta el consentimiento legal para reenviar con las versiones aceptadas. Al éxito, llama `session.login(token)` y `RouteGuard` redirige a `consumePostLoginDestination() || defaultDestination()` (`/home`).
2. **Enlaces por correo (`/recuperar`, `/verificar-correo`, `/invitaciones`)**: Son rutas `PUBLIC` para que al montar se ejecute la purga inmediata de `#token=` (`history.replaceState`) antes de exigir sesión o llamar al backend. En `/invitaciones`, si no hay sesión, guarda `/invitaciones` y lleva a `/login` manteniendo el token solo en RAM de la pestaña.

### Flujo 4: Ciclo de Vida Operativo de Activos Físicos y Evidencia Fotográfica
1. **Registro (`OrgAssetsScreen.tsx` / `RegisterAssetForm.tsx`)**: Miembro autorizado ejecuta `POST /physical-assets/register` o `POST /physical-assets/from-donation` con `Command-Id`.
2. **Operación en Campo (`/assets/[assetRef]`)**: `AssetPage` consulta `GET /physical-assets/{assetRef}` y `GET /me` (`usePrincipal`). Según `lifecycleStatus` (`REGISTERED`, `DISPATCHED`, `RECEIVED`, `DELIVERED`), `AssetActions` habilita los comandos idempotentes `dispatch`, `receive`, `split` (con seguimiento en `SplitProgress.tsx` vía `GET /physical-assets/{parent}/splits/{child}`) y `deliver`.
3. **Entrega con Foto (`DeliverModal.tsx` + `deliveryEvidence.ts`)**: Antes de llamar a `POST /physical-assets/{ref}/deliver`, la foto (JPEG o PNG <= 5 MB) se sube mediante `XHR` a `POST /organizations/{id}/delivery-evidence` obteniendo un `evidenceRef` (`sha256:64hex`). Al confirmarse `DELIVERED`, la vista pasa a solo lectura (`isReadOnly = true`) y muestra `DeliveryEvidencePhoto` (vía `PrivateImage` autenticado) y `StepPhotosSection` (control de publicación censurada).

### Flujo 5: Gestión de Organización, Configuración con Aprobación y Plataforma
1. **Organización (`OrganizationScreen.tsx`)**: Creación (`POST /organizations`), edición completa (`PUT /organizations/{id}/profile` con validación NIT módulo 11 en `profileModel.ts`), logo (`media.ts`) y reenvío a verificación (`POST /organizations/{id}/verification/resubmit`).
2. **Configuración (`ConfigurationScreen.tsx`)**: Si la convocatoria no tiene donaciones, edita directamente (`POST /campaigns/{ref}/configuration`); si ya tiene donaciones (`CampaignAlreadyHasDonations`), crea una solicitud (`configuration-change-requests`) que debe aprobar otra persona (el backend rechaza `SelfApprovalNotAllowed`).
3. **Plataforma (`PlatformScreen.tsx`)**: Administradores con `platformAuthority` verifican, rechazan o solicitan información a organizaciones (`/platform/organizations/{id}/{decision}`), gestionan administradores de plataforma, reactivan cuentas y retiran medios inapropiados.
