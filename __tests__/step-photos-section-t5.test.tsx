// Ref: plan-fotos-tarea5-web.md §4 tests 7 a 10 (C); ADR-051 Enmienda 2 E2-5 y E2-6 (quién ve qué y publicación).
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StepPhotosSection } from '../src/components/asset/StepPhotosSection';

const ready = (roles: string[], extra: Record<string, unknown> = {}) =>
  ({ status: 'ready' as const, data: { accountId: 'acc-1', organizationId: 'org-1', roles: roles as any, ...extra } });
const item = (step: string, sequence: number, hasPhoto = true, removed = false) =>
  ({ step: step as any, sequence, occurredAt: `2026-11-0${sequence}T10:00:00Z`, hasPhoto, removed });

let created = 0;
beforeEach(() => { created = 0; (URL as any).createObjectURL = () => `blob:s-${++created}`; (URL as any).revokeObjectURL = () => {}; });
afterEach(() => vi.restoreAllMocks());

function setup(opts: { items?: any[]; principal?: any; publication?: any; setPublication?: any; image?: any; listKind?: string }) {
  const list = vi.fn(async () => (opts.listKind && opts.listKind !== 'ok' ? { kind: opts.listKind } : { kind: 'ok', items: opts.items ?? [] }));
  const publication = vi.fn(opts.publication ?? (async () => ({ kind: 'ok', published: false, decisions: [] })));
  const setPublication = vi.fn(opts.setPublication ?? (async () => ({ kind: 'ok' })));
  const image = vi.fn(opts.image ?? (async () => ({ kind: 'ok', blob: new Blob(['x'], { type: 'image/png' }) })));
  const utils = render(<StepPhotosSection assetRef="A1" principal={opts.principal ?? ready(['EMPLOYEE'])}
    client={{ list, publication, setPublication } as any} imageClient={image as any} />);
  return { list, publication, setPublication, image, ...utils };
}

