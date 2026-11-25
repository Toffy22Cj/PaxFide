# 06. Componentes UI, Navegación y Motores Canvas 2D (`src/components/`)

> **Directorio:** [`src/components/`](../../src/components) — **117 archivos** organizados por dominio funcional.

---

## 1. Primitivas UI y Estados Transversales

- **[`src/components/ui/`](../../src/components/ui)** (`Button.tsx`, `Field.tsx`, `Icons.tsx`, `Layout.tsx`, `Modal.tsx`, `ui.module.css`):
  - Sistema de componentes base sin dependencias externas. Todos los controles interactivos cumplen área táctil mínima de 44×44 px y foco visible (`:focus-visible`).
  - `Layout.tsx` provee `PageHeader`, `Surface` y `DefinitionList`.
- **[`src/components/States.tsx`](../../src/components/States.tsx)**: Primitivas estandarizadas para los estados de red y dominio: `LoadingState`, `ErrorState`, `ForbiddenState`, `NotFoundState`, `EmptyState` y `StatusNotice`.
- **[`src/components/CommandFeedback.tsx`](../../src/components/CommandFeedback.tsx)**: Presenta retroalimentación de `useCommand`: rechazo (`REJECTED`) con texto traducido por `rejectionMessage()`, o advertencia de estado `AMBIGUOUS` con botones explícitos de *"Reintentar"* (mismo `Command-Id`) y *"Cerrar"* (sin reenviar).
- **[`src/components/QrCode.tsx`](../../src/components/QrCode.tsx)**: Renderiza en SVG la matriz booleana generada por [`src/lib/qr.ts`](../../src/lib/qr.ts).
- **[`src/components/LocalDate.tsx`](../../src/components/LocalDate.tsx)**: Formateo seguro de fechas ISO en cliente evitando discrepancias de hidratación SSR/CSR.

---

## 2. Shell, Navegación Adaptable y Bienvenida

- **[`src/components/shell/Shell.tsx`](../../src/components/shell/Shell.tsx)**: Envoltorio raíz montado en `RootLayout`. Decide según `backgroundRoutes.ts` si muestra `AppNav`, `CityBackground`, `CityHud`, `PanelPortal` y `WelcomeOverlay`, o si delega el chrome completo a la landing (`/`) o a `AccessLayout` (`/login`, `/register`, legales).
- **[`src/components/nav/AppNav.tsx`](../../src/components/nav/AppNav.tsx)** y **[`NavPositionSheet.tsx`](../../src/components/nav/NavPositionSheet.tsx)**:
  - En `< 768 px` fija la barra en la parte inferior con máximo `5` entradas (`MAX_BOTTOM_ENTRIES = 5`).
  - En `>= 768 px` permite elegir posición (`side`, `left`, `right`, `top`, `bottom`) persistida en `localStorage['paxfide.nav-position']`.
- **[`src/components/welcome/WelcomeOverlay.tsx`](../../src/components/welcome/WelcomeOverlay.tsx)**: Diálogo de bienvenida mostrado una sola vez por `accountId` (flag no sensible en `localStorage`).

---

## 3. Componentes de Dominio Destacados

| Subcarpeta | Archivos Clave | Función en el Sistema |
| :--- | :--- | :--- |
| [`access/`](../../src/components/access) | `AccessLayout`, `AuthCard`, `GoogleButton`, `LegalConsent`, `NameGate`, `ResendVerification` | Flujos de entrada, consentimiento legal versionado, captura de nombre privado y botón oficial de Google Identity Services. |
| [`account/`](../../src/components/account) | `ProfileNameCard`, `SecurityCard` | Edición de nombre, cambio de contraseña (con `replaceToken`), vinculación/desvinculación de Google y desactivación de cuenta. |
| [`asset/`](../../src/components/asset) | `AssetActions`, `AssetMunicipality`, `CommandModal`, `DeliverModal`, `RegisterAssetForm`, `SplitProgress`, `StepPhotoField`, `StepPhotosSection` | Ciclo completo de custodia logística, validación de municipio DIVIPOLA, subida de foto de entrega y gestión de fotos por paso. |
| [`campaign/`](../../src/components/campaign) | `CampaignCard`, `CampaignNarrative`, `CreateCampaignForm`, `DonateSection`, `TrackingCodeReveal` | Tarjetas de convocatoria, narrativa pública (`section:campaign-narrative`), formulario de donación y revelación única del `trackingCode`. |
| [`charts/`](../../src/components/charts) & [`prediction/`](../../src/components/prediction) | `Charts`, `ChartPanel`, `ChartPanels`, `panelSeries`, `PredictionCharts` | Visualizaciones SVG puras sin librerías externas para fondos mensuales, actividad del panel y curvas de predicción de metas. |
| [`media/`](../../src/components/media) | `PrivateImage`, `DeliveryEvidencePhoto`, `CampaignCoverCard`, `OrganizationLogoCard`, `ImageEditor`, `PhotoPicker`, `RemovePhotoForm` | Carga autenticada de imágenes vía `Blob`/`ObjectURL`, recorte/edición de imagen en cliente y gestión de medios de organización/campaña. |
| [`tracking/`](../../src/components/tracking) | `TrackingTimeline`, `StepDetail`, `IntegrityBadge`, `TrackingCodeChip`, `StepIcon`, `Truck` | Línea de tiempo de custodia, verificación Merkle local en `StepDetail`, insignias de integridad y animación de camión respetando `prefers-reduced-motion`. |
| [`loaders/`](../../src/components/loaders) | `MerkleTreeLoader`, `TruckLoader`, `Skeleton`, `TopProgressBar` | Indicadores de carga temáticos sin dependencias externas. |

