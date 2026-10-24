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
    // Ref: plan-fase7-pantallas.md C-1 y plan-fase7-fidelidad.md F-A0 (D-F11): sin tema forzado (se retira DF7-17).
    // Por defecto manda prefers-color-scheme (enmienda §4.1); una preferencia guardada se aplica en <head> antes de
    // pintar (DF7-10). El script cambia data-theme antes de hidratar: de ahí suppressHydrationWarning.
    <html lang="es" suppressHydrationWarning className={`${fontDisplay.variable} ${fontMono.variable}`}>
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
