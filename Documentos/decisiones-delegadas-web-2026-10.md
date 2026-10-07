# Decisiones delegadas — frontend web `paxfide-web` (octubre 2026)

**Origen:** autorización de trabajo autónomo de Carlos del 2026-10-07 (frontend web), con su respuesta del mismo día. Es una **excepción temporal a las reglas 1 y 3.4** de `reglas-equipo-y-agentes.md`, válida hasta que Carlos vuelva y escriba en el chat de la sesión.
**Qué es este documento:** el registro de **cada** decisión que el agente tomó por Carlos. Ninguna está ratificada salvo que la columna "Estado" lo diga. Si algo de aquí contradice un documento aprobado, manda el documento aprobado y esta fila es un error a corregir.
**Repositorio:** solo `Toffy22Cj/PaxFide`. El backend (`Toffy22Cj/Donaciones`) se ha leído sin modificarlo; lo que la web necesita de él está en `solicitudes-backend.md`.

---

## 0. Decisiones de Carlos aplicadas (no delegadas)

Para separar lo que decidió Carlos de lo que decidió el agente:

| Decisión | Fuente | Aplicación |
|---|---|---|
| Ampliación del alcance de la web v1: Donar (CV-11 + consulta de estado), `/account/donations` y dispatch/receive/deliver | Respuesta de Carlos, 2026-10-07, punto 3 | Borrador de enmienda: `ADR-046-enmienda-1-alcance-web.md` (pendiente de su aprobación; se implementa mientras tanto, por su indicación) |
| D6/R11: habilitar crear convocatoria, registrar y dividir cuando el backend demuestre la idempotencia por `Command-Id` | Ídem, punto 3 | Verificado: §3 de este documento |
| D5: todas las pantallas detrás de la lista de habilitación; habilitadas en el build de demo, desactivadas en el build por defecto | Ídem, punto 3 | §2 de este documento |
| Seguimiento por formulario (C2/H1): el código viaja en la cabecera, nunca en la ruta ni en la query | Encargo y respuesta de Carlos, 2026-10-07 | DW-01 |
| Playwright contra respuestas simuladas que sigan literalmente los contratos si no se puede levantar el backend; el recorrido real queda para la ejecución final (B7) | Ídem, punto 2 | Ver §4 |
| Acceso al backend en solo lectura | Ídem, punto 1 | El repositorio `Donaciones` estaba clonado en la sesión; se leyó sin cambios (`git status` limpio tras cada lectura y tras ejecutar sus tests) |

---

## 1. Registro de decisiones delegadas

Formato pedido: id · fecha UTC · pantalla · pregunta · opciones · elegida · motivo · ¿reversible? · estado.

