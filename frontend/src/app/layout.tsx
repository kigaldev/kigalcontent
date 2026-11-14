import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autonomous Content Engine Web — Studio Operativo Multiagente",
  description:
    "Plataforma enterprise de producción audiovisual, gobernanza HITL, simulación 9:16 con Remotion, copycrafting multicanal y bucle cerrado RMT-A.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
