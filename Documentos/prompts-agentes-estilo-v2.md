# Prompts para agentes — Estilo v2 de `paxfide-web` (Fase 7)

**Estado: APROBADO — Carlos, 2026-10-21. VS-0 cerrada en el PR #29.** Ningún agente recibe estos prompts hasta que se cumplan las precondiciones de §1.
**Fecha:** 2026-10-21 (UTC).
**Sigue el formato de:** `Promt-maestro-front-fase2.md` (contexto maestro + un bloque de tarea por sesión). Lo complementa; no lo sustituye en lo que este documento no toca.
**Insumos visuales:** `paxfide-landing.html`, `paxfide-home.html`, `paxfide-panel.html`, `paxfide-linea-tiempo.html`, `paxfide-movimiento.html` (versiones del 2026-10-20). Son **referencia visual**, no contrato: ver §2.

---

## 0. Cómo usar este documento

1. Una sesión de agente = el bloque de §4 (contexto maestro) + **un solo** bloque de tarea de §6.
2. El primer entregable de cada tarea es su `implementation_plan`. El agente se detiene ahí hasta que Carlos lo apruebe (regla 3.4).
3. Las tareas siguen el orden de §5. No se paralelizan dos tareas que toquen el mismo módulo.
4. Ningún agente se auto-aprueba, abre la tarea siguiente ni crea documentos no pedidos (reglas §1, §2.1).

---

## 1. Precondiciones (humanas, antes de la primera sesión)

| # | Precondición | Estado al 2026-10-21 |
|---|---|---|
| P-1 | `sistema-visual-paxfide-web-enmienda-1.md` (revisión 2) **APROBADA** | Cumplida — Carlos, 2026-10-21 |
| P-2 | Canvas de la ciudad animada: resuelto en la revisión 2 de la enmienda (R-F4 admite `<canvas>` 2D nativo; se aprueba con E7). Ver §1.1 | Dentro de P-1 |
| P-3 | Ciudad detrás del panel: resuelto. El prototipo ya la oculta en la parte administrativa (enmienda §3.1, R2-5) | Resuelta |
| P-4 | **Q-R1**: rutas de la landing y el home (§1.2) | Decidida — Carlos, 2026-10-21: `/` y `/home`; `/home` es el destino por defecto tras iniciar sesión |
| P-5 | Huecos de campos **G-1 a G-8** (§3.4) | Decidida — Carlos, 2026-10-21: los datos son **necesarios**. El front implementa sin ellos y los añade cuando el backend los entregue; el contrato de backend está por definir |
| P-6 | **T-1**: cómo se muestra el `trackingCode` en la línea de tiempo (§3.5) | Decidida — Carlos, 2026-10-21: enmascarado + "Ver código" + "Copiar" |
| P-7 | Archivos `woff2` de Bricolage Grotesque y JetBrains Mono, con su licencia OFL, disponibles para el agente (los descarga Carlos o un agente con red al sitio oficial de cada fuente) | Cumplida — archivos y licencias OFL en el repo; DF7-04 ratificada |

### 1.1 Canvas en el fondo animado

La ciudad animada de home es un `<canvas>` 2D. Es una API nativa del navegador, así que **no es una dependencia** (no necesita ADR). La revisión 2 de la enmienda cambió R-F4 para admitirlo: sin librerías ni WebGL, detenido con la pestaña oculta, con pausa y con `prefers-reduced-motion`, y nunca en la parte administrativa.

### 1.2 Q-R1 — Rutas

Hoy `/` es un "Hello world", no está en las superficies habilitadas, y el área de la organización vive en `/panel/**`. Tras iniciar sesión, `RouteGuard.tsx` manda a todos a `/panel` (`router.replace(dest || '/panel')`). **Decisión de Carlos (2026-10-21):**

| Prototipo | Ruta | Guard |
|---|---|---|
| Landing | `/` | Pública |
| Home (inicio de cualquier cuenta tras iniciar sesión) | `/home` | JWT |
| Panel de la organización | `/panel` (ya existe) | JWT + rol (sin cambio) |
| Línea de tiempo | `/tracking` (ya existe) | `trackingCode` en memoria (sin cambio) |

- El destino por defecto tras iniciar sesión pasa de `/panel` a `/home` (si hay un destino guardado, manda ese, como hoy).
- La landing se ve igual con o sin sesión; con sesión, la cabecera ofrece "Ir a mi inicio".
- Desde `/home` se llega a `/panel` solo si `GET /me` trae rol en una organización.
- VS-4 añade `/` y VS-5 añade `/home` a `enabled-surfaces*.json` y a `front-fase2.md` §7, cada una en su PR. Ninguna otra ruta.

---

## 2. Regla de los prototipos (la más importante)

Los HTML se hicieron para explorar el aspecto, con datos inventados. **Del prototipo se toma la forma; del contrato, los datos.**

