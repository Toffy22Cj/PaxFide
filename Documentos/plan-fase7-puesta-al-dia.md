# Plan de la Fase 7 — Poner la web al día con el backend

**Estado: APROBADO — Carlos, 2026-10-28.** Al aprobarlo quedan aprobadas también las decisiones U-1 a U-8 de §2. Las de §6 siguen pendientes y **no** se implementan.
**Fecha:** 2026-10-27 (UTC).
**Base verificada:** `paxfide-web` `develop` en `ba81b64`; backend `Donaciones` `develop` en `993c3e8`.
**Qué es:** el `implementation_plan` (regla 3.4) de las tareas P-0 a P-4. Con la aprobación de Carlos, el agente implementa **sin presentar otro plan**, en orden, y se detiene solo en los casos de §1.3.
**Relación con otros planes:** completa `plan-fase7-fidelidad.md` (APROBADO): P-2 junta F-A5 y F-C2, P-1 es F-C1 y P-3 es F-C3. Todas las reglas de ese plan siguen vigentes: §1 (fidelidad, inventario, capturas lado a lado, E2E de animaciones, sin superposiciones), §2 (D-F1 a D-F17) y §3 (desviaciones). También las de `plan-fase7-pantallas.md` §1.

---

## 0. Diagnóstico (revisión del código del 2026-10-27)

En la web están F-A0 a F-A4, F-B1 y F-B2. **No** están F-A5 ni F-C1 a F-C3, y no hay ninguna rama empezada.

Mientras tanto, el backend cambió cuatro contratos que la web usa. **Hoy la web falla contra el backend real**, aunque sus E2E siguen en verde porque el servidor falso tiene los contratos viejos:

| # | Fallo | Dónde | Contrato nuevo (`referencia-api-v1.md`) |
|---|---|---|---|
| R-1 | El registro solo envía `{email, password}` → 400, sin cuenta creada | `src/lib/api/identity.ts:84` | Nota del 2026-10-25 de §1 (R-5): `acceptedTermsVersion` y `acceptedDataPolicyVersion` |
| R-2 | El login no reconoce `403 AcceptanceRequired`. Las cuentas anteriores a R-5, **incluidas las de la semilla de la demo**, no pueden entrar | `src/lib/api/identity.ts:13-25`, `LoginScreen.tsx` | Nota del 2026-10-25 de §1 (D3) |
| R-3 | Crear una organización no envía `acceptedOrganizationTermsVersion` → 400 | `createOrganizationRequest` en `src/lib/api/organization.ts:163` | Misma nota de R-5 (fila `POST /organizations`) |
| R-4 | La entrega pide la evidencia como texto libre → 400 `InvalidEvidenceRef` | `src/components/asset/AssetActions.tsx:61` | Nota del 2026-10-25 de §6 (ADR-051 T4) y su nota del 2026-10-26 (410) |

Además, el backend ya tiene sin pantalla en la web: lo de F-C1 a F-C3, la reactivación de cuentas (D7), el logo y la portada (subirlos, quitarlos y mostrarlos), la lectura de la evidencia de entrega y la retirada de fotos por la plataforma.

---

## 1. Reglas comunes

### 1.1 Ramas, PR y evidencia

- Una rama y un PR por tarea, hacia `develop`, en orden: P-0 → P-1 → P-2 → P-3 → P-4. Cada una sale de la anterior; el PR dice "depende de #N" y, al mergear la anterior, se rebasa.
- **P-0 se mergea sola y primero:** arregla una demo rota. Las demás pueden esperar en sus PR.
- En cada PR:
  - `scripts/ci-local.sh` 10/10 sobre el último commit, con la salida literal;
  - el inventario de fidelidad y las capturas lado a lado de `plan-fase7-fidelidad.md` §1, cuando la pantalla tiene boceto;
  - si no lo tiene, capturas en claro y en oscuro a 390 y 1280 px;
  - aserciones negativas para cada rama de éxito, rechazo, ambiguo o fallo (regla 2.5).
