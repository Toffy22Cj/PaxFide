# 09. API REST e Integraciones Externas

> **Base URL cliente:** `NEXT_PUBLIC_API_BASE_URL` (ejemplo: `http://localhost:8080/api/v1`)  
> **Base URL SSR (`/c/[publicCode]`):** `API_INTERNAL_BASE_URL || NEXT_PUBLIC_API_BASE_URL`  
> **Transporte central:** [`src/lib/api/http.ts`](../../src/lib/api/http.ts) (`credentials: 'omit'`, `cache: 'no-store'`, `referrerPolicy: 'no-referrer'`).

---

## 1. Convenciones de Protocolo

- **Autenticación de cuenta**: `Authorization: Bearer <jwt>` (solo desde RAM en `session.ts`). Un HTTP `401` cuando se envió JWT dispara `handle401(false)` (cierre local `EXPIRED`).
- **Autenticación de seguimiento**: `Authorization: Bearer <trackingCode>` con `auth: 'none'`. Un HTTP `401` **nunca** afecta la sesión JWT.
- **Idempotencia de comandos**: Toda mutación mediante `useCommand` envía `Command-Id: <uuid-v4>` en cabecera.
- **Errores RFC 7807 (`ProblemDetail`)**: `http.ts` lee únicamente `title`, `pendingTermsVersion` y `pendingDataPolicyVersion`. El campo `detail` del backend **nunca** se renderiza en UI; [`src/lib/api/messages.ts`](../../src/lib/api/messages.ts) traduce `title` a mensajes en español.

---

## 2. Catálogo Completo de Endpoints Consumidos

### 2.1 Identidad y Acceso (`identity.ts`, `account.ts`)
| Método | Ruta (bajo `/api/v1`) | Auth | Cabeceras Especiales | Módulo Cliente |
| :--- | :--- | :---: | :--- | :--- |
| `POST` | `/auth/login` | `none` | — | `identity.ts` |
| `POST` | `/auth/google` | `none` | — | `identity.ts` |
| `POST` | `/auth/register` | `none` | — | `identity.ts` |
| `POST` | `/auth/google/register` | `none` | — | `identity.ts` |
| `GET` | `/me` | `required` | `Bearer <jwt>` | `identity.ts` |
| `GET` | `/me/campaigns` | `required` | `Bearer <jwt>` | `members.ts` |
| `POST` | `/auth/password-reset` | `none` | — | `account.ts` |
| `POST` | `/auth/password-reset/confirm` | `none` | — | `account.ts` |
| `POST` | `/auth/email-verification` | `none` | — | `account.ts` |
| `POST` | `/auth/email-verification/confirm` | `none` | — | `account.ts` |

### 2.2 Cuenta del Donante (`account.ts`)
| Método | Ruta (bajo `/api/v1`) | Auth | Propósito |
| :--- | :--- | :---: | :--- |
| `GET` | `/account` | `required` | Datos base de cuenta y verificación de correo |
| `GET` / `PUT` | `/account/profile` | `required` | Lectura y actualización de `givenName` / `familyName` |
| `GET` | `/account/donations` | `required` | Historial de donaciones del donante |
| `GET` | `/account/impact` | `required` | Resumen de impacto para `HomeScreen` / `ImpactCard` |
| `POST` | `/account/password` | `required` | Cambio de contraseña (devuelve nuevo JWT → `session.replaceToken`) |
| `POST` | `/account/deactivate` | `required` | Desactivación voluntaria de cuenta (`logoutWith('DEACTIVATED')`) |
| `POST` / `DELETE` | `/account/google/link` | `required` | Vincular o desvincular cuenta Google |

