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

const CUSTODIAN: Record<string, string> = {
  LOGISTICS_PARTNER: 'Operador logístico', REGIONAL_WAREHOUSE: 'Bodega regional',
  LAST_MILE_CARRIER: 'Transporte de última milla', LOCAL_ALLY: 'Aliado local', UNCATEGORIZED: 'Sin categoría',
};
const DONATION_STATUS: Record<string, string> = { ACTIVA: 'Activa', EN_PROCESO: 'En proceso' };
const EVENT: Record<string, string> = {
  ASSET_REGISTERED: 'Registrado', ASSET_DISPATCHED: 'Despachado', ASSET_RECEIVED: 'Recibido',
  ASSET_DELIVERED: 'Entregado', ASSET_SPLIT: 'Dividido', ASSET_SPLIT_COMPENSATED: 'División revertida',
  ASSET_CUSTODY_TRANSFERRED: 'Cambio de custodio', ASSET_DEPLETED: 'Agotado',
};
const INTENT_STATUS: Record<string, string> = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmada', FAILED: 'Fallida', EXPIRED_UNKNOWN: 'Sin confirmar a tiempo',
  FUNDING_REJECTED: 'No aceptada por la convocatoria',
};

export const custodianLabel = (v?: string) => (v ? CUSTODIAN[v] ?? v : '—');
export const donationStatusLabel = (v: string) => DONATION_STATUS[v] ?? v;
export const eventLabel = (v: string) => EVENT[v] ?? v;
export const intentStatusLabel = (v: string) => INTENT_STATUS[v] ?? v;

const ROLE: Record<string, string> = { ADMINISTRATOR: 'Administrador', REPRESENTATIVE: 'Representante', EMPLOYEE: 'Empleado' };
const VISIBILITY: Record<string, string> = { PUBLIC: 'Pública', PRIVATE_LINK: 'Solo con enlace' };
export const roleLabel = (v: string) => ROLE[v] ?? v;
export const visibilityLabel = (v?: string) => (v ? VISIBILITY[v] ?? v : '—');

const ALLOCATION_STATUS: Record<string, string> = { REQUESTED: 'Solicitada', CONFIRMED: 'Confirmada' };
const VERIFICATION_STATUS: Record<string, string> = {
  VERIFIED: 'Verificada', REJECTED: 'Rechazada', NEEDS_MORE_INFORMATION: 'Se pidió más información',
  PENDING_VERIFICATION: 'Pendiente de verificación',
};
export const allocationStatusLabel = (v: string) => ALLOCATION_STATUS[v] ?? v;
export const verificationStatusLabel = (v: string) => VERIFICATION_STATUS[v] ?? v;