| Se toma del prototipo | NO se toma del prototipo |
|---|---|
| Composición, jerarquía, espaciado, ilustraciones SVG, animaciones y su secuencia | Ningún campo, texto de estado, categoría, enumerado ni dato de ejemplo |
| La estructura de una pantalla (qué bloques hay y en qué orden) | Hexadecimales: se sustituyen por tokens. Si un color no tiene token, el agente se detiene |
| Copy decorativo genérico (títulos de sección, explicaciones) cuando Carlos lo apruebe en el plan | Textos de estado: salen de `labels.ts` / archivo de textos (M-20) |
| | Carga de fuentes desde Google Fonts (landing, línea de tiempo, movimiento) |
| | `localStorage` para la posición de la barra (fase 2 de la navegación, §8 de la enmienda) |

**Si un bloque del prototipo necesita un dato que no está en §3, el bloque se implementa sin ese dato o no se implementa, y el agente lo reporta.** Nunca se inventa un campo, un endpoint ni un valor "de relleno".

---

## 3. Tabla de campos: prototipo → contrato

Fuente: `Documentos/referencia-api-v1.md` del backend (implementado en `develop`) y ADR-050/ADR-051 (aprobados, **no implementados**).

**Leyenda:** ✅ existe y se usa · 🔁 se deriva en el cliente de campos que existen · ⛔ no existe: se omite · ⏳ contrato aprobado pero no implementado: se omite hasta que exista.

### 3.1 Línea de tiempo (`paxfide-linea-tiempo.html` → `/tracking`)

| Dato en el prototipo | Contrato | Regla |
|---|---|---|
| `TRK-2026-8841` en la cabecera | `trackingCode` (credencial) | Según **T-1** (§3.5): enmascarado por defecto, con "Ver código" y "Copiar" |
| `$300.000 COP` | `financialSnapshot.originalAmount` + `currency` (`long`, unidades mínimas, EF3) | ✅ con `money.ts` |
| Convocatoria · ciudad · organización (`sub`) | `campaignTitle?`, `organizationName?` (G-1, nota del 2026-10-21 de §8) | ✅ título y organización desde A-4, solo si llegan; ⛔ la ciudad |
| Píldora "En distribución · 2 lotes" | `status: ACTIVA\|EN_PROCESO` + `logistics.length` | ✅ / 🔁; el texto sale del archivo de textos, no del prototipo |
| Paso raíz "Donada" con fecha (`FUNDS_CLEARED`) | `financialSnapshot` sin fechas | ✅ el importe confirmado; ⛔ **G-2**: la fecha del pago |
| `assets[].name` ("Lote A · 120 Kits de alimentos"), `type` | `assetType`, `quantity`, `unitOfMeasure` | 🔁 con `labels.ts` y `quantity.ts`; ⛔ nombres libres y descripciones |
| `steps[]`: `ev`, `date`, `locationZone`, `custodianCategory`, `status` | `GET …/assets/{assetRef}/history` → `{eventType, timestamp, locationZone?, custodianCategory, status}` | ✅ |
| `custodianCategory`: "Pasarela de pago", "Centro comunitario", "Organización comunitaria" | Enumerado cerrado: `LOGISTICS_PARTNER`, `REGIONAL_WAREHOUSE`, `LAST_MILE_CARRIER`, `LOCAL_ALLY`, `UNCATEGORIZED` | ✅ solo con `custodianLabel()`; ⛔ las categorías inventadas |
| `locationZone: null` | `locationZone?` (falta en `DISPATCHED`, `SPLIT`, `CUSTODY_TRANSFERRED`, …) | ✅ texto aprobado para "sin zona pública"; nunca "en camino a X" inventado |
| `hash` y `sealed` en cada paso | No hay hash por evento. Integridad por lote: `GET …/integrity` → `batches[]`, `unanchoredEvents` | ⛔ **G-3**: el hash y el sello por paso. 🔁 una insignia de integridad de la donación completa (ficha P4) |
| `children` / sublotes "B1", "B2" | `logistics[]` sin `parentAssetRef` | ⛔ **G-4**: el árbol. Se muestran como lista plana |
| "Escuela San José" | Nada | ⛔ **nunca**: es el destinatario (privacidad) |
| `txt` (narración de cada paso) | `GET …/narrative` → `{status, content?, source?}` | ✅ un resumen marcado "generado por IA" cuando `AVAILABLE`; ⛔ texto por paso |
| Animación del camión en ruta | — | Solo si el último `eventType` del activo es `ASSET_DISPATCHED` (no se anima lo que no pasó) |

### 3.2 Panel (`paxfide-panel.html` → `/panel`)

