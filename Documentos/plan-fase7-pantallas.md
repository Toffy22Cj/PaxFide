# Plan de la Fase 7 — Pantallas del estilo v2 (dos pistas en paralelo)

**Estado: PROPUESTO — espera la aprobación de Carlos.**
**Fecha:** 2026-10-23 (UTC).
**Cubre:** VS-3 a VS-8 de `prompts-agentes-estilo-v2.md` §6, más el cierre del tema oscuro.
**Base verificada:** `paxfide-web` `develop` en `a845243` (VS-0 y VS-2 dentro; VS-1 en su PR). Backend `develop` en `0b3dc3e`.

**Qué significa aprobar este documento.** Cada tarea de abajo es su `implementation_plan` (regla 3.4). Con la aprobación de Carlos, el agente implementa la tarea **sin presentar otro plan** y se detiene solo en los casos de §1.4. Todas las decisiones que una tarea necesita están ya en §2: el agente no decide por Carlos.

---

## 1. Reglas comunes a las dos pistas

### 1.1 Antes de empezar
- El PR de VS-1 (`feat/web-motion`) está mergeado en `develop`. Si no lo está, DETENTE.
- Se pega el contexto maestro de `prompts-agentes-estilo-v2.md` §4 y, a continuación, la pista entera (A o B) de este documento.

### 1.2 Ramas y PR
- Una rama y un PR por tarea, hacia `develop`. Nombre: el de cada tarea.
- La tarea siguiente de la misma pista sale de la rama de la anterior (ramas apiladas); su PR dice "depende de #N". Cuando Carlos mergea el anterior, el agente rebasa sobre `develop`, vuelve a correr `ci-local` y actualiza la salida.
- No se mergea nada sin la aprobación de Carlos (regla 3.2).

### 1.3 Propiedad de archivos (para que las pistas no choquen)

| Archivo o carpeta | Dueño | La otra pista |
|---|---|---|
| `src/components/shell/**`, `src/components/nav/**`, `src/lib/nav/**`, `src/app/layout.tsx`, `src/app/RouteGuard.tsx`, `src/lib/routing/enabled-surfaces*.json` | **A** | No los toca. Si los necesita, DETENTE |
| `src/components/background/**` (nuevo) | **A** | No los toca |
| `src/components/ui/**`, `src/components/States.tsx`, `States.module.css` | **B** (tarea B-1) | Los usa; no los cambia |
| `src/app/globals.css` | Nadie | Ningún token nuevo. Si falta uno, DETENTE |
| `src/lib/labels.ts` | Las dos | Solo se **añaden** claves, cada pista en su bloque comentado; al rebasar se juntan |
| `Documentos/decisiones-delegadas-web-fase7.md` | Las dos | Solo se añaden filas; numeración DF7-22 en adelante, la primera pista que mergee se queda el número |

### 1.4 Cuándo DETENERSE (y solo entonces)
1. Un dato que no está en la tabla de campos (§3 de los prompts, actualizada por §4 de este documento).
2. Una ruta, superficie, dependencia o token nuevo que este documento no autoriza.
3. Un archivo del dueño de la otra pista (§1.3).
4. Un par de colores fuera de las tablas de la enmienda.
5. Dos documentos aprobados que dicen cosas distintas.

Cualquier otra elección menor (nombres internos, partición en componentes) se toma y se anota en el PR, no se pregunta.

### 1.5 Definición de terminado de cada tarea
- `scripts/ci-local.sh` 10/10 sobre el último commit con cambios, salida literal en el PR y archivo de evidencia commiteado.
- Capturas en claro (el tema está forzado a claro hasta C-1, DF7-17) a 390 y 1280 px de cada pantalla tocada, en `Documentos/evidencia-web/capturas/`.
- Aserciones negativas para cada dato que la tabla de campos marca ⛔ (el dato no está en el DOM).
- Si el ensayo de la demo (`ensayo/ensayo-conjunto.spec.ts`) pasa por la pantalla tocada, sus selectores se actualizan en la misma tarea (no se corre en `ci-local`; se indica en el PR).
- Las filas de `prompts-agentes-estilo-v2.md` §3 que la tarea toca se actualizan en el mismo PR (de ⛔ a ✅ cuando el backend ya lo da, §4).

---

## 2. Decisiones que este documento fija (Carlos las aprueba con él)

