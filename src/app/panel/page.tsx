'use client';

import { logout } from '@/lib/auth/session';
import Link from 'next/link';

export default function PanelPage() {
  const handleLogout = () => {
    logout();
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Panel</h1>
      <p data-testid="panel-content">Contenido autenticado</p>
      <button data-testid="logout-btn" onClick={handleLogout}>Cerrar Sesión</button>
      <Link href="/c/123" data-testid="public-link">Público</Link>
      <Link href="/panel/campaigns" data-testid="campaigns-link">Campañas</Link>
    </div>
  );
}
