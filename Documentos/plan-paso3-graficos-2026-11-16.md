# Plan del paso 3 — gráficos simples y avanzados (encargo del 2026-11-15, Tarea B)

**Estado:** APROBADO por Manuel el 2026-11-16, con sus ajustes (abajo). Redactado por Manuel con asistencia de Claude.
**Base:** `develop` de la web `0f4c2e7`. Rama `claude/focused-dirac-8besqk`, PR hacia `develop`. El backend no cambia.

## Decisiones de Manuel

1. **A mano, sin librerías** (2026-11-15): SVG en la web y `CustomPaint` en el móvil. Sin enmienda de ADR-046 D8 ni de ADR-043 A2/D12.
2. **Cuatro paneles:** predicción, fondos mensuales, estado de lotes y actividad. Un gráfico simple y uno avanzado visibles a la vez en cada panel.
3. **Quién cambia el tipo («cada rol en lo que ya ve»):** en fondos, lotes y actividad, `ADMINISTRATOR` y `EMPLOYEE`; en predicción, `ADMINISTRATOR` y `REPRESENTATIVE`. El resto ve los predeterminados, sin selector. El selector es presentación: el backend sigue autorizando cada lectura.
4. **La elección se guarda en el navegador**, por cuenta y panel, con el identificador opaco de la cuenta (`accountId` de `/me`), **nunca el correo**.
5. **Los tres gráficos de predicción que ya existían** (`BasicPredictionChart`, `AdvancedPredictionChart`, `PredictionHistoryChart`) se migran sin cambiar lo que muestran, y sus tests (`__tests__/prediction.test.tsx`) no se tocan.
6. **El agente elige el predeterminado** de cada panel.
7. **Fuera de este corte:** el abanico de incertidumbre (el backend no devuelve intervalos: dibujarlo sería inventar) y las barras apiladas por moneda (sumar pesos y dólares no es un dato real). Sankey, embudo, dispersión y mapa de calor, también fuera: abajo, qué endpoint haría falta.
8. **Orden:** primero la web. El móvil (predicción con `/prediction/history` y estado de lotes) espera a que se fusione `Toffy22Cj/PaxFide_Mv#16`. Fondos y actividad en el móvil necesitan la Enmienda 6 de ADR-043 (borrador aparte, sin código).

## Qué se construye en la web

**Componente base** (`src/components/charts/`): marco común (figura, leyenda, `role="img"` con las cifras en `aria-label`, tabla equivalente «Ver los datos en tabla»), ejes, patrones y estado vacío. Cada tipo de gráfico es una pieza encima del marco. Solo colores de la capa semántica (claro y oscuro); con más series que colores cambia el patrón, y las líneas cambian la forma del marcador: nunca solo el color distingue dos series. Un valor ausente (`null`) se deja vacío: ni se interpola ni se rellena, y una línea se corta en el hueco.

| Panel | Pantalla | Datos | Simple (el primero es el predeterminado) | Avanzado (el primero es el predeterminado) |
|---|---|---|---|---|
| Predicción | `/panel/prediction` | `/prediction`, `/prediction/history` | **Probabilidad y final estimado** (el de siempre), barras horizontales, barras verticales | **Hoy frente al final estimado** (el de siempre), recaudado y final estimado por corte (barras + línea), probabilidad por corte (línea) |
| Fondos | `/panel/funds` | `/funds/monthly?months=12`, `/funds` | **Barras verticales**, barras horizontales, líneas, área, cifras clave | **Barras por mes y línea acumulada**, estado del dinero por moneda (apiladas al 100 %, una barra por moneda), un gráfico por moneda |
| Lotes | `/panel/assets` | `/physical-assets` | **Barras verticales** por estado, barras horizontales, dona, progreso de entrega, cifras clave | **Estados por tipo de lote** (apiladas), tipos de lote por estado (apiladas) |
| Actividad | Inicio del panel | `/activity` (hasta 100 eventos) | **Barras horizontales** por tipo, barras verticales, dona, cifras clave | **Eventos por día** (o por semana si abarcan más de 31 días), eventos por día y tipo (apiladas) |

Límites que el propio gráfico dice: la actividad cubre los eventos cargados (como mucho 100, y lo avisa si hay más); el acumulado de fondos suma solo los meses mostrados; los lotes se cuentan (sus cantidades tienen unidades distintas y no se suman); con dos monedas se elige la moneda, nunca se suman.

**Migración de la predicción:** los dos gráficos de siempre pasan a ser las opciones predeterminadas del panel común (selector, preferencia, convenciones) y toman la paleta común (`SERIES_COLORS`, los mismos valores `var(--color-text)` y `var(--color-link)`). Su SVG interno **no** se reescribe sobre los ejes del componente base: así no cambia nada de lo que muestran. `PredictionHistoryChart` sigue en su sección, sin cambios.

## Fuera de este corte: qué endpoint haría falta

| Gráfico | Qué falta en el backend |
|---|---|
| Abanico de incertidumbre (predicción) | Intervalos o cuantiles del final estimado en `/prediction` (por ejemplo, `estimatedFinalPctOfTarget` p10/p50/p90). El modelo actual (regresión logística y `HistGradientBoosting` para el final) no los da: hace falta un modelo de cuantiles o un cálculo de incertidumbre, y eso es un cambio del modelo entrenado (ADR-044) |
| Embudo intención → confirmada → asignada → entregada | Un conteo por estado de las intenciones de la organización (`PENDING`, `CONFIRMED`, `FAILED`, `FUNDING_REJECTED`) y su relación con asignaciones y entregas. Hoy ningún endpoint de organización da las intenciones agregadas |
| Sankey fondos → asignaciones → activos | Las aristas fondo→asignación→activo con importes (`allocationId` del activo). `/funds` da las asignaciones, pero `/physical-assets` no dice de qué asignación sale cada lote |
| Dispersión o burbujas | Por convocatoria, pares de valores comparables (por ejemplo, % del tiempo y % recaudado). Hoy solo el `ADMINISTRATOR` tiene el listado con importes; haría falta para los demás roles (la Enmienda 6 de ADR-037 lo propone para el `REPRESENTATIVE`) y un campo con el % de tiempo |
| Mapa de calor (día × hora o zona × semana) | La actividad completa, no las páginas de 20: un agregado por periodo y tipo (`/activity/summary`), o por zona |

## Tests

1. Cada tipo con datos de ejemplo (respuestas reales del escenario `demo-historico` del backend, paso 2) y vacío; `aria-label` y tabla con las mismas cifras.
2. Selector solo para los roles aprobados, con aserciones negativas; sin permiso, siempre los predeterminados aunque haya una elección guardada.
3. La elección se conserva al recargar; la clave lleva el `accountId`; un almacenamiento roto no rompe la pantalla.
4. En predicción, la etiqueta de estimación sigue visible con cualquier tipo elegido.
5. Los tests de predicción existentes, sin tocar. Los de `/panel/funds` (`p2c.test.tsx`) inyectan el cliente de fondos por mes: cuentan las llamadas a `fetch` de los comandos y la nueva lectura añadía una.
6. Mutaciones: el selector para cualquier rol, la elección sin permiso, la línea que cruza huecos y la clave sin cuenta hacen fallar algún test.
7. `scripts/ci-local.sh` completo, con su salida literal.