- **Ensayo contra el backend real (nuevo).** Al final de P-0 y de P-4, `ensayo/ensayo-conjunto.spec.ts` contra un backend `develop` levantado, con la base de su commit. Se pega la salida literal y el commit del backend. Si no puedes levantar el backend, dilo y deja el ensayo listo para que lo corra Carlos: no lo des por pasado.

### 1.2 Contratos

- **La fuente es `Donaciones/Documentos/referencia-api-v1.md` en `develop`.** Antes de cada tarea, compara las filas que vas a usar con lo que dice este plan.
- **El servidor falso (`scripts/fake-backend.js`) se actualiza en la misma tarea** que cambia un contrato. Debe responder igual que el real, incluidos los errores, y sus nuevos casos solo se activan desde los tests (como el retraso de VS-1).
- **Ningún dato fuera del contrato.** El nombre de la persona nunca sale de `GET /account/profile` ni va a la URL, al almacenamiento, a los logs ni a otra petición.
- **Contraseñas:** solo en el estado del componente mientras dura el formulario, nunca en almacenamiento ni en la URL. El `trackingCode` sigue con T-1.

### 1.3 Cuándo DETENERSE

Los cinco casos de `plan-fase7-pantallas.md` §1.4, más dos:

6. Una fila de `referencia-api-v1.md` dice algo distinto de este plan.
7. Un caso de error que el contrato no describe y que la pantalla tendría que tratar.

---

## 2. Decisiones de este plan (se aprueban con él)

| # | Decisión |
|---|---|
| U-1 | **Versiones legales:** una sola constante, `LEGAL_VERSIONS = {terms, dataPolicy, organizationTerms}`, todas `v1-2026-10`, en `src/lib/legal/versions.ts`. La usan `LegalScreen` (que hoy repite la cadena tres veces), el registro, el login y crear organización. Test: las tres coinciden con la cabecera de `Documentos/legal/*.md` |
| U-2 | **Re-aceptación en el login (403 `AcceptanceRequired`):** en la misma tarjeta del login aparece "Actualizamos nuestras condiciones", con una casilla, sin marcar, por cada versión pendiente (`pendingTermsVersion`, `pendingDataPolicyVersion`), con enlace a su texto en una pestaña nueva, y el botón "Aceptar y entrar". Ese botón repite el login con el correo y la contraseña que siguen en el estado del formulario y las versiones aceptadas. "Cancelar" vuelve al login y borra la contraseña del estado. Si la versión pendiente no es `LEGAL_VERSIONS`, se DETIENE: hay un texto que la web no tiene |
| U-3 | **Entrega con foto:** en el formulario de entrega de `/assets/:assetRef`, "Foto de la entrega" (`<input type=file accept="image/jpeg,image/png" capture="environment">`) sustituye a "Evidencia (referencia)". El flujo:<br>1. Antes de enviar, se comprueba el tamaño: más de 5 MB no se sube.<br>2. Se sube a `POST /organizations/{id}/delivery-evidence` (sin `Command-Id`), mostrando el progreso.<br>3. Con el `evidenceRef` que devuelve, se entrega con la máquina de comandos de siempre (D6). Si la entrega queda ambigua, el reintento usa el mismo `Command-Id` y el mismo `evidenceRef`, sin volver a subir la foto.<br><br>Cada error tiene texto propio: 413, 415, 410 `EvidenceRemoved`, 503, 400 `EvidenceNotFound` / `InvalidEvidenceRef` y 409 `EvidenceAlreadyBound`. El botón solo se muestra a quien puede entregar (`EMPLOYEE`, como hoy) |
| U-4 | **Imágenes con JWT** (logo privado `GET /organizations/{id}/logo` y evidencia `GET /physical-assets/{ref}/evidence`): se piden con `fetch` y la cabecera de siempre, se muestran con `URL.createObjectURL` y se libera la URL al desmontar. Nunca se pone el token en un `src`. Las públicas (`organizationLogoUrl`, `coverImageUrl`) van directas en `<img>`, con texto alternativo y sin bloquear la carga de la pantalla |
| U-5 | **Dónde se suben el logo y la portada:**<br>- **Logo:** en `/panel/organization` ("Mi organización"), para `REPRESENTATIVE` y `ADMINISTRATOR`, con "Cambiar logo" y "Quitar logo". La vista previa se muestra antes de subir. "Quitar" pide confirmación sin diálogo del navegador.<br>- **Portada:** en la pantalla de configuración de cada convocatoria (`ConfigurationScreen`), solo para `ADMINISTRATOR`, con "Cambiar portada" y "Quitar portada".<br><br>Ninguna de las dos lleva `Command-Id`. Antes de subir se comprueba el límite de 2 MB |
| U-6 | **La portada en las tarjetas y en el detalle:** `CampaignCard` y `/c/:publicCode` muestran `coverImageUrl` si llega. Si no, el aspecto actual, con el logo o la inicial. Así se cierra la nota "coverImageUrl no se usa" de D-P10 |
| U-7 | **Plataforma** (`/panel/platform`), dos bloques nuevos, solo con `platformAuthority`:<br>- **"Reactivar una cuenta":** campo con el ID de la cuenta y un botón. 200 → "Cuenta activa". 404 → "No existe esa cuenta".<br>- **"Retirar una foto":** organización (de la cola de verificación o por su ID), tipo (logo, portada o evidencia), referencia (`campaignRef` para la portada, `evidenceRef` para la evidencia, nada para el logo) y motivo de 1 a 500 caracteres. 204 → "Foto retirada". El motivo nunca se guarda en el navegador ni sale en un log |
| U-8 | **Ver la evidencia:** en `/assets/:assetRef`, un lote `DELIVERED` muestra "Foto de la entrega" con U-4, para los miembros de la organización. 404 → "Sin foto", 410 → "La plataforma retiró esta foto". En el seguimiento público solo sale la huella (`evidenceRegistered`, `evidenceRef`), nunca la imagen (P-2) |

