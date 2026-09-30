# ADR-042 — Frontend web `paxfide-web`: stack, sesión, frontera cliente/servidor y comandos sin Outbox

**Status:** APROBADO (2026-09-28). Las cinco condiciones de §6 están cumplidas; el paso a APROBADO se produce por la regla fijada en §6 ("sin necesidad de nueva revisión técnica"). Aprobar el ADR **no** autoriza escribir código: antes se requiere el plan de implementación aprobado (regla 3.4).
**Fecha:** 2026-09-28 (revisión 4: solo cambian estado, rutas de documentos y condición 5; ninguna decisión D1–D8 se modifica)
**Número:** **042**, asignado el 2026-09-28 por aprobación humana explícita. Presupone la renumeración de la Fase 6 descrita en `plan-correccion-fase5-e-ia.md`, confirmada en la misma fecha:

| Capa de Fase 6 | Número anterior | Número vigente |
|---|---|---|
| Convocatoria | 033 | **037** |
| Identidad | 034 | **038** |
| Blockchain | 035 | **039** |
| IA | 036 | **040** |
| APIs/Frontend | 037 | **041** |
| Frontend web (este ADR) | — (ADR-FRONT-WEB) | **042** |

Todas las referencias de este documento usan la numeración vigente. Los archivos del catálogo que aún conserven el número anterior se renombran según `plan-correccion-fase5-e-ia.md`; esa tarea no forma parte de este ADR.

**Documento de diseño fuente:** `claude/front-fase2.md`, **versión consolidada del 2026-09-27**, que contiene árbol de rutas (§7), guards (§8), pantallas (§9), comandos (§10) y tests (§11). Es la única copia de `front-fase2.md` en el proyecto. Este ADR no reescribe el diseño: formaliza las decisiones arquitectónicamente significativas y remite a sus secciones. Ante cualquier discrepancia entre este ADR y `claude/front-fase2.md`, se detiene y se reporta; no se resuelve por interpretación. Nota: `claude/front-fase2.md` todavía cita los ADR de Fase 6 con la numeración anterior; se lee con la tabla de arriba.

**Relacionados:** `claude/front-fase2.md`, `front-fase1.md`, `hallazgos-front-fase2.md`, `sistema-visual-paxfide-web.md`, `plan-correccion-fase5-e-ia.md`.

---

## 1. Context

PaxFide necesita una superficie web con dos funciones (`front-fase2.md` §1):

1. **Fallback de los QR**: las URLs canónicas `/c/{publicCode}`, `/tracking/{trackingCode}` y `/assets/{assetRef}` (matriz §4b) deben responder aunque la app Flutter no esté instalada.
2. **Gestión administrativa y operacional de organización**, incluidas las operaciones de PhysicalAsset asignadas a `EMPLOYEE`/`REPRESENTATIVE`, sin convertirlas en privilegios administrativos.

Restricciones que condicionan la decisión:

- **Identidad (ADR-038):** JWT mínimo (`sub`, `iat`, `exp`, firma), sin roles ni organización; `AuthorizationPrincipal` se resuelve en backend en cada request. **No existe estrategia de refresh** (`identity-resumen.md` §7).
- **ADR-041 §2.7:** `publicCode` y `trackingCode` son secretos tipo bearer; no deben aparecer en logs, analítica ni URLs externas.
- **ADR-041 §2.6:** la protección contra doble clic es UX, no idempotencia; no hay deduplicación HTTP transversal.
- **Regla 2.6:** distinguir fallo determinista de fallo ambiguo; todo estado necesita salida explícita.
- **Navegador:** no ofrece un almacén de credenciales equivalente a Keychain/Keystore; un XSS puede leer cualquier almacenamiento accesible a JavaScript.
- **Proyecto:** académico, equipo de 4 personas, plazo acotado. Se evita infraestructura sin necesidad demostrada.

`paxfide-web` es un repositorio propio (`front-fase1.md` §1). Hoy **ninguna pantalla autenticada es implementable de extremo a extremo**: dependen de contratos backend pendientes (`hallazgos-front-fase2.md` §6).

---

## 2. Decision

### D1 — Stack: Next.js (App Router) + React + TypeScript

(`front-fase2.md` §2 W0)

- **Next.js, línea 16.3.x.** La versión exacta se fija en el lockfile.
- **Regla de versión:** se adopta como mínimo la última versión de parche de la línea 16.3.x publicada que resuelva los avisos de seguridad vigentes del proyecto Next.js. Antes de cualquier despliegue se verifica contra el blog oficial de Next.js. Los cambios de parche no requieren ADR nuevo; los de major requieren enmienda.
- **Estado verificado a la fecha de este ADR** (fuente: blog oficial de Next.js, consultado el 2026-09-28): la última versión publicada es **16.3.6** (Active LTS), que es la mínima hoy. Hay una release de seguridad **anunciada**, aún no publicada, para el 2026-09-30. Cuando se publique, pasa a ser la mínima por aplicación de la regla anterior, sin modificar este ADR. Este ADR no depende de ninguna versión inexistente.
- **TypeScript en modo estricto.**
- Motivo de Next.js frente a SPA: `/c/:publicCode` necesita SSR + Open Graph para compartir la convocatoria (`front-fase2.md` §9 P-W2).

