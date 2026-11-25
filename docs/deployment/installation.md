# 11. Configuración, Instalación y Despliegue

> Referencia complementaria: [`Documentos/despliegue-web.md`](../../Documentos/despliegue-web.md) y [`package.json`](../../package.json).

---

## 1. Requisitos Previos
- **Node.js**: `>= 22` (fijado en [`package.json`](../../package.json) `engines.node` y [`.nvmrc`](../../.nvmrc) = `22`).
- **pnpm**: `11.26.0` (fijado en `packageManager` y exigido por [`scripts/ci-local.sh`](../../scripts/ci-local.sh)).
- **Chromium** (solo para Playwright E2E y capturas): instalable con `pnpm exec playwright install --with-deps chromium` o reutilizable mediante `PW_CHROMIUM_PATH`.

---

## 2. Variables de Entorno

| Variable | Entorno | Obligatoria | Descripción Real en Código |
| :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | Build / Cliente | Sí | URL base del backend REST `/api/v1` (p. ej. `http://localhost:8080/api/v1`). Debe ser un **origen distinto** al de la app web (`config.ts`). |
| `API_INTERNAL_BASE_URL` | Servidor Next.js (SSR) | No | Sobrescribe la URL del backend para el SSR público de `/c/[publicCode]` (`publicServer.ts`) cuando el contenedor Next.js accede al backend por red interna. Si se omite, usa `NEXT_PUBLIC_API_BASE_URL`. |
| `NEXT_PUBLIC_SURFACE_PROFILE` | Build | No | Sin definir o `demo`: habilita las 61 superficies de `enabled-surfaces.demo.json`. Valor `none`: lista vacía (todas las rutas responden 404). |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Build / Cliente | No | ID de cliente OAuth Web para Google Identity Services (`gis.ts`). Si está vacío, los botones de Google no se renderizan ni se carga el script externo. |
| `NEXT_PUBLIC_E2E_SURFACES` | Solo pruebas | No | JSON array de superficies que sustituye a `enabled-surfaces.demo.json`. |
| `NEXT_PUBLIC_E2E_BUILD` | Solo pruebas | No | Activa hooks de prueba (`__TEST_SESSION__`, `__TEST_ROUTER__`, `NEXT_PUBLIC_E2E_GIS_URL`). **Nunca definir en producción.** |
| `NEXT_PUBLIC_E2E_GIS_URL` | Solo pruebas E2E | No | URL del doble local de Google Identity Services (ej. `http://localhost:3003/gsi/client`). |
| `PW_CHROMIUM_PATH` | Local E2E | No | Ruta a un binario local de Chromium para evitar descarga en Playwright. |
| `PW_WORKERS` | Local E2E | No | Número de workers de Playwright (por defecto 4 en local, 1 en CI). |

---

## 3. Instalación y Ejecución Local

### 3.1 Instalación de Dependencias
```bash
pnpm install --frozen-lockfile
```

### 3.2 Desarrollo Local contra el Backend Simulado (`scripts/fake-backend.js`)
En una terminal, arranca el backend simulado en `http://localhost:3002`:
```bash
node scripts/fake-backend.js
```
En otra terminal, arranca Next.js en `http://localhost:3000`:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3002/api/v1 pnpm dev
```

### 3.3 Desarrollo contra el Backend Real (`Donaciones`)
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1 pnpm dev
```

---

## 4. Scripts de `package.json`

| Comando | Acción |
| :--- | :--- |
| `pnpm dev` | Servidor de desarrollo Next.js (`next dev`). |
| `pnpm build` | Compilación de producción (`next build`). |
| `pnpm build:demo` | Compilación con `NEXT_PUBLIC_SURFACE_PROFILE=demo`. |
| `pnpm start` | Arranca el servidor de producción (`next start`). |
| `pnpm test` | Ejecuta las 73 suites de Vitest (`vitest run`). |
| `pnpm test:e2e` | Ejecuta los 3 perfiles Playwright: principal (`playwright.config.ts`), perfil vacío (`playwright.empty.config.ts`) y producción (`playwright.prod.config.ts`). |
| `pnpm typecheck` | Verificación estática TypeScript (`tsc --noEmit`). |
| `pnpm check:server` | Ejecuta [`scripts/check-server-imports.js`](../../scripts/check-server-imports.js) para validar frontera C1. |

---

## 5. Despliegue
1. Configurar `NEXT_PUBLIC_API_BASE_URL` apuntando al dominio público del backend (origen diferente al de la web y con CORS habilitado para el origen web).
2. Opcionalmente configurar `API_INTERNAL_BASE_URL` para llamadas SSR directas de `/c/[publicCode]` dentro de la red privada.
3. Compilar con `pnpm build` (asegurando que `NEXT_PUBLIC_E2E_BUILD` **no** esté definido) y ejecutar `pnpm start` detrás de un proxy TLS que sirva cabeceras de seguridad (`HSTS`, `X-Content-Type-Options`, `CSP`).
4. Para verificación previa a despliegue con evidencia firmada SHA-256, ejecutar sobre árbol git limpio: `bash scripts/ci-local.sh`.
