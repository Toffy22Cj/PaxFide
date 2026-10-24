'use client';
// Ref: prompts-agentes-estilo-v2.md VS-0 (selector de tema mínimo, sin estilo propio); decisiones-delegadas-web-fase7.md DF7-10;
// plan-fase7-pantallas.md C-1 (se monta en la cabecera fina). Las clases las pone quien lo monta.
import React, { useEffect, useId, useState } from 'react';
import {
  THEME_PREFERENCES,
  applyPreference,
  preferenceLabel,
  readPreference,
  writePreference,
  type ThemePreference,
} from '../../lib/theme/theme';

const getStorage = () => window.localStorage;

/**
 * Selector claro / oscuro / sistema. Sin estilo propio: hereda el del contenedor que lo monte (VS-2).
 * Si el navegador no deja guardar la preferencia, el tema cambia igual durante la visita.
 */
export function ThemeSelect({ className, labelClassName, selectClassName, icon }: {
  className?: string;
  labelClassName?: string;
  selectClassName?: string;
  /** Icono decorativo (aria-hidden) que quien lo monta puede mostrar en lugar del texto del select en estrecho. */
  icon?: React.ReactNode;
}) {
  const id = useId();
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    setPreference(readPreference(getStorage));
  }, []);

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as ThemePreference;
    setPreference(next);
    applyPreference(document.documentElement, next);
    writePreference(getStorage, next);
  }

  return (
    <span className={className}>
      <label htmlFor={id} className={labelClassName}>Tema</label>{' '}
      {icon}
      <select id={id} value={preference} onChange={onChange} className={selectClassName} data-testid="theme-select">
        {THEME_PREFERENCES.map((p) => (
          <option key={p} value={p}>{preferenceLabel(p)}</option>
        ))}
      </select>
    </span>
  );
}
