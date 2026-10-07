```yaml
name: front-fase2
description: Diseño del frontend web (paxfide-web) de PaxFide — Fase 2 del frontend. CERRADO a nivel de diseño. Decisiones de entrada W0–W3 (+W1-bis), consecuencias C1–C3, herencia desde front-fase1.md, inventario contractual, árbol de rutas (T1–T6), guards (G-W1–G-W4), pantallas (P-W1–P-W3), comandos sin Outbox, estrategia de tests. Hallazgos R1–R11 y N1. Sin ADR asignado.
sources: [chat]
aliases: [paxfide-web, Frontend web, Next.js, panel administrativo, front fase 2]
```

## Alcance y estado de este documento

Diseño de `paxfide-web`, trabajado en Modo de Arquitectura (sin código). Complementa `front-fase1.md` (Flutter v1, cerrado a nivel de diseño) y no lo reescribe: las decisiones heredadas se referencian por sección. No reabre `front-fase1.md`, ADRs ni decisiones cerradas anteriores.

**Estado:** `paxfide-web` v1 **cerrado a nivel de diseño**: decisiones de entrada, inventario contractual, árbol de rutas, guards, pantallas y estrategia de tests.

Cerrado a nivel de diseño **no** significa implementable: **ninguna ruta autenticada es implementable de extremo a extremo hoy** (§6, §13, §14). Los pendientes contractuales permanecen como pendientes; no se convierten en soluciones de frontend.

Fuentes contrastadas: `front-fase1.md`, `api-contract-matrix.md`, `ADR-037`, `golden-path.md`, `contract-wiring-review.md`, `identity-resumen.md`, `convocatoria-resumen.md`.

## 1. Responsabilidad de `paxfide-web`

> `paxfide-web` sirve la gestión administrativa y operacional de organización, incluyendo las operaciones de PhysicalAsset asignadas a EMPLOYEE/REPRESENTATIVE, sin convertir esas operaciones en privilegios administrativos.

Además sirve las rutas públicas de los QR como fallback cuando la app móvil no está instalada (W1, W1-bis).

Servir una operación en la superficie web **no** cambia quién puede ejecutarla: la autorización sigue siendo backend (P7, `RoleAuthorizationPolicy`/`OrganizationBoundaryPolicy`). El frontend decide superficie y navegación; el backend decide autorización. El frontend nunca convierte disponibilidad de una pantalla en autorización (mismo principio que `front-fase1.md` §9, P7).

## 2. Decisiones de entrada

| ID | Decisión | Estado |
|---|---|---|
| W0 | Stack: **Next.js** | CERRADO |
| W1 | `paxfide-web` sirve `/c/:publicCode` y `/tracking/:trackingCode` (fallback de URL canónica de QR) | CERRADO |
| W1-bis | `paxfide-web` sirve `/assets/:assetRef` como ruta **autenticada** (QR de Asset, matriz §4b) | CERRADO |
| W2 | JWT **solo en memoria** + regla provisional T-1 (`front-fase1.md` §3). Nunca `localStorage`/`sessionStorage`. Sin BFF | CERRADO provisionalmente |
| W3 | `register`, `split` y `from-donation` de PhysicalAsset se sirven en web, con la precisión semántica de §1 | CERRADO |

**Deuda aceptada por W2 (hasta que Identity defina access/refresh):** cada recarga o pestaña nueva exige volver a iniciar sesión; cada pestaña es una sesión independiente.

**Precisión de W3:** no autoriza implementar esos flujos de inmediato. `REGISTER_PHYSICAL_ASSET` y `SPLIT_PHYSICAL_ASSET` son operaciones de `EMPLOYEE` con respaldo limitado de `REPRESENTATIVE` (enmienda ADR-032); `REGISTER_PHYSICAL_ASSET_FROM_DONATION` sigue bloqueado hasta `HumanAccount` + P7 (`golden-path.md` §5.1–5.2).

## 3. Consecuencias de las decisiones

### C1 — No BFF accidental (CERRADO, invariante)

Combinación W0 × W2: el servidor Next.js nunca posee el JWT.

```text
Permitido:   Browser → Next.js UI (cliente) → Backend
Prohibido:   Browser → Next.js Server Action / Route Handler / Middleware → Backend (con JWT)
```

- Páginas autenticadas: renderizado en cliente.
- Route handlers, server actions y middleware de Next.js nunca reciben ni reenvían el JWT, ni actúan como proxy autenticado hacia el backend.
- Introducir autenticación server-side sería contradecir W2 y requeriría ADR propio (regla 3.5), no una optimización.

### C2 — Renderizado de `/tracking` (PROPUESTA, bloqueada)

Propuesta: `/tracking/:trackingCode` renderizado solo en cliente, `noindex`, sin Open Graph. SSR/OG limitado a `/c/:publicCode` (contenido público).

**Bloqueada por:**
1. **H1** (`front-fase1.md` §16), que en web se agrava: el path con la credencial bearer aparece en historial del navegador, logs de acceso del servidor web/hosting, cabecera `Referer` y analítica — en tensión directa con ADR-037 §2.7.
2. **Verificación del contrato de credencial:** la matriz §5 y `contract-wiring-review.md` listan `GET /tracking/{trackingCode}` (código en path); la Tarea 3.4 de `plan-ejecucion-agentes-fase3.md` implementó el filtro sobre `/api/v1/donations/tracking/**` con `Authorization: Bearer`. Verificar contra el repositorio.

`/tracking` no se implementa en web hasta resolver ambos. En ejecución responde 404 mientras tanto (G-W1).

### C3 — Actor `EMPLOYEE` en web

