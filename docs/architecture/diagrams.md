# 07. Diagramas Arquitectónicos y de Ejecución (`paxfide-web`)

> Todos los diagramas corresponden estrictamente a la implementación real verificada en `src/`.

---

## 1. Diagrama de Contexto y Frontera C1 (Sin BFF)

Refleja [`src/lib/api/config.ts`](../../src/lib/api/config.ts), [`src/lib/api/http.ts`](../../src/lib/api/http.ts), [`src/lib/api/publicServer.ts`](../../src/lib/api/publicServer.ts) y [`scripts/check-server-imports.js`](../../scripts/check-server-imports.js).

```mermaid
flowchart LR
  subgraph Client["Navegador Web (Origen A)"]
    App["Aplicación React 19\n(Next.js App Router)"]
    MemSession["Sesión en Memoria\n(session.ts)\nSin localStorage ni cookies"]
    LocalPref["Preferencias UI no sensibles\n(localStorage)\npaxfide.theme\npaxfide.nav-position\npaxfide.world-mode\npaxfide.city.paused\npaxfide_welcome_v1_*"]
    BC["BroadcastChannel\n'paxfide_logout_signal'"]
  end

  subgraph NextHost["Servidor Next.js (Origen A)"]
    StaticPages["Shells / Client Components\n(/, /login, /home, /panel/*, etc.)"]
    PublicSSR["SSR Único: /c/[publicCode]\n(publicServer.ts)\nSin credenciales + OG sin og:url"]
  end

  subgraph ApiOrigin["Backend PaxFide (Origen B != Origen A)"]
    REST["API REST /api/v1"]
    ReadModels["Proyecciones ReadModel"]
    EventStore["EventStore y Sagas"]
  end

  subgraph ThirdParty["Integraciones Externas"]
    GoogleGIS["Google Identity Services\n(accounts.google.com/gsi/client)"]
    BlockExplorers["Etherscan (Sepolia) &\nPolygonscan (Amoy)"]
  end

  Client -- "1. Carga HTML/JS/Fuentes locales" --> NextHost
  PublicSSR -- "2. GET /public/campaigns/{code}\n(cache: no-store, sin auth)" --> REST
  App -- "3. Fetch/XHR CORS directo\nBearer JWT / Tracking / Command-Id" --> REST
  App <--> MemSession
  App <--> LocalPref
  MemSession <--> BC
  App -. "4. Carga perezosa G-W2 (ID Token)" .-> GoogleGIS
  App -. "5. Enlace externo txHash" .-> BlockExplorers
  REST --> ReadModels
  REST --> EventStore
```

---

## 2. Arquitectura en Capas y Dependencias Internas

```mermaid
flowchart TD
  subgraph LayerApp["1. Capa de Enrutamiento (src/app/)"]
    Layout["layout.tsx\n(Fuentes + THEME_INIT + NAV_POSITION_INIT + Shell + RouteGuard)"]
    RG["RouteGuard.tsx\n(classifyRoute, redirección, bfcache)"]
    Pages["Páginas App Router (26 rutas)"]
    SSRPage["c/[publicCode]/page.tsx\n(Único Server Component con fetch)"]
    AssetPage["assets/[assetRef]/page.tsx\n(Pantalla operativa directa)"]
  end

  subgraph LayerScreens["2. Capa de Pantallas (src/screens/)"]
    PublicScreens["Públicas: Landing, Discovery,\nCampaignPublic, Tracking, Legal"]
    AccessScreens["Acceso: Login, Register, VerifyEmail,\nRecover, Invitation"]
    DonorScreens["Donante: Home, AccountDonations, Profile"]
    PanelScreens["Panel: PanelHome, Campaigns, MyCampaigns,\nConfiguration, Funds, OrgAssets, Members,\nOrganization, Platform, Prediction"]
  end

  subgraph LayerComponents["3. Capa de Componentes y Motores (src/components/)"]
    UIPrimitives["Primitivas UI y States"]
    NavChrome["Shell, AppNav, NavPositionSheet, PanelPortal"]
    DomainVisuals["Componentes de Dominio\n(AssetActions, DeliverModal, StepDetail, PrivateImage, QrCode)"]
    CanvasEngines["Motores Canvas 2D\n(WorldRenderer, CityBackground, ReceiptCanvas)"]
  end

  subgraph LayerLib["4. Capa de Dominio e Infraestructura (src/lib/)"]
    RoutingLib["routing/ (classifier, surfaces, backgroundRoutes)"]
    AuthLib["auth/ (session, usePrincipal, tokens #hash)"]
    CommandLib["commands/ (useCommand, classifier, ambiguousSession)"]
    ApiLib["api/ (http, config, publicServer, messages, 17 clientes)"]
    PureLib["Motores Puros (money, quantity, qr, merkle, profileModel)"]
  end

  Layout --> RG
  Layout --> NavChrome
  Pages --> PublicScreens
  Pages --> AccessScreens
  Pages --> DonorScreens
  Pages --> PanelScreens
  RG --> RoutingLib
  RG --> AuthLib

  PublicScreens --> DomainVisuals
  PublicScreens --> CanvasEngines
  DonorScreens --> CanvasEngines
  PanelScreens --> DomainVisuals
  AssetPage --> DomainVisuals
  AssetPage --> ApiLib

  DomainVisuals --> UIPrimitives
  DomainVisuals --> CommandLib
  DomainVisuals --> PureLib

  PublicScreens --> ApiLib
  AccessScreens --> ApiLib
  DonorScreens --> ApiLib
  PanelScreens --> ApiLib
  PanelScreens --> CommandLib

  CommandLib --> ApiLib
  CommandLib --> AuthLib
  ApiLib --> AuthLib
  ApiLib --> PureLib
```

