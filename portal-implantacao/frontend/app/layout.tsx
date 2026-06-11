import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portal de Implantação — Prosystem',
  description: 'Gestão de Implantação e Onboarding Prosystem',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
