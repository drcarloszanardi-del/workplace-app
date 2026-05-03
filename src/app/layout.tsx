import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Workplace | Tablero de actividad real',
  description:
    'Workplace con tablero de actividad real y semáforo de evidencia verificable para el foco APP-001.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
