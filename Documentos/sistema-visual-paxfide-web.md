# Sistema visual de `paxfide-web` — tokens de color

**Estado:** APROBADO (2026-09-28, aprobación humana explícita de los cuatro puntos de §7).
**Fecha:** 2026-09-28
**Condicionado a:** `ADR-042-frontend-web-paxfide-web.md` (PROPUESTO). Este documento **no es un ADR** y no toma decisiones de arquitectura. Solo tiene validez operativa cuando el ADR esté APROBADO, porque D8 fija el mecanismo de implementación (CSS Modules + custom properties) y §5 del ADR fija el requisito de contraste (WCAG 2.2 AA). La aprobación de este documento **no cambia** el estado del ADR.
**No es código.** Especifica nombres, valores y reglas de uso. La implementación como custom properties es una tarea del plan de implementación, todavía no redactado.

---

## 1. Origen de los valores

**Fuente:** logo del proyecto (`ChatGPT Image 21 sept 2026 00_36_20.png`, 1254×1254 px, raster).

**Método de medición:** para cada zona del logo se tomaron los píxeles no blancos (suma RGB < 690) y se usó el valor **mediano**. El contraste se calculó con la fórmula de luminancia relativa de WCAG 2.x. Los valores derivados se obtienen variando **solo la luminosidad** (espacio HLS) del color medido, conservando tono y saturación. El script completo está en el Anexo A, para que cualquiera pueda reproducir cada cifra.

**Limitaciones que conviene saber:**
- El logo es un raster con degradados y antialiasing, no un vector con colores definidos. Los valores medidos son **aproximaciones fieles**, no la paleta "oficial" del diseñador. Si el equipo obtiene una versión vectorial con colores exactos, los tokens `brand-*` medidos se sustituyen por esos valores y **se recalculan todos los contrastes**.
- En texto fino (tagline, `#5D7D74`, 4,52:1) la mediana mezcla píxeles del trazo con el fondo, así que el color real puede ser algo más claro. Por eso el tagline **no** se usa como token.

---

## 2. Tokens

### 2.1 Medidos del logo

| Token | Valor | Zona del logo | Contraste sobre blanco |
|---|---|---|---|
| `brand-green-900` | `#1B5141` | Texto "Pax" | 9,13:1 |
| `brand-green-800` | `#20604C` | Mano | 7,40:1 |
| `brand-green-500` | `#4E9155` | Corazón (mitad verde) | 3,81:1 |
| `brand-blue-500` | `#3688B0` | Texto "Fide" | 3,96:1 |
| `brand-yellow-400` | `#F3B544` | Sol | 1,83:1 |
| `brand-neutral-700` | `#405656` | Subtítulo "DONACIONES QUE LLEGAN" | 7,83:1 |
| `white` | `#FFFFFF` | Fondo | — |

### 2.2 Derivados (misma tonalidad, luminosidad ajustada)

| Token | Valor | Derivado de | Propósito | Contraste sobre blanco |
|---|---|---|---|---|
| `brand-blue-700` | `#327DA2` | `brand-blue-500` | Mínimo que alcanza 4,5:1 | 4,57:1 |
| `brand-blue-800` | `#255E79` | `brand-blue-500` | Mínimo que alcanza 7:1 | 7,10:1 |
| `brand-yellow-900` | `#785008` | `brand-yellow-400` | Texto "ámbar" legible | — (uso sobre `yellow-50`) |
| `brand-yellow-50` | `#FDF4E2` | `brand-yellow-400` | Fondo de aviso | — |
| `brand-green-50` | `#EEF6EF` | `brand-green-500` | Fondo de éxito / superficie | — |
| `brand-blue-50` | `#EBF5F9` | `brand-blue-500` | Fondo informativo | — |

### 2.3 Semánticos que NO provienen del logo

El logo no tiene rojo. Los estados de error del diseño (rechazo determinista, error de red) necesitan un color de peligro. **Estos tokens no son de marca**: son semánticos, aprobados expresamente como tales, y deben mantenerse separados de los `brand-*`.

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `danger-700` | `#B42318` | Texto e icono de error | 6,57:1 sobre blanco |
| `danger-50` | `#FEF3F2` | Fondo de error | `danger-700` sobre él: 6,05:1 |

---

## 3. Combinaciones permitidas

