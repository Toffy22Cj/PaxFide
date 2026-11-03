'use client';
// Ref: plan-fase7-puesta-al-dia.md Anexo 5, U-33 (los dos selectores dependientes, del perfil de la organización, P-15)
// y Anexo 7, U-44 y U-45 (los mismos selectores en los pasos del lote). Un solo componente para los dos usos: el
// catálogo sale de `GET /public/locations` (una vez por sesión), nunca se escribe a mano, y cambiar de departamento vacía
// el municipio. Con un `municipalityCode` inicial sin departamento (el del lote, U-45), el departamento se busca en el
// catálogo; nunca se deduce de un texto libre.
import React, { useEffect, useState } from 'react';
import { fetchLocations, type LocationCatalog } from '../../lib/api/locations';
import { SelectField } from '../ui/Field';
import { Button } from '../ui/Button';
import { uiClasses as ui } from '../ui/Layout';
import s from './LocationPicker.module.css';

export interface LocationValue { departmentCode: string; municipalityCode: string }
export type CatalogState = 'loading' | 'ready' | 'failed';

export function LocationPicker({
  legend, value, onChange, error, errorId, hint, disabled, departmentPlaceholder = 'Sin ubicación',
  locationsClient = fetchLocations, onCatalogState, testId,
}: {
  legend: string;
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  error?: string;
  errorId: string;
  /** Una ayuda encima de los selectores (U-44: qué se publica y qué no). */
  hint?: string;
  disabled?: boolean;
  departmentPlaceholder?: string;
  locationsClient?: typeof fetchLocations;
  /** Para que el formulario no envíe un comando sin catálogo (U-44). */
  onCatalogState?: (state: CatalogState) => void;
  testId?: string;
}) {
  const [catalog, setCatalog] = useState<LocationCatalog | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setFailed(false);
    onCatalogState?.('loading');
    void locationsClient().then((r) => {
      if (r.kind === 'ok') { setCatalog(r.catalog); onCatalogState?.('ready'); }
      else { setFailed(true); onCatalogState?.('failed'); }
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [locationsClient]);

  // U-45: el municipio inicial sin departamento → su departamento en el catálogo; si no está, se deja vacío
  useEffect(() => {
    if (!catalog || value.departmentCode || !value.municipalityCode) return;
    const dep = catalog.departments.find((d) => d.municipalities.some((m) => m.code === value.municipalityCode));
    onChange(dep ? { departmentCode: dep.code, municipalityCode: value.municipalityCode } : { departmentCode: '', municipalityCode: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, value.departmentCode, value.municipalityCode]);

  const department = catalog?.departments.find((d) => d.code === value.departmentCode);
  return (
    <fieldset className={s.location} aria-describedby={error ? errorId : undefined} data-testid={testId}>
      <legend className={s.legend}>{legend}</legend>
      {hint && <p className={ui.hint}>{hint}</p>}
      {failed ? (
        <div className={s.catalogError} role="alert" data-testid="locations-error">
          <span>No pudimos cargar los departamentos y municipios.</span>
          <Button variant="secondary" onClick={load}>Reintentar</Button>
        </div>
      ) : (
        <div className={s.row2}>
          <SelectField label="Departamento" value={value.departmentCode} placeholder={departmentPlaceholder}
            disabled={disabled || !catalog}
            options={(catalog?.departments ?? []).map((d) => ({ value: d.code, label: d.name }))}
            onChange={(e) => onChange({ departmentCode: e.target.value, municipalityCode: '' })} />
          <SelectField label="Municipio" value={value.municipalityCode} placeholder="Elige un municipio"
            disabled={disabled || !department}
            options={(department?.municipalities ?? []).map((m) => ({ value: m.code, label: m.name }))}
            onChange={(e) => onChange({ ...value, municipalityCode: e.target.value })} />
        </div>
      )}
      {error && <span id={errorId} className={ui.error}>{error}</span>}
    </fieldset>
  );
}
