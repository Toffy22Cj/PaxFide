# Plan de implementación — `paxfide-web` v1 (Frontend Fase 2)

**Estado:** PROPUESTO — revisión 2 (2026-09-28). No autoriza código hasta aprobación humana explícita (regla 3.4). Se aprueba **por iteración**.
**Base:** ADR del frontend web (hoy archivado como `ADR-046-frontend-web-paxfide-web.md`, APROBADO — **número en colisión, ver F1**), `claude/front-fase2.md` (consolidación 2026-09-27), `hallazgos-front-fase2.md`, `sistema-visual-paxfide-web.md` (APROBADO).
**Regla de trazabilidad:** cada tarea cita la decisión que implementa. Ante discrepancia entre este plan y esos documentos, prevalecen ellos y se reporta.

**Cambios de la revisión 2:** respuestas de Carlos a E1–E8; inspección del backend real (`Toffy22Cj/Donaciones`, rama `develop`); gestor de paquetes pnpm; hallazgos nuevos F1–F5.

---

## 0. Evidencia

### 0.1 Repositorios

| Repo | Rol | Estado verificado (2026-09-28) |
|---|---|---|
| `Toffy22Cj/Donaciones` | Backend | `develop`: último merge PR #28 (`feat/fase5-a7-1-a7-2`), 2026-09-28 15:18 -05. Módulos `ai, api, app, contracts, core, crypto, identity`. **No existe módulo `convocatoria`** |
| `Toffy22Cj/PaxFide` | `paxfide-web` (confirmado por Carlos) | Solo `main`, un commit ("primero"), 3 documentos. **Sin `develop`** |
| `Toffy22Cj/PaxFide_Mv` | (móvil, presumiblemente) | Solo documentos |

### 0.2 Backend — verificación de `front-fase2.md` §12

**Método:** lectura de código en `develop` (clon de solo lectura). **No se ejecutaron tests del backend**; ninguna afirmación de esta tabla equivale a "tests en verde".

| Punto | Hallazgo en código | Consecuencia para web |
|---|---|---|
| `PhysicalAssetOperationalReadPort` | **No existe** (0 coincidencias en `*.java`) | Pasa de "por verificar" a **hueco de implementación confirmado**. `AssetPage` sigue siendo construible contra backend falso (contrato definido en la matriz §4b) |
| Controllers HTTP de PhysicalAsset (`/physical-assets/**`) | **No existen**. Los únicos `@*Mapping` están en `/api/v1/donations/**` | Ningún comando ni lectura de activo es invocable por HTTP hoy |
| `/auth/login`, `TokenIssuerPort`, `ConvocatoriaReadModel` | 0 coincidencias en `*.java` | Coherente con E3/E4 "en implementación" |
| Credencial de tracking (C2) | `TrackingCodeAuthFilter`: `Authorization: Bearer`, patrón `/api/v1/donations/tracking/**`; endpoint `GET /api/v1/donations/tracking` | **La matriz §5 (`GET /tracking/{trackingCode}`, código en el path) no coincide con el código.** Vigente: cabecera. H1 **sigue abierto** para la ruta UX `/tracking/:trackingCode`, porque el código sigue en la URL del navegador |
| P7 en `PhysicalAssetCommandService` | `register`, `split` y `registerFromDonation` llaman `authorize(actorRef, organizationRef, CommandType…)`; el servicio inyecta `RoleAuthorizationPolicy` y `OrganizationBoundaryPolicy` | `golden-path.md` §5.2 ("ningún comando invoca las políticas") **está desactualizado**. Ver F2 |
| R11 — idempotencia por `commandId` (core) | `register`/`split` reciben `commandId`; `TransactionalEventPublisher.appendAndOutbox` (`@Transactional`) hace `tryClaim(commandId)` (upsert atómico) **en la misma transacción** que el append; si ya estaba reclamado, retorna sin efectos | La base de idempotencia por efecto existe en `core`. **No cierra R11**: ver F3 |

### 0.3 Contratos

| Contrato | Estado |
|---|---|
| `PhysicalAssetOperationalReadModel` | Campos definidos (matriz §4b) |
| `ConvocatoriaAdminReadModel` | Campos definidos (matriz §2b) |
| `ConvocatoriaReadModel` (público) | **Hueco** — en implementación en backend (Carlos, 2026-09-28) |
| Cuerpo de `POST /auth/login` | **Hueco** — en implementación en backend (Carlos, 2026-09-28) |

