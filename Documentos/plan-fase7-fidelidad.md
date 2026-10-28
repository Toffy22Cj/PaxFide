# Plan de la Fase 7 — Fidelidad a los bocetos

**Estado: APROBADO — Carlos, 2026-10-24.** Todas las decisiones están tomadas (§2 y §6). Lo que depende del backend está en §5b y no empieza hasta que su PR esté en `develop`.
**Fecha:** 2026-10-24 (UTC).
**Base verificada:** `paxfide-web` `develop` en `bd099a3`, con A-1 a A-5 y B-1 a B-4 mergeadas (PR #33 a #40). C-1 sin hacer. Backend `develop` en `0b3dc3e`.
**Bocetos:** `Documentos/paxfide-landing.html`, `paxfide-home.html`, `paxfide-panel.html`, `paxfide-linea-tiempo.html` y `paxfide-movimiento.html` (versiones del 2026-10-20). `paxfide-pantallas-web.html` son los bocetos de Manuel y **no** entran en este plan (§7).
**Relación con otros documentos:** cambia D-P2, D-P3, D-P4 y D-P12 de `plan-fase7-pantallas.md` (§2), §3.1 y §8 de la enmienda 1 del sistema visual, y las listas de "Fuera" de VS-4 y VS-5 de `prompts-agentes-estilo-v2.md` §6. El resto de esos documentos sigue en vigor, en especial la tabla de campos (§3 de los prompts), D2, D3, D5, D6 y D8.

**Qué significa aprobarlo.** Igual que el plan de pantallas: cada tarea de §4 y §5 es su `implementation_plan` (regla 3.4). El agente implementa sin presentar otro plan y se detiene solo en los casos de `plan-fase7-pantallas.md` §1.4.

---

## 0. Por qué existe este plan

Carlos revisó el resultado en `localhost:3000` el 2026-10-23 y pidió el front lo más completo posible y fiel a los bocetos. La revisión encontró dos tipos de diferencia:

1. **Recortes que vienen de los documentos, no de los agentes.** `plan-fase7-pantallas.md` dejó fuera el ciclo día/noche (D-P4), la ciudad navegable y "Ver ciudad" (D-P3), el fondo en el acceso (D-P2) y las transiciones entre rutas (prompts, VS-1). Los agentes cumplieron esas reglas, y además citaron R-F5 para quitar el día/noche que sigue al scroll. Esa lectura de R-F5 era más estricta de lo necesario: el ciclo no comunica ningún estado (§2, D-F2).
2. **Fallos de implementación:**
   - En la landing, el botón "Pausar animación" se monta encima de "Donar" (captura del 2026-10-23, 1786 px de ancho).
   - El login y el registro no se parecen al boceto: el acceso del boceto es una tarjeta sobre el mundo de la landing.
   - El panel muestra un bloque "Secciones del panel" que el boceto no tiene.
   - Con la cuenta de demostración del representante, el panel muestra "Tu organización" con la inicial "O" en lugar del nombre. Puede ser que el representante no lea la organización: hay que comprobarlo (F-B1).

Desde ahora, **nada del boceto se quita sin estar en la tabla de desviaciones (§3)**, y cada tarea lo demuestra con un inventario y capturas lado a lado (§1).

---

## 1. Regla de fidelidad y definición de terminado

**D-F1 (Carlos, 2026-10-24): el boceto es el contrato visual y de interacción.** Se implementa todo lo que se ve y todo lo que se mueve en el boceto: composición, bloques y su orden, iconos, ilustraciones, etiquetas, animaciones, transiciones, estados vacíos y versión estrecha. Solo hay tres motivos para no implementar algo:

| Motivo | Ejemplo | Qué se hace |
|---|---|---|
| El dato no está en el contrato (tabla de campos, §3 de los prompts) | Nombre de la persona, hash por paso | Se omite el dato. El bloque se queda si tiene sentido sin él |
| Una regla aprobada lo impide | "Recordarme" (D2), Google Fonts | Se omite |
| Es una herramienta del boceto, no de la app | Botón "DEMO", "Escenario: Multi-Activo" | Se omite |

**Todo lo que se omite está en §3, con su motivo.** Si el agente encuentra algo que no está en §3 y cree que no se puede hacer, se DETIENE (caso 5 de §1.4 del plan de pantallas). No lo recorta por su cuenta.

Lo que **no** cambia de la regla de los prompts (§2): los colores salen de tokens, los datos y los textos de estado del contrato y de `labels.ts`, y las duraciones del token más cercano (§7 de la enmienda). Las duraciones del boceto se redondean al token: 350 ms → `--duration-normal`; 180 ms → `--duration-fast`.

**Definición de terminado de cada tarea de este plan.** Es la de `plan-fase7-pantallas.md` §1.5, más estos cuatro puntos:

1. **Inventario de fidelidad en el PR.** Una tabla con cada elemento visible o animado del boceto en esa pantalla, en el orden del boceto. Cada fila marca "✅ implementado" o el número de su desviación de §3. Una fila sin ninguna de las dos marcas significa que la tarea no está terminada.
2. **Capturas lado a lado** del boceto y de la app, en el mismo estado y al mismo ancho (390 y 1280 px), en claro y en oscuro, en `Documentos/evidencia-web/capturas/fidelidad/<pantalla>/`. Las saca un script nuevo, `scripts/capturas-fidelidad.mjs`, con la Playwright que ya está en el repo (no es una dependencia nueva). Abre el boceto como `file://` sin red, y la app contra el servidor falso.
3. **E2E de cada animación del inventario:**
   - sin "reducir movimiento", la animación corre; se comprueba en el resultado (una propiedad calculada que cambia, o el fotograma del canvas que cambia), no en la clase CSS;
   - con `reduce`, no corre (aserción negativa).
4. **Ninguna superposición:** en las pantallas tocadas, a 390, 1280 y 1920 px, `elementFromPoint` en el centro de cada control interactivo devuelve ese mismo control.

---

## 2. Decisiones

| # | Decisión | Cambia |
|---|---|---|
| D-F1 | Regla de fidelidad (§1) | Prompts §2: "referencia visual" pasa a "contrato visual y de interacción", con las mismas excepciones de datos y colores |
| D-F2 | **Día y noche (Carlos, 2026-10-24: "incluye todo").** **Landing y acceso:** control con tres modos, igual que el boceto: "Auto" (sigue el recorrido con la curva `getAutoNight` del boceto: día en la parada 1, ocaso, noche en la 4, vuelta al día en la 5), "Noche" y "Día". Está en la cabecera de la landing, en su menú estrecho y en la barra superior del acceso. La elección se guarda en el navegador (`localStorage` con `try/catch`, clave `paxfide.world-mode`), solo como comodidad. Cuando la mezcla de noche pasa de 0,5, las superficies de la landing y del acceso usan los tokens oscuros: el contenedor raíz de la landing lleva `data-theme="dark"`. **Resto de la app (la ciudad):** la ciudad sigue el tema de la app (Sistema, Claro u Oscuro), como `isNightMode` del boceto. Eso exige activar el tema oscuro ya (D-F11). **R-F5 no lo impide:** el ciclo no dice nada sobre una donación. En la landing es la historia ilustrada con datos de ejemplo, no el fondo de un dato real | D-P4 |
| D-F3 | **La ciudad navegable (revoca D-P3).** Cada ruta con ciudad tiene su distrito, y al cambiar de ruta la cámara vuela hasta él (`setDistrict` del boceto, con `--duration-slow` y `--ease-in-out`). Arriba a la izquierda va la píldora del boceto ("Sector: <distrito> · <tipo>") con el botón **"Ver ciudad"**. Ese botón oculta el contenido (`inert` y sin foco), deja ver la ciudad entera y cambia a **"Mostrar panel"** para volver. Encima de los edificios, las etiquetas de distrito (texto en una píldora sólida dentro del canvas, `aria-hidden`). Sigue sin poder arrastrarse la cámara (el boceto tampoco lo permite). Con `reduce`, la cámara salta sin volar. La densidad de píxeles se mantiene en 1,5 como máximo | D-P3 |
| D-F4 | **Etiquetas genéricas (Carlos, 2026-10-24).** Mismas etiquetas y en el mismo sitio que el boceto, sin cifras y sin lugares reales. La tabla de textos está en §2.1 | D-P5 (lo amplía a las etiquetas) |
| D-F5 | **El acceso sobre el mundo (cambia D-P2).** `/login`, `/register` e `/invitaciones` se pintan como la vista de acceso del boceto: el mundo de la landing detrás (en la vista panorámica, quieto salvo nubes y vehículos, con la pausa de R-F2), sin la estructura de la app (`hasAppChrome` es falso en esas tres rutas), con la barra del boceto ("Volver al recorrido" → `/`, la marca, el control día/noche y el botón de pausa) y la tarjeta de acceso al centro. Entre `/login` y `/register` se cambia con las pestañas "Iniciar sesión" y "Crear cuenta" del boceto. Cada pestaña es un enlace a su ruta, y la tarjeta entra con `authCardEnter` (`--duration-normal`, `--ease-out`). R-F1 se cumple: la tarjeta es translúcida con la opacidad mínima y los campos son sólidos | D-P2; enmienda §3.1 (el fondo animado ya no es "solo pantallas del donante": también el acceso. La parte administrativa sigue sin fondo, R-F7) |
| D-F6 | **Entrada suave entre rutas (Carlos, 2026-10-24, D-P14).** El contenedor del contenido entra con `viewIn` del boceto: opacidad 0 → 1 y `translateY(8px)` → 0, `--duration-normal`, `--ease-out`. Dentro de `/panel/**` y `/assets/**` es solo un fundido, `pnIn` del boceto, con `--duration-fast`. Se hace solo con CSS en `Shell`. No vuelve a montar la cabecera, la barra ni el fondo, solo el contenido. No retrasa la navegación ni las peticiones. Con `reduce`, no hay transición | Prompts VS-1 ("transiciones entre rutas fuera") |
| D-F7 | **El portal del panel.** Al pasar de una ruta con ciudad a `/panel/**` o `/assets/**` se reproduce la secuencia del boceto (`enterPanel`): (1) la cámara se acerca al distrito de la organización (`calc(2 * var(--duration-normal))`); (2) un círculo verde se abre desde el edificio (`clip-path`, degradado radial de `brand-green-700` a `brand-green-900`, `calc(2 * var(--duration-normal))`) y detrás el fondo del panel (`--color-bg`), con un desfase de `--duration-normal`; (3) un fundido corto. Al volver a una ruta con ciudad se reproduce al revés (`exitPanel`). La navegación y las peticiones no esperan a la animación: es una capa encima. Con `reduce`, no hay portal. No se reproduce si la ruta anterior no tenía ciudad (por ejemplo, un enlace directo a `/panel`) | Nueva |
| D-F8 | **Barra en cuatro posiciones (Carlos, 2026-10-24).** Botón "Barra" al final de la barra, como en el boceto. Abre la hoja "Personalizar" con Arriba, Abajo, Izquierda y Derecha (`radiogroup`, flechas del teclado, Escape cierra y el foco vuelve al botón). La elección se guarda en el navegador (`paxfide.nav-position`, `try/catch`). Sin elección, la posición depende del ancho, como hoy. **El selector solo está en escritorio (≥ 768 px):** en estrecho la barra sigue abajo, como dice la enmienda §8 ("sin cambio, alcanzable con una mano"), y DF7-20 sigue en vigor (5 entradas como mucho). `data-nav-position` pasa a admitir `left`, `right`, `top` y `bottom` (`side` = `left`) | Enmienda §8 (la fase 2 se adelanta); prompts §3.3 (el selector pasa de ⛔ a ✅) |
| D-F9 | **Perfil en `/account` (Carlos, 2026-10-24).** Superficie nueva `/account`, con sesión, y entrada "Perfil" en la barra para cualquier cuenta (`routeFor('perfil')` → `/account`). Contenido según `vProfile` del boceto: cabecera "Perfil" con el correo (`GET /account`) y un icono de persona en lugar de iniciales (no hay nombre). La tarjeta **"Tus datos"** lleva solo el correo. La tarjeta **"Apariencia y ciudad"** lleva Tema (`ThemeSelect`), Barra de navegación (D-F8) y Animación (pausar o reanudar, la misma preferencia de R-F2). Al final, "Cerrar sesión". La tarjeta "Seguridad" del boceto no aparece mientras no exista cambiar contraseña (plan R-3+R-2 sin aprobar): nada de "Próximamente" (D5). En estrecho, ver P-F2 | D5 (ruta nueva aprobada por Carlos) |
| D-F10 | **Bienvenida.** Las tres diapositivas "Te damos la bienvenida a PaxFide" del boceto (cubos encadenados, tres puntos, "Continuar") se muestran **una vez, en el primer inicio de sesión tras crear la cuenta en esa pestaña**. El aviso se guarda en memoria al terminar el registro (como el `trackingCode`), así que no se guarda nada en el navegador. "Continuar" lleva a `/home`. La pantalla "¿Cómo te llamamos?" no se hace (⏳ ADR-050), y tampoco la de términos (⏳ R-5) | Prompts §3.3 ("pantallas de entrada" pasan de ⏳ a ✅ parcial) |
| D-F11 | **El tema oscuro se activa ya (cambia D-P12).** C-1 pasa a ser la primera tarea de la pista A (F-A0). Además de lo que dice C-1, los selectores de tema de `globals.css` funcionan en cualquier elemento, no solo en `<html>`. `[data-theme="dark"]` y `[data-theme="light"]` sobre un contenedor redefinen los tokens semánticos dentro de él. Es lo que necesita D-F2. Esta tarea es la única que toca `globals.css`, y no añade ningún token | D-P12; plan de pantallas §1.3 (globals.css: "nadie" salvo F-A0) |
| D-F12 | **Los bloques del boceto con datos reales.** Donde el boceto pone cifras de ejemplo y el contrato tiene el dato, se usa el dato real sin el rótulo "Datos de ejemplo". Ejemplos: "Tu organización hoy" en el home, los KPI del panel y "Cierran pronto". **"Cierran pronto" ya no espera a R-1:** se calcula en el cliente con `endDate` sobre la página que ya llega de `GET /public/campaigns` (D-P9: 7 días o menos, de menos a más días). Si no hay ninguna, el bloque dice "Convocatorias abiertas" con las 3 primeras | D-P6 |
| D-F14 | **Cómo registrar una organización (Carlos, 2026-10-24; resuelve P-F1).** El registro **no** pregunta "¿Cómo participarás?" ni ofrece registrar una organización. Debajo del formulario de "Crear cuenta" va una nota plegable, **"¿Representas una fundación?"**, que explica el camino paso a paso con los pasos reales de hoy: 1) crea tu cuenta aquí, como cualquier donante; 2) inicia sesión; 3) en Inicio, en la tarjeta "¿Tienes una fundación?", pulsa "Registrar organización" y llena sus datos; 4) la plataforma la revisa (estado "Pendiente de verificación"); puede pedirte más información; 5) cuando esté "Verificada", puedes crear convocatorias. La misma explicación, en versión corta, va en la tarjeta "¿Tienes una fundación?" del home. Los nombres de estado salen de `labels.ts` (`verificationStatusLabel`). Es texto: no envía nada al backend | P-F1; X-7 |
| D-F15 | **Barra estrecha con "Perfil" (Carlos, 2026-10-24; resuelve P-F2).** En < 768 px, para las cuentas con organización, "Donaciones" y "Seguimiento" se combinan en una sola entrada "Donaciones" (→ `/account/donations`), que queda activa en `/account/donations` y en `/tracking`. Arriba de "Tus donaciones" va el enlace "Seguir con un código" (→ `/tracking`). La barra queda en 5: Inicio, Explorar, Donaciones, Organización, Perfil. Las cuentas sin organización ya caben (Inicio, Explorar, Donaciones, Seguimiento, Perfil) y no cambian. En escritorio no se combina nada. Es la web en un ancho estrecho, no la app móvil | DF7-20 (la cumple) |
| D-F16 | **Lo que espera al backend sí entra (Carlos, 2026-10-24).** Recuperar y cambiar la contraseña, desactivar la cuenta, el nombre (paso 2 de ADR-050 D1: la pantalla "¿Cómo te llamamos?" del boceto y el Perfil), las dos casillas legales del registro, el hash con su prueba de Merkle por paso, la fecha del pago, el árbol de sublotes y la fecha del último cambio de cada lote. Primero los hace el backend (Manuel, con delegación de Carlos: ADR-050 R-3+R-2, R-4, R-5+D1, ficha R-6 y su Enmienda 1). La web los añade en las tareas de §5b cuando cada PR del backend esté en `develop`, nunca antes (opción (a) de P-F3) | X-3, X-4, X-5, X-8, X-9, X-13, X-14, X-15 pasan de "se omite" a "llega con §5b" |
| D-F17 | **Textos legales (Carlos, 2026-10-24).** El agente redacta un borrador académico, versión `v1-2026-10`, de los tres textos de ADR-050 D2: términos y condiciones, autorización de tratamiento de datos (Ley 1581) y términos de organización (`Documentos/legal/`). Se publican en rutas públicas nuevas: `/terminos`, `/privacidad` y `/terminos-organizacion` (superficies nuevas aprobadas por Carlos). La versión de cada texto es la misma cadena que el backend pone en `traceability.legal.*-version`. **Son un borrador académico, no asesoría legal:** el equipo los revisa antes de la demo | ADR-050 D2 |
| D-F13 | **El panel sin "Secciones del panel".** El boceto no tiene ese bloque: a las secciones se llega por la barra. Para el representante, que no lee convocatorias, fondos ni lotes, el panel muestra la cabecera de la organización, su estado de verificación y "Por hacer" vacío con el texto aprobado | B-2 |

