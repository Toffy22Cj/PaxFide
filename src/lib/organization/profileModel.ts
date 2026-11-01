// Ref: plan-fase7-puesta-al-dia.md Anexo 5, U-32 a U-35 (perfil de la organización); ficha R-7 del backend
// (referencia-api-v1.md §3, nota del 2026-10-31). Validación igual que `OrganizationProfile`, `Nit` y
// `OrganizationLocation` de Donaciones `3726414`, sin sustituir al servidor. Lógica pura, sin DOM.

/** Lo que el backend devuelve y acepta (los campos van planos; la ubicación, con códigos DIVIPOLA). */
export interface OrganizationProfileContract {
  description?: string;
  website?: string;
  location?: { departmentCode: string; municipalityCode: string };
  contactEmail?: string;
  legalName?: string;
  nit?: string;
  nitCheckDigit?: string;
  specialTaxRegime?: boolean;
  contactPhone?: string;
}

/** El formulario: todo texto, '' = vacío. */
export interface ProfileForm {
  name: string;
  description: string;
  website: string;
  departmentCode: string;
  municipalityCode: string;
  contactEmail: string;
  legalName: string;
  nit: string;
  nitCheckDigit: string;
  specialTaxRegime: boolean;
  contactPhone: string;
}

export type ProfileField = keyof ProfileForm | 'location';
export type ProfileErrors = Partial<Record<ProfileField, string>>;

export const NAME_MAX = 200;
export const DESCRIPTION_MAX = 500;
export const WEBSITE_MAX = 200;
export const LEGAL_NAME_MAX = 200;

export const EMPTY_FORM: ProfileForm = {
  name: '', description: '', website: '', departmentCode: '', municipalityCode: '', contactEmail: '', legalName: '',
  nit: '', nitCheckDigit: '', specialTaxRegime: false, contactPhone: '',
};

const codePoints = (v: string) => Array.from(v).length;

/** DIAN: pesos 3, 7, 13, 17, 19, 23, 29, 37 y 41 de derecha a izquierda; r = suma mod 11; dígito r si r ≤ 1, si no 11 − r. */
export function nitCheckDigitOf(nineDigits: string): number | null {
  if (!/^\d{9}$/.test(nineDigits)) return null;
  const W = [3, 7, 13, 17, 19, 23, 29, 37, 41];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(nineDigits[8 - i]) * W[i];
  const r = sum % 11;
  return r <= 1 ? r : 11 - r;
}

/** Correo como el validador de cuentas del backend (forma `local@dominio.tld`, sin espacios). */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function websiteOk(v: string): boolean {
  if (v.length > WEBSITE_MAX) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password && v.startsWith('https://');
  } catch {
    return false;
  }
}