Todas calculadas por el script del Anexo A. Umbrales WCAG 2.2: **texto normal ≥ 4,5:1**, **texto grande (≥ 24 px, o ≥ 18,66 px en negrita) ≥ 3:1**, **componentes de interfaz y foco ≥ 3:1** (criterio 1.4.11).

| Texto / elemento | Fondo | Contraste | Texto normal | Texto grande | Uso previsto |
|---|---|---|---|---|---|
| `brand-green-900` | `white` | 9,13:1 | ✅ | ✅ | Texto principal, títulos, botón primario (blanco sobre verde: mismo valor) |
| `brand-neutral-700` | `white` | 7,83:1 | ✅ | ✅ | Texto secundario, metadatos |
| `brand-green-800` | `white` | 7,40:1 | ✅ | ✅ | Encabezados de sección |
| `brand-blue-800` | `white` | 7,10:1 | ✅ | ✅ | Enlaces en texto pequeño (< 16 px) |
| `brand-blue-700` | `white` | 4,57:1 | ✅ al límite | ✅ | Enlaces en texto de cuerpo (≥ 16 px) |
| `brand-blue-500` | `white` | 3,96:1 | ❌ | ✅ | Solo títulos grandes, iconos, ilustración |
| `brand-green-500` | `white` | 3,81:1 | ❌ | ✅ | Solo iconos y elementos gráficos |
| `brand-yellow-400` | `white` | 1,83:1 | ❌ | ❌ | **Nunca** como texto ni como borde informativo; solo relleno decorativo |
| `brand-green-900` | `brand-yellow-400` | 5,00:1 | ✅ | ✅ | Etiqueta o insignia con fondo amarillo |
| `brand-green-900` | `brand-yellow-50` | 8,35:1 | ✅ | ✅ | Aviso de estado AMBIGUO (ver §4) |
| `brand-yellow-900` | `brand-yellow-50` | 6,51:1 | ✅ | ✅ | Título o icono del aviso AMBIGUO |
| `brand-green-900` | `brand-green-50` | 8,29:1 | ✅ | ✅ | Confirmación de éxito |
| `brand-neutral-700` | `brand-green-50` | 7,10:1 | ✅ | ✅ | Texto secundario sobre superficie verde |
| `brand-blue-800` | `brand-blue-50` | 6,41:1 | ✅ | ✅ | Aviso informativo |
| `danger-700` | `danger-50` | 6,05:1 | ✅ | ✅ | Error / rechazo |
| `danger-700` | `white` | 6,57:1 | ✅ | ✅ | Mensaje de error en formulario |

**Indicador de foco:** `brand-green-900` (9,13:1 sobre blanco) o `brand-blue-700` (4,57:1). Ambos superan el 3:1 exigido. El foco **nunca** usa amarillo.

**Cualquier combinación que no esté en esta tabla no está permitida** hasta que se calcule y se añada con el mismo script. Así se evita que alguien "pruebe a ojo" un color nuevo.

---

## 4. Estados de la interfaz

Los estados cerrados en `claude/front-fase2.md` §9–§10 tienen significados distintos, y el color no debe mezclarlos. En particular, **ambiguo no es error**: la regla heredada de `front-fase1.md` §7 dice "no pudimos confirmar", nunca "falló".

| Estado del diseño | Fondo | Texto | Justificación |
|---|---|---|---|
| Éxito (2xx) | `brand-green-50` | `brand-green-900` | Coherente con la marca |
| Rechazado (4xx determinista) | `danger-50` | `danger-700` | Sabemos que no ocurrió: es un error real |
| **Ambiguo** (timeout / 5xx) | `brand-yellow-50` | `brand-green-900`, título en `brand-yellow-900` | **No se usa rojo:** no sabemos que falló. Pintarlo como error induciría al usuario a repetir la operación, que es exactamente lo que P-W1 intenta evitar |
| `403` (estado de pantalla) | `white` | `brand-neutral-700` | Informativo, sin alarma: el usuario no hizo nada mal |
| Informativo / narrativa `PENDING` | `brand-blue-50` | `brand-blue-800` | Proceso en curso, sin juicio |
| No encontrada (`/c`) | `white` | `brand-neutral-700` | Igual que `403` |

**El color nunca es la única señal** (WCAG 1.4.1): cada estado lleva además un texto explícito y, si procede, un icono con etiqueta.

---

## 5. Reglas de uso

