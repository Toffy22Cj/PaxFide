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
| PD-1 | ~~"Mi impacto"~~ | **Resuelto (Carlos, 2026-10-28): tarjeta en el inicio y en el Perfil, sin ruta nueva. Anexo 1, P-7** |
| PD-2 | ~~Comprobante como imagen (M-22)~~ | **Resuelto (Carlos, 2026-10-28): Anexo 1, P-5** |

---

## Anexo 1 (2026-10-28) — Comprobante y verificación del correo

**Estado: APROBADO — Carlos, 2026-10-29.** P-0 a P-4 ya están en `develop` (#44 a #48). Este anexo añade dos tareas. Las reglas de §1 rigen igual.

### A1.1 Decisiones (Carlos, 2026-10-28, al aceptar las recomendaciones del comprobante)

| # | Decisión |
|---|---|
| U-9 | **Solo se generan comprobantes de donaciones `CONFIRMED`.** Las demás muestran su estado y no tienen el botón |
| U-10 | **Campos, todos de `GET /account/donations`:**<br>- título "Comprobante de donación" y la marca PaxFide;<br>- convocatoria (`campaignTitle`) y organización (`organizationName`);<br>- monto y moneda (`money.ts`);<br>- medio de pago (`labels.ts`);<br>- fecha de la donación (`createdAt`) y del pago confirmado (`confirmedAt`), en hora local y con la zona;<br>- referencia (`intentId` recortado a sus 6 últimos caracteres, `…a3f9c2`);<br>- enlace a `/c/{publicCode}`, solo si llega `publicCode`;<br>- fecha en que se generó;<br>- leyenda fija: "Este comprobante no es un certificado de donación para efectos tributarios; ese lo expide la organización".<br><br>Si falta un campo opcional, su fila no aparece: nada de "—" ni de "Desconocido" |
| U-11 | **Nunca van:** el `trackingCode` (T1-7), el correo, el `donorRef` ni el `fundId` |
| U-12 | **El nombre es opcional:** casilla sin marcar, "Incluir mi nombre". Solo aparece si `GET /account/profile` devuelve nombre o apellido. La preferencia no se guarda |
| U-13 | **Formato:** imagen PNG de 1200 × 1600 px, dibujada en un `<canvas>` 2D sin dependencias (D8), con las fuentes autoalojadas (se espera a `document.fonts.ready`) y siempre en el tema claro. Los colores son tokens leídos con `getComputedStyle` de un contenedor con `data-theme="light"`, sin hexadecimales. Se descarga como `comprobante-paxfide-<referencia>.png`. Al lado va el botón "Imprimir", con una vista imprimible con los mismos campos |

### P-5 · `feat/web-donation-receipt` — el comprobante

- **Dónde:** el botón "Descargar comprobante" va en cada donación `CONFIRMED` de `/account/donations`.
- **Lógica pura** en `src/lib/receipt/receiptModel.ts`: `buildReceipt(donation, name?)` devuelve las filas del comprobante, o `null` si la donación no es `CONFIRMED`. El dibujo, en `src/components/receipt/ReceiptCanvas.ts`, solo dibuja ese modelo.
- **Tests:**
  - el modelo con todos los campos y con cada opcional ausente;
  - `null` para `PENDING`, `FUNDING_REJECTED` y los demás estados (negativas);
  - **el `trackingCode` nunca está en el modelo, ni en ninguna llamada a `fillText`** (un espía sobre el contexto del canvas recoge todo el texto dibujado; aserción negativa con una donación que sí trae `trackingCode`);
  - sin la casilla no se dibuja el nombre y con ella sí;
  - sin `publicCode` no hay enlace;
  - E2E: el botón no existe en una donación no confirmada (negativa), y en una confirmada se descarga un PNG del tamaño fijado.

### P-6 · `feat/web-email-verification` — **espera al backend**

**Empieza solo cuando la Enmienda 2 de ADR-050** (`Donaciones/Documentos/ADR-050-enmienda-2-verificacion-correo-y-avisos.md`) **esté APROBADA e implementada en `develop`, con su contrato en `referencia-api-v1.md`.** Si el contrato publicado no coincide con lo de abajo, DETENTE.

- **Tras registrarse:** la pantalla "Revisa tu correo", con el correo al que se envió y el botón "Reenviar" (`POST /auth/email-verification`). Siempre el mismo mensaje: "Si no llega, revisa el spam o vuelve a pedirlo en 5 minutos".
- **`/verificar-correo`** (superficie nueva, autorizada por este anexo): lee `#token=` y lo borra de la barra **antes de nada**, como `/recuperar`. Después envía `POST /auth/email-verification/confirm`:
  - 204 → al login con "Tu correo quedó verificado";
  - 400 → "El enlace no es válido o caducó", con "Reenviar".
- **Login con 403 `EmailNotVerified`:** "Antes de entrar, confirma tu correo", con "Reenviar". La contraseña se borra del estado.
- **Perfil:** si `GET /account` trae `emailVerified: false`, un aviso con "Reenviar". Con Q1 (a) no debería pasar, pero el campo existe.
- **Bienvenida (D-F10):** se muestra en el primer login después de verificar, en la misma pestaña en la que se registró.
  > **Nota (2026-10-31, corrección de Carlos al implementar P-6):** este punto queda **superado por U-16 (Anexo 2)**. La bienvenida ya no depende de la pestaña ni de un aviso en memoria: sale en `/home` por la clave `paxfide.welcome-done.<accountId>` (P-8). P-6 **no** reintroduce `justRegistered`; tras verificar el correo y entrar, la bienvenida sale igual en cualquier pestaña.
- **Servidor falso:** las dos rutas, el 403 y `emailVerified`.
- **Tests:**
  - tras cargar `/verificar-correo` el token ya no está en `location.href`;
  - el 403 no deja la contraseña en el DOM (negativa);
  - "Reenviar" muestra siempre el mismo texto, exista o no la cuenta;
  - el 401 de una contraseña errónea sigue con su texto único (negativa: no menciona la verificación).

### P-7 · `feat/web-impact-card` — "Mi impacto" como tarjeta

**U-14 (Carlos, 2026-10-28):** "Mi impacto" es una tarjeta, no una ruta. Va en `/home` y en el Perfil (`/account`), y las dos usan el mismo componente. La entrada a la barra no cambia.

**Datos:** `GET /account/impact` (`referencia-api-v1.md` §1, nota del 2026-10-25), con el JWT de cualquier cuenta.

| Dato | Se muestra | Regla |
|---|---|---|
| `donationsCount` | "N donaciones confirmadas" | Solo cuenta las `CONFIRMED` |
| `totals` | "Aportaste" y un monto por moneda (`money.ts`) | **Nunca se suman monedas distintas**: una línea por moneda |
| `campaignsSupported` | "N convocatorias apoyadas" | — |
| `deliveredUnits` | "Unidades entregadas en las convocatorias que apoyaste": una línea por unidad de medida (`quantity.ts`) | **Texto obligatorio** (P-M21-4): nunca "tus unidades" ni "entregaste" |
| `truncated` | Nota: "Se cuentan tus 100 donaciones más recientes" | Solo si es `true` |

- **Una cuenta sin donaciones** (ceros y listas vacías) no ve cifras en cero: ve "Aún no tienes donaciones confirmadas", con el enlace "Explorar convocatorias" (→ `/campaigns`).
- **Estados:** carga con `Skeleton`; si falla, un error con "Reintentar" que no bloquea el resto del inicio ni del Perfil; un 401 sigue el flujo de sesión de siempre.
- **Estilo:** tarjeta del sistema v2, con la entrada `rise` del inicio (F-A4). Las cifras grandes usan la escala tipográfica, sin hexadecimales.
- **Tests:**
  - cada campo y su texto;
  - dos monedas → dos líneas y ningún total combinado (negativa);
  - `deliveredUnits` vacío → la sección no aparece;
  - el texto nunca dice "tus unidades" ni "entregaste" (negativa sobre el DOM);
  - cuenta sin donaciones → el estado vacío, sin "0";
  - `truncated` con y sin la nota;
  - error de red → el resto del inicio sigue visible;
  - la tarjeta aparece en `/home` y en `/account`, y no existe la ruta `/account/impact` en la web (404 por D5).

### A1.2 Orden

```
develop (1295184)
   ├── P-5 (ya)
   ├── P-7 (ya, después de P-5)
   └── P-6 (cuando el backend de la Enmienda 2 esté en develop)
```

No queda ningún pendiente en §6.

---

## Anexo 2 (2026-10-29) — Bienvenida, ancho del inicio con transparencia y error del Perfil

**Estado: APROBADO — Carlos, 2026-10-29.** Sale de la revisión de Carlos sobre `develop` `1295184` (capturas del 2026-10-28):
1. tras crear una cuenta, **no apareció la bienvenida**;
2. las tarjetas del inicio son estrechas y tapan el fondo;
3. `/account` muestra "No se pudo cargar la información del perfil".

### A2.1 Diagnóstico

- **La bienvenida no es fiable.** D-F10 la ligó a un aviso **en memoria** (`justRegistered`, `src/lib/auth/session.ts:16`) que se pierde con cualquier recarga, con un enlace abierto en otra pestaña o al escribir la URL. Con la Enmienda 2 de ADR-050 el primer inicio de sesión llega casi siempre desde el enlace de verificación del correo, en otra pestaña, así que fallaría siempre. Además se muestra dentro de `LoginScreen` y no sobre el inicio.
- **La opacidad de R-F1** (0,88 en claro y 0,86 en oscuro) casi no deja ver el fondo. Recalculado con la fórmula del Anexo A de la enmienda 1 del sistema visual, para el peor caso (fondo blanco, negro, amarillo de marca y las dos bases), con texto principal y secundario:

  | Opacidad | Mínimo en oscuro | Mínimo en claro |
  |---|---|---|
  | 0,88 / 0,86 (hoy) | ≥ 6,25 | ≥ 5,75 |
  | **0,82** | **5,09** | **5,13** |
  | 0,80 | 4,74 | 4,71 |
  | 0,75 | 3,99 | 4,12 (no cumple) |

  Con **0,82** todo el texto sigue por encima de 4,5 con margen. Con 0,80 queda demasiado justo, y con menos no cumple. El desenfoque mejora la lectura, pero no se cuenta para el contraste.
- **El error del Perfil** sale de `GET /account` (`ProfileScreen.tsx:78`). La pantalla muestra el mismo texto para cualquier fallo, **incluido un 401**: eso es un defecto de la web, porque un 401 debe seguir el flujo de sesión. La causa concreta del fallo no se sabe sin el estado HTTP (§A2.3, P-10).

### A2.2 Decisiones (se aprueban con el anexo)

| # | Decisión |
|---|---|
| U-15 | **Bienvenida grande y fiable** (sustituye el disparador de D-F10). Es una capa a pantalla completa sobre el inicio, con la ciudad detrás desenfocada y una tarjeta centrada de hasta 640 px, en el estilo del boceto (`paxfide-home.html`, `sWelcome` y `sData`). Tres pasos con sus puntos:<br>1. **"Te damos la bienvenida a PaxFide"**: los cubos encadenados y las tres ideas del boceto (convocatorias verificadas, sigue el recorrido, cada paso queda sellado).<br>2. **"Así te mueves por PaxFide"**: las entradas de la barra **que esa cuenta ve de verdad** (`navEntriesFor`), cada una con su icono y una línea; más "Ver ciudad", el tema y "Pausar animación".<br>3. **"¿Cómo te llamamos?"**: nombre y apellido opcionales (`PUT /account/profile`), con **"Guardar"** y **"Después"**.<br><br>"Saltar" está en todos los pasos. Se cierra con Escape, el foco queda dentro de la capa y vuelve al inicio al cerrarla. Con "reducir movimiento", sin animaciones |
| U-16 | **Cuándo sale:** en el primer `/home` tras iniciar sesión, si la cuenta **no tiene nombre** (`GET /account/profile`) y en **ese navegador** no se cerró antes la bienvenida para **esa cuenta**. El cierre ("Saltar", "Después" o "Guardar") se guarda en `localStorage` con `try/catch`, con la clave `paxfide.welcome-done.<accountId>`. El `accountId` es opaco, y nunca se guardan el correo ni el nombre. Si el almacenamiento falla, se muestra una sola vez por sesión. **El aviso `justRegistered` y la bienvenida dentro de `LoginScreen` se retiran.** Así funciona con la verificación del correo y en otra pestaña |
| U-17 | **El inicio más ancho y translúcido** (enmienda de R-F1, decisión de Carlos con los números de A2.1):<br>- `--color-surface-translucent` pasa a `rgba(255,255,255,.82)` en claro y a `rgba(16,38,29,.82)` en oscuro, siempre con `backdrop-filter: blur(20px) saturate(1.2)`;<br>- en el navegador que no admita `backdrop-filter`, la superficie vuelve a la opacidad de antes (0,88 / 0,86), con `@supports not`;<br>- los campos siguen sólidos;<br>- **la rejilla del inicio crece hasta 1200 px** (hoy es una columna estrecha), con dos columnas desde 1024 px y la de "Seguir una donación" más ancha, como en el boceto;<br>- la píldora "Sector" y "Ver ciudad" no se tapan.<br><br>La enmienda del sistema visual recibe una nota fechada con esta tabla. **Es el único cambio de `globals.css` del anexo** |

### A2.3 Tareas

**P-8 · `feat/web-welcome`** — U-15 y U-16.
- **Tests:**
  - sale para una cuenta sin nombre que no la cerró;
  - no sale si tiene nombre, ni si ya se cerró en ese navegador (negativas);
  - "Después" no envía `PUT`; "Guardar" sí;
  - el paso 2 de un donante no muestra "Organización" (negativa), y el de un administrador sí;
  - el foco se queda dentro de la capa y Escape la cierra;
  - en `localStorage` solo aparece la clave con el `accountId`, nunca el correo ni el nombre (negativa);
  - con `localStorage` que lanza un error, la capa sale una vez y la página no se rompe;
  - el `LoginScreen` ya no tiene bienvenida (negativa).
- Capturas lado a lado con `sWelcome` y `sData` del boceto, en claro y en oscuro.

**P-9 · `feat/web-home-wide-glass`** — U-17.
- **Tests:**
  - la prueba de contraste de C-1 en claro y en oscuro sigue en verde con 0,82;
  - una prueba nueva calcula con la fórmula del Anexo A el peor caso de 0,82 y falla si baja de 4,5;
  - `@supports not (backdrop-filter…)` devuelve la opacidad antigua (prueba sobre el CSS);
  - a 1280 y 1920 px, la rejilla mide más de 1000 px y nada se superpone (§1.4 del plan de fidelidad).
- Capturas antes y después.

**P-10 · `fix/web-profile-load`** — primero el diagnóstico.
- Reproducir contra el backend real de `develop`.
- Pegar el estado HTTP y el cuerpo (sin el correo) de `GET /api/v1/account` y de `GET /api/v1/account/profile`.
- Según el resultado:
  - **401** → el flujo de sesión de siempre, no el error de la pantalla;
  - **404** → el backend levantado es anterior: no es un fallo de la web, se dice en el PR y no se cambia código para taparlo;
  - **500 o CORS** → DETENTE y repórtalo, porque es del backend o de la configuración;
  - **200 con otro cuerpo** → DETENTE: el contrato no coincide.
- **En todos los casos se arregla el defecto de A2.1:** `ProfileScreen` trata el 401 como cualquier otra pantalla autenticada, con un test que lo prueba.
- El fallo de `GET /account/profile` no debe tumbar la pantalla: ya está separado, y se comprueba con un test.

### A2.5 Añadido (2026-10-28) — Salida al cerrar sesión

Carlos, 2026-10-28: *"cuando cierras sesión debería haber un botón que redirija al login, porque me toca usar las flechas del navegador"*.

**Diagnóstico** (`develop` `1295184`):
- `Shell.tsx:157` muestra "Cerrar sesión" solo con sesión. `session.logout()` no navega; quien navega es `RouteGuard`, y **solo en rutas autenticadas** (`RouteGuard.tsx:39`).
- En una ruta **pública con la barra de la app** (`/campaigns`, `/c/…`, `/tracking`, `/terminos`, `/privacidad`, `/invitaciones`, `/recuperar`), al cerrar sesión el botón desaparece y **no queda nada que lleve al login**: ni en la cabecera ni en la barra (`navEntriesFor` no tiene una entrada de login para quien no tiene sesión). Es el caso que describe Carlos.
- Además, en una ruta autenticada `RouteGuard` guarda esa ruta como destino tras el login (`RouteGuard.tsx:40`). Eso tiene sentido si la sesión caducó, pero no tras un cierre voluntario: el siguiente que entre en ese navegador volvería a la pantalla del anterior.
- `LoginScreen.tsx:31` no da ningún aviso para `MANUAL`.

| # | Decisión |
|---|---|
| U-18 | **Cerrar sesión lleva siempre al login.** Tras `session.logout()` (motivo `MANUAL`), la web navega con `router.replace('/login')` desde cualquier ruta, pública o autenticada. No se guarda destino tras el login. `LoginScreen` muestra "Cerraste sesión." para `MANUAL`. `replace` evita que la flecha "atrás" vuelva a la pantalla con sesión (el invariante 4 de bfcache sigue igual) |
| U-19 | **Botón "Iniciar sesión" en la cabecera sin sesión.** En el sitio de "Cerrar sesión", cuando la ruta lleva la barra de la app, no es de tipo `AUTH` y no hay sesión, la cabecera muestra un enlace "Iniciar sesión" a `/login`. Cubre la sesión caducada y el cierre desde otra pestaña (`EXPIRED`, `OTHER_TAB`) en las páginas públicas. La landing `/` no cambia: ya tiene sus botones (D-P13) |

**P-11 · `fix/web-logout-destination`** — U-18 y U-19.
- **Tests:**
  - cerrar sesión en `/home`, en `/panel` y en `/campaigns` termina en `/login` con "Cerraste sesión.";
  - tras cerrar sesión, iniciarla de nuevo lleva al destino por defecto, no a la pantalla anterior (negativa del destino guardado);
  - tras cerrar sesión, `history.back()` no muestra contenido con sesión (negativa, Playwright);
  - sin sesión en `/campaigns` y `/tracking`, la cabecera muestra "Iniciar sesión" y lleva a `/login`;
  - en `/login` y `/register` no aparece (negativa), y con sesión tampoco (negativa);
  - un cierre desde otra pestaña (`OTHER_TAB`) en una ruta pública deja visible "Iniciar sesión";
  - la caducidad (`EXPIRED`) en una ruta autenticada sigue guardando el destino, como hoy (sin regresión).
- Sin cambios en `globals.css` ni dependencias nuevas.

### A2.6 Orden

```
P-5 → P-7 → P-10 + P-11 (rápidos) → P-8 → P-9
P-6 cuando el backend de la Enmienda 2 esté en develop
```

P-8 va antes que P-6, para que la verificación del correo ya encuentre la bienvenida nueva.

---

## Anexo 3 (2026-10-31) — Búsqueda, filtro y orden de convocatorias (P-12)

**Estado: APROBADO — Carlos, 2026-10-31.** Con él quedan aprobadas U-20 a U-26 con las respuestas de A3.5 y la precisión de U-23. Las reglas de §1 rigen igual.

**Origen:** la ficha R-1 del backend (`Donaciones/Documentos/ficha-R1-busqueda-descubrimiento-convocatorias.md`; `referencia-api-v1.md` §5, nota del 2026-10-29; #159) ya está en `develop` (`b0654aa`). En la web solo existía como pendiente: X-11 de `plan-fase7-fidelidad.md` ("Filtros por causa y búsqueda", ⏳ R-1) y §5 de este plan ("Búsqueda y filtros de convocatorias: R-1 no está en el backend").

> **Aviso de nombres:** en este plan, "R-1" (§1.2) es el registro con las casillas legales. Aquí "ficha R-1" es siempre la del backend.

### A3.1 Contrato comprobado contra el código

Comprobado en `PublicCampaignDiscoveryController` (Donaciones `b0654aa`), no solo en el documento. Coinciden:

| Parámetro | Regla del servidor |
|---|---|
| `q` | Se recorta (`strip`) y debe tener **de 2 a 100 puntos de código**. Subcadena del título, sin distinguir mayúsculas ni tildes. `?q=` vacío o de solo espacios → 400 |
| `donationType` | `MONETARY` o `IN_KIND`; la convocatoria tiene que aceptar ese tipo |
| `sort` | `ending_soon` (`endDate` ascendente) o `recent` (`startDate` descendente). Sin `sort`, `publicCode` ascendente, como hoy. Desempate siempre por `publicCode` |
| `cursor` | Versión 2: lleva dentro `q` (normalizado), `donationType` y `sort` de la petición que lo emitió. Con otros filtros → 400. Un cursor v1 solo vale sin filtros ni orden |
| Errores | **Todos son el mismo 400 `BadRequest` con el cuerpo fijo** (`InvalidRequestFieldException`). La web **no puede saber** qué campo falló, ni si el problema era el cursor |
| Respuesta | No cambia: `{items, nextCursor?}`. Nunca lista `PRIVATE_LINK` ni `CLOSED` |

### A3.2 La contradicción con el boceto

`paxfide-landing.html` filtra **"por causa"** ("🌾 Nutrición", "💧 Agua limpia"…). **El backend no tiene causas ni categorías:** solo `q` (título), `donationType` y `sort`. Por la regla de los prototipos (`prompts-agentes-estilo-v2.md` §2) **no se inventan categorías** ni se filtra en el cliente para simularlas: buscar "agua" en el título no es una categoría y daría resultados engañosos.

**Propuesta (U-20):** las píldoras del boceto se sustituyen por las dos que el contrato sí tiene, **"Dinero"** y **"Especie (bienes)"** (`donationTypeLabel`), más "Todas". Lo de las causas se lista en el PR como "no implementado: sin contrato".

### A3.3 Decisiones propuestas

| # | Decisión propuesta | Alternativa |
|---|---|---|
| U-20 | **Dónde:** la búsqueda, el filtro y el orden van **solo en `/campaigns`**, sobre la lista que ya tiene "Cargar más". La landing conserva su bloque "Convocatorias" (las primeras N) y añade el enlace **"Buscar convocatorias"** → `/campaigns`. Así la landing no duplica la lógica de paginación | (b) También un buscador en la landing que lleva a `/campaigns?q=…` |
| U-21 | **Controles:** un campo "Buscar por nombre" (`role="search"`, se envía con Enter o con el botón "Buscar", sin búsqueda mientras se escribe), las píldoras "Todas · Dinero · Especie (bienes)" y un selector "Ordenar" con "Más recientes" (`recent`) y "Cierran pronto" (`ending_soon`) | Búsqueda mientras se escribe, con espera de 300 ms: más peticiones y más estados intermedios |
| U-22 | **Orden por defecto en `/campaigns`: "Más recientes" (`sort=recent`).** Hoy el orden es `publicCode`, que no significa nada para el donante | Mantener el orden de hoy (sin `sort`) |
| U-23 | **"Cierran pronto" (D-F12) pasa a `sort=ending_soon` del servidor en todos los sitios donde se calcula hoy** (`/home` y la landing), sin depender de U-20 (precisión de Carlos al aprobar, 2026-10-31). Hoy se calcula en el cliente sobre la **primera página en orden de `publicCode`**, así que puede no ver una convocatoria que cierra mañana y está en la página 2. Con `ending_soon` las primeras son las que cierran antes; la regla de D-P9 (7 días o menos) y el respaldo "Convocatorias abiertas" no cambian. Para el respaldo, una segunda petición sin `sort` solo si la primera no trae ninguna a 7 días | No cambiarlo (sigue el fallo descrito) |
| U-24 | **Validación en el cliente igual que el servidor:** `q` se recorta y se cuentan **puntos de código** (`Array.from`, como `nameLength`), no unidades UTF-16. Menos de 2 → no se envía y se muestra "Escribe al menos 2 caracteres". Más de 100 → "Escribe como máximo 100 caracteres". **Nunca se envía `q` vacío:** campo vacío = sin `q` | — |
| U-25 | **Cursor v2:** el cursor pertenece a la combinación `{q, donationType, sort}` con la que se pidió. **Cambiar cualquier filtro empieza sin cursor** y vacía la lista. Una respuesta tardía de otra combinación se descarta (como `useRead`). **Un 400 en una petición con cursor** (no se puede distinguir del resto, A3.1) reinicia la lista una vez, sin cursor y con los mismos filtros, con el aviso "La lista se actualizó". Un 400 sin cursor, que con U-24 no debería pasar, es el error de pantalla con "Reintentar" | — |
| U-26 | **Filtros en la URL:** `?q=…&tipo=dinero|especie&orden=recientes|cierran` (nombres en castellano, mapeados al contrato), escritos con `router.replace`. El enlace se puede compartir y una recarga conserva la búsqueda; "atrás" sale de `/campaigns` en vez de deshacer filtro por filtro. **El cursor nunca va en la URL.** La búsqueda no es un secreto (no es como `trackingCode`), y la web ya va con `referrer: no-referrer`. Un parámetro inválido en la URL se ignora, nunca se reenvía | (b) Sin URL: se pierden al recargar. (c) `router.push`: cada filtro es un paso de "atrás" |

### A3.4 Tarea

**P-12 · `feat/web-campaign-search`** — U-20 a U-26, si se aprueban.
- `src/lib/api/publicCampaigns.ts`: `fetchDiscovery({q?, donationType?, sort?, cursor?})`, con los parámetros solo si tienen valor.
- `src/lib/discovery/searchModel.ts` (puro): normaliza y valida `q`, traduce la URL ↔ filtros y da la clave de la combinación para el cursor.
- `DiscoveryScreen`: los controles de U-21 y el estado de U-25. `HomeScreen` (y la landing, según U-20): U-23.
- Servidor falso: `q`, `donationType`, `sort` y el cursor v2 con sus 400, con las mismas reglas que el controlador.
- **Ninguna dependencia nueva (D8).** Sin cambios en `globals.css`.

**Tests propuestos:**
- validación: `" a "` no se envía; `"ab"` sí; 100 puntos de código con emojis sí y 101 no; nunca sale una petición con `q=` vacío (negativa sobre las URL pedidas);
- el reinicio del cursor: con una página cargada, cambiar el tipo hace una petición **sin** `cursor`; un 400 en "Cargar más" reinicia la lista una sola vez (sin bucle);
- respuesta tardía: la de la combinación anterior no se mezcla con la nueva;
- cero resultados: "No encontramos convocatorias con esa búsqueda", con "Quitar filtros";
- `PRIVATE_LINK` y `CLOSED` nunca aparecen, tampoco al buscar su título exacto (E2E con el servidor falso);
- la URL: recargar conserva los filtros; el cursor nunca está en `location.href`; un `?tipo=` inválido se ignora;
- U-23: con una convocatoria que cierra en 3 días en la segunda página del orden por `publicCode`, "Cierran pronto" la muestra (hoy no);
- accesibilidad: `role="search"`, etiquetas visibles, las píldoras con `aria-pressed` y objetivos de 44 px; capturas en claro y oscuro a 390 y 1280 px.

### A3.5 Pendientes de Carlos

| # | Pregunta | Respuesta (Carlos, 2026-10-31) |
|---|---|---|
| PD-3 | U-20: ¿búsqueda solo en `/campaigns` o también en la landing? | **Solo en `/campaigns`**; en la landing, el enlace "Buscar convocatorias" |
| PD-4 | U-22: ¿orden por defecto "Más recientes" o el de hoy? | **"Más recientes"** (`sort=recent`) |
| PD-5 | U-23: ¿"Cierran pronto" pasa a `sort=ending_soon`? | **Sí, en todos los sitios donde se calcula hoy** (`/home` y la landing), sin depender de PD-3 |
| PD-6 | U-26: ¿filtros en la URL con `replace`, sin URL o con `push`? | **En la URL con `router.replace`**, sin pasos nuevos en el historial |

### A3.6 Orden

```
develop
   └── P-12 feat/web-campaign-search (ya, tras fusionar este anexo)
```