---

## 3. Máquina de Estados de Sesión JWT (`src/lib/auth/session.ts`)

```mermaid
stateDiagram-v2
  [*] --> RESTORING: SSR / Arranque de módulo
  RESTORING --> LOGGED_OUT: Inicialización en navegador (sin JWT en RAM)

  state "LOGGED_OUT\n(reason: null | MANUAL | EXPIRED |\nOTHER_TAB | PASSWORD_CHANGED | DEACTIVATED)" as LOGGED_OUT
  state "AUTHENTICATED\n(jwt + lastPrincipal en RAM)" as AUTHENTICATED

  LOGGED_OUT --> AUTHENTICATED: login(token)\nLimpia logoutNavigationPending y lastLogoutReason

  AUTHENTICATED --> AUTHENTICATED: replaceToken(token)\n(POST /account/password)
  AUTHENTICATED --> LOGGED_OUT: logout() / logoutWith(reason)\nLimpia jwt, lastPrincipal, postLoginDestination\nEmite 'LOGOUT_SIGNAL' por BroadcastChannel
  AUTHENTICATED --> LOGGED_OUT: BroadcastChannel recibe 'LOGOUT_SIGNAL'\n(reason: OTHER_TAB, sin re-emitir)
  AUTHENTICATED --> LOGGED_OUT: handle401(isTrackingRoute=false)\n(Transición T-1, reason: EXPIRED, local)
```

---

## 4. Árbol de Decisión de `RouteGuard` (`src/app/RouteGuard.tsx`)

```mermaid
flowchart TD
  Start(["pathname o sessionState cambia"]) --> CheckManual{"¿sessionState === 'LOGGED_OUT'\ny isLogoutNavigationPending()?"}
  CheckManual -- "Sí y category !== 'AUTH'" --> GoLoginClean["router.replace('/login')\n(Sin guardar postLoginDestination)"]
  CheckManual -- "Sí y category === 'AUTH'" --> ClearFlag["clearLogoutNavigation()"]
  CheckManual -- "No" --> CheckCat{"classifyRoute(pathname)"}

  CheckCat -- "NOT_APPROVED\n(No existe, deshabilitada o /tracking/*)" --> Render404["Renderizar <NotFound />"]
  CheckCat -- "PUBLIC\n(/, /campaigns, /c/*, /tracking, /invitaciones,\n/recuperar, /verificar-correo, legales)" --> RenderChildren["Renderizar {children}"]
  CheckCat -- "AUTH\n(/login, /register)" --> IsAuth1{"¿sessionState === 'AUTHENTICATED'?"}
  IsAuth1 -- "Sí" --> RedirHome["consumePostLoginDestination()\nrouter.replace(dest || defaultDestination())"]
  IsAuth1 -- "No" --> RenderChildren

  CheckCat -- "AUTHENTICATED\n(/home, /account*, /panel*, /assets/*)" --> IsAuth2{"¿sessionState === 'AUTHENTICATED'?"}
  IsAuth2 -- "Sí" --> RenderChildren
  IsAuth2 -- "No (LOGGED_OUT)" --> SaveAndLogin["setPostLoginDestination(pathname)\nrouter.replace('/login')\nMuestra div[data-testid='loading-guard']"]
  IsAuth2 -- "No (RESTORING)" --> LoadingGuard["Muestra div[data-testid='loading-guard']"]
```