### 2.3 Catálogo Público, Donaciones y Seguimiento (`publicCampaigns.ts`, `publicServer.ts`, `tracking.ts`, `locations.ts`)
| Método | Ruta (bajo `/api/v1`) | Auth | Cabeceras / Notas |
| :--- | :--- | :---: | :--- |
| `GET` | `/public/campaigns` | `none` | Descubrimiento público con filtros y paginación `nextCursor` |
| `GET` | `/public/campaigns/{publicCode}` | `none` | Detalle público (SSR en `publicServer.ts` y CSR en `publicCampaigns.ts`) |
| `GET` | `/public/campaigns/{publicCode}/narrative` | `none` | Narrativa pública de convocatoria |
| `POST` | `/public/campaigns/{publicCode}/donation-intents` | `optional` | `Command-Id` obligatorio; asocia donación si hay JWT |
| `GET` | `/public/donation-intents/{intentId}` | `none` | Consulta de estado de intención (`Intent-Token` si aplica) |
| `GET` | `/public/locations` | `none` | Catálogo DIVIPOLA de departamentos y municipios (cacheado en RAM) |
| `GET` | `/donations/tracking` | `none` | `Authorization: Bearer <trackingCode>` |
| `GET` | `/donations/tracking/narrative` | `none` | `Authorization: Bearer <trackingCode>` (200 listo, 202 `PENDING`) |
| `GET` | `/donations/tracking/integrity` | `none` | `Authorization: Bearer <trackingCode>` |
| `GET` | `/donations/tracking/assets/{assetRef}/history` | `none` | `Authorization: Bearer <trackingCode>` (incluye `eventHash` y `anchorProof`) |

### 2.4 Organizaciones, Fondos, Convocatorias y Miembros (`organization.ts`, `campaignAdmin.ts`, `configuration.ts`, `members.ts`, `panelData.ts`, `prediction.ts`)
| Método | Ruta (bajo `/api/v1`) | Auth | Notas |
| :--- | :--- | :---: | :--- |
| `POST` | `/organizations` | `required` | `Command-Id` — crear organización |
| `GET` | `/organizations/{id}` | `required` | Detalle y estado de verificación |
| `PUT` | `/organizations/{id}/profile` | `required` | Actualización completa del perfil (campos vacíos como `null`) |
| `POST` | `/organizations/{id}/verification/resubmit` | `required` | `Command-Id` — reenviar a verificación |
| `GET` | `/organizations/{id}/funds` | `required` | Listado de fondos |
| `GET` | `/organizations/{id}/funds/monthly?months=N` | `required` | Serie mensual para gráficas del panel |
| `GET` | `/organizations/{id}/integrity` | `required` | Resumen de integridad criptográfica organizacional |
| `GET` | `/organizations/{id}/activity` | `required` | Feed de actividad reciente |
| `POST` | `/funds/{fundId}/allocations` | `required` | `Command-Id` — solicitar asignación de fondos |
| `POST` | `/funds/{fundId}/allocations/{allocationId}/confirm` | `required` | `Command-Id` — confirmar asignación |
| `GET` / `POST` | `/organizations/{id}/campaigns` | `required` | Listar o crear (`Command-Id`) convocatorias |
| `POST` | `/campaigns/{ref}/administrators` | `required` | `Command-Id` — designar administrador |
| `POST` | `/campaigns/{ref}/employees` | `required` | `Command-Id` — asignar empleado |
| `POST` | `/campaigns/{ref}/responsibles/{respRef}/remove` | `required` | `Command-Id` — retirar responsable |
| `POST` | `/campaigns/{ref}/close` | `required` | `Command-Id` — cerrar convocatoria |
| `POST` | `/campaigns/{ref}/configuration` | `required` | `Command-Id` — editar configuración sin donaciones |
| `GET` / `POST` | `/campaigns/{ref}/configuration-change-requests` | `required` | Listar o solicitar cambio con aprobación (`Command-Id`) |
| `POST` | `/campaigns/{ref}/configuration-change-requests/{reqId}/{decision}` | `required` | `Command-Id` — `approve` o `reject` |
| `GET` | `/organizations/{id}/members` | `required` | Miembros de la organización |
| `POST` | `/organizations/{id}/members/{accountId}/role` | `required` | `Command-Id` — cambiar rol |
| `POST` | `/organizations/{id}/members/{accountId}/remove` | `required` | `Command-Id` — retirar miembro |
| `GET` / `POST` | `/organizations/{id}/invitations` | `required` | Listar o emitir invitación (`Command-Id`) |
| `POST` | `/organizations/{id}/invitations/{invId}/revoke` | `required` | `Command-Id` — revocar invitación |
| `POST` | `/invitations/accept` | `required` | Aceptar invitación con token capturado de `#token=` |
| `GET` | `/organizations/{id}/campaigns/{ref}/prediction` | `required` | Predicción de cumplimiento de meta |
| `GET` | `/organizations/{id}/campaigns/{ref}/prediction/history` | `required` | Historial de predicciones |

