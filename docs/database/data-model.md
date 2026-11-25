# 08. Modelo de Datos y Estrategias de Persistencia

> `paxfide-web` no posee base de datos propia ni capa ORM (`ADR-046 C1`). Este documento detalla:
> 1. Los modelos de lectura (ReadModels / DTOs) y contratos de entrada validados en el cliente.
> 2. La política estricta de persistencia en navegador (RAM vs `localStorage`).

---

## 1. Entidades y Contratos de Datos Consumidos

### 1.1 `Principal` y Cuenta (`identity.ts`, `account.ts`)
- **Campos principales**: `accountId`, `email`, `emailVerified`, `organizationId?`, `roles: string[]` (`REPRESENTATIVE`, `ADMINISTRATOR`, `EMPLOYEE`), `platformAuthority?: boolean`, `givenName?`, `familyName?`.
- **Regla de negocio**: `/me` se consulta para adaptar la presentación de controles y navegación, **nunca** como mecanismo de autorización (el backend siempre valida y puede devolver `403`).

### 1.2 `OrganizationProfileContract` (`organization/profileModel.ts`)
- **Campos**: `name` (obligatorio, máx. 200 code points), `description` (máx. 500, sin `<` ni `>`), `website` (`https://`, máx. 200, sin credenciales embebidas), `location` (`{ departmentCode, municipalityCode }` DIVIPOLA coherentes entre sí), `contactEmail`, `legalName` (máx. 200), `nit` (`^\d{9}$`), `nitCheckDigit` (módulo 11 DIAN con pesos `[3, 7, 13, 17, 19, 23, 29, 37, 41]`), `specialTaxRegime` (solo `FOUNDATION`), `contactPhone` (`^(3\d{9}|60\d{8})$`).
- **Invariante de actualización**: `PUT /organizations/{id}/profile` envía siempre todos los campos (un campo vacío viaja como `null` explícito para borrarlo). Cuando la organización está verificada, `name`, `legalName`, `nit` y `nitCheckDigit` quedan bloqueados (`LOCKED_WHEN_VERIFIED`).

### 1.3 Convocatoria Pública y Donación (`publicCampaignModel.ts`, `money.ts`)
- **Visibilidad**: `PUBLIC_DISCOVERABLE` (aparece en `/` y `/campaigns`) o `PRIVATE_LINK` (accesible solo por `/c/[publicCode]`, nunca listada en descubrimiento).
- **Importes monetarios**: representados como strings de dígitos en unidades mínimas ISO 4217 (`"150000050"` con `"COP"` → `"1.500.000,50 COP"`). `money.ts` soporta 138+ códigos con exponentes `0`, `2`, `3` y `4` sin usar punto flotante. Los porcentajes se calculan con `BigInt` (`percentOf`).

### 1.4 Activo Físico Operativo (`assetClient.ts`, `quantity.ts`)
- **`PhysicalAssetOperationalReadModel`**: `assetRef`, `lifecycleStatus` (`REGISTERED | DISPATCHED | RECEIVED | DELIVERED`), `currentCustodianRef` (`string | null`), `currentLocation` (`string | null`), `quantity` (decimal escala 4 como string, formateado con `formatQuantity`), `unitOfMeasure`, `campaignRef`, `municipalityCode?`, `zoneName?`.
- **Inmutabilidad terminal**: cuando `lifecycleStatus === 'DELIVERED'`, la vista operativa es estrictamente de solo lectura.
- **Evidencia de entrega**: `evidenceRef` debe cumplir `/^sha256:[0-9a-f]{64}$/` tras subir JPEG o PNG <= 5 MB (`5 * 1024 * 1024` bytes).

### 1.5 Seguimiento y Prueba de Merkle (`tracking.ts`, `merkle.ts`)
- **`DonationTracking`**: `status`, `campaignTitle?`, `organizationName?`, `financialSnapshot` (`currency`, `originalAmount`, `clearedAmount`, `pendingAllocationAmount`, `confirmedAllocationAmount`, `refundedAmount`, `firstClearedAt`, `lastClearedAt`), `logistics[]` (con `parentAssetRef?` para reconstruir árboles de sublotes en `tree.ts`).
- **`Transition`**: `eventType`, `timestamp?`, `locationZone?`, `custodianCategory?`, `anchorStatus` (`ANCHORED | IN_BATCH | PENDING | UNDER_REVIEW`), `eventHash` (64 hex minúscula), `anchorProof` (`merkleRoot`, `leafIndex`, `path[]` de `{ side: 'LEFT' | 'RIGHT', hash }`, `transactionHash`, `network`, `anchoredAt`), `evidenceRegistered?`, `evidenceRef?`.
- **Validación estricta**: `parseAnchorProof` descarta cualquier prueba incompleta o con hashes mal formados (`^[0-9a-f]{64}$`); nunca se verifica parcialmente.

---

## 2. Estrategia de Persistencia en el Navegador

| Dato | Ubicación Real | ¿Persiste al Recargar? | Clasificación |
| :--- | :--- | :---: | :--- |
| `jwt` de sesión | Variable privada en [`session.ts`](../../src/lib/auth/session.ts) (RAM) | No | Secreto portador |
| `lastPrincipal` | Variable privada en [`session.ts`](../../src/lib/auth/session.ts) (RAM) | No | Caché visual efímera |
| `trackingCode` / `handoff` | Estado React / [`handoff.ts`](../../src/lib/tracking/handoff.ts) (RAM) | No | Secreto portador |
| Tokens de `#token=` | RAM en `verificationToken.ts`, `resetToken.ts`, `invitations/token.ts` | No | Secreto efímero |
| `Command-Id` y payload en vuelo | `useRef` en [`useCommand.ts`](../../src/lib/commands/useCommand.ts) + `ambiguousSession.ts` | No | Idempotencia de sesión |
| Catálogo DIVIPOLA | Caché de promesa en [`locations.ts`](../../src/lib/api/locations.ts) (RAM) | No | Catálogo público |
| Tema UI (`paxfide.theme`) | `localStorage` ([`theme.ts`](../../src/lib/theme/theme.ts)) | Sí | Preferencia UI |
| Posición barra (`paxfide.nav-position`) | `localStorage` ([`navEntries.ts`](../../src/lib/nav/navEntries.ts)) | Sí | Preferencia UI |
| Modo mundo landing (`paxfide.world-mode`) | `localStorage` ([`worldMode.ts`](../../src/components/landing/worldMode.ts)) | Sí | Preferencia UI |
| Pausa animación (`paxfide.city.paused`) | `localStorage` ([`animationPreference.ts`](../../src/components/background/animationPreference.ts)) | Sí | Preferencia accesibilidad |
| Bienvenida cerrada (`paxfide_welcome_v1_*`) | `localStorage` ([`welcome.ts`](../../src/lib/welcome/welcome.ts)) | Sí | Preferencia UI |
| Cookies HTTP / `sessionStorage` / `IndexedDB` | **No utilizados** (`credentials: 'omit'`) | N/A | Prohibido por D2/C1 |