| Dato en el prototipo | Contrato | Regla |
|---|---|---|
| Nombre de la organización | `GET /organizations/{id}` → `name?`, `logoUrl?` (solo `ADMINISTRATOR` o `REPRESENTATIVE`) | ✅ (logo y DF7-22 inicial); para `EMPLOYEE`, sin nombre ni logo |
| KPI "Convocatorias abiertas" | `GET /organizations/{id}/campaigns` (solo `ADMINISTRATOR`) | 🔁 contar `status = OPEN` |
| KPI "1 cierra en 2 días", campaña "cierra pronto", columna "end" | `GET /organizations/{id}/campaigns` → `endDate?` | ✅ (G-5 resuelto, D-P9: "Cierra pronto" dentro de los 7 días calculado en cliente) |
| KPI "Recaudado en octubre" | `clearedAmount` acumulado, sin fechas | 🔁 "Recaudado" total por moneda; ⛔ por mes (**G-6**) |
| KPI "Lotes por despachar" | `GET /organizations/{id}/physical-assets` → `lifecycleStatus` | 🔁 contar los que pueden despacharse; ⛔ "desde hace más de 3 días" (sin fechas) |
| KPI "Integridad · 2 pasos esperan anclaje" | No hay integridad por organización | ⛔ **G-7**: se omite el KPI |
| Pendiente "No pudimos confirmar el despacho" (ambiguo) | Estado de la máquina de comandos (D6), en memoria | ✅ solo durante la sesión que lo originó |
| Pendiente "Registrar la compra… $1.200.000 por aplicar" | `GET /organizations/{id}/funds` → `availableAmount` | ✅ |
| Pendiente "No tiene empleado asignado" | `assignedEmployeeCount = 0` | ✅ |
| `feed` (actividad reciente) | No hay endpoint de actividad | ⛔ **G-8**: se omite el bloque |
| Tabla de convocatorias: título, estado, %, recaudado, meta | `title`, `status`, `clearedAmount?`, `targetAmount?`, `endDate?` | ✅ / 🔁 el % solo si hay meta |
| Tabla de lotes: `L-0142` | `assetRef` (opaco) | Como lo muestra hoy `/panel/assets`; ⛔ códigos legibles inventados |
| Tabla de lotes: "Kits de higiene" | `GET /organizations/{id}/physical-assets` → `assetType?` | ✅ (G-4b resuelto) |
| Tabla de lotes: cantidad, estado, ubicación | `quantity`, `unitOfMeasure`, `lifecycleStatus`, `currentLocation?` | ✅ (`currentLocation` falta en `DISPATCHED`) |
| Tabla de lotes: fecha y hora | Sin timestamps | ⛔ |

### 3.3 Home y landing

| Dato en el prototipo | Contrato | Regla |
|---|---|---|
| Saludo con `givenName` / `familyName`, correo | `GET /account/profile` (ADR-050) | ⏳ hasta que el backend lo implemente: saludo sin nombre |
| Roles y vistas por rol | `GET /me` → `roles`, `organizationId?`, `platformAuthority?` | ✅ |
| Pantallas de entrada (bienvenida, aceptación de términos) | ADR-050 D2 + endpoint de versiones de términos (R-5, sin definir) | ⏳ fuera de este corte |
| Barra en 4 posiciones guardada en `localStorage` | Enmienda §8: fija por ancho en este corte | ⛔ el selector; la estructura `data-nav-position` sí |
| Último código de seguimiento | Solo en memoria (el prototipo ya lo hace bien) | ✅ nunca en almacenamiento del navegador |
| Landing: convocatorias abiertas | `GET /public/campaigns` → `{publicCode, title, organizationName?, status, startDate, endDate, acceptedDonationTypes, currency?, targetAmount?, clearedAmount?, organizationVerified}` | ✅ (`organizationVerified` desde A-2, plan §3: insignia "Verificada") |
| Landing: búsqueda, filtros y orden | Ficha R-1 (congelada) | ⏳ hasta que R-1 esté en `develop` |
| Landing / tarjetas: logo | `organizationLogoUrl?` (ADR-051 Tarea 2) | ✅ desde A-2 (plan §3, D-P10); sin logo, inicial de la organización (DF7-22) |
| Landing / tarjetas: foto de portada | `coverImageUrl?` (ADR-051 Tarea 3) | ⏳ sin foto (D-P10) |
| Landing: "Seguimiento demostrativo" | — | Ilustración con datos ficticios **rotulada "Ejemplo"**, sin llamar a la API ni usar categorías fuera del enumerado |
| "Escanear QR" | Decisión pendiente (lector QR en web = dependencia nueva) | ⛔ hasta que Carlos decida |

### 3.4 Huecos de campos (P-5)

**Decisión de Carlos (2026-10-21): los nueve son necesarios.** Hasta que el backend los entregue, el front implementa la pantalla **sin** ese dato (lo que dice la columna) y no lo inventa; cuando el endpoint exista, una tarea nueva lo añade. Cómo los entrega el backend se define aparte (contrato pendiente).