| id | Fecha UTC | Pantalla | Pregunta | Opciones | Elegida | Motivo | ¿Reversible? | Estado |
|---|---|---|---|---|---|---|---|---|
| DW-01 | 2026-10-07T17:38Z | Seguimiento | ¿Cómo entra el `trackingCode` en la web sin ponerlo en la URL? | (a) formulario `/tracking` + cabecera; (b) fragmento `#`; (c) ruta con `history.replaceState` | **(a)**: ruta `/tracking` sin parámetros; el código se escribe en un formulario y viaja en `Authorization: Bearer <trackingCode>`, que es el contrato real (`TrackingCodeAuthFilter` del backend). `/tracking/<lo-que-sea>` responde 404 en **todos** los builds, esté o no en la lista | Orden de Carlos. (b) y (c) dejan el secreto en el historial o en la primera petición al servidor web. Consecuencia: el QR de seguimiento de la matriz §4b (`/tracking/{trackingCode}`) deja de abrir la web; ver S-05 | Sí | Decidida por Carlos ("de acuerdo", 2026-10-07); el detalle de implementación está `PENDIENTE DE RATIFICACIÓN` |
| DW-02 | 2026-10-07T17:38Z | Todas | ¿Cómo se elige la lista de habilitación por build? | (a) variable de build + un JSON por perfil; (b) un único JSON editado al construir | **(a)**: `NEXT_PUBLIC_SURFACE_PROFILE=demo` usa `enabled-surfaces.demo.json`; sin perfil, `enabled-surfaces.json` (vacía). Las acciones transitorias se nombran `action:<nombre>` y, deshabilitadas, no se renderizan. Los tests siguen usando `NEXT_PUBLIC_E2E_SURFACES` | El build por defecto no cambia (todo 404) y la demo es un build reproducible con un comando (`pnpm build:demo`) | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-03 | 2026-10-07T17:38Z | Todas | El backend no configura CORS. ¿Usar las rewrites de Next.js como proxy en desarrollo, como autorizaba el encargo? | (a) rewrites en `next dev`; (b) no usarlas y pedir CORS al backend | **(b)** | Con rewrites el navegador manda el JWT al servidor Next.js, que lo reenvía: es exactamente lo que prohíben ADR-046 D3 / C1 (aprobado, "no lo reabras") y lo que ya bloquea el código existente (`ApiBaseUrlMisconfiguredError` si la API es del mismo origen). Hasta que el backend decida CORS (S-03), la web solo funciona contra un backend con CORS (el simulado de los tests lo tiene) | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-04 | 2026-10-07T17:38Z | Todas | ¿Dónde vive cada pantalla? | (a) en `page.tsx`; (b) componente en `src/screens/` y `page.tsx` mínimo | **(b)** | Los tests inyectan clientes falsos por props sin chocar con la validación de props de página de `next build` | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-05 | 2026-10-07T17:38Z | Shell | §5.1 no tiene navegación. Con varias superficies habilitadas, ¿cómo se vuelve al panel? | (a) nada; (b) un enlace fijo "Panel" junto a "Cerrar sesión"; (c) barra lateral | **(b)** | §5.1 prevé navegación "cuando existan al menos dos superficies navegables habilitadas"; un solo enlace fijo es lo mínimo y no depende de roles | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-06 | 2026-10-07T17:38Z | PanelHome | El backend no expone `GET /me` (404). ¿Qué muestra el panel? | (a) error; (b) todas las entradas (D-N1-1 (b), rechazada); (c) aviso "No disponible" y solo las entradas que no dependen de roles | **(c)**. Además, nueva entrada "Mis donaciones" (cualquier cuenta), consecuencia de la ampliación del alcance | No inventa roles ni organización. `/panel/campaigns` muestra "No disponible" en vez de llamar sin `organizationId` | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-07 | 2026-10-07T17:38Z | Todas (comandos) | Los textos de los 409 estaban PENDIENTES (§6). ¿Qué se muestra? | (a) texto genérico por código; (b) texto por `title` del `ProblemDetail` y genérico si no se conoce | **(b)**, en `src/lib/api/messages.ts`. Solo se usa `title` (nombre fijo de la regla, B6-0); el `detail` nunca se muestra | El backend ya fija los nombres de regla (ConvocatoriaApiErrorMappings, CoreApiErrorMappings) | Sí: los textos son una tabla | `PENDIENTE DE RATIFICACIÓN` (textos sin revisar por UX) |
| DW-08 | 2026-10-07T17:38Z | Comandos | El hook de comandos enviaba `X-Command-Id`; el backend exige `Command-Id` (B6-0) | (a) corregir; (b) mantener | **(a)**, y el test se actualiza para exigir `Command-Id` y prohibir `X-Command-Id` | Con `X-Command-Id` todo comando habría recibido 400. Es una corrección contra el contrato, no un cambio de diseño | No aplica | `PENDIENTE DE RATIFICACIÓN` |
| DW-09 | 2026-10-07T17:38Z | Todas | Endurecimiento del cliente HTTP | — | `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `cache: 'no-store'` en cada petición; `referrer: no-referrer` en el documento | Ningún enlace ni petición filtra la URL; nada se cachea; ninguna cookie viaja | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-10 | 2026-10-07T17:38Z | Tests | `vitest.setup.ts` no limpiaba el DOM entre tests (sin `globals`) | — | `afterEach(cleanup)` | Un estado de un test anterior hacía fallar el siguiente al añadir `role="alert"` a `ErrorState` | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-11 | 2026-10-07T17:38Z | Tests (Playwright) | El Chromium preinstalado del entorno no coincide con el de `@playwright/test` del lockfile | (a) instalar otro navegador; (b) `PW_CHROMIUM_PATH` opcional | **(b)**: los `playwright*.config.ts` usan `executablePath` solo si existe `PW_CHROMIUM_PATH`; CI no la define | No añade dependencias ni cambia CI | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-12 | 2026-10-07T17:38Z | Tests (Playwright) | El backend simulado debe seguir los contratos | — | `scripts/fake-backend.js` reescrito con las rutas reales bajo `/api/v1`, `ProblemDetail` con la forma de `ApiExceptionHandler` y CORS con `Command-Id`/`Intent-Token`. `NEXT_PUBLIC_API_BASE_URL` pasa a incluir `/api/v1`. Las cuentas de prueba son datos del simulador, no del contrato | Opción B de Carlos | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-17 | 2026-10-07T17:55Z | Proceso | El CI de GitHub Actions no llega a ejecutarse (job sin runner, 2 s; igual en las 4 ejecuciones del repositorio, también en los PR #2 y #3 ya fusionados). ¿Se puede fusionar en `develop` "solo con todo en verde"? | (a) no fusionar nada hasta que Actions funcione; (b) fusionar con la batería del workflow ejecutada en local, completa y en verde, con la salida en el PR y en `Documentos/evidencia-web/` | **(b)**, solo en `develop` (nunca en `main`) y comentándolo en cada PR | El fallo es de infraestructura, no de los tests (no ejecuta ningún paso). Con (a) ningún bloque llegaría a `develop` antes del 21 de octubre. Los mismos pasos del workflow se ejecutan en local antes de cada fusión | Sí: cada fusión es un merge commit revertible | `PENDIENTE DE RATIFICACIÓN` — **la decisión más difícil de deshacer de este registro** |
| DW-13 | 2026-10-07T18:05Z | `/c/:publicCode` | ¿Cómo hace el SSR la lectura de CV-07 sin tocar la sesión (C1)? | (a) reutilizar el cliente del navegador; (b) módulo de servidor propio, sin sesión | **(b)** `publicServer.ts`: `fetch` sin cabeceras de autenticación; la base sale de `API_INTERNAL_BASE_URL` (opcional, para cuando el servidor alcance al backend por otra dirección) o de `NEXT_PUBLIC_API_BASE_URL`. `check:server` se endurece: ningún archivo de servidor puede importar la sesión, `usePrincipal`, `http` ni `publicCampaigns` (los `import type` se permiten); los módulos con sesión se marcan `'use client'` | El servidor Next.js no posee credenciales (D3). La página llama a `notFound()` (HTTP 404) si el backend responde 404 (S-09) o si la superficie está deshabilitada | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-14 | 2026-10-07T18:05Z | `/c`, Donar | Los importes llegan en unidades mínimas ISO 4217 (Q-CV01-3). ¿Cómo se muestran y se piden? | (a) mostrar el entero crudo; (b) convertir con el exponente de la moneda, sin coma flotante | **(b)**: `src/lib/money.ts`, aritmética de cadenas; el exponente sale de `Intl` (CLDR); el donante escribe unidades de la moneda (`50000` o `50000,50`) y se envía el entero en unidades mínimas; más decimales de los que admite la moneda → error de validación; nunca se redondea | El crudo (`5000000` para 50 000 COP) induce a error; la conversión es solo de presentación | Sí | `PENDIENTE DE RATIFICACIÓN` (confirmar que el exponente de CLDR coincide con el que usa el backend para COP) |
| DW-15 | 2026-10-07T18:05Z | Donar | ¿Qué es "mostrar la redirección de pago simulada" y cómo se consulta el estado? | (a) navegar a `paymentRedirectUrl` (`/demo/checkout/sim_…`, ruta relativa sin página); (b) paso en la misma página | **(b)**: se informa de la redirección a la pasarela simulada sin navegar (navegar perdería el `statusToken`, que solo vive en memoria). La confirmación la envía el proveedor por el webhook firmado: **la web nunca dispara el webhook** (exigiría el secreto en el navegador). El estado se consulta con el botón "Consultar estado del pago": sin sondeo automático | Seguridad del secreto del webhook y del `statusToken`. El efectivo no se ofrece (CV-11 lo rechaza) | Sí | `PENDIENTE DE RATIFICACIÓN` |
| DW-16 | 2026-10-07T18:05Z | Donar → Seguimiento | ¿Cómo pasa el `trackingCode` de la donación al seguimiento sin URL? | (a) que el usuario lo copie; (b) variable de módulo en memoria, consumo único | **(b)** además de "Copiar código": "Ver seguimiento" deja el código en memoria y `/tracking` lo consume una vez | Cumple "ningún secreto en la URL" y no persiste nada; recargar lo pierde | Sí | `PENDIENTE DE RATIFICACIÓN` |

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
| Donar, pasarela simulada, estado de la intención y entrega del `trackingCode` | SIN VALIDAR CONTRA PENPOT (sin diseño previo en `diseno-ux`) |
| Estados globales y componentes base | SIN VALIDAR CONTRA PENPOT |
