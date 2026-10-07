'use client';

import React, { useId, useState } from 'react';
import s from './ui.module.css';

interface BaseProps {
  label: string;
  error?: string;
  hint?: string;
}

type InputProps = BaseProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'>;

/** Etiqueta visible siempre; error debajo, en `danger-700`, enlazado con `aria-describedby` (§4). */
export function TextField({ label, error, hint, ...rest }: InputProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>{label}</label>
      {hint && <span id={`${id}-hint`} className={s.hint}>{hint}</span>}
      <input id={id} className={s.input} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      {error && <span id={`${id}-error`} className={s.error}>{error}</span>}
    </div>
  );
}

export function PasswordField({ label, error, hint, ...rest }: InputProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>{label}</label>
      {hint && <span id={`${id}-hint`} className={s.hint}>{hint}</span>}
      <div className={s.inputRow}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className={s.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <button type="button" className={[s.button, s.secondary].join(' ')} onClick={() => setVisible((v) => !v)}
          aria-controls={id} aria-pressed={visible}>
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {error && <span id={`${id}-error`} className={s.error}>{error}</span>}
    </div>
  );
}

type TextAreaProps = BaseProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

export function TextArea({ label, error, hint, ...rest }: TextAreaProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>{label}</label>
      {hint && <span id={`${id}-hint`} className={s.hint}>{hint}</span>}
      <textarea id={id} className={s.input} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      {error && <span id={`${id}-error`} className={s.error}>{error}</span>}
    </div>
  );
}

type SelectProps = BaseProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  options: { value: string; label: string }[];
  placeholder?: string;
};

export function SelectField({ label, error, hint, options, placeholder, ...rest }: SelectProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>{label}</label>
      {hint && <span id={`${id}-hint`} className={s.hint}>{hint}</span>}
      <select id={id} className={s.input} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <span id={`${id}-error`} className={s.error}>{error}</span>}
    </div>
  );
}

export function CheckboxGroup({ legend, options, value, onChange, error, disabled }: {
  legend: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className={s.fieldset} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className={s.legend}>{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={s.check}>
          <input
            type="checkbox"
            checked={value.includes(o.value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
          />
          {o.label}
        </label>
      ))}
      {error && <span id={`${id}-error`} className={s.error}>{error}</span>}
    </fieldset>
  );
}
