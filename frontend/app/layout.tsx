import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AlertaReuniaoModal } from "@/components/ui/AlertaReuniaoModal";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "CRM Comercial — ProSystem",
  description: "Gestão comercial e retenção de clientes · ProSystem Sistemas",
  icons: { icon: "/logo-prosystem.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "CRM Comercial" },
};

// Sem isso o Safari do iOS renderiza numa largura virtual (~980px) e o usuário
// vê tudo minúsculo mesmo com CSS responsivo correto — viewport-fit=cover
// habilita respeitar safe-area-inset-* (notch) via CSS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`h-full ${inter.variable}`} data-theme="azul">
      <body className="h-full">
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              {children}
              <AlertaReuniaoModal />
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
