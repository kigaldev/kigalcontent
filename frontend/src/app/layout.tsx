import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "KigalContent — Estudio Profesional Todo-en-Uno de Contenido, Video y Ads",
  description:
    "Estudio operativo Pro NLE para producción audiovisual 9:16, huella nativa anti-penalización, KigalChat Auto-DM, campañas Ads y bucle cerrado RMT-A.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="min-h-screen bg-[#08090d] text-slate-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
