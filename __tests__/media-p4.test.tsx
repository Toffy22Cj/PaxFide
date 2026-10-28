// Ref: plan-fase7-puesta-al-dia.md P-4 (tests): U-4, U-5, U-6, U-7 (retirar) y U-8; referencia-api-v1.md §3, §4, §6 y §2.
import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as session from '../src/lib/auth/session';
import { checkImageFile, fetchPrivateImage, IMAGE_MAX_BYTES, privateApiUrl } from '../src/lib/api/media';
import { ImageEditor } from '../src/components/media/ImageEditor';
import { PrivateImage } from '../src/components/media/PrivateImage';
import { OrganizationLogoCard } from '../src/components/media/OrganizationLogoCard';
import { DeliveryEvidencePhoto } from '../src/components/media/DeliveryEvidencePhoto';
import { RemovePhotoForm } from '../src/components/media/RemovePhotoForm';
import { CampaignCard } from '../src/components/campaign/CampaignCard';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/panel' }));

const API = 'http://api.paxfide.test/api/v1';
const png = (size = 100) => new File([new Uint8Array(size)], 'logo.png', { type: 'image/png' });
let created: string[] = [];
let revoked: string[] = [];

beforeEach(() => {
  session._resetForTest();
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', API);
  created = []; revoked = [];
  let n = 0;
  (URL as any).createObjectURL = vi.fn(() => { const u = `blob:http://localhost/obj-${++n}`; created.push(u); return u; });
  (URL as any).revokeObjectURL = vi.fn((u: string) => revoked.push(u));
});
afterEach(() => vi.unstubAllEnvs());

