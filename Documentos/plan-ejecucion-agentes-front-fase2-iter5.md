# Plan de Ejecución para Agentes — Frontend Fase 2, Iteración 5: aplicación del diseño UX

**Estado:** ✅ **APROBADA por Carlos el 2026-10-05** (P-5.3 cumplida). La aprobación **no** levanta las demás precondiciones: ningún bloque se lanza mientras P-5.1 y P-5.2 sigan abiertas (ver "Registro de verificación").
**Complementa** a `plan-ejecucion-agentes-front-fase2.md` (W-0 a W-6). Se usa igual: se pega el Prompt Maestro (`Promt-maestro-front-fase2.md` §1) y, **debajo**, un solo bloque de este documento, en una sesión de agente nueva.
**Renumeración:** las antiguas W-7 (Login) y W-8 (`/c`) pasan a **W-11** y **W-12**; siguen bloqueadas.

## Precondiciones (todas obligatorias)

| # | Precondición | Quién | Estado (2026-10-05) |
|---|---|---|---|
| P-5.1 | Pila W-0 a W-6 **mergeada en `develop`**, tras los dos ajustes pendientes (Next 16.3.8 en W-0; test de producción para `__TEST_ROUTER__`) | Agente + Carlos (merge) | ⏳ V-1..V-4 corregidos (2.ª verificación). **No mergeable todavía:** V-5 (puntero de rama) y V-6 (sin evidencia de CI) |
| P-5.2 | El repo contiene en `Documentos/` las copias vigentes de: `diseno-ux-contractual-web-v1.md`, `delta-front-fase2-rev3.md`, `sistema-visual-paxfide-web.md`, `ADR-042-frontend-web-paxfide-web.md`, `front-fase2.md` y `hallazgos-front-fase2.md` | Carlos (copia desde el proyecto) | ✅ Copias añadidas en W-0 e idénticas a las del proyecto a 2026-10-05 (2.ª verificación); `ADR-FRONT-WEB` eliminado. Se cumple al mergear W-0 |
| P-5.3 | Iteración 5 aprobada | Carlos | ✅ 2026-10-05 |
| P-5.4 | **Solo para W-10:** frames de Penpot de `diseno-ux-contractual-web-v1.md` §8 terminados y aprobados | Equipo + Carlos | ⏳ |

## Registro de verificación de la pila W-0..W-6 (2026-10-05)

Verificado leyendo `origin/*` de `Toffy22Cj/PaxFide` (no la afirmación del agente):

| Comprobación | Resultado |
|---|---|
| `"next": "16.3.8"` en las 7 ramas | ✅ Las 7. Lockfile resuelve `next@16.3.8` |
| Pila lineal sobre `develop` (519ac1a), sin merges | ✅ 94b9c79 → 5dca94c → 3ee0743 → abfe2fc → d04916b → 6372cde → 0915fdb |
| `e2e/production.spec.ts` comprueba `__TEST_SESSION__` **y** `__TEST_ROUTER__` | ✅ |
| PRs abiertos y protección de `develop` | ❓ No verificable desde esta sesión (sin acceso API al repo). Lo confirma Carlos |

Hallazgos nuevos:

- **V-1 (bloquea el merge):** no existe `.github/workflows/` en ninguna rama. El entregable 5 de W-0 (CI en PRs hacia `develop`) y la precondición P-1/E8 nunca se cumplieron. La regla 3.2 exige CI obligatorio. Sin CI, el único respaldo de la pila es el output local del agente.
- **V-2:** el commit de W-4 (`d04916b`, guards) borra `eslint`, `eslint-config-next` y `eslint.config.mjs`, cambio ajeno a su tarea. El estado final cumple mejor la lista de D8 que W-0, pero deja el script `"lint": "eslint"` apuntando a un binario no instalado. La limpieza pertenece a W-0.
- **V-3:** `Documentos/` contiene dos versiones del ADR del frontend: `ADR-042-frontend-web-paxfide-web.md` (APROBADO, rev. 4) y `ADR-FRONT-WEB-paxfide-web.md` (PROPUESTO, rev. 2, obsoleto). Un agente puede leer la versión equivocada.
- **V-4 (informativo):** las devDependencies incluyen `@vitejs/plugin-react`, `jsdom`, `@testing-library/jest-dom` y `@types/node`, además de la lista literal de W-0. Son soporte directo de Vitest + Testing Library; deben aparecer listadas en el PR de W-0 (DoD de W-0).

