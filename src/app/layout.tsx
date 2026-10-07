import type { Metadata } from "next";
import "./globals.css";
import RouteGuard from "./RouteGuard";
import { Shell } from "../components/shell/Shell";

export const metadata: Metadata = {
  title: "PaxFide",
  description: "Donaciones que llegan: trazabilidad verificable de donaciones.",
  // Ningún enlace saliente envía la URL de la página (secretos bearer, ADR-041 §2.7)
  referrer: "no-referrer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
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
