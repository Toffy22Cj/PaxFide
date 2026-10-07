import { describe, it, expect } from 'vitest';
import { buildCreateCampaign, CampaignFormValues, localToUtcIso } from '../src/lib/campaignForm';

const NOW = new Date('2026-10-07T12:00:00Z');
const base: CampaignFormValues = {
  title: 'Mercados', description: '', visibility: 'PUBLIC', start: '2026-10-08T09:00', end: '2026-12-31T18:00',
  donationTypes: ['MONETARY'], paymentMethods: ['GATEWAY'], currency: 'cop', target: '5000000',
  targetPolicy: 'FLEXIBLE', onTargetReached: '',
};

describe('Cuerpo de CV-01 (ficha §3.1)', () => {
  it('anidado, UTC con Z, meta en unidades mínimas, moneda en mayúsculas y sin onTargetReached si no es CLOSE_ON_TARGET', () => {
    const r = buildCreateCampaign(base, NOW);
    expect(r.errors).toBeNull();
    expect(r.body).toEqual({
      title: 'Mercados', visibility: 'PUBLIC',
      startDate: localToUtcIso('2026-10-08T09:00'), endDate: localToUtcIso('2026-12-31T18:00'),
      configuration: { acceptedDonationTypes: ['MONETARY'], acceptedPaymentMethods: ['GATEWAY'], currency: 'COP', targetAmount: '500000000', targetPolicy: 'FLEXIBLE' },
    });
    expect(r.body!.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('solo en especie: sin moneda, meta, política ni medios de pago', () => {
    const r = buildCreateCampaign({ ...base, donationTypes: ['IN_KIND'] }, NOW);
    expect(r.body!.configuration).toEqual({ acceptedDonationTypes: ['IN_KIND'], acceptedPaymentMethods: [] });
  });

  it('CLOSE_ON_TARGET exige onTargetReached y lo envía', () => {
    expect(buildCreateCampaign({ ...base, targetPolicy: 'CLOSE_ON_TARGET' }, NOW).errors?.onTargetReached).toBeDefined();
    const r = buildCreateCampaign({ ...base, targetPolicy: 'CLOSE_ON_TARGET', onTargetReached: 'CLOSE' }, NOW);
    expect(r.body!.configuration.onTargetReached).toBe('CLOSE');
  });

  it('visibilidad obligatoria; título obligatorio y ≤ 200', () => {
    const r = buildCreateCampaign({ ...base, visibility: '', title: ' ' }, NOW);
    expect(r.errors).toMatchObject({ visibility: expect.any(String), title: 'Este campo es obligatorio.' });
    expect(buildCreateCampaign({ ...base, title: 'x'.repeat(201) }, NOW).errors?.title).toBe('Máximo 200 caracteres.');
  });

  it('fechas: no en el pasado (margen de 5 min) y fin posterior al inicio', () => {
    expect(buildCreateCampaign({ ...base, start: '2026-10-01T09:00' }, NOW).errors?.start).toMatch(/pasado/);
    expect(buildCreateCampaign({ ...base, end: '2026-10-08T09:00' }, NOW).errors?.end).toMatch(/posterior/);
  });

  it('dinero sin medios de pago, moneda inválida o meta cero → errores', () => {
    const r = buildCreateCampaign({ ...base, paymentMethods: [], currency: 'pesos', target: '0' }, NOW);
    expect(r.errors).toMatchObject({ paymentMethods: expect.any(String), currency: expect.any(String), target: expect.any(String) });
  });
});
