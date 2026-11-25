# 01–04. Introducción, Tecnologías, Arquitectura y Estructura del Proyecto

> **Proyecto:** `paxfide-web` (`v0.1.0`)  
> **Documento Maestro:** [`docs/README.md`](../README.md)  
> **Gobernanza Arquitectónica:** [`Documentos/ADR-046-frontend-web-paxfide-web.md`](../../Documentos/ADR-046-frontend-web-paxfide-web.md), [`Documentos/ADR-046-enmienda-1-alcance-web.md`](../../Documentos/ADR-046-enmienda-1-alcance-web.md), [`Documentos/api-contract-matrix.md`](../../Documentos/api-contract-matrix.md)

---

## 01. Introducción

### 1.1 Nombre del Proyecto
**`paxfide-web`** — Aplicación web cliente oficial de **PaxFide**, plataforma de trazabilidad verificable de donaciones monetarias y en especie, gestión logística por lotes con código QR y anclaje criptográfico mediante árboles de Merkle en blockchain pública.

### 1.2 Descripción General
`paxfide-web` es una aplicación web construida con **Next.js 16.3.8 (App Router)**, **React 19.2.8** y **TypeScript 5 (`strict: true`)**. Opera como interfaz directa contra la API REST `/api/v1` del backend para cuatro perfiles funcionales:

1. **Visitantes y donantes anónimos**:
   - Recorrido explicativo interactivo con mundo isométrico guiado por scroll en `/` ([`LandingScreen.tsx`](../../src/screens/LandingScreen.tsx)).
   - Exploración y búsqueda de convocatorias públicas en `/campaigns` ([`DiscoveryScreen.tsx`](../../src/screens/DiscoveryScreen.tsx)) y detalle con donación en `/c/[publicCode]` ([`CampaignPublicScreen.tsx`](../../src/screens/CampaignPublicScreen.tsx)).
   - Seguimiento público por formulario en `/tracking` ([`TrackingScreen.tsx`](../../src/screens/TrackingScreen.tsx)) mediante `Authorization: Bearer <trackingCode>`, con verificación criptográfica local en el navegador (`Web Crypto SHA-256`) de la prueba de Merkle frente a la raíz anclada y enlaces a **Etherscan (Sepolia)** o **Polygonscan (Amoy)**.
   - Páginas legales públicas: `/terminos`, `/privacidad` y `/terminos-organizacion`.
2. **Donantes autenticados**:
   - Inicio del donante con tarjeta de impacto y ciudad isométrica 2D en `/home` ([`HomeScreen.tsx`](../../src/screens/HomeScreen.tsx)).
   - Historial personal de donaciones y descarga de recibos verificables en PNG (`ReceiptCanvas.ts`) en `/account/donations` ([`AccountDonationsScreen.tsx`](../../src/screens/AccountDonationsScreen.tsx)).
   - Gestión de cuenta, perfil, contraseña, desactivación y vínculo con Google Identity Services en `/account` ([`ProfileScreen.tsx`](../../src/screens/ProfileScreen.tsx)).
3. **Miembros de organizaciones (`REPRESENTATIVE`, `ADMINISTRATOR`, `EMPLOYEE`)**:
   - Panel operativo en `/panel` ([`PanelHomeScreen.tsx`](../../src/screens/PanelHomeScreen.tsx)) con métricas temporales, estado de integridad y actividad.
   - Administración de convocatorias (`/panel/campaigns`, `/panel/my-campaigns`, `/panel/configuration`), fondos y asignaciones (`/panel/funds`), inventario de activos físicos y operaciones de custodia con QR y evidencia fotográfica (`/panel/assets`, `/assets/[assetRef]`), miembros e invitaciones (`/panel/members`), perfil institucional y verificación (`/panel/organization`) y predicción de metas (`/panel/prediction`).
4. **Administradores de plataforma (`platformAuthority`)**:
   - Verificación, rechazo o solicitud de información adicional de organizaciones, gestión de administradores de plataforma, reactivación de cuentas y retiro de medios en `/panel/platform` ([`PlatformScreen.tsx`](../../src/screens/PlatformScreen.tsx)).

### 1.3 Problema que Resuelve
- **Opacidad posdonación**: permite seguir cada donación desde el pago hasta la compra de insumos, división de lotes (`split`), despacho, recepción y entrega comunitaria.
- **Tensión entre transparencia y privacidad**: utiliza credenciales portadoras (`publicCode`, `trackingCode`, `Intent-Token`) y pruebas de inclusión de Merkle (`eventHash` + `path` + `merkleRoot`) sin exponer datos personales en blockchain ni en URLs indexables.
- **Duplicación operativa en redes inestables**: evita dobles registros en comandos críticos mediante `Command-Id` (UUID v4 por intención) y manejo explícito del estado `AMBIGUOUS` sin reintentos automáticos.