describe('«Pasos y fotos»: lectura por paso (test 7)', () => {
  it('muestra la foto de cada paso con foto, pidiendo su evento con ?sequence=; el paso sin foto no pide imagen ni muestra error', async () => {
    const { image } = setup({ items: [item('registered', 1), item('dispatched', 2, false), item('received', 3)] });
    expect(await screen.findAllByRole('img')).toHaveLength(2);
    const paths = image.mock.calls.map((c: any[]) => c[0]);
    expect(paths).toContain('/physical-assets/A1/evidence/registered?sequence=1');
    expect(paths).toContain('/physical-assets/A1/evidence/received?sequence=3');
    expect(paths.some((p: string) => p.includes('dispatched'))).toBe(false);
    expect(screen.getByText('Sin foto en este paso.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un paso retirado por la plataforma muestra el texto y NO pide ni muestra la imagen', async () => {
    const { image } = setup({ items: [item('received', 1, true, true)] });
    expect(await screen.findByText('La plataforma retiró esta foto.')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(image).not.toHaveBeenCalled();
  });

  it('una foto que pasa a 410 al pedirla muestra el texto de retirada, no la imagen', async () => {
    setup({ items: [item('registered', 1)], image: async () => ({ kind: 'removed' }) });
    expect(await screen.findByText('La plataforma retiró esta foto.')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('varias fotos del mismo paso: cada una con su secuencia y su fecha', async () => {
    const { image } = setup({ items: [item('dispatched', 2), item('dispatched', 5)] });
    await screen.findAllByRole('img');
    expect(image.mock.calls.map((c: any[]) => c[0])).toEqual(['/physical-assets/A1/evidence/dispatched?sequence=2', '/physical-assets/A1/evidence/dispatched?sequence=5']);
    expect(screen.getAllByTestId('step-photo')).toHaveLength(2);
    expect(screen.getByText(/evento 2/)).toBeTruthy();
    expect(screen.getByText(/evento 5/)).toBeTruthy();
  });

  it('estados: sin permiso, error con reintento y sin pasos', async () => {
    const f = setup({ listKind: 'forbidden' });
    expect(await screen.findByText('Tu cuenta no puede ver las fotos de este lote.')).toBeTruthy();
    f.unmount();
    const e = setup({ listKind: 'error' });
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(e.list).toHaveBeenCalledTimes(2));
    e.unmount();
    setup({ items: [] });
    expect(await screen.findByText('Todavía no hay pasos con foto en este lote.')).toBeTruthy();
  });

  it('quien no es miembro de una organización ni plataforma no ve la sección ni pide nada', () => {
    const { list } = setup({ principal: ready([], { organizationId: undefined }) });
    expect(screen.queryByText('Pasos y fotos')).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });
});

const DELIVERED = [item('registered', 1), item('delivered', 2)];

describe('copia censurada y control de publicación (tests 8, 9 y 10)', () => {
  it.each([['EMPLOYEE'], ['REPRESENTATIVE']])('%s ve la copia pero NO el botón ni la casilla de publicar', async (role) => {
    const { image } = setup({ items: DELIVERED, principal: ready([role]) });
    expect(await screen.findByTestId('redacted-copy')).toBeTruthy();
    await waitFor(() => expect(image.mock.calls.map((c: any[]) => c[0])).toContain('/physical-assets/A1/evidence/redacted'));
    expect(screen.queryByRole('button', { name: /Publicar/ })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText(/Solo el administrador de la organización puede publicar/)).toBeTruthy();
  });

  it('el administrador de plataforma ve la copia sin control y sin pedir el historial', async () => {
    const { publication } = setup({ items: DELIVERED, principal: ready([], { organizationId: undefined, platformAuthority: 'PLATFORM_ADMIN' }) });
    expect(await screen.findByTestId('redacted-copy')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(publication).not.toHaveBeenCalled();
  });

  it('el texto fijo dice que no sirve para leer ni verificar y que el donante solo la ve si se publica', async () => {
    setup({ items: DELIVERED, principal: ready(['EMPLOYEE']) });
    const box = await screen.findByTestId('redacted-copy');
    expect(box.textContent).toMatch(/pixelada/);
    expect(box.textContent).toMatch(/no sirve para leer ni verificar/);
    expect(box.textContent).toMatch(/solo si el administrador la publica/);
  });

  it('el ADMINISTRATOR: «Publicar» queda deshabilitado hasta marcar la casilla; con ella, PUT; luego «Despublicar» con DELETE; el historial en orden', async () => {
    let published = false;
    const decisions: any[] = [];
    const publication = async () => ({ kind: 'ok', published, decisions: [...decisions] });
    const setPublication = vi.fn(async (_ref: string, publish: boolean) => {
      published = publish;
      decisions.push({ action: publish ? 'PUBLISH' : 'UNPUBLISH', at: `2026-11-19T1${decisions.length}:00:00Z`, by: 'acc-1', confirmNoIdentifiablePerson: publish ? true : null });
      return { kind: 'ok' };
    });
    setup({ items: DELIVERED, principal: ready(['ADMINISTRATOR']), publication, setPublication });
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar para el donante' }));
    const confirm = screen.getByRole('group', { name: 'Confirmar publicación' });
    const check = within(confirm).getByLabelText('Revisé la copia y no se reconoce a ninguna persona') as HTMLInputElement;
    expect(check.checked).toBe(false);
    const go = within(confirm).getByRole('button', { name: 'Publicar' }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(go);
    expect(setPublication).not.toHaveBeenCalled();
    fireEvent.click(check);
    expect(go.disabled).toBe(false);
    fireEvent.click(go);
    await waitFor(() => expect(setPublication).toHaveBeenCalledWith('A1', true));
    expect(await screen.findByText('Publicada para el donante.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Despublicar' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Confirmar despublicación' })).getByRole('button', { name: 'Sí, despublicar' }));
    await waitFor(() => expect(setPublication).toHaveBeenLastCalledWith('A1', false));
    await waitFor(() => expect(screen.getAllByTestId('publication-decision')).toHaveLength(2));
    const rows = screen.getAllByTestId('publication-decision').map((r) => r.textContent);
    expect(rows[0]).toMatch(/Publicó/);
    expect(rows[1]).toMatch(/Despublicó/);
  });

  it('cancelar la confirmación no manda nada y la casilla vuelve a empezar sin marcar', async () => {
    const { setPublication } = setup({ items: DELIVERED, principal: ready(['ADMINISTRATOR']) });
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar para el donante' }));
    fireEvent.click(screen.getByLabelText('Revisé la copia y no se reconoce a ninguna persona'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar para el donante' }));
    expect((screen.getByLabelText('Revisé la copia y no se reconoce a ninguna persona') as HTMLInputElement).checked).toBe(false);
    expect(setPublication).not.toHaveBeenCalled();
  });

  it.each([
    ['forbidden', 'Tu cuenta no puede cambiar la publicación de esta foto.'],
    ['not-generated', 'La copia todavía no está generada. Recarga la página e inténtalo de nuevo.'],
    ['removed', 'La plataforma retiró esta foto.'],
    ['error', 'No pudimos cambiar la publicación. Inténtalo de nuevo.'],
    ['network', 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'],
  ])('un %s del backend nunca se muestra como éxito', async (kind, text) => {
    setup({ items: DELIVERED, principal: ready(['ADMINISTRATOR']), setPublication: async () => ({ kind }) });
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar para el donante' }));
    fireEvent.click(screen.getByLabelText('Revisé la copia y no se reconoce a ninguna persona'));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
    expect(screen.queryByText('Publicada para el donante.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Despublicar' })).toBeNull();
  });

  it('sin foto de entrega (o retirada) no hay panel de copia', async () => {
    setup({ items: [item('registered', 1), item('delivered', 2, false)], principal: ready(['ADMINISTRATOR']) });
    await screen.findByText('Pasos y fotos');
    expect(screen.queryByTestId('redacted-copy')).toBeNull();
  });

  it('el historial se pide solo al ADMINISTRATOR', async () => {
    const a = setup({ items: DELIVERED, principal: ready(['ADMINISTRATOR']) });
    await screen.findByTestId('redacted-copy');
    await waitFor(() => expect(a.publication).toHaveBeenCalledWith('A1'));
    a.unmount();
    const b = setup({ items: DELIVERED, principal: ready(['EMPLOYEE']) });
    await screen.findByTestId('redacted-copy');
    expect(b.publication).not.toHaveBeenCalled();
  });
});
