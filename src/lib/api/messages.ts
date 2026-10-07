import type { ProblemInfo } from './http';

/**
 * Texto de un rechazo a partir del `ProblemDetail` del backend: solo el código y el `title` (nombre fijo de la regla,
 * ApiExceptionHandler de B6-0). El `detail` nunca se muestra (`diseno-ux-contractual-web-v1.md` §6). Los textos de
 * los 409 son decisión delegada DW-07, `PENDIENTE DE RATIFICACIÓN`.
 */
const BY_TITLE: Record<string, string> = {
  // Convocatoria (CV-01, CV-02)
  OrganizationNotVerified: 'Tu organización todavía no está verificada. No puede crear convocatorias.',
  CommandIdReusedForDifferentCommand: 'No pudimos procesar la operación. Ábrela de nuevo e inténtalo otra vez.',
  CommandIdReused: 'No pudimos procesar la operación. Ábrela de nuevo e inténtalo otra vez.',
  ResponsibleAlreadyActiveInCampaign: 'Esa cuenta ya es responsable activa de esta convocatoria.',
  // Backend: `EmployeeAlreadyAssigned` = el EMPLOYEE ya es responsable activo de OTRA convocatoria (índice único);
  // (`ResponsibleAlreadyActiveInCampaign`, arriba = ya es responsable de ESTA convocatoria)
  EmployeeAlreadyAssigned: 'Esa persona ya es responsable de otra convocatoria activa.',
  EmployeeSelfAssignmentNotAllowed: 'No puedes asignarte a ti mismo con esta acción.',
  InvalidResponsibleRecipient: 'Esa cuenta no puede ser responsable de esta convocatoria.',
  ResponsibleAssignmentOnClosedCampaign: 'La convocatoria está cerrada: ya no admite responsables.',
  CampaignDateInPast: 'La fecha de inicio no puede estar en el pasado.',
  InvalidCampaignDateRange: 'La fecha de fin debe ser posterior a la de inicio.',
  CampaignTitleRequired: 'El título es obligatorio.',
  CampaignTitleTooLong: 'El título es demasiado largo.',
  CampaignDescriptionTooLong: 'La descripción es demasiado larga.',
  CampaignVisibilityRequired: 'Elige la visibilidad de la convocatoria.',
  EmptyAcceptedDonationTypes: 'Elige al menos un tipo de donación.',
  IncompleteMonetaryConfiguration: 'Para donaciones en dinero, completa moneda, meta y política de meta.',
  MissingCampaignCurrency: 'Indica la moneda.',
  InvalidCampaignCurrency: 'La moneda no es válida (código ISO 4217, p. ej. COP).',
  InvalidTargetAmount: 'La meta no es válida.',
  InvalidOnTargetReached: 'Esa acción al alcanzar la meta no es compatible con la política elegida.',
  MonetaryTermsWithoutMonetaryDonationType: 'La meta y la moneda solo aplican si se aceptan donaciones en dinero.',
  CampaignAlreadyClosed: 'La convocatoria ya está cerrada.',
  LastResponsibleRemovalWithoutReplacement: 'Es el último responsable: indica quién lo sustituye.',
  ReplacementActingRoleRequired: 'Indica el papel de quien sustituye al responsable.',
  ResponsibleAssignmentNotFound: 'Esa cuenta no es responsable de esta convocatoria.',
  AssignmentAlreadyRemoved: 'Ese responsable ya fue retirado.',
  DuplicateEmail: 'Ya existe una cuenta con ese correo.',
  InvalidInformationRequestMessage: 'El mensaje es obligatorio y admite hasta 2000 caracteres.',
  // Donación (CV-11)
  CampaignClosed: 'Esta convocatoria está cerrada y ya no recibe donaciones.',
  CashDonationIntentNotSupported: 'Las donaciones en efectivo no se registran por este medio.',
  CloseOnTargetCloseNotSupported: 'Esta convocatoria no admite donaciones en este momento.',
  DonationCurrencyMismatch: 'La moneda no coincide con la de la convocatoria.',
  DonationTypeNotAccepted: 'Esta convocatoria no acepta este tipo de donación.',
  PaymentMethodNotAccepted: 'Esta convocatoria no acepta ese medio de pago.',
  SimulatedPaymentsNotAllowed: 'El pago simulado no está disponible en este entorno.',
  PaymentProviderUnavailable: 'La pasarela de pago no está disponible. Inténtalo más tarde.',
  InvalidDonationAmount: 'El monto no es válido.',
  // Activos (DomainInvariantViolationException: el title es el nombre de la regla)
  InvalidAssetTransition: 'El activo no está en un estado que permita esta operación.',
  AssetTerminalState: 'El activo ya terminó su recorrido: no admite más operaciones.',
  InsufficientQuantity: 'La cantidad a separar debe ser menor que la cantidad actual del activo.',
  InvalidSplitTarget: 'No se puede dividir este activo con esa cantidad.',
  InsufficientAvailableFunds: 'El fondo no tiene saldo disponible suficiente para esta compra.',
  ExceedsClearedFunds: 'La compra supera los fondos recibidos.',
  InvalidFundTransition: 'El fondo no está en un estado que permita esta operación.',
  DuplicateAllocation: 'Esa asignación de fondos ya se usó.',
  CampaignNotAvailable: 'La convocatoria no admite este registro.',
  ConcurrentModification: 'Otra operación modificó el recurso al mismo tiempo. Recarga y revisa antes de repetir.',
  InvalidVerificationTransition: 'La organización no está en un estado que permita esta operación.',
};

const BY_STATUS: Record<number, string> = {
  400: 'Revisa los datos: alguno no es válido.',
  403: 'No tienes acceso a esta operación.',
  404: 'No encontramos el recurso.',
  409: 'La operación no es compatible con el estado actual del recurso.',
};

export function rejectionMessage(status: number, problem: ProblemInfo): string {
  if (problem.title && BY_TITLE[problem.title]) return BY_TITLE[problem.title];
  return BY_STATUS[status] ?? 'La operación fue rechazada.';
}