| # | Decisión | Por qué |
|---|---|---|
| D-P1 | La ciudad animada y el mundo de la landing son **ilustraciones**. Sus colores viven en un único archivo por ilustración (`src/components/background/cityPalette.ts`, `src/components/landing/worldPalette.ts`), cada uno con su paleta de día y de noche. El test de hexadecimales (DF7-11) los añade a su lista de excepciones con este motivo, como ya tiene `QrCode.tsx`. Ningún otro archivo de la ilustración lleva hexadecimales | Son decenas de colores de árboles, edificios y vehículos; meterlos como tokens ensuciaría el sistema visual. La regla de contraste no aplica porque no llevan texto encima (R-F1) |
| D-P2 | El fondo animado aparece en `/`, `/home`, `/campaigns`, `/c/:publicCode`, `/tracking` y `/account/donations`. No en `/login`, `/register`, `/invitaciones`, `/assets/**` ni `/panel/**` | Enmienda §3.1: solo pantallas del donante; los formularios de acceso quedan limpios |
| D-P3 | La ciudad no es interactiva: sin "Ver ciudad", sin arrastrar, sin cámara movible. Densidad de píxeles como mucho 1,5 (como el prototipo). Se detiene con la pestaña oculta, con la pausa y con "reducir movimiento" (R-F2 a R-F4) | Rendimiento y foco en el contenido |
| D-P4 | La paleta de noche de la ciudad se usa cuando el tema sea oscuro. Mientras dure el claro forzado (DF7-17) solo se ve la de día; la de noche se prueba en C-1 | R-F6 sin adelantar el oscuro |
| D-P5 | Landing: se usan los textos del recorrido del prototipo **tal cual**, salvo cifras y nombres concretos (montos, "recaudados de $…", organizaciones, ciudades), que se quitan. El seguimiento demostrativo lleva el rótulo "Ejemplo" y no llama a la API | Copy aprobado; ningún dato inventado presentado como real |
| D-P6 | Home: tarjetas "Seguir una donación" (código → `/tracking` por memoria, como hoy), "Sellado en blockchain" (texto del prototipo), "Tus donaciones" (las 3 primeras de `GET /account/donations`), "Convocatorias abiertas" (las 3 primeras de `GET /public/campaigns`). Para quien tiene organización, "Ir a tu organización" (→ `/panel`); sin organización, "¿Tienes una fundación?" (→ `/panel/organization`, donde ya está crear organización); con `platformAuthority`, "Plataforma" (→ `/panel/platform`, cierra DF7-21) | Sin datos de ejemplo; "Cierran pronto" necesita el orden de R-1, que no está en `develop`: el título cambia a "Cierran pronto" cuando R-1 llegue |
| D-P7 | El saludo del home no lleva nombre ni correo | `GET /account/profile` no está implementado; el correo no es un saludo |
| D-P8 | El nombre de la pantalla `/panel` pasa de "Panel" a "Tu organización", igual que la barra | Coherencia con "Organización" en la barra (nota de VS-2) |
| D-P9 | Panel: "Cierra pronto" = convocatoria abierta con `endDate` dentro de los próximos 7 días (calculado en el cliente con la hora del dispositivo) | G-5 ya está en el backend |
| D-P10 | Las tarjetas de convocatoria muestran el logo de la organización (`organizationLogoUrl?`) y la insignia "Verificada" (`organizationVerified`). Sin logo, inicial de la organización sobre `brand-green-50`. `coverImageUrl` no se usa (Tarea 3 de ADR-051 sin hacer) | Campos ya en el backend |
| D-P11 | En "Tus donaciones" se muestran `createdAt`, `organizationName`, `paymentMethod` y el enlace a `/c/:publicCode` solo si llega `publicCode` | Enmienda 5 de ADR-037 ya en el backend |
| D-P12 | El cierre del tema oscuro (retirar DF7-17, montar `ThemeSelect`, capturas en oscuro) es una tarea aparte, C-1, cuando A y B estén mergeadas | Sin pantallas a medias en oscuro |

---

## 3. Estado de la tabla de campos (actualización del 2026-10-23)

Ya están en el backend `develop` y pasan de ⛔ a ✅:

| Hueco | Campo | Fuente |
|---|---|---|
| G-1 | `campaignTitle?` y `organizationName?` en `GET /donations/tracking` | `referencia-api-v1.md` §8, nota del 2026-10-21 |
| G-4b | `assetType` en `GET /organizations/{id}/physical-assets` y en `GET /physical-assets/{assetRef}` | §3 y §6, notas del 2026-10-21 |
| G-5 | `startDate` y `endDate` en `GET /organizations/{id}/campaigns` | §3, nota del 2026-10-21 |
| — | `organizationVerified` y `organizationLogoUrl?` en `GET /public/campaigns` y CV-07 | §5, notas del 18 y 21 de octubre |
| — | `createdAt?`, `confirmedAt?`, `organizationName?`, `paymentMethod`, `publicCode?` en `GET /account/donations` | §1, nota del 2026-10-22 |
| — | `GET /account` → `{email}` | §1 |
| — | `logoUrl?` en `GET /organizations/{id}` | §3, nota del 2026-10-21 |

