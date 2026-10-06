# Delta documental — `front-fase2` y `hallazgos-front-fase2` (revisión 3)

**Estado:** decisiones **APROBADAS** por Carlos el 2026-10-05 para su incorporación documental.
**Naturaleza:** este documento **no modifica ningún ADR**. No aprueba la Enmienda 1 de ADR-041 ni vuelve normativas las fichas de contratos API de Fase 6.
**Cómo se lee:** complementa a `claude/front-fase2.md` y `hallazgos-front-fase2.md`. Donde este delta y esos documentos difieran, rige este delta, por ser posterior y estar aprobado. Si se encuentra una contradicción con un ADR aprobado, se detiene y se reporta.
**Documento relacionado:** `claude/diseno-ux-contractual-web-v1.md` (APROBADO 2026-10-05).

---

## 1. Correcciones a la propuesta externa "Diseño Frontend Web v3"

| # | Decisión | Afecta a |
|---|---|---|
| C-1 | `/assets` en web: lectura + `split`. **Nunca** Dispatch, Receive ni Deliver, y no se copia el `ActionResolver` | `front-fase2` T3 (se reafirma) |
| C-2 | `/c/:publicCode`: sin botón Donar; sin imagen ni meta mientras E3 no cierre los campos de `ConvocatoriaReadModel` | `front-fase2` P-W2, §9 |
| C-3 | La navegación contiene solo rutas del árbol aprobado. No existen Dashboard, Administración ni Platform Admin en v1 | `front-fase2` §7, T6 |
| C-4 | El listado de convocatorias (`/panel/campaigns`) sigue bloqueado por N1 | `front-fase2` T5, §9 |
| C-5 | El sistema visual no reabre colores ni tipografía; solo se diseña lo que falta | `sistema-visual-paxfide-web.md` |
| C-6 | Los listados usan cursor y "Cargar más", nunca paginación numérica; no hay detalle de convocatoria sin contrato | `front-fase2` §5 |

## 2. Consecuencias absorbidas de las fichas de contratos (se aplican cuando sean normativas)

| # | Consecuencia | Afecta a |
|---|---|---|
| K-1 | `commandId` viaja en el header `Command-Id` y es un UUID (T-33). El cambio del header actual `X-Command-Id` **espera** a la Enmienda 1 de ADR-041 | `front-fase2` §10; W-5 |
| K-2 | JWT con `exp` de 1 h y sin refresh (DH-50): a la hora, el 401 lleva a T-1 y se pierde el formulario abierto. Es deuda de UX que se comunica al usuario (aviso de sesión expirada) | `front-fase2` W2 |
| K-3 | Importes como `String` (T-34): la interfaz nunca los convierte a número en coma flotante. Excepción: el tracking conserva el formato de EF3 | `front-fase2` §9 |
| K-4 | Instantes en ISO-8601 UTC con `Z`; se muestran en hora local | `front-fase2` §9 |
| K-5 | El cuerpo de error es `ProblemDetail`, y su `detail` **nunca** se muestra al usuario. El texto depende del código HTTP y de la pantalla | `front-fase2` §9 |
| K-6 | CV-03 "Designarme responsable" (`POST …/administrators`) es una **acción transitoria nueva** en `/panel/campaigns`, aprobada pero bloqueada (N1, Enmienda 1, dependencias de dominio de Convocatoria) | `front-fase2` §7 (árbol), §9 |

## 3. Actualización de hallazgos

| Hallazgo | Estado anterior | Estado nuevo | Fuente |
|---|---|---|---|
| E4 — cuerpo de login | Hueco | **Forma acordada** (ficha ID-01: `{email, password}` → `200 {token}`; 401 único; 400; 500). **No normativo** hasta la Enmienda 1 | Fichas de contratos API, 2026-10-04 |
| C2 — contrato de credencial de tracking | Discrepancia matriz/código | **Resuelto en la ficha** (Q-TR-1: `Authorization: Bearer`, sin código en la ruta de API). Falta enmendar ADR-024 y la matriz §5. **H1 sigue abierto** para la ruta web `/tracking/:trackingCode` | Fichas de contratos API |
| R11 / F3 — Convocatoria | Sin "mismo resultado ante duplicado" | **Forma acordada** (T-33 / N12: un duplicado devuelve el mismo código y cuerpo). No normativo hasta la Enmienda 1 | Fichas de contratos API |
| R11 / F3 — PhysicalAsset (`split`, `register`) | Abierto | **Sigue abierto**: "no-op sin resultado" en Core | — |
| R6 — miembros | Sin contrato | **Forma acordada** (ID-12). Falta el puerto de Identity | Fichas de contratos API |
| N1 — quién soy | Sin contrato | **Sin ficha.** Es la siguiente ficha a redactar (decisión de Carlos, 2026-10-05) | — |
| F5 — `PhysicalAssetOperationalReadPort` | Hueco de implementación | Sin cambios | Plan de implementación, revisión 2 |

## 4. Orden de trabajo fijado (Carlos, 2026-10-05)

```text
Enmienda 1 de ADR-041 → ficha N1 → (este delta) → diseño UX contractual (APROBADO)
  → Penpot → implementación
```

Solo dependen de N1 el contenido de `/panel` y el listado de convocatorias. Las piezas de diseño inmediato (Shell, estados globales, `AssetPage`) no dependen de N1. Login depende de que la ficha ID-01 sea normativa.
