'use client';
// Ref: plan-fase7-puesta-al-dia.md Anexo 5, U-32 a U-35; boceto 11 de paxfide-pantallas-web.html ("Datos de la
// organización"). El mismo formulario para crear y para editar, en dos bloques: lo público y lo de la verificación.
// La ubicación sale del catálogo DIVIPOLA del backend (U-33): nunca se escribe a mano.
import React, { useEffect, useState } from 'react';
import { fetchLocations, type LocationCatalog } from '../../lib/api/locations';
import { LOCKED_WHEN_VERIFIED, type ProfileErrors, type ProfileForm } from '../../lib/organization/profileModel';
import { SelectField, TextArea, TextField } from '../ui/Field';
import { Button } from '../ui/Button';
import { Surface, uiClasses as ui } from '../ui/Layout';
import s from './organizationProfile.module.css';

/** P3 (ficha R-7): el correo de contacto se publica. El aviso va siempre encima del campo. */
export const PUBLIC_EMAIL_NOTICE = 'Este correo se mostrará en la página pública de tus convocatorias';
export const LOCKED_HINT = 'No se puede cambiar después de la verificación';

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
  const [catalog, setCatalog] = useState<LocationCatalog | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);

  const loadCatalog = () => {
    setCatalogFailed(false);
    void locationsClient().then((r) => {
      if (r.kind === 'ok') setCatalog(r.catalog);
      else setCatalogFailed(true);
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadCatalog, [locationsClient]);

  const set = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange({ ...value, [k]: e.target.value });
  const locked = (k: keyof ProfileForm) => verified && LOCKED_WHEN_VERIFIED.includes(k);
  const department = catalog?.departments.find((d) => d.code === value.departmentCode);

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
        <fieldset className={s.location} aria-describedby={errors.location ? 'org-location-error' : undefined}>
          <legend className={s.legend}>Ubicación</legend>
          {catalogFailed ? (
            <div className={s.catalogError} role="alert" data-testid="locations-error">
              <span>No pudimos cargar los departamentos y municipios.</span>
              <Button variant="secondary" onClick={loadCatalog}>Reintentar</Button>
            </div>
          ) : (
            <div className={s.row2}>
              <SelectField label="Departamento" value={value.departmentCode} placeholder="Sin ubicación"
                disabled={disabled || !catalog}
                options={(catalog?.departments ?? []).map((d) => ({ value: d.code, label: d.name }))}
                // Cambiar de departamento vacía el municipio (U-33)
                onChange={(e) => onChange({ ...value, departmentCode: e.target.value, municipalityCode: '' })} />
              <SelectField label="Municipio" value={value.municipalityCode} placeholder="Elige un municipio"
                disabled={disabled || !department}
                options={(department?.municipalities ?? []).map((m) => ({ value: m.code, label: m.name }))}
                onChange={set('municipalityCode')} />
            </div>
          )}
          {errors.location && <span id="org-location-error" className={ui.error}>{errors.location}</span>}
        </fieldset>
        <p className={s.publicNotice} data-testid="public-email-notice">{PUBLIC_EMAIL_NOTICE}</p>
        <TextField label="Correo de contacto" value={value.contactEmail} onChange={set('contactEmail')} type="email"
          error={errors.contactEmail} disabled={disabled} autoComplete="email" />
      </Surface>

      <Surface title="Para la verificación (no se publica)" headingLevel={3}>
        <p className={ui.hint}>Solo los ve la plataforma para verificar la organización.</p>
        <TextField label="Razón social" value={value.legalName} onChange={set('legalName')} error={errors.legalName}
          readOnly={locked('legalName')} hint={locked('legalName') ? LOCKED_HINT : undefined} disabled={disabled} />
        <div className={s.nitRow}>
          <TextField label="NIT" value={value.nit} onChange={set('nit')} error={errors.nit} inputMode="numeric"
            readOnly={locked('nit')} hint={locked('nit') ? LOCKED_HINT : '9 dígitos, sin puntos ni guiones.'} disabled={disabled} />
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