### 2.1 Textos de las etiquetas (D-F4)

**Mundo de la landing** (`worldDraw.ts`):

| Boceto | Va |
|---|---|
| Pasarela de pago | Pasarela de pago |
| Donar (sobre el teléfono) | Donar |
| Fondo de la convocatoria | Fondo de la convocatoria |
| Lote · 120 kits · QR | Lote · QR |
| Bodega Montería | Bodega |
| 100 kits (caja) | — (la caja sin etiqueta) |
| Lote dividido | Lote dividido |
| 60 kits / 40 kits | Sublote / Sublote |
| Ruta a Lorica | Ruta de entrega |
| Cereté | — (se quita) |
| Lote 142 · raíz anclada | Raíz anclada |
| Anclaje en blockchain | Anclaje en blockchain |
| Entrega confirmada | Entrega confirmada |
| Centro comunitario · Lorica | Centro comunitario |

**Distritos de la ciudad** (`cityScene.ts`; píldora "Sector" y etiquetas):

| Clave del boceto | Ruta de la app | Nombre · tipo |
|---|---|---|
| `welcome` | (vista panorámica, "Ver ciudad") | Ciudad PaxFide · Panorama |
| `home` | `/home` | Plaza central · Centro cívico |
| `explore` | `/campaigns`, `/c/:publicCode` | Barrio escolar · Causas y educación |
| `donations` | `/account/donations` | Ronda del río · Impacto |
| `track` | `/tracking` | Hub de trazabilidad · Anclaje |
| `org` | origen del portal hacia `/panel/**` (D-F7) | Sede de organizaciones · Organizaciones |
| `assets` | origen del portal hacia `/assets/**` (D-F7) | Bodega de lotes · Logística |
| `profile` | `/account` | Barrio residencial · Tu perfil |