Por W3, los actores autenticados de web son: Platform Administrator, `ADMINISTRATOR` de organización, `EMPLOYEE` y `REPRESENTATIVE` (solo respaldo en `register`/`split`).

Riesgo operativo registrado sin reabrir W3: `split` puede ocurrir en campo. W1-bis lo mitiga (el QR de Asset abre la web en el móvil si la app no está instalada). Si en uso real resulta insuficiente, W3 se revisa con evidencia.

## 4. Herencia desde `front-fase1.md`

| Decisión Flutter | En web | Nota |
|---|---|---|
| Máquina de sesión + T-1 (§3) | Se hereda | Mismo JWT mínimo, mismo refresh pendiente. En web `RESTORING` resuelve de inmediato a `LOGGED_OUT` (§8) |
| Tabla de guards y 6 invariantes (§10) | Se hereda como principio | Aplicación concreta en §8; invariante 4 reforzado |
| `403` como estado de pantalla, nunca redirect | Se hereda | Invariante 5 |
| Frontera de `ReadModel` (ADR-037 §2.2) | Se hereda | Contrato de backend |
| Distinción fallo determinista / ambiguo (regla 2.6) | Se hereda | Aplicada a comandos web sin Outbox en §10 |
| Estados de pantalla, formularios transitorios, secciones no son rutas (§12, reglas 1–3) | Se hereda | — |
| `401` único de tracking que nunca modifica la sesión (§13) | Se hereda | — |
| Outbox / `SyncEngine` offline (§6) | **No se hereda** | Sin requisito offline para web; importarlo sería overengineering. Solo con requisito explícito |
| `NavigationRestoreState` (§8) | **No se hereda** | En web el estado de navegación es la URL |
| `PendingIntent` (§11 R2) | **Sustituido por G-W2** | Destino retenido en memoria para todas las rutas autenticadas (§8) |

## 5. Inventario contractual

> **Nota (2026-10-07):** La Enmienda 1 de ADR-046 incorpora a la web v1 **Donar** (CV-11 + consulta de estado con `Intent-Token`), **`/account/donations`** y **dispatch/receive/deliver**; lo que aquí figura como "Fuera de web v1" o "Fuera de `paxfide-web`" para esas superficies queda sustituido. Ver `ADR-046-enmienda-1-alcance-web.md` (APROBADA por Carlos el 2026-10-07T19:17Z). Donde esta sección y la enmienda difieran, manda la enmienda.

Estados literales de `api-contract-matrix.md`. Los huecos marcados "heredado" provienen de ADR-037 §2.3.

### A. Pública (fallback de QR)

| Actor | Pantalla | Endpoint | Estado matriz | Hueco |
|---|---|---|---|---|
| Visitante | Convocatoria pública | `GET /public/campaigns/{publicCode}` | DISEÑO CERRADO | Módulo `convocatoria` sin código |
| Visitante | Narrativa convocatoria | `GET /public/campaigns/{publicCode}/narrative` | CONTRATO DEFINIDO | Contradicción `AuditFactsPort`/`CampaignAuditFactsPort` (ADR-036), heredado |
| Donante | Tracking + narrativa | `GET /tracking/{trackingCode}` y `/narrative` | YA EXISTE | C2 (H1 + verificación de credencial) |
| Visitante | Descubrimiento | `GET /public/campaigns` | PENDIENTE | Fuera de web v1 (mismo criterio que `/campaigns` en Flutter) |
| Visitante | Donar | `donation-intents` | PENDIENTE | Fuera de web v1 (mismo criterio que `front-fase1.md` §12) |

### B. Autenticación

| Actor | Pantalla | Endpoint | Estado | Hueco |
|---|---|---|---|---|
| Todos | Login | `POST /auth/login` | CONTRATO CERRADO, implementación pendiente | Fallo de `TokenIssuerPort.issue()` (ADR-034), heredado; N1 |

### C. Platform Administrator

| Pantalla | Endpoint | Estado | Hueco |
|---|---|---|---|
| Organizaciones pendientes | — | No existe | **R1** |
| Verificar / rechazar / pedir información | `POST /platform/organizations/{id}/verify\|reject\|request-information` | DISEÑO CERRADO | `VERIFY` sobre `VERIFIED` (ADR-034), heredado |
| Conceder / revocar autoridad | `POST/DELETE /platform/administrators` | DISEÑO CERRADO | `GRANT`/`REVOKE` repetidos (ADR-034), heredado; precondición de despliegue |

Todo el bloque C queda fuera de web v1 (T6, §7).

### D. `ADMINISTRATOR` de organización

| Pantalla | Endpoint | Estado | Hueco |
|---|---|---|---|
| Mis convocatorias | `GET /organizations/{organizationId}/campaigns` | CONTRATO DEFINIDO | Origen de `organizationId` en cliente → N1 (T5) |
| Crear convocatoria | `POST /organizations/{id}/campaigns` | DISEÑO CERRADO | Firma no verificada (ADR-033), heredado; **R4**; **R11** |
| Asignar empleado | `POST /campaigns/{campaignRef}/employees` | DISEÑO CERRADO | Firma no verificada; D2 (ADR-033), heredado; **R4**; **R6** |
| QR de convocatoria | — | Implementación pendiente (PNG/SVG) | No bloquea |

### E. `EMPLOYEE` / `REPRESENTATIVE`

| Pantalla | Endpoint | Estado | Hueco |
|---|---|---|---|
| Activo (entrada por QR) | `GET /physical-assets/{assetRef}` | CONTRATO DEFINIDO | Puerto: ver §12 (por verificar); **R10** |
| Registrar activo | `POST /physical-assets/register` | CONTRATO DEFINIDO | P7 pendiente; cuerpo no especificado en la matriz; **R10**; **R11** |
| Dividir activo | `POST /physical-assets/{assetRef}/split` | CONTRATO DEFINIDO | P7 pendiente; cuerpo no especificado; R7 resuelto vía QR; **R10**; **R11** |
| Registrar desde donación | `POST /physical-assets/from-donation` | CONTRATO DEFINIDO / BLOQUEADO | `HumanAccount` + P7; **R8** — fuera de web v1 (§7) |