### D2 — Sesión: JWT solo en memoria + regla provisional T-1

(`front-fase2.md` §2 W2)

- El JWT vive únicamente en memoria de la pestaña. **Nunca** en `localStorage`, `sessionStorage`, cookies ni IndexedDB.
- Máquina de sesión heredada de Flutter (`UNKNOWN → RESTORING → AUTHENTICATED | LOGGED_OUT`). En web `RESTORING` resuelve de inmediato a `LOGGED_OUT`: no hay nada persistido que restaurar.
- `401` con JWT → `LOGGED_OUT` (T-1). El `401` de tracking nunca modifica la sesión.
- **Provisional** hasta que Identity defina access/refresh.

### D3 — Frontera cliente/servidor: no BFF (invariante C1)

(`front-fase2.md` §3 C1)

```text
Permitido:   Browser → Next.js UI (cliente) → Backend
Prohibido:   Browser → Server Action / Route Handler / Middleware → Backend con JWT
```

- Páginas autenticadas: renderizado exclusivamente en cliente.
- Route handlers, server actions y middleware de Next.js nunca reciben, leen ni reenvían el JWT, ni actúan como proxy autenticado.
- Guards exclusivamente de cliente; el servidor no conoce la sesión.
- **Convertir posteriormente el servidor Next.js en BFF "por comodidad" no es una refactorización:** cambia la estrategia de credenciales fijada en D2 y requiere un ADR nuevo que sustituya a D2 y D3.

### D4 — Navegación y guards

**Alcance de esta decisión:** formaliza las decisiones cerradas en la **consolidación de `claude/front-fase2.md` del 2026-09-27** (§7 árbol de rutas T1–T6, §8 guards G-W1–G-W4). Fueron diseñadas **después** de la primera versión de `front-fase2.md` (que solo cerraba W0–W3 e inventario) y sobre su base. No son herencia de esa primera versión.

- Árbol de rutas v1 según `claude/front-fase2.md` §7, con el criterio de inclusión de tres categorías (T1).
- Tabla de guards de `claude/front-fase2.md` §8. Ruta no aprobada → **404 en cualquier estado de sesión**, nunca `/login` (G-W4). `403` es un estado de pantalla, nunca una redirección.
- **Destino post-login en memoria, consumo único**, para todas las rutas autenticadas (G-W2). Sin `?next=`.
- **Propagación de la señal de logout** entre pestañas del mismo origen, nunca del JWT; la expiración T-1 no se propaga (G-W3).
- **Invariante bfcache:** tras un logout, ninguna superficie autenticada puede volver a mostrarse desde la caché de navegación del navegador. El mecanismo se fija en implementación y se verifica en navegador real.

### D5 — Superficies aprobadas-bloqueadas: habilitación explícita por build

**DECISIÓN ARQUITECTÓNICA NUEVA de este ADR.** No es formalización de `front-fase2.md`: es el mecanismo que implementa G-W1.

- Cada superficie aprobada-bloqueada (ruta o acción transitoria) se registra en una **lista de superficies habilitadas** leída en build.
- **Por defecto, deshabilitada.** Deshabilitada ⇒ la ruta responde **404 independientemente del estado de sesión**, y la acción no se renderiza. Nunca "próximamente". Que la respuesta sea la misma con o sin sesión evita revelar qué capacidades existen internamente.
- Una superficie solo se habilita cuando **todos** sus bloqueos de la columna "Bloqueo" de `claude/front-fase2.md` §9 están resueltos con evidencia, según el criterio de cierre de cada hallazgo en `hallazgos-front-fase2.md`. Habilitarla es un cambio revisable en PR que cita el hallazgo resuelto.
- **La lista de habilitación NO es fuente contractual ni de autorización.** Solo expresa "esta superficie puede desplegarse". Nunca expresa que una operación esté permitida, que un usuario pueda ejecutarla ni que un contrato backend exista. La autorización sigue siendo exclusivamente backend (`front-fase2.md` §1). El código nunca consulta la lista para decidir qué puede hacer un usuario.
- Permite integrar y probar pantallas contra un backend falso (niveles 2–3 de la estrategia de tests) **sin desplegarlas**.

### D6 — Comandos web sin Outbox

(`claude/front-fase2.md` §10, P-W1/P-W1a/P-W1b)

