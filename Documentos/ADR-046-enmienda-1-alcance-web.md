# ADR-046 — Enmienda 1: ampliación del alcance de la web v1

**Status:** BORRADOR — **pendiente de aprobación de Carlos a su vuelta**. Redactado por el agente por encargo de Carlos (2026-10-07). Mientras tanto, Carlos autorizó implementar lo que aquí se describe (respuesta del 2026-10-07, punto 3).
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

### E1-3 — `/tracking/:trackingCode` sustituido por `/tracking`

`/tracking/:trackingCode` no existe en ningún build (C2/H1 resuelto por decisión de Carlos: el código nunca en la URL). El QR de seguimiento de la matriz §4b requiere revisión (S-05).

### E1-4 — Lo que no cambia

- D2 (JWT solo en memoria), D3 (sin BFF), D5 (habilitación por build: todo lo nuevo está detrás de la lista; build por defecto, desactivado), D6 (comandos sin Outbox: CV-11 y las acciones logísticas usan la misma máquina) y D8 (sin dependencias nuevas).
- La autorización sigue siendo del backend.

## 3. Alternatives

| Alternativa | Por qué se descarta |
|---|---|
| Mantener el alcance de `front-fase2.md` | Decisión del equipo: la demo debe recorrerse por la web |
| Copiar el `ActionResolver` del móvil para decidir qué acción mostrar | Es justo la divergencia que T3 quería evitar; no hay fuente contractual de acciones disponibles |

## 4. Consequences

- `front-fase2.md` §5 (inventario), §7 (árbol, "FUERA DE WEB v1") y T3 quedan desactualizados en lo que esta enmienda cambia.
- CV-11 en web añade un segundo secreto en memoria (`statusToken`), con las mismas reglas que el JWT: nunca en almacenamiento, URL ni logs.
- El donante con cuenta usa la web autenticada (`/account/donations`), además del móvil.

## 5. Registro

| Fecha | Quién | Qué |
|---|---|---|
| 2026-10-07 | Carlos | Decide la ampliación y pide esta enmienda; autoriza implementar antes de aprobarla |
| 2026-10-07 | Agente | Redacta el borrador |
| — | Carlos | **Aprobación pendiente** |
