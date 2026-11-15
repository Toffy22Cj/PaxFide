// Manifiesto de la web (icono al instalarla o añadirla a la pantalla de inicio). Iconos generados por
// scripts/marca/generar-iconos.py; favicon.ico, icon.png y apple-icon.png van en src/app por convención de Next.js.
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PaxFide',
    short_name: 'PaxFide',
    description: 'Donaciones que llegan: trazabilidad verificable de donaciones.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#20604C',
    icons: [
      { src: '/marca/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/marca/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/marca/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
