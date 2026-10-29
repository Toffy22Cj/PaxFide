# Enmienda 1 al sistema visual de `paxfide-web` — estilo v2, fondos, modo oscuro, fuentes y navegación

**Estado: APROBADA — Carlos, 2026-10-21 (revisión 2, con las decisiones E1 a E9 de §11).** No autoriza código por sí sola: la implementación sigue `prompts-agentes-estilo-v2.md` y el plan de cada tarea, que necesita su propia aprobación (regla 3.4).
**Fecha:** 2026-10-18 (revisión 1); 2026-10-21 (revisión 2), UTC.
**Enmienda a:** `sistema-visual-paxfide-web.md` (APROBADO 2026-09-28) y `diseno-ux-contractual-web-v1.md` §2, §3.3 y §3.4.
**Parte de:** `sistema-visual-v2-propuesta.md`, las respuestas de Carlos del 18 de octubre y los prototipos del 20 de octubre (`paxfide-landing.html`, `paxfide-home.html`, `paxfide-panel.html`, `paxfide-linea-tiempo.html`, `paxfide-movimiento.html`).
**¿Necesita ADR?** No (regla 3.5): no cambia aggregates, puertos ni concurrencia, y no añade dependencias de código. Las fuentes se empaquetan como archivos con licencia SIL OFL; `<canvas>` 2D es una API del navegador.

**Cómo leer este documento:** cada punto lleva su origen.
- **[Carlos]** — lo decidió Carlos en la conversación. Se redacta tal cual.
- **[Prototipo]** — es el valor que ya usan los prototipos de Carlos, comprobado con el script del Anexo A.
- **[Abierto]** — queda sin decidir. No se implementa hasta que se cierre.

### Cambios de la revisión 2

