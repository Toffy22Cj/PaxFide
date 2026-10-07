# Ficha N1 — `GET /api/v1/me` (lectura del principal propio)

**Naturaleza:** ficha de contrato HTTP, con el mismo método y las mismas etiquetas que las fichas de contratos API de Fase 6 (§0 de ese documento). **No es normativa**, no es un ADR y no autoriza código.
**Estado: CONGELADO (pendiente de incorporación normativa)** desde el 2026-10-05, tras Q-N1-1 a Q-N1-4 (§9). No llega a CERRADO porque el prefijo `/api/v1` (DH-01), `ProblemDetail` (DH-02) y los códigos 401/403 (DH-51) son [DHR] en borrador hasta que se apruebe la Enmienda 1 de ADR-041.
**Fecha:** 2026-10-05.
**Origen:** hallazgo N1 de `hallazgos-front-fase2.md` §4 (severidad alta, dueño Identity). Decisión de Carlos del 2026-10-05: es la siguiente ficha a redactar (`delta-front-fase2-rev3.md`).

---

## 1. Problema que resuelve

Tras el login, el cliente no sabe a qué organización pertenece el usuario ni qué roles tiene, porque el JWT es mínimo por diseño (`sub`, `iat`, `exp`, firma). Consecuencias en web (`hallazgos-front-fase2.md` N1):

1. `PanelHome` no sabe qué entradas mostrar y queda en modo provisional ("prueba y error" con 403).
2. `/panel/campaigns` no puede hacer su primera petición: `GET /organizations/{organizationId}/campaigns` exige un `organizationId` que el cliente no tiene.

## 2. Fuentes aplicables

| Fuente | Estado | Qué aporta |
|---|---|---|
| ADR-038 §2.7 | Aprobado e implementado (rama `feat/identity-adr-038`) | `IdentityPrincipalPort.resolvePrincipal(accountId) → AuthorizationPrincipal \| InactiveAccountException`; JWT mínimo; el principal se resuelve en cada petición autenticada |
| `contracts/.../AuthorizationPrincipal.java` | [IMPL], informativo | `record AuthorizationPrincipal(accountId, organizationId?, roles: Set<AuthorizationRole>, platformAuthority?)` |
| `identity-resumen.md` §1, §5 | Fuente conceptual de ADR-038 | Pertenencia única (cero o una `Organization`); `Membership.roles` nunca vacío; forma final del principal; efecto inmediato de los cambios de rol |
| `api-contract-matrix.md`, regla 5 | Matriz | Los roles no viajan en el token para que un cambio de rol tenga efecto inmediato |
| ADR-041 §2.2, §5 | Aprobado | Separación de mecanismos de autenticación; el frontend representa, el backend autoriza |
| Ficha T (T-36, T-34) | [DHR] en borrador | JWT en `Authorization: Bearer`; 401/403; cuenta `INACTIVE` → 401; nulos omitidos (`NON_NULL`) |
| `hallazgos-front-fase2.md` N1 | Hallazgo | "Qué NO hacer" y criterio de cierre |

## 3. Elemento por elemento

