'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Painel do Plano Comercial Prosystem 2026 — documento vivo de referência da
// equipe. Não duplica funções do CRM; consolida papéis, processo, regras,
// comissionamento, bônus, indicadores e objetivos num único lugar consultável.

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-5" style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)' }}>
      <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--t-primary)' }}>{titulo}</h2>
      {children}
    </section>
  );
}

function Pill({ children, cor = '#2E6EAB' }: { children: React.ReactNode; cor?: string }) {
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold mr-1 mb-1" style={{ background: cor + '18', color: cor }}>{children}</span>;
}

export default function PlanoComercialPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);
  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Plano Comercial Prosystem 2026</h1>
          <p className="mt-1" style={{ color: 'var(--t-text-muted)' }}>
            Crescimento sustentável, previsibilidade de receita e expansão da base. <b>O que não está registrado no CRM não existe.</b>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Secao titulo="👤 Jessica Cardoso — Supervisora / Diretora Comercial">
            <p className="text-sm mb-2" style={{ color: 'var(--t-text-secondary)' }}>Gestão da operação, planejamento estratégico, acompanhamento de metas e indicadores, desenvolvimento da equipe, negociações estratégicas, aprovação de condições especiais, fechamento de contratos estratégicos, expansão da carteira e treinamento.</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>Meta: garantir o atingimento das metas gerais da equipe.</p>
          </Secao>

          <Secao titulo="👤 Sarah — SDR e Closer">
            <p className="text-sm mb-2" style={{ color: 'var(--t-text-secondary)' }}>Prospecção ativa, captação, ligações, WhatsApp, qualificação, agendamento, demonstrações, follow-up, negociação e fechamento. Vende: upgrades, Comunicação entre Lojas, PAC, TEF e Auditoria Tributária. Atualização diária do CRM.</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>Meta: 3 a 7 contratos fechados por mês.</p>
          </Secao>
        </div>

        <Secao titulo="🔄 Processo Comercial">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
            {[
              ['1 · Prospecção', 'Sarah', 'Pesquisa de mercado, captação de leads, 1º contato, qualificação'],
              ['2 · Apresentação', 'Sarah', 'Demonstração, levantamento de necessidades, oportunidades'],
              ['3 · Negociação', 'Sarah', 'Proposta, negociação, tratamento de objeções'],
              ['4 · Fechamento', 'Sarah', 'Assinatura, confirmação da venda, encaminhar p/ implantação'],
              ['5 · Gestão', 'Jessica', 'Indicadores, oportunidades, revisão de metas, estratégia'],
            ].map(([etapa, resp, ativ]) => (
              <div key={etapa} className="rounded-lg border p-3" style={{ borderColor: 'var(--t-card-border)' }}>
                <p className="font-semibold" style={{ color: 'var(--t-primary)' }}>{etapa}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>Resp.: {resp}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--t-text-secondary)' }}>{ativ}</p>
              </div>
            ))}
          </div>
        </Secao>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Secao titulo="📋 Regras Operacionais">
            <ul className="text-sm space-y-1.5 list-disc list-inside" style={{ color: 'var(--t-text-secondary)' }}>
              <li>Atualização diária obrigatória do CRM.</li>
              <li>Toda negociação deve ter registro.</li>
              <li>Todo lead deve ter status atualizado.</li>
              <li>Todo contrato fechado deve ser registrado.</li>
              <li>Toda oportunidade perdida deve ter motivo registrado.</li>
            </ul>
          </Secao>

          <Secao titulo="📅 Reunião Comercial — Semanal · 30 min">
            <p className="text-sm mb-1" style={{ color: 'var(--t-text-secondary)' }}>Participantes: Jessica e Sarah.</p>
            <p className="text-sm" style={{ color: 'var(--t-text-secondary)' }}>Pauta: leads, apresentações, propostas, contratos, negociações em andamento, upgrades, Comunicação, PAC, TEF, Auditoria e indicadores.</p>
          </Secao>
        </div>

        <Secao titulo="💰 Comissionamento">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ color: 'var(--t-text-muted)' }} className="text-left text-xs">
                <th className="py-2 pr-4">Item</th><th className="py-2 pr-4">Sarah / Vendedor</th><th className="py-2">Jessica (Diretora)</th>
              </tr></thead>
              <tbody style={{ color: 'var(--t-text-secondary)' }}>
                {[
                  ['Novos contratos (setup)', '15%', '5% (override de todos os setups da equipe)'],
                  ['Upgrade de plano (setup)', '15%', '5%'],
                  ['Comunicação entre Lojas (setup)', '15%', '5%'],
                  ['PAC', 'R$ 50,00 / venda', '—'],
                  ['TEF', 'R$ 50,00 / ativação', '—'],
                  ['Auditoria Tributária (Avant/Imendes)', 'R$ 50,00 / ativação', '—'],
                ].map(r => (
                  <tr key={r[0]} className="border-t" style={{ borderColor: 'var(--t-card-border)' }}>
                    <td className="py-2 pr-4 font-medium" style={{ color: 'var(--t-text-primary)' }}>{r[0]}</td>
                    <td className="py-2 pr-4"><b className="text-green-700">{r[1]}</b></td>
                    <td className="py-2">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--t-text-muted)' }}>Quando a Jessica atua direto na venda, recebe 15% como vendedora (em vez do override de 5%).</p>
        </Secao>

        <Secao titulo="🏆 Bônus Trimestral — Programa Acelerador (trimestres a partir de maio)">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ['100% da meta', '15 contratos', 'R$ 400,00', '#2563eb'],
              ['150% da meta', '22 contratos', 'R$ 600,00', '#d97706'],
              ['200% da meta', '30 contratos', 'R$ 1.000,00', '#16a34a'],
            ].map(([t, c, p, cor]) => (
              <div key={t} className="rounded-xl border p-4 text-center" style={{ borderColor: cor as string }}>
                <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{t}</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--t-text-primary)' }}>{c}</p>
                <p className="text-2xl font-extrabold mt-1" style={{ color: cor as string }}>{p}</p>
              </div>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--t-text-muted)' }}>O acompanhamento ao vivo do bônus está na aba <b>Comissões</b> (card "Bônus Trimestral — Acelerador").</p>
        </Secao>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Secao titulo="📊 Indicadores de Desempenho (mensal)">
            <div>
              {['Leads gerados','Apresentações','Taxa de conversão','Contratos fechados','Receita de setup','MRR','Upgrades','Comunicação entre Lojas','PAC','TEF','Auditorias Tributárias'].map(i => <Pill key={i}>{i}</Pill>)}
            </div>
          </Secao>

          <Secao titulo="🎯 Objetivos 2026">
            <ul className="text-sm space-y-1.5 list-disc list-inside" style={{ color: 'var(--t-text-secondary)' }}>
              <li>Aumentar a base de clientes ativos e o ticket médio.</li>
              <li>Melhorar a taxa de conversão e a previsibilidade.</li>
              <li>Expandir serviços complementares; reduzir dependência de indicações.</li>
              <li>Criar uma máquina comercial escalável.</li>
              <li>Tornar a Prosystem referência em gestão p/ farmácias, manipulação, padarias e varejo.</li>
            </ul>
          </Secao>
        </div>
      </div>
    </DashboardLayout>
  );
}