---

## 1. Resolución de E1–E8

| ID | Resolución | Fuente |
|---|---|---|
| E1 | Backend en `Toffy22Cj/Donaciones` | Carlos |
| E2 | `paxfide-web` = `Toffy22Cj/PaxFide` | Carlos |
| E3 | `ConvocatoriaReadModel`: hueco, en implementación. T-8 sigue bloqueada | Carlos |
| E4 | Cuerpo de login: hueco, en implementación. T-7 sigue bloqueada | Carlos |
| E5 | Encabezado de `sistema-visual` desactualizado: **pendiente**, se corrige junto con F1 (el mismo encabezado cita el número del ADR) | — |
| E6 | Servidor falso con `node:http` para SSR: **aprobado** | Carlos (sin objeción) |
| E7 | Fuentes del sistema en v1: **aprobado** | Carlos (sin objeción) |
| E8 | CI web equivalente a regla 3.2: **aprobado** | Carlos (sin objeción) |
| P-3 | Gestor de paquetes: **pnpm** (Carlos). Ver §3 | Carlos |

---

## 2. Hallazgos nuevos (revisión 2)

### F1 — Colisión de número: existen dos ADR-042 · **BLOQUEANTE documental**

*Resuelto el 2026-10-07 (Carlos):* el ADR del frontend web se renumera a **ADR-046** (`ADR-046-frontend-web-paxfide-web.md`); el ADR-042 del backend conserva su número. El texto de abajo se conserva como registro.