### Fuera de `paxfide-web`

- `GET /account/donations`: superficie de donante; no pertenece al panel web (se sirve en Flutter, `front-fase1.md` §12).
- Detalle individual de convocatoria (`GET /campaigns/{campaignRef}`): **no se añade**. La matriz §2b indica decidirlo cuando se sepa si el listado basta; hoy no hay tareas definidas del administrador sobre una convocatoria existente.

## 6. Hallazgos

Ningún hallazgo se resuelve en frontend. No se inventan endpoints ni DTOs.

### Paquete backend: "Discovery / operational reads for authenticated UI"

Patrón común: hay comandos diseñados, pero faltan las consultas que permiten descubrir el recurso sobre el que operan.

- **R1 — Discovery de organizaciones.** Existen `verify`/`reject`/`request-information`, pero no hay lectura para que el Platform Administrator descubra organizaciones pendientes. Las lecturas cross-organización están fuera por `identity-resumen.md` §7 (rompen `OrganizationBoundaryPolicy`). Sin ella, el paso 1 del Golden Path no tiene pantalla.
- **R6 — Lectura de miembros/empleados.** `POST /campaigns/{campaignRef}/employees` requiere `accountId`; no existe contrato HTTP para listar los miembros de la organización. Relación: `contract-wiring-review.md` §P2 propone un puerto interno `OrganizationMembersReadPort` para otra necesidad (`ConvocatoriaAdminReadModel.responsables`); es un puerto interno propuesto, no un contrato HTTP, y no se da por solución de R6.
- **R8 — Lectura específica para `from-donation`.** No existe lectura operacional adecuada para que el empleado identifique la donación. No se resuelve reutilizando `DonationReadModel` ni proyecciones existentes: el perímetro de ADR-037 §2.2 excluye `donorRef` y datos financieros. Requiere contrato diseñado alrededor de esa operación.

### Fuera del paquete de lecturas

- **R4 — Idempotencia de comandos administrativos.** Doble envío de `POST /organizations/{id}/campaigns` (y `employees`, `verify`) sin semántica de idempotencia definida; ADR-037 §7-A.4 solo cubre `DonationIntent`. Deshabilitar el botón es protección de UX, no idempotencia (ADR-037 §2.6). Se solapa con R11 para crear convocatoria.
- **R9 — Registro de organización sin contrato HTTP en la matriz.** El Golden Path la toma como precondición. No se afirma que no exista en dominio; solo que no hay vía HTTP definida en la matriz.
- **R10 — Autorización de lectura del activo más estrecha que la de escritura.** `GET /physical-assets/{assetRef}` es `JWT + EMPLOYEE`; `split` y `register` admiten `REPRESENTATIVE` como respaldo (enmienda ADR-032). Un `REPRESENTATIVE` autorizado a operar recibe `403` al leer el recurso sobre el que debe operar (y el activo que acaba de registrar). Inconsistencia de contrato de backend. El frontend no la esquiva (no se evita un `403`, no se duplican datos, no se inventa acceso). Hasta resolverse, **no se afirma que el flujo de `REPRESENTATIVE` esté soportado en web**.
- **R11 — Idempotencia por `commandId` de los comandos web, por verificar.** Sin Outbox (§4), la única salida segura ante fallo ambiguo es el reintento con el mismo `commandId` (§10). Exige que `split`, `register` y crear convocatoria acepten `commandId` y garanticen idempotencia con él. La matriz no especifica los cuerpos. Mientras no se verifique, **esos comandos no se despliegan en web** (G-W1 → 404).
- **N1 — Principal/capacidades.** El JWT no lleva roles y no existe contrato "quién soy". En web es más grave que en móvil: tras el login hay que elegir entre hasta cuatro superficies (plataforma, organización, empleado, respaldo de representante) y el cliente no puede deducirlo; además bloquea el `organizationId` de `/panel/campaigns` (T5). Cuando exista, no sustituye la autorización backend.

### Resuelto

- **R7 — Descubrimiento de PhysicalAsset.** Resuelto para la entrada por QR mediante W1-bis: `QR → /assets/{assetRef} → GET /physical-assets/{assetRef}`. Búsqueda/listado operacional de activos fuera de alcance hasta que exista una necesidad demostrada. No forma parte del paquete de lecturas.

### Anotado, no numerado

- **Cuerpo de `register`:** no está en la matriz. Si requiere `campaignRef`, aparecería un hueco de lectura adicional (el empleado no tiene lectura de su propia asignación; `GET /organizations/{id}/campaigns` es solo `ADMINISTRATOR`). No se numera hasta verificar el contrato real.

## 7. Árbol de rutas (T1–T6)

> **Nota (2026-10-07):** La Enmienda 1 de ADR-046 cambia el árbol: entran Donar (acción en `/c/:publicCode`), `/account/donations`, `/tracking` sin parámetros (sustituye a `/tracking/:trackingCode`, que no existe en ningún build; el QR de seguimiento apunta a `/tracking` sin el código) y `/panel/prediction`; dispatch/receive/deliver pasan a ser acciones de `/assets/:assetRef`. T3 queda sustituido (ver su nota). Ver `ADR-046-enmienda-1-alcance-web.md` (APROBADA por Carlos el 2026-10-07T19:17Z). Donde esta sección y la enmienda difieran, manda la enmienda.