### Segunda verificación (2026-10-05, tras la corrección del agente)

| Comprobación | Resultado |
|---|---|
| V-1: `.github/workflows/ci.yml` en W-0 | ✅ Existe: Node 22, pnpm 11.26.0, `--frozen-lockfile`, typecheck, vitest, check:server, Chromium, test:e2e, rechazo de `.skip(`/`.only(`, actions fijadas por SHA |
| V-2: ESLint fuera desde W-0; W-4 sin cambios de ESLint; sin script `lint` | ✅ En las 7 ramas |
| V-3 y P-5.2 | ✅ (ver tabla de precondiciones) |
| V-4: justificación de las 4 devDependencies | ✅ Aportada; se acepta como soporte directo de Vitest + Testing Library (D8) |
| Código del tope (W-6) frente al tope anterior | ✅ Solo difieren CI, documentos y el script `lint`; `pnpm-lock.yaml` idéntico; `next@16.3.8` en las 7 ramas |

Hallazgos nuevos:

- **V-5 (bloquea el merge):** `feat/web-route-classifier-enablement` apunta a `c3a22b0` (*feat: web session machine*), el mismo commit que `feat/web-session`. El commit de W-2 es `36b85cd`. El PR de W-2 incluiría el código de W-3 sin revisión propia. Corrección: mover la rama a `36b85cd` (sin rebase; el orden de la pila no cambia).
- **V-6 (bloquea el merge):** no hay evidencia de ejecución del CI. El agente remitió a la pestaña *Actions* sin enlace; desde esta sesión la página de Actions no muestra ejecuciones. El workflow solo se dispara en PR hacia `develop`, así que no puede haber corrido si no existen esos PRs. La evidencia es el run en verde de cada PR, vista por Carlos.
- **Observación (no bloquea):** el workflow no declara `permissions:`; se recomienda `permissions: contents: read`.

## Documentos adicionales que rigen esta iteración

Además de los del Prompt Maestro:
- `diseno-ux-contractual-web-v1.md` (**APROBADO** 2026-10-05). Se cita por sección: `// Ref: diseno-ux-contractual-web-v1.md §5.3`.
- `delta-front-fase2-rev3.md` (decisiones aprobadas el 2026-10-05).

**Regla adicional:** ningún texto visible, token, componente o estado puede existir si no está en `diseno-ux-contractual-web-v1.md`. Si falta algo, el agente se DETIENE.

## Orden

```text
W-7 (tokens UX) ─┐
W-8 (R-UX-1)     ├─ en paralelo, tras P-5.1 a P-5.3 (tocan áreas distintas)
W-9 (estados y textos) ── depende de W-7
W-10 (componentes, Shell, AssetPage visual) ── depende de W-7, W-8, W-9 y P-5.4
```

---

### TAREA W-7 — Tokens UX y verificación de contraste ampliada

**Estado:** ✅ APROBADA (2026-10-05) · ⏳ espera P-5.1 y P-5.2 | **Rama:** `feat/web-ux-tokens` | **Depende de:** P-5.1 a P-5.3

```
TAREA: Añadir los tokens nuevos del diseño UX aprobado, sin modificar ningún
token existente, y ampliar la verificación de contraste.

CONTEXTO YA CONGELADO:
- diseno-ux-contractual-web-v1.md §3.1 (neutral-50 #F8FAFA, neutral-100
  #F0F4F4, neutral-200 #E2E9E9, neutral-400 #739797, overlay =
  brand-green-900 al 50 %), §3.2 (restricciones), §3.3 (espaciado, radios,
  sombra del modal, tamaños tipográficos, foco, objetivo táctil, anchos) y
  Anexo A (cifras de referencia).
- sistema-visual-paxfide-web.md: tokens existentes; NO se modifican.

ENTREGABLES:
1. Custom properties de §3.1 y §3.3, con los nombres exactos del documento.
2. Ampliación del test de contraste existente con los pares del Anexo A,
   validando las cifras con 2 decimales: 8,72 · 7,47 · 7,06 · 8,24 · 6,78 ·
   3,18 · 3,04 · 6,28.
3. Tests de las restricciones de §3.2 como ASERCIONES NEGATIVAS:
   - brand-blue-700 sobre neutral-50 = 4,37 → NO cumple 4,5;
   - neutral-400 sobre neutral-100 = 2,87 → NO cumple 3.
   Además, un test que falle si alguna hoja CSS combina brand-blue-700 como
   color de texto con neutral-50 como fondo en la misma regla.
4. El test existente "hexadecimal fuera de tokens" debe seguir en verde con
   los nuevos valores.
5. Foco global: contorno de 2 px brand-green-900 con separación de 2 px
   (§3.3), aplicado con :focus-visible.

QUÉ NO HACER:
- Modificar o renombrar un token existente.
- Añadir tokens que no estén en §3 (ni colores, ni sombras, ni tamaños).
- Modo oscuro o fuentes web.

DEFINITION OF DONE:
- Output literal y completo de pnpm typecheck y pnpm vitest run
  --reporter=verbose.
- Diff de la hoja de tokens: solo adiciones.
```

