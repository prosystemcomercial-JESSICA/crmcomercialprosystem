'use client';

// Previsão de fechamento com dados concretos (21/10/2026): propostas comerciais vivas (chance pelo status e pela idade)
// e leads quentes/mornos do Analista de Resultados, com meta e realizado pelo módulo de contratos.
// Antes somava os leads pela etapa do kanban, quase todos sem valor; ver backend/src/lib/previsao-fechamento.ts.

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

type Cenario = { pessimista: number; realista: number; otimista: number };
type Item = { origem: 'proposta' | 'lead'; empresa: string; status: string; probabilidade: number; mensalidade: number; implantacao: number; dias: number | null; vendedor: string | null; link: string | null };
type Previsao = {
  gerado_em: string;
  resumo: { contratos: Cenario; mensalidade: Cenario; implantacao_realista: number };
  meta: { periodo: string; contratos: number | null; realizados: number; mensalidade_realizada: number; faltam: number | null; meta_em_reais_ignorada: boolean };
  taxa_historica: { ganhas: number; perdidas: number; pct: number | null };
  ticket_medio: { mensalidade: number; implantacao: number; contratos: number };
  por_origem: { propostas: number; leads: number };
  itens: Item[];
};

const brl = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;
const STATUS: Record<string, string> = {
  ENVIADA: 'Enviada', VISUALIZADA: 'Visualizada', EXPIRADA: 'Expirada', RASCUNHO: 'Rascunho', ACEITA: 'Aceita',
  CONTRATO_EM_GERACAO: 'Contrato em geração', CONTRATO_ENVIADO: 'Contrato enviado', QUENTE: 'Lead quente', MORNO: 'Lead morno',
};
const card = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 16 } as const;
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', whiteSpace: 'nowrap' } as const;
const td = { padding: '8px 10px', fontSize: 13, color: 'var(--t-text-secondary)' } as const;
const tdN = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } as const;

export default function PrevisaoPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [d, setD] = useState<Previsao | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);
  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.getPrevisao().then(r => { setD(r.data.data); setEstado('ok'); }).catch(() => setEstado('erro'));
  }, [isAuthenticated]);

  if (loading || !isAuthenticated) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;

  const meta = d?.meta;
  const pctMeta = meta?.contratos ? Math.min(100, Math.round((meta.realizados / meta.contratos) * 100)) : 0;

  return (
    <DashboardLayout>
      <div className="ios-tela" style={{ display: 'grid', gap: 14, paddingBottom: 32 }}>
        <div>
          <h1 className="ios-large-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>Previsão de Fechamento</h1>
          <p style={{ fontSize: 13, color: 'var(--t-text-muted)', maxWidth: 820 }}>
            Quantos contratos devem fechar a partir das propostas abertas (chance pelo status e pelos dias desde o envio) e dos leads quentes e mornos lidos pelo Analista de Resultados. Meta e realizado vêm do módulo de contratos.
          </p>
        </div>

        {estado === 'carregando' && <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Calculando…</p>}
        {estado === 'erro' && <p style={{ fontSize: 13, color: '#dc2626' }}>Não foi possível calcular a previsão agora.</p>}

        {d && meta && (<>
          <section style={{ ...card, display: 'grid', gap: 10 }} aria-label="Meta do mês">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)' }}>Meta de contratos · {meta.periodo.split('-').reverse().join('/')}</h2>
              {meta.contratos != null && <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{meta.realizados} de {meta.contratos} ({pctMeta}%)</span>}
            </div>
            {meta.contratos != null ? (
              <div style={{ background: 'var(--t-card-border)', borderRadius: 6, height: 12 }} aria-hidden>
                <div style={{ width: `${pctMeta}%`, height: 12, borderRadius: 6, background: pctMeta >= 100 ? '#16a34a' : '#1d4ed8' }} />
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#b45309' }}>
                Sem meta de contratos válida para o mês{meta.meta_em_reais_ignorada ? ' (a meta cadastrada parece estar em reais, não em número de contratos; corrija em Metas)' : ''}.
              </p>
            )}
            <p style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>
              Realizado no mês: <b>{meta.realizados} contrato(s)</b>, {brl(meta.mensalidade_realizada)}/mês.
              {meta.faltam != null && <> Faltam <b>{meta.faltam}</b>; a previsão realista abaixo é de <b>{d.resumo.contratos.realista}</b>.</>}
            </p>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {([['Pessimista', 'só chance de 40% ou mais', 'pessimista', '#b45309'], ['Realista', 'soma ponderada pela chance', 'realista', '#16a34a'], ['Otimista', 'tudo com chance de 15% ou mais', 'otimista', '#7c3aed']] as const).map(([rot, desc, k, cor]) => (
              <div key={k} style={{ ...card, borderTop: `3px solid ${cor}` }}>
                <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{rot} · {desc}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums' }}>{d.resumo.contratos[k]} contratos</div>
                <div style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{brl(d.resumo.mensalidade[k])}/mês</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
            Base: {d.por_origem.propostas} propostas abertas e {d.por_origem.leads} leads quentes ou mornos sem proposta (valor pelo ticket médio de {d.ticket_medio.contratos} contratos em 180 dias: {brl(d.ticket_medio.mensalidade)}/mês e {brl(d.ticket_medio.implantacao)} de implantação). Implantação esperada (realista): {brl(d.resumo.implantacao_realista)}.
            {d.taxa_historica.pct != null && <> Das propostas de 180 dias com desfecho, {d.taxa_historica.pct}% viraram contrato ({d.taxa_historica.ganhas} de {d.taxa_historica.ganhas + d.taxa_historica.perdidas}).</>}
          </p>

          <section style={{ ...card, display: 'grid', gap: 10 }} aria-label="Oportunidades">
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)' }}>Oportunidades, da maior chance para a menor</h2>
            {d.itens.length === 0 ? <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma proposta aberta nem lead quente agora.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                  <thead><tr><th style={th}>Empresa</th><th style={th}>Situação</th><th style={{ ...th, textAlign: 'right' }}>Chance</th><th style={{ ...th, textAlign: 'right' }}>Mensalidade</th><th style={{ ...th, textAlign: 'right' }}>Implantação</th><th style={{ ...th, textAlign: 'right' }}>Dias</th><th style={th}>Vendedor</th></tr></thead>
                  <tbody>
                    {d.itens.map((i, n) => (
                      <tr key={n} style={{ borderTop: '1px solid var(--t-card-border)' }}>
                        <td style={{ ...td, fontWeight: 600 }}>{i.link ? <a href={i.link} style={{ color: 'var(--t-link)' }}>{i.empresa}</a> : i.empresa}</td>
                        <td style={td}>{STATUS[i.status] || i.status}{i.origem === 'lead' ? ' (sem proposta)' : ''}</td>
                        <td style={{ ...tdN, fontWeight: 700, color: i.probabilidade >= 40 ? '#16a34a' : i.probabilidade >= 15 ? '#b45309' : 'var(--t-text-muted)' }}>{i.probabilidade}%</td>
                        <td style={tdN}>{brl(i.mensalidade)}{i.origem === 'lead' ? '*' : ''}</td>
                        <td style={tdN}>{i.implantacao ? brl(i.implantacao) : '–'}</td>
                        <td style={tdN}>{i.dias ?? '–'}</td>
                        <td style={td}>{i.vendedor || '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>* lead sem proposta: valor pelo ticket médio. Dias = desde o envio da proposta ou desde a última resposta do lead.</p>
          </section>
        </>)}
      </div>
    </DashboardLayout>
  );
}