### T1 — Criterio de inclusión (CERRADO)

| Categoría | Regla | En el árbol |
|---|---|---|
| Aprobado | Contrato no PENDIENTE y datos de entrada obtenibles | Sí |
| Aprobado-bloqueado | Contrato definido, bloqueado por una dependencia **nombrada** con diseño o dueño (N1, H1, P7, R11, módulo sin código) | Sí, marcado con su bloqueo |
| Fuera de v1 | Contrato PENDIENTE/inexistente, **o** datos de entrada sin ningún camino diseñado (R1, R8) | No; se reabre por el proceso normal |

Mejora explícita sobre el criterio binario de `front-fase1.md` §9: separa "falta una pieza conocida" de "falta el diseño".

### Decisiones

- **T2 — Espacio de nombres (CERRADO).** Rutas de QR (`/c`, `/tracking`, `/assets`) en la raíz, porque sus paths están fijados por la URL canónica de la matriz §4b. Panel bajo `/panel`. `/assets/:assetRef` es ruta **autenticada fuera de `/panel`**: la categoría de guard no depende del prefijo.
- **T3 — SUSTITUIDO por la Enmienda 1 de ADR-046 (E1-2, APROBADA 2026-10-07T19:17Z):** `/assets/:assetRef` en web ofrece lectura, `split`, `dispatch`, `receive` y `deliver`; las acciones logísticas existen en web **y** en móvil. La web no copia el `ActionResolver`: salvo `DELIVERED` (solo lectura), el backend rechaza con 409 lo que no corresponda; con `/me` disponible, las acciones se muestran solo a los roles que pueden ejecutarlas, y el backend sigue autorizando. *Texto original, conservado como registro:* **T3 — `/assets/:assetRef` en web: lectura + `split` únicamente (CERRADO).** `dispatch`/`receive`/`deliver` permanecen en móvil. Motivos: W3 no los asigna a web; `dispatch`/`receive` en CONTRATO CONCEPTUAL; duplicar `ActionResolver` entre repos garantiza divergencia. Si web los necesita en el futuro, primero se define una **fuente contractual de acciones disponibles** (backend), no una copia de la tabla del móvil. La disponibilidad de `split` según el estado del activo **no** se decide aquí (la matriz solo fija `DELIVERED → solo lectura`).
- **T4 — Retorno post-login en memoria (CERRADO).** Sin `?next=` (superficie de open redirect y segunda regla de navegación). Extendido por G-W2 a todas las rutas autenticadas.
- **T5 — Organización sin `organizationId` en URL (CERRADO, bloqueado por N1).** Por pertenencia única (`identity-resumen.md` §1: una `Account` pertenece a cero o una `Organization`) no hace falta `/panel/org/:organizationId`. Pero `GET /organizations/{organizationId}/campaigns` exige el id y el cliente no lo conoce (JWT sin organización, N1). Anotado sin decidir: un endpoint implícito ("convocatorias de mi organización") eliminaría la dependencia, pero es cambio de contrato de backend.
- **T6 — Platform Administrator fuera de web v1 (CERRADO).** Sin R1 no hay pantalla implementable; `grant/revoke` tampoco entra (sin lectura de cuentas; precondición de despliegue). **Consecuencia:** el paso 1 del Golden Path (verificar la organización) no tiene superficie web en v1; el bootstrap administrativo sigue siendo precondición externa de la demo. No es un fallo del frontend: es R1.
- **Registrar activo (CERRADO):** acción transitoria en `PanelHome`, sin ruta propia. Superficie aprobada, bloqueada por contrato/dependencia (P7, cuerpo no especificado, R10, R11).

### `PanelHome` — PROVISIONAL, dependiente de N1

`/panel` es el espacio autenticado común. Mientras N1 no exista, muestra las entradas "Convocatorias de mi organización" y "Registrar activo"; cada superficie resuelve su `403` como estado de pantalla, nunca redirect (mismo patrón que `/home` en `front-fase1.md` §12). No constituye una decisión sobre qué superficie corresponde a cada actor.

### Árbol

```text
paxfide-web v1
│
├── PÚBLICA (paths fijados por URL canónica de QR, matriz §4b)
│   ├── /c/:publicCode            → CampaignPublicPage
│   │                               SSR + OG + noindex (P-W2)
│   │                               aprobado-bloqueado: módulo convocatoria sin código
│   └── /tracking/:trackingCode   → TrackingPage
│                                   aprobado-bloqueado: C2 (H1 + verificación de credencial)
│
├── AUTH
│   └── /login                    → LoginPage (transitoria)
│                                   aprobado-bloqueado: implementación /auth/login
│
├── AUTENTICADA FUERA DE /panel (path fijado por QR)
│   └── /assets/:assetRef         → AssetPage
│       ├── lectura               aprobado-bloqueado: puerto por verificar (§12); R10
│       └── split (transitoria)   aprobado-bloqueado: P7; cuerpo; R10; R11
│
└── AUTENTICADA /panel
    ├── /panel                    → PanelHome (PROVISIONAL, N1)
    │   └── Registrar activo (transitoria) — P7; cuerpo; R10; R11
    └── /panel/campaigns          → OrgCampaignsPage (listado)
                                    aprobado-bloqueado: N1
        ├── Crear convocatoria (transitoria) — N1; R4; R11; firma (ADR-033)
        └── Asignar empleado (transitoria)  — R6; R4; firma; D2 (ADR-033)

FUERA DE WEB v1
├── /panel/platform/**            (R1; grant/revoke = precondición de despliegue)
├── from-donation                 (R8 + HumanAccount + P7)
├── /campaigns (descubrimiento)   (PENDIENTE)
├── Donar                         (PENDIENTE)
├── detalle de convocatoria       (no se añade, §5)
└── /account/donations            (superficie móvil)
```

