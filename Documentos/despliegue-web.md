# Despliegue de la web — comprobación de las condiciones del backend (2026-11-01)

**Qué es:** la comprobación 2b del prompt del 2026-11-01. Revisa, una por una, las condiciones de
`Donaciones/Documentos/despliegue-backend-2026-10.md` §2 (Donaciones `develop` `3726414`) que dependen de la web.
**No cambia código de la web:** solo comprueba y documenta. Lo que falla se reporta aquí con su evidencia.

**Base comprobada:** `paxfide-web` `develop` `2414832`, con P-13 (rutas activas por defecto) y P-6 (verificación del
correo) dentro.

| # | Condición | Resultado |
|---|---|---|
| a | El build normal sirve `/verificar-correo`, `/recuperar` e `/invitaciones`, y los enlaces de los correos abren esas pantallas | ✅ Cumple |
| b | La web maneja los dos 403 del login, `EmailNotVerified` y `AcceptanceRequired` | ✅ Cumple |
| c | Variables de la web para producción, y su relación con `TRACEABILITY_CORS_ALLOWED_ORIGINS` y `TRACEABILITY_WEB_BASE_URL` | ✅ Documentadas abajo. Los valores reales los pone quien despliega |
| d | Los textos legales publicados en `/terminos`, `/privacidad` y `/terminos-organizacion` corresponden a `v1-2026-10` | ❌ **No corresponde: bloquea el despliegue.** Ver §d |

---

## a. Rutas del build normal y enlaces de los correos

- **Build normal:** desde U-27 (P-13), `pnpm build` sin `NEXT_PUBLIC_SURFACE_PROFILE` usa la lista única
  `src/lib/routing/enabled-surfaces.demo.json`, que incluye `/verificar-correo`, `/recuperar` e `/invitaciones`.
- **Enlaces de los correos** (`referencia-api-v1.md` §1): `{TRACEABILITY_WEB_BASE_URL}/verificar-correo#token=…`,
  `/recuperar#token=…` e `/invitaciones#token=…`. El token va en el fragmento y la web lo borra de la barra antes de
  nada.
- **Evidencia:** `e2e/production.spec.ts`, bloque "Enlaces de los correos con el build normal (2b-a)", corre en
  `playwright.prod.config.ts`. Construye la web **sin perfil y sin lista de tests** y usa el servidor falso como buzón.
  Un E2E por enlace:
  - **verificar:** registra una cuenta, abre el enlace del correo y termina en `/login` con "Tu correo quedó
    verificado";
  - **recuperar:** pide la recuperación, abre el enlace y aparece "Contraseña nueva";
  - **invitación:** un administrador invita, se abre el enlace y aparece "Invitación a una organización".

  En los tres, el token ya no está en la URL. Además, en el mismo archivo, `/login`, `/campaigns` y `/verificar-correo`
  responden 200, y `/tracking/x` y `/panel/platform/x` dan 404.
- La salida literal está en `Documentos/evidencia-web/ci-local-*.txt` de esta rama (paso "Playwright E2E Tests", la
  tercera tanda: `playwright.prod.config.ts`).

## b. Los dos 403 del login

Los tests ya existían; aquí solo se citan.

| 403 | Tests |
|---|---|
| `EmailNotVerified` (ADR-050 Enmienda 2, E2-3) | `e2e/email-verification.spec.ts`: "registro → «Revisa tu correo» → login con 403 → enlace → login → /home; sin sesión tras confirmar" y "el 403 EmailNotVerified gana a AcceptanceRequired: sin verificar y sin términos, se ve la verificación". `__tests__/email-verification-p6.test.tsx`: "login: 403 EmailNotVerified → email-not-verified…" y "login con 403 EmailNotVerified: «Antes de entrar, confirma tu correo» con «Reenviar»; la contraseña no queda en el DOM" |
| `AcceptanceRequired` (ADR-050 D3) | `e2e/contratos-p0.spec.ts`: "R-2 / U-2: una cuenta con condiciones pendientes ve «Actualizamos nuestras condiciones» y entra tras aceptar" y "U-2: «Cancelar» vuelve al formulario…". `__tests__/contratos-p0.test.tsx`: "login: sin aceptación el cuerpo es {email, password}; 403 AcceptanceRequired trae solo las pendientes, sin token" y "403 → «Actualizamos nuestras condiciones» con una casilla por pendiente; «Aceptar y entrar» repite el login con las versiones" |

**El orden es el del backend:** `EmailNotVerified` se ve antes que `AcceptanceRequired`, porque lo decide el servidor
y la web solo lo muestra. Lo prueba el E2E de precedencia citado arriba.

