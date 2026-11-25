# 12. Estrategia de Pruebas y Verificación

> `paxfide-web` cuenta con una pirámide de verificación de 4 niveles más verificación estática de frontera arquitectónica.

---

## 1. Inventario Real de Pruebas

| Nivel | Tecnología | Cantidad Verificada | Ubicación |
| :--- | :--- | :---: | :--- |
| **Unitarias y de Componentes** | Vitest `5.0.2` + Testing Library + `jsdom` | **73 archivos** (suites + fixtures) | [`__tests__/`](../../__tests__) |
| **End-to-End (E2E)** | Playwright `1.63.0` | **45 archivos** (specs + `support/`) | [`e2e/`](../../e2e) |
| **Capturas de Fidelidad Visual** | Playwright (`playwright.capturas.config.ts`) | **21 specs** | [`capturas/`](../../capturas) |
| **Ensayo Conjunto Backend Real** | Playwright (`playwright.ensayo.config.ts`) | **2 archivos** | [`ensayo/`](../../ensayo) |
| **Chequeos Estáticos** | TypeScript `tsc --noEmit` + `check-server-imports.js` | 2 validadores | [`scripts/check-server-imports.js`](../../scripts/check-server-imports.js) |

---

## 2. Pruebas Unitarias y de Componentes (`__tests__/`)
Configuradas en [`vitest.config.ts`](../../vitest.config.ts) y [`vitest.setup.ts`](../../vitest.setup.ts). Cubren:
- **Núcleo puro y criptografía**: `merkle-proof-vectors.json`, `money.test.ts`, `currency-exponent.test.ts`, `quantity.test.ts`, `qr.test.ts`, `world-scene.test.ts`, `city-background.test.ts`, `landing-map-labels.test.ts`, `organization-profile-p15.test.tsx`.
- **Infraestructura y seguridad**: `session.test.ts`, `http.test.ts`, `classifier.test.ts`, `command.test.tsx`, `guards.test.tsx`, `logout-destination-p11.test.tsx`, `assetClient.test.ts`.
- **Pantallas y contratos**: `landing.test.tsx`, `home.test.tsx`, `tracking.test.tsx`, `tracking-p2.test.tsx`, `tracking-timeline.test.tsx`, `campaign-public.test.tsx`, `campaigns-screen.test.tsx`, `asset-page.test.tsx`, `asset-actions.test.tsx`, `deliver-modal.test.tsx`, `step-photo-commands-t5.test.tsx`, `panel-home.test.tsx`, `panel-p3.test.tsx`, `prediction.test.tsx`, `receipt.test.tsx`, `google-sign-in-p16.test.tsx`.

Ejecución:
```bash
pnpm test
```

---

## 3. Pruebas End-to-End con Playwright (`e2e/`)
Existen 5 archivos de configuración especializados:
1. **[`playwright.config.ts`](../../playwright.config.ts)**: Suite principal contra `next start` en puerto `3000` + `scripts/fake-backend.js` en `3002` + doble GIS en `3003`. Usa `e2e/support/welcome-done.json` para cuentas sembradas. Ignora `routing.spec.ts` y `production.spec.ts`.
2. **[`playwright.empty.config.ts`](../../playwright.empty.config.ts)**: Verifica que con `NEXT_PUBLIC_SURFACE_PROFILE=none` todas las rutas respondan 404 (`routing.spec.ts`).
3. **[`playwright.prod.config.ts`](../../playwright.prod.config.ts)**: Verifica el comportamiento de build de producción (`production.spec.ts`).
4. **[`playwright.capturas.config.ts`](../../playwright.capturas.config.ts)**: Genera evidencias visuales en `Documentos/evidencia-web/capturas/` a 360 px y 1280 px.
5. **[`playwright.ensayo.config.ts`](../../playwright.ensayo.config.ts)**: Ejecuta el ensayo conjunto (`ensayo/`) contra el backend Spring Boot real.

Escenarios críticos verificados en E2E:
- `golden-path.spec.ts`: recorrido completo de donación, seguimiento y operación.
- `security.spec.ts`, `guards.spec.ts`, `logout-destination.spec.ts`: frontera C1, `bfcache`, logout multi-pestaña y no fuga de secretos.
- `landing.spec.ts`, `motion.spec.ts`, `city.spec.ts`, `theme.spec.ts`, `nav.spec.ts`: accesibilidad, `prefers-reduced-motion`, pausa compartida, tema claro/oscuro y cero peticiones externas.
- `fotos-de-los-pasos.spec.ts`, `media-p4.spec.ts`, `assets.spec.ts`, `tracking-p2.spec.ts`, `receipt.spec.ts`.

---

## 4. Pipeline CI Local (`scripts/ci-local.sh`)
Replica exactamente `.github/workflows/ci.yml` en 10 pasos secuenciales sobre un árbol git limpio:
1. Verificación de árbol limpio (`git status --porcelain`).
2. Prohibición de `.skip(` o `.only(` en `__tests__/` y `e2e/`.
3. Validación de Node `22.x` y pnpm `11.26.0`.
4. `pnpm install --frozen-lockfile`.
5. `pnpm typecheck`.
6. `pnpm vitest run`.
7. `pnpm check:server`.
8. Instalación/verificación de Chromium.
9. `pnpm test:e2e`.
10. Generación de reporte en `Documentos/evidencia-web/ci-local-<commit>-<fecha>.txt` con suma de verificación `sha256sum`.