Siguen ⛔: G-2, G-3, G-4, G-6, G-7, G-8 (R-6 bloques B a D), `coverImageUrl`, `GET /account/profile`, búsqueda y orden del descubrimiento (R-1).

---

## 4. Pista A — Donante (`/`, `/home`, `/tracking`, `/campaigns`, `/c`, `/account/donations`)

### A-1 · VS-3 · `feat/web-animated-background`

**Qué:** la ciudad de `paxfide-home.html` como fondo de las rutas de D-P2.

**Archivos:**
- `src/components/background/CityBackground.tsx` (cliente): el `<canvas>`, el bucle y los controles de pausa.
- `src/components/background/cityScene.ts` (lógica pura): siembra determinista, geografía, vegetación, vehículos; sin DOM, probada en Vitest.
- `src/components/background/cityPalette.ts`: paletas de día y de noche (D-P1).
- `src/components/background/background.module.css`.
- `src/lib/routing/backgroundRoutes.ts` (puro): `hasAnimatedBackground(pathname)` con la lista de D-P2.
- `src/components/shell/Shell.tsx`: monta el fondo cuando `hasAnimatedBackground` es verdadero.

**Comportamiento:**
- Ilustración `aria-hidden`, fuera del orden de foco, detrás del contenido.
- Botón visible "Pausar animación" / "Reanudar animación" en la cabecera fina, junto a "Cerrar sesión" o en su lugar sin sesión; preferencia en `localStorage` con `try/catch` (R-F2).
- Con `prefers-reduced-motion: reduce`: un fotograma estático desde el principio, sin `requestAnimationFrame` (R-F3).
- `visibilitychange`: con la pestaña oculta no hay bucle (R-F4).
- El contenido de esas rutas va sobre superficies sólidas o translúcidas con la opacidad mínima de R-F1. Los campos, siempre sólidos.
- Fuera de alcance: "Ver ciudad", arrastrar, mover la cámara, la hoja de personalización (D-P3).

**Tests:**
- Unitarios: `hasAnimatedBackground` para cada ruta de D-P2 y negativos para `/login`, `/register`, `/panel`, `/panel/campaigns`, `/assets/x`; la siembra produce siempre la misma escena.
- E2E: el canvas existe en `/campaigns` y no existe en `/panel` (negativa); con `reduce`, cero llamadas a `requestAnimationFrame` tras el primer fotograma (se cuentan con un `addInitScript`); la pausa detiene el bucle; con la pestaña oculta, también; el canvas no recibe foco con Tab.
- Hexadecimales: `cityPalette.ts` es la única excepción nueva de DF7-11.

### A-2 · VS-4 · `feat/web-landing`

**Qué:** la landing de `paxfide-landing.html` en `/`.

**Archivos:**
- `src/app/page.tsx` (reemplaza el "Hello world"; borra `src/app/page.test.tsx` y lo sustituye por los tests nuevos).
- `src/screens/LandingScreen.tsx`, `landing.module.css`.
- `src/components/landing/WorldScene.tsx` y `worldPalette.ts`: el mundo del recorrido por scroll (D-P1, mismas reglas R-F que la ciudad).
- `src/components/campaign/CampaignCard.tsx` (nuevo, compartido con A-3 y A-5): tarjeta de convocatoria con logo o inicial, insignia "Verificada", título, organización, barra de recaudado si hay meta y fecha de cierre.
- `enabled-surfaces*.json`: añade `/` en los perfiles de demo y E2E.

**Contenido:** cabecera de la landing, recorrido en cinco paradas con el texto del prototipo (D-P5), sección "Convocatorias abiertas" con `GET /public/campaigns` (las 6 primeras, enlace "Ver todas" → `/campaigns`), llamada a la acción ("Seguir una donación" → `/tracking`, "Donar" → `/campaigns`), pie. Con sesión, la cabecera ofrece "Ir a mi inicio" (→ `/home`, cuando A-3 lo habilite; hasta entonces no aparece).

**Datos:** solo los de §3.3 de los prompts y la fila de §3 de este documento sobre `organizationVerified` y el logo. `organizationName`, `targetAmount` y `clearedAmount` pueden faltar o llegar `null`.

