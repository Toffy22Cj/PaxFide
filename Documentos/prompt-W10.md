# Prompt W-10 — Componentes base, Shell y AssetPage visual

**Uso:** sesión de agente **nueva**. Pega primero el Prompt Maestro (`Documentos/Promt-maestro-front-fase2.md` §1) y, **debajo**, este bloque completo. Un solo bloque por sesión.
**Estado:** APROBADA (Iteración 5, 2026-10-05) y desbloqueada (P-5.4, 2026-10-06).

```
TAREA W-10: Implementar los componentes base, el Shell y el acabado visual de
AssetPage, fieles al diseño aprobado y a los frames de Penpot aprobados.

RAMA: feat/web-ux-components-shell, creada desde origin/develop (6eac39f o
posterior). No partas de ninguna otra rama.

CONTEXTO YA CONGELADO (léelo de Documentos/ en develop, no de memoria):
- diseno-ux-contractual-web-v1.md, REVISIÓN 4, con las decisiones 12 y 13:
  §3.2 (restricciones, incluida la nueva 3.2.4), §3.3, §3.4 (5 iconos),
  §4 (componentes), §5.1 (Shell), §5.3 (AssetPage), §6, §7 y §8.
- Decisión 12: Button deshabilitado = primario fondo neutral-400 + texto
  white; secundario fondo white + borde y texto neutral-400. Sin opacidad.
- Decisión 13:
  · §3.2.4: ningún control sobre danger-50 ni brand-yellow-50. "Reintentar"
    y "Cerrar" van DEBAJO del aviso, sobre el fondo de la página.
  · Campo deshabilitado: borde y texto neutral-400.
  · Etiqueta de campo: text-sm, peso 600, brand-neutral-700.
  · "Mostrar"/"Ocultar": brand-blue-700 sobre white.
- Los frames de Penpot citan en su título la sección del documento. Un
  elemento de Penpot sin sección correspondiente NO se implementa: se reporta.
- Tokens: solo los de src/app/globals.css (custom properties). Ningún valor
  de color, tamaño, radio o sombra escrito a mano.

ENTREGABLES:
1. Button (primario/secundario; normal, foco, deshabilitado según decisión
   12, enviando = mismo texto + "…"), TextField y PasswordField (normal, foco,
   error, deshabilitado según decisión 13; error enlazado con
   aria-describedby; "Mostrar"/"Ocultar" en texto), Modal (fondo overlay,
   foco atrapado, Escape = Cancelar, devuelve el foco al disparador; sombra
   shadow-modal), DefinitionList, PageHeader (una sola h1).
2. Los 5 iconos SVG propios de §3.4, inline, 20 px, currentColor,
   aria-hidden salvo el de cerrar (nombre accesible "Cerrar").
3. CORRECCIÓN de los componentes de estado de W-9 (src/components/States.tsx):
   hoy ErrorState y AmbiguousState dibujan sus botones DENTRO del fondo
   danger-50 / brand-yellow-50. Muévelos debajo del aviso (§3.2.4). Ningún
   texto cambia. StatusNotice incorpora su icono (§4: icono + título + texto).
4. Shell (§5.1): logo + "PaxFide"; "Cerrar sesión" (Button secundario) solo
   en AUTHENTICATED, que ejecuta el logout manual (G-W3). Sin barra lateral.
   Rutas públicas con el mismo encabezado, sin "Cerrar sesión".
5. AssetPage con PageHeader ("Activo" + assetRef en monoespaciada) +
   DefinitionList (etiquetas de §5.3), mobile-first (360 px); en 1280 px el
   contenido se limita a width-detail.

QUÉ NO HACER:
- Table, LoadMore, Card ni ningún componente no listado en §4.
- PanelHome, /panel/campaigns, LoginPage, /c ni el modal de split: están
  diseñados pero BLOQUEADOS (D5). EmptyState existe en §4 pero su único
  consumidor es PanelHome: no lo implementes en esta tarea.
- Librería de iconos o de componentes (D8). Tailwind ni CSS-in-JS.
- Cambiar textos aprobados, tokens existentes, guards, sesión o el cliente.
- Mergear, hacer push a develop o main, o abrir PR sin que Carlos lo pida.
  Solo push de tu rama.
- Crear documentos, planes o archivos fuera de la tarea.

DEFINITION OF DONE:
- Testing Library: cada estado de cada componente; Modal con foco atrapado,
  Escape y devolución del foco; Button deshabilitado no dispara onClick.
- Aserciones negativas: "Cerrar sesión" no se renderiza en LOGGED_OUT ni en
  rutas públicas; ningún <button> es descendiente del contenedor con fondo
  danger-50 ni brand-yellow-50 (ErrorState, AmbiguousState); ningún archivo
  CSS nuevo contiene un hexadecimal fuera de los tokens (el test existente
  debe seguir en verde); no existe botón "Dividir activo" en AssetPage.
- Playwright: Shell público vs autenticado; AssetPage a 360 y 1280 px.
- Capturas a 360 y 1280 px de Shell y AssetPage (contenido, entregado, 403,
  404, error), junto al frame de Penpot correspondiente, para la revisión.
- Output LITERAL y COMPLETO, desde la primera línea, de:
    pnpm typecheck
    pnpm vitest run --reporter=verbose
    pnpm test:e2e
- git log --oneline origin/develop..HEAD y git diff --stat origin/develop.
```
