'use client';

// Ref: plan del paso 3 (encargo del 2026-11-15, Tarea B; decisiones de Manuel del 2026-11-15 y 2026-11-16). Cada
// panel muestra a la vez un gráfico simple y uno avanzado. Solo los roles aprobados ven el selector de tipo («cada rol
// en lo que ya ve»); el resto ve los predeterminados, sin selector. El selector es presentación: el backend sigue
// autorizando cada lectura. La elección se guarda en el navegador por cuenta (`accountId`, nunca el correo) y panel.
import React, { useEffect, useId, useState } from 'react';
import s from './charts.module.css';
import { browserStorage, readChartChoice, writeChartChoice, type ChartPanelId } from './chartPreference';
import type { PreferenceStorage } from '../../lib/theme/theme';

export interface ChartOption {
  id: string;
  label: string;
  render: () => React.ReactNode;
}

export interface ChartPanelProps {
  panel: ChartPanelId;
  /** Opciones de cada lado; la primera es la predeterminada. */
  simple: ChartOption[];
  advanced: ChartOption[];
  /** Solo los roles aprobados para este panel. */
  canChoose: boolean;
  /** Identificador opaco de la cuenta (de `/me`); sin él no se guarda nada. */
  accountId?: string;
  /** Pruebas: almacenamiento sustituto. */
  storage?: () => PreferenceStorage | null | undefined;
  /** Texto común a los dos gráficos (por ejemplo, de dónde salen los datos). */
  note?: React.ReactNode;
}

function Slot({ title, options, selected, onSelect, canChoose, testId }: {
  title: string; options: ChartOption[]; selected: ChartOption; onSelect: (id: string) => void; canChoose: boolean; testId: string;
}) {
  const id = useId();
  return (
    <section className={s.slot} data-testid={testId} data-chart={selected.id} aria-labelledby={`${id}-t`}>
      <div className={s.slotHead}>
        <h3 className={s.slotTitle} id={`${id}-t`}>{title}: {selected.label}</h3>
        {canChoose && options.length > 1 && (
          <select className={s.select} value={selected.id} aria-label={`Tipo de ${title.toLowerCase()}`}
            data-testid={`${testId}-select`} onChange={(e) => onSelect(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        )}
      </div>
      {selected.render()}
    </section>
  );
}

export function ChartPanel({ panel, simple, advanced, canChoose, accountId, storage = browserStorage, note }: ChartPanelProps) {
  const [choice, setChoice] = useState<{ simple?: string; advanced?: string }>({});

  // Se lee en el cliente, después del primer render (el servidor no tiene almacenamiento): sin parpadeo de hidratación
  useEffect(() => {
    if (!canChoose || !accountId) { setChoice({}); return; }
    setChoice(readChartChoice(storage, accountId, panel, {
      simple: simple.map((o) => o.id), advanced: advanced.map((o) => o.id),
    }));
    // Las opciones de un panel no cambian durante su vida; solo la cuenta o el permiso
  }, [accountId, canChoose, panel]);

  // Sin permiso, siempre los predeterminados, aunque haya una elección guardada (aserción negativa en los tests)
  const pick = (opts: ChartOption[], id?: string) => (canChoose ? opts.find((o) => o.id === id) : undefined) ?? opts[0];
  const selSimple = pick(simple, choice.simple);
  const selAdvanced = pick(advanced, choice.advanced);

  const update = (side: 'simple' | 'advanced', id: string) => {
    const next = { ...choice, [side]: id };
    setChoice(next);
    if (accountId) writeChartChoice(storage, accountId, panel, next); // si falla, la elección vale hasta recargar
  };

  if (simple.length === 0 || advanced.length === 0) return null;
  return (
    <div className={s.panel} data-testid={`charts-${panel}`} data-can-choose={canChoose ? 'true' : 'false'}>
      {note && <p className={s.note}>{note}</p>}
      <div className={s.pair}>
        <Slot title="Gráfico simple" options={simple} selected={selSimple} canChoose={canChoose}
          onSelect={(id) => update('simple', id)} testId={`charts-${panel}-simple`} />
        <Slot title="Gráfico avanzado" options={advanced} selected={selAdvanced} canChoose={canChoose}
          onSelect={(id) => update('advanced', id)} testId={`charts-${panel}-advanced`} />
      </div>
    </div>
  );
}