---

## 3. Desviaciones aprobadas (lo único que no se implementa)

| # | Boceto | Pantalla | Motivo |
|---|---|---|---|
| X-1 | Botones "Google" y "Billetera Web3", y el separador "o continúa con correo electrónico" | Acceso | **Carlos, 2026-10-24: se quitan de la web.** El backend de Google (ADR-050 R-6) sigue como última prioridad; si llega, volver a poner el botón es una decisión nueva de Carlos. La billetera no tiene diseño |
| X-2 | "Recordarme en este navegador" | Acceso | D2: la sesión vive solo en memoria |
| X-3 | "¿Olvidaste tu contraseña?" (recuperarla por correo sin haber iniciado sesión) | Acceso | ✅ Implementado en P-1 de `plan-fase7-puesta-al-dia.md` (`/recuperar`). En el boceto el enlace solo muestra un aviso de demostración |
| X-4 | "Nombre completo u Organización" en el formulario de registro | Registro | El nombre **no** va en el registro: ADR-050 D1 lo pone en un paso 2 opcional ("¿Cómo te llamamos?" y Perfil, F-C1). "u Organización" no se usa nunca (D-F14) |
| X-5 | "Acepto los Términos de Transparencia y la Política de Privacidad" | Registro | ⏳ Llega con F-C1 tras ADR-050 R-5: dos casillas separadas (términos y autorización de datos, D2) con enlaces a `/terminos` y `/privacidad` (D-F17) |
| X-6 | "Mínimo 8 caracteres" | Registro | El backend exige 12 (`PasswordTooShort`). El medidor de seguridad del boceto se mantiene, con 12 como mínimo |
| X-7 | "¿Cómo participarás?" (Donante / Organización) | Registro | **Carlos, 2026-10-24:** no va; en su lugar, la nota de D-F14 |
| X-8 | Nombre y apellido en el saludo, iniciales, "Completa tu perfil" y "¿Cómo te llamamos?" | Home, Perfil | ✅ Implementado en P-1 de `plan-fase7-puesta-al-dia.md`. Sin `givenName`, D-P7. Ver X-20 y X-21 |
| X-9 | Tarjeta "Seguridad y criptografía" (cambiar contraseña, desactivar cuenta) | Perfil | ✅ Implementado en P-1 de `plan-fase7-puesta-al-dia.md`, con el título "Seguridad" (ver X-22) |
| X-10 | Cifras, organizaciones, lugares y fechas de ejemplo | Todas | §3 de los prompts y D-P5. Las etiquetas, según §2.1 |
| X-11 | Filtros por causa ("Nutrición", "Agua limpia"…) y búsqueda | Landing | ⏳ R-1 |
| X-12 | Las 17 variantes de tarjeta de convocatoria | Landing | Son un muestrario del boceto: se usa la variante 01 (la "unificada clásica"), que es `CampaignCard` |
| X-13 | KPI "Integridad", "Actividad reciente" y "Recaudado en octubre" (pasa a "Recaudado" total) | Panel | ⏳ Llegan con F-C3 tras la ficha R-6, bloques B (G-6) y D (G-7, G-8) |
| X-14 | Columna "Último cambio" de la tabla de lotes del panel | Panel | ⏳ Llega con F-C3 tras la Enmienda 1 de la ficha R-6 (G-9). "Desde hace más de 3 días" se calcula entonces en el cliente. **Las fechas de cada paso del seguimiento ya se muestran** (`history[].timestamp`) |
| X-15 | Hash por paso ("Huella criptográfica"), "Anclado en blockchain (Merkle)" por paso, fecha del pago, sublotes como árbol | Seguimiento | ⏳ Llegan con F-C2 tras la ficha R-6 bloques B (G-2) y C (G-4, G-3) y su Enmienda 1 (hash y prueba de Merkle). **Nunca:** el nombre del lote y el destinatario (privacidad) |
| X-16 | Selector "Escenario" y "Recorrido en vivo" | Seguimiento | Herramienta del boceto |
| X-17 | Botón "DEMO" y cambio de rol | Home, Panel | Herramienta del boceto |
| X-18 | "Escanear QR" y "Despachar o recibir" como acción | Home, Panel | ⛔ lector QR sin decidir. La tarjeta rápida "Despachar o recibir" se queda con el texto del boceto "Escanea el QR en la app", sin enlace |
| X-19 | Fuentes de Google | Todas | Fuentes autoalojadas (enmienda §6) |
| X-20 | Aviso "Completa tu perfil" en amarillo, con botón amarillo y entrada animada (`rise`) | Home | **Propuesta de P-1, pendiente de Carlos.** En la web el amarillo significa "ambiguo" (D6), así que el aviso usa los tokens informativos (azul) y el botón de acción. No se anima: no responde a nada que haya pasado |
| X-21 | "Ahora no" en "¿Cómo te llamamos?" | Acceso | **Propuesta de P-1, pendiente de Carlos.** El plan aprobado (P-1 y F-C1) dice "Más tarde" |
| X-22 | Título "Seguridad y Criptografía" y el texto "están en el kit (M-27, M-30)" | Perfil | **Propuesta de P-1, pendiente de Carlos.** El plan aprobado la llama "Seguridad", y la tarjeta no tiene nada de criptografía. El texto del kit es una nota del boceto |

