// Ref: plan-fotos-tarea5-web.md §4 tests 11, 12 y 13 (D); ADR-051 Enmienda 2 E2-8 (la portada, sin esfuerzo extra).
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
const res = (status: number, body?: unknown) => ({ status, text: async () => (body === undefined ? '' : JSON.stringify(body)), headers: { get: () => null } });
const ADMIN = { kind: 'ok' as const, principal: { accountId: 'acc-admin', organizationId: 'org-1', roles: ['ADMINISTRATOR' as const] } };
const CAMP = { campaignRef: 'camp-1', publicCode: 'PUB1', title: 'Agua', status: 'OPEN', visibility: 'PUBLIC', currency: 'COP', targetAmount: '100000', clearedAmount: '5000', responsibles: [], assignedEmployeeCount: 0 };
const fetchMock = vi.fn();

async function load(surfaces: string[]) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(surfaces));
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://api.paxfide.test/api/v1');
  const session = await import('../src/lib/auth/session');
  session.login('jwt-admin');
  return { ...(await import('../src/screens/CampaignsScreen')), ...(await import('../src/screens/OrgAssetsScreen')) };
}
beforeEach(() => { global.fetch = fetchMock as any; fetchMock.mockReset(); (URL as any).createObjectURL = () => 'blob:x'; (URL as any).revokeObjectURL = () => {}; });
afterEach(() => vi.unstubAllEnvs());
const coverCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes('/cover'));

function createCampaign() {
  fireEvent.click(screen.getByRole('button', { name: 'Crear convocatoria' }));
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Mercados' } });
  fireEvent.change(screen.getByLabelText(/Visibilidad/), { target: { value: 'PRIVATE_LINK' } });
  fireEvent.change(screen.getByLabelText(/^Inicio/), { target: { value: '2030-01-01T09:00' } });
  fireEvent.change(screen.getByLabelText(/^Fin/), { target: { value: '2030-02-01T09:00' } });
  fireEvent.click(screen.getByLabelText('Especie (bienes)'));
  fireEvent.click(screen.getAllByRole('button', { name: 'Crear convocatoria' }).at(-1)!);
}
const SURF = ['/panel/campaigns', 'action:create-campaign', '/c/:publicCode'];

describe('Portada al crear la convocatoria (test 11)', () => {
  it('el ADMINISTRATOR ve el paso «Portada» tras el 201, con «Saltar»; el enlace público y el QR siguen', async () => {
    const { CampaignsScreen } = await load(SURF);
    fetchMock.mockResolvedValueOnce(res(201, { campaignRef: 'camp-9', publicCode: 'PUB9' }));
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={async () => ({ kind: 'ok', items: [] })} membersClient={async () => ({ kind: 'ok', items: [] })} />);
    await screen.findByRole('button', { name: 'Crear convocatoria' });
    createCampaign();
    const step = await screen.findByTestId('cover-step');
    expect(within(step).getByRole('button', { name: 'Saltar' })).toBeTruthy();
    expect(screen.getByTestId('created-public-link')).toHaveAttribute('href', '/c/PUB9');
  });

  it('«Saltar» cierra el paso y NO hace ninguna petición de portada (never)', async () => {
    const { CampaignsScreen } = await load(SURF);
    fetchMock.mockResolvedValueOnce(res(201, { campaignRef: 'camp-9', publicCode: 'PUB9' }));
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={async () => ({ kind: 'ok', items: [] })} membersClient={async () => ({ kind: 'ok', items: [] })} />);
    await screen.findByRole('button', { name: 'Crear convocatoria' });
    createCampaign();
    fireEvent.click(await screen.findByRole('button', { name: 'Saltar' }));
    expect(screen.queryByTestId('cover-step')).toBeNull();
    expect(coverCalls()).toHaveLength(0);
    expect(screen.getByTestId('created-public-link')).toBeTruthy();
  });

  it('con la portada puesta, la misma tarjeta sube a la convocatoria recién creada y el botón pasa a «Listo»', async () => {
    const { CampaignsScreen } = await load(SURF);
    fetchMock.mockResolvedValueOnce(res(201, { campaignRef: 'camp-9', publicCode: 'PUB9' }));
    class Xhr { upload: any = {}; status = 200; responseText = '{"coverImageUrl":"/api/v1/public/x"}'; onload: any; url = ''; open(_m: string, u: string) { this.url = u; } setRequestHeader() {} send() { Xhr.last = this; queueMicrotask(() => this.onload()); } static last: Xhr; }
    (globalThis as any).XMLHttpRequest = Xhr;
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={async () => ({ kind: 'ok', items: [] })} membersClient={async () => ({ kind: 'ok', items: [] })} />);
    await screen.findByRole('button', { name: 'Crear convocatoria' });
    createCampaign();
    const step = await screen.findByTestId('cover-step');
    fireEvent.change(within(step).getByLabelText('Cambiar portada'), { target: { files: [new File(['x'], 'c.png', { type: 'image/png' })] } });
    fireEvent.click(within(step).getByRole('button', { name: 'Guardar portada' }));
    await waitFor(() => expect(Xhr.last.url).toBe('http://api.paxfide.test/api/v1/organizations/org-1/campaigns/camp-9/cover'));
    expect(await within(step).findByRole('button', { name: 'Listo' })).toBeTruthy();
  });

  it('quien no es ADMINISTRATOR no ve la pantalla de convocatorias ni el paso (negativa)', async () => {
    const { CampaignsScreen } = await load(SURF);
    render(<CampaignsScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['EMPLOYEE'] } })} />);
    await screen.findByTestId('empty-state');
    expect(screen.queryByTestId('cover-step')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Portada' })).toBeNull();
  });
});

describe('«Portada» en el listado (test 12)', () => {
  it('cada convocatoria del ADMINISTRATOR ofrece «Portada», que abre la tarjeta de esa convocatoria', async () => {
    const { CampaignsScreen } = await load(SURF);
    render(<CampaignsScreen meClient={async () => ADMIN} listClient={async () => ({ kind: 'ok', items: [CAMP] })} membersClient={async () => ({ kind: 'ok', items: [] })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Portada' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Portada/)).toBeTruthy();
    expect(within(dialog).getByLabelText('Cambiar portada')).toBeTruthy();
    expect(coverCalls()).toHaveLength(0);
  });
});

describe('aviso de /panel/assets (test 13)', () => {
  it('ya no dice que despachar y recibir solo se hacen en el móvil: remite a la ficha del lote', async () => {
    const { OrgAssetsScreen } = await load(['/panel/assets', '/assets/:assetRef']);
    render(<OrgAssetsScreen meClient={async () => ({ kind: 'ok', principal: { accountId: 'a', organizationId: 'o', roles: ['EMPLOYEE'] } })}
      assetsClient={async () => ({ kind: 'ok', items: [] })} />);
    await screen.findByText('Tu organización todavía no tiene activos registrados.');
    expect(screen.queryByText(/se hacen escaneando el QR en la app móvil/)).toBeNull();
    expect(screen.getByText('Despachar, recibir y entregar se hacen desde la ficha de cada lote o escaneando su QR en la app móvil.')).toBeTruthy();
  });
});
