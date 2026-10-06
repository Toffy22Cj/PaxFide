# Plan de Ejecución para Agentes — Frontend Fase 2: `paxfide-web`

**Uso:** pegar el Prompt Maestro (`claude/Promt-maestro-front-fase2.md` §1) y, **debajo**, un solo bloque de tarea de este documento, en una sesión de agente nueva.
**Correspondencia:** la tarea W-n de este documento es la T-n de `claude/implementation-plan-paxfide-web.md` (revisión 2). Ante cualquier discrepancia prevalece el plan de implementación.
**Estado de aprobación (2026-09-28):** ninguna tarea aprobada. Cada bloque indica su estado; el humano lo actualiza al aprobar.

---

### TAREA W-0 — Scaffold del repositorio

**Estado:** ⏳ PENDIENTE DE APROBACIÓN | **Rama:** `chore/web-scaffold` | **Depende de:** P-1 (`develop` + protección de ramas)

```
TAREA: Crear el esqueleto de paxfide-web en Toffy22Cj/PaxFide sin ninguna
página de producto.

CONTEXTO YA CONGELADO:
- ADR-042-frontend-web-paxfide-web.md D1 (Next.js 16.3.x, App Router,
  TypeScript strict) y D8 (lista cerrada de dependencias).
- Toolchain del Prompt Maestro: pnpm 11, Node >= 22, defaults de
  seguridad de pnpm intactos, sin minimumReleaseAgeExclude.
- El repo ya contiene 3 documentos en main (api-contract-matrix.md,
  contract-wiring-review.md, reglas-equipo-y-agentes.md). NO los borres ni
  los modifiques.

ENTREGABLES:
1. ANTES de instalar: consulta el blog oficial de Next.js y reporta la
   última versión publicada de la línea 16.3.x, con URL y fecha de consulta.
   Si hay un aviso de seguridad que la versión no cubra, DETENTE.
2. Proyecto Next.js (App Router) + TypeScript strict, instalado con pnpm, con
   pnpm-lock.yaml versionado. "engines", ".nvmrc" y "packageManager" fijados.
3. Dependencias de desarrollo: Vitest, Testing Library, Playwright. Ninguna
   otra. Si el generador de Next añade algo fuera de D8 (p. ej. Tailwind o un
   linter con plugins), NO lo aceptes sin reportarlo: quítalo o DETENTE y
   pregunta.
4. Scripts: typecheck, test (vitest run), e2e (playwright test).
5. CI en GitHub Actions para PRs hacia develop: pnpm install
   --frozen-lockfile → typecheck → vitest run → playwright test. Falla si hay
   tests con .skip u .only.
6. Un test de Vitest y un test de Playwright triviales que prueben que el
   pipeline realmente ejecuta cada runner (y que fallarían si no se ejecuta).
7. README: regla de versión de D1, comandos y requisito de Node.

QUÉ NO HACER:
- Páginas, layout visual o tokens (son W-1/W-2).
- Tailwind, librería de componentes, Axios, TanStack Query, Redux, Zustand,
  fuentes web.
- Relajar strictDepBuilds, minimumReleaseAge o blockExoticSubdeps.
- Commits directos a main o develop.

DEFINITION OF DONE:
- CI en verde en el PR, con el output literal de vitest y playwright.
- package.json contiene exactamente: next, react, react-dom (runtime) y
  typescript, vitest, @testing-library/*, @playwright/test más sus tipos
  estrictamente necesarios (desarrollo). Lista literal en el PR.
- Versión de Next instalada + fuente consultada, en el PR.
```

---

### TAREA W-1 — Tokens de diseño y verificación de contraste

**Estado:** ⏳ PENDIENTE | **Rama:** `feat/web-design-tokens` | **Depende de:** W-0 aprobado

