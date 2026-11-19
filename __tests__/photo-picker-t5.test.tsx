// Ref: plan-fotos-tarea5-web.md §4 test 2 (A); ADR-051 Enmienda 2 E2-8 (comodidad: arrastrar y soltar, vista previa).
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhotoPicker } from '../src/components/media/PhotoPicker';
import { checkEvidenceFile, evidenceErrorText } from '../src/lib/api/deliveryEvidence';

const check = (f: { size: number; type: string }) => { const e = checkEvidenceFile(f); return e ? evidenceErrorText(e) : null; };
const photo = (size = 10, type = 'image/jpeg') => { const f = new File(['x'], 'p.jpg', { type }); Object.defineProperty(f, 'size', { value: size }); return f; };

let created = 0;
const create = vi.fn(() => `blob:preview-${++created}`);
const revoke = vi.fn();
beforeEach(() => { created = 0; create.mockClear(); revoke.mockClear(); (URL as any).createObjectURL = create; (URL as any).revokeObjectURL = revoke; });
afterEach(() => vi.restoreAllMocks());

function Harness({ onChange }: { onChange: (f: File | null) => void }) {
  const [v, setV] = useState<File | null>(null);
  return <PhotoPicker label="Foto (opcional)" value={v} check={check} onChange={(f) => { setV(f); onChange(f); }} />;
}

describe('PhotoPicker', () => {
  it('elegir con el selector y arrastrar y soltar dan el mismo File', () => {
    const got: Array<File | null> = [];
    render(<Harness onChange={(f) => got.push(f)} />);
    const f = photo();
    fireEvent.change(screen.getByLabelText('Foto (opcional)'), { target: { files: [f] } });
    expect(got).toEqual([f]);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));
    fireEvent.dragOver(screen.getByTestId('photo-drop'), { dataTransfer: { files: [f], types: ['Files'] } });
    fireEvent.drop(screen.getByTestId('photo-drop'), { dataTransfer: { files: [f], types: ['Files'] } });
    expect(got).toEqual([f, null, f]);
  });

  it('otro tipo o más de 5 MB se rechaza ANTES de subir, con su texto; nunca llega a onChange como foto', () => {
    const onChange = vi.fn();
    render(<PhotoPicker label="Foto (opcional)" value={null} check={check} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Foto (opcional)'), { target: { files: [photo(10, 'image/gif')] } });
    expect(screen.getByText('La foto tiene que ser JPEG o PNG.')).toBeTruthy();
    fireEvent.drop(screen.getByTestId('photo-drop'), { dataTransfer: { files: [photo(6 * 1024 * 1024)] } });
    expect(screen.getByText('La foto pesa más de 5 MB. Elige una más liviana.')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalledWith(expect.any(File));
  });

  it('vista previa: se crea al elegir, se revoca al cambiar y al desmontar', () => {
    const { unmount } = render(<Harness onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Foto (opcional)'), { target: { files: [photo()] } });
    expect(screen.getByAltText('Vista previa de la foto')).toBeTruthy();
    expect(create).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));
    expect(revoke).toHaveBeenCalledWith('blob:preview-1');
    fireEvent.change(screen.getByLabelText('Foto (opcional)'), { target: { files: [photo()] } });
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:preview-2');
  });

  it('el selector pide la cámara trasera en el móvil y solo JPEG o PNG', () => {
    render(<Harness onChange={() => {}} />);
    const input = screen.getByLabelText('Foto (opcional)') as HTMLInputElement;
    expect(input.accept).toBe('image/jpeg,image/png');
    expect(input.getAttribute('capture')).toBe('environment');
  });

  it('deshabilitado: no acepta archivos soltados', () => {
    const onChange = vi.fn();
    render(<PhotoPicker label="Foto (opcional)" value={null} check={check} onChange={onChange} disabled />);
    fireEvent.drop(screen.getByTestId('photo-drop'), { dataTransfer: { files: [photo()] } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