---

## 4. Pista A — Donante, acceso, estructura y tema

Ramas apiladas, igual que en el plan de pantallas (§1.2). La pista A pasa a ser dueña de `src/screens/LoginScreen.tsx`, `RegisterScreen.tsx`, `InvitationScreen.tsx` y `access.module.css`, porque dependen del mundo y de la estructura. La pista B no los toca.

### F-A0 · `feat/web-dark-mode-on` (C-1 + D-F11)

Lo que dice C-1 en `plan-fase7-pantallas.md` §6, más:
- **Selectores de tema por contenedor (D-F11):** la definición actual de `:root` sirve también para `[data-theme="dark"]` en cualquier elemento, y la clara para `[data-theme="light"]`. Test: un contenedor con `data-theme="dark"` dentro de una página clara calcula `--color-text` = `dark-text`, y al revés.
- **`ThemeSelect`** en el hueco de la cabecera fina (DF7-10) y en Perfil cuando exista (F-A3).
- **La ciudad y el mundo toman la paleta de noche** según el tema (el mundo de la landing, según D-F2 en F-A1).
- **Captura en claro y en oscuro de todas las pantallas** (390 y 1280 px) y la prueba de contraste de C-1 en oscuro.

### F-A1 · `feat/web-landing-fidelity`

- **Fallo de superposición:** el botón de pausa ocupa su propio sitio en la fila de la cabecera, en todos los anchos. Prueba de §1.4 a 390, 1100, 1280, 1400 y 1920 px.
- **Día y noche (D-F2):** control Auto/Noche/Día con los textos del boceto (`updateThemeUI`): "Auto (Día)" por debajo de 0,3 de noche, "Auto (Ocaso)" entre 0,3 y 0,7, "Auto (Noche)" desde 0,7, y "Noche" o "Día" en modo fijo. El icono (sol, ocaso, luna) va en SVG, no en emoji. Pruebas:
  - E2E en Auto: el modo cambia al bajar a la parada 4, y la raíz de la landing lleva `data-theme="dark"`;
  - con "Día", la raíz no lleva `data-theme="dark"` (negativa);
  - la elección se mantiene al recargar;
  - con `reduce`, el cambio es inmediato, sin mezcla animada.
