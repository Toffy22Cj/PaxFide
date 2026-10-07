'use client';

import { segment } from './config';

/** CV-01: `POST /organizations/{organizationId}/campaigns` → `201 {campaignRef, publicCode}` (exactamente esos dos). */
export function createCampaignRequest(organizationId: string) {
  return (payload: unknown) => ({
    path: `/organizations/${segment(organizationId)}/campaigns`, body: payload, auth: 'required' as const,
  });
}

export interface CreatedCampaign {
  campaignRef: string;
  publicCode: string;
}

export function parseCreatedCampaign(data: unknown): CreatedCampaign | null {
  const d = data as Record<string, unknown> | null;
  return d && typeof d.campaignRef === 'string' && typeof d.publicCode === 'string'
    ? { campaignRef: d.campaignRef, publicCode: d.publicCode } : null;
}

/** CV-02: `POST /campaigns/{campaignRef}/employees` con `{employeeRef}` → `201 {assignmentId}`. */
export function assignEmployeeRequest(payload: { campaignRef: string; employeeRef: string }) {
  return {
    path: `/campaigns/${segment(payload.campaignRef)}/employees`,
    body: { employeeRef: payload.employeeRef },
    auth: 'required' as const,
  };
}
