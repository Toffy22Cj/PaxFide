# Solicitudes del frontend web al backend

**Para:** el agente y el equipo del backend (`Toffy22Cj/Donaciones`).
**De:** frontend web (`paxfide-web`), trabajo autónomo autorizado por Carlos el 2026-10-07.
**Regla:** la web no toca el backend. Cada solicitud dice qué endpoint, por qué y qué pantalla bloquea. Mientras no exista, la pantalla muestra su estado "No disponible" y **nunca** inventa una respuesta. Los cuerpos que aparecen aquí son **propuestas** de la web, no contratos: manda lo que decida el backend.
**Base verificada:** `develop` del backend en `8dc48eb` (2026-10-07), leído en solo lectura.

| id | Endpoint | Por qué | Pantalla que bloquea | Estado |
|---|---|---|---|---|
| S-01 | `GET /api/v1/me` (ficha N1, CONGELADA en `PaxFide/Documentos/ficha-N1-quien-soy.md`) | El JWT no lleva organización ni roles. Sin `/me` la web no sabe el `organizationId` (path de CV-01 y del listado) ni qué entradas mostrar | `/panel` (entradas por rol), `/panel/campaigns` (crear convocatoria y listado), visibilidad de la predicción (solo `ADMINISTRATOR`/`REPRESENTATIVE`), "Registrar activo" en el panel | ABIERTA. Hoy responde 404 y la web muestra "No disponible" |
| S-02 | `GET /api/v1/organizations/{organizationId}/campaigns` (matriz §2b; `ConvocatoriaAdminReadModel`, paginado por cursor) | Listar las convocatorias de la organización | `/panel/campaigns` (listado; asignar responsable sin tener que copiar el `campaignRef`) | ABIERTA |
| S-03 | Configuración de **CORS** para el origen de la web (en desarrollo, `http://localhost:3000`): métodos `GET, POST`; cabeceras `Authorization, Content-Type, Command-Id, Intent-Token`; exponer `Location` (respuesta `202` de la división) | La web llama al backend desde el navegador (ADR-046 D3, sin BFF). No se usan las rewrites de Next.js como proxy porque harían pasar el JWT por el servidor de la web (DW-03) | Todas las pantallas contra el backend real | ABIERTA. Decide el backend |
| S-04 | Lectura para el Camino A: de dónde saca el empleado el `fundId` y el `allocationId` (H-B6D-1, H-B6C-1 del backend) | `POST /physical-assets/register` los exige y no hay lectura que los ofrezca | Registrar activo — camino A (el formulario existe; el usuario tendría que conocer los identificadores) | ABIERTA (hallazgos del propio backend) |
| S-05 | URL canónica del QR de seguimiento (matriz §4b: `/tracking/{trackingCode}`) | Con DW-01 la web nunca acepta el código en la ruta. Un QR con esa URL abre un 404 en la web | QR de seguimiento | ABIERTA. Propuesta: que el QR lleve `/tracking` (sin el código) o que el código no viaje en QR |
| S-06 | Endpoint de predicción (P3 del encargo del backend; ADR-044, PROPUESTO) | Requisito académico: mostrar la estimación a `ADMINISTRATOR`/`REPRESENTATIVE` | `/panel/prediction` | ABIERTA. Forma que la web necesita: ver §S-06 abajo |
| S-07 | `POST /api/v1/auth/register` (registro de cuenta) | Está en `PublicRoutes` pero no tiene controlador | Registro de cuenta (P2) | ABIERTA |
| S-08 | Cerrar convocatoria, designar administrador, retirar responsable, descubrimiento público (`GET /public/campaigns`), miembros de la organización (R6) | Comandos y lecturas de P2 sin ruta HTTP | Panel de convocatorias (P2); asignar responsable sin conocer el `accountId` (R6) | ABIERTA |
| S-09 | Código HTTP de "no encontrada" de CV-07 | Verificado: 404 con `title: NotFound` (`PublicCampaignNotFoundException`) | `/c/:publicCode` | **RESUELTA** por el backend (B6-a); la web responde 404 en SSR |

## S-06 — Lo que la web necesita de la predicción

Solo para orientar el contrato; **no** es un contrato. La web lo consumirá tal como lo defina el backend.

- Para una convocatoria (`campaignRef`) de la organización del llamador, autorizada a `ADMINISTRATOR`/`REPRESENTATIVE`.
- **Gráfico básico:** probabilidad estimada de alcanzar la meta y porcentaje final estimado de la meta.
- **Gráfico avanzado:** la estimación en los cortes `t = 0.15`, `0.25` y `0.50` del tiempo de la convocatoria, junto al porcentaje recaudado observado en cada corte.
- Para `targetPolicy = STRICT`: sin cifra, con un **motivo** que la web muestra tal cual.
- Una marca explícita de que es una estimación de un modelo entrenado con datos sintéticos (la web, además, la etiqueta siempre).
- Mientras no exista, `/panel/prediction` no está en la lista de habilitación de ningún build.
