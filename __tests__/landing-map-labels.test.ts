// Ref: Documentos/plan-fase7-fidelidad.md §2.1 y §4 F-A1; D-F4 (etiquetas genéricas).
import { describe, it, expect } from 'vitest';
import { LANDING_MAP_LABELS } from '../src/components/landing/worldDraw';

describe('Etiquetas genéricas del mapa de la landing (D-F4)', () => {
  it('contiene exactamente las 12 etiquetas aprobadas en §2.1', () => {
    expect(LANDING_MAP_LABELS).toEqual([
      'Pasarela de pago',
      'Donar',
      'Fondo de la convocatoria',
      'Lote · QR',
      'Bodega',
      'Sublote',
      'Lote dividido',
      'Ruta de entrega',
      'Raíz anclada',
      'Anclaje en blockchain',
      'Entrega confirmada',
      'Centro comunitario',
    ]);
  });

  it('no contiene ninguna cifra (\\d) en ninguna etiqueta (negativa)', () => {
    for (const label of LANDING_MAP_LABELS) {
      expect(label).not.toMatch(/\d/);
    }
  });

  it('no contiene ningún nombre de lugar real (Montería, Lorica, Cereté) (negativa)', () => {
    const FORBIDDEN_PLACES = ['Montería', 'Monteria', 'Lorica', 'Cereté', 'Cerete', 'Córdoba', 'Cordoba'];
    for (const label of LANDING_MAP_LABELS) {
      for (const place of FORBIDDEN_PLACES) {
        expect(label.toLowerCase()).not.toContain(place.toLowerCase());
      }
    }
  });
});