/** U-34: los mensajes por campo. El servidor sigue decidiendo (sus 400 no dicen qué campo falló). */
export function validateProfile(f: ProfileForm, type: string): ProfileErrors {
  const e: ProfileErrors = {};
  const name = f.name.trim();
  if (codePoints(name) < 1) e.name = 'Este campo es obligatorio.';
  else if (codePoints(name) > NAME_MAX) e.name = `Escribe como máximo ${NAME_MAX} caracteres.`;
  const description = f.description.trim();
  if (codePoints(description) > DESCRIPTION_MAX) e.description = `Escribe como máximo ${DESCRIPTION_MAX} caracteres.`;
  else if (/[<>]/.test(description)) e.description = 'La descripción es texto plano: sin los signos < ni >.';
  const website = f.website.trim();
  if (website && !websiteOk(website)) e.website = 'Escribe una dirección completa que empiece por https://';
  if ((f.departmentCode === '') !== (f.municipalityCode === '')) e.location = 'Elige el departamento y el municipio.';
  else if (f.departmentCode && !f.municipalityCode.startsWith(f.departmentCode)) e.location = 'Elige el departamento y el municipio.';
  const email = f.contactEmail.trim();
  if (email && !EMAIL.test(email)) e.contactEmail = 'Escribe un correo válido.';
  const legalName = f.legalName.trim();
  if (codePoints(legalName) > LEGAL_NAME_MAX) e.legalName = `Escribe como máximo ${LEGAL_NAME_MAX} caracteres.`;
  const nit = f.nit.trim();
  const dv = f.nitCheckDigit.trim();
  if (nit || dv) {
    if (!/^\d{9}$/.test(nit)) e.nit = 'El NIT tiene 9 dígitos, sin puntos ni guiones.';
    else if (!/^\d$/.test(dv) || Number(dv) !== nitCheckDigitOf(nit)) e.nitCheckDigit = 'Revisa el dígito de verificación';
  }
  if (f.specialTaxRegime && type !== 'FOUNDATION') e.specialTaxRegime = 'Solo aplica a fundaciones.';
  const phone = f.contactPhone.trim();
  if (phone && !/^(3\d{9}|60\d{8})$/.test(phone)) e.contactPhone = 'Escribe 10 dígitos que empiecen por 3 (celular) o por 60 (fijo).';
  return e;
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

/**
 * U-32: el cuerpo de `PUT …/profile` lleva **todos** los campos. En el contrato, ausente o `null` **borra**: un campo
 * vacío se envía como `null` a propósito, y uno que el usuario no tocó conserva su valor porque el formulario se llenó
 * con lo que había (`formFromContract`). Nunca se omite un campo.
 */
export function profileBody(f: ProfileForm, type: string) {
  return {
    name: f.name.trim(),
    description: orNull(f.description),
    website: orNull(f.website),
    location: f.departmentCode && f.municipalityCode ? { departmentCode: f.departmentCode, municipalityCode: f.municipalityCode } : null,
    contactEmail: orNull(f.contactEmail),
    legalName: orNull(f.legalName),
    nit: orNull(f.nit),
    nitCheckDigit: orNull(f.nitCheckDigit),
    // `specialTaxRegime` solo vale para una FOUNDATION; en otra, nunca se envía `true`
    specialTaxRegime: type === 'FOUNDATION' ? f.specialTaxRegime : null,
    contactPhone: orNull(f.contactPhone),
  };
}

/** Al crear (`POST /organizations`), solo los campos rellenos (todos opcionales en el contrato). */
export function createBody(f: ProfileForm, type: string) {
  const all = profileBody(f, type);
  const out: Record<string, unknown> = { type };
  for (const [k, v] of Object.entries(all)) if (v !== null && v !== false) out[k] = v;
  return out;
}

export function formFromContract(name: string | undefined, p: OrganizationProfileContract): ProfileForm {
  return {
    name: name ?? '',
    description: p.description ?? '',
    website: p.website ?? '',
    departmentCode: p.location?.departmentCode ?? '',
    municipalityCode: p.location?.municipalityCode ?? '',
    contactEmail: p.contactEmail ?? '',
    legalName: p.legalName ?? '',
    nit: p.nit ?? '',
    nitCheckDigit: p.nitCheckDigit ?? '',
    specialTaxRegime: p.specialTaxRegime === true,
    contactPhone: p.contactPhone ?? '',
  };
}

/** Lee el perfil de una respuesta del backend (S-18, la cola de la plataforma o `PUT …/profile`); lo demás se descarta. */
export function profileFromResponse(d: Record<string, unknown>): OrganizationProfileContract {
  const s = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const loc = d.location && typeof d.location === 'object' ? (d.location as Record<string, unknown>) : null;
  const out: OrganizationProfileContract = {};
  if (s(d.description)) out.description = s(d.description);
  if (s(d.website)) out.website = s(d.website);
  if (loc && s(loc.departmentCode) && s(loc.municipalityCode)) {
    out.location = { departmentCode: s(loc.departmentCode)!, municipalityCode: s(loc.municipalityCode)! };
  }
  if (s(d.contactEmail)) out.contactEmail = s(d.contactEmail);
  if (s(d.legalName)) out.legalName = s(d.legalName);
  if (s(d.nit)) out.nit = s(d.nit);
  if (s(d.nitCheckDigit)) out.nitCheckDigit = s(d.nitCheckDigit);
  if (typeof d.specialTaxRegime === 'boolean') out.specialTaxRegime = d.specialTaxRegime;
  if (s(d.contactPhone)) out.contactPhone = s(d.contactPhone);
  return out;
}

/** U-35: con la organización verificada, nombre, razón social, NIT y dígito no cambian (P1 del backend). */
export const LOCKED_WHEN_VERIFIED: (keyof ProfileForm)[] = ['name', 'legalName', 'nit', 'nitCheckDigit'];
