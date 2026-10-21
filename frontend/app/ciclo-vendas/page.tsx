'use client';

// Ciclo de vendas real (21/10/2026): parte dos contratos do módulo de contratos (desde junho/2026), liga cada um à
// proposta e à entrada do lead ou da conversa, e separa os contratos lançados no mesmo dia da venda (sem histórico).
// Antes olhava os 1.000 leads mais novos e só contava "fechado" quem tinha fechamento_data no lead.

import { useEffect, useState } from 'react';
import { useAuth, useRequireGestorRedirect } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';

type Etapa = { etapa: string; dias_medio: number; mediana: number | null; amostras: number };
type Contrato = { empresa: string; data_contrato: string; mensalidade: number; entrada_ate_proposta: number | null; proposta_ate_aceite: number | null; proposta_ate_contrato: number | null; entrada_ate_contrato: number | null; sem_historico: boolean };
type Ciclo = {
  total_contratos: number; com_historico: number; sem_historico: number; ciclo_mediana_dias: number | null; ciclo_medio_dias: number; ciclo_min: number; ciclo_max: number;
  tempo_medio_por_etapa: Etapa[]; propostas_abertas: { quantidade: number; idade_mediana: number | null; ate_15_dias: number; mais_de_45: number }; contratos: Contrato[];
};

const card = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 14, padding: 16 } as const;
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', whiteSpace: 'nowrap' } as const;
const td = { padding: '8px 10px', fontSize: 13, color: 'var(--t-text-secondary)' } as const;
const tdN = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } as const;
const dias = (v: number | null) => (v == null ? '–' : `${v} d`);
const dataBr = (s: string) => s.split('-').reverse().join('/');

export default function CicloVendasPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { blocked } = useRequireGestorRedirect();
  const [d, setD] = useState<Ciclo | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);
  useEffect(() => {
    if (!isAuthenticated || blocked) return;
    apiClient.getCicloVendas().then(r => { setD(r.data.data); setEstado('ok'); }).catch(() => setEstado('erro'));
  }, [isAuthenticated, blocked]);

  if (loading || !isAuthenticated || blocked) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;

  const maxEtapa = Math.max(1, ...(d?.tempo_medio_por_etapa || []).map(e => e.mediana ?? e.dias_medio));

  return (
    <DashboardLayout>
      <div className="ios-tela" style={{ display: 'grid', gap: 14, paddingBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 className="ios-large-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>Ciclo de Vendas</h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)', maxWidth: 820 }}>Quanto tempo vai da entrada do lead até a proposta e até o contrato, medido nos contratos assinados desde junho de 2026.</p>
          </div>
          {d && (
            <ExportButton nome="ciclo-de-vendas" titulo="Ciclo de Vendas: ProSystem CRM" linhas={d.contratos}
              colunas={[
                { header: 'Empresa', value: (c: any) => c.empresa }, { header: 'Contrato', value: (c: any) => dataBr(c.data_contrato) },
                { header: 'Entrada → proposta (dias)', value: (c: any) => c.entrada_ate_proposta ?? '' }, { header: 'Proposta → contrato (dias)', value: (c: any) => c.proposta_ate_contrato ?? '' },
                { header: 'Entrada → contrato (dias)', value: (c: any) => c.entrada_ate_contrato ?? '' }, { header: 'Sem histórico', value: (c: any) => (c.sem_historico ? 'sim' : 'não') },
              ]} />
          )}
        </div>

        {estado === 'carregando' && <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Calculando…</p>}
        {estado === 'erro' && <p style={{ fontSize: 13, color: '#dc2626' }}>Não foi possível calcular o ciclo agora.</p>}

        {d && (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            {[
              ['Ciclo típico (mediana)', d.ciclo_mediana_dias != null ? `${d.ciclo_mediana_dias} dias` : '–', 'entrada → contrato'],
              ['Média', `${d.ciclo_medio_dias} dias`, `de ${d.ciclo_min} a ${d.ciclo_max} dias`],
              ['Contratos medidos', `${d.com_historico} de ${d.total_contratos}`, `${d.sem_historico} lançados no dia da venda, sem histórico`],
              ['Propostas abertas', String(d.propostas_abertas.quantidade), `paradas há ${d.propostas_abertas.idade_mediana ?? '–'} dias (mediana)`],
            ].map(([r, v, s]) => (
              <div key={r} style={card}>
                <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{r}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{s}</div>
              </div>
            ))}
          </div>

          <section style={{ ...card, display: 'grid', gap: 10 }} aria-label="Tempo por etapa">
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)' }}>Tempo por etapa</h2>
            {d.tempo_medio_por_etapa.map(e => (
              <div key={e.etapa} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 200px) 1fr 150px', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--t-text-primary)', fontWeight: 600 }}>{e.etapa}</span>
                <div style={{ background: 'var(--t-card-border)', borderRadius: 4, height: 10 }} aria-hidden>
                  <div style={{ width: `${((e.mediana ?? e.dias_medio) / maxEtapa) * 100}%`, height: 10, borderRadius: 4, background: '#1d4ed8' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', textAlign: 'right' }}>mediana {dias(e.mediana)} · média {e.dias_medio} d · {e.amostras} contrato(s)</span>
              </div>
            ))}
            <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
              Amostra pequena: só entram contratos com entrada do lead registrada antes da venda. Para o ciclo ficar mais preciso, a proposta precisa ser criada no CRM quando é enviada, e o contrato no dia da assinatura.
            </p>
          </section>

          <section style={{ ...card, display: 'grid', gap: 10 }} aria-label="Contratos">
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--t-text-primary)' }}>Contratos medidos</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead><tr><th style={th}>Empresa</th><th style={th}>Contrato</th><th style={{ ...th, textAlign: 'right' }}>Entrada → proposta</th><th style={{ ...th, textAlign: 'right' }}>Proposta → contrato</th><th style={{ ...th, textAlign: 'right' }}>Entrada → contrato</th><th style={th}>Observação</th></tr></thead>
                <tbody>
                  {d.contratos.map((c, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--t-card-border)', opacity: c.sem_historico ? 0.6 : 1 }}>
                      <td style={{ ...td, fontWeight: 600, color: 'var(--t-text-primary)' }}>{c.empresa}</td>
                      <td style={td}>{dataBr(c.data_contrato)}</td>
                      <td style={tdN}>{dias(c.entrada_ate_proposta)}</td>
                      <td style={tdN}>{dias(c.proposta_ate_contrato)}</td>
                      <td style={tdN}>{dias(c.entrada_ate_contrato)}</td>
                      <td style={td}>{c.sem_historico ? 'lançado no dia da venda' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>)}
      </div>
    </DashboardLayout>
  );
}
