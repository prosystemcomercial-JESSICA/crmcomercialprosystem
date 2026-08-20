'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import LoginForm from '@/components/auth/LoginForm';
import Image from 'next/image';

export default function Home() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  // CEO cai direto no RELATÓRIO (CEO) — a 1ª coisa que ele vê (resultado/direção).
  // Diretora/Supervisão veem tudo (dashboard); SDR vai pro funil próprio dela
  // (não tem Central de Leads/Radar Comercial); vendedor vai ao Radar Comercial.
  // Navegação em useEffect (não `redirect()` em render) — este é um Client
  // Component, e chamar `redirect()` no corpo do componente interrompe a
  // renderização de forma que pode deixar hooks de componentes filhos
  // (ex.: <Bloco> no Relatório Comercial) fora de sincronia entre passes.
  useEffect(() => {
    if (!isAuthenticated) return;
    const role = (user?.role || '').toUpperCase();
    const destino = role === 'CEO' ? '/relatorio-comercial'
      : podeVerTudo(user?.role) ? '/dashboard'
      : role === 'SDR' ? '/leads-sdr'
      : '/comercial';
    router.replace(destino);
  }, [isAuthenticated, user, router]);

  if (loading || isAuthenticated) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: 'var(--ps-navy)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--t-primary)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo — brand ProSystem ─────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[46%] p-12 relative overflow-hidden"
        style={{ background: 'var(--ps-navy)' }}
      >
        {/* Grid de pontos — referência visual ao próprio produto (linhas/células de
            dashboard), não um blob genérico de SaaS. Mais presente que os círculos
            de 5% de opacidade anteriores, mas ainda um plano de fundo, não ruído. */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <pattern id="ps-grid-dots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.4" fill="var(--t-primary)" opacity="0.35" />
            </pattern>
            <linearGradient id="ps-grid-fade" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--ps-navy)" stopOpacity="0" />
              <stop offset="75%" stopColor="var(--ps-navy)" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#ps-grid-dots)" />
          <rect width="100%" height="100%" fill="url(#ps-grid-fade)" />
        </svg>

        {/* Barra de destaque diagonal — assinatura visual, não decoração solta */}
        <div
          className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full"
          style={{
            background: 'radial-gradient(circle, color-mix(in srgb, var(--t-primary) 22%, transparent) 0%, transparent 70%)',
          }}
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
        <div className="relative z-10 space-y-7">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
              style={{ color: 'var(--t-primary)' }}
            >
              Tecnologia para farmácia, manipulação, padaria e varejo
            </p>
            <h1
              className="text-4xl font-extrabold leading-[1.08] mb-4"
              style={{ color: 'var(--t-text-inverse)' }}
            >
              Inteligência comercial
              <br />
              <span style={{ color: 'var(--t-primary)' }}>para crescer mais.</span>
            </h1>
            <p className="text-base leading-relaxed max-w-md" style={{ color: 'var(--t-text-muted)' }}>
              Leads, funil de vendas, retenção e performance da sua equipe em um único lugar — construído com 16 anos de conhecimento real do seu setor.
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
                style={{ background: 'color-mix(in srgb, var(--t-primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--t-primary) 22%, transparent)' }}
              >
                <p className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--t-primary)' }}>
                  {stat.num}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
            © {new Date().getFullYear()} ProSystem Sistemas · Vitória, ES
          </p>
        </div>
      </div>

      {/* ── Painel direito — formulário ─────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 sm:px-16 lg:px-20"
        style={{ background: 'var(--t-content-bg)' }}
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
              style={{ color: 'var(--t-text-primary)' }}
            >
              Bem-vindo de volta
            </h2>
            <p className="text-sm" style={{ color: 'var(--t-text-secondary)' }}>
              Acesse o CRM Comercial ProSystem
            </p>
          </div>

          <LoginForm />

          <p className="text-xs text-center mt-8" style={{ color: 'var(--t-text-muted)' }}>
            Acesso restrito à equipe ProSystem. Problemas para entrar? Fale com a supervisão.
          </p>
        </div>
      </div>
    </div>
  );
}