```
TAREA: Implementar los tokens de color como custom properties y un test que
garantice los contrastes aprobados.

CONTEXTO YA CONGELADO:
- sistema-visual-paxfide-web.md (APROBADO): tokens §2.1–§2.3, combinaciones
  permitidas §3, estados §4, reglas §5, script de referencia en el Anexo A.
- ADR-042-frontend-web-paxfide-web.md §5: WCAG 2.2 AA; D8: CSS Modules +
  custom properties.
- Los tokens danger-* son semánticos, NO de marca: mantenlos separados.

ENTREGABLES:
1. Hoja de custom properties con TODOS los tokens de §2, nombrados igual que
   en el documento.
2. Pila tipográfica del sistema (system-ui) como token. Sin fuente web.
3. Implementación TypeScript de la luminancia relativa y del contraste
   (fórmula del Anexo A), validada contra 9,13 (green-900/white),
   8,35 (green-900/yellow-50) y 4,57 (blue-700/white), redondeando a 2
   decimales.
4. Test que recorre LA TABLA §3 COMPLETA (declárala como datos en el test,
   fila por fila) y falla si un par baja de su umbral: 4,5 para texto normal,
   3 para texto grande y componentes.
5. Test que falla si algún archivo CSS del repo contiene un hexadecimal que
   no sea la definición de un token.

QUÉ NO HACER:
- Añadir colores, espaciados, radios o sombras no definidos (§6).
- Modo oscuro.
- Usar brand-yellow-400 como texto, ni amarillo en el foco.

DEFINITION OF DONE:
- Output literal de vitest con los tests de los pares de §3.
- Aserción negativa: un par de prueba deliberadamente inválido
  (brand-yellow-400 sobre white) hace fallar el verificador.
```

---

### TAREA W-2 — Clasificador de rutas y habilitación por build (D5)

**Estado:** ⏳ PENDIENTE | **Rama:** `feat/web-route-classifier-enablement` | **Depende de:** W-0 aprobado

```
TAREA: Implementar la clasificación de rutas del árbol v1 y el mecanismo de
habilitación por build, de modo que toda superficie no habilitada responda
404.

CONTEXTO YA CONGELADO:
- claude/front-fase2.md §7 (árbol, T1–T6) y §8 (categorías Pública / Auth /
  Autenticada / No aprobada; G-W1; G-W4).
- ADR-042-frontend-web-paxfide-web.md D5: la lista se lee en build, vacía por
  defecto; deshabilitada ⇒ 404 con o sin sesión; la lista NO es autorización.
- Superficies del árbol: /c/:publicCode, /tracking/:trackingCode, /login,
  /assets/:assetRef (lectura + acción split), /panel (+ acción registrar),
  /panel/campaigns (+ acciones crear convocatoria y asignar empleado).

ENTREGABLES:
1. Clasificador puro: (path) → categoría. /assets/** es Autenticada aunque
   esté fuera de /panel (T2). /panel/platform/**, rutas desconocidas y
   parámetros estructuralmente inválidos ⇒ No aprobada.
2. Validación estructural de parámetros: no vacío + longitud máxima
   defensiva, declarada como constante con su referencia. NO inventes
   formatos de publicCode ni assetRef (ni regex de ULID, ni prefijos).
3. Lista de superficies habilitadas en un archivo versionado del repo, leída
   en build, VACÍA. Rutas y acciones transitorias tienen identificadores
   distintos (p. ej. la ruta /assets/:assetRef y la acción split).
4. Superficie deshabilitada ⇒ No aprobada ⇒ 404. Acción deshabilitada ⇒ no
   se renderiza (expón una función para consultarlo; nadie la usa todavía).
5. Una única página 404, sin guard y sin estado restaurable.

QUÉ NO HACER:
- Consultar la lista desde cualquier lógica de permisos o de rol.
- Página "Próximamente" o mensajes del tipo "no disponible todavía".
- Flags en runtime, variables remotas o lectura de la lista en el cliente.
- Guards de sesión (son W-4).

DEFINITION OF DONE:
- Vitest: cada ruta del árbol clasificada; cada caso de No aprobada;
  superficie deshabilitada ⇒ No aprobada.
- Playwright: con la lista vacía, TODAS las rutas del árbol responden 404
  sin sesión, y /panel/platform/x responde 404.
- Aserciones negativas: una ruta No aprobada nunca redirige a /login; el
  clasificador nunca devuelve Autenticada para /panel/platform/**.
- Output literal de ambos runners.
```

---

### TAREA W-3 — Módulo de sesión

**Estado:** ⏳ PENDIENTE | **Rama:** `feat/web-session` | **Depende de:** Iteración 1 aprobada

