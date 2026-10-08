# Ensayo conjunto tras P3 — web contra el backend real (2026-10-08)

Tercera pasada del ensayo conjunto (las anteriores: `../ensayo-conjunto-2026-10-07/` y `../ensayo-conjunto-2026-10-07-p2c/`),
con las pantallas de P3: organización, plataforma, personas e invitaciones, mis convocatorias y configuración.

**Base:**
- backend `develop` **`8c9e159`** (solo lectura): demo local (`runbook-demo-local.md`) con MongoDB, Ganache y Mailpit,
  base vacía;
- web `develop` `447176e` + este ensayo, build de demo contra `http://localhost:8080/api/v1`;
- en la copia local de `demo.env`, CORS y `TRACEABILITY_WEB_BASE_URL` a `http://localhost:3000` (D-05).

## Resultado

**30 de 30 pasos OK; 119 llamadas de la web al backend.** Solo dos respuestas de error, las dos esperadas:
- `409 CampaignAlreadyHasDonations`, provocado a propósito al guardar sin aprobación;
- `403` del listado de convocatorias para el representante (S-20: la pantalla pasa a escribir la referencia).

**Fuera de la interfaz** (`via: "HTTP"` en `pasos.json`):
- **el pago:** el test hace de proveedor simulado (DW-30);
- **el correo de invitación:** el test lo lee en Mailpit, como lo leería la persona invitada (runbook §5b).

| Paso nuevo | Qué se vio contra el backend real |
|---|---|
| Verificar la organización | Desde la **cola** de la plataforma, sin escribir identificadores |
| Cantidades | El activo muestra `6` y `4` (el backend envía `6.0000`; D-07) |
| Mis convocatorias | El empleado de la semilla ve la convocatoria del ensayo como "Empleado" |
| Configuración | "Guardar sin aprobación" → `409 CampaignAlreadyHasDonations` con su texto; "Solicitar cambio" sin poder aprobar la propia; el **representante** escribe la referencia, la **aprueba** y la página pública ofrece la transferencia |
| Invitación | Invitar por correo → el correo llega a Mailpit con el enlace a `:3000/invitaciones#token=…` → la persona crea su cuenta, inicia sesión, vuelve y **acepta** → su panel muestra "Mis convocatorias". El token **no aparece** en ninguna URL pedida, ni en el almacenamiento, ni en el log del backend |
| Personas | El administrador ve a la invitada entre los miembros. Solo por su identificador: el contrato no trae nombre ni correo (S-21) |
| Crear organización | Una cuenta nueva crea su organización, ve "Pendiente de verificación" y queda como representante |
| Cola | La plataforma ve la organización nueva en la cola, le pide información y el mensaje queda en la fila. Se listan los administradores de plataforma |

Se mantiene lo de la segunda pasada:
- seguimiento con relato de plantilla (D-08);
- estimación sin cifra durante el recorrido (`NOT_STARTED`);
- narrativa de convocatoria `UNAVAILABLE` sin clave de LLM.

**Estimación con cifra** (`capturas/31-estimacion-con-cifra.png`): pasado el inicio de la convocatoria (03:53Z), la
pantalla muestra la cifra real del backend (probabilidad 100 %, final 238 %) con su aviso "fuera del rango de
entrenamiento", y lo recaudado como hecho, separado de la estimación. La captura se tomó con un guion aparte, con la
sesión del administrador.

## Capturas

`capturas/NN-paso.png` (1280 px), con el `trackingCode` tapado. El token de invitación no se muestra nunca en pantalla.
