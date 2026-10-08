# Ensayo conjunto (web contra el backend real)

`ensayo-conjunto.spec.ts` recorre el golden path por la interfaz contra el backend **real** de la demo local. No forma
parte de `pnpm test:e2e` ni de `scripts/ci-local.sh` (necesita el backend en marcha).

1. Backend (repositorio `Donaciones`, `Documentos/runbook-demo-local.md` §1–§4, con Mailpit), base vacía o reutilizada (D-06 resuelta en `85b702b`: el ensayo cierra la convocatoria anterior y reasigna al mismo empleado). `demo.env` copiado del ejemplo: desde `85b702b` ya usa el puerto 3000 (D-05).
2. Web: `NEXT_PUBLIC_SURFACE_PROFILE=demo NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1 pnpm build && pnpm start`.
3. En la terminal con `demo.env` cargado (`set -a; . scripts/demo/demo.env; set +a`, en el backend):
   `pnpm exec playwright test -c playwright.ensayo.config.ts`.
   Salida: `Documentos/evidencia-web/ensayo-conjunto/` (o `ENSAYO_SALIDA`).

Evidencias: `Documentos/evidencia-web/ensayo-conjunto-2026-10-07/` (backend `231a7f6`) y
`Documentos/evidencia-web/ensayo-conjunto-2026-10-07-p2c/` (backend `4d1d65a`, con las pantallas de P2-C) y
`Documentos/evidencia-web/ensayo-conjunto-2026-10-08-p3/` (backend `8c9e159`, con las de P3; el correo se lee en Mailpit) y
`Documentos/evidencia-web/ensayo-conjunto-2026-10-08-noche/` (backend `85b702b`, dos pasadas sobre la misma base).

Lo que el test hace fuera de la interfaz queda marcado `via: "HTTP"` en `pasos.json`. Nunca escribe JWT, contraseñas,
`statusToken` ni `trackingCode`: `red.json` guarda solo método, ruta, código y `title`, y las capturas tapan el código.
