'use client';

import { InvitationScreen } from '../../screens/InvitationScreen';

/** `/invitaciones`: solo cliente; el token llega en el fragmento (`#token=…`) y se trata en `InvitationScreen`. */
export default function InvitationPage() {
  return <InvitationScreen />;
}
