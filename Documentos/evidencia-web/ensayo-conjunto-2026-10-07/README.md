# Ensayo conjunto — web contra el backend real (2026-10-07)

**Qué es:** el golden path recorrido **por la interfaz de la web** contra el backend **real** de la demo local
(`runbook-demo-local.md` del backend), no contra el simulado. Encargo: Autorización (2) §1.

**Base:** backend `develop` `231a7f6` (solo lectura), perfil `dev` con semilla, MongoDB y Ganache del
`docker-compose` de la demo, base vacía (runbook §7). Web `develop` + rama del ensayo, build de demo
(`NEXT_PUBLIC_SURFACE_PROFILE=demo`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1`), `next start` en `:3000`.
Única diferencia con el runbook: CORS a `http://localhost:3000` en la copia local de `demo.env` (D-05).

**Cómo se repite:** `ensayo/README.md`.

## Resultado

**20 de 20 pasos OK** (`pasos.json`); **53 llamadas** de la web al backend, **ninguna con error** (`red.json`: método,
ruta, código y `title`; sin cabeceras ni cuerpos).

| Paso | Por | Qué se vio contra el backend real |
|---|---|---|
| Login y `/me` de administrador, empleado y donante | UI | Entradas del panel según los papeles reales |
| Verificar la organización | **HTTP** | Sin pantalla de plataforma todavía (P2-C) |
| Crear convocatoria (CV-01) | UI | `201`; aparece en el listado real |
| Asignar empleado (CV-02) desde la fila, eligiendo entre los miembros | UI | `201`; responsable visible en la fila |
| Donar sin cuenta y con cuenta (CV-11), consultar el estado | UI | `trackingCode` revelado en pantalla (tapado en las capturas) |
| Confirmar el pago | **HTTP** | El test hace de proveedor de pago (webhook simulado firmado, DW-30) |
| Mis donaciones | UI | La donación con cuenta, "Confirmada" |
| Recaudado en la página pública | UI | 100.000 COP (60.000 + 40.000 enviados como unidades mínimas; D-01) |
| Fondo y asignación | **HTTP** | Sin pantalla de fondos todavía (P2-C) |
| Registrar activo (camino A) | UI | `201`; página del activo |
| Despachar, recibir, dividir (saga `202` + estado), entregar padre e hijo | UI | Todo `200`/`202`; el hijo nace `REGISTERED` |
| Seguimiento por formulario | UI | Hechos, bienes y relato de plantilla; el código nunca en la URL |
| Estimación | UI | Sin cifra: "La convocatoria aún no ha empezado" (`NOT_STARTED`: CV-01 exige inicio futuro) |
| Narrativa de la convocatoria | UI | `202` y después `UNAVAILABLE` con sus hechos (sin clave de LLM, lo esperado) |

## Diferencias encontradas (anotadas en `solicitudes-backend.md` §D)

- **D-05** CORS del ejemplo del runbook (`:5173`) frente a la web (`:3000`).
- **D-06** Cerrar una convocatoria no libera al `EMPLOYEE` responsable: no puede asignarse a ninguna otra
  (`409 EmployeeAlreadyAssigned`). El ensayo solo se puede repetir sobre una base vacía.
- **D-07** Cantidades con escala 4 (`"6.0000"`); la web las muestra tal cual.
- **D-08** El relato de plantilla está en inglés y muestra el `fundId` al donante.

## Lo que se corrigió en la web por el ensayo

- Texto de `EmployeeAlreadyAssigned`: decía "ya está asignada a esta convocatoria"; el backend lo usa para "ya es
  responsable de **otra** convocatoria activa" (el de esta convocatoria es `ResponsibleAlreadyActiveInCampaign`).
- Backend simulado: `deliver` solo desde `DISPATCHED`/`RECEIVED` (aceptaba `REGISTERED`, y eso ocultaba que el hijo de
  una división hay que despacharlo y recibirlo antes de entregarlo); asignación única del `EMPLOYEE` como el real.

## Capturas

`capturas/NN-paso.png` (1280 px). El `trackingCode` está tapado (rectángulo magenta) en todas.
Los números que faltan son pasos por HTTP, sin pantalla.
