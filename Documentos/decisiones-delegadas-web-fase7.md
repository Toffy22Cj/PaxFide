# Decisiones delegadas — `paxfide-web`, Fase 7 (estilo visual v2), tarea VS-0

**Origen:** instrucción de Carlos del 2026-10-21 en la sesión de VS-0: "te doy permisos para decidir por mí en base a lo que hay en el código; el backend no lo puedes tocar, solo leer". Es una **excepción temporal a las reglas 2.1 y 3.4** de `reglas-equipo-y-agentes.md` (como la de `decisiones-delegadas-web-2026-10.md`), válida para esta tarea.
**Qué es este documento:** el registro de **cada** decisión que el agente tomó por Carlos en VS-0, más el `implementation_plan` que la tarea pide como primer entregable. Estado de las filas: DF7-04, 08, 09, 10, 11, 12 y 16 **RATIFICADAS por Carlos (2026-10-21)**; DF7-13, 14 y 15 son decisiones de Carlos; DF7-01, 02, 03, 05, 06 y 07, sustituidas por la enmienda 1. Si una fila contradice un documento aprobado, manda el documento aprobado y la fila es un error a corregir.
**Repositorios:** solo `Toffy22Cj/PaxFide`. `Toffy22Cj/Donaciones` no se ha tocado (VS-0 no necesita nada del backend).
**Corrección 1 (2026-10-21):** Carlos aportó la enmienda (APROBADA, con FE-1); sus valores sustituyen a los reconstruidos (filas DF7-01, 02, 03, 05, 06 y 07) y DF7-12 a DF7-16 recogen lo que la corrección añadió.
**Rama:** `claude/paxfide-v2-fase7-prompts-kq6k53` (la rama asignada a la sesión; el bloque VS-0 sugería `feat/web-tokens-v2`).

---

## 0. Bloqueo encontrado y cómo se resolvió (DF7-01)

El contexto maestro de §4 de `prompts-agentes-estilo-v2.md` dice: *"Comprueba en develop que `sistema-visual-paxfide-web-enmienda-1.md` dice APROBADA y que `prompts-agentes-estilo-v2.md` existe. Si no, DETENTE."*

Comprobado el 2026-10-21 en `origin/develop` (`41272c4`) y en **todas** las ramas remotas de los dos repositorios (`git log --all`):

| Documento | Estado |
|---|---|
| `sistema-visual-paxfide-web-enmienda-1.md` | **No existe** en ninguna rama de PaxFide ni de Donaciones |
| `prompts-agentes-estilo-v2.md` | **No existía**; Carlos lo pegó en la sesión. Se añade en esta rama tal cual |
| `sistema-visual-v2-propuesta.md` (citado por VS-1) | **No existe** |

El documento de prompts dice que la enmienda está APROBADA (P-1, Carlos, 2026-10-21), pero su texto no está en el repositorio, así que **ninguno de sus valores (§4.2, §4.3, §5, §7.2, E1, E3, E6) se puede leer**. Con la delegación de Carlos, el agente **no se detiene**: reconstruye los valores desde lo que sí existe —`sistema-visual-paxfide-web.md` (v1, APROBADO), su Anexo A y los prototipos HTML de 2026-10-20 como referencia— y deja cada valor registrado aquí, con sus contrastes calculados. **Cuando la enmienda se suba a `develop`, sus valores sustituyen a los de este documento** y los tests de `__tests__/design-tokens.test.ts` se ajustan a ella (los valores están en un solo sitio: la tabla `tokens` del test y `src/app/globals.css`).

---

## 1. `implementation_plan` de VS-0 (aprobado por delegación, DF7-01)

