'use client';
// Ref: plan-fase7-puesta-al-dia.md U-5 (portada en la configuración de la convocatoria, solo ADMINISTRATOR) y U-4 (la
// portada es pública: va directa en `<img>`); referencia-api-v1.md §4 (`PUT`/`DELETE …/campaigns/{ref}/cover`).
import React, { useState } from 'react';
import { deleteCover, uploadCover } from '../../lib/api/media';
import { publicAssetUrl } from '../../lib/api/publicCampaignModel';
import { Surface } from '../ui/Layout';
import { ImageEditor } from './ImageEditor';
import s from './media.module.css';

export function CampaignCoverCard({ organizationId, campaignRef, title, coverImageUrl, upload = uploadCover, remove = deleteCover, onChanged }: {
  organizationId: string;
  campaignRef: string;
  title: string;
  coverImageUrl?: string;
  upload?: typeof uploadCover;
  remove?: typeof deleteCover;
  onChanged?: () => void;
}) {
  // Tras subir, la ruta pública es la misma: se fuerza otra petición con un contador local (no es un token)
  const [bust, setBust] = useState(0);
  const [cover, setCover] = useState(coverImageUrl);
  const src = cover ? publicAssetUrl(cover) : undefined;
  return (
    <Surface title="Portada">
      <ImageEditor
        what="portada"
        hasImage={!!cover}
        current={src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={bust ? `${src}?v=${bust}` : src} alt={`Portada de «${title}»`} className={s.coverPreview} referrerPolicy="no-referrer" data-testid="cover-current" />
          : <span className={s.hint} data-testid="cover-none">Esta convocatoria no tiene portada: la tarjeta muestra el logo o la inicial.</span>}
        upload={async (file, onProgress) => {
          const r = await upload(organizationId, campaignRef, file, onProgress);
          if (r.kind === 'ok') { setCover(r.url ?? cover); setBust((b) => b + 1); }
          return r;
        }}
        remove={async () => {
          const r = await remove(organizationId, campaignRef);
          if (r.kind === 'ok') setCover(undefined);
          return r;
        }}
        onChanged={() => onChanged?.()}
      />
    </Surface>
  );
}
