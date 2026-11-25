# 10. Seguridad

> Este documento resume los mecanismos de seguridad comprobados en el código de `paxfide-web` y los riesgos técnicos identificados.

---

## 1. Autenticación y Gestión de Sesión (`ADR-046 D2`)
- **Almacenamiento exclusivo en RAM**: [`src/lib/auth/session.ts`](../../src/lib/auth/session.ts) mantiene el JWT en una variable privada de módulo. Nunca se escribe en `localStorage`, `sessionStorage`, `cookies` ni `IndexedDB`, mitigando la persistencia de tokens robados tras cerrar la pestaña.
- **Sin cookies (`credentials: 'omit'`)**: [`src/lib/api/http.ts`](../../src/lib/api/http.ts) y [`src/lib/api/assetClient.ts`](../../src/lib/api/assetClient.ts) envían todas las peticiones con `credentials: 'omit'`, eliminando la superficie clásica de CSRF por cookies de sesión.
- **Cierre sincronizado entre pestañas (`G-W3`)**: `BroadcastChannel('paxfide_logout_signal')` cierra la sesión en todas las pestañas abiertas del mismo origen cuando el usuario cierra sesión manualmente, cambia contraseña con error o desactiva su cuenta.
- **Protección contra `bfcache`**: [`src/app/RouteGuard.tsx`](../../src/app/RouteGuard.tsx) escucha `window.addEventListener('pageshow', ...)` y fuerza `window.location.reload()` si una ruta `AUTHENTICATED` es restaurada desde caché del navegador tras un logout.
- **Expiración `401` (Transición T-1)**: Un `401` en una petición que portaba JWT ejecuta `handle401(false)` (logout local `EXPIRED`). Un `401` en `/donations/tracking*` (`auth: 'none'`) **nunca** afecta la sesión de cuenta.

---

## 2. Autorización
- **Autorización 100 % en backend**: Ni `isSurfaceEnabled()` ([`surfaces.ts`](../../src/lib/routing/surfaces.ts)) ni `navEntriesFor()` ([`navEntries.ts`](../../src/lib/nav/navEntries.ts)) ni `usePrincipal()` son barreras de autorización; únicamente controlan presentación de UI. Toda pantalla gestiona explícitamente HTTP `403` mediante `<ForbiddenState />`.

---

## 3. Protección de Secretos al Portador (`ADR-041 §2.7` y `ADR-046 D7`)
- **`referrerPolicy: 'no-referrer'` global y por petición**: Declarado en [`src/app/layout.tsx`](../../src/app/layout.tsx) (`metadata.referrer = "no-referrer"`) y en cada `fetch` de `http.ts` / `assetClient.ts`, evitando fugas de `publicCode` u otros segmentos en cabeceras `Referer`.
- **`trackingCode` nunca en la URL**: [`src/lib/routing/classifier.ts`](../../src/lib/routing/classifier.ts) clasifica cualquier `/tracking/<segmento>` como `NOT_APPROVED` (404). El código viaja exclusivamente en `Authorization: Bearer <trackingCode>`.
- **Purga inmediata de `#token=`**: En `/invitaciones`, `/recuperar` y `/verificar-correo`, el token del fragmento URL se copia a RAM y se borra con `window.history.replaceState` antes de disparar peticiones de red.
- **SSR sin indexación ni `og:url`**: `/c/[publicCode]` emite `robots: { index: false, follow: false }` y omite `og:url` en Open Graph para no propagar `publicCode`.
- **Imágenes privadas sin token en URL**: [`PrivateImage.tsx`](../../src/components/media/PrivateImage.tsx) y [`media.ts`](../../src/lib/api/media.ts) descargan recursos privados con `Authorization: Bearer <jwt>` y crean un `ObjectURL` local revocable.
- **Cero logging de peticiones**: `http.ts`, `publicServer.ts` y `deliveryEvidence.ts` nunca imprimen rutas, cabeceras ni cuerpos en `console.*`.

---

## 4. Frontera Sin-BFF (`C1`) y Validación de Entradas
- [`src/lib/api/config.ts`](../../src/lib/api/config.ts) lanza `ApiBaseUrlMisconfiguredError` si `NEXT_PUBLIC_API_BASE_URL` está ausente o coincide con `window.location.origin`.
- [`scripts/check-server-imports.js`](../../scripts/check-server-imports.js) falla el CI si cualquier archivo sin `'use client'` importa `auth/session`, `auth/usePrincipal`, `api/http` o `api/publicCampaigns`.
- Validaciones defensivas en cliente (sin sustituir al servidor): `encodeURIComponent` vía `segment()`, regex estrictas para hashes hexadecimales (`^[0-9a-f]{64}$`, `^0x[0-9a-fA-F]{64}$`, `^sha256:[0-9a-f]{64}$`), validación de tamaño/MIME en evidencias (`<= 5 MB`, JPEG/PNG), rechazo de `<` y `>` en descripciones organizacionales, tabla cerrada de exploradores blockchain (`sepolia`, `amoy`) y no exposición de `ProblemDetail.detail`.

---

## 5. Riesgos Identificados y Consideraciones
1. **Exposición a XSS en scripts en línea de `<head>`**: `RootLayout` inyecta `THEME_INIT_SCRIPT` y `NAV_POSITION_INIT_SCRIPT` con `dangerouslySetInnerHTML`. Ambos son literales constantes sin entrada de usuario, pero si se implementa una política CSP estricta sin `'unsafe-inline'`, requerirán hash SHA-256 o nonce en cabecera HTTP.
2. **Ausencia de cabeceras de seguridad HTTP en `next.config.ts`**: [`next.config.ts`](../../next.config.ts) solo configura `allowedDevOrigins`. Cabeceras como `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options` / `frame-ancestors` y `X-Robots-Tag` deben garantizarse en el reverse proxy / CDN de despliegue (o agregarse en `next.config.ts`).
3. **Hooks de prueba en builds E2E**: Cuando `NEXT_PUBLIC_E2E_BUILD` está activo, se exponen `window.__TEST_SESSION__` y `window.__TEST_ROUTER__`. **Invariante operativo**: nunca construir producción con `NEXT_PUBLIC_E2E_BUILD` definido.
