'use client';

// Ref: plan-fase7-puesta-al-dia.md P-1 (superficie autorizada por D-F16 de plan-fase7-fidelidad.md)
import { RecoverScreen } from '../../screens/RecoverScreen';

/** `/recuperar`: solo cliente; el token llega en el fragmento (`#token=…`) y se trata en `RecoverScreen`. */
export default function RecoverPage() {
  return <RecoverScreen />;
}
