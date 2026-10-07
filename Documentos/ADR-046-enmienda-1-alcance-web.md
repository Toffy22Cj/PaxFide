# ADR-046 — Enmienda 1: ampliación del alcance de la web v1

**Status:** **APROBADO — Carlos, 2026-10-07T19:17Z**, con cuatro añadidos (A1–A4, marcados abajo en E1-2, E1-3, §4 y E1-5). Redactado por el agente por encargo de Carlos (2026-10-07).
**Fecha:** 2026-10-07
**Enmienda a:** `ADR-046-frontend-web-paxfide-web.md` (APROBADO). **No cambia D1–D8.** Cambia el alcance de producto que ADR-046 tomaba de `front-fase2.md` §5 y §7 (y T3).

---

## 1. Context

El equipo pide una aplicación web completa para el cierre del 21 de octubre, con el golden path recorrible por la interfaz. El alcance v1 de `front-fase2.md` dejaba fuera de la web:

- **Donar** (`front-fase2.md` §5.A: "Fuera de web v1"; §7 "FUERA DE WEB v1");
- **`/account/donations`** (§5 "Fuera de `paxfide-web`": superficie móvil);
- **dispatch/receive/deliver** (T3: `/assets/:assetRef` en web = lectura + `split`; las acciones logísticas, solo en móvil).

Desde entonces el backend expone esas operaciones por HTTP (`develop` de `Donaciones`, B6-b y B6-c, 2026-10-07): CV-11 con `Command-Id`, la consulta de la intención con `Intent-Token`, `GET /account/donations`, y dispatch/receive/deliver con `Command-Id`.

**Decisión del equipo (Carlos, 2026-10-07):** entran en la web v1.

## 2. Decision

### E1-1 — Alcance

Entran en `paxfide-web` v1, además de lo ya aprobado:

| Superficie | Ruta / acción | Categoría (D4) | Contrato |
|---|---|---|---|
| Donar | Acción transitoria en `/c/:publicCode` (`action:donate`) | Pública (JWT opcional) | CV-11 `POST /public/campaigns/{publicCode}/donation-intents`; consulta `GET /public/donation-intents/{intentId}` con `Intent-Token` |
| Mis donaciones | `/account/donations` | Autenticada | `GET /account/donations` |
| Dispatch / Receive / Deliver | Acciones transitorias en `/assets/:assetRef` | Autenticada | `POST /physical-assets/{assetRef}/dispatch\|receive\|deliver` con `Command-Id` |
| Seguimiento por formulario | `/tracking` (sin parámetros) | Pública | TR-01 a TR-03 con `Authorization: Bearer <trackingCode>` |
| Estimación (predicción) | `/panel/prediction` | Autenticada | **Sin contrato** (S-06 de `solicitudes-backend.md`); no se habilita hasta que exista |

### E1-2 — T3 sustituido

> `/assets/:assetRef` en web: lectura, `split`, `dispatch`, `receive` y `deliver`. Las acciones logísticas existen en web **y** en móvil.

Lo que T3 temía —duplicar el `ActionResolver` del móvil— se evita así: la web **no** decide qué acción está disponible según el estado del activo, salvo la regla de la matriz (`DELIVERED` → solo lectura). Ofrece las acciones habilitadas y el backend las rechaza (409) si el estado no lo permite.

**A1 (Carlos, 2026-10-07):** con `/me` disponible (ficha N1), las acciones logísticas solo se muestran a los roles que pueden ejecutarlas según su contrato. Es representación: **el backend sigue autorizando** y su 403 manda sobre lo que muestre la pantalla.

### E1-3 — `/tracking/:trackingCode` sustituido por `/tracking`

`/tracking/:trackingCode` no existe en ningún build (C2/H1 resuelto por decisión de Carlos: el código nunca en la URL).

**A2 (Carlos, 2026-10-07):** el QR de seguimiento apunta a `/tracking`, **sin el código**. S-05 queda decidido; la URL canónica de la matriz §4b (`/tracking/{trackingCode}`) se sustituye por `/tracking`.

### E1-4 — Lo que no cambia

- D2 (JWT solo en memoria), D3 (sin BFF), D5 (habilitación por build: todo lo nuevo está detrás de la lista; build por defecto, desactivado), D6 (comandos sin Outbox: CV-11 y las acciones logísticas usan la misma máquina) y D8 (sin dependencias nuevas).
- La autorización sigue siendo del backend.

### E1-5 — Resultado desconocido de un comando (A4, Carlos, 2026-10-07)

Un comando con resultado desconocido (timeout, conexión cortada o 5xx) se muestra como **AMBIGUO** y se puede reintentar **en la misma página** con el **mismo** `Command-Id`. **No** se reintenta tras recargar: el `Command-Id` vive solo en memoria y se pierde (D6, sin cambios).

## 3. Alternatives

| Alternativa | Por qué se descarta |
|---|---|
| Mantener el alcance de `front-fase2.md` | Decisión del equipo: la demo debe recorrerse por la web |
| Copiar el `ActionResolver` del móvil para decidir qué acción mostrar | Es justo la divergencia que T3 quería evitar; no hay fuente contractual de acciones disponibles |

## 4. Consequences

- `front-fase2.md` §5 (inventario), §7 (árbol, "FUERA DE WEB v1") y T3 quedan desactualizados en lo que esta enmienda cambia.
- CV-11 en web añade un segundo secreto en memoria (`statusToken`), con las mismas reglas que el JWT: nunca en almacenamiento, URL ni logs.
- **A3 (Carlos, 2026-10-07): recargar la página pierde la consulta del estado de la donación** (el `statusToken` solo vive en memoria). Mitigación: **aviso antes de salir de la página** mientras la consulta siga abierta, y el `trackingCode` **destacado en cuanto llega**.
- El donante con cuenta usa la web autenticada (`/account/donations`), además del móvil.

## 5. Registro

| Fecha | Quién | Qué |
|---|---|---|
| 2026-10-07 | Carlos | Decide la ampliación y pide esta enmienda; autoriza implementar antes de aprobarla |
| 2026-10-07 | Agente | Redacta el borrador |
| 2026-10-07T19:17Z | Carlos | **APROBADA**, con los añadidos A1 (acciones logísticas por rol con `/me`), A2 (QR de seguimiento a `/tracking` sin código; S-05 decidido), A3 (consecuencia de recargar y su mitigación) y A4 (reintento del ambiguo en la misma página, nunca tras recargar) |
