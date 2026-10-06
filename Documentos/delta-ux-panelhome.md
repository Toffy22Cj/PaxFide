# Delta UX — `PanelHome` (`/panel`) y `/panel/campaigns` sin organización

**Estado:** **APROBADO** por Carlos el 2026-10-05, completo (U-P1 a U-P3 y §1–§6). Incorporado como **revisión 4** de `diseno-ux-contractual-web-v1.md`. No habilita ninguna superficie.
**Fecha:** 2026-10-05.
**Naturaleza:** delta de `diseno-ux-contractual-web-v1.md` (APROBADO, revisión 3). Al aprobarse, se incorpora como **revisión 4** de ese documento. **No habilita ninguna superficie:** `/panel` y `/panel/campaigns` siguen aprobado-bloqueadas y responden 404 por D5 (`delta-front-fase2-N1.md` §5).
**Fuentes:** `claude/delta-front-fase2-N1.md` (APROBADO 2026-10-05), `claude/ficha-N1-quien-soy.md` (CONGELADA), `front-fase2` §7 y §9, `diseno-ux-contractual-web-v1.md` §2–§8.

**Qué cubre:** solo lo que el delta de N1 dejó pendiente para UX: el contenido de `PanelHome`, el estado "sin entradas" y `/panel/campaigns` sin `organizationId`. **No cubre** el listado de convocatorias (`OrgCampaignsPage` con datos): su diseño sigue pendiente de su propio contrato de lectura.

---

## 1. `PanelHome` — estructura

```text
┌──────────────────────────────────────┐
│ [logo] PaxFide        [Cerrar sesión]│   Shell (§5.1, sin cambios)
├──────────────────────────────────────┤
│ Panel                                │   PageHeader (h1) — texto: U-P1
│                                      │
│ [ Convocatorias de mi organización ] │   entrada de navegación (U-P2)
│ [ Registrar activo ]                 │   acción transitoria (U-P2) — BLOQUEADA, D5
└──────────────────────────────────────┘
```

- Mobile-first, 360 px. En 1280 px el contenido se limita a `width-detail` (720 px).
- Entradas en una sola columna, en este orden fijo: "Convocatorias de mi organización", "Registrar activo". Solo se renderizan las que da la regla D-N1-1 (y D-N1-2 para `REPRESENTATIVE`).
- Las entradas se marcan como lista (`<ul>`), con una sola `h1` en la página (§7).
- **Textos de las entradas: HEREDADOS** de `front-fase2` §7 ("Convocatorias de mi organización", "Registrar activo"). No se añade texto descriptivo bajo cada entrada.
- **"Registrar activo"** es una acción transitoria bloqueada (P7, cuerpo de `register`, R10, R11). Por D5 **no se renderiza** en ningún build desplegado. Se dibuja en Penpot solo como variante habilitada, igual que `split` (§5.3). Su formulario no se diseña aquí: el cuerpo de `register` no está especificado.

## 2. `PanelHome` — estados

| Estado | Disparador (delta N1 §3.1) | Presentación |
|---|---|---|
| Carga | `/me` en curso | `LoadingState` (§6) |
| Con entradas | Al menos una entrada aplica | `PageHeader` + entradas |
| **Sin entradas** | Ninguna entrada aplica | `PageHeader` + `EmptyState` con el texto de U-P3 |
| Error | Red, 5xx o respuesta de `/me` que viola la ficha | `ErrorState` (§6) con "Reintentar" |
| 401 | `/me` 401 | Sin pantalla propia: T-1 → `/login` con el aviso de sesión expirada (§5.2) |

## 3. `/panel/campaigns` sin `organizationId` (D-N1-4)

- No se llama al backend. Se muestra `PageHeader` + `EmptyState` con **el mismo texto** que "sin entradas" (U-P3).
- Título del `PageHeader` en esta página: "Convocatorias de mi organización" (HEREDADO, mismo texto que la entrada).
- No se muestra `ForbiddenState`: no hay un 403 del backend (D-N1-4).