---

## 3. Tareas

### P-0 · `fix/web-contratos-backend` — urgente: la demo vuelve a funcionar

1. **U-1:** la constante de versiones.
2. **R-1, el registro:** dos casillas sin marcar, "Acepto los Términos y condiciones" y "Autorizo el tratamiento de mis datos personales", con enlace a `/terminos` y `/privacidad`. El botón no se habilita sin las dos. Se envían las dos versiones, y el 400 sin versión válida tiene texto propio.
3. **R-2, el login:** U-2.
4. **R-3, crear organización:** casilla sin marcar "Acepto los Términos para organizaciones" (→ `/terminos-organizacion`) y envío de `acceptedOrganizationTermsVersion`.
5. **R-4, la entrega:** U-3. Quitar el campo de texto libre.
6. **Servidor falso:** registro, login con 403 y organización con versiones; la subida de evidencia con sus errores; la entrega que valida el formato `sha256:`.
7. **Tests:**
   - registro sin casillas → botón deshabilitado y ninguna petición (negativa);
   - con las casillas → cuerpo con las dos versiones;
   - 403 → pantalla de aceptación; "Aceptar y entrar" → segundo login con las versiones; "Cancelar" → la contraseña ya no está en el DOM;
   - 401 tras aceptar → el mismo texto único de siempre (ADR-038 §2.6);
   - organización con y sin casilla;
   - entrega: foto de 6 MB → no se sube (negativa); 415 → texto; subida y entrega ambigua → el reintento no vuelve a subir y usa el mismo `evidenceRef` y `Command-Id` (negativas);
   - el campo "Evidencia (referencia)" ya no existe (negativa).
8. **Ensayo** contra el backend real (§1.1), con una cuenta de la semilla que pase por la re-aceptación.
9. **Aviso:** en el PR, un párrafo para Adonis con los cuatro contratos, porque es muy probable que el móvil tenga los mismos fallos.

