# Ensayo conjunto — P4-B, mañana del 2026-10-08 (Autorización (3), cierre)

**Base:**
- backend `develop` **`d169dda`** (solo lectura): trae el historial por cortes de la estimación (S-17) y la verificación
  de integridad en el seguimiento (S-22). Demo local del runbook (MongoDB, Ganache, Mailpit), base vaciada antes de la
  pasada, semilla del perfil `dev` (no existe `scripts/demo/seed`). `demo.env` copiado del ejemplo; solo se rellena la
  dirección del contrato que imprime `deploy-anchor-registry.sh` (runbook).
- web `develop` `4df0678` (PR #26) + este ensayo, build de demo contra `http://localhost:8080/api/v1`.

## Resultado

**32/32 pasos OK, 121 llamadas** (`pasos.json`, `red.json`, `capturas/`). Una pasada anterior sobre la misma base sin
vaciar dio también 32/32 (no se guarda: la sustituye esta, en base limpia).

Las únicas respuestas de error son las esperadas:
- un `409 CampaignAlreadyHasDonations` provocado a propósito;
- el `403` del listado de convocatorias para el representante (S-20).

**Pasos nuevos respecto al ensayo de la noche:**

| Paso | Qué se ve contra el backend real |
|---|---|
| `integridad` (`20-integridad.png`) | "Comprobar integridad" con el código en `Authorization`. 3 grupos: 2 **Coincide** (`MATCH`, anclados en Ganache, con red, bloque, raíz y transacción) y 1 **No se pudo comprobar** (`INCONCLUSIVE`, `NOT_ANCHORED`: enviado y aún sin confirmar). En la pasada anterior, ya confirmado, salieron 3 `MATCH` |
| `estimacion-historial` (`22-estimacion-historial.png`) | La convocatoria del ensayo acaba de empezar: la estimación actual no tiene cifra ("La convocatoria aún no ha empezado") y los tres cortes son `FUTURE_CUT`, dibujados vacíos con "Sin cifra: Este corte aún no ha llegado". Se muestran los avisos del backend, incluido el de la tasa de fallos 0 |

**Límite:** ninguna convocatoria de la demo tiene cortes pasados (la única es la que crea el ensayo, que
empieza ese mismo día; no se probó a crear una con fecha de inicio pasada), así que **los cortes con cifra solo están probados con el doble y los
tests**, no en vivo.

**Fuera de la interfaz:** el pago (el test hace de proveedor simulado, DW-30) y la lectura del correo de invitación en
Mailpit (DW-52).

**Sin secretos:** `pasos.json` y `red.json` guardan solo método, ruta, código y `title`; el código de seguimiento se
enmascara en las capturas y no aparece en ninguna URL; el token de invitación no aparece en URLs ni en el
almacenamiento. La raíz y la transacción de las capturas son datos públicos de la cadena (Ganache local).