| # | Cambio | Por qué |
|---|---|---|
| R2-1 | Los tokens oscuros (§4.2) pasan a ser **los de los prototipos** de home y panel, no los derivados por el agente | Carlos ya diseñó el modo oscuro en sus pantallas y todos sus pares cumplen (§4.3). Así los prototipos no se rehacen |
| R2-2 | El botón primario oscuro es `brand-green-800` con texto blanco (7,40), como en los prototipos | La revisión 1 proponía un verde claro con texto oscuro sin necesidad |
| R2-3 | R-F1 admite superficies translúcidas con una opacidad mínima calculada en el peor caso | Los prototipos usan tarjetas translúcidas sobre la ciudad; con 0,86 (oscuro) y 0,88 (claro) el texto cumple sobre cualquier color de fondo |
| R2-4 | R-F4 admite `<canvas>` 2D nativo | La ciudad animada de home es un canvas; no es dependencia nueva |
| R2-5 | E9 de los prompts queda resuelto: el prototipo del panel **oculta** la ciudad en la parte administrativa y usa `neutral-50` | Verificado en `paxfide-panel.html` (`body.panel #cityWorld{visibility:hidden}`) |
| R2-6 | E1 suma la tercera opción que usan home y panel (#DCE8D6) | Es la base clara de los prototipos |
| R2-7 | Radios de tarjeta y superficie: 18 y 24 (no 20 y 26) | 26 no aparece en ningún prototipo; 18 y 24 sí |
| R2-8 | Movimiento: cuatro curvas y duraciones 150 / 300 / 450 | Unifica `paxfide-movimiento.html` con las curvas de las otras pantallas |
| R2-9 | Se registran los valores de los prototipos que **no** cumplen (§4.4) | Para que el agente los corrija y no los copie |

---

## 1. Qué no cambia

1. Los colores de marca y semánticos de `sistema-visual-paxfide-web.md` §2, en tema claro, con sus valores exactos.
2. La regla de las tablas: **un par que no está en una tabla no se usa hasta calcularlo y añadirlo**. Esta enmienda añade pares; no quita ninguno de v1.
3. Los estados de v1 §4: ambiguo en amarillo, nunca rojo; cada estado con icono **y** texto; ningún control dentro de un aviso de color.
4. Contraste WCAG 2.2 AA: 4,5 para texto normal; 3 para texto grande, iconos y bordes de controles.
5. Foco visible de 2 px con 2 px de separación, nunca amarillo.
6. Textos de estado desde un único archivo (M-20).
7. Privacidad visible: el código de seguimiento nunca en la URL ni en el comprobante.

## 2. Dirección de estilo [Carlos]

Se adopta la dirección de `sistema-visual-v2-propuesta.md` §1: cálido, con la marca visible, tipografía de display, profundidad suave y movimiento que acompaña cambios reales. **Sustituye** §2 (dirección de estilo) de `diseno-ux-contractual-web-v1.md`. Las referencias Dovetail/Zapier dejan de regir.

## 3. Fondos

### 3.1 Dos fondos [Carlos]

| Fondo | Dónde | Claro | Oscuro |
|---|---|---|---|
| **Estático** | Toda la parte administrativa (organización, convocatorias, lotes, panel, cuenta de staff) | `brand-neutral-50` #F8FAFA [Prototipo: `--pn-bg`] | `dark-bg` #0E1B16 [Prototipo] |
| **Animado** | Por ahora solo las pantallas del donante | Base según E1 | `dark-ground` #07130E [Prototipo] |

En `paxfide-panel.html` la ciudad animada se oculta al entrar en la parte administrativa y el fondo pasa a `--pn-bg`: el prototipo ya cumple esta regla.

*Nota (2026-10-24, `plan-fase7-fidelidad.md` D-F5, APROBADO):* el fondo animado se extiende al acceso (`/login`, `/register`, `/invitaciones`), con el mundo de la landing, como en el boceto. La parte administrativa sigue con el fondo estático. La tabla de arriba no se reescribe.

### 3.2 Base clara del fondo animado [Carlos: E1 = (c)]

| Opción | Valor | `brand-green-900` encima | `brand-neutral-700` encima | `brand-neutral-400` (borde) encima |
|---|---|---|---|---|
| (a) `brand-neutral-50` | #F8FAFA | 8,72 | 7,47 | 3,04 |
| (b) `brand-green-50` | #EEF6EF | 8,29 | 7,10 | 2,89 ✗ |
| (c) La de los prototipos de home y panel | #DCE8D6 | 7,20 | 6,17 | 2,51 ✗ |

**Decisión (E1, Carlos, 2026-10-21): (c).** Se registra como token `brand-ground` = #DCE8D6 (origen: prototipos de home y panel). Con cualquiera, por R-F1 no se pone texto ni controles directamente sobre el fondo animado, así que los contrastes son de referencia.

### 3.3 Reglas del fondo animado [Carlos: E7]

| # | Regla | Por qué |
|---|---|---|
| R-F1 | Ningún texto, control ni icono directamente sobre el fondo animado. Todo va sobre una superficie: sólida, o translúcida con opacidad **≥ 0,86** en oscuro (`rgba(16,38,29,.86)`) y **≥ 0,88** en claro (`rgba(255,255,255,.88)`). Los campos de formulario siempre con fondo sólido (`--color-field`). | Calculado en el peor caso (fondo blanco puro, negro puro o amarillo de marca detrás): el texto principal queda entre 6,92 y 15,25, y el secundario ≥ 5,93 (Anexo A). Con menos opacidad no se puede garantizar |
| R-F2 | Control visible para pausar la animación; la elección se recuerda en el navegador (`localStorage` con `try/catch`). | WCAG 2.2.2: movimiento de más de 5 s junto a contenido |
| R-F3 | Con `prefers-reduced-motion: reduce`, el fondo se muestra estático desde el primer fotograma. | Mismo criterio que §7 |
| R-F4 | CSS (`transform`, `opacity`) o `<canvas>` 2D nativo. Sin WebGL ni librerías. El bucle se detiene con la pestaña oculta (`visibilitychange`, como ya hace el prototipo), con la pausa de R-F2 y con R-F3. | Rendimiento y ninguna dependencia nueva (regla 3.5) |
| R-F5 | El fondo nunca comunica un estado (pago confirmado, error, ambiguo). | Un estado que solo se ve como fondo no es accesible ni honesto |
| R-F6 | Versión oscura propia (§3.1), no un filtro sobre la clara. | `filter: invert()` cambia las tonalidades de marca |
| R-F7 | `aria-hidden="true"`, sin foco, y no se monta en la parte administrativa. | Decoración |

> **Nota (2026-10-29, enmienda de R-F1 por U-17; `plan-fase7-puesta-al-dia.md` Anexo 2, APROBADO por Carlos).** La opacidad de la superficie translúcida baja a **0,82** en claro (`rgba(255,255,255,.82)`) y en oscuro (`rgba(16,38,29,.82)`), siempre con `backdrop-filter: blur(20px) saturate(1.2)`. En el navegador que no admite `backdrop-filter` vuelve a 0,88 / 0,86 (`@supports not`). Los campos siguen sólidos. Peor caso con el Anexo A (blanco, negro, amarillo de marca y las dos bases; texto principal y secundario); el desenfoque no se cuenta:
>
> | Opacidad | Mínimo en oscuro | Mínimo en claro |
> |---|---|---|
> | 0,88 / 0,86 (antes) | ≥ 6,25 | ≥ 5,75 |
> | **0,82** | **5,09** | **5,13** |
> | 0,80 | 4,74 | 4,71 |
> | 0,75 | 3,99 | 4,12 (no cumple) |
>
> El cálculo de `__tests__/design-tokens.test.ts` da 5,0874 en oscuro (`dark-text-secondary`) y 5,1246 en claro (`brand-neutral-700`); la tabla lo redondea a 5,13.

Los modos interactivos de la ciudad del prototipo ("ver ciudad", arrastrar el mapa) no entran en este corte (`prompts-agentes-estilo-v2.md`, VS-5).

## 4. Modo oscuro [Carlos: obligatorio]

Sustituye §6 de `sistema-visual-paxfide-web.md` ("modo oscuro fuera de v1").

### 4.1 Cómo se activa

- Por defecto sigue `prefers-color-scheme`.
- El usuario puede forzar claro u oscuro; la elección se guarda en el navegador (no en la cuenta: no hay contrato de backend para preferencias, y no se pide uno).
- Mismos nombres de propiedad CSS (`--color-text`, `--color-surface`, …) con valores distintos bajo `@media (prefers-color-scheme: dark)` protegido por `:root:not([data-theme="light"])` y bajo `:root[data-theme="dark"]`, como ya hacen los prototipos. Los componentes **no** usan los tokens `dark-*` directamente: usan los semánticos.

### 4.2 Tokens oscuros [Prototipo; Carlos: E2]

Salen de `paxfide-home.html` y `paxfide-panel.html`. Donde el prototipo usa un color con transparencia sobre la tarjeta, el token es el color **sólido** resultante sobre `dark-surface`, para que el contraste no dependa de lo que haya debajo.

| Token | Valor | Origen en el prototipo | Rol |
|---|---|---|---|
| `dark-ground` | #07130E | home `--bg` | Base del fondo animado |
| `dark-bg` | #0E1B16 | panel `--pn-bg` | Fondo de la parte administrativa |
| `dark-surface` | #132C22 | home `--card-solid` (el panel usa #14261F: se unifica en este) | Tarjetas, formularios |
| `dark-surface-raised` | #192F26 | panel `--pn-head` | Cabeceras de tabla, modal, hojas, menús |
| `dark-field` | #0F261D | home `--field` | Fondo de campos |
| `dark-text` | #EEF6EF | home `--fg` (= `brand-green-50`) | Texto principal |
| `dark-text-secondary` | #B9C6BE | home `--muted` (`rgba(238,246,239,.76)`) | Texto secundario |
| `dark-border-control` | #76847D | panel `--pn-ctl` | Bordes de campos y del botón secundario |
| `dark-divider` | #2F453D | home `--line` | Separadores **decorativos** solamente |
| `dark-action` | #20604C | `.btn-p` (= `brand-green-800`) | Fondo del botón primario |
| `dark-on-action` | #FFFFFF | `.btn-p` | Texto del botón primario |
| `dark-link` | #8CC3DE | panel `--pn-link` | Enlaces |
| `dark-focus` | #8CD39A | selector de la barra | Contorno de foco |
| `dark-accent-yellow` | #F3B544 | `brand-yellow-400` | Acentos y botón de énfasis (texto `brand-green-900`) |
| `dark-ambiguous-bg` / `-text` | #323F27 / #F8CF7E | `.nudge` | Estado ambiguo (nunca rojo) |
| `dark-info-bg` / `-text` | #193B39 / #BFE0F0 | `.privacy` | Información |
| `dark-success-bg` / `-text` | #214430 / #A9E6B0 | línea de tiempo `.pill` | Éxito |
| `dark-danger-bg` / `-text` | #332A20 / #FCA5A5 | línea de tiempo `.pill.fail` | Error |

**Sombras en oscuro:** `rgba(0,0,0,.30)` a `rgba(0,0,0,.45)`, como en los prototipos. La profundidad se apoya sobre todo en la escala `dark-bg` → `dark-surface` → `dark-surface-raised`.

### 4.3 Combinaciones permitidas en oscuro (calculadas)

| Primer plano / fondo | Contraste | Uso permitido |
|---|---|---|
| `dark-text` / `dark-bg` · `dark-surface` · `dark-surface-raised` · `dark-field` | 16,06 · 13,51 · 12,92 · 14,49 | Todo texto |
| `dark-text-secondary` / `dark-bg` · `dark-surface` · `dark-surface-raised` · `dark-field` | 10,01 · 8,42 · 8,05 · 9,04 | Todo texto |
| `dark-link` / `dark-bg` · `dark-surface` · `dark-surface-raised` | 9,25 · 7,78 · 7,44 | Enlaces |
| `dark-on-action` / `dark-action` | 7,40 | Texto del botón primario |
| `dark-border-control` / `dark-bg` · `dark-surface` · `dark-field` | 4,52 · 3,80 · 4,08 | Bordes de control (y texto grande) |
| `dark-focus` / `dark-bg` · `dark-surface` · `dark-surface-raised` | 10,02 · 8,43 · 8,06 | Foco |
| `dark-focus` / `dark-action` | 4,19 | Foco alrededor del botón primario |
| `dark-accent-yellow` / `dark-surface` | 8,15 (errata FE-1) | Acentos e iconos; nunca foco |
| `dark-ambiguous-text` / `dark-ambiguous-bg` | 7,58 | Texto de estado |
| `dark-info-text` / `dark-info-bg` | 8,77 | Texto de estado |
| `dark-success-text` / `dark-success-bg` | 7,57 | Texto de estado |
| `dark-danger-text` / `dark-danger-bg` | 7,41 | Texto de estado |
| `dark-text` / cualquier `dark-*-bg` de estado | 9,86 a 12,77 | Texto de estado |
| `dark-text` / tarjeta translúcida `rgba(16,38,29,.86)` sobre cualquier fondo | ≥ 9,42 | Todo texto (R-F1) |

**Nota sobre el botón primario:** `dark-action` sobre `dark-surface` da 2,01. El botón se identifica por su etiqueta (7,40), no por su borde, así que cumple WCAG 1.4.11. Un botón **sin texto** (solo icono) no usa `dark-action` como único indicador: lleva el icono en `dark-on-action` y su nombre accesible.

### 4.4 Valores de los prototipos que NO cumplen [Prototipo → corregir]

| Dónde | Par | Contraste | Corrección |
|---|---|---|---|
| Línea de tiempo, pestaña del activo B | Blanco / `brand-blue-500` | 3,96 | Texto `dark-ground` o `brand-green-900`, o solo texto grande |
| Línea de tiempo, pestaña del activo A | #0D2119 / `brand-green-500` | 4,41 | Texto `dark-ground` (#07130E) o texto grande |
| Home y panel, separadores | `dark-divider` / `dark-surface` | 1,45 | Solo decorativo; nunca como borde de un control |
| Home (claro), borde de campos sobre #DCE8D6 | `brand-neutral-400` | 2,51 | Los campos van en tarjeta con `--color-field` blanco (3,18) |
| Revisión 1 de esta enmienda | Blanco / `brand-green-500` | 3,81 | Sigue prohibido para texto normal en los dos temas |
| Línea de tiempo y movimiento | Tokens propios de oscuro (`--page-bg` #0D2119, `--bg` #0D1F18, `--card` #132C22, …) | — | Se sustituyen por los de §4.2; ninguno se añade como token |

**Prohibido en oscuro:** texto blanco sobre `brand-green-500` o `brand-blue-500`; `dark-divider` o `dark-border-control` como texto normal; amarillo como foco.

## 5. Tema claro: pares nuevos y correcciones

| Par | Contraste | Decisión |
|---|---|---|
| `brand-neutral-700` / `brand-neutral-50` | 7,47 | Permitido: texto |
| `brand-green-900` / `brand-neutral-50` | 8,72 | Permitido: texto |
| `brand-blue-800` / `brand-neutral-50` | 6,78 | Permitido: enlaces (el prototipo del panel ya lo usa) |
| `brand-blue-700` / `brand-neutral-50` | 4,37 | **No permitido** para texto normal |
| `brand-neutral-400` / `brand-neutral-50` | 3,04 | Solo borde de control (margen mínimo); preferir tarjeta blanca (3,18) |
| `brand-neutral-400` / `brand-green-50` · #DCE8D6 | 2,89 · 2,51 | **No permitido** |
| `brand-blue-700` / `brand-green-50` | 4,15 | **No permitido** para texto normal |
| `brand-blue-800` / `brand-green-50` | 6,45 | Permitido: enlaces |
| `brand-green-900` / `brand-yellow-400` | 5,00 | Permitido: botón de énfasis |
| `white` / `brand-green-500` | 3,81 | **No permitido** para texto normal |
| `brand-green-900` / tarjeta `rgba(255,255,255,.88)` sobre cualquier fondo | ≥ 6,92 | Permitido (R-F1) |
| `brand-neutral-700` / tarjeta `rgba(255,255,255,.88)` sobre cualquier fondo | ≥ 5,93 | Permitido (R-F1) |

**Degradado de la tarjeta de marca [Carlos: E3 = (a)].** Home, panel y landing usan `#2E7550`, que no es un token y tiene otra tonalidad que `brand-green-900` (0,413 frente a 0,451). Opciones: (a) derivado `brand-green-700` = **#297A62** (tonalidad de `brand-green-900`, L 0,32; blanco encima 5,18); (b) conservar #2E7550 como token `brand-green-hero` (blanco encima 5,56). **Decisión (E3, Carlos, 2026-10-21): (a).** El degradado queda `brand-green-900` → `brand-green-700` (#297A62); los prototipos que usan #2E7550 se corrigen al implementar. Lo que no se permite es un hexadecimal suelto en el código.

**Círculo decorativo amarillo** de la tarjeta de marca: nunca detrás de texto.

## 6. Tipografía [Carlos: dos fuentes]

| Rol | Fuente | Pesos | Uso |
|---|---|---|---|
| Display | Bricolage Grotesque (variable) | 600–800 | Títulos de página y sección, cifras grandes |
| Cuerpo | `system-ui` | 400 / 600 | Texto, formularios, botones |
| Mono | JetBrains Mono | 500 / 600 | Montos, códigos, referencias |

Los prototipos de home y panel usan la mono del sistema y no cargan Bricolage: al implementarlos se aplica esta tabla.

**Carga:**
- Autoalojadas. Nunca desde Google Fonts ni otro CDN (landing, línea de tiempo y movimiento cargan hoy desde Google Fonts: se corrige al implementar).
- Web: `woff2`, subconjunto latino (tildes, ñ, ¿, ¡), `next/font/local` o `@font-face` con `font-display: swap`. Los archivos y su licencia OFL se versionan en el repositorio.
- Flutter: assets en `pubspec.yaml`; sin el paquete `google_fonts` en tiempo de ejecución (lo revisa Adonis).
- Presupuesto: ≤ 150 KB entre las dos fuentes en la primera carga [Carlos: E6].

**Escala:** la de la propuesta v2 §3 (display 48/34/26/21/18; cuerpo 16/15/14/13; mono 15/13/12/11). Cuerpo mínimo 16 en campos (evita el zoom automático de iOS).

## 7. Forma, profundidad y movimiento

### 7.1 Radios y sombras

| Token | Valor | Origen |
|---|---|---|
| `radius-control` | 12 px | [Prototipo] campos de home, panel y landing |
| `radius-button` | 999 px | [Prototipo] botones, chips y estados en todas las pantallas |
| `radius-card` | 18 px | [Prototipo] tarjetas de home y panel [Carlos: E5] |
| `radius-surface` | 24 px | [Prototipo] paneles y hojas en las cinco pantallas [Carlos: E5] |
| `shadow-card` | `0 12px 32px rgba(27,81,65,.08)` | Propuesta v2 §4 |
| `shadow-hover` | `0 20px 42px rgba(29,92,66,.16)` | [Prototipo] landing |
| `shadow-float` | `0 24px 60px rgba(27,81,65,.14)` | Propuesta v2 §4 |

Los prototipos usan además radios sueltos (9, 10, 11, 14, 16, 22, 28 px) en iconos y piezas pequeñas. El agente los lleva al token más cercano de esta tabla; si una pieza necesita otro radio, se detiene y lo pide aquí.

### 7.2 Movimiento [Carlos: E8]

| Token | Valor | Equivalente en Flutter | Uso |
|---|---|---|---|
| `ease-out` | `cubic-bezier(.22,1,.36,1)` | `Cubic(.22,1,.36,1)` | Entradas y la mayoría de cambios (home, panel, landing, línea de tiempo) |
| `ease-spring` | `cubic-bezier(.175,.885,.32,1.275)` | `Curves.easeOutBack` | Aparición de cubos, sellos, candados |
| `ease-standard` | `cubic-bezier(.4,0,.2,1)` | `Curves.fastOutSlowIn` | Cargas en bucle (catálogo de movimiento) |
| `ease-in-out` | `cubic-bezier(.645,.045,.355,1)` | `Curves.easeInOutCubic` | Elementos que van y vuelven |
| `duration-fast` | 150 ms | — | Pulsación, cambios de color |
| `duration-normal` | 300 ms | — | Cambios de vista |
| `duration-slow` | 450 ms | — | Elementos que cambian de tamaño o entran en pantalla |

Curvas sueltas de los prototipos que se sustituyen: `.65,0,.35,1` (panel) → `ease-in-out`; `.16,1,.3,1` (landing) y `.215,.61,.355,1` (movimiento) → `ease-out`.

Reglas: `prefers-reduced-motion` siempre (cargas detenidas, transiciones instantáneas); solo se anima lo que pasó de verdad; la referencia de cada animación es `paxfide-movimiento.html`, con estos tokens.

## 8. Navegación [Carlos: configurable, por fases]

| Ancho | Corte inicial | Más adelante, si hay tiempo |
|---|---|---|
| Móvil (< 768 px) | Barra inferior fija, iconos con etiqueta | Sin cambio (alcanzable con una mano) |
| Escritorio (≥ 768 px) | **Lateral** [Carlos: E4] | El usuario elige; el prototipo de home ya tiene arriba, abajo, izquierda y derecha |

**Para que la segunda fase no obligue a rehacer nada:**
- La posición es un atributo del contenedor (`data-nav-position="side|top|bottom"`), no una variante del componente. Los estilos de cada posición viven en el mismo módulo CSS.
- El contenido no supone una posición: usa las propiedades `--nav-inset-*` que pone el contenedor.
- La preferencia, cuando exista, se guarda solo en el navegador.
- El orden de foco y `<nav aria-label>` son los mismos en todas las posiciones.

*Nota (2026-10-24, `plan-fase7-fidelidad.md` D-F8; Carlos eligió adelantar la fase 2):* en escritorio, el usuario elige arriba, abajo, izquierda o derecha. En móvil sigue abajo. La tabla de arriba no se reescribe.

## 9. Fuente de verdad [Carlos: ambas]

1. **Valores** (colores, radios, sombras, fuentes, duraciones): viven **solo** en este documento y en `sistema-visual-paxfide-web.md`. Penpot y los HTML los copian de aquí. Si un prototipo usa un valor que no está aquí, el prototipo se corrige o el valor se añade aquí primero, con su contraste calculado.
2. **Pantallas:** cada pantalla aprobada declara **una sola** referencia, Penpot o HTML. El código sigue esa referencia; la otra es informativa. Los **datos** no salen de ninguna de las dos: salen de la tabla de campos de `prompts-agentes-estilo-v2.md` §3.
3. **Conflicto:** si las dos referencias difieren y la tabla no lo resuelve, se detiene y se pregunta (regla 2.1).

| Pantalla | Referencia | Archivo o frame | Aprobada |
|---|---|---|---|
| Landing | HTML [Carlos: E9] | `paxfide-landing.html` (2026-10-20) | — |
| Home del donante | HTML [Carlos: E9] | `paxfide-home.html` (2026-10-20) | — |
| Panel de la organización | HTML [Carlos: E9] | `paxfide-panel.html` (2026-10-20) | — |
| Línea de tiempo | HTML [Carlos: E9] | `paxfide-linea-tiempo.html` (2026-10-20) | — |
| Cargas y transiciones | HTML [Carlos: E9] | `paxfide-movimiento.html` (2026-10-20) | — |

## 10. Documentos que se actualizan al aprobar esta enmienda

| Documento | Cambio |
|---|---|
| `sistema-visual-paxfide-web.md` | Nota al inicio que remite a esta enmienda; §6 "modo oscuro fuera de v1" queda sustituido |
| `diseno-ux-contractual-web-v1.md` | §2 sustituido por §2 de esta enmienda; §3.3 radios, sombras y tipografía de §6–§7; §3.4 iconos ampliados (v2 §7) |
| `Promt-maestro-front-fase2.md` y planes de la Fase 2 | La prohibición de fuentes web, sombras y radios fuera de v1 deja de regir para el trabajo de `prompts-agentes-estilo-v2.md` |
| `prompts-agentes-estilo-v2.md` | Precondiciones P-1 a P-3 según lo aprobado aquí |
| Tests de tokens de `paxfide-web` | Tokens nuevos, tema oscuro y los pares de §4.3 y §5 |
| `paxfide-mobile` `ThemeData` | Lo mismo (Adonis) |
| `sistema-visual-v2-propuesta.md` | Estado: absorbida por esta enmienda en lo aprobado |

## 11. Decisiones — Carlos, 2026-10-21

| # | Pregunta | Decisión |
|---|---|---|
| E1 | Base clara del fondo animado | (c) #DCE8D6, token `brand-ground` |
| E2 | Tokens oscuros de §4.2, tomados de los prototipos | Aprobados tal cual |
| E3 | Degradado de la tarjeta de marca | (a) `brand-green-700` #297A62 |
| E4 | Navegación de escritorio en el corte inicial | Lateral |
| E5 | Radios de tarjeta y superficie | 18 y 24 px |
| E6 | Presupuesto de las fuentes | ≤ 150 KB |
| E7 | Reglas R-F1 a R-F7 (opacidad mínima y canvas) | Aprobadas tal cual |
| E8 | Curvas y duraciones de §7.2 | Aprobadas tal cual |
| E9 | Referencias HTML de las cinco pantallas (§9) | Aprobadas tal cual |

**Aprobación del documento completo — Carlos, 2026-10-21.** Incluye lo que en la revisión 2 estaba marcado como propuesta fuera de E1–E9: §4.1 (cómo se activa el tema), §5 (pares del tema claro), §6 (carga de fuentes), §7.1 (redondeo de radios sueltos al token más cercano), §8 (estructura de la navegación) y §9 (reglas de la fuente de verdad).

## 12. Fe de erratas

| # | Fecha | Dónde | Decía | Dice | Causa |
|---|---|---|---|---|---|
| FE-1 | 2026-10-21 | §4.3, `dark-accent-yellow` / `dark-surface` | 8,00 | 8,15 | El 8,00 se calculó con la superficie oscura de la revisión 1 (#0F2E25). Con la aprobada (#132C22) y el Anexo A da 8,15. No cambia ninguna decisión: el par sigue permitido. Detectado por el agente de VS-0 (corrección 1) |

---

## Anexo A — Script de verificación de esta enmienda

Misma fórmula que el Anexo A de v1. `blend` calcula el color sólido de una capa translúcida sobre otra; el peor caso de R-F1 se comprueba sobre blanco, negro, amarillo de marca y las dos bases.

```python
def h2r(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def r2h(c): return '#%02X%02X%02X'%c
def lum(c):
    r=[]
    for v in c:
        v/=255; r.append(v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4)
    return 0.2126*r[0]+0.7152*r[1]+0.0722*r[2]
def cr(a,b):
    la,lb=sorted([lum(h2r(a)),lum(h2r(b))],reverse=True); return (la+0.05)/(lb+0.05)
def blend(fg,alpha,bg):
    f,b=h2r(fg),h2r(bg); return r2h(tuple(round(f[i]*alpha+b[i]*(1-alpha)) for i in range(3)))

S='#132C22'  # dark-surface
dark={'bg':'#0E1B16','surface':S,'raised':'#192F26','field':'#0F261D',
      'text':'#EEF6EF','text2':blend('#EEF6EF',.76,S),'border':'#76847D','action':'#20604C',
      'link':'#8CC3DE','focus':'#8CD39A',
      'amb-bg':blend('#F3B544',.14,S),'info-bg':blend('#3688B0',.16,S),
      'ok-bg':blend('#6DBF7A',.16,S),'err-bg':blend('#B42318',.20,S)}
assert round(cr(dark['text2'],S),2)==8.42 and round(cr('#FFFFFF',dark['action']),2)==7.40

# Peor caso de R-F1
for under in ['#FFFFFF','#000000','#F3B544','#07130E','#DCE8D6']:
    assert cr('#EEF6EF', blend('#10261D',.86,under)) >= 4.5   # rgba(16,38,29,.86)
    assert cr('#405656', blend('#FFFFFF',.88,under)) >= 4.5   # rgba(255,255,255,.88)
```
