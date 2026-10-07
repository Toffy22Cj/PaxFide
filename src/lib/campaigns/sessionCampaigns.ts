'use client';

import * as session from '../auth/session';
import type { CreatedCampaign } from '../api/campaignAdmin';

/**
 * Convocatorias creadas en esta pestaña, mientras no exista el listado (S-02). Solo en memoria; se vacía en
 * cualquier `LOGGED_OUT` (DW-21). No es fuente de verdad: es una ayuda para asignar responsable sin copiar ids.
 */
export interface SessionCampaign extends CreatedCampaign {
  title: string;
}

let items: SessionCampaign[] = [];
const listeners = new Set<() => void>();

session.subscribe((state) => {
  if (state === 'LOGGED_OUT' && items.length > 0) {
    items = [];
    listeners.forEach((l) => l());
  }
});

export function addSessionCampaign(c: SessionCampaign) {
  items = [c, ...items.filter((x) => x.campaignRef !== c.campaignRef)];
  listeners.forEach((l) => l());
}

export function getSessionCampaigns(): SessionCampaign[] {
  return items;
}

export function subscribeSessionCampaigns(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
