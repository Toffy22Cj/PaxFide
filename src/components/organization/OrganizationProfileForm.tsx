'use client';
// Ref: plan-fase7-puesta-al-dia.md Anexo 5, U-32 a U-35; boceto 11 de paxfide-pantallas-web.html ("Datos de la
// organización"). El mismo formulario para crear y para editar, en dos bloques: lo público y lo de la verificación.
// La ubicación sale del catálogo DIVIPOLA del backend (U-33): nunca se escribe a mano.
import React from 'react';
import { fetchLocations } from '../../lib/api/locations';
import { LocationPicker } from '../location/LocationPicker';
import { LOCKED_WHEN_VERIFIED, type ProfileErrors, type ProfileForm } from '../../lib/organization/profileModel';
import { TextArea, TextField } from '../ui/Field';
import { Surface, uiClasses as ui } from '../ui/Layout';
import s from './organizationProfile.module.css';

/** P3 (ficha R-7): el correo de contacto se publica. El aviso va siempre encima del campo. */
export const PUBLIC_EMAIL_NOTICE = 'Este correo se mostrará en la página pública de tus convocatorias';
export const LOCKED_HINT = 'No se puede cambiar después de la verificación';
/** Anexo 7, U-49: solo un texto; los dos campos siguen siendo opcionales en el contrato. */
export const NEEDED_FOR_VERIFICATION = 'Necesarios para que la plataforma verifique la organización';

export function OrganizationProfileForm({ value, onChange, errors, type, verified, disabled, locationsClient = fetchLocations }: {
  value: ProfileForm;
  onChange: (next: ProfileForm) => void;
  errors: ProfileErrors;
  /** `FOUNDATION` o `COMPANY`: el régimen tributario especial solo aplica a una fundación. */
  type: string;
  /** U-35: verificada → nombre, razón social, NIT y dígito, solo lectura. */
  verified: boolean;
  disabled?: boolean;
  locationsClient?: typeof fetchLocations;
}) {
  const set = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange({ ...value, [k]: e.target.value });
  const locked = (k: keyof ProfileForm) => verified && LOCKED_WHEN_VERIFIED.includes(k);

  return (
    <div className={s.form}>
      <Surface title="Datos públicos" headingLevel={3}>
        <p className={ui.hint}>Se muestran a los donantes en la página de tus convocatorias.</p>
        <TextField label="Nombre" value={value.name} onChange={set('name')} error={errors.name}
          readOnly={locked('name')} hint={locked('name') ? LOCKED_HINT : undefined} disabled={disabled} maxLength={400} />
        <TextArea label="Descripción" value={value.description} onChange={set('description')} error={errors.description}
          hint="Hasta 500 caracteres, texto plano." disabled={disabled} rows={4} />
        <TextField label="Sitio web" value={value.website} onChange={set('website')} error={errors.website} type="url"
          placeholder="https://" hint="Una dirección que empiece por https://" disabled={disabled} />
        <LocationPicker legend="Ubicación" errorId="org-location-error" error={errors.location} disabled={disabled}
          locationsClient={locationsClient}
          value={{ departmentCode: value.departmentCode, municipalityCode: value.municipalityCode }}
          onChange={(l) => onChange({ ...value, ...l })} />
        <p className={s.publicNotice} data-testid="public-email-notice">{PUBLIC_EMAIL_NOTICE}</p>
        <TextField label="Correo de contacto" value={value.contactEmail} onChange={set('contactEmail')} type="email"
          error={errors.contactEmail} disabled={disabled} autoComplete="email" />
      </Surface>

      <Surface title="Para la verificación (no se publica)" headingLevel={3}>
        <p className={ui.hint}>Solo los ve la plataforma para verificar la organización.</p>
        <TextField label="Razón social" value={value.legalName} onChange={set('legalName')} error={errors.legalName}
          readOnly={locked('legalName')} hint={locked('legalName') ? LOCKED_HINT : NEEDED_FOR_VERIFICATION} disabled={disabled} />
        <div className={s.nitRow}>
          <TextField label="NIT" value={value.nit} onChange={set('nit')} error={errors.nit} inputMode="numeric"
            readOnly={locked('nit')} hint={locked('nit') ? LOCKED_HINT : `${NEEDED_FOR_VERIFICATION}. 9 dígitos, sin puntos ni guiones.`} disabled={disabled} />
          <TextField label="Dígito de verificación" value={value.nitCheckDigit} onChange={set('nitCheckDigit')}
            error={errors.nitCheckDigit} inputMode="numeric" maxLength={1} readOnly={locked('nitCheckDigit')} disabled={disabled} />
        </div>
        {type === 'FOUNDATION' && (
          <label className={s.check}>
            <input type="checkbox" checked={value.specialTaxRegime} disabled={disabled}
              onChange={(e) => onChange({ ...value, specialTaxRegime: e.target.checked })} />
            Pertenece al régimen tributario especial
          </label>
        )}
        <TextField label="Teléfono" value={value.contactPhone} onChange={set('contactPhone')} error={errors.contactPhone}
          inputMode="tel" hint="10 dígitos: celular (3…) o fijo (60…)." disabled={disabled} autoComplete="tel" />
      </Surface>
    </div>
  );
}