## 8. Guards web (CERRADO)

### Responsabilidad

> ¿Puede mostrarse esta superficie con el estado de sesión actual?

Se hereda de `front-fase1.md` §10: no es un segundo sistema de autorización; no decide dominio.

### Categorías de ruta

- **Pública:** `/c`, `/tracking`.
- **Auth:** `/login`.
- **Autenticada:** `/assets/**` y `/panel/**` aprobados (la categoría no depende del prefijo, T2).
- **No aprobada:** rutas desconocidas, parámetros estructuralmente inválidos, `/panel/platform/**`, cualquier ruta fuera de v1 y cualquier ruta aprobada-bloqueada no desplegada (G-W1).

Validación estructural de parámetros heredada: no vacío + longitud máxima defensiva; no se inventan formatos de `publicCode`/`assetRef`.

### Decisiones

- **G-W1 — Ruta aprobada-bloqueada no desplegada → No aprobada → 404 (CERRADO).** "Aprobado-bloqueado" es categoría de diseño; en ejecución la ruta existe en el build o no existe. Sin pantalla "Próximamente": no se muestra una superficie que prometa una capacidad inexistente (mismo principio que "sin botón Donar").

  ```text
  Arquitectura: aprobado-bloqueado → Implementación: no existe → Runtime: 404
  ```

- **G-W2 — En web toda URL es un intento fresco (CERRADO).** Con JWT solo en memoria, **cada carga de página arranca en `LOGGED_OUT`** (`RESTORING` resuelve de inmediato; la máquina se mantiene por paridad). La Decisión B de Flutter (descartar ruta restaurada) no aplica: no hay estado restaurado. T4 se extiende a **todas las rutas autenticadas aprobadas**:

  ```text
  URL autenticada → LOGGED_OUT → /login → login correcto → destino retenido en memoria → consumo único
  ```

  Sin `?next=`, sin `localStorage`, sin `sessionStorage`. Un intento nuevo reemplaza el destino; recargar `/login` lo pierde (consecuencia aceptada de W2). El motivo de la Decisión B no se rompe: cada página vuelve a pedir sus datos al backend.

- **G-W3 — Propagar la señal de logout entre pestañas (CERRADO).** Se propaga **únicamente la señal**, nunca el JWT ni ningún dato de sesión. Logout manual → se propaga; expiración T-1 → no se propaga (cada pestaña tiene su propio token). Mecanismo (p. ej. `BroadcastChannel`) a fijar en implementación; la decisión es propagar la señal.

- **G-W4 — Ruta no aprobada → 404 en cualquier estado de sesión (CERRADO).** Nunca redirige a `/login`. La página 404 no es ruta del árbol: no se restaura, no recibe guard, no es destino de nada.

  ```text
  sin sesión para ruta válida      → /login
  ruta inexistente / no aprobada   → 404
  ruta válida, backend rechaza     → 403 como estado de pantalla
  ```

### Tabla de decisión

| Sesión \ Ruta | Pública | `/login` | Autenticada | No aprobada |
|---|---|---|---|---|
| `UNKNOWN`/`RESTORING` (instantáneo) | Permitir | Esperar | Esperar | 404 |
| `AUTHENTICATED` | Permitir | → destino retenido o `/panel` | Permitir | 404 |
| `LOGGED_OUT` | Permitir | Permitir | → `/login` (retiene destino en memoria) | 404 |

### Invariantes

1. Idempotencia y ausencia de bucles (heredado).
2. Las rutas públicas nunca esperan sesión (heredado).
3. El guard solo conoce sesión + categoría de ruta; nunca roles, estado del activo, Outbox ni códigos HTTP (heredado).
4. **Reforzado:** logout limpia la pila autenticada y, además, **tras logout ninguna superficie autenticada puede volver a mostrarse desde la caché de navegación del navegador (bfcache)**. CERRADO como invariante; mecanismo (`Cache-Control`, `pageshow`, `no-store` u otro) pendiente de implementación y a verificar contra el comportamiento real del navegador.
5. `403` no provoca redirección (heredado).
6. El guard reacciona a cambios de `SessionState`, no a respuestas HTTP; el `401` de tracking nunca toca la sesión (heredado).

### Consecuencia de C1

El guard es **exclusivamente de cliente**. El servidor Next.js no conoce la sesión (W2 + C1): no se usa middleware de servidor para autenticación; la respuesta del servidor para una URL autenticada es siempre el mismo shell; la validación estructural ocurre en cliente. La seguridad real sigue siendo el backend.

## 9. Pantallas (CERRADO)

### P-W2 — `/c/:publicCode`: `noindex` para todas en v1 (CERRADO)

```text
/c/:publicCode
├── SSR: sí
├── OG: sí
├── noindex: sí
└── descubrimiento mediante buscador: no
```

Motivo: la indexación por buscador es descubrimiento, y una convocatoria privada-por-enlace nunca debe aparecer en descubrimiento (`convocatoria-resumen.md`). No está confirmado que `ConvocatoriaReadModel` exponga `visibility`, así que no se fabrica una política condicional sobre un campo no garantizado. OG se mantiene (no requiere indexación; compartir el enlace es el uso previsto). Se reabre cuando exista `GET /public/campaigns`.

### P-W3 — "No encontrada" en `/c` (CERRADO como comportamiento; HTTP PENDIENTE)

Ruta válida con código inexistente = estado de pantalla de `CampaignPublicPage`, **no** el 404 de G-W4. En SSR la respuesta HTTP debe ser coherente con ese estado para no indexar una página vacía. El código concreto (404, 410 u otro) queda **PENDIENTE** de la semántica de backend (ADR-037 §2.5 es propuesta no confirmada).