- **Etiquetas del mapa (§2.1):** test de que no aparece ninguna cifra ni ningún lugar real; se comprueba sobre los textos que pasan al dibujo.
- **Recorrido por scroll:** la cámara, el camión y las tarjetas de cada parada, como el boceto (`camera`, `readScroll`). Pruebas:
  - E2E sin `reduce`: al bajar de la parada 1 a la 2, cambia el fotograma del canvas (se comparan píxeles de una zona) y cambia el texto "0N / 05";
  - con `reduce`: los mismos cambios, sin animación intermedia.
- **Revisión de la vista panorámica, el seguimiento demostrativo, el menú estrecho y el pie** contra el boceto (inventario de §1).
- Comprobar que la nube no tapa la tarjeta de texto (R-F1). En el boceto, `calcCloudExclusionFade` las desvanece.

### F-A2 · `feat/web-access-fidelity` (D-F5, D-F10)

- `/login`, `/register` e `/invitaciones` sin la estructura de la app (`hasAppChrome`), con el mundo de la landing detrás y la barra del acceso del boceto.
- Tarjeta del boceto:
  - píldora "TU CUENTA PAXFIDE", título, subtítulo del boceto;
  - pestañas "Iniciar sesión" / "Crear cuenta";
  - campos con icono, "Mostrar" con el ojo, botón con flecha y pie "¿No tienes una cuenta aún? Regístrate gratis" (o "¿Ya tienes cuenta? Inicia sesión");
  - en el registro, el medidor de seguridad de la contraseña (`checkPassStrength`, mínimo 12, X-6);
  - mensajes con `feedbackSlide`;
  - modo noche de la tarjeta con D-F2.