| Elemento | Contenido | Respaldo |
|---|---|---|
| Método | `GET` | Lectura sin efectos |
| Ruta | `/me` → `GET /api/v1/me` | [DHR] Q-N1-1 (2026-10-05) |
| Prefijo | `/api/v1` | [DHR] DH-01 |
| Autenticación | JWT, `Authorization: Bearer <jwt>` | [DHR] Q-T36-1 |
| Autorización | **Ninguna política de rol ni de organización**: el recurso es el principal del propio llamador. No hay parámetro de ruta ni de query que permita pedir otro principal | [N] ADR-038 §5 (`resolvePrincipal()` sin `RoleAuthorizationPolicy`) |
| Operación | El principal ya resuelto por el filtro JWT en esta misma petición (`IdentityPrincipalPort.resolvePrincipal`). **No requiere un puerto nuevo** | [N] ADR-038 §2.7 |
| Response de éxito: código | `200 OK` | [DHR] códigos ratificados |
| Response de éxito: cuerpo | JSON con exactamente `accountId` (string), `organizationId` (string), `roles` (array de strings con los nombres de `AuthorizationRole`, como en ID-12) y `platformAuthority` (string). **Ningún otro campo** (`email`, `fullName`, datos de la organización) forma parte del contrato | [DHR] Q-N1-2 (2026-10-05); [DHR] Q-ID12-1 (formato de `roles`) |
| Cuenta sin organización / sin autoridad de plataforma | `organizationId` y `platformAuthority` se **omiten** cuando son nulos (`NON_NULL`). `roles` está **siempre** presente; es `[]` si la cuenta no pertenece a ninguna organización | [DHR] Q-N1-3 (2026-10-05); [DHR] DH-55 / T-34 |
| DTO | DTO propio de `api`; nunca se serializa `AuthorizationPrincipal` de `contracts` directamente (regla general: no exponer tipos internos como DTO de API) | Prompt maestro, reglas de código |
| Cuenta `INACTIVE` con JWT válido | `401` `ProblemDetail` (`resolvePrincipal` lanza `InactiveAccountException`) | [N] ADR-038 §2.7; [DHR] Q-T36-2 |
| Sin JWT, JWT inválido o expirado | `401` `ProblemDetail` | [DHR] DH-51 |
| 403 | No aplica: no hay recurso ajeno que proteger | Consecuencia de la autorización de arriba |
| Caché | `Cache-Control: no-store` en la respuesta 200 | [DHR] Q-N1-4 (2026-10-05) |
| `commandId` | No aplica (lectura) | Ficha T-33 |
| Frescura | Se resuelve en cada petición; un cambio de rol o de organización se refleja en la siguiente llamada sin nuevo login | [N] ADR-038 §2.7; matriz regla 5 |

## 4. Preguntas cerradas

### Q-N1-1 — Ruta

| Opción | Ventaja | Inconveniente |
|---|---|---|
| **(a) `GET /api/v1/me`** — recomendada | Corta; convención común para "el recurso del llamador"; no sugiere que exista `/accounts/{id}` | Ninguna relevante |
| (b) `GET /api/v1/accounts/me` | Encaja si algún día existe un recurso `accounts` | Sugiere un recurso `accounts/{id}` que no está diseñado |
| (c) `GET /api/v1/auth/principal` | Agrupa con `POST /auth/login` | Mezcla "autenticarse" con "leer mi estado"; expone un término interno (`principal`) |

### Q-N1-2 — Campos de la respuesta

| Opción | Contenido |
|---|---|
| **(a) Los cuatro del principal** — recomendada | `accountId`, `organizationId`, `roles`, `platformAuthority`. Es exactamente lo que el backend usa para autorizar, sin datos personales |
| (b) Los cuatro + `email` y/o `fullName` | Permite mostrar "Hola, Ana" en el Shell. **En contra:** `email` y `fullName` son PII; la exposición de `fullName` está abierta en Identity (`identity-resumen.md` §7); el Shell aprobado (`diseno-ux-contractual-web-v1.md` §5.1) no muestra nombre |
| (c) Solo `organizationId` | Resuelve `/panel/campaigns` pero no `PanelHome` (que necesita los roles). Dejaría N1 a medias |

### Q-N1-3 — Cuenta sin organización

`AuthorizationPrincipal` admite `organizationId = null` (pertenencia de cero o una organización). Hay que fijar cómo viaja:

| Opción | Contenido |
|---|---|
| **(a)** — recomendada | `organizationId` y `platformAuthority` se **omiten** cuando son nulos (regla `NON_NULL` de T-34). `roles` **siempre** presente como array, vacío si no hay organización. El cliente no necesita distinguir "campo ausente" de "array ausente" para los roles |
| (b) | Aplicar `NON_NULL` también a `roles` (omitirlo si está vacío) |

