'use client';
// Ref: plan-fase7-puesta-al-dia.md U-4 y U-5 (logo en "Mi organización" para REPRESENTATIVE y ADMINISTRATOR);
// referencia-api-v1.md §3 (`GET /organizations/{id}` con `logoUrl?`; `PUT`/`DELETE`/`GET …/logo`).
import React, { useEffect, useState } from 'react';
import { fetchOrganization, type OrganizationDetails } from '../../lib/api/organization';
import { deleteLogo, fetchPrivateImage, uploadLogo, type PrivateImageOutcome } from '../../lib/api/media';
import { Surface } from '../ui/Layout';
import { LoadingState } from '../States';
import { ImageEditor } from './ImageEditor';
import { PrivateImage } from './PrivateImage';
import s from './media.module.css';

export function OrganizationLogoCard({ organizationId, orgClient = fetchOrganization, imageClient = fetchPrivateImage, upload = uploadLogo, remove = deleteLogo }: {
  organizationId: string;
  orgClient?: typeof fetchOrganization;
  imageClient?: (path: string) => Promise<PrivateImageOutcome>;
  upload?: typeof uploadLogo;
  remove?: typeof deleteLogo;
}) {
  const [org, setOrg] = useState<OrganizationDetails | null | 'loading'>('loading');
  // Cada cambio vuelve a leer la organización (y el logo, por su clave)
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    void orgClient(organizationId).catch(() => null).then((r) => { if (alive) setOrg(r?.kind === 'ok' ? r.organization : null); });
    return () => { alive = false; };
  }, [organizationId, orgClient, version]);

  if (org === 'loading') return <Surface title="Logo"><LoadingState /></Surface>;
  const initial = (org?.name ?? 'O').trim().charAt(0).toUpperCase();
  const initialEl = <span className={s.initial} aria-hidden="true" data-testid="logo-initial">{initial}</span>;
  return (
    <Surface title="Logo">
      <ImageEditor
        what="logo"
        hasImage={!!org?.logoUrl}
        current={org?.logoUrl
          ? <PrivateImage key={`${org.logoUrl}#${version}`} path={org.logoUrl} alt={`Logo de ${org.name ?? 'la organización'}`} className={s.logo}
              client={imageClient} fallback={initialEl} testId="org-logo" />
          : initialEl}
        upload={(file, onProgress) => upload(organizationId, file, onProgress)}
        remove={() => remove(organizationId)}
        onChanged={() => setVersion((v) => v + 1)}
      />
    </Surface>
  );
}
