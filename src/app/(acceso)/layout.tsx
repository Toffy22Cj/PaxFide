// Ref: plan-fase7-puesta-al-dia.md Anexo 4, U-30. Grupo de rutas del acceso: el mundo, la barra de arriba y el
// data-theme se montan UNA vez para /login, /register, /recuperar, /verificar-correo, /invitaciones, /terminos,
// /privacidad y /terminos-organizacion (las URL no cambian; el grupo no aparece en la ruta).
import { AccessLayout } from '../../components/access/AccessLayout';

export default function AccessGroupLayout({ children }: { children: React.ReactNode }) {
  return <AccessLayout>{children}</AccessLayout>;
}
