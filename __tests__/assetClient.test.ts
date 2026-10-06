import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAsset, ApiBaseUrlMisconfiguredError } from '../src/lib/api/assetClient';
import * as session from '../src/lib/auth/session';

// Mocks
vi.mock('../src/lib/auth/session', () => ({
  getJwt: vi.fn(),
  handle401: vi.fn()
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('assetClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://api.paxfide.test';
  });

  describe('URL Configuration', () => {
    it('throws ApiBaseUrlMisconfiguredError if NEXT_PUBLIC_API_BASE_URL is missing', async () => {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
      await expect(fetchAsset('A-1')).rejects.toThrow(ApiBaseUrlMisconfiguredError);
    });

    it('throws ApiBaseUrlMisconfiguredError if API URL matches app origin', async () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
      // Simular que estamos en el cliente con origin http://localhost:3000
      const originalWindow = global.window;
      (global as any).window = {
        location: { href: 'http://localhost:3000/panel', origin: 'http://localhost:3000' }
      };

      await expect(fetchAsset('A-1')).rejects.toThrow(ApiBaseUrlMisconfiguredError);

      (global as any).window = originalWindow;
    });
  });

  describe('HTTP Status Handling', () => {
    it('returns FORBIDDEN for 403 and never calls handle401', async () => {
      mockFetch.mockResolvedValue({ status: 403, ok: false });
      const res = await fetchAsset('A-1');
      expect(res).toEqual({ state: 'FORBIDDEN' });
      expect(session.handle401).not.toHaveBeenCalled();
    });

    it('returns ERROR for 401 and calls handle401(false)', async () => {
      mockFetch.mockResolvedValue({ status: 401, ok: false });
      const res = await fetchAsset('A-1');
      expect(res).toEqual({ state: 'ERROR' });
      expect(session.handle401).toHaveBeenCalledWith(false);
    });

    it('sends Authorization: Bearer token always', async () => {
      vi.mocked(session.getJwt).mockReturnValue('token-123');
      mockFetch.mockResolvedValue({ status: 404, ok: false });
      await fetchAsset('A-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.paxfide.test/physical-assets/A-1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token-123'
          })
        })
      );
    });
  });

  describe('Response parsing', () => {
    it('parses correctly and discards unknown fields', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          assetRef: 'A-1',
          lifecycleStatus: 'REGISTERED',
          currentCustodianRef: 'C-1',
          currentLocation: 'LOC-1',
          quantity: 1,
          unitOfMeasure: 'EA',
          campaignRef: 'CAMP-1',
          donorRef: 'D-1', // Extra
          parentAssetRef: 'PA-1', // Extra
          financial: { cost: 100 } // Extra
        })
      });

      const res = await fetchAsset('A-1');
      expect(res.state).toBe('SUCCESS');
      if (res.state === 'SUCCESS') {
        expect(res.data).toEqual({
          assetRef: 'A-1',
          lifecycleStatus: 'REGISTERED',
          currentCustodianRef: 'C-1',
          currentLocation: 'LOC-1',
          quantity: 1,
          unitOfMeasure: 'EA',
          campaignRef: 'CAMP-1'
        });
        
        // Exact key match to ensure no extra keys
        expect(Object.keys(res.data).sort()).toEqual([
          'assetRef',
          'campaignRef',
          'currentCustodianRef',
          'currentLocation',
          'lifecycleStatus',
          'quantity',
          'unitOfMeasure'
        ].sort());
      }
    });
  });
});
