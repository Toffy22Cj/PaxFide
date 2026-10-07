/**
 * Paso del `trackingCode` de la página de la donación a `/tracking` sin URL ni almacenamiento (DW-16): una variable
 * de módulo, en memoria de la pestaña, que se consume una sola vez. Recargar la pierde.
 */
let pending: string | null = null;

export function handOffTrackingCode(code: string) {
  pending = code;
}

export function consumeHandedOffTrackingCode(): string | null {
  const code = pending;
  pending = null;
  return code;
}