## 4. Decisiones abiertas

### U-P1 — Título de `PanelHome`

| Opción | Texto |
|---|---|
| **(a) "Panel"** — recomendada | Coincide con el nombre de la ruta y del espacio (`/panel`, "espacio autenticado común", `front-fase2` §7). No promete contenido |
| (b) "Inicio" | Más coloquial; puede confundirse con la portada pública |
| (c) Sin título visible | Viola la regla de una `h1` por página (§7) salvo que sea solo para lectores de pantalla |

### U-P2 — Presentación de las entradas

| Opción | Contenido |
|---|---|
| **(a) Reutilizar el `Button` secundario** — recomendada | Ancho completo, alto `control-height`, borde `neutral-400`, texto `brand-green-900`, peso `weight-semibold`. Semántica correcta según el tipo: `<a>` para "Convocatorias de mi organización" (navegación), `<button>` para "Registrar activo" (acción). **No se crea ningún componente nuevo** y se respetan §3.2 (controles con `neutral-400`, nunca `neutral-200`) y §3.4 (sin iconos nuevos) |
| (b) Componente nuevo `NavEntry` (fila con título y descripción) | Más espacio visual, pero añade un componente y textos descriptivos que hoy no existen. §4 dice: "No se añade `Card` ni otros componentes sin una pantalla que los necesite" |

### U-P3 — Texto del estado "sin entradas"

Debe cumplir el delta de N1: no sugiere causas, no menciona permisos ni "próximamente". `EmptyState` (§4) se usa aquí por primera vez: fondo `white`, texto `brand-neutral-700`, sin acciones.

| Opción | Texto |
|---|---|
| **(a)** — recomendada | "No hay opciones disponibles para tu cuenta en este panel." |
| (b) | "Todavía no hay nada que mostrar aquí." — "todavía" insinúa que algo llegará, cerca de "próximamente" |
| (c) | "Tu cuenta no tiene acceso a ninguna sección." — menciona permisos; prohibido por el delta de N1 |

## 5. Cambios en `diseno-ux-contractual-web-v1.md` al aprobarse (revisión 4)

- Cabecera: el contenido de `/panel` deja de estar "fuera de alcance"; el listado de convocatorias sigue fuera.
- §4: `EmptyState` pasa de "definido sin uso" a usado por `PanelHome` y `/panel/campaigns` sin organización. `Table` y `LoadMore` siguen sin uso.
- §5: nueva sección `PanelHome` con §1–§3 de este delta.
- §6: se añade el texto de "sin entradas" (U-P3).
- §8 (Penpot): nuevo frame **PanelHome** — variantes carga, con dos entradas, con una entrada, sin entradas, error — a 360 y 1280; y una variante de `/panel/campaigns` sin organización a 360.
- §9: registro de aprobación del delta.

## 6. Lo que este delta no hace

- No diseña `OrgCampaignsPage` con datos (tabla, "Cargar más", vacía, acciones). Requiere el contrato de lectura del listado.
- No diseña el formulario de "Registrar activo".
- No cambia el Shell, los guards ni el destino post-login.
- No usa `platformAuthority` ni añade entradas de plataforma (T6).

## 7. Registro de aprobación

| Decisión | Respuesta | Fecha |
|---|---|---|
| U-P1 | (a) Título "Panel" | 2026-10-05 |
| U-P2 | (a) `Button` secundario de ancho completo; `<a>` para navegar, `<button>` para acción; sin componente nuevo | 2026-10-05 |
| U-P3 | (a) "No hay opciones disponibles para tu cuenta en este panel." | 2026-10-05 |
| Delta completo | APROBADO, sin cambios sobre el texto revisado. Precisión de Carlos: las variantes de Penpot (p. ej. "con una entrada") representan estados derivados de D-N1-1/D-N1-2; no crean reglas sobre qué combinaciones son posibles | 2026-10-05 |
