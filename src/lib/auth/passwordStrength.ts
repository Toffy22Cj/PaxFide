// Ref: Documentos/paxfide-landing.html (checkPassStrength); plan-fase7-fidelidad.md X-6 (12 como mínimo). El medidor
// del registro, del cambio de contraseña y de /recuperar. Es solo una ayuda: el backend decide (`PasswordTooShort`).
import { MIN_PASSWORD } from '../api/account';

export interface StrengthInfo {
  score: number;
  width: string;
  color: string;
  label: string;
}

export function calculateStrength(val: string): StrengthInfo {
  if (!val) {
    return { score: 0, width: '0%', color: 'var(--color-divider)', label: 'Seguridad de contraseña' };
  }
  let score = 0;
  if (val.length >= MIN_PASSWORD) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  if (val.length < MIN_PASSWORD || score <= 1) {
    return { score: 1, width: '25%', color: 'var(--color-danger-text)', label: 'Seguridad: Débil (al menos 12 caracteres)' };
  }
  if (score === 2) {
    return { score: 2, width: '50%', color: 'var(--color-ambiguous-title)', label: 'Seguridad: Media' };
  }
  if (score === 3) {
    return { score: 3, width: '75%', color: 'var(--color-action)', label: 'Seguridad: Segura' };
  }
  return { score: 4, width: '100%', color: 'var(--color-success-text)', label: 'Seguridad: ¡Excelente y robusta!' };
}

