'use client';

import React, { useEffect, useState } from 'react';
import { useCommand, CommandRequest } from '../../lib/commands/useCommand';
import { Modal } from '../ui/Modal';
import { TextField, SelectField } from '../ui/Field';
import { Button } from '../ui/Button';
import { Actions } from '../ui/Layout';
import { CommandFeedback } from '../CommandFeedback';

export interface FieldSpec {
  name: string;
  label: string;
  hint?: string;
  /** Devuelve el valor a enviar o `null` si no es válido. */
  parse?: (raw: string) => string | null;
  invalid?: string;
  /** Con opciones, el campo es un desplegable (p. ej. miembros de la organización). */
  options?: { value: string; label: string }[];
  /** Opcional: vacío ⇒ no se envía. */
  optional?: boolean;
}

/**
 * Formulario transitorio de un comando en un modal (§4: título, contenido, Cancelar + Primario). Los campos son
 * referencias de texto del contrato; el backend valida su forma (400) y el estado del activo (409).
 */
export function CommandModal<TRes>({ title, description, fields, submitLabel, builder, onSuccess, onClose, validate }: {
  title: string;
  description?: React.ReactNode;
  fields: FieldSpec[];
  submitLabel: string;
  /** Reglas entre campos (p. ej. "con reemplazo, el papel es obligatorio"): devuelve errores por campo. */
  validate?: (payload: Record<string, string>) => Record<string, string | undefined>;
  builder: (payload: unknown) => CommandRequest;
  onSuccess: (data: TRes | null, location: string | null) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, ''])));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const command = useCommand<TRes>(builder);
  const sending = command.state === 'SENDING';

  useEffect(() => {
    if (command.state === 'SUCCESS') onSuccess(command.data, command.location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command.state]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string | undefined> = {};
    const payload: Record<string, string> = {};
    for (const f of fields) {
      const raw = values[f.name].trim();
      if (!raw && f.optional) continue;
      if (!raw) { nextErrors[f.name] = 'Este campo es obligatorio.'; continue; }
      const parsed = f.parse ? f.parse(raw) : raw.length <= 256 ? raw : null;
      if (parsed === null) nextErrors[f.name] = f.invalid ?? 'Valor no válido.';
      else payload[f.name] = parsed;
    }
    Object.assign(nextErrors, validate ? validate(payload) : {});
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    void command.execute(payload);
  };

  // Cerrar con una operación ambigua abierta equivale a "Cerrar" del ambiguo: no se envía nada más
  return (
    <Modal title={title} onCancel={onClose}>
      {description && <p>{description}</p>}
      <form onSubmit={submit} noValidate>
        {fields.map((f) => (f.options
          ? <SelectField key={f.name} label={f.label} hint={f.hint} value={values[f.name]} options={f.options}
              placeholder={f.optional ? '— Ninguno —' : 'Elige una opción'}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} error={errors[f.name]} disabled={sending} />
          : <TextField key={f.name} label={f.label} hint={f.hint} value={values[f.name]} autoComplete="off"
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} error={errors[f.name]} disabled={sending} />
        ))}
        <CommandFeedback command={command} />
        <Actions>
          <Button variant="secondary" onClick={onClose} disabled={sending}>Cancelar</Button>
          {command.state !== 'AMBIGUOUS' && <Button type="submit" sending={sending}>{submitLabel}</Button>}
        </Actions>
      </form>
    </Modal>
  );
}
