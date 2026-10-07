# Ensayo conjunto (web contra el backend real)

`ensayo-conjunto.spec.ts` recorre el golden path por la interfaz contra el backend **real** de la demo local. No forma
parte de `pnpm test:e2e` ni de `scripts/ci-local.sh` (necesita el backend en marcha).

1. Backend (repositorio `Donaciones`, `Documentos/runbook-demo-local.md` §1–§4), **base vacía** (§7): por D-06, una
   segunda pasada sobre la misma base da `409 EmployeeAlreadyAssigned` al asignar el empleado. En `demo.env`,
   `TRACEABILITY_CORS_ALLOWED_ORIGINS=http://localhost:3000` (D-05).
2. Web: `NEXT_PUBLIC_SURFACE_PROFILE=demo NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1 pnpm build && pnpm start`.
3. En la terminal con `demo.env` cargado (`set -a; . scripts/demo/demo.env; set +a`, en el backend):
   `pnpm exec playwright test -c playwright.ensayo.config.ts`.
   Salida: `Documentos/evidencia-web/ensayo-conjunto/` (o `ENSAYO_SALIDA`).

Lo que el test hace fuera de la interfaz queda marcado `via: "HTTP"` en `pasos.json`. Nunca escribe JWT, contraseñas,
`statusToken` ni `trackingCode`: `red.json` guarda solo método, ruta, código y `title`, y las capturas tapan el código.
