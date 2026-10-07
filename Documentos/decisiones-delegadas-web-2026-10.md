# Decisiones delegadas — frontend web `paxfide-web` (octubre 2026)

**Origen:** autorización de trabajo autónomo de Carlos del 2026-10-07 (frontend web), con su respuesta del mismo día. Es una **excepción temporal a las reglas 1 y 3.4** de `reglas-equipo-y-agentes.md`, válida hasta que Carlos vuelva y escriba en el chat de la sesión.
**Qué es este documento:** el registro de **cada** decisión que el agente tomó por Carlos. **DW-01 a DW-30 RATIFICADAS por Carlos (2026-10-07T19:43Z)**, con ajustes en DW-14, DW-15 y DW-17. La excepción a las reglas 1 y 3.4 terminó al volver Carlos (2026-10-07). Si algo de aquí contradice un documento aprobado, manda el documento aprobado y esta fila es un error a corregir.
**Repositorio:** solo `Toffy22Cj/PaxFide`. El backend (`Toffy22Cj/Donaciones`) se ha leído sin modificarlo; lo que la web necesita de él está en `solicitudes-backend.md`.

---

## 0. Decisiones de Carlos aplicadas (no delegadas)

Para separar lo que decidió Carlos de lo que decidió el agente:

| Decisión | Fuente | Aplicación |
|---|---|---|
| Ampliación del alcance de la web v1: Donar (CV-11 + consulta de estado), `/account/donations` y dispatch/receive/deliver | Respuesta de Carlos, 2026-10-07, punto 3 | Borrador de enmienda: `ADR-046-enmienda-1-alcance-web.md` (pendiente de su aprobación; se implementa mientras tanto, por su indicación) |
| D6/R11: habilitar crear convocatoria, registrar y dividir cuando el backend demuestre la idempotencia por `Command-Id` | Ídem, punto 3 | Verificado: §3 de este documento |
| D5: todas las pantallas detrás de la lista de habilitación; habilitadas en el build de demo, desactivadas en el build por defecto | Ídem, punto 3 | §2 de este documento |
| Crear convocatoria, asignar responsable, "Creadas en esta sesión" y QR | SIN VALIDAR CONTRA PENPOT (sin diseño previo en `diseno-ux`) |
| `AssetPage` con acciones (modales de dividir, despachar, recibir y entregar; progreso de la división) y "Registrar activo" | SIN VALIDAR CONTRA PENPOT (`split` tenía diseño con campos PENDIENTE; el resto, sin diseño previo) |
| Estimación de convocatorias (predicción, gráficos básico y avanzado) | SIN VALIDAR CONTRA PENPOT (sin diseño previo); no habilitada en ningún build (S-06) |
| Seguimiento por formulario (C2/H1): el código viaja en la cabecera, nunca en la ruta ni en la query | Encargo y respuesta de Carlos, 2026-10-07 | DW-01 |
| Playwright contra respuestas simuladas que sigan literalmente los contratos si no se puede levantar el backend; el recorrido real queda para la ejecución final (B7) | Ídem, punto 2 | Ver §4 |
| Acceso al backend en solo lectura | Ídem, punto 1 | El repositorio `Donaciones` estaba clonado en la sesión; se leyó sin cambios (`git status` limpio tras cada lectura y tras ejecutar sus tests) |

---

## 1. Registro de decisiones delegadas

Formato pedido: id · fecha UTC · pantalla · pregunta · opciones · elegida · motivo · ¿reversible? · estado.

