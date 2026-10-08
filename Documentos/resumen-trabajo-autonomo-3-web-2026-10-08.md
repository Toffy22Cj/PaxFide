# Resumen para Carlos — Trabajo autónomo (3), web, noche del 2026-10-08

**Repositorio:** `Toffy22Cj/PaxFide`, todo fusionado en `develop` (nunca en `main`). Cada PR lleva la salida de
`scripts/ci-local.sh` (10/10) sobre su último commit de código.

**Backend leído (solo lectura):** `develop` `85b702b` durante la noche y **`d169dda`** al cerrar (actualización de la
mañana, P4-B). Se revisaron `referencia-api-v1.md` y `estado-fase6.md` §0.26–0.28. No existe
`novedades-api-para-front-2026-10-08.md` (comprobado al empezar, al cerrar y de nuevo en `d169dda`).

## 1. Qué pantallas consumen ya la API real

Todas, detrás de la lista de habilitación (habilitadas en el build de demo) y **SIN VALIDAR CONTRA PENPOT**.
Comprobadas contra el backend real en el ensayo de esta noche (§2) salvo donde se indica.

| Pantalla | API | Ensayo real |
|---|---|---|
| Login, registro (12 caracteres), panel por papeles | `/auth/*`, `/me` | sí |
| Descubrimiento y página pública (narrativa) | `/public/campaigns…` | sí |
| Donar y estado de la intención | CV-11, `Intent-Token` | sí |
| Seguimiento por formulario y relato | `/donations/tracking/**` | sí |
| Mis donaciones | `/account/donations` | sí |
| Convocatorias de la organización y sus acciones | CV-01/02/03, retirar, cerrar | sí (crear, asignar, cerrar) |
| Configuración: solicitud, aprobación y rechazo | Enmienda 4 de ADR-037 | sí (409 con donaciones, aprobación del representante) |
| Estimación | `…/prediction` (con `OUTSIDE_TRAINED_RANGE` sin cifra) | sí |
| Fondos y asignaciones | `/funds…` | sí |
| Registrar activo (A con desplegables, B), página del activo y acciones | `/physical-assets/**` | sí (camino A, logística, división y entrega) |
| Activos de la organización | `…/physical-assets` | sí |
| Mi organización / Crear organización | `POST /organizations` | sí |
| Plataforma: cola de verificación y administradores | `/platform/**` | sí (verificar desde la cola, pedir información, listado de administradores) |
| Personas: miembros e invitaciones | `…/members`, `…/invitations` | sí (invitar; cambiar papel y quitar, en los e2e) |
| Aceptar invitación (`/invitaciones`) | `POST /invitations/accept` | sí (correo leído en Mailpit) |
| Mis convocatorias | `/me/campaigns` | sí |
| Estimación: evolución por cortes (S-17) | `…/prediction/history` | sí (cortes futuros vacíos con su motivo; ver riesgos) |
| Seguimiento: verificación de integridad (S-22) | `/donations/tracking/integrity` | sí (Coincide en grupos anclados en Ganache; No se pudo comprobar en uno aún sin confirmar) |

Ajustes del punto 7 hechos:
- cantidades sin ceros sobrantes y sin redondear (`6.0000` → `6`);
- `OUTSIDE_TRAINED_RANGE` muestra el motivo sin cifra;
- un activo sin `currentLocation` muestra "Sin registrar".

