# Capturas del golden path para validar contra Penpot

Generadas con Playwright (`playwright.capturas.config.ts`, `capturas/capturas.spec.ts`) contra el **backend simulado**, sin cambios de código de la aplicación. Cada estado está en dos anchos: `__360.png` (móvil) y `__1280.png` (escritorio). Nombre: `<pantalla>__<estado>__<ancho>.png`.

Los estados difíciles de provocar (cargando, error, 403, 409, AMBIGUO) se fuerzan con `page.route` devolviendo respuestas con la forma del contrato (`ProblemDetail` con `title` fijo). Todas las pantallas están **SIN VALIDAR CONTRA PENPOT**.

Regenerar: `PW_CHROMIUM_PATH=… pnpm exec playwright test -c playwright.capturas.config.ts`

| Pantalla | Estados capturados |
|---|---|
| `activo` | `403`, `404`, `cargando`, `contenido-registrado`, `despachado-exito`, `despachar-ambiguo`, `division-completada`, `division-en-curso`, `entregado-solo-lectura`, `entregar-409-transicion`, `error`, `modal-despachar`, `modal-dividir` |
| `convocatoria-publica` | `cerrada`, `contenido`, `no-encontrada`, `solo-especie` |
| `convocatorias` | `409-organizacion-sin-verificar`, `ambiguo`, `asignar-403`, `asignar-409`, `cargando`, `creada-con-qr`, `formulario`, `listado-no-disponible`, `validacion` |
| `donar` | `409-convocatoria-cerrada`, `ambiguo`, `confirmada-tracking-code`, `consulta-404`, `formulario`, `intencion-registrada-pasarela-simulada`, `intencion-registrada-transferencia`, `pago-fallido`, `pago-pendiente`, `validacion` |
| `login` | `401-credenciales`, `error-red`, `formulario`, `sesion-expirada`, `validacion` |
| `mis-donaciones` | `403`, `cargando`, `error`, `lista`, `lista-codigo-visible`, `vacio` |
| `pagina-404` | `no-encontrada`, `tracking-con-codigo-en-url` |
| `panel` | `cargando`, `con-entradas-administrador`, `con-entradas-empleado`, `error`, `me-no-disponible`, `sin-organizacion` |
| `registrar-activo` | `409`, `ambiguo`, `formulario-compra`, `formulario-especie`, `validacion` |
| `seguimiento` | `codigo-invalido`, `contenido-relato-disponible`, `contenido-relato-pendiente`, `en-proceso-404`, `error`, `formulario` |

## Estados que no aplican o no se capturan

- **`convocatoria-publica` — error y cargando:** la lectura se hace en el servidor (SSR) y la página llega ya resuelta; el error solo aparece si el backend no responde al servidor Next.js, cosa que `page.route` no puede simular.
- **403 en `login`, `donar` (sin sesión) y `seguimiento`:** sus contratos no tienen 403 (el seguimiento usa 401 = "código no válido").
- **409 en `panel`, `mis-donaciones` y `seguimiento`:** son lecturas; no tienen 409.
- **AMBIGUO** solo existe en comandos: crear convocatoria, donar, registrar activo y las acciones del activo.
- **Estimación (`/panel/prediction`):** no forma parte del golden path y no está habilitada en ningún build (S-06).