### Matriz de pantallas

| Pantalla | Ruta | Actor | Datos (estado matriz) | Estados | Acciones | Bloqueo |
|---|---|---|---|---|---|---|
| `CampaignPublicPage` | `/c/:publicCode` | Visitante | `GET /public/campaigns/{publicCode}` (DISEÑO CERRADO); narrativa `GET .../narrative` (DEFINIDO) | carga; contenido; no encontrada (P-W3); error; narrativa no disponible | Ninguna. **Sin botón Donar** | Módulo `convocatoria`; narrativa: ADR-036 |
| `TrackingPage` | `/tracking/:trackingCode` | Donante | tracking + narrativa (YA EXISTE) | Heredados de `front-fase1.md` §13: `401` único "código no válido o expirado"; narrativa `PENDING` con "Actualizar" manual | Actualizar narrativa | C2 → 404 hasta resolverse (G-W1) |
| `LoginPage` | `/login` | Cualquiera con cuenta | `POST /auth/login` (CERRADO, sin implementar) | formulario; enviando; credenciales inválidas (**un solo mensaje**, indistinguibilidad ADR-037 §2.5); error de red | Enviar; reintento tras error de red seguro (login sin efectos duplicables). Sin enlace "crear cuenta" | Implementación; `TokenIssuerPort` |
| `AssetPage` | `/assets/:assetRef` | `EMPLOYEE` | `GET /physical-assets/{assetRef}` (DEFINIDO): `assetRef, lifecycleStatus, currentCustodianRef, currentLocation, quantity, unitOfMeasure, campaignRef` | carga; contenido; `DELIVERED` solo lectura; `403`; `404`; error | `split` (transitoria, §10) | Puerto por verificar; P7; cuerpo de `split`; R10; R11 |
| `PanelHome` | `/panel` | Cualquiera autenticado | ninguno | normal | Entrada a `/panel/campaigns`; Registrar activo (transitoria, §10). Tras éxito → `/assets/{assetRef}` devuelto | N1 (provisional); P7; cuerpo de `register`; R10; R11 |
| `OrgCampaignsPage` | `/panel/campaigns` | `ADMINISTRATOR` | `GET /organizations/{organizationId}/campaigns` (DEFINIDO): `ConvocatoriaAdminReadModel`, paginado | carga; lista; vacía; `403`; error | Crear convocatoria (transitoria, §10; tras éxito muestra el enlace `/c/{publicCode}`); Asignar empleado (transitoria) | N1; R4; R11; firmas (ADR-033); R6; D2 |

**Superficies que no son rutas:** página 404 (G-W4), UI de espera, formularios transitorios. Ninguna se restaura ni recibe guard.

Precisiones:
- Los mensajes de los `409` de Convocatoria (`CampaignClosedException`, `EmployeeAlreadyAssignedException`, etc.) dependen del mapeo de ADR-037 §2.5, **no confirmado**. No se redactan textos hasta que lo esté.
- `responsables{accountId, fullName}` solo se muestra al `ADMINISTRATOR` de la misma organización, dentro del perímetro de `ConvocatoriaAdminReadModel`; no se reutiliza en otra pantalla (ADR-037 §2.2).
- El QR de la convocatoria recién creada no se muestra (generación de imagen pendiente); solo el enlace.
- Presencia arquitectónica ≠ despliegue: `register`, crear convocatoria y `split` están aprobados como superficie, pero su despliegue está condicionado por R11 (y el resto de su columna "Bloqueo").

## 10. Comandos web sin Outbox (P-W1, CERRADO)

### P-W1 — Esquema

- **`commandId` generado en cliente por intención**, solo en memoria mientras el formulario está abierto; nunca persistido (coherente con W2).
- **Condición (R11):** solo es válido si el contrato del comando acepta `commandId` y el backend garantiza idempotencia por él. `split`, `register` y crear convocatoria **no se despliegan en web** hasta verificarlo (G-W1 → 404).
- **Nunca reintento automático.**
- **Recarga → la intención (y su `commandId`) se pierde.** Deuda aceptada del mismo tipo que W2.

### P-W1a — Clasificación de respuestas

| Respuesta | Tratamiento |
|---|---|
| Timeout / conexión cortada / sin respuesta | **Ambiguo** |
| 5xx | **Ambiguo** (un error del servidor no demuestra que la operación no se ejecutó) |
| 4xx salvo 401 | **Determinista, rechazado** |
| 401 con JWT | **Determinista + T-1 → `LOGGED_OUT`**; la intención en memoria se pierde |
| 2xx | **Éxito** |

No modifica la regla de tracking: el `401` de `/tracking` no toca la sesión.

### P-W1b — Máquina del comando web

| Estado | Salidas |
|---|---|
| enviando | → éxito / rechazado / ambiguo (P-W1a) |
| rechazado | → cerrar / nueva intención con **nuevo** `commandId` (nunca reenviar el rechazado) |
| ambiguo | → Reintentar con el **mismo** `commandId` / **Cerrar** con advertencia |
| éxito | terminal |

```text
AMBIGUO
   ├── Reintentar → mismo commandId
   └── Cerrar
          ├── advertencia: "no sabemos si la operación se realizó; revísalo antes de repetirla"
          ├── descartar commandId
          └── no enviar nada
```

"Cerrar" no significa "la operación falló": significa que el usuario abandona la intención sin enviar otra petición. Lenguaje heredado de `front-fase1.md` §7: "no pudimos confirmar", nunca "falló" ni "fue realizada".

### Limitación específica de `split`