**Gráfico avanzado con historial (punto 8) y verificación de integridad (punto 9):** hechos en P4-B (PR #26) al llegar
los endpoints en `d169dda`. Sustituyen a las secciones "No disponible" de DW-53.
- **Evolución por cortes:** gráfico y tabla con lo recaudado en cada corte (hecho) y el final estimado entonces
  (estimación). Un corte sin cifra (futuro, convocatoria cerrada, configuración cambiada o meta alcanzada) sale vacío con
  el texto del backend; nunca se inventa (DW-54).
- **Integridad:** botón "Comprobar integridad"; un bloque por grupo con Coincide / No coincide / No se pudo comprobar en
  lenguaje llano, el motivo, si afecta a la donación, el anclaje, la red, el bloque, la raíz y la transacción (DW-55).

## 2. Ensayo conjunto

**Cierre contra `d169dda`** (`evidencia-web/ensayo-conjunto-2026-10-08-p4b/`): **32/32 pasos OK, 121 llamadas**, base
vacía. Añade los pasos `integridad` y `estimacion-historial`. Mismos errores esperados que en la noche.

**Noche, contra `85b702b`** (`evidencia-web/ensayo-conjunto-2026-10-08-noche/`):

| Pasada | Base | Resultado |
|---|---|---|
| 1 | vacía | **30/30 pasos OK, 119 llamadas** |
| 2 | **la misma, sin vaciar** | **30/30 OK**. Cerrar la convocatoria anterior libera al empleado y se reasigna sin 409 |

`demo.env` se copió del ejemplo sin tocarlo, con la semilla del perfil `dev`. Errores, solo los esperados: un 409 provocado
a propósito y el 403 del listado para el representante (S-20).

Fuera de la interfaz solo van el pago (proveedor simulado) y la lectura del correo en Mailpit. El token de invitación no
aparece en ninguna URL, ni en el almacenamiento, ni en el log del backend.

Capturas: todas regeneradas de nuevo en `evidencia-web/capturas/` (360 y 1280 px), con la evolución por cortes y la
integridad (coincide y no coincide).

## 3. Qué falla o falta contra el backend (`solicitudes-backend.md`)

**Resuelto en el backend desde el último resumen:**
- D-05 (CORS y enlaces en `:3000`);
- D-06 (cerrar libera asignaciones, comprobado en vivo);
- D-08 (relato de respaldo en español);
- D-04, S-10 a S-16;
- **en `d169dda`:** S-17 y D-03 (historial por cortes), S-22 (integridad) y D-02 (la referencia ya documenta el 401 del
  seguimiento);
- emails sin distinguir mayúsculas (DD-74).

**Abierto:**

| id | Qué | Efecto en la web |
|---|---|---|
| **D-09 / S-23** | **La Autorización (3) §1.4 pide el token de invitación en cabecera; el backend solo lo acepta en el cuerpo** | La web lo envía en el cuerpo (nunca en la URL). **Necesita tu decisión**: si quieres cabecera, el backend debe aceptarla y añadirla a CORS |
| D-10 / S-19 | Sin lectura de la configuración actual ni de su versión | La web la compone y deduce la versión; un 409 de versión obliga a reabrir |
| S-18 | Sin lectura del estado de verificación de la propia organización | "No disponible" tras crearla |
| S-20 | El representante no tiene listado de convocatorias | Escribe la referencia para aprobar o estimar |
| S-21 | Miembros sin identificador legible (solo ULID) | Difícil saber quién es quién |
| DD-66 (backend) | No hay ruta para transferir el papel de representante | No se ofrece |

## 4. Decisiones delegadas nuevas (`PENDIENTE DE RATIFICACIÓN`)

DW-44 a DW-55 (DW-35 a DW-43 ya ratificadas por ti):
- **DW-44:** cola con decisión por fila.
- **DW-45:** administradores de plataforma por identificador de cuenta.
- **DW-46:** Mi organización / Crear organización.
- **DW-47:** formato de cantidades.
- **DW-48:** token de invitación (ruta pública, `replaceState`, memoria, botón "Aceptar").
- **DW-49:** personas.
- **DW-50:** mis convocatorias.
- **DW-51:** configuración compuesta y versión deducida.
- **DW-52:** el ensayo lee el correo en Mailpit.
- **DW-53:** "No disponible" para el historial y la integridad (sustituida por DW-54 y DW-55).
- **DW-54:** evolución por cortes en puntos sin unir, con tabla; un corte sin cifra sale vacío.
- **DW-55:** integridad a petición, un bloque por grupo en lenguaje llano.

Siguen pendientes las antiguas DW-31 a DW-34.

## 5. Riesgos

- **Mañana se trabaja lo visual:** ninguna pantalla está validada contra Penpot. Los e2e localizan elementos por
  texto y papel ARIA: cambiar textos visibles exige tocar los tests.
- **Cortes con cifra sin probar en vivo:** en la demo no hay ninguna convocatoria con cortes pasados (la del ensayo
  empieza ese día), así que el dibujo de cortes con cifra solo está probado con el doble y los tests unitarios.
- **Integridad en móvil:** la raíz y la transacción son largas; se parten en varias líneas. Los gráficos se desplazan
  en horizontal a 360 px.
- **D-09:** la petición de cabecera choca con el contrato. No se cambió nada sin tu decisión.
- **Configuración (D-10):** si dos personas editan a la vez, la segunda verá un 409 de versión hasta reabrir.
- **La sesión vive solo en memoria:** recargar cierra la sesión y pierde una invitación o una donación en curso.
  Hay aviso antes de salir.