**Tests:** lista vacía; campos opcionales ausentes y `null`; error de red con el texto aprobado; con logo y sin logo (inicial); nunca aparece una convocatoria `PRIVATE_LINK` (servidor falso); ninguna petición a dominios externos; el seguimiento demostrativo lleva "Ejemplo" y no hace ninguna petición; no aparece ningún monto del prototipo (negativa sobre "20.000.000").

### A-3 · VS-5 · `feat/web-donor-home`

**Qué:** el home de `paxfide-home.html` en `/home`.

**Archivos:**
- `src/app/home/page.tsx`, `src/screens/HomeScreen.tsx`, `home.module.css`.
- `src/app/RouteGuard.tsx`: destino por defecto tras iniciar sesión `/home` (si hay un destino guardado, manda ese).
- `enabled-surfaces*.json`: añade `/home`.
- `src/lib/nav/navEntries.ts`: "Inicio" ya está; aparece al habilitar `/home`. Comprobar que el administrador queda en 5 entradas en estrecho (DF7-20).

**Contenido (D-P6, D-P7):** saludo sin nombre, las tarjetas de D-P6 según `GET /me`, el fondo animado detrás (A-1). Fuera: pantallas de entrada y términos, nombre y correo, selector de posición de la barra, ciudad navegable.

**Datos:** `GET /me`, `GET /account/donations` (D-P11), `GET /public/campaigns`. El `trackingCode` de una donación abre el seguimiento por memoria (`lib/tracking/handoff.ts`), nunca por URL.

**Tests:** destino tras login (`/home` por defecto; un destino guardado gana); tarjetas por cuenta (sin organización, con organización, con `platformAuthority`, las tres con negativas cruzadas); "Tus donaciones" vacía; `trackingCode` no aparece en la URL ni en el almacenamiento; la barra a 390 px de un administrador tiene exactamente 5 entradas y caben; DF7-21 pasa a "Resuelta por A-3".

### A-4 · VS-7 · `feat/web-tracking-timeline`

**Qué:** la línea de tiempo de `paxfide-linea-tiempo.html` en `/tracking`.

**Archivos:** `src/screens/TrackingScreen.tsx` (rehecha), `tracking.module.css`, `src/components/tracking/*` (cabecera, carriles, paso, insignia de integridad, código enmascarado), `src/lib/api/tracking.ts` (tipos con `campaignTitle?` y `organizationName?`).

**Contenido:**
- Cabecera: título de la convocatoria y organización si llegan (G-1 ✅), monto y estado. Código de seguimiento según T1-1 a T1-7 (§3.5 de los prompts).
- Un carril por activo de `logistics[]` (lista plana, G-4 ⛔), con pestañas por activo en estrecho.
- Pasos del historial con `custodianLabel()`, `locationZone` o el texto de "sin zona pública".
- Insignia de integridad de la donación (ficha P4) con el árbol de Merkle de VS-1 mientras carga.
- Resumen de IA rotulado, solo con `AVAILABLE`.
- Camión de VS-1 solo si el último evento del activo es `ASSET_DISPATCHED`.
- Fuera: hash y sello por paso (G-3), árbol de sublotes (G-4), fecha del pago (G-2), nombres de lote, destinatarios, "Escuela San José".

**Tests:** los de VS-7 en §6 de los prompts y los de T1 de §3.5, más: con `campaignTitle` y sin él; el camión no está si el último evento no es `ASSET_DISPATCHED` (negativa); 401 del seguimiento sin tocar la sesión.

### A-5 · VS-8a · `feat/web-donor-screens-v2`

**Qué:** pasada de estilo, sin cambiar comportamiento ni contrato, de `/campaigns` (`DiscoveryScreen`), `/c/:publicCode` (`CampaignPublicScreen`, `DonateSection`, `CampaignNarrative`, `TrackingCodeReveal`) y `/account/donations` (`AccountDonationsScreen`).

**Reglas:** tokens semánticos, tipografía de la escala nueva, radios y sombras de la enmienda, `CampaignCard` de A-2, carga con `Skeleton` de VS-1 (las pantallas que adopten un loader añaden su E2E de "reducir movimiento"). `AccountDonationsScreen` muestra los campos de D-P11. Una pantalla por commit.

**Tests:** los existentes siguen en verde sin cambiar su intención (solo selectores); para cada loader adoptado, el E2E con y sin `reduce`.

---

## 5. Pista B — Organización y acceso (`/panel/**`, `/assets/**`, `/login`, `/register`, `/invitaciones`)

### B-1 · `feat/web-ui-primitives-v2`

**Qué:** los componentes compartidos con el estilo v2, antes que cualquier pantalla: `Button` (píldora, primario, secundario, énfasis amarillo), `Field` (radio de control, 16 px mínimo en el campo), `Modal` (superficie elevada, sombra flotante), `Layout`, `Icons`, `States` (`LoadingState` con `Skeleton` o `ChainCubesLoader` según su variante; `ErrorState`, `EmptyState` y los estados ambiguo, éxito, información y error con icono y texto).

