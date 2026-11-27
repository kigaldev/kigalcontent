import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

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
    <html
      lang="es"
      className={`dark ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="min-h-screen bg-[var(--kc-canvas)] text-slate-100 font-sans antialiased selection:bg-sky-400/30 selection:text-sky-100 kc-ambient-bg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
