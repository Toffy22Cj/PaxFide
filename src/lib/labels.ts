/** Traducciones de literales de los contratos. Un literal desconocido se muestra tal cual (nunca se inventa uno). */
const DONATION_TYPES: Record<string, string> = { MONETARY: 'Dinero', IN_KIND: 'Especie (bienes)' };
const PAYMENT_METHODS: Record<string, string> = {
  GATEWAY: 'Pasarela de pago', BANK_TRANSFER: 'Transferencia bancaria', CASH: 'Efectivo',
};
const CAMPAIGN_STATUS: Record<string, string> = { OPEN: 'Abierta', CLOSED: 'Cerrada' };
const LIFECYCLE: Record<string, string> = {
  REGISTERED: 'Registrado', DISPATCHED: 'Despachado', RECEIVED: 'Recibido', DELIVERED: 'Entregado',
};

export const donationTypeLabel = (v: string) => DONATION_TYPES[v] ?? v;
export const paymentMethodLabel = (v: string) => PAYMENT_METHODS[v] ?? v;
export const campaignStatusLabel = (v: string) => CAMPAIGN_STATUS[v] ?? v;
export const lifecycleLabel = (v: string) => LIFECYCLE[v] ?? v;