- Desviaciones X-1 a X-7. Rutas públicas `/terminos`, `/privacidad` y `/terminos-organizacion` (D-F17) con los textos de `Documentos/legal/` (versión visible arriba), sin estructura de la app y con la misma barra del acceso. Las casillas que enlazan a ellas llegan con F-C1.
- Nota "¿Representas una fundación?" de D-F14 bajo el formulario de registro (plegable, con `<details>`/`<summary>` o botón con `aria-expanded`), y su versión corta en la tarjeta "¿Tienes una fundación?" del home (F-A4).
- Test de D-F14: en `/register` no existe ningún control para elegir donante u organización ni enlace a `/panel/organization` (negativa); la nota contiene los cinco pasos.
- `/invitaciones`: la misma tarjeta, con el texto de aceptación actual.
- Bienvenida de D-F10.
- Tests:
  - los actuales de login y registro siguen en verde (solo cambian los selectores);
  - el mismo 401 sigue mostrando un único texto (ADR-038 §2.6);
  - con 11 caracteres, el registro avisa antes de enviar;
  - la bienvenida sale tras registrarse e iniciar sesión, y no sale en un inicio de sesión normal (negativa);
  - en `/login` no existe `nav[aria-label="Principal"]` (negativa);
  - el ensayo de la demo actualiza sus selectores.

### F-A3 · `feat/web-shell-fidelity` (D-F3, D-F6, D-F7, D-F8, D-F9)

- **Ciudad navegable (D-F3):** distrito por ruta (§2.1), vuelo de cámara, píldora "Sector", "Ver ciudad" / "Mostrar panel" con `inert`, etiquetas de distrito.
- **Entrada suave entre rutas (D-F6).**
- **Portal del panel (D-F7).**
- **Barra en cuatro posiciones (D-F8):** el orden del foco es el mismo en las cuatro posiciones.
- **`/account` (D-F9):**
  - `enabled-surfaces*.json`;
  - `src/app/account/page.tsx` y `src/screens/ProfileScreen.tsx`;
  - entrada "Perfil";
  - en estrecho, D-F15: para las cuentas con organización, "Donaciones" y "Seguimiento" son una sola entrada; enlace "Seguir con un código" en `/account/donations`. Test: un administrador a 390 px tiene exactamente Inicio, Explorar, Donaciones, Organización y Perfil, y "Donaciones" queda activa en `/tracking`; una cuenta sin organización mantiene "Seguimiento" (negativa cruzada).
- **Tests:**
  - E2E del vuelo: la cámara cambia de distrito al ir de `/home` a `/tracking`; con `reduce`, salta;
  - "Ver ciudad": el contenido queda `inert` y "Mostrar panel" lo devuelve;
  - el portal aparece al ir de `/home` a `/panel` y no aparece en un enlace directo a `/panel` (negativa);
  - la entrada suave corre y con `reduce` no;
  - posición de la barra guardada y aplicada antes de pintar, sin parpadeo; test con la posición guardada en "Arriba";
  - `/account` muestra el correo y no muestra nombre ni "Seguridad" (negativas).

### F-A4 · `feat/web-home-fidelity` (D-F12)

- Rejilla de `vHome` del boceto, en su orden:
  - "Seguir una donación" (la tarjeta grande, con el campo y "Ver ruta" en amarillo);
  - "Sellado en blockchain" con su árbol;
  - para quien tiene organización, "Tu organización hoy", con los KPI reales que puede leer su rol (§3.2 de los prompts) y las tarjetas rápidas "Registrar lote" (→ `/panel/assets`) y "Despachar o recibir" (X-18);
  - "Cierran pronto" (D-F12);
  - "Tus donaciones";
  - las tarjetas de cuenta de D-P6.
- Entrada escalonada `rise` de las tarjetas (`--duration-normal`, desfase de `--duration-fast` entre una tarjeta y la siguiente, como `.feats` del boceto (150 ms)). Con `reduce`, sin animación.
- Tests de D-F12: con una convocatoria a 3 días y otra a 20, el bloque se llama "Cierran pronto" y solo trae la de 3; sin ninguna, se llama "Convocatorias abiertas".

### F-A5 · `feat/web-tracking-fidelity`