- **Backend:** `Documentos/ADR-042-orquestacion-centralizada-reintentos-proyeccion.md` en `Donaciones/develop`. Estado: *Aprobado — implementado en Fase 5 (A7.2)*. Publicado en `develop` el 2026-09-28 (PR #28). Citado por `estado-fase5.md`, `hallazgo-framework-retry-projections.md` y `plan-correccion-fase5-e-ia.md`. No hay referencias en código Java.
- **Frontend:** `ADR-046-frontend-web-paxfide-web.md` en el proyecto, número asignado el mismo día. Citado por `hallazgos-front-fase2.md`, `sistema-visual-paxfide-web.md` y este plan.
- Viola el principio de que cada clase y cada PR se señala contra **un** ADR (regla 2.1): "ADR-042" pasa a ser ambiguo.
- **No se resuelve en este plan.** Opciones para decisión humana:
  - **(a)** Renumerar el ADR del frontend al siguiente libre (ADR-043, a confirmar que no esté tomado). El ADR del backend se publicó primero en el repo y ya está implementado.
  - **(b)** Renumerar el del backend. Toca 3 documentos del backend y un ADR ya implementado.
- Hasta decidirlo, este plan se refiere a él como "ADR del frontend web".

### F2 — `golden-path.md` §5.2 desactualizado respecto a P7

El código ya conecta la autorización en `register`, `split` y `registerFromDonation` (§0.2). El bloqueo "`HumanAccount` + P7" de `hallazgos-front-fase2.md` debe reevaluarse **en sus dos partes por separado** (el propio documento dice que son independientes):
- P7: aparentemente integrado en `core`; falta confirmarlo con la ejecución de `HumanActorAuthorizationIntegrationTest` (existe; no se ejecutó en esta revisión).
- `HumanAccount`: **no verificado** en esta revisión.

No se modifica `golden-path.md` ni `hallazgos-front-fase2.md` desde este plan; se reporta.

### F3 — R11 no cerrado aunque `core` sea idempotente por efecto

Contra el criterio de cierre de R11 (`hallazgos-front-fase2.md` §2):
1. **Contrato HTTP:** no hay controllers de `/physical-assets/**`; el cuerpo con `commandId` no existe en ninguna parte.
2. **Test de duplicado:** `ProcessedCommandIdempotencyIntegrationTest` cubre `confirmAllocation` y `deliverAsset`, **no `split` ni `register`**. `PhysicalAssetCommandServiceIntegrationTest` no tiene test de mismo `commandId` para esos dos comandos.
3. **Mismo resultado ante duplicado:** `splitPhysicalAsset` y `registerPhysicalAsset` devuelven `void`, y el `assetId` (y el `childAssetId` del split) se genera dentro con `UUID.randomUUID()`. Ante un duplicado, el servicio retorna sin datos. Pero la matriz exige `{assetRef, …}` para `register` y "assets resultantes" para `split`. **Hoy no hay forma de devolver el mismo resultado ante un reintento con el mismo `commandId`.** Esto afecta directamente a la salida "Reintentar" de P-W1b: el reintento sería seguro, pero el usuario no recibiría el `assetRef` para navegar a `/assets/{assetRef}`.

Dueño: PhysicalAsset / `api`. No se resuelve en frontend.

### F4 — Matriz desactualizada respecto al código de tracking

Ver §0.2 (cabecera `Bearer` vs. path). Corresponde al punto (1) del criterio de cierre de C2. La matriz debe corregirse en backend. **H1 sigue abierto.**

### F5 — `PhysicalAssetOperationalReadPort` no existe

Hueco de implementación confirmado (antes "por verificar"). `AssetPage` se desbloquea para despliegue cuando exista el puerto, el controller y el test de exclusión de campos.

---

## 3. Precondiciones (antes de la Iteración 1)

- **P-1:** crear `develop` en `Toffy22Cj/PaxFide` desde `main` y configurar la protección de ramas: PR con una aprobación humana; CI obligatorio (E8).
- **P-2:** versión de Next.js verificada contra el blog oficial el día del scaffold (D1). Fijada en el lockfile.
- **P-3 — pnpm (decidido por Carlos):**
  - Evaluación: pnpm aporta protecciones reales de cadena de suministro por defecto. En la línea 11 (publicada el 2026-04-28), `minimumReleaseAge` pasa a 1 día, y `strictDepBuilds` y `blockExoticSubdeps` pasan a `true`. Desde la 10 ya no ejecuta los scripts de ciclo de vida de las dependencias salvo permiso explícito. Además aplica un `node_modules` estricto, sin dependencias fantasma.
  - **Requiere Node.js ≥ 22** para pnpm 11. Se fija junto con el mínimo de Next 16.3.x en `engines` y `.nvmrc`.
  - **Tensión con la regla de versión de D1:** con `minimumReleaseAge` de 1 día, un parche de seguridad de Next (p. ej. el anunciado para el 2026-09-30) no se resuelve hasta 24 h después. Propuesta: excluir `next` de la espera mediante `minimumReleaseAgeExclude` **solo** para parches de seguridad, con un PR que cite el aviso oficial. Requiere aprobación.
  - **Registro:** es herramienta de desarrollo, no dependencia de runtime. Se recomienda anotarlo en la misma edición que resuelva F1, como nota de D8 ("gestor de paquetes: pnpm"), para que no quede como decisión implícita (regla 3.5).
  - Lista de dependencias con build permitido (`onlyBuiltDependencies` / equivalente de la versión): vacía por defecto; cada entrada se justifica en PR.
- **P-4:** F1 resuelto (número del ADR del frontend).

---

## 4. Tareas

Formato: rama · decisión que implementa · entregables · qué NO hacer · Definition of Done. La evidencia de todo DoD es el **output literal** del runner (Vitest / Playwright).

### Iteración 1 — Base verificable

#### [x] T-0 · `chore/web-scaffold`
**Implementa:** D1, D8, P-3.
- Next.js 16.3.x (App Router) + React + TypeScript `strict`, instalado con pnpm y con `pnpm-lock.yaml` versionado.
- Vitest + Testing Library + Playwright como dependencias de desarrollo. Ninguna otra.
- CI (E8): en PR a `develop`, `pnpm install --frozen-lockfile`, typecheck, `vitest run` y `playwright test`. Prohibido mergear con tests saltados.
- Fuentes del sistema (E7): pila `system-ui` declarada como token, sin fuente web.

**No hacer:** Tailwind, librería de componentes, Axios, TanStack Query, Redux/Zustand; páginas.
**DoD:** CI en verde sobre el esqueleto; `package.json` con exactamente las dependencias de D8.

<details><summary>Output literal de CI (Vitest + Playwright)</summary>

```text
$ vitest run
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.0.2 /home/carlos/Proyectos/PaxFide

 ✓ __tests__/design-tokens.test.ts (17 tests) 11ms
 ✓ src/app/page.test.tsx (1 test) 38ms

 Test Files  2 passed (2)
      Tests  18 passed (18)
   Start at  21:59:36
   Duration  1.26s (environment 78%, setup 13%, transform 4%, import 2%, tests 2%, worker 1%)

$ playwright test
[WebServer] $ next dev

Running 1 test using 1 worker

[1/1] [chromium] › e2e/example.spec.ts:3:5 › has hello world
  1 passed (5.8s)

To open last HTML report run:

  pnpm exec playwright show-report
```
</details>

#### [x] T-1 · `feat/web-design-tokens`
**Implementa:** `sistema-visual` §2–§5; requisito WCAG 2.2 AA; D8.
- Custom properties de §2.1–§2.3, consumidas por nombre.
- Test que recorre **toda** la tabla §3 y falla si un par baja de su umbral. La fórmula del Anexo A se reimplementa en TypeScript y se valida contra 9,13 · 8,35 · 4,57.
- Test que falla si un CSS usa un hexadecimal fuera de los tokens.

**DoD:** output de Vitest con todos los pares de §3.

<details><summary>Output literal (incluido en T-0)</summary>

Ver output en `T-0`.
</details>

#### [x] T-2 · `feat/web-route-classifier-enablement`
**Implementa:** D4 (árbol, categorías), D5, G-W1, G-W4.
- Clasificador de rutas puro, con validación estructural de parámetros sin inventar formatos.
- Lista de superficies habilitadas leída en build desde un archivo versionado, **vacía por defecto**.
- Página 404 única.

**No hacer:** consultar la lista para decidir permisos (D5); "Próximamente"; flags en runtime.
**DoD unitario:** cada ruta del árbol en su categoría; `/panel/platform/**`, `/tracking/**` y parámetros inválidos ⇒ No aprobada.
**DoD Playwright:** con la lista vacía, todas las rutas del árbol ⇒ 404 sin sesión.
**Aserciones negativas:** una ruta no aprobada nunca redirige a `/login`.

<details><summary>Output literal de CI (Vitest + Playwright)</summary>

```text
$ vitest run
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.0.2 /home/carlos/Proyectos/PaxFide

 ✓ __tests__/classifier.test.ts (4 tests) 6ms
 ✓ __tests__/design-tokens.test.ts (17 tests) 11ms
 ✓ src/app/page.test.tsx (1 test) 40ms

 Test Files  3 passed (3)
      Tests  22 passed (22)
   Start at  22:12:46
   Duration  1.33s (environment 79%, setup 12%, transform 5%, import 2%, tests 2%, worker 1%)

$ playwright test
Running 6 tests using 6 workers

[1/6] …pec.ts:14:9 › Route Enablement › Route /c/123 should 404 when not enabled
[2/6] …pec.ts:14:9 › Route Enablement › Route /panel should 404 when not enabled
[3/6] …14:9 › Route Enablement › Route /tracking/123 should 404 when not enabled
[4/6] …pec.ts:14:9 › Route Enablement › Route /login should 404 when not enabled
[5/6] …s:14:9 › Route Enablement › Route /assets/abc should 404 when not enabled
[6/6] …9 › Route Enablement › Route /panel/campaigns should 404 when not enabled
  6 passed (2.8s)
```
</details>

### Iteración 2 — Sesión y guards

#### [x] T-3 · `feat/web-session`
**Implementa:** D2, G-W2, G-W3, T-1.
- Máquina de sesión (`RESTORING` → `LOGGED_OUT` inmediato) y JWT solo en memoria.
- Handler de `401`: T-1 con JWT; nunca en tracking.
- Destino post-login retenido en memoria, de consumo único.
- Señal de logout con `BroadcastChannel`, solo la señal.

**No hacer:** ningún almacenamiento del navegador; decodificar el JWT; `?next=`.
**DoD:** auditoría de salidas de `front-fase2.md` §11, fila por fila.
**Aserciones negativas:**
- el `401` de tracking no toca la sesión;
- T-1 no emite la señal de logout;
- el destino no se persiste;
- el mensaje entre pestañas no contiene el token.

<details><summary>Output literal de CI (Vitest)</summary>

```text
$ pnpm vitest run __tests__/session.test.ts
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.0.2 /home/carlos/Proyectos/PaxFide

 ✓ __tests__/session.test.ts (7 tests) 12ms
   ✓ Session Machine (T-3) (7)
     ✓ inicia en LOGGED_OUT por resolución inmediata de RESTORING 5ms
     ✓ login cambia estado a AUTHENTICATED y guarda el JWT solo en memoria 1ms
     ✓ logout borra el JWT, el destino, y emite la señal de logout por BroadcastChannel 2ms
     ✓ el destino post-login retenido es de consumo único 0ms
     ✓ el 401 de tracking no toca la sesión 0ms
     ✓ T-1 (401 con JWT fuera de tracking) causa logout local (borra intención) sin señal de BroadcastChannel 1ms
     ✓ la señal de logout proveniente de otra pestaña cierra la sesión local sin reenviar mensaje 1ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  22:18:12
   Duration  1.28s (environment 80%, setup 13%, transform 4%, tests 1%, import 1%, worker 1%)
```
</details>

#### T-4 · `feat/web-guards`
**Implementa:** D3 (C1), D4 (tabla §8, invariantes 1–6 y bfcache).
- Guard solo de cliente, tabla 3 × 4.
- Mecanismo de bfcache justificado en el PR; se prueba el invariante, no la técnica.
- Script de chequeo estático (sin dependencia nueva): el código de servidor de Next nunca importa el módulo de sesión ni el cliente autenticado.

**DoD unitario:** las 12 celdas + idempotencia.
**DoD Playwright:**
- logout → atrás ⇒ sin contenido autenticado;
- logout en la pestaña A ⇒ la pestaña B pasa a `LOGGED_OUT`;
- superficie deshabilitada ⇒ 404 también con sesión.

**DoD seguridad:** sin `Authorization` hacia el origen Next; sin token en ningún almacenamiento.

### Iteración 3 — Mecanismo de comandos (sin formularios reales)

#### T-5 · `feat/web-command-machine`
**Implementa:** D6 (P-W1, P-W1a, P-W1b).
- `commandId` por intención, en memoria.
- Clasificador P-W1a y máquina P-W1b.
- Avisos con colores de `sistema-visual` §4 (ambiguo en amarillo, con texto explícito).

**No hacer:** ningún formulario concreto (F3, cuerpos inexistentes, R11 abierto).
**DoD con `fetch` falso, inspeccionando la petición real:**
- timeout → reintento ⇒ mismo `commandId`;
- 4xx → nueva intención ⇒ `commandId` distinto.

**Aserciones negativas:**
- no hay reintento automático;
- un 5xx nunca es determinista;
- un rechazado no se reenvía con el mismo `commandId`;
- el `commandId` no se persiste.

### Iteración 4 — Pantallas contra backend falso (deshabilitadas por D5)

#### T-6 · `feat/web-asset-page-read`
**Implementa:** W1-bis, T3 (lectura), matriz §4b.
- Seis estados, mostrando solo los 7 campos del `ReadModel`.
- **Despliegue bloqueado por F5** (puerto y controller inexistentes).

**DoD:** estados con cliente falso; un campo extra en la respuesta (`donorRef`) no se renderiza.

#### T-7 · `feat/web-login-page` — bloqueada por E4
#### T-8 · `feat/web-campaign-public-page` — bloqueada por E3 (y por la inexistencia del módulo `convocatoria`); usa el servidor falso de E6

---

## 5. Fuera de este plan

| Superficie | Motivo |
|---|---|
| Formularios `split`, registrar activo, crear convocatoria | R11 (F3), cuerpos no especificados, controllers inexistentes |
| Asignar empleado | R6, R4 |
| `OrgCampaignsPage` | N1 |
| `/tracking/:trackingCode` | C2/H1 (F4 cierra solo la verificación de credencial) |
| `/panel/platform/**`, `from-donation` | T6, R1, R8 |
| E2E contra backend real | `front-fase2.md` §11 |
| Hosting | ADR del frontend web §5 |

## 6. Actualización de estado

Cada PR actualiza este plan marcando su tarea con el output literal de sus tests. Ninguna tarea se marca completada con tests fallando o sin ejecutar (regla 2.4). La habilitación de una superficie en D5 es un PR aparte que cita el hallazgo resuelto.
