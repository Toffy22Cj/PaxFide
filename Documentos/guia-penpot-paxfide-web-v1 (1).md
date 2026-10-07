# Guía de construcción en Penpot — `paxfide-web` v1

**Naturaleza:** guía de trabajo **derivada**, no normativa. Ordena lo que `diseno-ux-contractual-web-v1.md` (APROBADO, revisión 4) ya fija, para construir los frames de §8. **No añade decisiones.** Ante cualquier diferencia, manda el documento de diseño; si falta algo, se reporta y no se dibuja.
**Fecha:** 2026-10-05.
**Uso:** P-5.4 del plan de la Iteración 5 (frames aprobados) desbloquea W-10. Los frames de `PanelHome` no desbloquean nada: `/panel` sigue aprobado-bloqueado.

---

## 0. Reglas para quien dibuja

1. **Nombre de cada frame:** `§<sección> <Pantalla> — <variante> — <ancho>`. Ej.: `§5.3 AssetPage — entregado — 360`. Un frame sin sección es un error del mockup (§8).
2. **Solo tokens.** Ningún color, tamaño, radio ni sombra fuera de §1 de esta guía. Nada de grises "a ojo".
3. **Solo textos del documento.** Los textos van entre comillas en esta guía; se copian literales. No se inventan títulos, descripciones, placeholders ni datos de ejemplo que parezcan reales.
4. **Datos de ejemplo:** solo los del documento (`AS-…`, "120", "kg", "…"). En `/c`, bloques grises rotulados, sin texto de muestra (§5.4).
5. **Variantes bloqueadas** (`split`, "Registrar activo"): se dibujan como "variante habilitada", con una etiqueta visible fuera del lienzo: `BLOQUEADO PARA DESPLIEGUE (D5)`.
6. **Las variantes no crean reglas.** "Con una entrada" en `PanelHome` ilustra un estado posible según D-N1-1/D-N1-2; no decide qué combinaciones existen (§8).

## 1. Biblioteca de tokens (valores de `src/app/globals.css` en `develop`, `1db5cc6`)

| Grupo | Tokens |
|---|---|
| Marca | `brand-green-900` #1B5141 · `brand-green-800` #20604C · `brand-green-500` #4E9155 · `brand-green-50` #EEF6EF · `brand-blue-800` #255E79 · `brand-blue-700` #327DA2 · `brand-blue-500` #3688B0 · `brand-blue-50` #EBF5F9 · `brand-yellow-900` #785008 · `brand-yellow-400` #F3B544 · `brand-yellow-50` #FDF4E2 · `brand-neutral-700` #405656 · `white` #FFFFFF |
| Semánticos | `danger-700` #B42318 · `danger-50` #FEF3F2 |
| Neutros | `neutral-50` #F8FAFA (fondo de página) · `neutral-100` #F0F4F4 · `neutral-200` #E2E9E9 (solo decorativo) · `neutral-400` #739797 (borde de controles) · `overlay` = `brand-green-900` al 50 % |
| Espaciado | 4 · 8 · 12 · 16 · 24 · 32 · 48 (`space-1` … `space-12`) |
| Radio | `radius-control` 6 · `radius-surface` 8 |
| Sombra | Solo el modal: `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)` |
| Tipografía | `system-ui`; 14 · 16 · 20 · 24; pesos 400 y 600 |
| Medidas | Controles 40 de alto · Login 400 de ancho · Detalle 720 · Márgenes laterales en móvil 16 |
| Foco | Contorno 2 px `brand-green-900`, separación 2 px. Nunca amarillo |

**Restricciones (§3.2), comprobar en cada frame:**
- Enlaces sobre `neutral-50` → `brand-blue-800`, nunca `brand-blue-700`.
- Ningún control sobre `neutral-100`.
- `neutral-200` nunca delimita un control.

## 2. Frames

### 2.1 `§3–§4 Tokens y componentes`

Componentes y estados, uno por fila: `Button` primario y secundario (normal, foco, deshabilitado, "enviando…") · `TextField` y `PasswordField` (normal, foco, error, deshabilitado; "Mostrar"/"Ocultar") · `Modal` (título, contenido, Cancelar + primario, fondo `overlay`) · `StatusNotice` (éxito, rechazado, ambiguo, informativo) · `DefinitionList` · `PageHeader` · `LoadingState` · `ErrorState` · `ForbiddenState` · `NotFoundState` · `AmbiguousState` · `EmptyState` · 5 iconos SVG propios (información, advertencia, error, confirmación, cerrar; 20 px). **No:** `Table`, `LoadMore`, `Card` (sin uso en v1).

