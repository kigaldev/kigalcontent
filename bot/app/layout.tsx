import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Kigaldev · respuestas de Instagram',
  description: 'Servicio de respuestas automáticas a comentarios de Instagram de Kike Gallego.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: '#F5F6FA', color: '#141627', font: '16px/1.6 system-ui, sans-serif' }}>
        <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 16px' }}>{children}</main>
      </body>
    </html>
  );
}
