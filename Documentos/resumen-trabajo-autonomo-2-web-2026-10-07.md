# Resumen para Carlos — Trabajo autónomo (2), frontend web

**Fecha:** 2026-10-07 (UTC). **Repositorio:** `Toffy22Cj/PaxFide`, todo fusionado en `develop` (nunca en `main`).
**Backend:** solo lectura; `develop` en `231a7f6` durante el primer ensayo y en `4d1d65a` durante el segundo.
**CI:** cada PR lleva la salida de `scripts/ci-local.sh` (10/10) sobre su último commit de código (regla 3.2).

## 1. Pantallas terminadas

Todo está detrás de la lista de habilitación (habilitado en el build de demo, vacío en el build por defecto) y
**SIN VALIDAR CONTRA PENPOT**.

| PR | Bloque | Pantallas y acciones |
|---|---|---|
| #14 | P2-B | **Convocatorias de mi organización** con el listado real. Por fila: asignar empleado, designar administrador, retirar responsable (con reemplazo opcional) y cerrar, eligiendo entre los miembros. **Estimación** con el contrato real: gráficos básico y avanzado, hecho y estimación separados, etiqueta "ESTIMACIÓN — modelo entrenado con datos sintéticos", y el texto del backend cuando no hay cifra |
| #15 | Ensayo | Recorrido del golden path por la interfaz contra el backend real (`ensayo/`) y correcciones que salieron de él |
| #16 | P2-C | **Fondos de mi organización** (solicitar y confirmar asignaciones), **Activos de mi organización**, **Registrar activo** por el camino A eligiendo fondo y asignación, **Verificación de organizaciones** (plataforma: verificar, rechazar, pedir información) y contraseña de 12 caracteres en el registro |
| #17 | Ensayo tras P2-C | Segunda pasada del ensayo, ya sin pasos por HTTP salvo el pago, y este resumen |

## 2. Ensayo conjunto: resultado

| Pasada | Backend | Resultado |
|---|---|---|
| 1 | `231a7f6` | **20/20 pasos OK, 53 llamadas sin error**. La verificación de la organización y la asignación de fondos se hicieron por HTTP (aún no tenían pantalla) |
| 2 | `4d1d65a` | **21/21 pasos OK, 68 llamadas sin error, todo por la interfaz** salvo el pago (el test hace de proveedor de pago simulado, DW-30) |

**Funcionó contra el backend real:**
- cuenta y panel: login, `/me`, panel por papeles, verificación de la organización;
- convocatorias: crear (CV-01), listado y miembros, asignar empleado (CV-02), cerrar, página pública (CV-07);
- donaciones: donar sin cuenta y con cuenta (CV-11) con su consulta y el `trackingCode`, "Mis donaciones";
- fondos y activos: fondos y asignaciones, registro por el camino A, despachar, recibir, dividir (saga), entregar padre e hijo, activos de la organización;
- seguimiento por formulario, con relato de plantilla;
- estimación y narrativa de la convocatoria.

**Lo que no funcionó o funciona a medias contra el backend real:**
- **D-06.** Cerrar una convocatoria no libera a su empleado, que ya no puede ser responsable de ninguna otra. El ensayo solo se repite sobre una base vacía.
- **D-08.** El relato individual de plantilla sale en inglés y muestra el `fundId` al donante.
- **Estimación.** Una convocatoria recién creada no tiene cifra (`NOT_STARTED`), porque CV-01 exige un inicio futuro. Pasado el inicio, la pantalla muestra la cifra real con los avisos del backend (captura `22-estimacion-con-cifra.png` de la segunda pasada).
- **Narrativa de la convocatoria.** Sin clave de LLM sale `UNAVAILABLE`, que es lo que dice el runbook.

**Corregido en la web por el ensayo:**
- el texto de `EmployeeAlreadyAssigned`, que decía lo contrario de lo que pasa;
- el backend simulado era más permisivo que el real: entregaba un activo `REGISTERED` y permitía asignar dos veces al mismo empleado. Eso ocultaba que el hijo de una división hay que despacharlo y recibirlo antes de entregarlo. Se alineó con el real y se ajustaron los e2e.

Evidencia: `Documentos/evidencia-web/ensayo-conjunto-2026-10-07/` y `…-p2c/`.

## 3. Bloqueado por el backend (`solicitudes-backend.md`)

Lo que pide la Autorización (2) §2 y **no existe** en `referencia-api-v1.md` (`4d1d65a`). La web no lo construye ni
inventa respuestas.

| id | Qué falta |
|---|---|
| S-10 | Crear organización y leer su estado de verificación |
| S-11 | Listado de organizaciones pendientes (D-04) y conceder o retirar administradores de plataforma |
| S-12 | Invitaciones (invitar, revocar, pendientes), cambiar papel y quitar miembro |
| S-13 | Aceptar invitación. Propuesta: token en una cabecera; la web lo leerá del fragmento, lo borrará de la barra con `history.replaceState` y lo guardará solo en memoria |
| S-14 | "Mis convocatorias asignadas" del empleado |
| S-15 | Editar la configuración de una convocatoria con solicitud y aprobación |
| S-16 / D-06 | Liberar responsables al cerrar, o poder retirarlos de una convocatoria `CLOSED` |

**Otras diferencias abiertas:**
- D-02: seguimiento, documento frente a código;
- D-03: la estimación es una sola, sin serie;
- D-04: sin listado de pendientes;
- D-05: CORS del ejemplo del runbook en `:5173`;
- D-07: cantidades con escala 4;
- D-08: relato de plantilla.

**Resueltas:** D-01 (la referencia ya dice unidades mínimas ISO 4217, como la web) y S-01 a S-04, S-07 y S-08.

## 4. Decisiones delegadas nuevas (todas `PENDIENTE DE RATIFICACIÓN`)

DW-31 a DW-43 en `decisiones-delegadas-web-2026-10.md`. Las de este periodo:

| id | Decisión |
|---|---|
| DW-35 | Listado real de convocatorias con acciones por fila, en lugar de "creadas en esta sesión" |
| DW-36 | Responsables elegidos entre los miembros, por `accountId` y papeles (sin nombres en el contrato), con texto si falla la lectura |
| DW-37 | Validación del reemplazo en los dos sentidos; cerrar con confirmación; sin cuerpo cuando no hay datos |
| DW-38 | Estimación: hoy frente al final estimado, sin inventar la evolución (D-03) |
| DW-39 | Ensayo conjunto como suite aparte, con los huecos por HTTP marcados y la evidencia sin secretos |
| DW-40 | Texto de `EmployeeAlreadyAssigned` |
| DW-41 | `/panel/platform`, pese a T6, porque la Autorización (2) lo pide; el identificador se escribe |
| DW-42 | Pantallas de fondos y activos, y desplegables en el camino A |
| DW-43 | Contraseña de al menos 12 caracteres en el registro |

## 5. Riesgos

- **D-06 en la demo:** tras cerrar una convocatoria, su empleado queda inservible. En la demo, no cerrar una convocatoria cuyo empleado vaya a hacer falta, o empezar con la base vacía.
- **Plataforma sin listado (D-04):** el administrador de plataforma necesita que la organización le comunique su identificador.
- **Estimación en una demo en vivo:** sin cifra hasta que la convocatoria empiece; conviene crearla con antelación.
- **Diseño:** ninguna pantalla está validada contra Penpot.
- **Sin GitHub Actions** (DW-17): la garantía es el CI local, con evidencia en cada PR.
- **La sesión vive solo en memoria** (D2): recargar cierra la sesión. Es lo decidido, pero sorprende en una demo.
