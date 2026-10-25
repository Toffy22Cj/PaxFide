'use client';

// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F3; Documentos/paxfide-home.html (.city-hud, #btnPeekCity)
import React from 'react';
import { DISTRICTS, type DistrictKey } from '../background/cityScene';
import s from './CityHud.module.css';

export interface CityHudProps {
  districtKey: DistrictKey;
  isPeeking: boolean;
  onTogglePeek: () => void;
  className?: string;
}

export function CityHud({ districtKey, isPeeking, onTogglePeek, className }: CityHudProps) {
  const effectiveDistrict = isPeeking ? DISTRICTS.welcome : (DISTRICTS[districtKey] || DISTRICTS.home);

  return (
    <div
      className={[s.hud, className].filter(Boolean).join(' ')}
      data-testid="city-hud"
      aria-live="polite"
    >
      <span className={s.dot} aria-hidden="true" />
      <span className={s.label}>
        Sector: <b data-testid="hud-zone-name">{effectiveDistrict.name}</b>
      </span>
      <small className={s.type} data-testid="hud-zone-type">· {effectiveDistrict.type}</small>
      <button
        type="button"
        className={s.btn}
        data-testid="btn-peek-city"
        aria-pressed={isPeeking}
        onClick={onTogglePeek}
        title="Ocultar el panel para recorrer la ciudad"
      >
        {isPeeking ? 'Mostrar panel' : 'Ver ciudad'}
      </button>
    </div>
  );
}