| # | Hueco | Mientras no exista |
|---|---|---|
| G-1 | Título, ciudad y organización de la convocatoria en el seguimiento | Cabecera con monto y estado, sin nombre de la convocatoria |
| G-2 | Fecha del pago en el seguimiento | "Pago confirmado" con el monto, sin fecha |
| G-3 | Hash y sello por paso | Una insignia de integridad para toda la donación (P4) |
| G-4 | Relación padre-hijo de lotes en el seguimiento | Lotes en lista plana |
| G-4b | Tipo de lote en la tabla del panel | Tabla con cantidad, estado y ubicación |
| G-5 | Fecha de cierre y "cierra pronto" en el panel | Estado y porcentaje, sin fecha |
| G-6 | Recaudado por mes | "Recaudado" total por moneda |
| G-7 | Integridad por organización | La tarjeta no aparece |
| G-8 | Actividad reciente | El bloque no aparece |

Las peticiones al backend van a `solicitudes-backend.md` y siguen su propio proceso (ficha o enmienda de ADR-041). **El front no espera por ellas:** implementa sin el dato y lo añade cuando exista.

### 3.5 T-1 — El código de seguimiento en pantalla (Carlos, 2026-10-21)

El `trackingCode` es la credencial del seguimiento (`Authorization: Bearer <trackingCode>`): quien lo tiene ve la donación. Decisión de Carlos: **(b) y (c) juntas**.

| # | Regla | Origen |
|---|---|---|
| T1-1 | Por defecto se muestran solo los **4 últimos caracteres**: `···8841`. | Carlos (b) |
| T1-2 | Botón **"Ver código"** que muestra el código completo, y botón **"Copiar"**. | Carlos (c) |
| T1-3 | "Copiar" funciona **sin revelar** el código: copia desde memoria al portapapeles y anuncia "Código copiado" (`aria-live`). | Carlos, 2026-10-21 |
| T1-4 | Revelado temporal: se vuelve a ocultar al pulsar "Ocultar", a los **30 s**, al cambiar de pestaña (`visibilitychange`) o al salir de la pantalla. | Carlos, 2026-10-21 |
| T1-5 | Mientras está oculto, el código completo **no está en el DOM** (ni en `title`, `aria-label`, `data-*` ni texto con CSS que lo tape). Solo vive en la memoria de la sesión (D2). | Carlos, 2026-10-21 |
| T1-6 | Junto al botón, un aviso corto: "Este código abre tu seguimiento. No lo compartas en capturas." | Carlos, 2026-10-21 |
| T1-7 | Nunca en la URL, el almacenamiento del navegador, los logs, la analítica ni el comprobante (reglas vigentes). | ADR-041 §2.7, D2 |

Tests: el DOM no contiene el código completo antes de "Ver código" ni después de ocultarlo (aserción negativa); el temporizador de 30 s y `visibilitychange` lo ocultan; "Copiar" escribe el código completo en el portapapeles sin revelarlo; el código no aparece en la URL ni en `localStorage`/`sessionStorage`.

---

## 4. Contexto maestro (pegar al inicio de cada sesión)

