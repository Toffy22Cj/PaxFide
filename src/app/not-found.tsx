import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h2>404 - Not Found</h2>
      <p>La ruta solicitada no existe o no está habilitada.</p>
    </div>
  );
}
