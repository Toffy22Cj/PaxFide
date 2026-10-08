# Ensayo conjunto — noche del 2026-10-08 (Autorización (3))

**Base:**
- backend `develop` **`85b702b`** (solo lectura). Demo local del runbook con MongoDB, Ganache y Mailpit, y semilla del
  perfil `dev` (no existe `scripts/demo/seed`).
- **`demo.env` copiado del ejemplo sin tocarlo**: ya trae CORS y enlaces en `:3000` (D-05 resuelta).
- web `develop` `18aa353` + este ensayo, build de demo contra `http://localhost:8080/api/v1`.

## Resultado

| Pasada | Base | Resultado |
|---|---|---|
| 1 (`pasos.json`, `red.json`, `capturas/`) | vacía | **30/30 OK, 119 llamadas** |
| 2 (`segunda-pasada/`) | **la misma, sin vaciar** | **30/30 OK, 119 llamadas**. Cierra la convocatoria de la pasada 1 y **asigna al mismo empleado** a la nueva sin 409: **D-06 resuelta en vivo** |

Las únicas respuestas de error, en las dos pasadas, son las esperadas:
- un `409 CampaignAlreadyHasDonations` provocado a propósito;
- el `403` del listado de convocatorias para el representante (S-20).

**Fuera de la interfaz:**
- **el pago:** el test hace de proveedor simulado (DW-30);
- **el correo de invitación:** se lee en Mailpit (DW-52).

**Qué se recorre, todo contra el backend real:**
1. login y panel por papeles;
2. verificación desde la cola de la plataforma;
3. crear y cerrar convocatorias, y asignar responsables;
4. donar sin cuenta y con cuenta, con el `trackingCode`, y "Mis donaciones";
5. fondos y asignación (solicitar y confirmar);
6. registro por el camino A con desplegables;
7. logística, división y entrega de padre e hijo, con cantidades `6` y `4` sin ceros sobrantes;
8. activos de la organización;
9. seguimiento por formulario, con relato de respaldo **en español** (D-08 resuelta);
10. estimación sin cifra con el motivo del backend y la evolución por cortes "No disponible" (S-17);
11. narrativa de convocatoria;
12. mis convocatorias;
13. configuración con solicitud y aprobación del representante;
14. invitación por correo aceptada con el token del fragmento: no aparece en URLs, almacenamiento ni log del backend;
15. personas;
16. crear organización y pedirle información desde la cola.

**Pendiente del backend esta noche:** las estimaciones históricas por corte (S-17) y la verificación de integridad
(S-22). Las dos pantallas muestran "No disponible".

Capturas a 1280 px, con el `trackingCode` tapado.