### 2.5 Activos Físicos, Evidencia y Medios (`assetClient.ts`, `assetCommands.ts`, `deliveryEvidence.ts`, `stepEvidence.ts`, `media.ts`)
| Método | Ruta (bajo `/api/v1`) | Auth | Notas |
| :--- | :--- | :---: | :--- |
| `GET` | `/organizations/{id}/physical-assets` | `required` | Inventario de lotes de la organización |
| `GET` | `/physical-assets/{assetRef}` | `required` | Detalle operativo (`PhysicalAssetOperationalReadModel`) |
| `POST` | `/physical-assets/register` | `required` | `Command-Id` — registrar activo |
| `POST` | `/physical-assets/from-donation` | `required` | `Command-Id` — registrar activo desde donación |
| `POST` | `/physical-assets/{ref}/split` | `required` | `Command-Id` — dividir lote |
| `GET` | `/physical-assets/{parent}/splits/{child}` | `required` | Estado de la saga de división |
| `POST` | `/physical-assets/{ref}/dispatch` | `required` | `Command-Id` — despachar lote |
| `POST` | `/physical-assets/{ref}/receive` | `required` | `Command-Id` — recibir lote |
| `POST` | `/physical-assets/{ref}/deliver` | `required` | `Command-Id` — entregar lote (requiere `evidenceRef`) |
| `POST` | `/organizations/{id}/delivery-evidence` | `required` | `XHR` multipart `file` (JPEG/PNG <= 5 MB) → `201 { evidenceRef }` |
| `GET` | `/physical-assets/{ref}/evidence/steps` | `required` | Fotos de pasos del activo |
| `GET` / `PUT` / `DELETE` | `/physical-assets/{ref}/evidence/delivery/publication` | `required` | Control de publicación de copia censurada |
| `PUT` / `DELETE` | Logo de organización y portada de campaña | `required` | Subida `XHR` con progreso y eliminación (`media.ts`) |

### 2.6 Administración de Plataforma (`organization.ts`, `media.ts`)
| Método | Ruta (bajo `/api/v1`) | Auth | Notas |
| :--- | :--- | :---: | :--- |
| `GET` | `/platform/organizations` | `required` | Cola paginada de verificación |
| `POST` | `/platform/organizations/{id}/{decision}` | `required` | `Command-Id` — `verify`, `reject`, `request-information` |
| `GET` / `POST` | `/platform/administrators` | `required` | Listar o conceder `platformAuthority` (`Command-Id`) |
| `POST` | `/platform/administrators/{accountId}/revoke` | `required` | `Command-Id` — revocar `platformAuthority` |
| `POST` | `/platform/accounts/{accountId}/reactivate` | `required` | Reactivar cuenta desactivada |
| `POST` | `/platform/organizations/{id}/media/remove` | `required` | Retirar medio (logo/portada/evidencia) por moderación |

---

## 3. Integraciones Externas

1. **Google Identity Services (`src/lib/google/gis.ts`)**:
   - Script `https://accounts.google.com/gsi/client` cargado bajo demanda solo si `NEXT_PUBLIC_GOOGLE_CLIENT_ID` está configurado.
   - Nunca usa One Tap (`prompt()`); únicamente renderiza el botón oficial (`renderButton`) y entrega el `credential` (`idToken`) al backend.
   - En E2E, `NEXT_PUBLIC_E2E_GIS_URL` redirige a un doble local (`http://localhost:3003/gsi/client`) para cero salidas a Internet.
2. **Exploradores Blockchain (`src/lib/tracking/merkle.ts`)**:
   - Tabla cerrada `EXPLORERS`: `sepolia` → `https://sepolia.etherscan.io/tx/{txHash}` y `amoy` → `https://amoy.polygonscan.com/tx/{txHash}`.
   - Cualquier otra red (incluida una red local de demo) devuelve `null` y no construye enlace.
