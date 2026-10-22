# Plan de Implementación v2 — TAREA VS-1: Tokens de movimiento y animaciones de carga

**Fecha:** 2026-10-22  
**Rama:** `feat/web-motion` (desde `develop`, con PR #29 mergeado)  
**Documentos que rigen:**
- `Documentos/sistema-visual-paxfide-web-enmienda-1.md` §7 (en particular §7.2 Movimiento [Carlos: E8]) y §4 (tokens semánticos).
- `Documentos/prompts-agentes-estilo-v2.md` §2 (regla de los prototipos), §3 (tabla de campos) y §6 (especificación VS-1).
- `Documentos/decisiones-delegadas-web-fase7.md` (DF7-07, DF7-08, DF7-11).
- Decisiones de Carlos sobre este plan (2026-10-22).
- Prototipo de referencia visual: `/home/carlos/Proyectos/pruebas/paxfide-movimiento.html` (composición, SVG y secuencias; sin tomar colores hex, curvas fuera de token ni duraciones arbitrarias).

---

## 1. Archivos que se crearán o modificarán

### Archivos nuevos
1. `src/components/loaders/BrandDots.tsx`: Componente 06 — Puntos de marca desfasados (sustituye cualquier spinner en botones).
2. `src/components/loaders/Skeleton.tsx`: Componente 07 — Esqueleto con shimmer para listas y tarjetas.
3. `src/components/loaders/TopProgressBar.tsx`: Componente 08 — Barra superior indeterminada (componente puro, sin conectar a eventos de ruta de Next.js).
4. `src/components/loaders/TruckLoader.tsx`: Componente 03 — Camión en ruta (componente puramente visual, sin lógica de dominio).
5. `src/components/loaders/MerkleTreeLoader.tsx`: Componente 09 — Árbol de Merkle (hojas, ramas y raíz dorada secuenciales).
6. `src/components/loaders/ChainCubesLoader.tsx`: Componente 01 — Cubos encadenados que saltan secuencialmente.
7. `src/components/loaders/Loaders.module.css`: Estilos de los 6 loaders, usando exclusivamente tokens semánticos, de marca, neutros y de movimiento. Incluye la versión detenida con `@media (prefers-reduced-motion: reduce)` acotada a esta hoja de estilos.
8. `src/components/loaders/index.ts`: Punto de exportación de los componentes de carga.
9. `__tests__/loaders.test.tsx`: Tests unitarios, de accesibilidad y estructurales de reduced-motion con Vitest (roles, aria-label, aria-busy, SVG con aria-hidden si está anidado, botón deshabilitado con texto visible, verificación de que toda clase con animation está pausada bajo reduced-motion).
10. `e2e/motion.spec.ts`: Test E2E de Playwright con `page.emulateMedia({ reducedMotion: 'reduce' })` sobre el botón de `/login` en estado "Enviando", verificando que la animación está detenida, con aserción negativa sin reduce.
11. `Documentos/plan-vs1-movimiento.md`: Este documento de plan en el repositorio.

### Archivos modificados
12. `src/components/ui/Button.tsx`:
    - Integra `<BrandDots aria-hidden="true" />` cuando `sending === true`. Conserva `disabled={disabled || sending}`, `aria-busy={sending || undefined}` y el texto visible del botón (`{children}`).
13. `__tests__/design-tokens.test.ts`:
    - Ampliación para verificar que `Loaders.module.css` (y módulos CSS nuevos) no contiene valores en ms o s sueltos (solo dentro de `var(--duration-*)` o `calc(... var(--duration-*))`).
14. `scripts/fake-backend.js` (si se requiere para el test E2E):
    - Soporte para retraso configurable en `/auth/login` activado exclusivamente por el test (por ejemplo mediante cabecera `x-test-delay-ms`).

### Archivos expresamente EXCLUIDOS de modificación (decisión de Carlos 2026-10-22)
- **`src/components/States.tsx` (`LoadingState`)**: **NO se modifica**. Cambiarlo afectaría a las pantallas existentes antes de su respectiva pasada de estilo (VS-4 a VS-8).
- **`src/app/globals.css`**: **NO se modifica**. No se añade ninguna regla global; la reducción de movimiento para los loaders vive exclusivamente en `Loaders.module.css`.

---

## 2. Componentes y especificación técnica

Cada componente se escribe en TypeScript estricto, sin dependencias externas, con lógica pura desacoplada, comentarios `// Ref: ...`, y soporte para modo claro y oscuro a través de tokens.

### Accesibilidad (regla 8):
- **Un solo anuncio por carga:**
  - Si el loader se renderiza dentro de un elemento que ya anuncia estado (como `Button` con `aria-busy="true"` o un contenedor con `role="status"`), el SVG o elemento animado lleva `aria-hidden="true"`.
  - Si el loader se renderiza de forma independiente, expone su propio `role="status"` o `role="img"` con `aria-label` descriptivo.
- En `Button.tsx`, al pasar a `sending={true}`: el botón queda deshabilitado (`disabled`), expone `aria-busy="true"`, el texto visible `{children}` **no desaparece** y se acompaña de `<BrandDots aria-hidden="true" />`.

---

## 3. Mapeo de Colores a Tokens (decisión de Carlos 2026-10-22)

Queda estrictamente prohibido el uso de colores hexadecimales, tokens `--dark-*` directos o tokens inventados. Todos los colores se mapean a tokens aprobados:

| Componente | Elemento visual | Token a utilizar | Valor en globals.css |
|---|---|---|---|
| **01 Cubos** | Cubo azul: cara superior | `var(--brand-blue-500)` | `#3688B0` |
| | Cubo azul: cara izquierda | `var(--brand-blue-800)` | `#255E79` |
| | Cubo azul: cara derecha | `var(--brand-blue-700)` | `#327DA2` |
| | Cubo verde: cara superior | `var(--brand-green-500)` | `#4E9155` |
| | Cubo verde: cara izquierda | `var(--brand-green-900)` | `#1B5141` |
| | Cubo verde: cara derecha | `var(--brand-green-800)` | `#20604C` |
| | Enlaces entre cubos | `var(--brand-blue-500)` | `#3688B0` |
| **03 Camión** | Carrocería | `var(--brand-yellow-400)` | `#F3B544` |
| | Franja decorativa | `var(--brand-yellow-900)` | `#785008` |
| | Cabina | `var(--brand-green-800)` | `#20604C` |
| | Ventana | `var(--brand-blue-50)` | `#EBF5F9` |
| | Chasis y ruedas | `var(--brand-green-900)` | `#1B5141` |
| | Tapacubos | `var(--neutral-200)` | `#E2E9E9` |
| | Carretera discontinua | `var(--neutral-400)` | `#739797` |
| **06 Puntos de marca** | Punto 1 (sobre botón primario) | `var(--brand-green-50)` | `#EEF6EF` |
| | Punto 2 (sobre botón primario) | `var(--brand-blue-50)` | `#EBF5F9` |
| | Punto 3 (sobre botón primario) | `var(--brand-yellow-400)` | `#F3B544` |
| **07 Esqueleto** | Fondo base y degradado shimmer | `var(--color-divider)` y `var(--color-bg)` | Semánticos (funcionan en claro y oscuro) |
| **08 Barra superior** | Pista de fondo | `var(--color-divider)` | Semántico |
| | Barra degradada | `linear-gradient(90deg, var(--brand-green-500), var(--brand-blue-500), var(--brand-yellow-400))` | Tokens de marca |
| **09 Árbol de Merkle** | Hojas y aristas conectoras | `var(--brand-blue-700)` | `#327DA2` |
| | Ramas intermedias | `var(--brand-blue-800)` | `#255E79` |
| | Raíz | `var(--brand-yellow-400)` | `#F3B544` |

---

## 4. Duraciones y Curvas de Movimiento (decisión de Carlos 2026-10-22)

Enmienda §7.2: duraciones base `--duration-fast` (150 ms), `--duration-normal` (300 ms), `--duration-slow` (450 ms).  
Curvas base: `--ease-standard`, `--ease-out`, `--ease-in-out`, `--ease-spring`.  
**Regla general:** Duraciones de bucle como múltiplo entero de un token (±10 %); desfases dentro de un bucle, como fracción del token rápido. Ningún valor suelto en milisegundos o segundos en el CSS:

| Componente | Animación | Duración en prototipo | Expresión con tokens (CSS) | Curva de animación |
|---|---|---|---|---|
| **01 Cubos** | Salto de cubo (`hop`) | 1200 ms | `calc(4 * var(--duration-normal))` (1200 ms) | `--ease-standard` |
| | Desfase cubo 2 | 150 ms | `var(--duration-fast)` (150 ms) | — |
| | Desfase cubo 3 | 300 ms | `var(--duration-normal)` (300 ms) | — |
| | Enlaces (`link`) | 1200 ms | `calc(4 * var(--duration-normal))` (1200 ms) | `linear` |
| | Desfase enlace 2 | 150 ms | `var(--duration-fast)` (150 ms) | — |
| **03 Camión** | Carretera (`roadmv`) | 600 ms | `calc(4 * var(--duration-fast))` (600 ms) | `linear` |
| | Rebote camión (`bump`) | 300 ms | `var(--duration-normal)` (300 ms) | `--ease-in-out` |
| **06 Puntos** | Oscilación (`dot`) | 900 ms | `calc(2 * var(--duration-slow))` (900 ms) | `--ease-standard` |
| | Desfase punto 2 | 120 ms | `calc(0.8 * var(--duration-fast))` (120 ms) | — |
| | Desfase punto 3 | 240 ms | `calc(1.6 * var(--duration-fast))` (240 ms) | — |
| **07 Esqueleto** | Shimmer (`shim`) | 1400 ms | `calc(3 * var(--duration-slow))` (1350 ms, -3.5%) | `--ease-in-out` |
| **08 Barra** | Avance (`ind`) | 1500 ms | `calc(5 * var(--duration-normal))` (1500 ms) | `--ease-in-out` |
| **09 Merkle** | Ciclo global (`lf`, `md`, `rt`) | 2800 ms | `calc(6 * var(--duration-slow))` (2700 ms, -3.5%) | `--ease-spring` |
| | Conectores (`ed`) | 2800 ms | `calc(6 * var(--duration-slow))` (2700 ms) | `--ease-out` |
| | Desfase hojas (2, 3, 4) | 80 ms, 160 ms, 240 ms | `calc(var(--duration-fast) / 2)` (75 ms), `var(--duration-fast)` (150 ms), `calc(var(--duration-fast) * 1.5)` (225 ms) | — |

---

## 5. Alcance Funcional y Ausencia de Lógica de Dominio (Punto 5 y 6)

- **Los loaders son componentes puramente visuales:**
  - `TruckLoader` **NO contiene lógica de dominio ni inspecciona `eventType`**. Recibe únicamente props visuales/accesibles (`className`, `aria-label`). La condición contractual de la línea de tiempo ("solo si el último evento es `ASSET_DISPATCHED`") será implementada en la pantalla de seguimiento durante la tarea VS-7.
  - `TopProgressBar` es un componente de presentación puro. **NO se conecta a eventos de navegación de Next.js** (cuya integración se decidirá por separado).
- **Consumo de datos:** Ningún componente de esta tarea realiza llamadas a endpoints ni depende de datos de backend.

---

## 6. Lo que del prototipo NO se implementa y por qué

| Elemento en `paxfide-movimiento.html` | Decisión | Motivo contractual |
|---|---|---|
| **02 Caja que se sella** | **NO se implementa** | Fuera de alcance explícito en VS-1. |
| **04 Huella que se escribe** | **NO se implementa** | Muestra un hash ficticio (`0x9f3a…c21e`). Regla de oro: prohibido mostrar hashes o datos ficticios en producción. |
| **05 Corazón con anillo** | **NO se implementa** | Fuera de alcance explícito en VS-1 (pagos). |
| **10 Anillo con porcentaje** | **NO se implementa** | Fuera de alcance explícito en VS-1 (subida de fotos, ADR-051 no implementado). |
| **Transiciones entre pantallas** | **NO se implementan** | Fuera de alcance explícito en VS-1 (quedan para decisión posterior). |
| **Controles del catálogo HTML (`.slow`, botones de toggle)** | **NO se implementan** | Herramientas interactivas exclusivas del catálogo de demostración de pruebas. |

---

## 7. Estrategia de Pruebas (Vitest y Playwright)

1. **Unit tests con Vitest (`__tests__/loaders.test.tsx`):**
   - Renderizado correcto de los 6 componentes de carga.
   - Atributos WAI-ARIA (`role="status"`, `role="img"`, `role="progressbar"`, `aria-label`).
   - SVG con `aria-hidden="true"` cuando está anidado en un contenedor que ya anuncia estado.
   - `Button`: con `sending={true}` está `disabled`, tiene `aria-busy="true"`, renderiza `BrandDots` con `aria-hidden="true"` y preserva visible el texto del botón (`{children}`). Con `sending={false}` no renderiza `BrandDots` y no está `disabled`.
   - **Test estructural de reduced-motion:** Lee `Loaders.module.css` y falla si alguna clase con regla `animation:` no tiene su correspondiente regla de detención (`animation: none !important;` o `animation-play-state: paused !important;`) dentro del bloque `@media (prefers-reduced-motion: reduce)`.

2. **Test E2E de Playwright (`e2e/motion.spec.ts`):**
   - E2E real sobre la pantalla `/login` y su botón en estado "Enviando" (con `BrandDots`), activando un retraso controlado desde el test en el backend falso.
   - Con `page.emulateMedia({ reducedMotion: 'reduce' })`: se comprueba sobre los puntos animados que `animation-play-state` es `'paused'` (o duración calculada nula).
   - Aserción negativa: sin `reduce` (`reducedMotion: 'no-preference'`), la animación corre (`animation-play-state: 'running'`).
   - *Nota de adopción E2E:* Los otros 5 loaders tendrán sus tests E2E integrados conforme las pantallas correspondientes los adopten:
     - 01 Cubos: VS-4 / VS-5
     - 03 Camión: VS-7
     - 07 Esqueleto: VS-4 / VS-5 / VS-6
     - 08 Barra superior: cuando se defina su enganche de navegación
     - 09 Árbol de Merkle: VS-7 / verificación de integridad

3. **Test estricto de tokens de tiempo (`__tests__/design-tokens.test.ts`):**
   - Falla si `Loaders.module.css` (o cualquier nuevo módulo CSS) contiene valores numéricos seguidos de `ms` o `s` sueltos (debe usar `var(--duration-*)` o `calc(... var(--duration-*))`).
   - Comprueba 0 colores hexadecimales y 0 referencias directas a tokens `--dark-*`.

4. **Verificación completa del repositorio:**
   - `pnpm typecheck` (0 errores).
   - `pnpm vitest run` (100% pasando).
   - `pnpm test:e2e` (todos los tests E2E pasando).
   - Ejecución completa de `scripts/ci-local.sh`.

---

## 8. Procedimiento de Integración y Entrega (Punto 9)

1. Desarrollo y pruebas en la rama `feat/web-motion`.
2. Dado que VS-2 entra antes en `develop`: antes de abrir el PR, se rebasará `feat/web-motion` sobre `develop`.
3. Se generarán capturas a 390 px y 1280 px del botón de `/login` en estado "Enviando" (tema claro, forzado por DF7-17) en `Documentos/evidencia-web/capturas/`.
4. Se ejecutará `scripts/ci-local.sh` completo sobre el commit rebasado.
5. Se registrará la evidencia y salida literal del CI en el mensaje de entrega.

---

## 9. Ajustes de aprobación (Carlos, 2026-10-22)

1. **Desfases de los puntos (06):**
   - 120 → 150 ms y 240 → 300 ms se salían del ±10 % fijado (+25 %). Se usan los valores exactos como fracción del token rápido, igual que se hace con los de Merkle:
     - punto 2: `calc(0.8 * var(--duration-fast))` (120 ms).
     - punto 3: `calc(1.6 * var(--duration-fast))` (240 ms).
   - Regla general ratificada: duraciones de bucle como múltiplo entero de un token (±10 %); desfases dentro de un bucle, como fracción del token rápido.
2. **Sin página de prueba ("Página de prueba/montaje de loaders bajo Playwright" no puede ser una ruta nueva de la app; añadir rutas es decisión D5):**
   - **E2E real con `emulateMedia`** sobre el único loader que ya está en una pantalla: `BrandDots` en el botón de envío de `/login` (estado "Enviando" con el backend falso respondiendo con retraso; el retraso se activa exclusivamente desde el test mediante la cabecera `x-test-delay-ms`). Con `reduce`: la animación no corre (`animation-play-state: paused`). Sin `reduce`: corre (aserción negativa: `running`).
   - **Test estructural en Vitest** para los otros cinco loaders: lee `Loaders.module.css` y falla si alguna clase con `animation` no tiene su regla dentro de `@media (prefers-reduced-motion: reduce)`.
   - **E2E pendiente por tarea de adopción en pantalla (VS-4 a VS-7):**
     - 01 Cubos encadenados (`ChainCubesLoader`): pendiente de VS-4 / VS-5.
     - 03 Camión en ruta (`TruckLoader`): pendiente de VS-7 (pantalla de seguimiento).
     - 07 Esqueleto (`Skeleton`, `SkeletonCard`, `SkeletonList`): pendiente de VS-4 / VS-5 / VS-6.
     - 08 Barra superior (`TopProgressBar`): pendiente de la definición de integración de navegación.
     - 09 Árbol de Merkle (`MerkleTreeLoader`): pendiente de VS-7 (verificación criptográfica).
3. **Test de "ningún ms suelto":**
   - Ampliación de `design-tokens.test.ts` para que falle si `Loaders.module.css` (y cualquier `*.module.css` nuevo) contiene un valor en `ms` o `s` que no esté dentro de `var(--duration-*)` o `calc(... var(--duration-*))`.
4. **Condiciones previas al PR:**
   - Rebase sobre `develop` con VS-2 dentro (PR #30).
   - Ejecución completa de `ci-local.sh` sobre el último commit con su salida literal.
   - Capturas a 390 y 1280 px del botón de `/login` en estado "Enviando" (tema claro, forzado por DF7-17) en `Documentos/evidencia-web/capturas/`.
