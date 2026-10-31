import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  recordAmbiguousSessionCommand,
  resetAmbiguousSessionCommands,
} from '../src/lib/commands/ambiguousSession';
import { CampaignsScreen, getCampaignStatusInfo, matchesCampaignFilter } from '../src/screens/CampaignsScreen';
import { OrgAssetsScreen, matchesAssetFilter } from '../src/screens/OrgAssetsScreen';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const ADMIN_ME = async () => ({
  kind: 'ok' as const,
  principal: {
    accountId: 'acc-admin',
    organizationId: 'org-1',
    roles: ['ADMINISTRATOR' as const],
  },
});

const EMPLOYEE_ME = async () => ({
  kind: 'ok' as const,
  principal: {
    accountId: 'acc-emp',
    organizationId: 'org-1',
    roles: ['EMPLOYEE' as const],
  },
});

describe('F-B2 Fidelidad — /panel/campaigns y /panel/assets', () => {
  beforeEach(() => {
    resetAmbiguousSessionCommands();
    vi.stubEnv(
      'NEXT_PUBLIC_E2E_SURFACES',
      JSON.stringify([
        '/panel/campaigns',
        '/panel/assets',
        'action:create-campaign',
        'action:register-asset',
        '/c/:publicCode',
        '/assets/:assetRef',
      ])
    );
  });

  afterEach(() => {
    resetAmbiguousSessionCommands();
    vi.unstubAllEnvs();
  });

  describe('/panel/campaigns', () => {
    const now = Date.now();
    const in3Days = new Date(now + 3 * 86400000).toISOString();
    const in20Days = new Date(now + 20 * 86400000).toISOString();

    const campOpenSoon = {
      campaignRef: 'camp-soon',
      publicCode: 'PUB-SOON',
      title: 'Convocatoria Pronto',
      status: 'OPEN',
      visibility: 'PUBLIC',
      currency: 'COP',
      targetAmount: '1000000',
      clearedAmount: '750000',
      responsibles: [],
      assignedEmployeeCount: 0,
      endDate: in3Days,
    };

    const campOpenFar = {
      campaignRef: 'camp-far',
      publicCode: 'PUB-FAR',
      title: 'Convocatoria Lejana',
      status: 'OPEN',
      visibility: 'PUBLIC',
      currency: 'COP',
      targetAmount: '2000000',
      clearedAmount: '500000',
      responsibles: [],
      assignedEmployeeCount: 0,
      endDate: in20Days,
    };

    const campClosed = {
      campaignRef: 'camp-closed',
      publicCode: 'PUB-CLOSED',
      title: 'Convocatoria Finalizada',
      status: 'CLOSED',
      visibility: 'PUBLIC',
      currency: 'COP',
      targetAmount: '1000000',
      clearedAmount: '1000000',
      responsibles: [],
      assignedEmployeeCount: 0,
    };

    it('D-P9: Cierra pronto = abierta con endDate dentro de los próximos 7 días', () => {
      const soon = getCampaignStatusInfo(campOpenSoon);
      expect(soon.label).toBe('Cierra pronto');
      expect(soon.tone).toBe('wait');

      const far = getCampaignStatusInfo(campOpenFar);
      expect(far.label).toBe('Abierta');
      expect(far.tone).toBe('ok');

      const closed = getCampaignStatusInfo(campClosed);
      expect(closed.label).toBe('Cerrada');
      expect(closed.tone).toBe('off');
    });

    it('filtro de chips: Todas, Abiertas, Cerradas (con aserciones negativas)', async () => {
      render(
        <CampaignsScreen
          meClient={ADMIN_ME}
          listClient={async () => ({
            kind: 'ok',
            items: [campOpenSoon, campOpenFar, campClosed],
          })}
          membersClient={async () => ({ kind: 'ok', items: [] })}
        />
      );

      // 1. Todas por defecto: las 3 aparecen
      expect(await screen.findByText('Convocatoria Pronto')).toBeInTheDocument();
      expect(screen.getByText('Convocatoria Lejana')).toBeInTheDocument();
      expect(screen.getByText('Convocatoria Finalizada')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');

      // 2. Filtrar por Abiertas
      fireEvent.click(screen.getByRole('button', { name: 'Abiertas' }));
      expect(screen.getByRole('button', { name: 'Abiertas' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');

      expect(screen.getByText('Convocatoria Pronto')).toBeInTheDocument();
      expect(screen.getByText('Convocatoria Lejana')).toBeInTheDocument();
      // Negativa: la cerrada ya no está
      expect(screen.queryByText('Convocatoria Finalizada')).toBeNull();

      // 3. Filtrar por Cerradas
      fireEvent.click(screen.getByRole('button', { name: 'Cerradas' }));
      expect(screen.getByRole('button', { name: 'Cerradas' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Abiertas' })).toHaveAttribute('aria-pressed', 'false');

      expect(screen.getByText('Convocatoria Finalizada')).toBeInTheDocument();
      // Negativas: las abiertas ya no están
      expect(screen.queryByText('Convocatoria Pronto')).toBeNull();
      expect(screen.queryByText('Convocatoria Lejana')).toBeNull();
    });

    it('barra de recaudado con porcentaje calculado correctamente', async () => {
      render(
        <CampaignsScreen
          meClient={ADMIN_ME}
          listClient={async () => ({
            kind: 'ok',
            items: [campOpenSoon],
          })}
          membersClient={async () => ({ kind: 'ok', items: [] })}
        />
      );

      // 750000 / 1000000 = 75%
      expect(await screen.findByText('75%')).toBeInTheDocument();
    });
  });

  describe('/panel/assets', () => {
    const assetsList = [
      {
        assetRef: 'L-REG',
        lifecycleStatus: 'REGISTERED',
        assetType: 'Kits escolares',
        quantity: '50',
        unitOfMeasure: 'kit',
        currentLocation: 'Bodega Central',
      },
      {
        assetRef: 'L-REC',
        lifecycleStatus: 'RECEIVED',
        assetType: 'Cobijas',
        quantity: '100',
        unitOfMeasure: 'und',
        currentLocation: 'Bodega Central',
      },
      {
        assetRef: 'L-DISP',
        lifecycleStatus: 'DISPATCHED',
        assetType: 'Medicamentos',
        quantity: '20',
        unitOfMeasure: 'cajas',
        currentLocation: 'En tránsito',
      },
      {
        assetRef: 'L-DELIV',
        lifecycleStatus: 'DELIVERED',
        assetType: 'Alimentos',
        quantity: '30',
        unitOfMeasure: 'mercados',
        currentLocation: 'Mocoa',
      },
    ];

    it('agrupación de chips según plan-fase7-fidelidad §5 (con negativas)', async () => {
      render(
        <OrgAssetsScreen
          meClient={EMPLOYEE_ME}
          assetsClient={async () => ({
            kind: 'ok',
            items: assetsList,
          })}
        />
      );

      // 1. Todos por defecto
      expect(await screen.findByText('L-REG')).toBeInTheDocument();
      expect(screen.getByText('L-REC')).toBeInTheDocument();
      expect(screen.getByText('L-DISP')).toBeInTheDocument();
      expect(screen.getByText('L-DELIV')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');

      // 2. En bodega: REGISTERED y RECEIVED
      fireEvent.click(screen.getByRole('button', { name: 'En bodega' }));
      expect(screen.getByRole('button', { name: 'En bodega' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');

      expect(screen.getByText('L-REG')).toBeInTheDocument();
      expect(screen.getByText('L-REC')).toBeInTheDocument();
      // Negativas: DISPATCHED y DELIVERED no deben aparecer
      expect(screen.queryByText('L-DISP')).toBeNull();
      expect(screen.queryByText('L-DELIV')).toBeNull();

      // 3. En camino: DISPATCHED
      fireEvent.click(screen.getByRole('button', { name: 'En camino' }));
      expect(screen.getByRole('button', { name: 'En camino' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('L-DISP')).toBeInTheDocument();
      // Negativas
      expect(screen.queryByText('L-REG')).toBeNull();
      expect(screen.queryByText('L-REC')).toBeNull();
      expect(screen.queryByText('L-DELIV')).toBeNull();

      // 4. Entregados: DELIVERED
      fireEvent.click(screen.getByRole('button', { name: 'Entregados' }));
      expect(screen.getByRole('button', { name: 'Entregados' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('L-DELIV')).toBeInTheDocument();
      // Negativas
      expect(screen.queryByText('L-REG')).toBeNull();
      expect(screen.queryByText('L-REC')).toBeNull();
      expect(screen.queryByText('L-DISP')).toBeNull();
    });

    it('aviso amarillo de ambiguos: sin controles dentro y resalta la fila del lote ambiguo', async () => {
      // Registramos comando ambiguo en la sesión para L-REG
      recordAmbiguousSessionCommand({
        id: 'L-REG',
        title: 'Confirmar recepción de L-REG',
        detail: 'Operación ambigua',
        createdAt: Date.now(),
      });

      render(
        <OrgAssetsScreen
          meClient={EMPLOYEE_ME}
          assetsClient={async () => ({
            kind: 'ok',
            items: assetsList,
          })}
        />
      );

      // Aviso presente con texto
      const notice = await screen.findByTestId('ambiguous-assets-notice');
      expect(notice).toBeInTheDocument();
      expect(notice).toHaveTextContent(/1 lote sin confirmar/);

      // Test de §5: el aviso ambiguo no lleva controles dentro (las acciones van debajo)
      expect(within(notice).queryByRole('button')).toBeNull();
      expect(within(notice).queryByRole('link')).toBeNull();

      // Fila resaltada: la fila de L-REG tiene la clase ambRow
      const rows = await screen.findAllByTestId('org-asset');
      const regRow = rows.find((r) => r.textContent?.includes('L-REG'));
      expect(regRow).toHaveClass(/ambRow/);

      // Negativa: la fila de L-REC NO tiene la clase ambRow
      const recRow = rows.find((r) => r.textContent?.includes('L-REC'));
      expect(recRow).not.toHaveClass(/ambRow/);
    });
  });
});