---

### TAREA W-8 — R-UX-1: motivo del último cierre de sesión (en memoria)

**Estado:** ✅ APROBADA (2026-10-05) · ⏳ espera P-5.1 y P-5.2 | **Rama:** `feat/web-session-logout-reason` | **Depende de:** P-5.1 a P-5.3

```
TAREA: Que la máquina de sesión recuerde EN MEMORIA por qué pasó a
LOGGED_OUT, para que Login pueda mostrar el aviso correspondiente.

CONTEXTO YA CONGELADO:
- diseno-ux-contractual-web-v1.md §5.2 (R-UX-1 y la tabla de estados de
  Login: "Tu sesión expiró…" / "Cerraste sesión en otra pestaña.").
- ADR-042-frontend-web-paxfide-web.md D2 (JWT solo en memoria), G-W3 (solo
  se propaga la SEÑAL), T-1 (la expiración no se propaga).

ENTREGABLES:
1. Tipo cerrado LogoutReason = MANUAL | EXPIRED | OTHER_TAB (unión
   discriminada; switch exhaustivo con comprobación never).
2. Asignación:
   - logout() del usuario → MANUAL;
   - handle401 con JWT (T-1) → EXPIRED;
   - recepción de la señal de otra pestaña → OTHER_TAB.
   El 401 de tracking NO asigna motivo (no toca la sesión).
3. Lectura: getLastLogoutReason(): LogoutReason | null. Se limpia al iniciar
   sesión con éxito. Se pierde al recargar (está en memoria).
4. El mensaje de BroadcastChannel NO cambia: sigue conteniendo solo la
   señal, nunca el motivo ni el token.

QUÉ NO HACER:
- Persistir el motivo en cualquier almacenamiento del navegador o en la URL.
- Usar el motivo para decidir rutas, permisos o redirecciones (el guard
  sigue conociendo solo sesión y categoría).
- Implementar LoginPage (W-11 sigue bloqueada).

DEFINITION OF DONE:
- Vitest: cada transición asigna su motivo; el login con éxito lo limpia.
- Aserciones negativas: el 401 de tracking no asigna motivo; T-1 sigue sin
  emitir la señal; el mensaje entre pestañas no contiene el motivo; ninguna
  API de almacenamiento es invocada (espías sobre Storage, document.cookie
  e indexedDB).
- Suite completa en verde (pnpm vitest run --reporter=verbose y
  pnpm test:e2e con --reporter=list), output literal.
```

---

### TAREA W-9 — Estados globales y textos aprobados

**Estado:** ✅ APROBADA (2026-10-05) · ⏳ espera W-7 | **Rama:** `feat/web-ux-states-copy` | **Depende de:** W-7 aprobado