| id | Fecha UTC | Pantalla | Pregunta | Opciones | Elegida | Motivo | ¿Reversible? | Estado |
|---|---|---|---|---|---|---|---|---|
| DW-01 | 2026-10-07T17:38Z | Seguimiento | ¿Cómo entra el `trackingCode` en la web sin ponerlo en la URL? | (a) formulario `/tracking` + cabecera; (b) fragmento `#`; (c) ruta con `history.replaceState` | **(a)**: ruta `/tracking` sin parámetros; el código se escribe en un formulario y viaja en `Authorization: Bearer <trackingCode>`, que es el contrato real (`TrackingCodeAuthFilter` del backend). `/tracking/<lo-que-sea>` responde 404 en **todos** los builds, esté o no en la lista | Orden de Carlos. (b) y (c) dejan el secreto en el historial o en la primera petición al servidor web. Consecuencia: el QR de seguimiento de la matriz §4b (`/tracking/{trackingCode}`) deja de abrir la web; ver S-05 | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-02 | 2026-10-07T17:38Z | Todas | ¿Cómo se elige la lista de habilitación por build? | (a) variable de build + un JSON por perfil; (b) un único JSON editado al construir | **(a)**: `NEXT_PUBLIC_SURFACE_PROFILE=demo` usa `enabled-surfaces.demo.json`; sin perfil, `enabled-surfaces.json` (vacía). Las acciones transitorias se nombran `action:<nombre>` y, deshabilitadas, no se renderizan. Los tests siguen usando `NEXT_PUBLIC_E2E_SURFACES` | El build por defecto no cambia (todo 404) y la demo es un build reproducible con un comando (`pnpm build:demo`) | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-03 | 2026-10-07T17:38Z | Todas | El backend no configura CORS. ¿Usar las rewrites de Next.js como proxy en desarrollo, como autorizaba el encargo? | (a) rewrites en `next dev`; (b) no usarlas y pedir CORS al backend | **(b)** | Con rewrites el navegador manda el JWT al servidor Next.js, que lo reenvía: es exactamente lo que prohíben ADR-046 D3 / C1 (aprobado, "no lo reabras") y lo que ya bloquea el código existente (`ApiBaseUrlMisconfiguredError` si la API es del mismo origen). Hasta que el backend decida CORS (S-03), la web solo funciona contra un backend con CORS (el simulado de los tests lo tiene) | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-04 | 2026-10-07T17:38Z | Todas | ¿Dónde vive cada pantalla? | (a) en `page.tsx`; (b) componente en `src/screens/` y `page.tsx` mínimo | **(b)** | Los tests inyectan clientes falsos por props sin chocar con la validación de props de página de `next build` | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-05 | 2026-10-07T17:38Z | Shell | §5.1 no tiene navegación. Con varias superficies habilitadas, ¿cómo se vuelve al panel? | (a) nada; (b) un enlace fijo "Panel" junto a "Cerrar sesión"; (c) barra lateral | **(b)** | §5.1 prevé navegación "cuando existan al menos dos superficies navegables habilitadas"; un solo enlace fijo es lo mínimo y no depende de roles | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-06 | 2026-10-07T17:38Z | PanelHome | El backend no expone `GET /me` (404). ¿Qué muestra el panel? | (a) error; (b) todas las entradas (D-N1-1 (b), rechazada); (c) aviso "No disponible" y solo las entradas que no dependen de roles | **(c)**. Además, nueva entrada "Mis donaciones" (cualquier cuenta), consecuencia de la ampliación del alcance | No inventa roles ni organización. `/panel/campaigns` muestra "No disponible" en vez de llamar sin `organizationId` | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-07 | 2026-10-07T17:38Z | Todas (comandos) | Los textos de los 409 estaban PENDIENTES (§6). ¿Qué se muestra? | (a) texto genérico por código; (b) texto por `title` del `ProblemDetail` y genérico si no se conoce | **(b)**, en `src/lib/api/messages.ts`. Solo se usa `title` (nombre fijo de la regla, B6-0); el `detail` nunca se muestra | El backend ya fija los nombres de regla (ConvocatoriaApiErrorMappings, CoreApiErrorMappings) | Sí: los textos son una tabla | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-08 | 2026-10-07T17:38Z | Comandos | El hook de comandos enviaba `X-Command-Id`; el backend exige `Command-Id` (B6-0) | (a) corregir; (b) mantener | **(a)**, y el test se actualiza para exigir `Command-Id` y prohibir `X-Command-Id` | Con `X-Command-Id` todo comando habría recibido 400. Es una corrección contra el contrato, no un cambio de diseño | No aplica | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-09 | 2026-10-07T17:38Z | Todas | Endurecimiento del cliente HTTP | — | `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `cache: 'no-store'` en cada petición; `referrer: no-referrer` en el documento | Ningún enlace ni petición filtra la URL; nada se cachea; ninguna cookie viaja | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-10 | 2026-10-07T17:38Z | Tests | `vitest.setup.ts` no limpiaba el DOM entre tests (sin `globals`) | — | `afterEach(cleanup)` | Un estado de un test anterior hacía fallar el siguiente al añadir `role="alert"` a `ErrorState` | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-11 | 2026-10-07T17:38Z | Tests (Playwright) | El Chromium preinstalado del entorno no coincide con el de `@playwright/test` del lockfile | (a) instalar otro navegador; (b) `PW_CHROMIUM_PATH` opcional | **(b)**: los `playwright*.config.ts` usan `executablePath` solo si existe `PW_CHROMIUM_PATH`; CI no la define | No añade dependencias ni cambia CI | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-12 | 2026-10-07T17:38Z | Tests (Playwright) | El backend simulado debe seguir los contratos | — | `scripts/fake-backend.js` reescrito con las rutas reales bajo `/api/v1`, `ProblemDetail` con la forma de `ApiExceptionHandler` y CORS con `Command-Id`/`Intent-Token`. `NEXT_PUBLIC_API_BASE_URL` pasa a incluir `/api/v1`. Las cuentas de prueba son datos del simulador, no del contrato | Opción B de Carlos | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-17 | 2026-10-07T17:55Z | Proceso | El CI de GitHub Actions no llega a ejecutarse (job sin runner, 2 s; igual en las 4 ejecuciones del repositorio, también en los PR #2 y #3 ya fusionados). ¿Se puede fusionar en `develop` "solo con todo en verde"? | (a) no fusionar nada hasta que Actions funcione; (b) fusionar con la batería del workflow ejecutada en local, completa y en verde, con la salida en el PR y en `Documentos/evidencia-web/` | **(b)**, solo en `develop` (nunca en `main`) y comentándolo en cada PR | El fallo es de infraestructura, no de los tests (no ejecuta ningún paso). Con (a) ningún bloque llegaría a `develop` antes del 21 de octubre. Los mismos pasos del workflow se ejecutan en local antes de cada fusión | Sí: cada fusión es un merge commit revertible | **RATIFICADA — Carlos, 2026-10-07T19:43Z** con ajuste: diagnóstico hecho (ver §5); no se toca nada más |
| DW-13 | 2026-10-07T18:05Z | `/c/:publicCode` | ¿Cómo hace el SSR la lectura de CV-07 sin tocar la sesión (C1)? | (a) reutilizar el cliente del navegador; (b) módulo de servidor propio, sin sesión | **(b)** `publicServer.ts`: `fetch` sin cabeceras de autenticación; la base sale de `API_INTERNAL_BASE_URL` (opcional, para cuando el servidor alcance al backend por otra dirección) o de `NEXT_PUBLIC_API_BASE_URL`. `check:server` se endurece: ningún archivo de servidor puede importar la sesión, `usePrincipal`, `http` ni `publicCampaigns` (los `import type` se permiten); los módulos con sesión se marcan `'use client'` | El servidor Next.js no posee credenciales (D3). La página llama a `notFound()` (HTTP 404) si el backend responde 404 (S-09) o si la superficie está deshabilitada | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-14 | 2026-10-07T18:05Z | `/c`, Donar | Los importes llegan en unidades mínimas ISO 4217 (Q-CV01-3). ¿Cómo se muestran y se piden? | (a) mostrar el entero crudo; (b) convertir con el exponente de la moneda, sin coma flotante | **(b)**: `src/lib/money.ts`, aritmética de cadenas; el exponente sale de `Intl` (CLDR); el donante escribe unidades de la moneda (`50000` o `50000,50`) y se envía el entero en unidades mínimas; más decimales de los que admite la moneda → error de validación; nunca se redondea | El crudo (`5000000` para 50 000 COP) induce a error; la conversión es solo de presentación | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** con ajuste: el exponente sale de la tabla ISO 4217 (`src/lib/money.ts`), no de `Intl`; test que fija COP = 2; una moneda fuera de la tabla no se convierte |
| DW-15 | 2026-10-07T18:05Z | Donar | ¿Qué es "mostrar la redirección de pago simulada" y cómo se consulta el estado? | (a) navegar a `paymentRedirectUrl` (`/demo/checkout/sim_…`, ruta relativa sin página); (b) paso en la misma página | **(b)**: se informa de la redirección a la pasarela simulada sin navegar (navegar perdería el `statusToken`, que solo vive en memoria). La confirmación la envía el proveedor por el webhook firmado: **la web nunca dispara el webhook** (exigiría el secreto en el navegador). El estado se consulta con el botón "Consultar estado del pago": sin sondeo automático | Seguridad del secreto del webhook y del `statusToken`. El efectivo no se ofrece (CV-11 lo rechaza) | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** con ajuste: aviso antes de salir de la página mientras la donación no esté resuelta y `trackingCode` destacado en cuanto llega (A3) |
| DW-16 | 2026-10-07T18:05Z | Donar → Seguimiento | ¿Cómo pasa el `trackingCode` de la donación al seguimiento sin URL? | (a) que el usuario lo copie; (b) variable de módulo en memoria, consumo único | **(b)** además de "Copiar código": "Ver seguimiento" deja el código en memoria y `/tracking` lo consume una vez | Cumple "ningún secreto en la URL" y no persiste nada; recargar lo pierde | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-18 | 2026-10-07T18:20Z | Seguimiento | ¿Qué se muestra de TR-01 y cómo se separa la narrativa? | — | Bloque "Hechos verificables" (estado, importes del `financialSnapshot` en unidades mínimas y bienes con su recorrido TR-03 bajo demanda) y bloque aparte "Relato de tu donación" con la advertencia "si algo no coincide, mandan los hechos" y la fuente (IA o plantilla). `PENDING` → "Actualizar" manual. No se muestran `campaignRef` ni `assetRef`. Un importe fuera del rango seguro de JavaScript se muestra "—", nunca aproximado | `front-fase2` §9 (TrackingPage) y la regla de no presentar una estimación o un texto generado como hecho | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-19 | 2026-10-07T18:20Z | Mis donaciones | ¿Se muestra el `trackingCode` que devuelve `/account/donations`? | (a) siempre; (b) oculto hasta que el usuario lo pide | **(b)**, con "Ver seguimiento" que lo pasa en memoria (DW-16). No se muestra `intentId` | Es una credencial; no hace falta en pantalla para seguir la donación | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-20 | 2026-10-07T18:40Z | Convocatorias | ¿Modal o formulario en la página para crear convocatoria? ¿Cómo se piden las fechas? | (a) modal (§4); (b) sección en la página | **(b)**: sección "Nueva convocatoria" que se abre con un botón (sigue siendo acción transitoria, sin ruta). Fechas con `datetime-local` en hora local, enviadas como UTC con `Z` y sin milisegundos; la meta se escribe en unidades de la moneda y se envía en unidades mínimas (DW-14); visibilidad obligatoria; `onTargetReached` solo con `CLOSE_ON_TARGET` (ficha §3.1) | El formulario de CV-01 tiene hasta 12 campos: en un modal a 360 px es incómodo | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-21 | 2026-10-07T18:40Z | Convocatorias | Sin listado (S-02), ¿cómo se elige la convocatoria al asignar responsable? | (a) solo texto; (b) lista en memoria de las creadas en la pestaña + texto si no hay | **(b)**: "Creadas en esta sesión" vive en memoria y se vacía en cualquier `LOGGED_OUT`. Muestra la referencia (`campaignRef`) de la propia organización, que el administrador necesita | No es fuente de verdad; desaparece cuando exista S-02 | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-22 | 2026-10-07T18:40Z | Convocatorias | Sin lectura de miembros (R6), ¿cómo se indica el responsable? | (a) no ofrecer CV-02; (b) campo de texto con el id de la cuenta | **(b)**, con la indicación de que no hay listado de miembros | CV-02 es parte del golden path; el backend valida el destinatario (409 `InvalidResponsibleRecipient`) | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-23 | 2026-10-07T18:40Z | Convocatorias | "Accesible por QR": ¿cómo se genera el QR sin librerías (D8)? | (a) no mostrar QR (`front-fase2` §9 lo dejaba pendiente); (b) codificador propio | **(b)** `src/lib/qr.ts` (modo byte, nivel M, versiones 1–10) y `QrCode.tsx` en SVG, con la URL canónica `/c/{publicCode}` sobre el origen de la web. Verificado bit a bit contra la implementación de referencia (Project Nayuki) en 5 textos × 9 variantes; las huellas quedan en `__tests__/qr.test.ts` | Requisito del encargo sin añadir dependencias | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-24 | 2026-10-07T19:00Z | Activo — dividir | ¿Cómo se espera al hijo tras el `202`? | (a) botón manual; (b) consulta automática de `GET …/splits/{child}` | **(b)**: cada 1,5 s, máximo 20 consultas; luego "Consultar de nuevo". Estados: `CHILD_CREATED` (enlace al hijo), `COMPENSATED`, `UNRESOLVED` (amarillo: "no la repitas"), `RESOLVED_MANUALLY`. El comando nunca se repite | Es una lectura sin efectos; el encargo pide consultar "hasta que exista el hijo". `front-fase2` §10 decía que no había verificación honesta de la división: ahora el backend da el recurso de estado | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-25 | 2026-10-07T19:00Z | Activo — acciones | ¿Qué acciones se ofrecen según el estado del activo? | (a) copiar la tabla del móvil (`ActionResolver`); (b) todas las habilitadas salvo en `DELIVERED` | **(b)**: el backend responde 409 (`InvalidAssetTransition`, `AssetTerminalState`…) si no corresponde, con su texto (DW-07). Tras un comando se relee el activo sin desmontar la pantalla; los avisos (p. ej. el enlace al hijo) se conservan aunque el activo pase a `DELIVERED` | Evita la divergencia que temía T3 (Enmienda 1, E1-2) | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-26 | 2026-10-07T19:00Z | Registrar activo | ¿Cómo se ofrecen los dos caminos sin lecturas de apoyo? | — | Un formulario con "Origen del bien": B (especie, `/from-donation`, `campaignRef` opcional) y A (compra, `/register`, `fundId` y `allocationId` escritos a mano, S-04). Nunca se envían `organizationRef` ni `donorRef` (DD-09, DD-10). Tras el éxito, a `/assets/{assetRef}` | El camino A existe en el backend pero sin lectura que dé sus ids (H-B6C-1, H-B6D-1) | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-27 | 2026-10-07T19:00Z | `AssetPage` | Contrato real frente al cliente existente | — | `quantity` es texto (`toPlainString`), los nulos llegan omitidos y el `assetRef` se codifica en la ruta. Los tests existentes de `AssetPage` se adaptan al marcado `dt`/`dd` del diseño (§4 `DefinitionList`) comprobando además que cada valor va junto a su etiqueta; no se quita ninguna aserción | Correcciones contra el contrato de B6-c | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-28 | 2026-10-07T19:30Z | Predicción | El backend no tiene endpoint de predicción (S-06). ¿Qué se construye? | (a) nada; (b) gráficos y pantalla con un cliente que devuelve "no disponible" sin llamar a nada; (c) datos de ejemplo | **(b)**: `fetchPrediction` no hace ninguna petición y devuelve `unavailable`; los gráficos consumen una vista interna (`PredictionCheckpoint`) que no es contrato: el adaptador se escribirá con el contrato real. `/panel/prediction` **no** está en ninguna lista de habilitación. Los datos de los tests están marcados como datos de prueba y no se usan en la aplicación | "Nunca inventes respuestas" y "nunca presentes una estimación como hecho". Etiqueta permanente "ESTIMACIÓN — modelo entrenado con datos sintéticos" en insignia amarilla (combinación aprobada `brand-green-900` sobre `brand-yellow-400`, 5,00:1), bloque con borde discontinuo separado de los hechos; `STRICT` → motivo del backend, sin número | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-29 | 2026-10-07T19:30Z | Predicción | Colores de los gráficos | (a) paleta genérica de visualización; (b) tokens aprobados | **(b)**: recaudado (hecho) en `brand-green-900`, línea continua y círculos; estimación en `brand-blue-700`, línea discontinua y cuadrados. El validador de paletas da separación CVD ΔE 18 y marca las bandas genéricas de luminosidad y croma, que no se aplican porque `sistema-visual` §5.5 prohíbe colores nuevos sin recalcular; se compensa con codificación secundaria (trazo, marcador, leyenda, etiqueta directa y tabla). Un solo eje. En móvil, el SVG avanzado tiene ancho mínimo con desplazamiento propio | Sistema visual aprobado | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-30 | 2026-10-07T19:30Z | Golden path (tests) | ¿Cómo obtiene el test lo que la web no puede leer? | — | El test hace de **proveedor de pago** (como el webhook simulado firmado) y de **operador** para el `fundId` del camino A (S-04), con rutas `/__test/*` que solo existen en el backend simulado; igual que `GoldenPathHttpIntegrationTest` del backend, que los toma del servicio o de la base de datos | Opción B de Carlos; nada de eso está en la aplicación | Sí | **RATIFICADA — Carlos, 2026-10-07T19:43Z** |
| DW-31 | 2026-10-07T21:33Z | Registro de cuenta | ¿Cómo entra el registro (P2) en la web, si `diseno-ux` §5.2 excluía "crear cuenta"? | — | Ruta `/register` (categoría AUTH) y enlace "Crear cuenta" en el login, ambos tras la lista de habilitación. Campo "Repite la contraseña" solo en cliente; no se inicia sesión sola tras crear la cuenta; textos: 409 `DuplicateEmail` → "Ya existe una cuenta con ese correo." (la enumeración de correos es una decisión del backend, DD-56) | §5.2 lo excluía porque no había contrato; ahora existe (`AccountRegistrationController`) y Carlos lo incluyó en P2 | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-32 | 2026-10-07T21:33Z | Descubrimiento | ¿Dónde vive y se indexa? | — | `/campaigns` (pública, solo cliente) con "Cargar más" por cursor opaco; enlace "Convocatorias" en el Shell para todos; **`noindex`** hasta que se decida la indexación (P-W2 la dejaba para cuando existiera este endpoint) | Prudencia: indexar es una decisión de producto, no de implementación | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-33 | 2026-10-07T21:33Z | `/c/:publicCode` | ¿Se muestra la narrativa de la convocatoria? | — | Sí, como sección `section:campaign-narrative` (habilitable): hechos (`unitsDelivered`, `distinctRecipients` como "receptores distintos") separados del relato; `PENDING` → "Actualizar"; `UNAVAILABLE`/404 → "no disponible" | Estaba en la matriz de pantallas (`front-fase2` §9, "narrativa no disponible"); ahora tiene contrato (B5) | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-34 | 2026-10-07T21:33Z | Todas | `referencia-api-v1.md` y el código del backend difieren en algunos puntos (§D de `solicitudes-backend.md`) | (a) seguir el documento; (b) seguir el código | **(b)**, y cada diferencia anotada en §D. Las unidades de los importes (D-01) **no se cambian** hasta que Carlos y el backend decidan | "Si difieren del backend, manda el backend": el código es lo que responde | Sí | `PENDIENTE DE RATIFICACIÓN` |

---

## 2. Habilitaciones en el build de demo (`enabled-surfaces.demo.json`)

Cada entrada cita la evidencia o la enmienda que la justifica. Una habilitación **no** es autorización (ADR-046 D5): el backend decide.

| Superficie | PR | Evidencia / justificación | Bloqueos que siguen abiertos |
|---|---|---|---|
| `/login` | 1 | `LoginController` en `develop` del backend (ID-01, B3; `estado-fase6.md` §0.8) | — |
| `/panel` | 1 | Decisión D5 de Carlos (2026-10-07). Lee `/me` (ficha N1 CONGELADA) | **`/me` no existe en el backend (S-01)**: el panel muestra "No disponible" (DW-06) |
| `/panel/campaigns` | 1 | Ídem | S-01 y S-02 (listado). Sin `/me` no hay `organizationId` |
| `/c/:publicCode` | 2 | CV-07 en `develop` (B6-a, `estado-fase6.md` §0.13); "no encontrada" = 404 (S-09) | — |
| `action:donate` | 2 | CV-11 y la consulta con `Intent-Token` en `develop` (B6-b, §0.14); ampliación de alcance (Enmienda 1 de ADR-046, borrador); idempotencia de CV-11 probada en `DonationPaymentHttpIntegrationTest.aDuplicateCv11_returnsTheSameIntentWithANewToken_andTheOldOneStopsWorking` | Pago real: solo proveedor simulado en `dev` |
| `/tracking` | 3 | TR-01 a TR-03 en `develop` con `Authorization: Bearer <trackingCode>` (`TrackingCodeAuthFilter`; B6-d, §0.15, que arregló el 404 del seguimiento real); decisión C2/H1 de Carlos | S-05 (QR de seguimiento) |
| `/account/donations` | 3 | `GET /account/donations` en `develop` (B6-b, §0.14); ampliación de alcance (Enmienda 1, borrador) | — |
| `action:create-campaign` | 4 | CV-01 en `develop` (B6-a, §0.13); **R11 verificado** (§3 de este documento) | S-01: sin `/me` no hay `organizationId` y la acción no aparece contra el backend real de hoy |
| `action:assign-employee` | 4 | CV-02 en `develop` (B6-a); duplicado idéntico probado (`cv02_assigns_andADuplicateIsIdentical`) | S-01; R6 (sin lectura de miembros, DW-22) |
| `action:register-asset` | 5 | Registro A y B en `develop` (B6-c, §0.12); **R11 verificado** (§3); P7 integrado en `core` (`golden-path.md` §5, actualización C6) | S-04 (ids del camino A); R10 (D-N1-2: no a un `REPRESENTATIVE` solo) |
| `action:split` | 5 | División (`202` + recurso de estado) en `develop` (B6-c; saga B1-bis); **R11 verificado** (§3, en `core`) | Sin test HTTP de duplicado de la división (§3, matiz) |
| `action:dispatch`, `action:receive`, `action:deliver` | 5 | En `develop` (B6-c, D-ASSET) con `Command-Id`; duplicado probado en `PhysicalAssetHttpIntegrationTest`; ampliación de alcance (Enmienda 1, E1-2) | — |
| `/register` | P2-A | `POST /auth/register` en `develop` del backend `f5266c5` | Sin política de contraseña (H-P2-1 del backend) |
| `/campaigns` | P2-A | `GET /public/campaigns` en `f5266c5` (DD-52, DD-53) | — |
| `section:campaign-narrative` | P2-A | `GET /public/campaigns/{publicCode}/narrative` en `f5266c5` (B5) | — |
| `/assets/:assetRef` (lectura) | 1 | `GET /physical-assets/{assetRef}` en `develop` (B6-c, `estado-fase6.md` §0.12) | R10: un `REPRESENTATIVE` recibe 403 (estado de pantalla) |

---

## 3. Verificación de D6/R11 (idempotencia por `Command-Id`)

Condición de ADR-046 D6: que el backend acepte `commandId` y demuestre con un test que el mismo `commandId` produce un solo efecto.

| Comando | Test del backend | Qué demuestra |
|---|---|---|
| Crear convocatoria (CV-01) | `CampaignHttpIntegrationTest.cv01_createsAndAnswersExactlyCampaignRefAndPublicCode_andADuplicateIsIdentical` y `cv01_aCommandIdOfAnotherCommand_is409` | Por HTTP: el duplicado devuelve el mismo cuerpo y crea un solo documento; reutilizarlo en otro comando da 409 |
| Registrar activo (camino B por HTTP; A y B en `core`) | `PhysicalAssetHttpIntegrationTest.theSameCommandId_givesTheSameStatusAndBody_andAnotherCommandWithIt_is409`; `AssetHttpCommandsIntegrationTest.registerFromDonation_returnsTheDeterministicId_andADuplicateReturnsTheSameResultWithoutWriting`, `registerPathA_returnsTheDeterministicIdAndTheCampaignOfTheFund` | Mismo código y cuerpo ante el duplicado, sin escribir de nuevo; 409 al reutilizarlo en otro comando |
| Dividir | `SplitSagaIntegrationTest.theSameCommand_returnsTheSameChild_withoutASecondSplit_andAnotherParentGetsAnotherChild` | El mismo `commandId` devuelve el mismo hijo sin una segunda división (en `core`; por HTTP solo se prueba el `202`) |

**Ejecución en esta sesión** (backend en solo lectura, `develop` `8dc48eb`, Docker real): `Documentos/evidencia-web/r11-backend-idempotencia-8dc48eb-2026-10-07.txt`. Resumen literal:

```
Tests run: 17, Failures: 0, Errors: 0, Skipped: 0 -- in ...SplitSagaIntegrationTest
Tests run: 11, Failures: 0, Errors: 0, Skipped: 0 -- in ...AssetHttpCommandsIntegrationTest
Tests run: 14, Failures: 0, Errors: 0, Skipped: 0 -- in ...CampaignHttpIntegrationTest
Tests run: 8, Failures: 0, Errors: 0, Skipped: 0 -- in ...PhysicalAssetHttpIntegrationTest
BUILD SUCCESS
```

**Conclusión:** R11 queda resuelto para crear convocatoria, registrar y dividir, según la condición fijada por Carlos. **Matiz:** la idempotencia de la división por HTTP no tiene un test propio que envíe dos veces la misma petición; se apoya en el de `core`.

---

## 4. Pantallas: SIN VALIDAR CONTRA PENPOT

Penpot es la fuente visual de verdad y el agente no tiene acceso. Todas las pantallas se implementaron desde `sistema-visual-paxfide-web.md` y `diseno-ux-contractual-web-v1.md`.

| Pantalla | Estado visual |
|---|---|
| Shell | SIN VALIDAR CONTRA PENPOT |
| Login | SIN VALIDAR CONTRA PENPOT |
| PanelHome | SIN VALIDAR CONTRA PENPOT |
| `/panel/campaigns` | SIN VALIDAR CONTRA PENPOT |
| `/c/:publicCode` (con datos reales de CV-07; §5.4 solo tenía bloques grises) | SIN VALIDAR CONTRA PENPOT |
| Crear convocatoria, asignar responsable, "Creadas en esta sesión" y QR | SIN VALIDAR CONTRA PENPOT (sin diseño previo en `diseno-ux`) |
| `AssetPage` con acciones (modales de dividir, despachar, recibir y entregar; progreso de la división) y "Registrar activo" | SIN VALIDAR CONTRA PENPOT (`split` tenía diseño con campos PENDIENTE; el resto, sin diseño previo) |
| Estimación de convocatorias (predicción, gráficos básico y avanzado) | SIN VALIDAR CONTRA PENPOT (sin diseño previo); no habilitada en ningún build (S-06) |
| Seguimiento por formulario (`/tracking`) | SIN VALIDAR CONTRA PENPOT |
| Mis donaciones | SIN VALIDAR CONTRA PENPOT |
| Donar, pasarela simulada, estado de la intención y entrega del `trackingCode` | SIN VALIDAR CONTRA PENPOT (sin diseño previo en `diseno-ux`) |
| Estados globales y componentes base | SIN VALIDAR CONTRA PENPOT |

---

## 5. Diagnóstico de DW-17 (GitHub Actions sin runner)

**Causa: límite de la cuenta, no configuración.** La anotación del check run (`GET /repos/Toffy22Cj/PaxFide/check-runs/112945138985/annotations`, API pública) dice literalmente:

```
The job was not started because your account is locked due to a billing issue.
```

- El repositorio es público y el workflow (`.github/workflows/ci.yml`) es correcto: el job no tiene runner (`runner_name` vacío, `steps: []`) porque GitHub no lo arranca.
- Lo resuelve el titular de la cuenta en la configuración de facturación de GitHub. **No se ha tocado nada** (orden de Carlos, 2026-10-07T19:43Z).
- **DW-17 CERRADA — Carlos, 2026-10-07T20:14Z:** excepción permanente a la regla 3.2; el CI es local (`scripts/ci-local.sh`), registrado en `reglas-equipo-y-agentes.md` §3.2. Todo PR adjunta la salida de `scripts/ci-local.sh` sobre su último commit.
- Aviso de la misma anotación, sin acción ahora: `ubuntu-latest` migra a Ubuntu 26 desde el 19 de octubre de 2026.
