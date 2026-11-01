// Ref: plan-fase7-puesta-al-dia.md Anexo 4, U-30 y U-31. /login y /register comparten la tarjeta con sus pestañas,
// que se queda montada: al cambiar de pestaña solo cambia el contenido.
import { AuthCard } from '../../../components/access/AuthCard';

export default function AccountGroupLayout({ children }: { children: React.ReactNode }) {
  return <AuthCard>{children}</AuthCard>;
}
