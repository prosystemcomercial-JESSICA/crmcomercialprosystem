'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import LoginForm from '@/components/auth/LoginForm';
import Image from 'next/image';
import { LineChart, TrendingUp, Users2 } from 'lucide-react';

const BENEFICIOS = [
  {
    icon: LineChart,
    titulo: 'Leads e funil de vendas',
    desc: 'Todo o pipeline comercial organizado em um só lugar.',
  },
  {
    icon: TrendingUp,
    titulo: 'Retenção de clientes',
    desc: 'Acompanhamento de saúde da carteira e alertas de churn.',
  },
  {
    icon: Users2,
    titulo: 'Performance da equipe',
    desc: 'Metas, comissões e ranking de vendedores em tempo real.',
  },
];

export default function Home() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [beneficioAtivo, setBeneficioAtivo] = useState(0);

  // CEO/Diretora/Supervisão veem tudo (Dashboard Executivo unificado);
  // SDR vai pro funil próprio dela (não tem Central de Leads/Radar Comercial);
  // vendedor vai ao Radar Comercial.
  // Navegação em useEffect (não `redirect()` em render) — este é um Client
  // Component, e chamar `redirect()` no corpo do componente interrompe a
  // renderização de forma que pode deixar hooks de componentes filhos
  // fora de sincronia entre passes.
  useEffect(() => {
    if (!isAuthenticated) return;
    const role = (user?.role || '').toUpperCase();
    const destino = podeVerTudo(user?.role) ? '/dashboard'
      : role === 'SDR' ? '/leads-sdr'
      : '/comercial';
    router.replace(destino);
  }, [isAuthenticated, user, router]);

  // Carrossel de benefícios — troca automática a cada 3s.
  useEffect(() => {
    const t = setInterval(() => setBeneficioAtivo(i => (i + 1) % BENEFICIOS.length), 3000);
    return () => clearInterval(t);
  }, []);

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

      {/* ── Painel esquerdo — brand ProSystem, com foto de fundo real (mesmo
          padrão do login da Universidade Prosystem: overlay azul vertical,
          mais claro no topo e escurecendo para baixo, título com divisores
          laterais e carrossel de benefícios animado) ─────────────────────── */}
      <div
        className="hidden lg:flex lg:flex-col lg:w-[58%] xl:w-[60%] relative overflow-hidden"
        style={{ background: '#07111f' }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/login-bg-crescimento.jpg')",
            backgroundPosition: 'center 30%',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(5,20,70,0.3) 0%, rgba(8,28,80,0.45) 45%, rgba(5,14,40,0.75) 100%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{ height: 220, background: 'linear-gradient(to top, rgba(5,14,30,0.9) 0%, transparent 100%)' }}
        />

        <div className="relative z-10 flex flex-col items-center text-center h-full px-14 py-8 overflow-hidden">
          {/* Título com divisores — padding fluido (clamp) em vez de % fixo,
              para nao espremer o conteudo do meio em telas de altura curta. */}
          <div style={{ paddingTop: 'clamp(12px, 6vh, 64px)' }}>
            <h1 className="font-extrabold uppercase tracking-wide whitespace-nowrap mb-4" style={{ color: '#fff', fontSize: 'clamp(28px, 3.2vw, 44px)' }}>
              CRM <span style={{ color: '#8FC4F0' }}>Comercial</span>
            </h1>
            <div className="flex items-center justify-center gap-3">
              <div className="w-9 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, var(--t-primary-deep), var(--t-primary))' }} />
              <span className="font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(125,179,234,0.9)', fontSize: 'clamp(12px, 1vw, 14px)' }}>
                Gestão comercial e retenção de clientes
              </span>
              <div className="w-9 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, var(--t-primary-deep), var(--t-primary))' }} />
            </div>
          </div>

          {/* Frase de destaque, centralizada no espaço restante */}
          <div className="flex-1 flex flex-col items-center justify-center max-w-[640px]">
            <h2 className="font-medium leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(22px, 2.6vw, 34px)' }}>
              Quanto mais você <span className="font-extrabold" style={{ color: '#8FC4F0' }}>organiza</span> suas vendas, mais sua empresa <span className="font-extrabold" style={{ color: '#8FC4F0' }}>cresce</span>.
            </h2>
            <p className="leading-relaxed" style={{ color: '#fff', fontSize: 'clamp(14px, 1.2vw, 17px)' }}>
              Leads, funil de vendas, retenção e performance da sua equipe em um único lugar, construído com 16 anos de conhecimento real do seu setor.
            </p>
          </div>

          {/* Rodapé: carrossel de benefícios + dots + copyright */}
          <div className="w-full" style={{ paddingBottom: 'clamp(12px, 4vh, 44px)' }}>
            <div className="w-full max-w-[460px] mx-auto" style={{ marginTop: 'clamp(12px, 4vh, 44px)' }}>
              {BENEFICIOS.map((b, i) => {
                const Icon = b.icon;
                if (i !== beneficioAtivo) return null;
                return (
                  <div
                    key={b.titulo}
                    className="flex items-stretch gap-3.5 text-left rounded-2xl px-[18px] py-4"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.14)',
                      animation: 'ps-benefit-slide-in 0.75s cubic-bezier(0.16,1,0.3,1)',
                    }}
                  >
                    <div
                      className="flex-shrink-0 w-[38px] h-[38px] rounded-[10px] flex items-center justify-center"
                      style={{ background: 'rgba(75,142,200,0.16)', border: '1px solid rgba(75,142,200,0.3)', color: '#8FC4F0' }}
                    >
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold mb-0.5" style={{ color: '#fff' }}>{b.titulo}</p>
                      <p className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.68)' }}>{b.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-2" style={{ marginTop: 14, marginBottom: 'clamp(8px, 3vh, 28px)' }}>
              {BENEFICIOS.map((b, i) => (
                <button
                  key={b.titulo}
                  type="button"
                  aria-label={`Ver benefício: ${b.titulo}`}
                  onClick={() => setBeneficioAtivo(i)}
                  className="rounded-full p-0 border-none cursor-pointer"
                  style={{
                    height: 7,
                    width: i === beneficioAtivo ? 20 : 7,
                    background: i === beneficioAtivo ? 'var(--t-primary)' : 'rgba(255,255,255,0.25)',
                    transition: 'width .45s cubic-bezier(0.16,1,0.3,1), background .45s ease',
                  }}
                />
              ))}
            </div>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              © {new Date().getFullYear()} Prosystem Sistemas · Todos os direitos reservados
            </p>
          </div>
        </div>
      </div>

      {/* ── Painel direito — formulário ─────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 sm:px-16 lg:px-20 py-10"
        style={{ background: 'var(--t-content-bg)' }}
      >
        <div className="mb-10 text-center">
          <Image
            src="/logo-prosystem-cropped.png"
            alt="ProSystem"
            width={267}
            height={42}
            className="h-10 w-auto object-contain mx-auto"
            priority
          />
        </div>

        <div
          className="w-full max-w-sm rounded-2xl px-[26px] pt-[30px] pb-[26px] lg:px-9 lg:pt-9 lg:pb-8"
          style={{
            background: 'var(--t-card-bg)',
            boxShadow: '0 0 0 1px rgba(13,34,56,0.04), 0 20px 44px -14px rgba(13,34,56,0.26), 0 6px 16px -8px rgba(13,34,56,0.14)',
          }}
        >
          <div className="mb-[22px]">
            <h2
              className="text-lg font-normal mb-1"
              style={{ color: 'var(--t-text-primary)' }}
            >
              Bem-vindo de volta
            </h2>
            <p className="text-[12.5px]" style={{ color: 'var(--t-text-secondary)' }}>
              Acesse o CRM Comercial ProSystem
            </p>
          </div>

          <LoginForm />

          <p className="text-[10.5px] text-center mt-[18px] leading-relaxed" style={{ color: 'var(--t-text-muted)' }}>
            Acesso restrito à equipe ProSystem. Problemas para entrar? Fale com a supervisão.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes ps-benefit-slide-in {
          from { opacity: 0; transform: translateX(10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="ps-benefit-slide-in"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