En web no se ofrece "Verificar estado" para `split`: `PhysicalAssetOperationalReadModel` excluye la genealogía (`parentAssetRef`/`rootAssetRef`, ADR-037 §2.2) y `lifecycleStatus` no tiene un valor que refleje la división. No hay forma honesta de comprobar desde web si un `split` ocurrió. **Sin idempotencia contractual (R11), `split` queda fuera de web v1.**

## 11. Estrategia de tests (CERRADO)

### Auditoría de salidas (regla 2.6)

| Máquina | Estado | Salidas | Completa |
|---|---|---|---|
| Sesión | `UNKNOWN`/`RESTORING` | → `LOGGED_OUT` de inmediato (W2) | ✅ |
| | `AUTHENTICATED` | → `LOGGED_OUT` por logout, T-1 o señal de otra pestaña (G-W3) | ✅ |
| | `LOGGED_OUT` | → `AUTHENTICATED` por login | ✅ |
| Destino retenido | retenido | → consumido tras login / reemplazado por intento nuevo / perdido al recargar | ✅ |
| Comando web | enviando | → éxito / rechazado / ambiguo | ✅ |
| | rechazado | → cerrar / nueva intención con nuevo `commandId` | ✅ |
| | ambiguo | → reintento mismo `commandId` / Cerrar con advertencia | ✅ |
| | éxito | terminal | ✅ |
| Narrativa | `PENDING` | → Actualizar | ✅ |

### Niveles

1. **Unitarios de lógica pura:** tabla de guards (3 estados × 4 categorías, columna "No aprobada" = 404 en los tres) + idempotencia; clasificador de rutas (`/assets/**` Autenticada fuera de `/panel`; `/panel/platform/**`, `/tracking/**` mientras C2 siga abierto y parámetros inválidos → No aprobada); destino retenido (consumo único, reemplazo, descarte); clasificador de respuestas de comando (cada fila de P-W1a); handler del `401` (T-1 con JWT; sin efecto en `/tracking`); receptor de la señal de logout.
2. **Estados de pantalla con cliente HTTP falso:** las seis pantallas en cada estado de la matriz de §9 y las tres salidas de cada formulario de comando.
3. **Flujos en navegador real automatizado con backend falso** (necesario en web: bfcache, comunicación entre pestañas y SSR solo existen en un navegador real; herramienta a elegir en implementación):
   - recarga en `/panel/campaigns` → `/login` → vuelve a `/panel/campaigns` (G-W2);
   - logout en pestaña A → pestaña B pasa a `LOGGED_OUT` (G-W3);
   - logout → botón atrás → no se ve contenido autenticado (invariante 4 reforzado);
   - timeout al crear convocatoria → ambiguo → reintento: se comprueba **en la petición real** que el `commandId` es idéntico (regla 2.5);
   - 4xx → nueva intención: se comprueba en la petición que el `commandId` es **distinto**;
   - `/c` con SSR → la respuesta contiene `noindex` y metadatos OG;
   - `/panel/platform/x` con y sin sesión → 404.
4. **Seguridad (C1, W2, G-W3):** ninguna petición al origen Next.js lleva el JWT (inspección de cabeceras durante los flujos del nivel 3); tras el login no hay token en `localStorage`, `sessionStorage`, cookies ni IndexedDB; los mensajes entre pestañas contienen solo la señal; chequeo estático de dependencias: el código de servidor de Next.js (route handlers, server actions, middleware) no importa el módulo de sesión ni el cliente autenticado (equivalente web de ArchUnit).

### Aserciones negativas obligatorias (regla 2.5) — parte del DoD

- una ruta pública nunca espera ni redirige;
- el guard nunca lee roles, estado del activo ni códigos HTTP;
- una ruta no aprobada nunca redirige a `/login`;
- un comando ambiguo nunca se reintenta automáticamente;
- un comando rechazado nunca se reenvía con el mismo `commandId`;
- un 5xx nunca se clasifica como determinista;
- el `commandId` y el destino retenido nunca se persisten;
- el JWT nunca llega al servidor Next.js;
- el `401` de tracking nunca modifica la sesión;
- la expiración T-1 de una pestaña nunca se propaga a las demás;
- `split`/`register`/crear convocatoria no se despliegan mientras R11 no esté verificado (G-W1 → 404).

### Pendiente o fuera del cierre

- **Código HTTP de "no encontrada" en `/c`:** test pendiente hasta que backend lo confirme (P-W3). No se sustituye por "cualquier cosa que no sea 200".
- **Mecanismo concreto de bfcache:** el test verifica el invariante, no la técnica.
- **E2E contra backend real:** fuera del cierre, mismo criterio que `front-fase1.md` §14 (sobre contratos sin implementar produciría falsos positivos). No descartado del proyecto.

## 12. Por verificar contra el repositorio

- **`PhysicalAssetOperationalReadPort`.** El contrato HTTP `GET /physical-assets/{assetRef}` y `PhysicalAssetOperationalReadModel` están definidos en la matriz §4b. `contract-wiring-review.md` §P4 registró que no existían el puerto ni su adaptador (y que no debe reutilizarse `AssetHistoryProjection`). Su existencia y wiring actuales se verificarán contra el código antes de atribuirlo como hueco de implementación.
- **Contrato de credencial de tracking** (path vs. `Authorization: Bearer`): ver C2.
- **Aceptación de `commandId` e idempotencia** en `split`, `register` y crear convocatoria: ver R11.
- **Cuerpo de `register`** y si requiere `campaignRef`: ver §6 "Anotado, no numerado".

## 13. Tabla de cierre

