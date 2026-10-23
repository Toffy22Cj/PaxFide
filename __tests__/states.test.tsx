// Ref: Documentos/plan-fase7-pantallas.md §5 B-1; Documentos/sistema-visual-paxfide-web-enmienda-1.md §4.1–§4.3.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  LoadingState,
  ErrorState,
  ForbiddenState,
  NotFoundState,
  EmptyState,
  UnavailableState,
  AmbiguousState,
  StatusNotice,
  type StatusNoticeVariant,
} from '../src/components/States';
import s from '../src/components/States.module.css';

describe('States Components', () => {
  it('LoadingState muestra "Cargando…"', () => {
    render(<LoadingState />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('LoadingState soporta variante "cubes" (por defecto) y "skeleton"', () => {
    const { container, rerender } = render(<LoadingState variant="cubes" />);
    // Variante cubes: contiene SVGs de cubos
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();

    rerender(<LoadingState variant="skeleton" text="Cargando datos…" />);
    expect(container.querySelector('[data-testid="loading-state"]')).toBeInTheDocument();
    expect(screen.getByText('Cargando datos…')).toBeInTheDocument();
  });

  it('ErrorState "Reintentar" relanza la carga', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    const btn = screen.getByText('Reintentar');
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('AmbiguousState: título, texto, y texto tras "Cerrar"', () => {
    const onClose = vi.fn();
    render(<AmbiguousState onRetry={() => {}} onClose={onClose} />);

    expect(screen.getByText('No pudimos confirmar la operación')).toBeInTheDocument();
    expect(screen.getByText('Puede que se haya realizado. Revisa antes de repetirla.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cerrar'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('No sabemos si la operación se realizó; revísalo antes de repetirla.')).toBeInTheDocument();
  });

  it('StatusNotice: role "status" en info/success y "alert" en rejected/ambiguous', () => {
    const { rerender } = render(<StatusNotice variant="success" text="ok" />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(<StatusNotice variant="info" text="ok" />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(<StatusNotice variant="rejected" text="ok" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(<StatusNotice variant="ambiguous" text="ok" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // Requisitos B-1 (§5): cada estado lleva icono y texto (negativa: ningún estado solo por color)
  describe('accesibilidad y semántica (icono Y texto en cada estado)', () => {
    it('ErrorState lleva icono SVG y texto (nunca solo color)', () => {
      const { container } = render(<ErrorState text="Fallo en la red" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(screen.getByText('Fallo en la red')).toBeInTheDocument();
    });

    it('EmptyState lleva icono SVG y texto (nunca solo color)', () => {
      const { container } = render(<EmptyState text="No hay registros disponibles" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(screen.getByText('No hay registros disponibles')).toBeInTheDocument();
    });

    it('ForbiddenState lleva icono SVG y texto (nunca solo color)', () => {
      const { container } = render(<ForbiddenState />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(screen.getByText('No tienes acceso a este recurso.')).toBeInTheDocument();
    });

    it('NotFoundState lleva icono SVG y texto (nunca solo color)', () => {
      const { container } = render(<NotFoundState message="Página no encontrada" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(screen.getByText('Página no encontrada')).toBeInTheDocument();
    });

    it('UnavailableState lleva icono SVG y texto (nunca solo color)', () => {
      const { container } = render(<UnavailableState what="Módulo de reportes" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(screen.getByText(/Módulo de reportes todavía no está disponible/)).toBeInTheDocument();
    });

    it('AmbiguousState lleva icono SVG y texto (nunca solo color)', () => {
      const { container } = render(<AmbiguousState onRetry={() => {}} onClose={() => {}} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(screen.getByText('No pudimos confirmar la operación')).toBeInTheDocument();
    });

    it('todas las variantes de StatusNotice llevan icono SVG y texto', () => {
      const variants: StatusNoticeVariant[] = ['success', 'info', 'rejected', 'ambiguous'];
      for (const variant of variants) {
        const { container } = render(<StatusNotice variant={variant} text={`Mensaje de ${variant}`} />);
        const svg = container.querySelector('svg');
        expect(svg, `StatusNotice con variante ${variant} debe tener un SVG`).toBeInTheDocument();
        expect(screen.getByText(`Mensaje de ${variant}`)).toBeInTheDocument();
      }
    });
  });

  // Requisitos B-1 (§5): el ambiguo nunca usa los tokens de error
  describe('aislamiento del estado ambiguo respecto al estado de error', () => {
    it('AmbiguousState no tiene clases ni selectores de rejected/error', () => {
      const { container } = render(<AmbiguousState onRetry={() => {}} onClose={() => {}} />);
      const element = container.firstElementChild as HTMLElement;
      expect(element.className).not.toContain(s.rejected);
      expect(element.className).toContain(s.ambiguous);
    });

    it('StatusNotice ambiguous no tiene clases de error o rejected', () => {
      const { container } = render(<StatusNotice variant="ambiguous" text="Operación en suspenso" />);
      const element = container.firstElementChild as HTMLElement;
      expect(element.className).not.toContain(s.rejected);
      expect(element.className).toContain(s.ambiguous);
    });
  });
});
