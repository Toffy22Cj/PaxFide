import { toMinorUnits } from './money';

/**
 * Cuerpo de CV-01 (ficha CONGELADA; cuerpo anidado, Q-CV01-12 (b)) a partir del formulario. Valida en cliente las
 * reglas de la ficha §3.1 para no enviar lo que el backend rechazaría con 400; el backend sigue siendo la autoridad.
 */
export interface CampaignFormValues {
  title: string;
  description: string;
  visibility: string;
  /** `datetime-local` (hora local del navegador). */
  start: string;
  end: string;
  donationTypes: string[];
  paymentMethods: string[];
  currency: string;
  /** En unidades de la moneda, como lo escribe la persona. */
  target: string;
  targetPolicy: string;
  onTargetReached: string;
}

export type CampaignFormErrors = Partial<Record<keyof CampaignFormValues, string>>;

export interface CreateCampaignBody {
  title: string;
  description?: string;
  visibility: string;
  startDate: string;
  endDate: string;
  configuration: {
    acceptedDonationTypes: string[];
    acceptedPaymentMethods: string[];
    currency?: string;
    targetAmount?: string;
    targetPolicy?: string;
    onTargetReached?: string;
  };
}

/** `datetime-local` → instante ISO-8601 UTC con `Z` y sin milisegundos (T-34). */
export function localToUtcIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function buildCreateCampaign(v: CampaignFormValues, now: Date = new Date()):
  { body: CreateCampaignBody; errors: null } | { body: null; errors: CampaignFormErrors } {
  const errors: CampaignFormErrors = {};
  const title = v.title.trim();
  if (!title) errors.title = 'Este campo es obligatorio.';
  else if (title.length > 200) errors.title = 'Máximo 200 caracteres.';
  if (!['PUBLIC', 'PRIVATE_LINK'].includes(v.visibility)) errors.visibility = 'Elige la visibilidad.';

  const startDate = localToUtcIso(v.start);
  const endDate = localToUtcIso(v.end);
  const floor = now.getTime() - 5 * 60 * 1000;
  if (!startDate) errors.start = 'Indica la fecha y hora de inicio.';
  else if (new Date(startDate).getTime() < floor) errors.start = 'La fecha de inicio no puede estar en el pasado.';
  if (!endDate) errors.end = 'Indica la fecha y hora de fin.';
  else if (startDate && new Date(endDate).getTime() <= new Date(startDate).getTime()) {
    errors.end = 'La fecha de fin debe ser posterior a la de inicio.';
  }

  if (v.donationTypes.length === 0) errors.donationTypes = 'Elige al menos un tipo de donación.';
  const monetary = v.donationTypes.includes('MONETARY');
  const configuration: CreateCampaignBody['configuration'] = {
    acceptedDonationTypes: [...v.donationTypes],
    acceptedPaymentMethods: monetary ? [...v.paymentMethods] : [],
  };

  if (monetary) {
    if (v.paymentMethods.length === 0) errors.paymentMethods = 'Elige al menos un medio de pago.';
    const currency = v.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) errors.currency = 'Código ISO 4217 de tres letras (por ejemplo, COP).';
    const targetAmount = /^[A-Z]{3}$/.test(currency) ? toMinorUnits(v.target, currency) : null;
    if (!targetAmount) errors.target = 'Escribe una meta mayor que cero, sin separador de miles.';
    if (!['FLEXIBLE', 'STRICT', 'CLOSE_ON_TARGET'].includes(v.targetPolicy)) errors.targetPolicy = 'Elige la política de meta.';
    if (v.targetPolicy === 'CLOSE_ON_TARGET' && !['CLOSE', 'REJECT_EXCESS', 'ACCEPT_EXCESS'].includes(v.onTargetReached)) {
      errors.onTargetReached = 'Elige qué pasa al alcanzar la meta.';
    }
    configuration.currency = currency;
    if (targetAmount) configuration.targetAmount = targetAmount;
    configuration.targetPolicy = v.targetPolicy;
    // Presente si y solo si CLOSE_ON_TARGET (ficha §3.1)
    if (v.targetPolicy === 'CLOSE_ON_TARGET') configuration.onTargetReached = v.onTargetReached;
  }

  if (Object.keys(errors).length > 0) return { body: null, errors };
  const body: CreateCampaignBody = {
    title, visibility: v.visibility, startDate: startDate as string, endDate: endDate as string, configuration,
  };
  if (v.description.trim()) body.description = v.description.trim();
  return { body, errors: null };
}