### P-1 · `feat/web-account-security` — F-C1 completa + D7

Lo que dice `plan-fase7-fidelidad.md` §5b F-C1, con estos contratos (todos en §1 de `referencia-api-v1.md`):

- **Cambiar contraseña** (`POST /account/password`):
  - el token de la respuesta sustituye al de la sesión en memoria;
  - 400 `CurrentPasswordIncorrect` va en el campo y **no** cierra la sesión;
  - un 500 lleva al login con "Tu contraseña cambió; vuelve a iniciar sesión".
- **"¿Olvidaste tu contraseña?"** en el login → pantalla que pide el correo (`POST /auth/password-reset`):
  - siempre el mismo mensaje, que incluye "si no llega, vuelve a pedirlo en 5 minutos";
  - `/recuperar` (superficie nueva, autorizada por D-F16) lee `#token=`, lo borra de la barra **antes** de cualquier otra cosa (como `/invitaciones`) y pide la contraseña nueva;
  - 204 → al login con "Ya puedes entrar con tu contraseña nueva";
  - el 400 `PasswordResetTokenInvalid` tiene un único texto;
  - `PasswordTooShort` no consume el token: se puede corregir y reenviar.
- **Nombre** (`GET` y `PUT /account/profile`):
  - "¿Cómo te llamamos?" tras la bienvenida (D-F10), opcional y con "Más tarde";
  - nombre y apellido editables en el Perfil, de 1 a 100 caracteres;
  - saludo del home con `givenName` si existe (sustituye a D-P7 solo en ese caso).
- **Desactivar la cuenta** (`POST /account/deactivate`):
  - en el Perfil, en la tarjeta "Seguridad", con la contraseña actual y una confirmación;
  - texto propio para `RepresentativeTransferRequired`, `ActiveCampaignResponsible` y `PlatformAdministratorDeactivation`;
  - 204 → se cierra la sesión.
- **Tarjeta "Seguridad" del Perfil** (X-9 deja de ser desviación).
- **D7:** U-7, la parte de reactivar.
- **Tests:**
  - cada ruta con su éxito, su rechazo y su fallo, con negativas cruzadas;
  - tras cargar `/recuperar` el token ya no está en `location.href`;
  - el nombre no aparece en ninguna petición distinta de `/account/profile`;
  - tras cambiar la contraseña, la siguiente petición usa el token nuevo (se comprueba en la cabecera enviada, no en el estado).

### P-2 · `feat/web-tracking-fidelity` — F-A5 + F-C2 juntas

- La línea de tiempo de `paxfide-linea-tiempo.html`, como dice F-A5. Con los datos que ya están en el backend:
  - **raíz "Donada" con la fecha del pago:** `firstClearedAt`, y `lastClearedAt` si es distinta;
  - **árbol de sublotes** con `parentAssetRef`. Un padre ausente hace de raíz;
  - **`anchorStatus` por paso,** con texto de `labels.ts`. `UNDER_REVIEW` va en amarillo con icono;
  - **"Huella criptográfica":** `eventHash` recortado con "Copiar" (que copia el completo) y, con `anchorProof`, **"Comprobar en mi navegador"**:
    - algoritmo exacto de la nota G-3/E1 de `referencia-api-v1.md` §8, con `crypto.subtle.digest`;
    - resultado "Coincide" o "No coincide";
    - enlace a `transactionHash` en el explorador, solo para las redes de una tabla cerrada (Sepolia y Amoy; otra red → sin enlace);
    - el texto dice qué prueba y qué no (E1.4);
  - **huella de la foto de entrega:** en el paso `DELIVERED`, "Con foto de entrega" y su `evidenceRef` recortado si `evidenceRegistered`; "Sin foto" si es `false`. Nunca la imagen (U-8).
