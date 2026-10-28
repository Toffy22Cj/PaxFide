// Ref: plan-fase7-puesta-al-dia.md U-1; referencia-api-v1.md §1, nota del 2026-10-25 (R-5): las versiones vigentes de
// los tres textos legales. Es la misma cadena que la cabecera de Documentos/legal/*.md y que el backend configura en
// TRACEABILITY_LEGAL_*_VERSION. Un solo sitio: la usan los textos publicados, el registro, el login y crear organización.
export const LEGAL_VERSIONS = {
  terms: 'v1-2026-10',
  dataPolicy: 'v1-2026-10',
  organizationTerms: 'v1-2026-10',
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_VERSIONS;

/** Dónde se publica cada texto (plan-fase7-fidelidad.md D-F17). */
export const LEGAL_PATHS: Record<LegalDocumentKey, string> = {
  terms: '/terminos',
  dataPolicy: '/privacidad',
  organizationTerms: '/terminos-organizacion',
};