---

## 4. Motores Gráficos Canvas 2D

### 4.1 Mundo Isométrico de la Landing (`src/components/landing/`)
- **Archivos**: [`WorldScene.tsx`](../../src/components/landing/WorldScene.tsx), [`worldScene.ts`](../../src/components/landing/worldScene.ts), [`worldDraw.ts`](../../src/components/landing/worldDraw.ts), [`worldPalette.ts`](../../src/components/landing/worldPalette.ts), [`worldMode.ts`](../../src/components/landing/worldMode.ts), [`LandingThemeToggle.tsx`](../../src/components/landing/LandingThemeToggle.tsx).
- **Arquitectura de renderizado**:
  - `worldScene.ts` genera de forma 100 % determinista (`parkMiller(WORLD_SEED = 17)`) la carretera Catmull-Rom sobre las 5 paradas (`STOPS`), río, praderas, cultivos, fincas, árboles, arbustos, 44 nubes, estrellas y luciérnagas.
  - `WorldRenderer` (`worldDraw.ts`) dibuja en `<canvas aria-hidden="true">` con `DPR <= 1.5`, ordenamiento de profundidad (algoritmo del pintor por `x + y`), paleta dual día/noche (`WORLD_DAY` / `WORLD_NIGHT`) y 12 etiquetas genéricas sin cifras ni lugares reales (`LANDING_MAP_LABELS`).
  - **Reglas de accesibilidad y movimiento (`R-F1`–`R-F7`)**: con `prefers-reduced-motion: reduce` o pausa manual (`PauseButton`), detiene `requestAnimationFrame` y salta por fotograma quieto entre paradas; con pestaña oculta (`document.hidden`) apaga el bucle; las nubes se desvanecen sobre los bloques `[data-world-avoid]` (`rectFade`).
- **Geometría de la Parada 3 (`Queda sellado` — `Raíz anclada` / `Anclaje en blockchain`)**:
  - La plataforma blanca `2×2` se sitúa en `[cx - 1, cx + 1] × [cy - 1, cy + 1]` con altura `0.45`.
  - La cadena de 7 bloques azules avanza sobre `y = cy` desde `cx - 5.15` hasta `cx - 1.79` (conectando mediante enlace discontinuo al borde `cx - 1` de la plataforma, sin colisionar con la carretera ni con el pedestal).
  - El árbol de Merkle se proyecta sobre el eje horizontal puro en pantalla `(cx + d, cy - d)` (`Δpy = 0`) apoyado sobre el pedestal: 4 hojas `L` en `d ∈ {-0.54, -0.18, +0.18, +0.54}` (`z = 0.48`), 2 nodos intermedios `M` en `d ∈ {-0.36, +0.36}` (`z = 1.65`) y la raíz dorada `R` en `(cx, cy, 2.85)`. La etiqueta `Anclaje en blockchain` se ancla en el borde derecho del pedestal (`cx + 1.0, cy, 0.35`) con su píldora despejada a la derecha (`cx + 3.4, cy - 1.3, 0.45`).

### 4.2 Ciudad Isométrica de Fondo (`src/components/background/`)
- **Archivos**: [`CityBackground.tsx`](../../src/components/background/CityBackground.tsx), [`cityDraw.ts`](../../src/components/background/cityDraw.ts), [`cityScene.ts`](../../src/components/background/cityScene.ts), [`cityPalette.ts`](../../src/components/background/cityPalette.ts), [`PauseButton.tsx`](../../src/components/background/PauseButton.tsx), [`animationPreference.ts`](../../src/components/background/animationPreference.ts).
- **Comportamiento**: Fondo decorativo de rutas del donante (`/home`, `/campaigns`, `/c/*`, `/tracking`, `/account*`) que comparte la preferencia de pausa (`paxfide.city.paused`) y las mismas reglas de ahorro energético (`document.hidden`, `prefers-reduced-motion`).

### 4.3 Generador de Recibos PNG (`src/components/receipt/ReceiptCanvas.ts`)
- Renderiza un comprobante verificable en `<canvas>` fuera de pantalla incluyendo datos de la donación, estado de anclaje, hash recortado y código QR generado con `encodeQr()`, exportándolo como `Blob` PNG descargable sin intervención del servidor.