La línea de tiempo de `paxfide-linea-tiempo.html`:

- **Cabecera:**
  - chip "Donación ···8841 · $ monto" con T-1;
  - título "Historia de tu donación";
  - convocatoria · organización si llegan;
  - píldora de estado (texto de `labels.ts`).
- **En 1280 px, tres columnas:**
  - **"Detalle y verificación":** el paso seleccionado, con evento, custodio, zona y fecha, y la insignia de integridad de la donación;
  - **el árbol central:** raíz "Donada" con el monto, sin fecha (X-15), y una carretera hasta cada lote con sus pasos. El camión está en el paso `ASSET_DISPATCHED` solo si es el último evento;
  - **"Recorrido en serpiente":** pestañas por lote y estaciones sobre la carretera, con el camión que conduce hasta la estación del último evento.
- **En estrecho:** una columna, con la serpiente debajo, como el boceto.
- **Selección de un paso:** con clic o con el teclado; actualiza el detalle (`aria-live="polite"`).
- Desviaciones X-15 y X-16.
- **Tests:**
  - conservar los de VS-7 y T-1;
  - el paso seleccionado cambia el detalle;
  - el camión de la serpiente solo conduce cuando el último evento del lote seleccionado es `ASSET_DISPATCHED`; con otro evento final, el camión queda parado en esa estación (negativa del movimiento);
  - con `reduce`, sin conducción.

---

## 5. Pista B — Panel

### F-B1 · `feat/web-panel-fidelity` (D-F12, D-F13)

- **`/panel` como `vPanel` del boceto:**
  - cabecera con el emblema (logo o inicial), el nombre y "Organización verificada · Tu rol: …";
  - fila de KPI con icono (X-13);
  - "Por hacer" con icono por tipo y su botón a la derecha ("Revisar", "Registrar", "Asignar"), ordenado por urgencia: primero los ambiguos, luego los fondos por aplicar y después las convocatorias sin empleado;
  - "Datos de ejemplo" no aparece.
- Se quita "Secciones del panel" (D-F13).
- **Comprobar primero el fallo del representante.** Con la cuenta de demostración `representante@demo.paxfide.local`, ¿`GET /organizations/{id}` responde 200 con `name`? Hay tres casos:
  - si responde 200 y la pantalla no lo pinta, es un fallo: corregir y añadir un test;
  - si responde 403, la tabla §3.2 dice algo que el backend no hace: DETENTE y repórtalo;
  - si la organización de demostración no tiene nombre, es correcto, y se anota en el PR.
- **Tests:** las tres cuentas (administrador, empleado, representante), cada una con negativas cruzadas de lo que su rol no lee; el orden de "Por hacer"; no existe "Secciones del panel" (negativa).

### F-B2 · `feat/web-panel-tables-fidelity`

- **`/panel/campaigns`:** cabecera con emblema y "Nueva convocatoria" (si la acción está habilitada, D5), chips "Todas" / "Abiertas" / "Cerradas", y la tabla del boceto (convocatoria, estado con "Cierra pronto" de D-P9, barra de recaudado con %, meta, cierre y "Ver"). En estrecho, una tarjeta por fila.
- **`/panel/assets`:** cabecera con "Registrar lote", el aviso amarillo de los ambiguos de la sesión (D6), chips "Todos" / "En bodega" / "En camino" / "Entregados", y la tabla (lote, contenido = `assetType`, cantidad, estado, ubicación; sin fecha, X-14). Un ambiguo resalta su fila en amarillo. **Los chips agrupan `lifecycleStatus` en el cliente:**
  - En bodega: `REGISTERED` y `RECEIVED`;
  - En camino: `DISPATCHED`;
  - Entregados: `DELIVERED`.

  Son los cuatro valores de `LifecycleStatus` en `src/lib/api/assetClient.ts`.

  Si hay un estado que no está en esta lista, DETENTE.
- **Tests:** cada chip filtra (con negativas); el aviso ambiguo no lleva controles dentro (las acciones van debajo); la fila resaltada corresponde al `assetRef` ambiguo.

---

## 5b. Tareas que esperan al backend (D-F16)

Cada una empieza **solo** cuando el PR del backend que necesita esté en `develop` y su contrato esté en `referencia-api-v1.md`. Si el contrato publicado no coincide con lo que dice aquí, DETENTE.

### F-C1 · `feat/web-account-security` (pista A) — tras ADR-050 R-3+R-2, R-4, R-5+D1 y D6

Se puede partir en un PR por tarea del backend, en el orden en que lleguen.
- **R-3+R-2 (D5):** tarjeta "Seguridad" del Perfil con "Cambiar contraseña" (actual y nueva, mínimo 12, medidor del boceto). La respuesta trae un token nuevo, que sustituye al de la sesión en memoria (D2). `400 CurrentPasswordIncorrect` se muestra en el campo y **no** cierra la sesión. Un 500 tras confirmar dice "Tu contraseña cambió; vuelve a iniciar sesión" y lleva al login (plan R-3+R-2 §4).
- **R-4 (D8):** "¿Olvidaste tu contraseña?" en el login, que lleva a una pantalla para pedir el correo. Siempre se muestra el mismo mensaje, exista o no la cuenta. La ruta `/recuperar` lee el token del fragmento `#token=`, lo borra de la barra (como `/invitaciones`) y pide la nueva contraseña. Un token inválido da siempre el mismo texto.
- **R-5 (D1, D2, D3):**
  - dos casillas en el registro, que no vienen marcadas, con enlace a su texto;
  - el registro envía las versiones vigentes;
  - en el login, `403 AcceptanceRequired` abre la pantalla de aceptación con las versiones pendientes y repite el login;
  - en "Registrar organización", la casilla de términos de organización;
  - "¿Cómo te llamamos?" después de la bienvenida (D-F10), opcional y con "Más tarde";
  - nombre y apellido en el Perfil;
  - saludo con el nombre si existe. Sustituye a D-P7 solo cuando `GET /account/profile` lo devuelve. El nombre nunca va en la URL ni en el almacenamiento.
