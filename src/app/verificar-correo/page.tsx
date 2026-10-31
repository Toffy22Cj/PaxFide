'use client';

// Ref: plan-fase7-puesta-al-dia.md P-6 (superficie nueva autorizada por el Anexo 1, como `/recuperar`)
import { VerifyEmailScreen } from '../../screens/VerifyEmailScreen';

/** `/verificar-correo`: solo cliente; el token llega en el fragmento (`#token=…`) y se trata en `VerifyEmailScreen`. */
export default function VerifyEmailPage() {
  return <VerifyEmailScreen />;
}