```
Eres un Ingeniero Frontend Senior trabajando en `paxfide-web`, el frontend web
de un sistema de trazabilidad de donaciones basado en Event Sourcing.
Repositorio: Toffy22Cj/PaxFide. Rama base: develop. Fase 7: estilo visual v2.

ANTES DE NADA
Comprueba en develop que sistema-visual-paxfide-web-enmienda-1.md dice
"APROBADA" y que prompts-agentes-estilo-v2.md existe. Si no, DETENTE.
Los prototipos HTML están en la ruta que te indique Carlos; si no la
tienes y tu tarea los necesita, pregunta.

REGLA DE ORO
No eres un generador de pantallas. Implementas un diseño ya decidido. Cada
componente, módulo o función pública que escribas se señala contra una
decisión concreta (ADR-046 D1–D8, front-fase2.md, sistema-visual-paxfide-web.md,
sistema-visual-paxfide-web-enmienda-1.md o prompts-agentes-estilo-v2.md).
Si no puedes señalar cuál, DETENTE y pregunta.

PRIMER ENTREGABLE DE TODA TAREA
Un implementation_plan con: archivos que crearás o cambiarás, componentes,
tokens que usarás, de qué endpoint sale cada dato (fila de la tabla §3),
tests, y lo que del prototipo NO vas a implementar y por qué.
Después DETENTE hasta que Carlos lo apruebe. Cada nueva iteración del plan
también espera aprobación.

DOCUMENTOS QUE RIGEN (léelos antes de escribir código; cita por sección)
- ADR-046-frontend-web-paxfide-web.md y su Enmienda 1 (APROBADOS).
- front-fase2.md (rutas §7, guards §8), diseno-ux-contractual-web-v1.md.
- sistema-visual-paxfide-web.md (v1) + sistema-visual-paxfide-web-enmienda-1.md
  (tokens claros y oscuros, contrastes, fondos, fuentes, radios, sombras,
  movimiento, navegación). Solo vale lo APROBADO; lo [Abierto] no se
  implementa.
- prompts-agentes-estilo-v2.md: §2 (regla de los prototipos) y §3 (tabla de
  campos). La tabla manda sobre el prototipo.
- Backend: referencia-api-v1.md (lo implementado). ADR-050 y ADR-051 están
  aprobados pero NO implementados: sus campos no se usan todavía.

LOS PROTOTIPOS HTML SON REFERENCIA VISUAL, NO CONTRATO
- Tomas de ellos: composición, jerarquía, SVG, secuencia de animación.
- NO tomas: campos, datos de ejemplo, categorías, textos de estado,
  hexadecimales, Google Fonts ni localStorage para preferencias.
- Si un bloque necesita un dato que no está en la tabla §3 con ✅ o 🔁:
  lo implementas sin ese dato o no lo implementas, y lo reportas.
- Nunca inventes un campo, endpoint, enumerado, categoría de custodio,
  nombre de lote, hash, fecha ni texto de relleno.

DECISIONES QUE NO SE DISCUTEN EN TU TAREA
- D2: JWT solo en memoria. trackingCode solo en memoria. Nada de eso en
  localStorage, sessionStorage, cookies, IndexedDB, URL ni logs.
- D3: sin BFF. Route handlers, server actions y middleware nunca tocan el
  JWT ni el trackingCode.
- D5: una superficie no habilitada da 404 y su acción no se renderiza.
  Nunca "Próximamente". No añades superficies ni rutas: lo decide Carlos.
- D6: comandos sin Outbox; clasificación ÉXITO / RECHAZADO / AMBIGUO;
  ambiguo en amarillo, nunca rojo; reintento manual con el mismo commandId.
- D8: dependencias permitidas: next, react, react-dom, typescript, CSS
  Modules + custom properties, Vitest + Testing Library, Playwright.
  Prohibido añadir cualquier otra (Tailwind, librerías de componentes,
  de animación, de iconos, de QR, Framer Motion, GSAP, three.js, etc.).
  Si crees que necesitas una, DETENTE.
- Fuentes: Bricolage Grotesque y JetBrains Mono AUTOALOJADAS (woff2 en el
  repo, next/font/local o @font-face, font-display: swap, subconjunto
  latino). Nunca desde Google Fonts ni otro CDN.

COLOR, CONTRASTE Y TEMA
- Los componentes usan tokens SEMÁNTICOS (--color-text, --color-surface,
  --color-action, …), nunca hexadecimales ni tokens dark-* directamente.
- Tema claro y oscuro obligatorios. Por defecto prefers-color-scheme; el
  usuario puede forzarlo (data-theme en <html>, preferencia en el navegador
  con try/catch).
- Solo se usan pares de la tabla §3 de v1, §4.3 y §5 de la enmienda.
  Prohibido: texto blanco sobre green-500; dark-border-control como texto;
  amarillo como foco.
- Estados: cada uno con icono Y texto; ambiguo amarillo; ningún control
  dentro de un aviso de color.

MOVIMIENTO
- Duraciones y curvas solo por token (enmienda §7).
- prefers-reduced-motion: las cargas se detienen y las transiciones son
  instantáneas. Probado con un test.
- Solo se anima lo que pasó de verdad (un estado que llegó del backend).
- Fondo animado: solo en pantallas del donante, aria-hidden, sin texto
  directamente encima (superficies sólidas o translúcidas con la opacidad
  mínima de R-F1), con control de pausa, detenido con la pestaña oculta
  (reglas R-F1 a R-F7 de la enmienda, APROBADAS).

REGLAS DE CÓDIGO
1. TypeScript strict; sin any sin justificación citada.
2. Lógica pura fuera de los componentes y probada sin DOM.
3. switch exhaustivo con never en todo mapeo de estados o enumerados.
4. Todo fallo con tipo nombrado.
5. Comentario // Ref: <documento> <sección> en cada archivo con lógica
   pública o con un componente nuevo.
6. Nada fuera del contrato de la tarea. Si falta algo, repórtalo.
7. Nunca imprimas ni envíes publicCode, trackingCode, JWT ni commandId.
8. Accesibilidad: foco visible, landmarks, orden de foco igual en todas las
   posiciones de la barra, objetivos táctiles de 44 px, sin texto en imagen.

EVIDENCIA (regla 2.3)
- Pega el output LITERAL de `pnpm typecheck`, `pnpm test` y `pnpm test:e2e`
  (o `scripts/ci-local.sh`), con los totales. Nunca una tabla derivada.
- Suite COMPLETA del repo, no solo tus tests.
- Capturas en claro y en oscuro, a 390 px y a 1280 px, de cada pantalla
  tocada, en Documentos/evidencia-web/capturas/.
- Si el entorno falla, diagnostica la causa raíz antes de reportarlo.

SI DETECTAS UNA CONTRADICCIÓN, AMBIGÜEDAD O CASO NO CUBIERTO
DETENTE. Documenta el conflicto exacto (documento, sección, caso) y espera.
Ejemplos que te obligan a detenerte: el prototipo usa un color sin token,
un campo que no está en la tabla, una ruta no habilitada, una dependencia
nueva, o dos documentos que dicen cosas distintas.
```

---

## 5. Orden

