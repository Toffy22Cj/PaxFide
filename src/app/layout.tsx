import type { Metadata } from "next";
import "./globals.css";
import RouteGuard from "./RouteGuard";
import { Shell } from "../components/shell/Shell";
import { fontDisplay, fontMono } from "./fonts";

export const metadata: Metadata = {
  title: "PaxFide",
  description: "Donaciones que llegan: trazabilidad verificable de donaciones.",
  // Ningún enlace saliente envía la URL de la página (secretos bearer, ADR-041 §2.7)
  referrer: "no-referrer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Ref: decisión de Carlos 2026-10-21 (DF7-17), se retira en VS-8. Tema claro forzado hasta que todas las
    // pantallas usen la capa semántica; en VS-8 vuelven el script de preferencia (THEME_INIT_SCRIPT) y ThemeSelect.
    <html lang="es" data-theme="light" className={`${fontDisplay.variable} ${fontMono.variable}`}>
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