```
TAREA: Implementar la sesión del cliente según D2 y G-W2/G-W3, sin pantalla de
login real (su contrato no existe).

CONTEXTO YA CONGELADO:
- ADR-042-frontend-web-paxfide-web.md D2; claude/front-fase2.md §8 (G-W2,
  G-W3) y §11 (auditoría de salidas); front-fase1.md §3 (máquina de sesión,
  T-1).
- El JWT es mínimo (sub, iat, exp, firma): NO contiene roles ni organización.

ENTREGABLES:
1. Máquina de sesión UNKNOWN → RESTORING → AUTHENTICATED | LOGGED_OUT, con
   RESTORING → LOGGED_OUT inmediato. Transiciones como unión discriminada con
   switch exhaustivo.
2. Almacén del JWT en memoria del módulo, expuesto solo al cliente HTTP
   autenticado.
3. Punto de entrada "establecer sesión con token" (lo invocará LoginPage
   cuando exista su contrato). No implementes la llamada HTTP de login.
4. Handler de 401: petición autenticada con JWT ⇒ LOGGED_OUT; petición de
   tracking ⇒ sin efecto en la sesión.
5. Destino post-login retenido en memoria: se fija al redirigir a /login, se
   consume una sola vez, se reemplaza con un intento nuevo, se pierde al
   recargar.
6. Señal de logout entre pestañas con BroadcastChannel: el mensaje contiene
   SOLO un tipo de señal. El logout manual la emite; la expiración T-1 NO.

QUÉ NO HACER:
- localStorage, sessionStorage, cookies, IndexedDB (ni siquiera para
  "flags").
- Decodificar el JWT.
- ?next= u otro parámetro de retorno.
- Importar este módulo desde código de servidor de Next.

DEFINITION OF DONE:
- Vitest: cada fila de la auditoría de salidas de front-fase2.md §11 para
  sesión y destino retenido.
- Aserciones negativas: el 401 de tracking no cambia el estado; T-1 no
  emite señal; el mensaje de BroadcastChannel no contiene el token; ninguna
  API de almacenamiento del navegador es invocada (espía sobre Storage,
  document.cookie e indexedDB).
- Output literal de vitest.
```

---

### TAREA W-4 — Guards de cliente, bfcache y frontera servidor/sesión

**Estado:** ⏳ PENDIENTE | **Rama:** `feat/web-guards` | **Depende de:** W-2 y W-3 aprobados

```
TAREA: Implementar el guard de cliente y los invariantes de seguridad de
navegación.

CONTEXTO YA CONGELADO:
- claude/front-fase2.md §8: tabla de decisión (3 estados × 4 categorías),
  invariantes 1–6, invariante 4 reforzado (bfcache), consecuencia de C1
  (guard exclusivamente de cliente).
- ADR-042-frontend-web-paxfide-web.md D3 y D4.

ENTREGABLES:
1. Función de guard pura: (estado de sesión, categoría) → permitir / esperar
   / redirigir a /login reteniendo el destino / 404. Solo conoce sesión y
   categoría.
2. Integración en el cliente: las páginas autenticadas se renderizan solo en
   cliente; el servidor devuelve siempre el mismo shell.
3. Mecanismo para el invariante bfcache: elígelo, justifícalo en el PR y
   pruébalo en navegador real.
4. Script de verificación estática, sin dependencias nuevas, ejecutado en CI:
   falla si un route handler, server action o middleware importa (directa o
   transitivamente dentro del repo) el módulo de sesión o el cliente HTTP
   autenticado.

QUÉ NO HACER:
- Middleware de servidor para autenticación.
- Que el guard lea roles, estado del activo, códigos HTTP o el Outbox.
- Redirigir ante un 403.

DEFINITION OF DONE:
- Vitest: las 12 celdas de la tabla + idempotencia (aplicar el guard dos veces
  no cambia el resultado ni genera bucles).
- Playwright:
  a) logout → botón atrás ⇒ no se ve contenido autenticado;
  b) logout en la pestaña A ⇒ la pestaña B pasa a LOGGED_OUT;
  c) superficies deshabilitadas ⇒ 404 TAMBIÉN con sesión;
  d) ninguna petición al origen Next lleva cabecera Authorization;
  e) tras establecer sesión no hay token en localStorage, sessionStorage,
     cookies ni IndexedDB.
- Aserciones negativas: una ruta pública nunca espera ni redirige; un 403
  nunca redirige.
- Output literal de ambos runners y del script estático (incluida una
  ejecución que falla contra un import prohibido de prueba).
```

---

### TAREA W-5 — Máquina de comandos web (genérica)

**Estado:** ⏳ PENDIENTE | **Rama:** `feat/web-command-machine` | **Depende de:** W-3 aprobado