```
TAREA: Aplicar los textos y estados aprobados a los estados globales y a la
semántica de AssetPage, sin el acabado visual final (que llega en W-10 con
Penpot).

CONTEXTO YA CONGELADO:
- diseno-ux-contractual-web-v1.md §5.3 (etiquetas, traducción de
  lifecycleStatus, "Sin registrar", quantity sin transformación, aviso de
  DELIVERED, 404 del recurso), §5.5 (página 404), §6 (textos y colores por
  estado) y §7 (accesibilidad).
- delta-front-fase2-rev3.md K-5: el detail de ProblemDetail NUNCA se muestra.

ENTREGABLES:
1. Componentes de estado con los textos EXACTOS de §6: LoadingState
   (aria-live="polite"), ErrorState (con "Reintentar" solo en lecturas),
   ForbiddenState, NotFoundState, AmbiguousState y StatusNotice (role
   "status" o "alert" según §4). Colores por token de sistema-visual §4.
2. Página 404 global con el texto de §5.5, idéntica con y sin sesión.
3. AssetPage:
   - etiquetas en español (§5.3);
   - lifecycleStatus traducido con un switch exhaustivo y SIN color por
     estado;
   - currentLocation y currentCustodianRef null → "Sin registrar";
   - quantity mostrado como texto del valor recibido, sin redondeo ni
     conversión;
   - DELIVERED → StatusNotice informativo "Este activo ya fue entregado.
     Solo lectura.";
   - 404 del recurso → "No encontramos este activo. Verifica el código QR.".
4. lang="es" en el documento.

QUÉ NO HACER:
- Mostrar el detail o el title de un ProblemDetail.
- Inventar textos que no estén en §5–§6.
- Botón de split (D5: acción deshabilitada = no se renderiza).
- Estilos finales de componentes (W-10).

DEFINITION OF DONE:
- Testing Library: cada estado con su texto exacto.
- Aserciones negativas: una respuesta de error con
  {"detail":"stack trace…"} NO aparece en pantalla; ningún estado de
  AssetPage usa color para lifecycleStatus; el botón de split no existe en
  el DOM.
- Playwright: la 404 global muestra el mismo texto con y sin sesión.
- Output literal y completo de typecheck, vitest y test:e2e.
```

---

### TAREA W-10 — Componentes base, Shell y AssetPage visual

**Estado:** ✅ APROBADA (2026-10-05) · 🔒 **BLOQUEADA por P-5.4** (frames de Penpot aprobados) | **Rama:** `feat/web-ux-components-shell` | **Depende de:** W-7, W-8, W-9

```
TAREA: Implementar los componentes base, el Shell y el acabado visual de
AssetPage, fiel a los frames de Penpot aprobados.

CONTEXTO YA CONGELADO:
- diseno-ux-contractual-web-v1.md §4 (componentes), §5.1 (Shell), §5.3
  (AssetPage) y §8 (frames).
- Los frames de Penpot citan en su título la sección del documento. Un
  elemento de Penpot sin sección correspondiente NO se implementa: se
  reporta.

ENTREGABLES:
1. Button (primario/secundario; normal, foco, deshabilitado, enviando),
   TextField, PasswordField (Mostrar/Ocultar en texto), Modal (foco
   atrapado, Escape = Cancelar, devuelve el foco), DefinitionList,
   PageHeader.
2. Los 5 iconos SVG propios de §3.4, inline, con aria-hidden o nombre
   accesible.
3. Shell (§5.1): logo + "PaxFide"; "Cerrar sesión" solo en AUTHENTICATED,
   que ejecuta el logout manual (G-W3). Sin barra lateral.
4. AssetPage con PageHeader + DefinitionList, mobile-first (360 px).

QUÉ NO HACER:
- Table, LoadMore y EmptyState (sin consumidor hasta N1).
- Card ni componentes no listados en §4.
- Librería de iconos o de componentes (D8).
- Modal de split, LoginPage o /c.

DEFINITION OF DONE:
- Testing Library: estados de cada componente; Modal con foco atrapado y
  Escape.
- Playwright: Shell público vs autenticado; AssetPage a 360 y 1280 px.
- Aserción negativa: "Cerrar sesión" no se renderiza en LOGGED_OUT.
- Capturas de pantalla a 360 y 1280 px adjuntas al PR, junto al frame de
  Penpot correspondiente.
- Output literal de typecheck, vitest y test:e2e.
```

---

### TAREAS BLOQUEADAS — no asignar a ningún agente

| Tarea | Bloqueo | Se desbloquea cuando |
|---|---|---|
| W-11 `feat/web-login-page` (antes W-7) | Ficha ID-01 no normativa (Enmienda 1 de ADR-041); endpoint sin implementar | La Enmienda 1 está aprobada y el backend implementa el login |
| W-12 `feat/web-campaign-public-page` (antes W-8) | E3 (campos de `ConvocatoriaReadModel`); módulo `convocatoria` sin código; narrativa (ADR-040) | Contrato de campos en la matriz y backend implementado |
| Acción `split` | R11/F3, cuerpo sin especificar, R10, verificación de P7 | Todos resueltos con evidencia (D5) |
| `/panel` y `/panel/campaigns` | N1 | Ficha N1 normativa |
