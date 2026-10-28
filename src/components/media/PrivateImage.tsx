'use client';
// Ref: plan-fase7-puesta-al-dia.md U-4: la imagen con JWT se pide con `fetch` y la cabecera de siempre, se muestra con
// `URL.createObjectURL` y la URL se libera al desmontar (o al cambiar de imagen). Nunca hay un token en un `src`.
import React, { useEffect, useState } from 'react';
import { fetchPrivateImage, type PrivateImageOutcome } from '../../lib/api/media';

export type PrivateImageState = 'loading' | 'ok' | 'not-found' | 'removed' | 'forbidden' | 'error';

export function PrivateImage({ path, alt, className, client = fetchPrivateImage, onState, fallback, testId }: {
  path: string;
  alt: string;
  className?: string;
  client?: (path: string) => Promise<PrivateImageOutcome>;
  /** Para que quien la usa muestre su texto de 404 o 410. */
  onState?: (s: PrivateImageState) => void;
  /** Lo que se ve mientras carga o si no hay imagen. */
  fallback?: React.ReactNode;
  testId?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let created: string | null = null;
    onState?.('loading');
    void client(path).catch(() => ({ kind: 'error' } as const)).then((r) => {
      if (!alive) return;
      if (r.kind === 'ok') {
        created = URL.createObjectURL(r.blob);
        setUrl(created);
        onState?.('ok');
      } else {
        setUrl(null);
        onState?.(r.kind);
      }
    });
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
      setUrl(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, client]);

  if (!url) return <>{fallback ?? null}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} data-testid={testId} />;
}
