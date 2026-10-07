import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LoadingState, ErrorState, AmbiguousState, StatusNotice } from '../src/components/States';

afterEach(cleanup);

describe('States Components', () => {
  it('LoadingState muestra "Cargando…"', () => {
    render(<LoadingState />);
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
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
});