| Pieza | Archivo | Qué |
|---|---|---|
| Tokens nuevos | `src/app/globals.css` (archivo global de tokens) | `brand-green-700`, `brand-ground`, 15 `dark-*`, `radius-card`, `radius-button`, sombras `card/hover/float` claras y oscuras, 3 duraciones y 4 curvas, `--font-body` |
| Capa semántica | `src/app/globals.css` | 29 nombres `--color-*` y `--shadow-*` en claro (`:root`), oscuro por sistema (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`) y oscuro forzado (`:root[data-theme="dark"]`) |
| Fuentes | `src/app/fonts/*.woff2`, `OFL-*.txt`, `README.md`; `src/app/fonts.ts`; `src/app/layout.tsx` | Bricolage Grotesque y JetBrains Mono autoalojadas con `next/font/local`, `font-display: swap`, subconjunto latino, variables `--font-display` y `--font-mono` en `<html>` |
| Tema | `src/lib/theme/theme.ts` (lógica pura), `src/components/theme/ThemeSelect.tsx` (componente sin estilo), script en `<head>` de `layout.tsx` | Preferencia claro / oscuro / sistema con `try/catch` |
| Tests unitarios | `__tests__/design-tokens.test.ts` (ampliado), `__tests__/theme.test.ts`, `__tests__/theme-select.test.tsx` | Pares de contraste con `toBeCloseTo(v, 2)` (Anexo A), peor caso R-F1, negativas, capa semántica completa y resuelta, hexadecimales y `dark-*` fuera del archivo de tokens, sin Google Fonts, tema |
| Tests E2E | `e2e/theme.spec.ts` | Tema con `prefers-color-scheme` y `data-theme` en el build de producción, preferencia aplicada antes de hidratar, presupuesto de fuentes medido en el build, ninguna petición externa |
| Capturas | `capturas/vs0-tema.spec.ts` → `Documentos/evidencia-web/capturas/vs0-login__{claro,oscuro}__{390,1280}.png` | Pantalla existente en claro y en oscuro (no cambia, DF7-09) |

**Datos del backend:** ninguno (VS-0 no lee endpoints).
**Lo que de los prototipos NO se implementa en VS-0 y por qué:** animaciones y transiciones (VS-1), barra y navegación (VS-2), ciudad animada (VS-3), el selector de tema montado en pantalla (VS-2, DF7-10), `--slow` / "cámara lenta" de `paxfide-movimiento.html` (herramienta de estudio, no de producto), Google Fonts (prohibido), `localStorage` de la posición de la barra (prohibido en este corte), las paletas propias de `paxfide-landing.html` (`--pax-emerald`, `--pax-gold`, …) y de la línea de tiempo (`--tl-*`), que no coinciden con la marca de v1.

---

## 2. Registro de decisiones

| # | Tema | Pregunta | Decisión | Motivo | Estado |
|---|---|---|---|---|---|
| DF7-01 | Precondición | Falta la enmienda en `develop` (§0) | Seguir con valores reconstruidos y registrados aquí; sustituirlos por los de la enmienda cuando se suba | Delegación de Carlos; detenerse dejaba VS-0 sin hacer | SUSTITUIDA por la enmienda 1 (encabezado: APROBADA, Carlos, 2026-10-21); la enmienda está en `develop` desde la corrección 1 |
| DF7-02 | E1, E3 | ¿Qué valen `brand-ground` y el color del degradado? | `brand-ground` = `#EEF4EA` (el `--ground` de `paxfide-landing.html`). `brand-green-700` = `#46824C`: el primer tono de `brand-green-500` que alcanza 4,5:1 con blanco (`darken_to('#4E9155', 4.5)` del Anexo A, 4,61:1), para que el texto blanco sea legible en todo el degradado `green-900 → green-700` | Mismo método que los derivados de v1 §2.2 | SUSTITUIDA por la enmienda 1 (§3.2, E1: `brand-ground` #DCE8D6; §5, E3: `brand-green-700` #297A62) |
| DF7-03 | §4.2, §4.3, §5 | Paleta oscura y sus pares | Tabla de §3. Base de `paxfide-home.html` / `paxfide-movimiento.html` (`#07130E`, `#0D1F18`, `#132C22`, `#0F261D`); el resto derivado con el Anexo A: `dark-surface-raised` = `with_l(#132C22, 0.17)`; `dark-text-secondary` = `#EEF6EF` al 76 % sobre `dark-surface-raised` (el `--muted` del prototipo, pero **sólido**, para poder calcular); `dark-blue-300` = `lighten_to(brand-blue-500, 7, raised)`; `dark-green-300` = `lighten_to(brand-green-500, 4.5, raised)`; fondos de estado = `with_l(color, 0.12–0.13)`; `dark-danger-300` = `lighten_to(danger-700, 6, dark-danger-950)`. Acción en oscuro: `brand-green-800` con texto blanco (7,40:1, como el `.btn-p` oscuro del prototipo) | Solo valores calculables; ninguno "a ojo" (v1 §5.5) | SUSTITUIDA por la enmienda 1 (§4.2–§4.4, E2; con FE-1) |
| DF7-04 | Fuentes | ¿De dónde salen los woff2 (P-7)? | De los **repositorios oficiales** de cada fuente en GitHub (`ateliertriay/bricolage`, `JetBrains/JetBrainsMono`), por commit fijado y con sha256 del original; nunca de Google Fonts ni de un CDN. Subconjunto latino y ejes recortados con `fonttools` fuera del repo. Detalle reproducible en `src/app/fonts/README.md` | P-7 lo permite ("un agente con red al sitio oficial de cada fuente"). Ninguna de las dos licencias OFL declara Reserved Font Name, así que el subconjunto conserva el nombre | **RATIFICADA — Carlos, 2026-10-21** |
| DF7-05 | E6 | Presupuesto de fuentes y preload | **80 KiB** (81 920 bytes) para las dos familias juntas en la primera carga, medido en el build de producción (`e2e/theme.spec.ts`). Hoy: 75 948 bytes (Bricolage 61 668 + JetBrains Mono 14 280). **Sin preload** mientras ninguna pantalla use las fuentes (evita descargar 74 KB sin usar y el aviso de Chrome); la primera tarea que las ponga en pantalla decide el preload de la de titulares | Sin el valor de E6, se fija un tope que obliga a subconjunto y ejes recortados | SUSTITUIDA por la enmienda 1 (§6, E6: ≤ 150 KB, 150 000 bytes en el test). La parte del preload, que la enmienda no decide, sigue en DF7-12 |
| DF7-06 | Radios | `radius-surface` ya existe (8 px) y lo usan 8 reglas de pantallas existentes | Se **conserva** en 8 px; se añaden `radius-card` 20 px y `radius-button` 999 px (los de las tarjetas y botones de los prototipos). Si la enmienda le da otro valor, cambia en VS-8 | VS-0 no cambia pantallas existentes | SUSTITUIDA por la enmienda §7.1; opción (a), Carlos, 2026-10-21 |
| DF7-07 | §7.2 | Duraciones y curvas | `--duration-fast` 150 ms, `--duration-normal` 300 ms, `--duration-slow` 450 ms; `--ease-standard` `cubic-bezier(0.4, 0, 0.2, 1)`, `--ease-out` `(0.215, 0.61, 0.355, 1)`, `--ease-in-out` `(0.645, 0.045, 0.355, 1)`, `--ease-back` `(0.175, 0.885, 0.32, 1.275)`: los siete tokens de `paxfide-movimiento.html`. Poner las duraciones a 0 con `prefers-reduced-motion` queda para VS-1 (animaciones fuera de VS-0) | Son los únicos tokens de movimiento publicados | SUSTITUIDA por la enmienda 1 (§7.2, E8: `ease-out` (.22,1,.36,1); `ease-back` pasa a `ease-spring`) |
| DF7-08 | Capa semántica | Nombres | Los de VS-0 más `--color-ground`, `--color-surface-translucent` (opacidad mínima de R-F1: 88 % claro, 86 % oscuro, con `color-mix`), `--color-gradient-from/to`, y por estado `success-bg/text/icon`, `danger-bg/text`, `ambiguous-bg/text/title`, `info-bg/text`; `--shadow-card/hover/float` cambian con el tema | Cubrir la tabla de estados de v1 §4 en los dos temas | **RATIFICADA — Carlos, 2026-10-21** |
| DF7-09 | Pantallas existentes | Usan los tokens de marca directamente (`--brand-green-900` como texto, `--white` como fondo). Si `body` o `color-scheme` pasaran a oscuro, quedaría texto verde oscuro sobre fondo oscuro | En VS-0 **no se cambia** `body`, `a` ni `color-scheme`: con el sistema en oscuro las pantallas existentes se ven igual que hoy (test E2E y capturas `vs0-login__oscuro__*`). El oscuro se ve en cada pantalla cuando pase a la capa semántica (VS-4 a VS-8) | "Fuera: cambiar pantallas existentes (solo deben seguir funcionando)" | **RATIFICADA — Carlos, 2026-10-21** |
| DF7-10 | Selector de tema | ¿Dónde se monta y cómo se evita el parpadeo? | Utilidad pura + `ThemeSelect` (un `<select>` con etiqueta, sin estilo) **sin montar**: su sitio es la estructura de VS-2. La preferencia se guarda en `localStorage` (`paxfide.theme`, no es un secreto) con `try/catch`; un script de una línea en `<head>` la aplica antes de pintar (`suppressHydrationWarning` en `<html>`). `system` borra la clave | Montarlo ahora no cambia nada visible (DF7-09) y tocaría el Shell (navegación, fuera de VS-0) | **RATIFICADA — Carlos, 2026-10-21** |
| DF7-11 | Hexadecimales | El test existente solo miraba CSS | Ampliado a `.ts`/`.tsx`: solo `globals.css` declara hexadecimales. Dos excepciones anteriores a v2, listadas en el test con su motivo y sin ampliar: `QrCode.tsx` (colores fijos para que el QR se lea en cualquier tema) y el borde blanco de `PredictionCharts.tsx` (VS-8). Además: ningún archivo fuera de `globals.css` nombra un `--dark-*`, y ninguno carga Google Fonts | El test es la única defensa contra colores "a ojo" | **RATIFICADA — Carlos, 2026-10-21** |
| DF7-12 | Fuentes | Preload (la parte de DF7-05 que la enmienda no decide) | Sin preload mientras ninguna pantalla use `--font-display` o `--font-mono`; la primera tarea que las ponga en pantalla decide el preload de la de titulares. Probado: la primera carga de `/login` no descarga fuentes | La enmienda §6 fija el presupuesto, no la precarga | **RATIFICADA — Carlos, 2026-10-21** |
| DF7-13 | Sombras oscuras | La enmienda §4.2 da un rango (`.30` a `.45`) | `shadow-card-dark` `0 12px 32px rgba(0,0,0,.30)`, `shadow-hover-dark` `0 20px 42px rgba(0,0,0,.40)`, `shadow-float-dark` `0 24px 60px rgba(0,0,0,.45)`: mismos desplazamientos que en claro (§7.1) | Respuesta a la corrección 1 | **Carlos, 2026-10-21** |
| DF7-14 | Escala tipográfica | ¿Entra en VS-0? | Sí, solo como tokens (`--font-size-display-1..5` 48/34/26/21/18, `--font-size-body-1..4` 16/15/14/13, `--font-size-mono-1..4` 15/13/12/11), sin aplicarla a ninguna pantalla. `--text-sm/md/lg/xl` de v1 se quedan igual para las pantallas existentes hasta VS-8; las nuevas usan solo la escala nueva. Test: ningún campo de formulario por debajo de 16 px (§6) | Respuesta a la corrección 1 | **Carlos, 2026-10-21** |
| DF7-15 | Capa semántica | Variables sin valor propio en la enmienda | `--color-success-icon` = texto de éxito (`brand-green-900` en claro, `dark-success-text` en oscuro); `--color-ambiguous-title` = `brand-yellow-900` en claro (par de v1 §3) y `dark-ambiguous-text` en oscuro. `--color-surface-translucent` = `rgba(255, 255, 255, 0.88)` / `rgba(16, 38, 29, 0.86)` literales de R-F1, sin token para #10261D | Lista de la corrección 1 aprobada | **Carlos, 2026-10-21** |
| DF7-16 | Foco en claro | El par `color-focus` / `color-action` da 1,00 en claro (los dos son `brand-green-900`, v1 §3) | Sin cambio en claro: el contorno va separado 2 px (enmienda §1.5) y se ve sobre el fondo, no sobre el botón. El par 4,19 de §4.3 se prueba solo en oscuro | La enmienda solo trae ese par para oscuro; cambiar el foco claro de v1 no es de VS-0 | **RATIFICADA — Carlos, 2026-10-21** |

---

## 3. Tabla de pares v2 de la reconstrucción (HISTORIAL: sustituida por la enmienda 1 §4.3 y §5)

> Desde la corrección 1 (2026-10-21) los valores válidos son los de `sistema-visual-paxfide-web-enmienda-1.md` §4.2–§5 (con FE-1). Esta sección se conserva solo como registro de lo que se reconstruyó; ningún valor de aquí está en el código.

Calculados con el Anexo A de `sistema-visual-paxfide-web.md`; los mismos valores están en `__tests__/design-tokens.test.ts` con `toBeCloseTo(v, 2)`. Umbrales WCAG 2.2: texto 4,5:1; componentes de interfaz y foco 3:1.

### 3.1 Tokens nuevos

| Token | Valor | Origen |
|---|---|---|
| `brand-green-700` | `#46824C` | `darken_to(brand-green-500, 4.5)` |
| `brand-ground` | `#EEF4EA` | Prototipo de landing (E1) |
| `dark-ground` | `#07130E` | Prototipo de home (fondo de la ciudad) |
| `dark-bg` | `#0D1F18` | Prototipo de movimiento |
| `dark-surface` | `#132C22` | Prototipos (tarjeta sólida) |
| `dark-surface-raised` | `#1A3D2F` | `with_l(dark-surface, 0.17)` |
| `dark-field` | `#0F261D` | Prototipo de home (campo) |
| `dark-text-secondary` | `#BBCAC1` | `brand-green-50` al 76 % sobre `dark-surface-raised` |
| `dark-border-control` | `#739797` | Mismo valor que `neutral-400`; nombre propio porque en oscuro **no** es texto |
| `dark-divider` | `#2B502F` | `with_l(brand-green-500, 0.24)`, decorativo |
| `dark-green-300` | `#69AE70` | `lighten_to(brand-green-500, 4.5, dark-surface-raised)` |
| `dark-blue-300` | `#A2CDE2` | `lighten_to(brand-blue-500, 7, dark-surface-raised)` |
| `dark-green-950` | `#172B19` | `with_l(brand-green-500, 0.13)` |
| `dark-blue-950` | `#102733` | `with_l(brand-blue-500, 0.13)` |
| `dark-yellow-950` | `#3A2604` | `with_l(brand-yellow-400, 0.12)` |
| `dark-danger-950` | `#360B07` | `with_l(danger-700, 0.12)` |
| `dark-danger-300` | `#EB766D` | `lighten_to(danger-700, 6, dark-danger-950)` |

### 3.2 Pares permitidos

| Texto / elemento | Fondo | Contraste | Uso |
|---|---|---|---|
| `white` | `brand-green-700` | 4,61 | Texto sobre el extremo claro del degradado |
| `brand-green-900` | `brand-ground` | 8,16 | Texto sobre el suelo de marca |
| `brand-neutral-700` | `brand-ground` | 6,99 | Secundario sobre el suelo |
| `brand-blue-800` | `brand-ground` | 6,35 | Enlace sobre el suelo |
| `brand-green-900` / `brand-neutral-700` / `brand-blue-800` | R-F1 claro, peor caso (`white` al 88 % sobre negro = `#E0E0E0`) | 6,92 / 5,93 / 5,38 | Texto en superficie translúcida sobre la ciudad |
| `brand-green-50` | `dark-ground` / `dark-bg` / `dark-surface` / `dark-surface-raised` / `dark-field` | 17,20 / 15,55 / 13,51 / 10,88 / 14,49 | Texto principal en oscuro |
| `dark-text-secondary` | `dark-bg` / `dark-surface` / `dark-surface-raised` / `dark-field` | 10,06 / 8,74 / 7,04 / 9,38 | Secundario en oscuro |
| `dark-blue-300` | `dark-bg` / `dark-surface` / `dark-surface-raised` | 10,08 / 8,76 / 7,06 | Enlaces en oscuro (cualquier tamaño) |
| `white` | `brand-green-800` | 7,40 | Botón primario en oscuro |
| `dark-green-300` | `dark-bg` / `dark-surface` / `dark-surface-raised` / `dark-field` | 6,43 / 5,59 / 4,50 / 6,00 | Foco e iconos de éxito en oscuro (≥ 3:1) |
| `dark-border-control` | `dark-bg` / `dark-surface` / `dark-surface-raised` / `dark-field` | 5,38 / 4,68 / 3,77 / 5,02 | Borde de campos y controles (≥ 3:1) |
| `brand-green-50` / `dark-green-300` | `dark-green-950` | 13,66 / 5,65 | Éxito en oscuro |
| `brand-green-50` / `dark-danger-300` | `dark-danger-950` | 15,78 / 6,08 | Rechazo en oscuro |
| `dark-danger-300` | `dark-surface` | 5,21 | Error de formulario en oscuro |
| `brand-green-50` / `brand-yellow-400` (título) | `dark-yellow-950` | 13,07 / 7,89 | **Ambiguo** en oscuro: amarillo, nunca rojo |
| `brand-green-50` / `dark-blue-300` | `dark-blue-950` | 14,02 / 9,09 | Informativo en oscuro |
| `brand-green-50` / `dark-text-secondary` / `dark-blue-300` | R-F1 oscuro, peor caso (`dark-surface` al 86 % sobre blanco = `#344A41`) | 8,66 / 5,60 / 5,62 | Texto en superficie translúcida sobre la ciudad |

### 3.3 Prohibiciones (aserciones negativas en el test)

| Combinación | Contraste | Regla |
|---|---|---|
| `white` sobre `brand-green-500` | 3,81 | Nunca texto blanco sobre green-500; la acción oscura es `brand-green-800` |
| `dark-border-control` como texto | 3,77 sobre `dark-surface-raised` | Solo bordes; nunca texto |
| `dark-divider` | 1,62 sobre `dark-surface` | Solo decorativo; nunca borde informativo |
| `brand-yellow-400` como foco | 1,83 sobre blanco | El foco nunca es amarillo (en claro: `brand-green-900`; en oscuro: `dark-green-300`) |
| `brand-blue-700` sobre `neutral-50` | 4,37 | Heredada de v1 (W-7) |