- **D6:** "Desactivar mi cuenta" en el Perfil, con la contraseña actual. Los 409 `RepresentativeTransferRequired` y `ActiveCampaignResponsible` tienen texto propio. Tras el 204, la sesión se cierra.
- **Tests:** para cada ruta, la rama de éxito, la de rechazo y la de fallo, con aserciones negativas de las otras ramas (regla 2.5). Además: el token de recuperación nunca queda en la URL tras cargar `/recuperar`; el nombre no aparece en ninguna petición pública.

### F-C2 · `feat/web-tracking-verifiable` (pista A) — tras la ficha R-6, bloques B y C, y su Enmienda 1

- **Fecha del pago (G-2):** "Pago confirmado" con `firstClearedAt`; si `lastClearedAt` es distinta, también la última.
- **Árbol de sublotes (G-4):** el árbol central del boceto con `parentAssetRef`. Un `parentAssetRef` que no esté en la respuesta se trata como raíz (nunca se inventa un padre).
- **Estado de anclaje por paso (G-3):** los cuatro `anchorStatus` con su texto de `labels.ts`. `UNDER_REVIEW` va en amarillo con icono, nunca en verde.
- **"Huella criptográfica" (Enmienda 1, E1):**
  - el hash de cada paso, recortado y con "Copiar" (copia el completo);
  - con `anchorProof`, el botón **"Comprobar en mi navegador"**: recalcula la raíz con `crypto.subtle.digest('SHA-256')` siguiendo el algoritmo exacto de la Enmienda 1 §E1.3, sin dependencias;
  - la comparación con `merkleRoot` muestra "Coincide" o "No coincide" (en rojo y con icono);
  - enlace a la transacción en el explorador de la red, solo si la red tiene explorador conocido en una tabla cerrada;
  - el texto explica qué se comprobó y qué no: que el hash está dentro de la raíz anclada, no el contenido del evento.
- **Tests:**
  - el algoritmo de verificación con vectores fijos generados por el backend (un vector con número impar de hojas);
  - una prueba alterada da "No coincide" (negativa);
  - sin `anchorProof` no aparece el botón (negativa);
  - el hash completo no se escribe en ningún log.

### F-C3 · `feat/web-panel-time-data` (pista B) — tras la ficha R-6, bloques B y D, y su Enmienda 1

- KPI "Recaudado en <mes>" con el mes actual de `GET …/funds/monthly` (en la zona horaria que devuelve) y una mini serie de 6 meses si el boceto la tiene; KPI "Integridad" (G-7); "Actividad reciente" (G-8, con su cursor).
- Columna "Último cambio" (G-9) y "desde hace más de N días" en "Por hacer", con N = 3 como el boceto.
- **Tests:** meses con 0; varias monedas; un evento de actividad de cada tipo; lote sin `lastEventAt` (columna vacía, no "hace 0 días").

---

## 6. Pendientes de Carlos

| # | Pregunta | Mientras no responda |
|---|---|---|
| P-F1 | ~~Registro: "¿Cómo participarás?"~~ | **Resuelto (Carlos, 2026-10-24): D-F14** |
| P-F2 | ~~Barra estrecha con "Perfil"~~ | **Resuelto (Carlos, 2026-10-24): D-F15** |
| P-F3 | ~~Recuperar y cambiar la contraseña~~ | **Resuelto (Carlos, 2026-10-24): opción (a), D-F16** |

---

## 7. Fuera de este plan

- **`paxfide-pantallas-web.html` (bocetos de Manuel, 18 oct).** Las 12 pantallas tienen marcas EXISTE, PROPUESTA y DEPENDE, y su especificación (`bocetos-web-manuel.md`) no está en el repo. Varias "DEPENDE" ya tienen contrato. Ejemplo: "Mis donaciones" ya tiene fecha, organización y enlace, así que D-P11 está hecha. Necesitan su propia revisión con Carlos y Manuel antes de entrar en un plan.
- **El modo oscuro de la app móvil** (no es de este repositorio).

---

## 8. Orden

```
develop (bd099a3)
   │
   ├── Pista A:  F-A0 → F-A1 → F-A2 → F-A3 → F-A4 → F-A5
   │
   └── Pista B:  F-B1 → F-B2

backend (Manuel): ADR-050 R-3+R-2 → R-4 → R-5+D1 → D6 · ficha R-6 B → C (+ Enmienda 1) → D
   └── cada PR en develop desbloquea su parte de F-C1 (A), F-C2 (A) o F-C3 (B)
```

- La pista B no depende de F-A0. Sus capturas en oscuro llegan al rebasar sobre `develop` con F-A0 mergeada, y entonces se completan.
- **Archivos compartidos:** `labels.ts` y `decisiones-delegadas-web-fase7.md`, como en §1.3 del plan de pantallas. `globals.css` solo en F-A0.
- **Estimación:** 6 PR de la pista A y 2 de la pista B ahora; después, entre 3 y 6 de F-C1 a F-C3, según cómo lleguen los PR del backend.