**Reglas:** solo tokens semánticos; ninguna API pública de los componentes cambia (las mismas props); si una pantalla depende de un estilo que desaparece, se ajusta su CSS en este mismo PR.

**Tests:** los existentes de `states.test.tsx` y de las pantallas siguen en verde; nuevo: cada estado lleva icono y texto (negativa: ningún estado solo por color); el ambiguo nunca usa los tokens de error; el campo de formulario mide al menos 16 px de texto; E2E de "reducir movimiento" sobre `LoadingState`.

### B-2 · VS-6 · `feat/web-panel-v2`

**Qué:** el inicio del panel (`/panel`, `PanelHomeScreen`) con `paxfide-panel.html`.

**Contenido:** título "Tu organización" (D-P8) y, si el rol lo permite, el nombre y el logo (`logoUrl?`); KPI de convocatorias abiertas (`ADMINISTRATOR`), recaudado total por moneda y lotes por despachar; pendientes (convocatoria sin empleado, fondos con `availableAmount > 0`, comandos ambiguos de la sesión); tabla de convocatorias con estado, %, recaudado, meta, cierre y "Cierra pronto" (D-P9); tabla de lotes con tipo (G-4b ✅), cantidad, estado y ubicación; los enlaces actuales a las demás secciones del panel siguen. Fondo estático.

**Fuera:** actividad reciente (G-8), KPI de integridad (G-7), recaudado por mes (G-6), fechas de los lotes.

**Tests:** los de VS-6 de §6 de los prompts, más "Cierra pronto" en el límite de 7 días (dentro y fuera) y lotes con y sin `assetType`.

### B-3 · VS-8b · `feat/web-panel-screens-v2`

**Qué:** pasada de estilo, sin cambiar comportamiento ni contrato, de `/panel/campaigns`, `/panel/prediction` (incluido el borde de `PredictionCharts`, que deja de ser excepción de DF7-11), `/panel/funds`, `/panel/assets` y `/assets/:assetRef` (incluidos `AssetActions`, `CommandModal`, `RegisterAssetForm`, `SplitProgress`), `/panel/configuration`, `/panel/members`, `/panel/my-campaigns`, `/panel/organization` (incluido `CreateCampaignForm`), `/panel/platform`.

**Reglas:** como A-5; una pantalla por commit; `QrCode.tsx` conserva su excepción (el QR necesita contraste fijo).

### B-4 · VS-8c · `feat/web-access-screens-v2`

**Qué:** `/login`, `/register` y `/invitaciones` con el estilo v2: superficie centrada, marca, campos de B-1, botón con puntos de marca. Sin fondo animado (D-P2). Sin cambios de comportamiento.

---

## 6. Tarea final común

### C-1 · `feat/web-dark-mode-on`

**Cuándo:** con A-5, B-3 y B-4 mergeadas. La hace un solo agente.

**Qué:**
- Retirar el `data-theme="light"` fijo (DF7-17).
- Volver a poner el script de preferencia de tema en `<head>` (el que se quitó en VS-2) y montar `ThemeSelect` en el hueco de la cabecera (DF7-10).
- Paleta de noche de la ciudad y del mundo de la landing (D-P4).
- Si quedan tokens de v1 sin uso (`--text-sm/md/lg/xl` y otros), listarlos y borrarlos solo si ningún archivo los usa.

**Evidencia:** capturas en **claro y oscuro** a 390 y 1280 px de todas las pantallas, E2E de tema (sistema oscuro → oscuro; `data-theme` forzado; preferencia guardada antes de pintar), y búsqueda de pares fuera de tabla: un test que recorra las pantallas en oscuro y falle si algún texto tiene contraste < 4,5 (axe no está permitido como dependencia: se calcula con la fórmula del Anexo A sobre los estilos calculados).

---

## 7. Orden y paralelismo

```
develop (con VS-1)
   │
   ├── Pista A:  A-1 → A-2 → A-3 → A-4 → A-5
   │
   └── Pista B:  B-1 → B-2 → B-3 → B-4
                              │
          (A y B mergeadas) ──┴──→ C-1
```

- A y B no comparten archivos fuera de lo que permite §1.3.
- A-2 y A-5 usan los componentes de B-1 cuando estén en `develop`; mientras tanto usan los actuales y heredan el estilo nuevo al rebasar.
- Estimación de PR: 5 de la pista A, 4 de la pista B, 1 común.