- Desviaciones vigentes: X-15 solo para el nombre del lote y el destinatario; X-16.
- **Tests:**
  - el verificador con los vectores de `Donaciones/crypto/src/test/resources/merkle/proof-vectors.json`, copiados a un fixture de la web con su origen en un comentario: 5 hojas con índice 4 y con índice 2;
  - una prueba alterada da "No coincide" (negativa);
  - sin `anchorProof`, no hay botón (negativa);
  - con `ANCHORED` sin prueba, se explica que es un lote antiguo;
  - el árbol con un padre ausente;
  - el camión solo conduce con `ASSET_DISPATCHED` como último evento;
  - los tests de VS-7 y T-1 siguen en verde.

### P-3 · `feat/web-panel-time-data` — F-C3

- **KPI "Recaudado en <mes>":**
  - sale del mes actual de `GET /organizations/{id}/funds/monthly` (en su `timezone`);
  - lleva una mini serie de 6 meses en SVG, sin librería;
  - `truncated` → aviso.
- **KPI "Integridad":** `GET /organizations/{id}/integrity`, solo `ADMINISTRATOR` o `REPRESENTATIVE`:
  - "Al día", "N pasos esperan anclaje" o "N en revisión" (en amarillo), y `lastAnchoredAt`;
  - `truncated` → aviso.
- **"Actividad reciente":** `GET /organizations/{id}/activity`, para los tres roles:
  - 20 por página con "Ver más";
  - texto de cada `type` en `labels.ts`, con un switch exhaustivo y `never`;
  - `BATCH_ANCHORED` sin sujeto y con `eventCount`;
  - `truncated` → aviso "Se muestra la actividad de los 10 000 fondos y lotes más recientes".
- **Columna "Último cambio"** (`lastEventAt`) y "desde hace más de 3 días" en "Por hacer".
- **Tests:**
  - meses en 0;
  - dos monedas;
  - cada `type` de actividad (un tipo desconocido falla en compilación);
  - lote sin `lastEventAt` → celda vacía, no "hace 0 días";
  - el empleado no pide la integridad (negativa).

### P-4 · `feat/web-media` — logo, portada y evidencia

- **U-4, U-5, U-6, U-7** (la parte de retirar) y **U-8.**
- **Servidor falso:** `PUT` y `DELETE` del logo y de la portada, la lectura de la evidencia (200, 404 y 410) y la retirada de fotos.
- **Tests:**
  - más de 2 MB → no se sube (negativa);
  - 403 → texto;
  - quitar → la vista vuelve a la inicial;
  - la portada aparece en la tarjeta y en el detalle, y sin ella el aspecto anterior;
  - la imagen privada se pide con `Authorization` y nunca hay un token en un `src` (negativa sobre el DOM);
  - la URL del blob se libera al desmontar;
  - el representante no ve "Cambiar portada" (negativa).
- **Ensayo final** contra el backend real (§1.1).

---

## 4. Orden

```
develop (ba81b64)
   └── P-0 (urgente, se mergea sola) → P-1 → P-2 → P-3 → P-4
```

Un solo agente, en serie. Estimación: 5 PR.

---

## 5. Lo que este plan no toca

- Búsqueda y filtros de convocatorias: R-1 no está en el backend.
- Google: ADR-050 R-6, pospuesto.
- "Escanear QR" en la web: sin decidir.
- La app móvil: es de Adonis. P-0 le deja el aviso.

## 6. Pendientes de Carlos (no se implementan)

| # | Pregunta |
|---|---|
| PD-1 | **"Mi impacto"** (`GET /account/impact`, boceto 05 de Manuel). ¿Entra? Si entra: ¿ruta nueva `/account/impact`, o una tarjeta en el home y en el Perfil sin ruta nueva? |
| PD-2 | **Comprobante como imagen (M-22).** Manuel decidió que lo generen la web y el móvil. ¿Entra en la web? ¿Con qué campos? Recuerda que el `trackingCode` nunca puede ir en él (T1-7) |
