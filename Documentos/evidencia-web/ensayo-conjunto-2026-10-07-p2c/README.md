# Ensayo conjunto tras P2-C — web contra el backend real (2026-10-07)

Segunda pasada del ensayo conjunto (la primera: `../ensayo-conjunto-2026-10-07/`), con las pantallas de P2-C.

**Base:** backend `develop` **`4d1d65a`** (solo lectura), demo local (`runbook-demo-local.md`), base vacía; web
`develop` `ac4b900` + este ensayo, build de demo contra `http://localhost:8080/api/v1`. CORS a `:3000` en la copia
local de `demo.env` (D-05).

## Resultado

**21 de 21 pasos OK; 68 llamadas, ninguna con error** (`pasos.json`, `red.json`).

**Todo por la interfaz** salvo el pago, en el que el test hace de proveedor de pago (DW-30). Respecto a la primera
pasada, ya van por la interfaz:

| Paso | Pantalla |
|---|---|
| Verificar la organización | `/panel/platform` con la cuenta de plataforma. El identificador lo da la organización (D-04: sin listado de pendientes); el test lo toma del `/me` del administrador |
| Solicitar y confirmar la asignación | `/panel/funds` (administrador) |
| Elegir fondo y asignación al registrar (camino A) | Desplegables de "Registrar activo" (empleado) |
| Activos de la organización tras la entrega | `/panel/assets`: padre e hijo, "Entregado" |

**Estimación con cifra (`capturas/22-estimacion-con-cifra.png`):** durante el recorrido no hay cifra (`NOT_STARTED`,
porque CV-01 exige un inicio futuro). Pasado el inicio (23:35Z), la misma pantalla muestra:
- la cifra del backend real: probabilidad 100 %, final estimado 238 %;
- el aviso del backend "fuera del rango de entrenamiento" (0 % del tiempo transcurrido);
- lo recaudado (20 % de la meta) marcado como **hecho**, separado de la estimación.

La captura se tomó con un guion aparte, con la sesión del administrador.

Sin cambios respecto a la primera pasada: narrativa de convocatoria `UNAVAILABLE` sin clave de LLM y relato individual de plantilla (D-08).

Capturas: `capturas/NN-paso.png` (1280 px), con el `trackingCode` tapado.
