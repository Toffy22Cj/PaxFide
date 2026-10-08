import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Invitación — PaxFide',
  robots: { index: false, follow: false },
  // El token va en el fragmento y nunca viaja en el Referer; aun así, esta página no envía Referer a nadie
  referrer: 'no-referrer',
};

export default function InvitationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