### 2.2 `§5.1 Shell` — 360 y 1280

Variantes: público (logo + "PaxFide") y autenticado (+ "Cerrar sesión"). Sin barra lateral.

### 2.3 `§5.2 Login` — 360 y 1280 (BLOQUEADO)

Los 10 estados de la tabla de §5.2, con sus textos literales: formulario; validación local ("Este campo es obligatorio."); enviando; credenciales no válidas ("Correo o contraseña incorrectos."); petición inválida; error técnico ("No pudimos iniciar sesión. Inténtalo de nuevo más tarde."); error de red ("No pudimos conectar. Revisa tu conexión e inténtalo de nuevo."); sesión expirada ("Tu sesión expiró. Vuelve a iniciar sesión."); sesión cerrada en otra pestaña ("Cerraste sesión en otra pestaña."); éxito (navegación, sin pantalla propia). Sin "recuperar contraseña", "crear cuenta" ni "recordarme".

### 2.4 `§5.3 AssetPage` — 360 (principal) y 1280

Variantes: carga · contenido · entregado ("Este activo ya fue entregado. Solo lectura.", sin botón "Dividir activo") · 403 ("No tienes acceso a este recurso.") · 404 del recurso ("No encontramos este activo. Verifica el código QR.") · error ("No pudimos cargar la información. Inténtalo de nuevo." + "Reintentar"). Etiquetas: "Estado", "Cantidad", "Unidad de medida", "Ubicación actual", "Custodio actual", "Convocatoria". `lifecycleStatus` sin color. `assetRef` en monoespaciada.

### 2.5 `§5.3 AssetPage — split` — 360 (BLOQUEADO)

Botón secundario "Dividir activo" · modal con "Separa una parte de la cantidad de este activo en un activo nuevo.", zona rotulada "Campos: PENDIENTE (cuerpo de `split` sin especificar)" sin campos, Cancelar y Confirmar **deshabilitado** · estados de comando: enviando, rechazado, ambiguo. **Sin variante de éxito** (PENDIENTE).

### 2.6 `§5.4 /c — estructura` — 360 y 1280 (BLOQUEADO)

Bloques grises rotulados ("zona de contenido público — campos: PENDIENTE (E3)", "zona de narrativa") · no encontrada ("No encontramos esta convocatoria. Verifica el enlace."). Sin botón Donar, imagen ni barra de meta.

### 2.7 `§5.5 404` — 360 y 1280

"No encontramos esta página." Una sola variante. Sin enlaces a rutas autenticadas.

### 2.8 `§5.6 PanelHome` — 360 y 1280 (BLOQUEADO)

Variantes: carga · con dos entradas ("Convocatorias de mi organización" como enlace, "Registrar activo" como botón, ambos `Button` secundario de ancho completo) · con una entrada · sin entradas (`EmptyState`: "No hay opciones disponibles para tu cuenta en este panel.") · error. Título "Panel". Sin texto descriptivo bajo las entradas ni iconos.
Además, solo a 360: `/panel/campaigns` sin organización — título "Convocatorias de mi organización" + el mismo `EmptyState`.

### 2.9 `§6 Estados globales`

Los de la tabla de §6 con sus colores: carga, error de lectura, 403, no encontrado, ambiguo (título "No pudimos confirmar la operación", texto "Puede que se haya realizado. Revisa antes de repetirla.", "Reintentar", "Cerrar", y tras cerrar "No sabemos si la operación se realizó; revísalo antes de repetirla."), rechazado (sin textos de 409: PENDIENTES), éxito (por comando; PENDIENTE donde falte contrato), sesión expirada, sin entradas.

## 3. Lista de comprobación antes de pedir aprobación de los frames

- [ ] Cada frame lleva su sección en el nombre.
- [ ] Ningún color fuera de la biblioteca; contrastes de §3.1 respetados.
- [ ] Todos los textos son literales del documento; ninguno inventado.
- [ ] Ningún `ProblemDetail` ni texto técnico visible.
- [ ] Variantes bloqueadas etiquetadas `BLOQUEADO PARA DESPLIEGUE (D5)`.
- [ ] Ningún elemento sin sección correspondiente (si aparece, se reporta: no se aprueba como decisión).
