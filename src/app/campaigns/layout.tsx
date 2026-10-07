import type { Metadata } from 'next';

/** `noindex` también aquí hasta que se decida la indexación del descubrimiento (P-W2; DW-32). */
export const metadata: Metadata = { title: 'Convocatorias — PaxFide', robots: { index: false, follow: false } };

export default function DiscoveryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
