# Autorización de tratamiento de datos personales

**Versión:** `v1-2026-10` · **Estado:** BORRADOR ACADÉMICO — redactado por el agente a petición de Carlos el 2026-10-24 (D-F17). **No es asesoría legal.** El equipo lo revisa antes de publicarlo. Lo que está entre corchetes [ ] se completa o se confirma.

> La versión de arriba es exactamente la cadena que el backend configura en `traceability.legal.data-policy-version` (ADR-050 D2). Si cambia una letra del texto, cambia la versión y todas las cuentas la vuelven a aceptar en su siguiente inicio de sesión (ADR-050 D3).

---

Al marcar la casilla "Autorizo el tratamiento de mis datos personales", autorizas de forma previa, expresa e informada a **[Responsable: nombre del equipo o de la institución, NIT o identificación, dirección]** ("el Responsable") a tratar tus datos personales en PaxFide según la Ley 1581 de 2012 y sus decretos reglamentarios.

## 1. Qué datos tratamos

| Dato | Cuándo | Obligatorio |
|---|---|---|
| Correo electrónico | Al crear la cuenta | Sí |
| Contraseña | Al crear la cuenta. Se guarda **solo como hash**: nadie puede leerla | Sí |
| Nombre y apellido | Si decides darlos, en cualquier momento | No |
| Registro de seguridad: inicios de sesión, cambios de contraseña, invitaciones, cambios de cuenta y su fecha | Mientras usas la plataforma | Sí, por seguridad |
| Tus donaciones: convocatoria, monto, medio de pago, estado y fechas | Al donar | Sí, para poder seguirlas |
| Datos de la organización que registres: tipo, nombre y logo | Si registras una organización | Solo para organizaciones |

**No tratamos** números de tarjeta ni datos bancarios: el pago lo hace la pasarela de pagos y PaxFide solo recibe su resultado. **[Confirmar con la pasarela usada en la demo.]**

## 2. Para qué los usamos

1. Crear y proteger tu cuenta, e iniciar tu sesión.
2. Registrar tus donaciones y dejarte seguir su recorrido con tu código de seguimiento.
3. Dejar a las organizaciones gestionar sus convocatorias, sus fondos y sus lotes.
4. **Seguridad y auditoría:** guardar un registro de las acciones sobre las cuentas para detectar abusos y responder a incidentes. Este registro es de solo escritura, y sus entradas se conservan aunque desactives la cuenta (ver §5).
5. Enviarte los correos necesarios para el servicio: invitaciones a una organización y recuperación de la contraseña. No enviamos publicidad.

## 3. Qué nunca sale de PaxFide

- **Tu correo y tu nombre no forman parte de la trazabilidad pública.** Los eventos que se encadenan con hash y se anclan en la blockchain usan una referencia seudónima, nunca tu correo ni tu nombre. En la blockchain solo se publica una huella (la raíz de Merkle) de muchos eventos juntos.
- Los resúmenes generados por inteligencia artificial se hacen con hechos de la donación que no incluyen tu correo ni tu nombre.
- No vendemos ni cedemos tus datos.

## 4. Tus derechos (artículo 8 de la Ley 1581)

Puedes **conocer, actualizar y rectificar** tus datos; **pedir prueba** de esta autorización; **saber qué uso** les hemos dado; **revocar** la autorización o **pedir la supresión** cuando no haya un deber legal o contractual de conservarlos; **presentar quejas** ante la Superintendencia de Industria y Comercio; y **acceder gratis** a tus datos.

Cómo ejercerlos: escribe a **[correo de contacto del Responsable]**.
- **Consultas:** respuesta en máximo 10 días hábiles, prorrogables 5 (art. 14).
- **Reclamos, supresión y revocación:** respuesta en máximo 15 días hábiles, prorrogables 8 (art. 15). La supresión la atiende manualmente el administrador de la plataforma (ADR-050 D10).

## 5. Desactivar no es borrar

Puedes desactivar tu cuenta desde tu Perfil. Desactivar impide que vuelvas a entrar, pero **no borra** tus datos. Si pides la supresión, anonimizamos tu correo y tu nombre en la cuenta. Los eventos de trazabilidad no cambian, porque nunca los contuvieron. Las entradas del registro de seguridad que ya existían se conservan para la finalidad del punto 2.4.

## 6. Dónde se guardan

**[Proveedor e infraestructura donde se aloja la base de datos y país; confirmar antes de publicar. Si hay transferencia internacional (alojamiento o modelo de IA fuera de Colombia), declararla aquí.]**

## 7. Cambios

Si este texto cambia, verás la nueva versión al iniciar sesión y tendrás que aceptarla para continuar.