### 1.4 Objetivos y Alcance
- **Frontera C1 (Sin BFF)**: el navegador habla directamente con `NEXT_PUBLIC_API_BASE_URL` (origen distinto al de Next.js).
- **Cero persistencia de secretos**: ningún JWT, `trackingCode`, `statusToken` o token de correo se guarda en `localStorage`, `sessionStorage`, `cookies` o `IndexedDB`.
- **Precisión exacta**: importes en unidades mínimas ISO 4217 (`BigInt` / strings de dígitos en [`money.ts`](../../src/lib/money.ts)) y cantidades físicas decimales escala 4 sin punto flotante ([`quantity.ts`](../../src/lib/quantity.ts)).
- **Control de despliegue por superficies**: [`src/lib/routing/enabled-surfaces.demo.json`](../../src/lib/routing/enabled-surfaces.demo.json) gobierna **61 entradas**: **26 rutas**, **1 sección** (`section:campaign-narrative`) y **34 banderas de acción (`action:*`)**.

---

## 02. Tecnologías y Herramientas

### 2.1 Lenguajes y Estándares
| Tecnología | Versión / Configuración | Uso Real Verificado |
| :--- | :--- | :--- |
| **TypeScript** | `^5` (`strict: true`, `target: ES2017`, `moduleResolution: bundler`) | Todo el código fuente (`src/`), pruebas (`__tests__/`, `e2e/`, `capturas/`, `ensayo/`) y configuraciones. |
| **JavaScript (Node.js)** | `>=22` (`.nvmrc`: `22`) | Scripts de soporte: `fake-backend.js`, `check-server-imports.js`, `capturas-fidelidad.mjs`. |
| **Python 3** | Script utilitario | Generación de iconos de marca en [`scripts/marca/generar-iconos.py`](../../scripts/marca/generar-iconos.py). |
| **CSS3 (CSS Modules + Custom Properties)** | Nativo (`globals.css` + `*.module.css`) | Sistema visual dual claro/oscuro basado en tokens semánticos; sin Tailwind ni CSS-in-JS. |
| **HTML5 Canvas 2D / Web Crypto / SVG** | APIs estándar del navegador | Escenas isométricas (`worldDraw.ts`, `cityDraw.ts`), recibos PNG (`ReceiptCanvas.ts`), SHA-256 (`merkle.ts`) y gráficos/iconos SVG. |

### 2.2 Dependencias de Runtime (`package.json`)
Bajo `ADR-046 D8`, `dependencies` contiene exactamente tres paquetes:
- `next`: `16.3.8`
- `react`: `19.2.8`
- `react-dom`: `19.2.8`

### 2.3 Herramientas de Desarrollo y Pruebas (`devDependencies`)
Verificadas en [`package.json`](../../package.json):
- **Unitarias y de Componentes**: `vitest` (`^5.0.2`), `@vitejs/plugin-react` (`^6.1.1`), `@testing-library/react` (`^16.3.3`), `@testing-library/dom` (`^10.4.2`), `@testing-library/jest-dom` (`^7.0.1`), `jsdom` (`^30.1.1`).
- **End-to-End y Capturas**: `@playwright/test` (`^1.63.0`) con 5 configuraciones (`playwright.config.ts`, `playwright.empty.config.ts`, `playwright.prod.config.ts`, `playwright.capturas.config.ts`, `playwright.ensayo.config.ts`).
- **Tipado y Arquitectura**: `typescript` (`^5`), `@types/node` (`^20`), `@types/react` (`^19`), `@types/react-dom` (`^19`), y el verificador estático [`scripts/check-server-imports.js`](../../scripts/check-server-imports.js).
- **Gestor de Paquetes**: `pnpm@11.26.0` (`packageManager` en `package.json`).

