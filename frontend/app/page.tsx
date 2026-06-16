'use client';

import { redirect } from 'next/navigation';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import LoginForm from '@/components/auth/LoginForm';
import Image from 'next/image';

export default function Home() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: '#0D2238' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#4B8EC8', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: '#7AAACB' }}>
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    // CEO cai direto no RELATÓRIO (CEO) — a 1ª coisa que ele vê (resultado/direção).
    // Diretora/Supervisão veem tudo (dashboard); vendedor vai ao Radar Comercial.
    const role = (user?.role || '').toUpperCase();
    redirect(role === 'CEO' ? '/relatorio-comercial' : podeVerTudo(user?.role) ? '/dashboard' : '/comercial');
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo — brand ProSystem ─────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[46%] p-12 relative overflow-hidden"
        style={{ background: '#0D2238' }}
      >
        {/* Decorative circles */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-5"
          style={{ background: '#4B8EC8' }}
        />
        <div
          className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full opacity-5"
          style={{ background: '#4B8EC8' }}
        />
        <div
          className="absolute top-1/2 right-12 w-px h-48 -translate-y-1/2 opacity-10"
          style={{ background: 'linear-gradient(to bottom, transparent, #4B8EC8, transparent)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <Image
            src="/logo-prosystem.png"
            alt="ProSystem"
            width={200}
            height={52}
            className="h-12 w-auto object-contain brightness-0 invert"
            priority
          />
        </div>

        {/* Central message */}
        <div className="relative z-10 space-y-6">
          <div>
            <h1
              className="text-3xl font-bold leading-tight mb-3"
              style={{ color: '#ffffff' }}
            >
              Inteligência comercial
              <br />
              <span style={{ color: '#4B8EC8' }}>para crescer mais.</span>
            </h1>
            <p className="text-base leading-relaxed" style={{ color: '#7AAACB' }}>
              Gerencie leads, funil de vendas, retenção e performance da sua equipe em um único lugar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { num: '16+', label: 'anos de mercado' },
              { num: '98%', label: 'satisfação de clientes' },
              { num: '5x', label: 'mais produtividade' },
              { num: '24/7', label: 'suporte especializado' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-4"
                style={{ background: 'rgba(75,142,200,0.08)', border: '1px solid rgba(75,142,200,0.15)' }}
              >
                <p className="text-xl font-bold" style={{ color: '#4B8EC8' }}>
                  {stat.num}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#4B7A9C' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs" style={{ color: '#2D5A7A' }}>
            © {new Date().getFullYear()} ProSystem Sistemas · Vitória, ES
          </p>
        </div>
      </div>

      {/* ── Painel direito — formulário ─────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 sm:px-16 lg:px-20"
        style={{ background: '#F4F7FB' }}
      >
        {/* Logo mobile */}
        <div className="mb-8 lg:hidden">
          <Image
            src="/logo-prosystem.png"
            alt="ProSystem"
            width={160}
            height={42}
            className="h-10 w-auto object-contain"
            priority
          />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2
              className="text-2xl font-bold mb-1"
              style={{ color: '#0D2238' }}
            >
              Bem-vindo de volta
            </h2>
            <p className="text-sm" style={{ color: '#7AAACB' }}>
              Acesse o CRM Comercial ProSystem
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
