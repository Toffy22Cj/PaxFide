import type { Metadata } from "next";
import "./globals.css";
import RouteGuard from "./RouteGuard";
import { Shell } from "../components/shell/Shell";
import { fontDisplay, fontMono } from "./fonts";
import { THEME_INIT_SCRIPT } from "../lib/theme/theme";

export const metadata: Metadata = {
  title: "PaxFide",
  description: "Donaciones que llegan: trazabilidad verificable de donaciones.",
  // Ningún enlace saliente envía la URL de la página (secretos bearer, ADR-041 §2.7)
  referrer: "no-referrer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme lo pone el script de <head> antes de hidratar (DF7-10): por eso suppressHydrationWarning
    <html lang="es" className={`${fontDisplay.variable} ${fontMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