### 2.4 Integraciones Externas
1. **Backend REST PaxFide (`NEXT_PUBLIC_API_BASE_URL` / `API_INTERNAL_BASE_URL`)**: API `/api/v1` (CORS directo desde navegador; SSR público sin credenciales únicamente en `/c/[publicCode]`).
2. **Google Identity Services (`https://accounts.google.com/gsi/client`)**: Excepción controlada `G-W2` cargada bajo demanda en [`src/lib/google/gis.ts`](../../src/lib/google/gis.ts) solo cuando `NEXT_PUBLIC_GOOGLE_CLIENT_ID` está definido.
3. **Exploradores Blockchain Públicos**: Construcción de URLs por tabla cerrada en [`src/lib/tracking/merkle.ts`](../../src/lib/tracking/merkle.ts) hacia **Etherscan Sepolia** (`https://sepolia.etherscan.io/tx/{txHash}`) y **Polygonscan Amoy** (`https://amoy.polygonscan.com/tx/{txHash}`).

---

## 03. Arquitectura del Sistema

### 3.1 Estilo Arquitectónico
**SPA híbrida sobre Next.js App Router con frontera estricta Sin-BFF (C1)** y arquitectura en 4 capas:

1. **Capa de Enrutamiento y Shell (`src/app/`)**: layouts, fuentes autoalojadas (`src/app/fonts/`), scripts anti-parpadeo en `<head>` (`THEME_INIT_SCRIPT`, `NAV_POSITION_INIT_SCRIPT`), `Shell`, `RouteGuard` y puntos de entrada `page.tsx`.
2. **Capa de Pantallas (`src/screens/`)**: 24 controladores de vista (`*Screen.tsx`) que orquestan lecturas (`useRead` o efectos directos), comandos (`useCommand`), navegación y estados vacíos/carga/error.
3. **Capa de Componentes y Motores Gráficos (`src/components/`)**: primitivas de diseño (`ui/`), navegación (`nav/`, `shell/`), componentes de dominio (`access/`, `account/`, `asset/`, `campaign/`, `charts/`, `impact/`, `location/`, `media/`, `organization/`, `panel/`, `prediction/`, `receipt/`, `tracking/`, `welcome/`) y motores Canvas 2D (`landing/`, `background/`, `receipt/ReceiptCanvas.ts`).
4. **Capa de Dominio e Infraestructura (`src/lib/`)**: transporte HTTP (`api/`), sesión JWT en RAM (`auth/`), comandos idempotentes (`commands/`), clasificación de rutas y superficies (`routing/`), y módulos puros sin dependencias (`money.ts`, `quantity.ts`, `qr.ts`, `tracking/merkle.ts`, `organization/profileModel.ts`, etc.).

### 3.2 Decisiones Arquitectónicas Comprobadas (`ADR-046` D1–D8)

| ID | Decisión Comprobada | Evidencia Real en Código |
| :--- | :--- | :--- |
| **D1** | Next.js App Router + SSR público acotado | [`src/app/c/[publicCode]/page.tsx`](../../src/app/c/%5BpublicCode%5D/page.tsx) es el único Server Component que invoca `fetch` vía [`publicServer.ts`](../../src/lib/api/publicServer.ts) (`dynamic = 'force-dynamic'`, `robots: { index: false, follow: false }`, sin `og:url`). |
| **D2** | Sesión JWT solo en memoria de pestaña | [`src/lib/auth/session.ts`](../../src/lib/auth/session.ts) guarda `jwt` y `lastPrincipal` en variables privadas de módulo; `BroadcastChannel('paxfide_logout_signal')` sincroniza cierres entre pestañas. |
| **D3 (C1)** | Sin BFF ni rewrites proxy | [`src/lib/api/config.ts`](../../src/lib/api/config.ts) rechaza `NEXT_PUBLIC_API_BASE_URL` vacío o del mismo `origin`. [`scripts/check-server-imports.js`](../../scripts/check-server-imports.js) impide importar `session`, `usePrincipal`, `http` o `publicCampaigns` en módulos de servidor. |
| **D4** | Guardia de rutas y protección `bfcache` | [`src/app/RouteGuard.tsx`](../../src/app/RouteGuard.tsx) evalúa `classifyRoute()` antes que la sesión, redirige a `/login` guardando `postLoginDestination`, y recarga en `pageshow` (`event.persisted`) si una ruta autenticada vuelve tras logout. |
| **D5** | Habilitación de superficies en build | [`src/lib/routing/surfaces.ts`](../../src/lib/routing/surfaces.ts) carga [`enabled-surfaces.demo.json`](../../src/lib/routing/enabled-surfaces.demo.json) (o lista vacía con `NEXT_PUBLIC_SURFACE_PROFILE=none`, o `NEXT_PUBLIC_E2E_SURFACES` en pruebas). |
| **D6** | Comandos idempotentes sin Outbox | [`src/lib/commands/useCommand.ts`](../../src/lib/commands/useCommand.ts) envía `Command-Id` (UUID v4), clasifica respuestas con [`classifier.ts`](../../src/lib/commands/classifier.ts), registra ambiguos en [`ambiguousSession.ts`](../../src/lib/commands/ambiguousSession.ts) y congela el intento para reintento manual. |
| **D7** | Protección de secretos al portador | `referrer: "no-referrer"` en [`layout.tsx`](../../src/app/layout.tsx), `credentials: 'omit'` y `referrerPolicy: 'no-referrer'` en [`http.ts`](../../src/lib/api/http.ts), purga de `#token=` con `history.replaceState`, y `/tracking/:cualquierCosa` bloqueado como `NOT_APPROVED`. |
| **D8** | Cero dependencias extra en runtime | Implementaciones propias para QR (`qr.ts`), Merkle SHA-256 (`merkle.ts`), ISO 4217 (`money.ts`), cantidades (`quantity.ts`), NIT módulo 11 (`profileModel.ts`) y Canvas 2D. |

