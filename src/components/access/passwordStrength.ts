// Ref: plan-fase7-fidelidad.md F-A2 y X-6: el medidor de seguridad del prototipo (`checkPassStrength`), con 12
// caracteres como mínimo (el backend responde `PasswordTooShort` por debajo, H-P2-1). Lógica pura, sin DOM.

/** Nivel 0 = vacío; 1 débil; 2 media; 3 segura; 4 excelente. */
export type StrengthLevel = 0 | 1 | 2 | 3 | 4;
export const PASSWORD_MIN = 12;

/** Un punto por cada condición del prototipo: longitud mínima, mayúscula, número y símbolo. */
export function passwordStrength(value: string): StrengthLevel {
  if (!value) return 0;
  let score = 0;
  if (value.length >= PASSWORD_MIN) score++;
  if (/[A-ZÁÉÍÓÚÑ]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(value)) score++;
  if (score <= 1) return 1;
  return score as 2 | 3 | 4;
}

/** Textos del prototipo; el de "débil" recuerda además el mínimo cuando la contraseña es corta. */
export function strengthLabel(level: StrengthLevel, length: number): string {
  switch (level) {
    case 0: return 'Seguridad de contraseña';
    case 1: return length < PASSWORD_MIN
      ? `Seguridad: Débil (al menos ${PASSWORD_MIN} caracteres)`
      : 'Seguridad: Débil (añade números o mayúsculas)';
    case 2: return 'Seguridad: Media';
    case 3: return 'Seguridad: Segura';
    case 4: return 'Seguridad: ¡Excelente y robusta!';
    default: {
      const unreachable: never = level;
      throw new Error(`Nivel desconocido: ${String(unreachable)}`);
    }
  }
}