### Q-N1-4 — Caché

| Opción | Contenido |
|---|---|
| **(a) `Cache-Control: no-store`** — recomendada | Ningún intermediario ni el navegador guarda la respuesta. Coherente con "nunca cacheado como fuente de verdad" (criterio de cierre de N1) y con D2 de ADR-046 (nada de sesión persistido) |
| (b) Sin cabecera específica | Deja el comportamiento a los valores por defecto de cada intermediario |

## 5. Lo que esta ficha NO decide ni permite

- **No es autorización.** El cliente usa la respuesta solo para **representar** (qué entradas mostrar, qué `organizationId` poner en el path). Cada endpoint sigue autorizando en backend. Un 403 posterior manda sobre lo que dijo N1.
- No mete `organizationId` ni roles en el JWT, y el cliente no decodifica el JWT.
- No expone lecturas de otros principales ni lecturas entre organizaciones (abiertas en `identity-resumen.md` §7).
- No define perfil de usuario editable, verificación de email ni datos de la organización (nombre, estado de verificación). Si `PanelHome` necesita el nombre de la organización, es otra ficha.
- No decide cómo usa el frontend la respuesta: eso es un delta de `front-fase2` (§6).

## 6. Consecuencias para el frontend (para el delta posterior, no decididas aquí)

- `PanelHome` deja de ser provisional: muestra solo las entradas que corresponden a `roles` y `platformAuthority`.
- `/panel/campaigns` obtiene `organizationId` de N1.
- La respuesta vive en memoria con la sesión (ADR-046 D2), se descarta en `LOGGED_OUT` y no se persiste.
- El guard de rutas **no** pasa a depender de N1: sigue conociendo solo sesión y categoría (ADR-046 D4).

## 7. Criterio de cierre de N1 (de `hallazgos-front-fase2.md`)

1. Contrato en la matriz (consolidación aditiva, requiere autorización).
2. Test de integración: se cambia el rol de una cuenta y la **siguiente** llamada a N1 lo refleja **sin nuevo login**.
3. Test: cuenta desactivada con JWT aún válido → 401.
4. Test negativo: la respuesta nunca contiene `email`, `fullName` ni ningún campo fuera de los cuatro de Q-N1-2.
5. Test: la respuesta 200 lleva `Cache-Control: no-store`; una cuenta sin organización recibe `roles: []` y sin `organizationId`.
6. Documentación explícita de que N1 no sustituye la autorización de cada endpoint.

## 8. ¿Necesita ADR?

**No, según la regla 3.5.** No introduce tecnología, no cambia el límite de un aggregate, no cambia el contrato de un puerto (usa `IdentityPrincipalPort` tal como está) y no introduce un mecanismo de concurrencia ni de reintento. Es un endpoint de `api` que se incorpora por la misma vía que las demás fichas (Enmienda 1 de ADR-041 o la siguiente). **Dependencia de merge:** `feat/identity-adr-038` (donde `AuthorizationPrincipal` ya tiene `platformAuthority`) todavía no está en `develop` del backend.

## 9. Registro de respuestas humanas

| Pregunta | Respuesta | Fecha | Efecto |
|---|---|---|---|
| Q-N1-1 | Ruta `GET /api/v1/me` | 2026-10-05 | Ruta fijada |
| Q-N1-2 | Los cuatro campos del principal: `accountId`, `organizationId`, `roles`, `platformAuthority`; sin PII | 2026-10-05 | Cuerpo fijado |
| Q-N1-3 | Nulos omitidos (`organizationId`, `platformAuthority`); `roles` siempre presente, `[]` sin organización | 2026-10-05 | Representación fijada |
| Q-N1-4 | `Cache-Control: no-store` | 2026-10-05 | Caché fijada; ficha CONGELADA (pendiente de incorporación normativa) |
