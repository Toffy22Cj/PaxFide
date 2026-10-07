/**
 * Origen del backend (ADR-046 D3, invariante C1). Siempre un origen distinto del de la app: si apuntara al propio
 * Next.js, el JWT viajaría al servidor de la web, que nunca debe recibirlo. Por eso no se usan rewrites como proxy
 * (decisión DW-03 de `Documentos/decisiones-delegadas-web-2026-10.md`).
 */
export class ApiBaseUrlMisconfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiBaseUrlMisconfiguredError';
  }
}

/** Devuelve la base de la API (p. ej. `http://localhost:8080/api/v1`), sin barra final. */
export function getApiBase(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new ApiBaseUrlMisconfiguredError('NEXT_PUBLIC_API_BASE_URL no está configurada.');
  }
  if (typeof window !== 'undefined') {
    let sameOrigin = false;
    try {
      sameOrigin = new URL(baseUrl, window.location.href).origin === window.location.origin;
    } catch {
      sameOrigin = false;
    }
    if (sameOrigin) {
      throw new ApiBaseUrlMisconfiguredError('NEXT_PUBLIC_API_BASE_URL no puede ser el mismo origen que la app.');
    }
  }
  return baseUrl.replace(/\/+$/, '');
}

/** Codifica un segmento de ruta; nunca se concatena un valor del usuario sin codificar. */
export function segment(value: string): string {
  return encodeURIComponent(value);
}