**Google (#166):** la web no tiene `POST /auth/google` (Anexo 5, PD-7 pendiente de Carlos). Cuando lo tenga, los mismos
dos 403 tendrán que tratarse también ahí.

## c. Variables de la web en producción

| Variable | Valor | Para qué |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | **Obligatoria.** La URL de la API con `/api/v1`, por ejemplo `https://api.<dominio>/api/v1` | Se fija **al construir** (`NEXT_PUBLIC_*` queda dentro del bundle). Tiene que ser **otro origen** que la web: si fuera el mismo, `getApiBase()` lanza `ApiBaseUrlMisconfiguredError` (`src/lib/api/config.ts`; ADR-046 D3, sin BFF) |
| `API_INTERNAL_BASE_URL` | Opcional | Solo para la lectura pública de CV-07 desde el servidor de Next (SSR y OG de `/c/…`, `src/lib/api/publicServer.ts`). Si la red interna llega a la API por otra URL, se pone aquí. Nunca lleva credenciales |
| `NEXT_PUBLIC_SURFACE_PROFILE` | **Sin poner** | Sin perfil, la lista única de pantallas (U-27). `none` lo apaga todo y solo sirve para tests |
| `NEXT_PUBLIC_E2E_BUILD`, `NEXT_PUBLIC_E2E_SURFACES` | **Nunca en producción** | Son de los tests. `NEXT_PUBLIC_E2E_BUILD` expone ayudas de test en `window` (lo vigila `e2e/production.spec.ts`) |

**Relación con las variables del backend (las pone Manuel):**
- **`TRACEABILITY_CORS_ALLOWED_ORIGINS`** tiene que contener el **origen exacto** desde el que se sirve la web: esquema,
  host y puerto, sin ruta ni barra final. Por ejemplo, `https://<dominio-web>`. Si la web también se abre por otro
  host (con y sin `www.`), van los dos, separados por coma. Nunca `*`.
- **`TRACEABILITY_WEB_BASE_URL`** es la URL base pública de la web, la misma que ese origen (`https://<dominio-web>`).
  El backend le añade `/verificar-correo#token=…`, `/recuperar#token=…` e `/invitaciones#token=…`, que el build normal
  sirve (a).
- **El dominio real no está decidido en ningún documento de los dos repos:** lo fija quien despliega. Hasta entonces,
  los valores de arriba son la regla, no un valor.

## d. Textos legales — NO CORRESPONDEN (bloquea el despliegue)

**Cumple:** la **versión**. Las tres pantallas publican `v1-2026-10` (`src/lib/legal/versions.ts`, la misma cadena de
`TRACEABILITY_LEGAL_*_VERSION`), y los tres textos de `Documentos/legal/*-v1-2026-10.md` llevan esa versión.

**No cumple:** el **texto publicado** en la web (`src/screens/LegalScreen.tsx`) **no es** el de
`Documentos/legal/*-v1-2026-10.md`. Con la misma cadena de versión hay dos textos distintos. Comparado frase a frase:

| Pantalla | Lo que tiene `Documentos/legal/` y la web no publica |
|---|---|
| `/privacidad` | La identificación del Responsable ("autorizas … a [Responsable: nombre…, NIT…, dirección]"); **cómo ejercer los derechos** (contacto y plazos de los arts. 14 y 15 de la Ley 1581); la sección **"6. Dónde se guardan"** entera; que el registro de seguridad es de solo escritura y se conserva tras desactivar; el detalle de cada dato de la tabla y de la huella en la blockchain |
| `/terminos-organizacion` | La frase de entrada ("Al registrar una organización … declaras que la representas y aceptas lo siguiente en su nombre"); "un registro equivocado sigue en el historial" |
| `/terminos` | La universidad, el programa y el curso del proyecto académico, y el correo de contacto |

**Además, los textos de `Documentos/legal/` no están cerrados:** tienen huecos `[Confirmar…]` y `[…]` sin completar.
Por ejemplo: el Responsable y su correo, la universidad, la pasarela de la demo, dónde se aloja la base de datos y si
hay transferencia internacional, qué pasa con los fondos sobrantes y cómo se corrige un registro equivocado. Por lo
tanto, ni el texto de la web ni el `.md` son hoy un texto `v1-2026-10` publicable.

**Por qué bloquea:** la condición 3 de `despliegue-backend-2026-10.md` §2 exige que los textos `v1-2026-10` estén
publicados. Las cuentas aceptan una versión (ADR-050 D2 y D3), y lo que aceptan tiene que ser exactamente ese texto.

**Qué no se hizo:** no se cambió ningún texto, como pide el prompt.

**Qué queda para Carlos:**
1. Completar los huecos de `Documentos/legal/`.
2. Que la web publique exactamente ese texto.
3. Decidir si, con el texto ya cerrado, la versión sigue siendo `v1-2026-10` (si ya hay cuentas que aceptaron la
   anterior, ADR-050 D3 obliga a cambiarla). Con R-7, el texto de los términos de organización también lo cambia
   Carlos (`ficha-R7-perfil-organizacion.md:131`).