| Elemento | Estado |
|---|---|
| W0 Next.js | CERRADO |
| W1 `/c` y `/tracking` en web | CERRADO |
| W1-bis `/assets/:assetRef` en web (autenticada) | CERRADO |
| W2 JWT en memoria + T-1 | CERRADO provisionalmente |
| W3 PhysicalAsset en web (precisión §1) | CERRADO |
| C1 no BFF accidental | CERRADO |
| C2 `/tracking` client-side + noindex | PROPUESTA, bloqueada por H1 + verificación de credencial |
| T1 categorías de inclusión | CERRADO |
| T2 `/panel` separado de rutas QR | CERRADO |
| T3 `/assets` lectura + `split` | **SUSTITUIDO** por la Enmienda 1 de ADR-046 (E1-2): lectura + `split` + dispatch/receive/deliver |
| T4 retorno post-login en memoria | CERRADO (extendido por G-W2) |
| T5 organización sin `organizationId` en URL | CERRADO, bloqueado por N1 |
| T6 Platform Administrator fuera de v1 | CERRADO |
| Registrar activo en `PanelHome` | CERRADO: acción transitoria, bloqueada |
| `PanelHome` | PROVISIONAL, dependiente de N1 |
| G-W1 ruta bloqueada/no desplegada | CERRADO: 404 |
| G-W2 destino post-login | CERRADO: todas las rutas autenticadas, memoria, consumo único |
| G-W3 logout entre pestañas | CERRADO: propagar señal, nunca credenciales |
| G-W4 rutas no aprobadas | CERRADO: 404 |
| Invariante 4 reforzado (bfcache) | CERRADO como invariante; mecanismo pendiente |
| P-W1 comandos sin Outbox | CERRADO, condicionado a R11 |
| P-W1a clasificación de respuestas | CERRADO |
| P-W1b salida "Cerrar" del ambiguo | CERRADO |
| `split` sin idempotencia contractual | NO SE DESPLIEGA |
| P-W2 `/c` noindex + OG | CERRADO |
| P-W3 estado "no encontrada" | CERRADO; código HTTP PENDIENTE backend |
| Estrategia de tests | CERRADO |
| R1 discovery de organizaciones | HUECO BACKEND (paquete de lecturas) |
| R6 lectura de miembros/empleados | HUECO BACKEND (paquete de lecturas) |
| R8 lectura específica para `from-donation` | HUECO BACKEND (paquete de lecturas) |
| R7 discovery de PhysicalAsset | RESUELTO para entrada por QR |
| R4 idempotencia de comandos administrativos | HUECO |
| R9 registro de organización | HUECO: sin contrato HTTP en la matriz |
| R10 autorización lectura/escritura de Asset | HALLAZGO BACKEND |
| R11 idempotencia por `commandId` | HALLAZGO BACKEND |
| N1 principal/capacidades | DEPENDENCIA BACKEND |
| Detalle de convocatoria | NO añadir todavía |
| `GET /account/donations` | FUERA de `paxfide-web` |
| `PhysicalAssetOperationalReadPort` | POR VERIFICAR contra repositorio |

Consecuencia estructural:

```text
Frontend Fase 2
  → define superficie, rutas, guards, pantallas y tests
  → NO puede implementar ninguna pantalla autenticada de extremo a extremo hoy
  → faltan Read Contracts de descubrimiento (R1 / R6 / R8)
  → y dependencias N1, R4, R9, R10, R11, HumanAccount + P7
```

## 14. Estado final de `paxfide-web` v1

| Bloque | Estado |
|---|---|
| Decisiones de entrada | ✅ Cerrado — W2 provisional |
| Inventario contractual | ✅ Cerrado |
| Árbol de rutas | ✅ Cerrado — `PanelHome` provisional (N1) |
| Guards | ✅ Cerrado — mecanismo bfcache pendiente |
| Pantallas | ✅ Cerrado — HTTP de "no encontrada" pendiente |
| Comandos sin Outbox | ✅ Cerrado — despliegue condicionado a R11 |
| Tests | ✅ Estrategia cerrada; E2E fuera del cierre |

```text
PENDIENTES REGISTRADOS
├── C2 / H1 trackingCode en web .............. ⚠️ decisión pendiente + verificación de credencial
├── R1 / R6 / R8 lecturas de descubrimiento .. ⚠️ backend
├── R4 idempotencia comandos administrativos . ⚠️ backend
├── R9 registro de organización .............. ⚠️ backend
├── R10 autorización lectura vs escritura .... ⚠️ backend
├── R11 commandId + idempotencia ............. ⚠️ backend
├── N1 principal/capacidades ................. ⚠️ backend
├── HumanAccount + P7 ........................ ⚠️ backend (golden-path.md §5)
├── HTTP de "no encontrada" en /c ............ ⚠️ backend
├── Mecanismo bfcache ........................ ⚠️ implementación
└── PhysicalAssetOperationalReadPort ......... ⚠️ verificar contra repositorio
```

## 15. Candidatos a ADR

- **ADR del frontend web:** W0 (runtime Node nuevo, regla 3.5) + W2 + C1 + G-W2 + G-W3 + P-W1/P-W1a/P-W1b. Puede consolidarse con las decisiones pendientes de ADR de `front-fase1.md` (T-1, máquina del Outbox con T-2, R2 `PendingIntent`).
- R1/R6/R8, R4, R9, R10, R11 y N1 corresponden a backend (Identity/Convocatoria/PhysicalAsset), no al ADR del frontend.

## Orden de trabajo seguido

```text
Decisiones de entrada W0–W3
  → Inventario contractual
  → Árbol de rutas (T1–T6)
  → Guards web (G-W1–G-W4)
  → Pantallas (P-W1–P-W3)
  → Estrategia de tests
  → CIERRE DE DISEÑO paxfide-web v1
```
