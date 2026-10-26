import type { Metadata } from "next";
import "./globals.css";
import RouteGuard from "./RouteGuard";
import { Shell } from "../components/shell/Shell";
import { fontDisplay, fontMono } from "./fonts";
import { THEME_INIT_SCRIPT } from "../lib/theme/theme";
import { NAV_POSITION_INIT_SCRIPT } from "../lib/nav/navEntries";

export const metadata: Metadata = {
  title: "PaxFide",
  description: "Donaciones que llegan: trazabilidad verificable de donaciones.",
  // Ningún enlace saliente envía la URL de la página (secretos bearer, ADR-041 §2.7)
  referrer: "no-referrer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Ref: plan-fase7-fidelidad.md F-A0, D-F11 (revoca DF7-17 y activa el tema oscuro).
    // THEME_INIT_SCRIPT aplica en <head> la preferencia del usuario antes de pintar para evitar parpadeo.
    // NAV_POSITION_INIT_SCRIPT aplica la posición de la barra guardada en escritorio antes de pintar (D-F8).
    <html lang="es" suppressHydrationWarning className={`${fontDisplay.variable} ${fontMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: NAV_POSITION_INIT_SCRIPT }} />
      </head>
      <body>
        <Shell>
          <RouteGuard>
            {children}
          </RouteGuard>
        </Shell>
      </body>
    </html>
  );
}
