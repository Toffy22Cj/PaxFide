// Ref: Documentos/plan-fase7-fidelidad.md §2 D-F17
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccessLayout } from '../src/components/access/AccessLayout';
import { LegalScreen, LEGAL_TERMS, LEGAL_PRIVACY, LEGAL_ORG_TERMS } from '../src/screens/LegalScreen';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

describe('Rutas y pantallas legales (D-F17)', () => {
  it('/terminos muestra versión v1-2026-10 y advertencia de borrador académico', () => {
    render(<LegalScreen doc={LEGAL_TERMS} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Términos y condiciones de uso');
    expect(screen.getByTestId('legal-version')).toHaveTextContent('Versión v1-2026-10');
    expect(screen.getAllByText(/BORRADOR ACADÉMICO/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/No es asesoría legal/i)).toBeInTheDocument();
  });

  it('/privacidad muestra versión v1-2026-10 y derechos de la Ley 1581', () => {
    render(<LegalScreen doc={LEGAL_PRIVACY} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Autorización de tratamiento de datos personales');
    expect(screen.getByTestId('legal-version')).toHaveTextContent('Versión v1-2026-10');
    expect(screen.getAllByText(/Ley 1581/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Qué datos tratamos/i)).toBeInTheDocument();
  });

  it('/terminos-organizacion muestra versión v1-2026-10 y compromisos', () => {
    render(<LegalScreen doc={LEGAL_ORG_TERMS} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Términos para organizaciones');
    expect(screen.getByTestId('legal-version')).toHaveTextContent('Versión v1-2026-10');
    expect(screen.getByText('Compromisos de la organización')).toBeInTheDocument();
  });

  it('todas las pantallas legales llevan la barra de acceso con "Volver al recorrido"', () => {
    // U-30: el marco lo pone el layout del grupo (acceso), como en la ruta real
    render(<AccessLayout><LegalScreen doc={LEGAL_TERMS} /></AccessLayout>);
    const back = screen.getByRole('link', { name: 'Volver al recorrido' });
    expect(back).toHaveAttribute('href', '/');
  });
});