1. **Verde oscuro (`brand-green-900`) es el color de acción y de texto principal.** Botón primario: fondo `brand-green-900`, texto `white`.
2. **Azul de marca (`brand-blue-500`) solo en tamaños grandes o elementos no textuales.** Para texto azul se usa `brand-blue-700` (cuerpo ≥ 16 px) o `brand-blue-800` (texto pequeño).
3. **Amarillo (`brand-yellow-400`) solo como acento o relleno**, con texto `brand-green-900` encima si lleva texto. Nunca como texto sobre blanco.
4. **El tagline del logo no es un token.** Su color medido está al límite y probablemente contaminado por antialiasing.
5. **Ningún color fuera de §2 se introduce sin recalcular** con el Anexo A y añadirlo a §3.
6. **Los tokens se consumen por nombre**, no por valor hexadecimal, para que un cambio de marca afecte a un único lugar (D8: custom properties).

---

## 6. Pendiente y fuera de este documento

| Tema | Estado | Motivo |
|---|---|---|
| Tipografía | **Pendiente** | El logo usa una sans geométrica sin identificar. Elegir una fuente web implica decidir cómo se sirve (Google Fonts, autoalojada), y D8 limita las dependencias: se decide como enmienda o como tarea del plan, no aquí |
| Modo oscuro | **Fuera de v1** | No se ha pedido. Si se añade, requiere su propia tabla de contrastes |
| Versión vectorial del logo | **Recomendado** | Sustituiría los valores medidos por los oficiales (§1) |
| Espaciado, radios, sombras, tamaños tipográficos | **Fuera de este documento** | Se definen con la primera pantalla implementada, no en abstracto |
| Verificación automática en CI | **Para el plan de implementación** | Un test que recorra §3 y falle si algún par baja de su umbral |

---

## 7. Registro de aprobación (2026-09-28)

| # | Decisión | Estado |
|---|---|---|
| 1 | Tokens medidos y derivados (§2.1–§2.2), como aproximaciones reproducibles de la fuente raster, sustituibles por valores vectoriales exactos si aparece el original | **APROBADO** |
| 2 | Tokens `danger-700` / `danger-50` (§2.3), como tokens semánticos no pertenecientes a la marca | **APROBADO** |
| 3 | Estado AMBIGUO en amarillo, no en rojo (§4) | **APROBADO** |
| 4 | Regla de enlaces: `brand-blue-700` para cuerpo, `brand-blue-800` para texto pequeño; `brand-blue-500` fuera del uso como texto normal (§5.2) | **APROBADO** |

No se convierte en ADR: sigue como documento de sistema visual condicionado al ADR del frontend web (ADR-042).

---

## Anexo A — Script de verificación

Reproduce todas las cifras de §2 y §3. Requiere Python 3; solo usa la biblioteca estándar.

```python
import colorsys

def h2r(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def r2h(c):
    return '#%02X%02X%02X' % c

def lum(c):  # luminancia relativa WCAG 2.x
    r = []
    for v in c:
        v /= 255
        r.append(v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2]

def cr(a, b):  # contraste
    la, lb = sorted([lum(h2r(a)), lum(h2r(b))], reverse=True)
    return (la + 0.05) / (lb + 0.05)

def with_l(hexc, l):  # misma tonalidad, otra luminosidad
    r, g, b = [x / 255 for x in h2r(hexc)]
    hh, _, ss = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb(hh, l, ss)
    return r2h(tuple(round(x * 255) for x in (r, g, b)))

def darken_to(hexc, target, bg='#FFFFFF'):  # primer tono que alcanza el umbral
    r, g, b = [x / 255 for x in h2r(hexc)]
    _, l, _ = colorsys.rgb_to_hls(r, g, b)
    while l > 0:
        c = with_l(hexc, l)
        if cr(c, bg) >= target:
            return c
        l -= 0.005

# Derivados de §2.2
print(darken_to('#3688B0', 4.5))  # brand-blue-700  -> #327DA2
print(darken_to('#3688B0', 7.0))  # brand-blue-800  -> #255E79
print(darken_to('#F3B544', 7.0))  # brand-yellow-900 -> #785008
print(with_l('#F3B544', 0.94))    # brand-yellow-50  -> #FDF4E2
print(with_l('#4E9155', 0.95))    # brand-green-50   -> #EEF6EF
print(with_l('#3688B0', 0.95))    # brand-blue-50    -> #EBF5F9

# Ejemplo de verificación de un par de §3
print(round(cr('#1B5141', '#FDF4E2'), 2))  # 8.35
```
