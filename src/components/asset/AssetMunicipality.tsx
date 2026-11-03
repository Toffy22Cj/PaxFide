'use client';
// Ref: plan-fase7-puesta-al-dia.md Anexo 7, U-44 a U-46; referencia-api-v1.md, nota del 2026-11-02 (ADR-029 Enmienda 2).
// El municipio obligatorio de registrar (los dos caminos), recibir y entregar, con el selector del perfil (LocationPicker).
// Sin municipio, o sin catálogo, el formulario no envía nada. El texto libre de la ubicación no cambia: sigue en su campo.
import React, { useCallback, useState } from 'react';
import { fetchLocations } from '../../lib/api/locations';
import { LocationPicker, type CatalogState, type LocationValue } from '../location/LocationPicker';

export const MUNICIPALITY_HINT = 'El municipio se muestra al donante en el seguimiento; la dirección exacta, no';
export const MUNICIPALITY_REQUIRED = 'Elige el municipio';
export const MUNICIPALITY_NO_CATALOG = 'Sin la lista de municipios no podemos enviar. Pulsa «Reintentar».';

export interface AssetMunicipality {
  value: LocationValue;
  setValue: (v: LocationValue) => void;
  error: string | undefined;
  setCatalog: (s: CatalogState) => void;
  /** El código a enviar, o `null` (y el error a la vista) si todavía no se puede. */
  check: () => string | null;
}

/** U-45: recibir y entregar empiezan en el municipio del lote; registrar, vacío. */
export function useAssetMunicipality(initialCode?: string | null): AssetMunicipality {
  const [value, setRaw] = useState<LocationValue>({ departmentCode: '', municipalityCode: initialCode ?? '' });
  const [catalog, setCatalog] = useState<CatalogState>('loading');
  const [error, setError] = useState<string | undefined>();
  const setValue = useCallback((v: LocationValue) => { setRaw(v); if (v.municipalityCode) setError(undefined); }, []);
  const check = () => {
    if (catalog === 'failed') { setError(MUNICIPALITY_NO_CATALOG); return null; }
    // Mientras el catálogo carga, el municipio inicial todavía no tiene departamento: no se envía
    if (catalog !== 'ready' || !value.departmentCode || !/^[0-9]{5}$/.test(value.municipalityCode)) {
      setError(MUNICIPALITY_REQUIRED); return null;
    }
    setError(undefined);
    return value.municipalityCode;
  };
  return { value, setValue, error, setCatalog, check };
}

export function AssetMunicipalityField({ m, disabled, locationsClient = fetchLocations }: {
  m: AssetMunicipality;
  disabled?: boolean;
  locationsClient?: typeof fetchLocations;
}) {
  return (
    <LocationPicker legend="Municipio del paso" hint={MUNICIPALITY_HINT} value={m.value} onChange={m.setValue}
      error={m.error} errorId="asset-municipality-error" disabled={disabled} departmentPlaceholder="Elige un departamento"
      locationsClient={locationsClient} onCatalogState={m.setCatalog} testId="asset-municipality" />
  );
}
