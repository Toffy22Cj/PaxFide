// Ref: plan-fase7-puesta-al-dia.md Anexo 7 (U-44): un catálogo de PRUEBA, reducido (no es el DIVIPOLA), y la forma de
// elegir el municipio en los formularios del lote desde los tests.
import { fireEvent, screen, within } from '@testing-library/react';
import type { LocationCatalog } from '../../src/lib/api/locations';

export const TEST_CATALOG: LocationCatalog = {
  catalogVersion: 'PRUEBA-NO-DIVIPOLA',
  departments: [
    { code: '05', name: 'Antioquia', municipalities: [{ code: '05001', name: 'Medellín' }, { code: '05266', name: 'Envigado' }] },
    { code: '08', name: 'Atlántico', municipalities: [{ code: '08001', name: 'Barranquilla' }] },
  ],
};

/** Para `vi.mock('../src/lib/api/locations', …)`: el catálogo sin pasar por `fetch`. */
export const locationsModuleMock = () => ({
  fetchLocations: () => Promise.resolve({ kind: 'ok', catalog: TEST_CATALOG }),
  _resetLocationsForTest: () => {},
});

/** Elige departamento y municipio dentro del bloque del municipio del paso (espera a que cargue el catálogo). */
export async function chooseMunicipality(dep = '05', mun = '05001') {
  const block = await screen.findByTestId('asset-municipality');
  const scope = within(block);
  await scope.findByRole('option', { name: TEST_CATALOG.departments.find((d) => d.code === dep)!.name });
  fireEvent.change(scope.getByLabelText('Departamento'), { target: { value: dep } });
  fireEvent.change(scope.getByLabelText('Municipio'), { target: { value: mun } });
}
