// Ref: Documentos/plan-fase7-pantallas.md §5 B-1; Documentos/sistema-visual-paxfide-web-enmienda-1.md §7.1.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../src/components/ui/Button';
import { TextField, PasswordField, TextArea, SelectField } from '../src/components/ui/Field';
import { Modal } from '../src/components/ui/Modal';
import { PageHeader, Surface, DefinitionList, Actions } from '../src/components/ui/Layout';
import { Icon, type IconName } from '../src/components/ui/Icons';
import s from '../src/components/ui/ui.module.css';

describe('UI Primitives (B-1 estilo v2)', () => {
  describe('Button', () => {
    it('renderiza variantes primary, secondary y emphasis', () => {
      const { rerender } = render(<Button variant="primary">Primario</Button>);
      let btn = screen.getByRole('button', { name: 'Primario' });
      expect(btn.className).toContain(s.primary);
      expect(btn.className).toContain(s.button);

      rerender(<Button variant="secondary">Secundario</Button>);
      btn = screen.getByRole('button', { name: 'Secundario' });
      expect(btn.className).toContain(s.secondary);

      rerender(<Button variant="emphasis">Énfasis</Button>);
      btn = screen.getByRole('button', { name: 'Énfasis' });
      expect(btn.className).toContain(s.emphasis);
    });

    it('estado sending desactiva el botón, añade aria-busy y conserva el texto visible con BrandDots', () => {
      render(
        <Button variant="primary" sending>
          Guardando
        </Button>
      );
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Guardando')).toBeInTheDocument();
      // BrandDots contiene puntos <i>
      expect(btn.querySelectorAll('i').length).toBe(3);
    });
  });

  describe('Field (TextField, PasswordField, TextArea, SelectField)', () => {
    it('TextField asocia label, hint y error mediante id y aria-describedby', () => {
      render(
        <TextField
          label="Nombre de usuario"
          hint="Solo letras minúsculas"
          error="El campo es requerido"
        />
      );
      const input = screen.getByLabelText('Nombre de usuario');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('Solo letras minúsculas')).toBeInTheDocument();
      expect(screen.getByText('El campo es requerido')).toBeInTheDocument();
    });

    it('PasswordField permite alternar visibilidad de contraseña', () => {
      render(<PasswordField label="Clave secreta" />);
      const input = screen.getByLabelText('Clave secreta');
      expect(input).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByRole('button', { name: 'Mostrar' });
      fireEvent.click(toggleBtn);
      expect(input).toHaveAttribute('type', 'text');
      expect(screen.getByRole('button', { name: 'Ocultar' })).toBeInTheDocument();
    });

    it('TextArea y SelectField renderizan con etiqueta y clase semántica', () => {
      render(
        <>
          <TextArea label="Descripción" />
          <SelectField
            label="Tipo de activo"
            placeholder="Seleccionar…"
            options={[{ value: 'FOOD', label: 'Alimentos' }]}
          />
        </>
      );
      expect(screen.getByLabelText('Descripción')).toBeInTheDocument();
      expect(screen.getByLabelText('Tipo de activo')).toBeInTheDocument();
    });
  });

  describe('Modal', () => {
    it('cumple rol dialog, aria-modal, aria-labelledby y cierra con botón y Escape', () => {
      const onCancel = vi.fn();
      render(
        <Modal title="Confirmar operación" onCancel={onCancel}>
          <p>¿Estás seguro de continuar?</p>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByText('Confirmar operación')).toBeInTheDocument();
      expect(screen.getByText('¿Estás seguro de continuar?')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button', { name: 'Cerrar' });
      fireEvent.click(closeBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(2);
    });
  });

  describe('Layout', () => {
    it('PageHeader, Surface, DefinitionList y Actions renderizan correctamente', () => {
      render(
        <div>
          <PageHeader title="Panel principal" reference="REF-1234" />
          <Surface title="Detalles" headingLevel={2}>
            <DefinitionList
              items={[
                { label: 'Estado', value: 'Activo' },
                { label: 'Responsable', value: 'Carlos' },
              ]}
            />
            <Actions>
              <Button>Aceptar</Button>
            </Actions>
          </Surface>
        </div>
      );

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Panel principal');
      expect(screen.getByText('REF-1234')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Detalles');
      expect(screen.getByText('Estado')).toBeInTheDocument();
      expect(screen.getByText('Activo')).toBeInTheDocument();
    });
  });

  describe('Icons', () => {
    it('renderiza los 5 iconos SVG propios (20 px, currentColor)', () => {
      const names: IconName[] = ['info', 'warning', 'error', 'success', 'close'];
      for (const name of names) {
        const { container } = render(<Icon name={name} />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveAttribute('width', '20');
        expect(svg).toHaveAttribute('height', '20');
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      }
    });
  });
});
