# Delta documental — `front-fase2`: uso de N1 (`GET /api/v1/me`) en `paxfide-web`

**Estado:** **APROBADO** por Carlos el 2026-10-05, completo (D-N1-1 a D-N1-4 y §1–§7). **Aprobar este delta no vuelve normativa a N1:** se distinguen tres estados — diseño de frontend aprobado (este delta), contrato N1 congelado (ficha) y normativa pendiente de la Enmienda 1 de ADR-041. No autoriza implementación: `/panel` y `/panel/campaigns` siguen aprobado-bloqueadas (§5).
**Fecha:** 2026-10-05.
**Naturaleza:** delta de diseño sobre `claude/front-fase2.md` (versión consolidada del 2026-09-27). **No es un ADR, no modifica ADR-046 y no autoriza implementación.** No aprueba la Enmienda 1 de ADR-041 ni vuelve normativas ID-01, T-33 o N1.
**Fuente del contrato:** `claude/ficha-N1-quien-soy.md` (CONGELADA, pendiente de incorporación normativa, 2026-10-05).

---

## 1. Qué cambia y qué no

| Elemento de `front-fase2` | Hoy | Con este delta |
|---|---|---|
| `PanelHome` (§7, §9) | PROVISIONAL: muestra todas las entradas y cada una resuelve su 403 como estado de pantalla | Deja de ser provisional: muestra las entradas según el principal de `/me` (§3.1). Queda **aprobado-bloqueado** (§5) |
| `OrgCampaignsPage` (§9) y T5 (§7) | Bloqueada por N1: no puede hacer su primera petición | Obtiene `organizationId` de `/me` (§3.2). Sigue **aprobado-bloqueado** (§5) |
| Sesión (§4, W2; ADR-046 D2) | JWT solo en memoria | El principal de `/me` vive **solo en memoria**, ligado a la sesión (§3.3) |
| Guards (§8) | El guard conoce solo sesión + categoría de ruta (invariante 3) | **Sin cambio.** El guard no lee `/me` (§3.4) |
| `AssetPage` (§9) | Entrada por QR; el backend autoriza | **Sin cambio.** No consulta `/me` |
| Destino post-login (§8, ADR-046 D4) | Destino retenido o `/panel` | **Sin cambio** |

## 2. Principio que rige todo el delta (HEREDADO)

La respuesta de `/me` sirve **solo para representar**: qué entradas mostrar y qué `organizationId` poner en el path. **No es autorización.** Cada endpoint sigue autorizando en backend; si un endpoint responde 403, ese 403 manda sobre lo que dijo `/me` y se muestra como estado de pantalla (`front-fase2` §1, invariante 5; ficha N1 §5; `hallazgos-front-fase2.md` N1, "Qué NO hacer").

## 3. Diseño

### 3.1 `PanelHome` (`/panel`)

- Al entrar, pide `GET /api/v1/me` (política de refresco: D-N1-3).
- Muestra cada entrada según la regla de D-N1-1, sobre `roles` y `platformAuthority`.
- Entradas existentes en el árbol aprobado (`front-fase2` §7), sin añadir ninguna:

| Entrada | Destino | Autorización del destino según su contrato | Fuente |
|---|---|---|---|
| "Convocatorias de mi organización" | `/panel/campaigns` | `ADMINISTRATOR` | `front-fase2` §5.D y §9; ficha CV-02/CV-03 (autorización exclusiva de `ADMINISTRATOR`) |
| "Registrar activo" (acción transitoria) | `POST /physical-assets/register` | `EMPLOYEE`; `REPRESENTATIVE` como respaldo | `front-fase2` §2 (W3) y §5.E; enmienda ADR-032. Caso `REPRESENTATIVE`: D-N1-2 |

- `platformAuthority` no añade entradas: Platform Administrator está fuera de web v1 (T6). Una cuenta con `platformAuthority` y sin organización no tiene entradas en v1.
- Estados de la pantalla:

| Estado | Disparador | Presentación |
|---|---|---|
| Carga | `/me` en curso | `LoadingState` (UX §6) |
| Con entradas | `/me` 200 y la regla de D-N1-1 da al menos una entrada | Las entradas |
| **Sin entradas** | `/me` 200 y ninguna entrada aplica (p. ej. cuenta sin organización) | Estado neutro. **Texto PENDIENTE** del delta de UX (§6). No sugiere causas, no menciona permisos ni "próximamente" |
| Error | Red o 5xx en `/me` | `ErrorState` con "Reintentar" (es una lectura) |
| 401 | `/me` 401 (JWT inválido, expirado o cuenta `INACTIVE`) | T-1 → `LOGGED_OUT` (HEREDADO, P-W1a y T-36). Sin pantalla propia |
| Respuesta inválida | `/me` 200 que viola la ficha (falta `roles`, `roles` no es un array, o `roles` no vacío sin `organizationId`) | `ErrorState`. **No se infiere** ningún valor faltante (§3.5) |