- **`commandId` generado en cliente por intención**, solo en memoria; se pierde al recargar (deuda aceptada).
- **Clasificación de respuestas:**

  | Respuesta | Resultado |
  |---|---|
  | Timeout / conexión cortada / 5xx | Ambiguo |
  | 4xx salvo 401 | Rechazado |
  | 401 | Rechazado + T-1 |
  | 2xx | Éxito |

- **Rechazado** → cerrar, o nueva intención con **nuevo** `commandId`.
- **Ambiguo** → reintento **manual** con el **mismo** `commandId`, o "Cerrar" con advertencia, descartando el `commandId` sin enviar nada.
- **Nunca reintento automático.**
- **R11 es un bloqueo duro de habilitación, no deuda.** `split`, registrar activo y crear convocatoria **no se habilitan** (D5) mientras el contrato no acepte `commandId` y el backend no demuestre idempotencia con él (test que envía dos veces el mismo `commandId` y verifica un solo efecto). No hay excepción ni habilitación "con advertencia". Para `split` además no existe verificación honesta del resultado desde web.

### D7 — Rutas públicas

(`claude/front-fase2.md` §3 C2, §9 P-W2/P-W3)

- `/c/:publicCode`: SSR + Open Graph + **`noindex` para todas las convocatorias** en v1. "No encontrada" es un estado de pantalla con código HTTP coherente; el valor exacto queda pendiente del backend.
- `/tracking/:trackingCode`: **deshabilitada (D5) → 404** hasta resolver H1 y verificar el contrato de credencial (path vs. `Authorization: Bearer`). No se trata como "casi lista". Cuando se habilite: solo cliente, `noindex`, sin OG.

### D8 — Dependencias base

Mínimas y justificadas. Cualquier otra dependencia requiere enmienda a este ADR (regla 3.5).

| Dependencia | Tipo | Uso | Estado |
|---|---|---|---|
| `next`, `react`, `react-dom` | Runtime | Framework (D1) | Decidido |
| `typescript` | Desarrollo | Tipado estricto de contratos | Decidido |
| CSS Modules + custom properties | Incluido en Next.js | Estilos y tokens de diseño (`sistema-visual-paxfide-web.md`); sin dependencia adicional | **Aprobado** |
| Vitest + Testing Library | Desarrollo/verificación | Tests de niveles 1–2 | **Aprobado** |
| Playwright | Desarrollo/verificación | Tests de niveles 3–4: bfcache, varias pestañas, SSR, inspección de cabeceras, 404 de superficies deshabilitadas | **Aprobado** |

Las herramientas de test **no son dependencias arquitectónicas de runtime**: no se despliegan.

**No se incluyen:** librería de estado global (Redux, Zustand), cliente HTTP de terceros (Axios), capa de caché de datos (TanStack Query), librería de componentes UI ni Tailwind. `fetch` + estado de React + lógica propia bastan para v1.

---

## 3. Alternatives

| Alternativa | Por qué se descarta |
|---|---|
| **SPA pura (Vite + React)** | Más simple, sin runtime Node. Sin SSR, `/c` no puede ofrecer vista previa OG al compartirse. Válida y reversible si el equipo abandonara OG. |
| **BFF con cookie `httpOnly`** | Superior frente a XSS y resolvería la persistencia de sesión. Pero cambia el mecanismo de autenticación del contrato (cookie en vez de `Bearer`), introduce CSRF y pone credenciales en el servidor Next.js. Se reconsidera cuando Identity defina refresh. |
| **JWT en `localStorage`/`sessionStorage`** | Cualquier XSS lo roba. Inaceptable para cuentas `ADMINISTRATOR`. |
| **Heredar el Outbox de Flutter** | Resuelve un problema offline que web no tiene; añade estado persistente sensible en el navegador. |
| **`?next=` para retorno post-login** | Superficie de open redirect y segunda regla de navegación distinta a la móvil. |
| **Página "Próximamente" para superficies bloqueadas** | Promete una capacidad que el backend no presta; contradice G-W1. |
| **Rama `feat/` de larga vida para superficies bloqueadas** (en vez de D5) | Diverge de `develop` durante semanas; rompe la regla de cambios pequeños y revisables. |
| **Habilitación en runtime** (flags remotos) en vez de build | Añade infraestructura sin necesidad demostrada y convierte la lista en estado mutable en producción. |
| **Tailwind / librería de componentes** | Útiles pero no necesarias; se reconsideran con justificación si CSS Modules resulta insuficiente. |

---

## 4. Consequences

### Positivas

- El servidor Next.js nunca posee credenciales: reduce el impacto de vulnerabilidades del lado servidor del framework.
- Una única fuente de autorización (backend), coherente con móvil.
- El código de superficies bloqueadas se integra y prueba sin desplegarse (D5), sin crear una segunda fuente contractual.
- Los fallos ambiguos tienen salida explícita (regla 2.6) sin almacenamiento persistente.