```
PRECONDICIONES §1 (Carlos)
        │
VS-0 Tokens v2, tema oscuro y fuentes ───────────────┐
        │  [aprobación]                              │
VS-1 Movimiento: tokens y cargas                VS-2 Estructura y navegación
        │  [aprobación]                              │  [aprobación]
        └──────────────┬─────────────────────────────┘
                       │
VS-3 Fondo animado (solo donante)
                       │  [aprobación]
        ┌──────────────┼──────────────┬──────────────┐
VS-4 Landing      VS-5 Home       VS-6 Panel     VS-7 Línea de tiempo
(Q-R1)            (Q-R1)          (G-5…G-8)      (T-1, G-1…G-4)
                       │
VS-8 Resto de pantallas existentes (login, registro, /c, /campaigns, panel/*)
```

VS-4 a VS-7 pueden ir en paralelo **solo** si tocan carpetas distintas y ya se mergearon VS-0 a VS-3.

---

## 6. Bloques de tarea

Cada bloque se pega después del contexto maestro de §4.

### VS-0 · `feat/web-tokens-v2`

```
TAREA VS-0 — Tokens v2, tema oscuro y fuentes autoalojadas.
Rama: feat/web-tokens-v2 desde develop.
Hecha en claude/paxfide-v2-fase7-prompts-kq6k53 (PR #29), con la corrección 1.
Rige: sistema-visual-paxfide-web-enmienda-1.md §4, §5, §6, §7 (solo lo
APROBADO); sistema-visual-paxfide-web.md §2–§5.

Alcance:
- Tokens nuevos en el archivo global de tokens: el color del degradado
  según E3 (brand-green-700), brand-ground (E1), los dark-* de §4.2, radius-card,
  radius-button, radius-surface, shadow-card/hover/float (claro y oscuro),
  las cuatro curvas y las tres duraciones de §7.2.
- Capa semántica (--color-text, --color-text-secondary, --color-surface,
  --color-surface-raised, --color-bg, --color-field,
  --color-border-control, --color-divider, --color-action,
  --color-on-action, --color-link, --color-focus y los de estado) con
  valores claros y oscuros: @media (prefers-color-scheme: dark)
  bajo :root:not([data-theme="light"]) y :root[data-theme="dark"].
- Fuentes: woff2 en el repo con su licencia OFL; next/font/local o
  @font-face; font-display: swap; variables --font-display, --font-mono.
  Cuerpo en system-ui.
- Selector de tema mínimo (claro / oscuro / sistema) en una utilidad pura
  + un componente sin estilo propio; la preferencia en el navegador con
  try/catch.

Fuera: cambiar pantallas existentes (solo deben seguir funcionando con los
tokens nuevos), animaciones, navegación.

Tests (rojos primero):
- Cada par de §4.3 y §5 con toBeCloseTo(valor, 2) usando la fórmula del
  Anexo A, incluido el peor caso de R-F1; las prohibiciones de §4.3, §4.4
  y §5 como aserciones negativas.
- Ningún hexadecimal fuera del archivo de tokens (test existente ampliado).
- Peso de las fuentes en la primera carga ≤ el presupuesto aprobado (E6),
  medido en el build.
- Tema: sistema oscuro → tokens oscuros; data-theme="light" lo anula; la
  utilidad sobrevive a un localStorage que lanza.

DETENTE si: los woff2 de Bricolage Grotesque o JetBrains Mono, o su
licencia OFL, no están en el repo (no los descargues de Google Fonts ni de
otro CDN: pídelos); un token o valor que necesitas no está en la enmienda;
un componente existente usa un par que no está en ninguna tabla.
```

### VS-1 · `feat/web-motion`

```
TAREA VS-1 — Tokens de movimiento y animaciones de carga.
Rama: feat/web-motion. Depende de VS-0.
Rige: enmienda §7; sistema-visual-v2-propuesta.md §6; prototipo
paxfide-movimiento.html (solo como referencia de forma y secuencia).

Alcance: componentes de carga sin dependencias, con CSS y SVG:
- 06 Puntos de marca dentro de botones (sustituye cualquier spinner).
- 07 Esqueleto para listas y tarjetas.
- 08 Barra superior para cambios de ruta.
- 03 Camión en ruta (solo para el seguimiento).
- 09 Árbol de Merkle (solo para la verificación de integridad).
- 01 Cubos encadenados (carga inicial).
Cada uno con role/aria adecuados y versión detenida con reduced-motion.

Fuera: 02 caja que se sella, 04 huella que se escribe (muestra un hash
ficticio: no se usa con datos reales), 05 corazón (pago), 10 anillo de
progreso (subida de fotos, ADR-051 no implementado). Transiciones de
pantalla: solo las que se hagan con CSS dentro de una misma ruta; las
transiciones entre rutas quedan fuera hasta decidir cómo (DETENTE si las
necesitas).

Tests: con reduced-motion, animation-play-state o duración nula;
los colores salen de tokens; el botón con carga queda deshabilitado y
anuncia el estado.

DETENTE si: el prototipo usa una curva o duración que no está en la
enmienda §7.
```