### 3.2 `OrgCampaignsPage` (`/panel/campaigns`)

- Toma `organizationId` del principal de `/me` y lo usa en `GET /organizations/{organizationId}/campaigns`. El `organizationId` **no** se pone en la URL del frontend (T5 se mantiene: sin `/panel/org/:organizationId`).
- La página **no** filtra por rol antes de llamar. Si el principal no es `ADMINISTRATOR`, el backend responde 403 y se muestra `ForbiddenState`. El frontend no fabrica ese 403.
- **`organizationId` ausente** (cuenta sin organización que llega por URL directa): D-N1-4.
- Acciones transitorias (crear convocatoria, asignar empleado, "Designarme responsable" CV-03): **sin cambio**; siguen con sus bloqueos propios (R4, R6, R11, firmas, Enmienda 1; `delta-front-fase2-rev3.md` K-6).

### 3.3 Dónde vive el principal

- Solo en memoria, en el mismo módulo de sesión (ADR-046 D2). Nunca en `localStorage`, `sessionStorage`, cookies, IndexedDB ni la URL.
- Se descarta en toda transición a `LOGGED_OUT` (logout manual, T-1, señal de otra pestaña).
- **No viaja entre pestañas:** el mensaje de `BroadcastChannel` sigue siendo solo la señal (G-W3). Cada pestaña pide su propio `/me`.
- No se registra en logs ni en analítica (ya excluido para el JWT; se extiende al principal).

### 3.4 Guards: sin cambio (explícito)

- El guard sigue conociendo **solo** estado de sesión + categoría de ruta (invariante 3 de §8). **No** lee `/me`, roles ni `organizationId`.
- `/me` no es una ruta del frontend ni una superficie: es una lectura que hacen las páginas.
- Una ruta autenticada aprobada **no** pasa a 404 ni a `/login` por lo que diga `/me`. La falta de permisos sigue siendo 403 como estado de pantalla, decidido por el backend.

### 3.5 Lo que el frontend no hace con `/me`

- No deduce `organizationId` ni roles de ninguna otra fuente (JWT, respuesta de otro endpoint).
- No completa campos ausentes ni corrige combinaciones inconsistentes: una respuesta que viola la ficha es un error.
- No oculta ni habilita acciones dentro de una página por rol más allá de las entradas de §3.1 (la disponibilidad de cada acción sigue siendo D5 + bloqueos propios).
- No usa `platformAuthority` para nada en v1 (T6).

## 4. Decisiones abiertas (requieren respuesta de Carlos)

### D-N1-1 — Regla para mostrar una entrada en `PanelHome`

| Opción | Contenido |
|---|---|
| **(a)** — recomendada | Una entrada se muestra si el contrato de su destino autoriza **al menos uno** de los roles del principal (tabla de §3.1). Es representación del contrato, no una política nueva |
| (b) | Mostrar siempre todas las entradas (como hoy) y dejar que cada una resuelva su 403. N1 solo serviría para `organizationId`; `PanelHome` seguiría provisional |

### D-N1-2 — `REPRESENTATIVE` y "Registrar activo"

El contrato de `register` admite `REPRESENTATIVE` como respaldo, pero por **R10** un `REPRESENTATIVE` recibe 403 al leer el activo que acaba de registrar (y tras el éxito la acción navega a `/assets/{assetRef}`). `front-fase2` §6 dice: "no se afirma que el flujo de `REPRESENTATIVE` esté soportado en web".

| Opción | Contenido |
|---|---|
| **(a)** — recomendada | No mostrar "Registrar activo" a un principal cuyo único rol aplicable sea `REPRESENTATIVE` mientras R10 siga abierto. Se revisa al cerrar R10 |
| (b) | Mostrarla, porque el contrato de escritura lo autoriza, aceptando que el flujo termina en un 403 |

### D-N1-3 — Cuándo se pide `/me`