---

## 5. Máquina de Estados de Comandos Idempotentes (`src/lib/commands/useCommand.ts`)

```mermaid
stateDiagram-v2
  [*] --> IDLE

  IDLE --> SENDING: execute(payload)\nGenera Command-Id = crypto.randomUUID()\nGuarda commandIdRef y requestRef

  SENDING --> SUCCESS: HTTP 2xx\nclearAmbiguousSessionCommand(id)\nforget()
  SENDING --> IDLE: HTTP 401 (AUTH_ERROR)\nhandle401(isTrackingRoute)\nforget() (se pierde la intención)
  SENDING --> REJECTED: HTTP 4xx != 401\nGuarda rejection { status, problem }\nclearAmbiguousSessionCommand(id)
  SENDING --> AMBIGUOUS: HTTP >= 500 o Error de Red\nrecordAmbiguousSessionCommand(id)\nConserva commandIdRef y requestRef

  AMBIGUOUS --> SENDING: retry()\nReenvía EXACTAMENTE el mismo\nCommand-Id y requestRef
  AMBIGUOUS --> IDLE: close()\nclearAmbiguousSessionCommand(id)\nforget() (sin reenviar)

  REJECTED --> IDLE: newIntent() / close()
  REJECTED --> SENDING: execute(nuevoPayload)\nGenera NUEVO Command-Id
  SUCCESS --> IDLE: newIntent() / close()
```

---

## 6. Secuencia: Donación Pública, Seguimiento y Verificación Merkle

Refleja [`CampaignPublicScreen.tsx`](../../src/screens/CampaignPublicScreen.tsx), [`DonateSection.tsx`](../../src/components/campaign/DonateSection.tsx), [`TrackingScreen.tsx`](../../src/screens/TrackingScreen.tsx), [`StepDetail.tsx`](../../src/components/tracking/StepDetail.tsx) y [`src/lib/tracking/merkle.ts`](../../src/lib/tracking/merkle.ts).

```mermaid
sequenceDiagram
  autonumber
  actor Donor as Donante
  participant CampUI as /c/[publicCode]<br/>(DonateSection + useCommand)
  participant TrackUI as /tracking<br/>(TrackingScreen + StepDetail)
  participant Crypto as Web Crypto / Canvas<br/>(merkle.ts + ReceiptCanvas.ts)
  participant API as Backend REST (/api/v1)

  Donor->>CampUI: Ingresa monto/tipo y confirma donación
  CampUI->>API: POST /public/campaigns/{publicCode}/donation-intents<br/>Headers: Command-Id (auth: optional)
  API-->>CampUI: 201 Created { intentId, status, trackingCode?, ... }
  opt Si requiere consulta de confirmación
    CampUI->>API: GET /public/donation-intents/{intentId}<br/>Header: Intent-Token (si aplica)
    API-->>CampUI: 200 OK { status, trackingCode }
  end
  CampUI-->>Donor: TrackingCodeReveal (muestra trackingCode una sola vez)

  Donor->>TrackUI: Introduce trackingCode en formulario de /tracking
  TrackUI->>API: GET /donations/tracking<br/>Header: Authorization: Bearer <trackingCode>
  API-->>TrackUI: 200 OK DonationTracking (financialSnapshot, logistics[], status)
  par Lecturas complementarias de seguimiento
    TrackUI->>API: GET /donations/tracking/narrative (Bearer <trackingCode>)
    TrackUI->>API: GET /donations/tracking/integrity (Bearer <trackingCode>)
    TrackUI->>API: GET /donations/tracking/assets/{assetRef}/history (Bearer <trackingCode>)
  end
  API-->>TrackUI: Narrativa, lotes de integridad y transiciones (con eventHash + anchorProof)

  opt Verificación criptográfica local en el navegador
    Donor->>TrackUI: Pulsa "Comprobar en mi navegador" en un paso ANCHORED
    TrackUI->>Crypto: verifyAnchorProof(transition.eventHash, transition.anchorProof)<br/>SHA-256 iterativo sobre concatenación hex (LEFT / RIGHT)
    Crypto-->>TrackUI: true (coincide con merkleRoot) | false (mismatch)
    TrackUI-->>Donor: Muestra resultado + enlace a Etherscan (Sepolia) o Polygonscan (Amoy)
  end

  opt Descarga de recibo verificable PNG
    Donor->>TrackUI: Pulsa descargar recibo
    TrackUI->>Crypto: ReceiptCanvas + encodeQr()
    Crypto-->>Donor: Archivo PNG generado localmente en <canvas>
  end
```