describe('Antes de subir (U-5)', () => {
  it('más de 2 MB o un tipo que no es JPEG/PNG → no se sube (negativa)', async () => {
    expect(checkImageFile({ size: IMAGE_MAX_BYTES + 1, type: 'image/png' })).toBe('TooLarge');
    expect(checkImageFile({ size: 10, type: 'image/gif' })).toBe('UnsupportedFormat');
    expect(checkImageFile({ size: IMAGE_MAX_BYTES, type: 'image/jpeg' })).toBeNull();
    const upload = vi.fn();
    render(<ImageEditor what="logo" current={null} hasImage={false} upload={upload} remove={vi.fn()} onChanged={vi.fn()} />);
    fireEvent.change(screen.getByTestId('image-file-logo'), { target: { files: [png(IMAGE_MAX_BYTES + 1)] } });
    expect(await screen.findByText(/pesa más de 2 MB/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar logo' })).toBeNull();
    expect(screen.queryByTestId('image-preview')).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it('vista previa antes de subir; "Guardar logo" sube; un 403 tiene su texto', async () => {
    const upload = vi.fn().mockResolvedValue({ kind: 'error', error: 'Forbidden' });
    const onChanged = vi.fn();
    render(<ImageEditor what="logo" current={<span>F</span>} hasImage={false} upload={upload} remove={vi.fn()} onChanged={onChanged} />);
    fireEvent.change(screen.getByTestId('image-file-logo'), { target: { files: [png()] } });
    expect(screen.getByTestId('image-preview')).toHaveAttribute('src', created[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar logo' }));
    expect(await screen.findByText('Tu papel no puede cambiar esta imagen.')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('"Quitar" pide confirmación sin diálogo del navegador; Cancelar no borra', async () => {
    const remove = vi.fn().mockResolvedValue({ kind: 'ok' });
    const confirmSpy = vi.spyOn(window, 'confirm');
    const onChanged = vi.fn();
    render(<ImageEditor what="portada" current={null} hasImage upload={vi.fn()} remove={remove} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar portada' }));
    fireEvent.click(within(screen.getByTestId('remove-confirm')).getByRole('button', { name: 'Cancelar' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar portada' }));
    fireEvent.click(within(screen.getByTestId('remove-confirm')).getByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('removed'));
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

describe('Imagen privada (U-4)', () => {
  it('se pide con Authorization; el DOM nunca tiene el token ni la URL de la API en un src; se libera al desmontar', async () => {
    session.login('jwt-secreto');
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, blob: async () => new Blob(['x'], { type: 'image/png' }) });
    global.fetch = fetchMock as any;
    const { container, unmount } = render(<PrivateImage path="/api/v1/organizations/org-1/logo" alt="Logo" testId="img" />);
    const img = await screen.findByTestId('img');
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/organizations/org-1/logo`);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-secreto');
    expect(img.getAttribute('src')).toBe(created[0]);
    expect(container.innerHTML).not.toContain('jwt-secreto');
    expect([...container.querySelectorAll('[src]')].map((e) => e.getAttribute('src'))).not.toContain(expect.stringContaining('api.paxfide.test'));
    unmount();
    expect(revoked).toEqual([created[0]]);
  });

  it('nunca manda el JWT fuera del origen de la API', async () => {
    expect(privateApiUrl('https://otro.test/logo')).toBeNull();
    expect(privateApiUrl('//otro.test/logo')).toBeNull();
    expect(privateApiUrl('/physical-assets/A/evidence')).toBe(`${API}/physical-assets/A/evidence`);
    global.fetch = vi.fn() as any;
    expect(await fetchPrivateImage('https://otro.test/logo')).toEqual({ kind: 'error' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('logo: quitar → la vista vuelve a la inicial', async () => {
    let hasLogo = true;
    const orgClient = vi.fn(async () => ({ kind: 'ok' as const, organization: { organizationId: 'org-1', name: 'Fundación Demo', type: 'FOUNDATION', verificationStatus: 'VERIFIED', logoUrl: hasLogo ? '/api/v1/organizations/org-1/logo' : undefined } }));
    const imageClient = vi.fn(async () => ({ kind: 'ok' as const, blob: new Blob(['x']) }));
    const remove = vi.fn(async () => { hasLogo = false; return { kind: 'ok' as const }; });
    render(<OrganizationLogoCard organizationId="org-1" orgClient={orgClient} imageClient={imageClient} remove={remove} />);
    expect(await screen.findByTestId('org-logo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar logo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Quitar logo' })).toBeNull());
    expect(screen.getByTestId('logo-initial')).toHaveTextContent('F');
    expect(screen.queryByTestId('org-logo')).toBeNull();
    // La URL del blob del logo anterior se libera al desmontar la imagen
    await waitFor(() => expect(revoked).toEqual([created[0]]));
  });
});

describe('Portada en la tarjeta (U-6)', () => {
  const base = { publicCode: 'ABC', title: 'Mercados', organizationName: 'Fundación Demo', status: 'OPEN', startDate: '2026-10-01T00:00:00Z', endDate: '2026-12-31T00:00:00Z', acceptedDonationTypes: [], organizationVerified: true };
  it('con coverImageUrl, la portada arriba; sin ella, el aspecto anterior (inicial), sin imagen de portada', () => {
    const { unmount } = render(<CampaignCard campaign={{ ...base, coverImageUrl: `http://api.paxfide.test/api/v1/public/campaigns/ABC/cover` }} />);
    expect(screen.getByTestId('campaign-cover')).toHaveAttribute('src', 'http://api.paxfide.test/api/v1/public/campaigns/ABC/cover');
    expect(screen.getByTestId('campaign-cover')).toHaveAttribute('loading', 'lazy');
    unmount();
    render(<CampaignCard campaign={base} />);
    expect(screen.queryByTestId('campaign-cover')).toBeNull();
    expect(screen.getByTestId('campaign-initial')).toHaveTextContent('F');
  });
});

describe('Foto de la entrega (U-8)', () => {
  it.each([
    [{ kind: 'not-found' }, 'Sin foto.'],
    [{ kind: 'removed' }, 'La plataforma retiró esta foto.'],
  ] as const)('%o → su texto y ninguna imagen', async (outcome, text) => {
    render(<DeliveryEvidencePhoto assetRef="A-1" client={async () => outcome} />);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByTestId('evidence-img')).toBeNull();
  });
  it('200 → la imagen como blob, pedida a /physical-assets/{ref}/evidence', async () => {
    const client = vi.fn(async () => ({ kind: 'ok' as const, blob: new Blob(['x']) }));
    render(<DeliveryEvidencePhoto assetRef="A 1" client={client} />);
    expect(await screen.findByTestId('evidence-img')).toHaveAttribute('src', created[0]);
    expect(client).toHaveBeenCalledWith('/physical-assets/A%201/evidence');
    expect(screen.queryByText('Sin foto.')).toBeNull();
  });
});

describe('Retirar una foto (U-7)', () => {
  it('valida motivo y huella; 204 → "Foto retirada"; el motivo no queda en el formulario', async () => {
    const client = vi.fn().mockResolvedValue({ kind: 'ok' });
    render(<RemovePhotoForm organizations={[{ organizationId: 'org-2', name: 'Fundación Sin Verificar' }]} client={client} />);
    const form = screen.getByTestId('remove-photo-form');
    fireEvent.change(within(form).getByLabelText('De la cola de verificación'), { target: { value: 'org-2' } });
    expect(within(form).getByLabelText('Organización (identificador)')).toHaveValue('org-2');
    fireEvent.change(within(form).getByLabelText('Tipo'), { target: { value: 'DELIVERY_EVIDENCE' } });
    fireEvent.change(within(form).getByLabelText(/Huella de la foto/), { target: { value: 'no-es-huella' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Retirar foto' }));
    expect(await screen.findByText(/sha256: y 64 caracteres/)).toBeInTheDocument();
    expect(screen.getAllByText('Este campo es obligatorio.')).toHaveLength(1);
    expect(client).not.toHaveBeenCalled();
    const ref = 'sha256:' + 'a'.repeat(64);
    fireEvent.change(within(form).getByLabelText(/Huella de la foto/), { target: { value: ref } });
    fireEvent.change(within(form).getByLabelText(/Motivo/), { target: { value: 'Muestra datos personales' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Retirar foto' }));
    expect(await screen.findByText('Foto retirada')).toBeInTheDocument();
    expect(client).toHaveBeenCalledWith('org-2', 'DELIVERY_EVIDENCE', ref, 'Muestra datos personales');
    expect((within(form).getByLabelText(/Motivo/) as HTMLTextAreaElement).value).toBe('');
    expect(JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })).not.toContain('datos personales');
  });
  it('el logo no lleva referencia', async () => {
    const client = vi.fn().mockResolvedValue({ kind: 'ok' });
    render(<RemovePhotoForm organizations={[]} client={client} />);
    fireEvent.change(screen.getByLabelText('Organización (identificador)'), { target: { value: 'org-9' } });
    expect(screen.queryByLabelText(/Huella|Convocatoria/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retirar foto' }));
    await waitFor(() => expect(client).toHaveBeenCalledWith('org-9', 'ORGANIZATION_LOGO', undefined, 'x'));
  });
});

describe('Portada: el representante no ve "Cambiar portada" (negativa)', () => {
  async function load() {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_E2E_SURFACES', JSON.stringify(['/panel/configuration', 'action:campaign-cover']));
    return import('../src/screens/ConfigurationScreen');
  }
  const camp = { campaignRef: 'camp-1', publicCode: 'ABC', title: 'Mercados', status: 'OPEN', assignedEmployeeCount: 1 };
  const props = (roles: string[]) => ({
    meClient: async () => ({ kind: 'ok' as const, principal: { accountId: 'a', organizationId: 'org-1', roles } as any }),
    listClient: async () => ({ kind: 'ok' as const, items: [camp] }) as any,
    requestsClient: async () => ({ kind: 'ok' as const, items: [] }) as any,
    publicClient: async () => ({ kind: 'ok' as const, campaign: { title: 'Mercados', status: 'OPEN', startDate: 'x', endDate: 'y', acceptedDonationTypes: [], acceptedPaymentMethods: [] } }) as any,
  });
  it.each([['ADMINISTRATOR', 1], ['REPRESENTATIVE', 0]] as const)('%s → %i', async (role, n) => {
    const { ConfigurationScreen } = await load();
    render(<ConfigurationScreen {...props([role])} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver configuración' }));
    await screen.findByText('Solicitudes de cambio');
    expect(screen.queryAllByText('Cambiar portada')).toHaveLength(n);
  });
});