### VS-2 · `feat/web-app-shell`

```
TAREA VS-2 — Estructura de la aplicación y navegación.
Rama: feat/web-app-shell. Depende de VS-0.
Rige: enmienda §8 (con la decisión E4); front-fase2.md §7 y §8; ADR-046 D4
y D5. Referencia visual: barra de paxfide-home.html y paxfide-panel.html.

Alcance:
- Contenedor con data-nav-position y variables --nav-inset-*.
- Móvil (< 768 px): barra inferior fija con icono y etiqueta.
- Escritorio (≥ 768 px): barra lateral (E4).
- Las entradas de la barra salen de las superficies habilitadas Y del rol
  de GET /me; una superficie deshabilitada no aparece (D5).
- Iconos SVG propios con currentColor (lista de la propuesta v2 §7).
- <nav aria-label>, aria-current, mismo orden de foco en todas las
  posiciones.

Fuera: el selector de posición de la barra (fase 2), la hoja de
personalización del prototipo, el fondo animado.

Tests: entradas según rol y superficies (incluida la aserción negativa de
una superficie deshabilitada); cambio de posición por ancho; foco y
landmarks con Playwright a 390 y 1280 px.

DETENTE si: el prototipo muestra una entrada sin ruta aprobada.
```

### VS-3 · `feat/web-animated-background`

```
TAREA VS-3 — Fondo animado de las pantallas del donante.
Rama: feat/web-animated-background. Depende de VS-0 y VS-2.
Rige: enmienda §3 (R-F1 a R-F7) con las decisiones E1 y E7. Referencia
visual: la ciudad de paxfide-home.html.

Alcance:
- Componente de fondo montado solo en las rutas del donante que Carlos
  apruebe; nunca en /panel/**.
- CSS o canvas 2D nativo (R-F4), sin librerías ni WebGL.
- aria-hidden, sin foco, sin texto ni controles directamente encima: el
  contenido va en superficies sólidas o translúcidas con la opacidad
  mínima de R-F1 (0,86 oscuro, 0,88 claro); campos siempre sólidos.
- Control visible de pausa; preferencia en el navegador con try/catch.
- Detenido desde el primer fotograma con prefers-reduced-motion.
- Detenido con la pestaña oculta (visibilitychange).
- Versión oscura propia con los colores de §3.2 de la enmienda.
- No comunica estados.

Tests: no aparece en /panel; pausa y reduced-motion detienen el bucle
(sin llamadas a requestAnimationFrame); pestaña oculta lo detiene;
el componente no es alcanzable con Tab.

DETENTE si: una regla de R-F1 a R-F7 no se puede cumplir con el diseño del prototipo.
```

### VS-4 · `feat/web-landing`

```
TAREA VS-4 — Landing pública.
Rama: feat/web-landing. Depende de VS-0 a VS-3.
Rige: §1.2 (Q-R1); referencia-api-v1.md §5 (GET /public/campaigns);
prompts-agentes-estilo-v2.md §3.3. Referencia visual: paxfide-landing.html.

Alcance:
- Ruta `/` y su superficie (§1.2). Con sesión, la cabecera ofrece "Ir a
  mi inicio" (`/home`).
- Bloque de convocatorias abiertas con GET /public/campaigns: solo los
  campos de §3.3; organizationName, targetAmount y clearedAmount son
  opcionales (faltan o llegan null: mismo tratamiento).
- Recorrido ilustrado del ciclo de una donación con datos de ejemplo
  rotulados "Ejemplo", sin llamar a la API y con categorías del enumerado.
- Enlace a cada convocatoria por /c/:publicCode.

Fuera: búsqueda y filtros (R-1), imágenes de portada y logos (ADR-051),
"Escanear QR", métricas globales de la plataforma (no hay endpoint).

Tests: lista vacía; campos opcionales ausentes y null; error de red con el
texto aprobado; nunca aparece una convocatoria PRIVATE_LINK (contrato del
backend, verificado con el servidor falso); sin peticiones a dominios de
fuentes externas (Playwright).
```

### VS-5 · `feat/web-donor-home`

```
TAREA VS-5 — Home del donante.
Rama: feat/web-donor-home. Depende de VS-0 a VS-3.
Rige: §1.2 (Q-R1); GET /me (ficha N1); GET /account/donations; §3.3 de este
documento. Referencia visual: paxfide-home.html.

Alcance:
- Ruta `/home` y su superficie (§1.2). Destino por defecto tras iniciar
  sesión: `/home` en lugar de `/panel` (RouteGuard), con test de que un
  destino guardado sigue teniendo prioridad.
- Saludo SIN nombre (GET /account/profile no está implementado).
- Accesos a las superficies habilitadas según GET /me.
- Resumen de "Mis donaciones" con GET /account/donations (intentId,
  campaignTitle?, amount, currency, status, trackingCode?). El
  trackingCode se usa solo para abrir el seguimiento en memoria (nunca en
  la URL ni en el almacenamiento).

Fuera: pantallas de entrada y términos (ADR-050 D2), nombre y correo
(ADR-050 perfil), selector de posición de la barra, ciudad navegable
("ver ciudad", arrastrar el mapa).

DETENTE si: necesitas el nombre del usuario o una ruta no aprobada.
```