### Negativas y deuda aceptada

- **Re-login por recarga y por pestaña nueva** (D2), hasta que exista refresh.
- **Recargar pierde el destino post-login y la intención de un comando.**
- **Runtime Node** que hay que desplegar (D1), aunque las páginas autenticadas no lo usen.
- **Ninguna superficie autenticada es desplegable hoy.** El primer entregable habilitable realista es `/c/:publicCode`, cuando el módulo `convocatoria` tenga código; le sigue `/assets/:assetRef` en modo lectura, tras verificar `PhysicalAssetOperationalReadPort`.

### Dependencias externas

Registradas en `hallazgos-front-fase2.md`, no resueltas por este ADR y **no tratadas como infraestructura disponible**: R1, R4, R6, R8, R9, R10, R11, N1, H1/C2, `HumanAccount` + P7, código HTTP de "no encontrada", `PhysicalAssetOperationalReadPort`.

### Verificación (Definition of Done del frontend)

La estrategia de `claude/front-fase2.md` §11, incluidas las aserciones negativas obligatorias. En particular:
- ninguna petición al origen Next.js lleva el JWT;
- no hay token en ningún almacenamiento del navegador;
- las superficies deshabilitadas (D5) responden 404 con y sin sesión.

La evidencia es el output literal del runner de tests, con el mismo estándar que Surefire en backend.

---

## 5. Fuera de este ADR

- **Identidad visual:** documento aparte, `sistema-visual-paxfide-web.md` (APROBADO, condicionado a este ADR). Requisito que sí se fija aquí: **contraste mínimo WCAG 2.2 AA** (4,5:1 para texto normal) en toda combinación texto/fondo.
- **Flutter:** las decisiones pendientes de ADR de `front-fase1.md` (T-1 en móvil, máquina del Outbox con T-2, `PendingIntent`) van en un ADR propio o en una enmienda, a decidir por el equipo.
- **Hosting/despliegue** de `paxfide-web`.
- **Renombrado de los archivos del catálogo de Fase 6** (033–037 → 037–041): responsabilidad de `plan-correccion-fase5-e-ia.md`.

---

## 6. Condiciones de aprobación

| # | Condición | Estado |
|---|---|---|
| 1 | Fidelidad de D1–D4 y D6–D7 respecto de `claude/front-fase2.md` (versión 2026-09-27), con la genealogía documentada en D4 | **APROBADO** (2026-09-28) |
| 2 | D5 como decisión arquitectónica nueva: habilitación por build, 404 con independencia de la sesión, separación estricta entre habilitación y autorización | **APROBADO** (2026-09-28) |
| 3 | D8: CSS Modules + custom properties, Vitest + Testing Library, Playwright; herramientas de test como desarrollo/verificación, no runtime | **APROBADO** (2026-09-28) |
| 4 | Número del ADR | **RESUELTO:** 042 (2026-09-28) |
| 5 | Fuente documental única | **CUMPLIDO** (2026-09-28), según la convención documental del proyecto (abajo) |

Cuando se cumpla el punto 5, el estado pasa a **APROBADO** sin necesidad de nueva revisión técnica. **Aplicado el 2026-09-28.**

### Convención documental aplicada al punto 5

Se sigue el patrón que ya usa el proyecto (por ejemplo, `plan-correccion-fase5-e-ia.md`, `api-contract-matrix.md`, `golden-path.md`, `ADR-033-…` tienen varias copias con el mismo nombre):

1. **La raíz del proyecto es la ubicación canónica.**
2. **Entre copias con el mismo nombre, rige la de fecha de creación más reciente.** Las anteriores quedan como histórico, no como fuente.
3. `front-fase2.md` es la excepción: su única copia es `claude/front-fase2.md` y se cita con esa ruta.

Estado verificado el 2026-09-28 tras la limpieza:

| Documento | Copia vigente | Copias históricas (no son fuente) |
|---|---|---|
| Este ADR | `ADR-042-frontend-web-paxfide-web.md` (raíz) | — |
| Hallazgos | `hallazgos-front-fase2.md` (raíz, 2026-09-29 01:51 UTC) | dos copias del 2026-09-27 con numeración de ADR anterior |
| Sistema visual | `sistema-visual-paxfide-web.md` (raíz, 2026-09-29 01:51 UTC, APROBADO) | una copia del 2026-09-29 01:35 UTC en estado PROPUESTO |
| Diseño | `claude/front-fase2.md` | — |

Eliminados: `ADR-FRONT-WEB-paxfide-web.md` (borrador sin número, sustituido por este ADR) y las copias de `claude/` de este ADR, de los hallazgos y del sistema visual.