---

## 7. Ciclo de Vida de Activos Físicos (`src/lib/api/assetClient.ts` y `assetCommands.ts`)

```mermaid
stateDiagram-v2
  [*] --> REGISTERED: POST /physical-assets/register\no POST /physical-assets/from-donation

  REGISTERED --> DISPATCHED: POST /physical-assets/{ref}/dispatch
  DISPATCHED --> RECEIVED: POST /physical-assets/{ref}/receive
  RECEIVED --> DISPATCHED: POST /physical-assets/{ref}/dispatch\n(Nuevo tramo en ruta)

  REGISTERED --> DELIVERED: POST /physical-assets/{ref}/deliver\n(Con evidenceRef previo de POST .../delivery-evidence)
  DISPATCHED --> DELIVERED: POST /physical-assets/{ref}/deliver
  RECEIVED --> DELIVERED: POST /physical-assets/{ref}/deliver

  REGISTERED --> REGISTERED: POST /physical-assets/{ref}/split\n(Crea sublote hijo; seguimiento vía\nGET /physical-assets/{ref}/splits/{childRef})
  RECEIVED --> RECEIVED: POST /physical-assets/{ref}/split

  DELIVERED --> [*]: Solo lectura (isReadOnly = true)
```

---

## 8. Modelo Entidad-Relación de Proyecciones y DTOs Consumidos

```mermaid
erDiagram
  ACCOUNT ||--o| ORGANIZATION : "pertenece a (opcional)"
  ORGANIZATION ||--o{ MEMBER : "tiene miembros"
  ORGANIZATION ||--o{ INVITATION : "emite"
  ORGANIZATION ||--o{ CAMPAIGN : "publica"
  ORGANIZATION ||--o{ FUND : "administra"
  ORGANIZATION ||--o{ PHYSICAL_ASSET : "custodia"
  CAMPAIGN ||--o{ CONFIGURATION_CHANGE_REQUEST : "solicita cambios"
  CAMPAIGN ||--o| PREDICTION : "proyecta cumplimiento"
  CAMPAIGN ||--o{ DONATION_INTENT : "recibe"
  DONATION_INTENT ||--o{ PHYSICAL_ASSET : "vincula lotes"
  PHYSICAL_ASSET ||--o{ TRANSITION : "registra pasos"
  PHYSICAL_ASSET ||--o{ PHYSICAL_ASSET : "parentAssetRef (split)"
  TRANSITION }o--o| ANCHOR_PROOF : "incluida en lote Merkle"

  ACCOUNT {
    string accountId PK
    string email
    boolean emailVerified
    string givenName
    string familyName
    boolean platformAuthority
  }
  ORGANIZATION {
    string organizationId PK
    string name
    string type
    string verificationStatus
    string nit "9 dígitos + nitCheckDigit mod 11"
  }
  CAMPAIGN {
    string campaignRef PK
    string publicCode UK "Secreto portador"
    string title
    string status
    string visibility "PUBLIC_DISCOVERABLE | PRIVATE_LINK"
    string currency "ISO 4217"
    string targetAmount "Unidades mínimas"
  }
  DONATION_INTENT {
    string intentId PK
    string trackingCode UK "Secreto portador Bearer"
    string status
    string amount "Unidades mínimas"
    string currency
  }
  PHYSICAL_ASSET {
    string assetRef PK
    string lifecycleStatus "REGISTERED | DISPATCHED | RECEIVED | DELIVERED"
    string quantity "Decimal escala 4"
    string unitOfMeasure
    string municipalityCode "DIVIPOLA"
    string zoneName
    string campaignRef FK
  }
  TRANSITION {
    string eventType
    string timestamp
    string anchorStatus "ANCHORED | IN_BATCH | PENDING | UNDER_REVIEW"
    string eventHash "64 hex"
    string evidenceRef "sha256:64hex"
  }
  ANCHOR_PROOF {
    string merkleRoot "64 hex"
    number leafIndex
    string transactionHash "0x + 64 hex"
    string network "sepolia | amoy"
  }
```