| Opción | Contenido |
|---|---|
| **(a)** — recomendada | Se pide al entrar en cada página de `/panel` que lo necesite. El último valor se guarda en memoria con la sesión solo para no parpadear entre páginas; nunca se usa sin volver a pedirlo. Coherente con "un cambio de rol se refleja en la siguiente llamada" (ficha N1) |
| (b) | Se pide una vez tras el login y se reutiliza hasta `LOGGED_OUT` (máximo 1 h por `exp`). Un cambio de rol no se ve en la interfaz hasta volver a iniciar sesión; el backend sigue autorizando |

### D-N1-4 — `/panel/campaigns` sin `organizationId`

Una cuenta sin organización no ve la entrada (D-N1-1 (a)), pero puede llegar por URL directa.

| Opción | Contenido |
|---|---|
| **(a)** — recomendada | No se llama al backend (no hay `organizationId` que poner). La página muestra el mismo estado neutro "sin entradas" de §3.1, con texto PENDIENTE del delta de UX. No simula un 403 que el backend no ha dado |
| (b) | Mostrar `ForbiddenState` ("No tienes acceso a este recurso."). Más simple, pero presenta como respuesta del backend algo que el frontend decidió |

## 5. Estado de las rutas tras el delta

| Ruta | Antes | Después | Se desbloquea cuando |
|---|---|---|---|
| `/panel` (`PanelHome`) | PROVISIONAL (N1) | **Aprobado-bloqueado** | Enmienda 1 de ADR-041 aprobada (N1 normativa) **y** `GET /api/v1/me` implementado en backend (`feat/identity-adr-038` en `develop` + endpoint en `api`) |
| `/panel/campaigns` (`OrgCampaignsPage`) | Aprobado-bloqueado (N1) | Aprobado-bloqueado | Lo mismo que `/panel` **más** su contrato de lectura (`GET /organizations/{id}/campaigns`) implementado |

Mientras tanto, por D5 / G-W1, ambas responden 404 en cualquier build desplegado. **Este delta no habilita ninguna superficie.**

## 6. Consecuencias en otros documentos (no ejecutadas)

- **`diseno-ux-contractual-web-v1.md`:** necesita un delta para `PanelHome` (contenido y estados de §3.1), el texto del estado "sin entradas" y, según D-N1-4, el de `/panel/campaigns` sin organización. Hoy el contenido de `/panel` está fuera de su alcance.
- **`hallazgos-front-fase2.md`:** N1 pasa de "sin ficha" a "ficha CONGELADA, pendiente de incorporación normativa".
- **Plan de implementación:** cuando se desbloquee, hace falta una tarea nueva (cliente de `/me` + `PanelHome` + `organizationId` en `OrgCampaignsPage`) con su plan aprobado (regla 3.4). Este delta no la crea.
- **ADR:** no requiere ADR nuevo (regla 3.5): no introduce dependencias, no cambia aggregates ni puertos, no introduce concurrencia ni reintentos. Aplica ADR-046 D2 tal como está.

## 7. Tests que exigirá la implementación (para el futuro plan)

- Unitarios de la regla de entradas (D-N1-1) con cada combinación de `roles` y `platformAuthority`, incluido `roles: []`.
- **Negativos:** el guard nunca lee `/me`; el principal nunca se persiste ni viaja por `BroadcastChannel`; una respuesta de `/me` inconsistente produce `ErrorState` y no se completa; `OrgCampaignsPage` sin `organizationId` no hace ninguna petición.
- Un 403 de `GET /organizations/{id}/campaigns` se muestra como `ForbiddenState` aunque `/me` diga `ADMINISTRATOR`.
- `LOGGED_OUT` descarta el principal (las tres causas).
- Según D-N1-3 (a): un cambio de roles entre dos visitas a `/panel` se refleja en la segunda.

## 8. Registro de aprobación

| Decisión | Respuesta | Fecha |
|---|---|---|
| D-N1-1 | (a) Una entrada se muestra si el contrato de su destino autoriza al menos uno de los roles del principal | 2026-10-05 |
| D-N1-2 | (a) Sin "Registrar activo" para un principal cuyo único rol aplicable es `REPRESENTATIVE`, mientras R10 siga abierto | 2026-10-05 |
| D-N1-3 | (a) `/me` se pide al entrar en cada página de `/panel` que lo necesite; el valor en memoria solo evita parpadeo | 2026-10-05 |
| D-N1-4 | (a) Sin `organizationId`: no se llama al backend; estado neutro "sin entradas", texto PENDIENTE del delta de UX | 2026-10-05 |
| Delta completo | APROBADO, sin cambios sobre el texto revisado | 2026-10-05 |
