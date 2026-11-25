# Capturas de la ficha del lote por rol (ADR-032 Enmienda 1, plan 1)

**Procedencia de cada captura** (la misma para todas):

| Qué | Valor |
|---|---|
| Fecha | 2026-11-25 |
| Backend | `Toffy22Cj/Donaciones` `develop` en `c5f3762` (incluye `#195`, la lectura del lote por rol), `mvn install -DskipTests` y `spring-boot:run` |
| Semilla | perfiles `dev,demo-seed,demo-historico`, base vacía, datos **sintéticos** |
| Web | este PR, rama `feat/web-ficha-admin-representante` en `7f31873` (más `#72`), compilada con `NEXT_PUBLIC_E2E_BUILD=true` contra `http://localhost:8080/api/v1` |
| Navegador | Chromium 1243 de Playwright, 1280 × 1000, `deviceScaleFactor` 2, página completa |
| Cuentas | `empleado1@`, `administrador@` y `representante@demo.paxfide.local` (cuentas de ejemplo, solo locales; ninguna credencial se guarda en este repositorio) |
| Peticiones | `GET /physical-assets/{ref}`, `…/evidence/steps`, `…/evidence/{step}?sequence=N`, `…/evidence/redacted` y, para el administrador, `…/evidence/redacted/publication` |

**Estados** (los lotes salen de la semilla; las dos «retirada» las retiró la plataforma con `POST /platform/organizations/{org}/media/remove`, F7, antes de capturar):
- `sin-foto`: lote despachado sin ninguna foto de paso (`906dc700…`).
- `con-foto-entregado`: lote entregado con las cuatro fotos y la copia censurada (`31866455…`).
- `con-foto-recibido`: lote recibido con las tres fotos de paso (`4caa7d1b…`).
- `retirada-entregado`: entregado, con la foto de la entrega retirada (`334ec13c…`).
- `retirada-recibido`: recibido, con la foto de la recepción retirada (`26e8bbee…`).

`resultado.json` guarda, por captura, lo que la prueba comprobó en la pantalla. **Resumen:**
- El `REPRESENTATIVE` **abre la ficha** (antes: 403), ve «Pasos y fotos» y la copia censurada, y **no ve** el control de publicar ni ninguna acción.
- El `ADMINISTRATOR` ve el control de publicar **solo** en la entrega con foto; el `EMPLOYEE`, nunca.
- Un `ADMINISTRATOR` sin `EMPLOYEE` **no se puede capturar**: por la API de la aplicación, asignar el papel de administrador **conserva** `EMPLOYEE` (la cuenta del ejemplo tiene los dos). Ese caso solo existe en los tests (`P2EndpointsHttpIntegrationTest`, `RemoveEmployeeService`).