---

## 04. Estructura del Proyecto

### 4.1 Árbol de Directorios Real

```text
PaxFide/
├── package.json                    # Scripts, dependencias (next, react, react-dom) y devDependencies
├── pnpm-lock.yaml                  # Lockfile determinista (pnpm@11.26.0)
├── next.config.ts                  # allowedDevOrigins: ['127.0.0.1', 'localhost']
├── tsconfig.json                   # TypeScript strict, alias @/* -> ./src/*
├── vitest.config.ts                # Entorno jsdom y setupFiles: ./vitest.setup.ts
├── playwright.config.ts            # E2E principal (puerto 3000, fake-backend 3002, GIS mock 3003)
├── playwright.empty.config.ts      # E2E perfil vacío (NEXT_PUBLIC_SURFACE_PROFILE=none)
├── playwright.prod.config.ts       # E2E de verificación de build producción
├── playwright.capturas.config.ts   # Capturas visuales (viewports 360 y 1280)
├── playwright.ensayo.config.ts     # Ensayo conjunto contra backend real
├── AGENTS.md / CLAUDE.md / README.md
├── Documentos/                     # ADRs, matriz API, planes de fase, prototipos HTML y evidencia
├── docs/                           # Documentación técnica viva del repositorio
├── public/                         # Recursos estáticos públicos
├── scripts/
│   ├── fake-backend.js             # Backend REST simulado con estado para E2E y desarrollo local
│   ├── check-server-imports.js     # Verificador estático de la frontera C1
│   ├── ci-local.sh                 # Réplica local de .github/workflows/ci.yml con firma SHA-256
│   ├── capturas-fidelidad.mjs      # Orquestador de capturas de fidelidad visual
│   └── marca/generar-iconos.py     # Generador de iconos de marca
├── src/
│   ├── app/                        # 46 archivos: App Router, layouts, fuentes .woff2, globals.css, RouteGuard
│   ├── screens/                    # 32 archivos: 24 *Screen.tsx + 8 *.module.css
│   ├── components/                 # 117 archivos: UI, navegación, dominio y motores Canvas 2D
│   └── lib/                        # 55 archivos: api/, auth/, commands/, routing/, tracking/, etc.
├── __tests__/                      # 73 archivos (pruebas unitarias/componentes + fixtures)
├── e2e/                            # 45 archivos (specs Playwright + support/)
├── capturas/                       # 21 specs de capturas visuales
└── ensayo/                         # 2 archivos de ensayo contra backend real
```

### 4.2 Convenciones de Organización
- **Páginas delgadas (`src/app/**/page.tsx`) vs. Pantallas (`src/screens/*Screen.tsx`)**: las rutas en `src/app/` montan la pantalla correspondiente y extraen parámetros. Excepción documentada: [`src/app/assets/[assetRef]/page.tsx`](../../src/app/assets/%5BassetRef%5D/page.tsx) contiene directamente la lógica de pantalla de detalle de activo físico.
- **Grupos de rutas sin segmento URL**: `src/app/(acceso)/` y `src/app/(acceso)/(cuenta)/` agrupan las vistas de autenticación, recuperación, verificación, invitaciones y páginas legales con [`AccessLayout.tsx`](../../src/components/access/AccessLayout.tsx).
- **Fuentes autoalojadas**: `Bricolage Grotesque` y `JetBrains Mono` viven en `src/app/fonts/` (`*.woff2`) cargadas mediante `next/font/local` en [`src/app/fonts.ts`](../../src/app/fonts.ts) — ninguna petición sale a Google Fonts.