```
TAREA: Implementar el mecanismo genérico de comandos sin Outbox. NINGÚN
comando concreto lo usa todavía.

CONTEXTO YA CONGELADO:
- ADR-042-frontend-web-paxfide-web.md D6; claude/front-fase2.md §10 (P-W1,
  P-W1a, P-W1b).
- sistema-visual-paxfide-web.md §4: el estado ambiguo va en amarillo, con
  título en brand-yellow-900 sobre brand-yellow-50. NUNCA en rojo.
- Lenguaje: "No pudimos confirmar", nunca "falló" ni "fue realizada".
- Hallazgo F3: en el backend, split/register devuelven void; no hay contrato
  de "mismo resultado ante duplicado". Por eso ningún formulario concreto
  entra en esta tarea.

ENTREGABLES:
1. Generador de commandId por intención, en memoria (crypto.randomUUID).
2. Clasificador de respuestas P-W1a como función pura con switch exhaustivo.
3. Máquina P-W1b: enviando → éxito | rechazado | ambiguo; rechazado → cerrar |
   nueva intención (commandId NUEVO); ambiguo → reintentar (MISMO commandId) |
   cerrar con advertencia (descarta el commandId, no envía nada).
4. Componente de aviso por estado (éxito, rechazado, ambiguo) con tokens de
   sistema-visual §4 y texto explícito; el color nunca es la única señal.
5. 401 ⇒ rechazado + T-1 a través del handler de W-3.

QUÉ NO HACER:
- Formularios de split, registrar, crear convocatoria o asignar empleado.
- Reintentos automáticos, backoff ni timers de reintento.
- Persistir el commandId.

DEFINITION OF DONE:
- Vitest: cada fila de P-W1a y cada transición de P-W1b.
- Con fetch falso, inspeccionando la PETICIÓN REAL enviada (regla 2.5):
  timeout → reintentar ⇒ commandId idéntico; 4xx → nueva intención ⇒
  commandId distinto.
- Aserciones negativas: ambiguo nunca dispara un envío sin acción del usuario;
  un 5xx nunca se clasifica como rechazado; "Cerrar" desde ambiguo no envía
  ninguna petición; el commandId no llega a ningún almacenamiento.
- Output literal de vitest.
```

---

### TAREA W-6 — `AssetPage` en solo lectura (contra backend falso, deshabilitada)

**Estado:** ⏳ PENDIENTE | **Rama:** `feat/web-asset-page-read` | **Depende de:** W-4 aprobado

```
TAREA: Implementar la pantalla de lectura de un activo contra un backend
falso. La superficie queda DESHABILITADA (D5): no se añade a la lista.

CONTEXTO YA CONGELADO:
- claude/front-fase2.md W1-bis, T3 y §9 (fila AssetPage).
- api-contract-matrix.md §4b: PhysicalAssetOperationalReadModel = assetRef,
  lifecycleStatus, currentCustodianRef, currentLocation, quantity,
  unitOfMeasure, campaignRef.
- Hallazgo F5: PhysicalAssetOperationalReadPort y el controller NO existen
  en el backend. La ruta HTTP de la matriz (GET /physical-assets/{assetRef})
  se usa en el cliente falso; no asumas prefijos (/api/v1) que la matriz no
  declara: centraliza la base URL en un único punto configurable.

ENTREGABLES:
1. Tipo del ReadModel con EXACTAMENTE los 7 campos. El parser descarta
   cualquier otro campo de la respuesta.
2. Estados: carga; contenido; DELIVERED solo lectura; 403 (estado de
   pantalla, sin redirección, texto neutro según sistema-visual §4); 404
   del recurso; error de red.
3. Un cliente HTTP falso para los tests (en el código de test, no en
   producción).

QUÉ NO HACER:
- Botón o acción de split (R11, F3, cuerpo no definido).
- Añadir la superficie a la lista de habilitación.
- Derivar acciones disponibles del lifecycleStatus (T3: no se copia
  ActionResolver).

DEFINITION OF DONE:
- Testing Library: los seis estados.
- Aserción negativa: una respuesta con donorRef, parentAssetRef y un campo
  financiero NO renderiza ninguno de ellos.
- Playwright: /assets/x sigue respondiendo 404 en el build normal (la
  superficie está deshabilitada).
- Output literal de ambos runners.
```

---

### TAREAS BLOQUEADAS — no asignar a ningún agente

| Tarea | Bloqueo | Se desbloquea cuando |
|---|---|---|
| W-7 `feat/web-login-page` | Cuerpo de `POST /auth/login` sin especificar (E4) | El contrato está en la matriz y el backend lo implementa |
| W-8 `feat/web-campaign-public-page` | Campos de `ConvocatoriaReadModel` sin especificar (E3); módulo `convocatoria` inexistente | Contrato en la matriz; entonces se redacta su bloque con SSR + OG + `noindex`, el servidor falso `node:http` y el estado "no encontrada" sin fijar código HTTP |