### VS-6 · `feat/web-panel-v2`

```
TAREA VS-6 — Inicio del panel de la organización con el estilo v2.
Rama: feat/web-panel-v2. Depende de VS-0 a VS-2.
Rige: referencia-api-v1.md §3 y §6; ADR-046 D6; §3.2 de este documento
(con las decisiones G-4b, G-5 a G-8). Referencia visual: paxfide-panel.html.

Alcance (solo lo marcado ✅ o 🔁 en §3.2):
- Cabecera con el nombre de la organización si el rol lo permite.
- KPI: convocatorias abiertas (ADMINISTRATOR), recaudado total por moneda,
  lotes por despachar.
- Pendientes: convocatorias sin empleado (assignedEmployeeCount = 0),
  fondos con availableAmount > 0, comandos ambiguos de esta sesión.
- Tabla de convocatorias y de lotes con los campos de §3.2.
- Cada consulta según el rol: lo que el rol no puede leer no se pide y su
  bloque no aparece (el 403 nunca se usa para decidir qué mostrar).
- Fondo estático (enmienda §3.1).

Fuera: actividad reciente (G-8), KPI de integridad (G-7), fechas,
"cierra pronto" (G-5), tipo de lote en la tabla (G-4b), ciudad animada.

Tests: por rol (ADMINISTRATOR, EMPLOYEE, REPRESENTATIVE) qué bloques
aparecen y cuáles no (aserciones negativas); cuentas con 0 y con varias
monedas; currentLocation ausente en DISPATCHED; un comando ambiguo aparece
en pendientes en amarillo con icono y texto.
```

### VS-7 · `feat/web-tracking-timeline`

```
TAREA VS-7 — Línea de tiempo del seguimiento.
Rama: feat/web-tracking-timeline. Depende de VS-0, VS-1 y VS-3.
Rige: referencia-api-v1.md §8; ficha-p4-integridad-en-seguimiento.md;
§3.1 y §3.5 de este documento (G-1 a G-4 y T-1). Referencia visual:
paxfide-linea-tiempo.html.

Alcance:
- Cabecera: importe (originalAmount + currency) y estado. El trackingCode
  según §3.5 (T1-1 a T1-7).
- Un carril por activo de logistics[] (lista plana), con assetType,
  quantity y unitOfMeasure etiquetados.
- Pasos desde GET …/assets/{assetRef}/history: eventType, timestamp,
  locationZone (o el texto de "sin zona pública"), custodianCategory con
  custodianLabel().
- Insignia de integridad de la donación desde GET …/integrity:
  MATCH / MISMATCH / INCONCLUSIVE con sus textos; NO_ANCHORED y
  unanchoredEvents como "pendiente de anclaje" (amarillo, no rojo).
- Resumen de IA desde GET …/narrative, rotulado como generado por IA,
  solo con status AVAILABLE.
- Animación del camión solo si el último evento del activo es
  ASSET_DISPATCHED.
- 401 del seguimiento: estado de "código no válido" sin tocar la sesión.

Fuera: hash o sello por paso (G-3), árbol de sublotes (G-4), nombres de
lote, destinatarios, título de la convocatoria (G-1), fecha del pago (G-2).

Tests: activo sin historial; locationZone null; categoría UNCATEGORIZED;
un eventType desconocido rompe la compilación del mapeo (switch con
never); cada resultado de integridad con su texto y su color; la
narrativa PENDING no muestra contenido; ningún hash aparece en el DOM
salvo los de la insignia de integridad; el trackingCode no aparece en la
URL ni en el almacenamiento (Playwright).

DETENTE si: el prototipo necesita un campo marcado ⛔ para que una pantalla
tenga sentido.
```

### VS-8 · Resto de pantallas

Se redacta cuando VS-0 a VS-3 estén en `develop`: login, registro, `/c/:publicCode`, `/campaigns`, `/account/donations` y `/panel/**`. Es una pasada de estilo (tokens, radios, tipografía, cargas) **sin cambiar comportamiento ni contrato**, una pantalla por PR.

---

## 7. Checklist de revisión de cada PR (además de §3.3 de las reglas)

- [ ] Cada dato visible se puede señalar en la tabla §3 con ✅ o 🔁.
- [ ] Ningún hexadecimal, ningún token `dark-*` usado directamente en un componente.
- [ ] Capturas claro/oscuro a 390 y 1280 px.
- [ ] Reduced-motion probado.
- [ ] Ninguna petición a Google Fonts ni a otro dominio externo.
- [ ] `package.json` sin dependencias nuevas.
- [ ] Lo del prototipo que no se implementó está listado en el PR con su motivo.
