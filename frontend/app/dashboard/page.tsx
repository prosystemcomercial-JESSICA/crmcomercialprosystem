'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  RefreshCw, AlertTriangle, TrendingUp, TrendingDown,
  DollarSign, FileCheck2, BarChart3, Star, Target,
  Percent, FileText, Headphones, Activity,
} from 'lucide-react';

interface DashboardPower {
  kpis: {
    mrr: number; mrr_delta: number; leads_mes: number;
    leads_ganhos_mes: number; leads_ganhos_mes_anterior: number;
    taxa_conversao: number; contratos_ativos: number; contratos_mes: number;
    propostas_abertas: number; propostas_aceitas_mes: number;
    pipeline_valor: number; tickets_abertos: number; tickets_criticos: number;
    renovacoes_criticas: number; hs_criticos: number; nps_score: number | null;
  };
  pipeline_funil: { etapa: string; count: number; valor: number }[];
  top_leads: {
    id: string; nome: string; empresa?: string; valor_estimado: number;
    probabilidade: number; etapa_funil: string; temperatura: string; valor_ponderado: number;
  }[];
  agenda_hoje: {
    id: string; tipo: string; titulo: string; data_prevista: string;
    lead?: { nome: string };
  }[];
  atividades_atrasadas: {
    id: string; tipo: string; titulo: string; data_prevista: string;
    lead?: { nome: string; empresa?: string };
  }[];
  alertas: {
    atividades_atrasadas: number; atividades_hoje: number;
    tickets_criticos: number; renovacoes_criticas: number; hs_em_risco: number;
  };
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v);

const ETAPA_LABEL: Record<string, string> = {
  PROSPECCAO: 'Prospecção', QUALIFICACAO: 'Qualificação',
  APRESENTACAO: 'Apresentação', PROPOSTA: 'Proposta',
  NEGOCIACAO: 'Negociação', FECHAMENTO: 'Fechamento',
};

const TIPO_LABEL: Record<string, { icon: string; color: string }> = {
  LIGACAO:  { icon: '📞', color: '#4B8EC8' },
  EMAIL:    { icon: '✉️', color: '#6AAAE5' },
  REUNIAO:  { icon: '🤝', color: '#2E6EAB' },
  VISITA:   { icon: '🚗', color: '#1A4E82' },
  FOLLOW_UP:{ icon: '🔔', color: '#F59E0B' },
  PROPOSTA: { icon: '📄', color: '#8B5CF6' },
  OUTRO:    { icon: '📌', color: '#6B7280' },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#4B8EC8' }}>
      {children}
    </p>
  );
}

function PsCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-xl ${className}`}
      style={{ border: '1px solid #D8E8F5', boxShadow: '0 1px 3px rgba(13,34,56,0.06)' }}
    >
      {children}
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, accent = '#4B8EC8', delta,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: string; delta?: number;
}) {
  return (
    <PsCard className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}15` }}
        >
          <Icon size={17} style={{ color: accent }} />
        </div>
        {delta !== undefined && (
          <span
            className="flex items-center gap-0.5 text-xs font-semibold"
            style={{ color: delta >= 0 ? '#16a34a' : '#dc2626' }}
          >
            {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#7AAACB' }}>
        {label}
      </p>
      <p className="text-2xl font-extrabold tracking-tight" style={{ color: '#0D2238' }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: '#4B7A9C' }}>
          {sub}
        </p>
      )}
    </PsCard>
  );
}

export default function DashboardPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardPower | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadData = () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    apiClient.getDashboardPower()
      .then(res => { setData(res.data.data); setLastUpdate(new Date()); })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadData(); }, [isAuthenticated]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0D2238' }}>
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4B8EC8', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const maxPipelineVal = data ? Math.max(...data.pipeline_funil.map(p => p.valor), 1) : 1;
  const totalAlertas = data
    ? data.alertas.atividades_atrasadas + data.alertas.tickets_criticos +
      data.alertas.renovacoes_criticas + data.alertas.hs_em_risco
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-7">

        {/* ── Page Header ───────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: '#0D2238' }}>
              Dashboard Executivo
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#7AAACB' }}>
              Visão 360° do negócio
              {lastUpdate && (
                <span className="ml-2 text-xs" style={{ color: '#4B7A9C' }}>
                  · atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={dataLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #4B8EC8 0%, #2E6EAB 100%)', boxShadow: '0 4px 12px rgba(75,142,200,0.25)' }}
          >
            <RefreshCw size={14} className={dataLoading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* ── Loading ───────────────────────────────────────── */}
        {dataLoading && !data ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4B8EC8', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#7AAACB' }}>Carregando dados...</p>
          </div>
        ) : !data ? (
          <div className="text-center py-20" style={{ color: '#7AAACB' }}>Erro ao carregar dados.</div>
        ) : (
          <>
            {/* ── Alertas ─────────────────────────────────────── */}
            {totalAlertas > 0 && (
              <div
                className="flex items-center gap-4 px-5 py-3 rounded-xl flex-wrap"
                style={{ background: '#FFFBEB', border: '1px solid #FCD34D' }}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} style={{ color: '#B45309' }} />
                  <span className="text-sm font-semibold" style={{ color: '#92400E' }}>Atenção necessária:</span>
                </div>
                {data.alertas.atividades_atrasadas > 0 && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>
                    {data.alertas.atividades_atrasadas} atividade{data.alertas.atividades_atrasadas > 1 ? 's' : ''} atrasada{data.alertas.atividades_atrasadas > 1 ? 's' : ''}
                  </span>
                )}
                {data.alertas.tickets_criticos > 0 && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                    {data.alertas.tickets_criticos} ticket{data.alertas.tickets_criticos > 1 ? 's' : ''} crítico{data.alertas.tickets_criticos > 1 ? 's' : ''}
                  </span>
                )}
                {data.alertas.renovacoes_criticas > 0 && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#FFEDD5', color: '#9A3412' }}>
                    {data.alertas.renovacoes_criticas} renovaç{data.alertas.renovacoes_criticas > 1 ? 'ões' : 'ão'} urgente{data.alertas.renovacoes_criticas > 1 ? 's' : ''}
                  </span>
                )}
                {data.alertas.hs_em_risco > 0 && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#EDE9FE', color: '#5B21B6' }}>
                    {data.alertas.hs_em_risco} cliente{data.alertas.hs_em_risco > 1 ? 's' : ''} em risco
                  </span>
                )}
              </div>
            )}

            {/* ── KPIs Financeiro ─────────────────────────────── */}
            <div>
              <SectionLabel>Financeiro & Contratos</SectionLabel>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="MRR" value={fmt(data.kpis.mrr)}
                  sub={`${data.kpis.contratos_ativos} contratos ativos`}
                  icon={DollarSign} delta={data.kpis.mrr_delta} accent="#16a34a" />
                <KpiCard label="Contratos Ativos" value={fmtNum(data.kpis.contratos_ativos)}
                  sub={`+${data.kpis.contratos_mes} este mês`} icon={FileCheck2} accent="#4B8EC8" />
                <KpiCard label="Pipeline Total" value={fmt(data.kpis.pipeline_valor)}
                  sub="valor estimado em aberto" icon={BarChart3} accent="#6366F1" />
                <KpiCard
                  label="NPS Score"
                  value={data.kpis.nps_score !== null ? data.kpis.nps_score : '—'}
                  sub={data.kpis.nps_score !== null
                    ? (data.kpis.nps_score >= 50 ? 'Excelente' : data.kpis.nps_score >= 0 ? 'Bom' : 'Crítico')
                    : 'sem respostas'}
                  icon={Star}
                  accent={data.kpis.nps_score !== null
                    ? (data.kpis.nps_score >= 50 ? '#16a34a' : data.kpis.nps_score >= 0 ? '#d97706' : '#dc2626')
                    : '#9CA3AF'}
                />
              </div>
            </div>

            {/* ── KPIs Comercial ──────────────────────────────── */}
            <div>
              <SectionLabel>Comercial</SectionLabel>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Leads no Mês" value={fmtNum(data.kpis.leads_mes)}
                  sub={`${data.kpis.leads_ganhos_mes} ganhos`} icon={Target} accent="#4B8EC8" />
                <KpiCard label="Taxa de Conversão" value={`${data.kpis.taxa_conversao}%`}
                  sub={`anterior: ${data.kpis.leads_ganhos_mes_anterior} ganhos`}
                  icon={Percent}
                  accent={data.kpis.taxa_conversao >= 20 ? '#16a34a' : '#d97706'} />
                <KpiCard label="Propostas Abertas" value={fmtNum(data.kpis.propostas_abertas)}
                  sub={`${data.kpis.propostas_aceitas_mes} aceitas este mês`} icon={FileText} accent="#8B5CF6" />
                <KpiCard label="Tickets em Aberto" value={fmtNum(data.kpis.tickets_abertos)}
                  sub={data.kpis.tickets_criticos > 0 ? `${data.kpis.tickets_criticos} críticos` : 'Nenhum crítico'}
                  icon={Headphones}
                  accent={data.kpis.tickets_criticos > 0 ? '#dc2626' : '#4B8EC8'} />
              </div>
            </div>

            {/* ── Pipeline + Top Leads ────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              <PsCard className="p-5">
                <h2 className="text-sm font-bold mb-4" style={{ color: '#0D2238' }}>
                  Pipeline por Etapa
                </h2>
                <div className="space-y-3.5">
                  {data.pipeline_funil.map(p => {
                    const widthPct = maxPipelineVal > 0 ? (p.valor / maxPipelineVal) * 100 : 0;
                    return (
                      <div key={p.etapa}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium" style={{ color: '#0D2238' }}>
                            {ETAPA_LABEL[p.etapa] || p.etapa}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold" style={{ color: '#0D2238' }}>{fmt(p.valor)}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ background: '#EBF4FF', color: '#2E6EAB' }}>
                              {p.count}
                            </span>
                          </div>
                        </div>
                        <div className="w-full rounded-full h-1.5" style={{ background: '#EBF4FF' }}>
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${Math.max(widthPct, p.valor > 0 ? 3 : 0)}%`, background: 'linear-gradient(90deg, #4B8EC8, #2E6EAB)' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {data.pipeline_funil.every(p => p.count === 0) && (
                    <p className="text-xs text-center py-4" style={{ color: '#7AAACB' }}>Nenhum lead ativo no funil</p>
                  )}
                </div>
              </PsCard>

              <PsCard className="p-5">
                <h2 className="text-sm font-bold mb-4" style={{ color: '#0D2238' }}>
                  Top 5 Leads por Valor Ponderado
                </h2>
                {data.top_leads.length === 0 ? (
                  <p className="text-xs text-center py-8" style={{ color: '#7AAACB' }}>Nenhum lead com valor estimado</p>
                ) : (
                  <div className="space-y-3">
                    {data.top_leads.map((l, i) => (
                      <div key={l.id} className="flex items-center gap-3">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                          style={{ background: i === 0 ? '#4B8EC8' : i === 1 ? '#6AAAE5' : '#90BEF0' }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: '#0D2238' }}>{l.nome}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {l.empresa && <span className="text-xs truncate" style={{ color: '#7AAACB' }}>{l.empresa}</span>}
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                              style={{
                                background: l.temperatura === 'QUENTE' ? '#FEE2E2'
                                  : l.temperatura === 'MORNO' ? '#FEF3C7' : '#EBF4FF',
                                color: l.temperatura === 'QUENTE' ? '#991B1B'
                                  : l.temperatura === 'MORNO' ? '#92400E' : '#1A4E82',
                              }}
                            >
                              {l.temperatura}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-extrabold" style={{ color: '#16a34a' }}>{fmt(l.valor_ponderado)}</p>
                          <p className="text-[10px]" style={{ color: '#7AAACB' }}>{l.probabilidade}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PsCard>
            </div>

            {/* ── Agenda + Atrasadas ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              <PsCard>
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #EBF4FF' }}>
                  <h2 className="text-sm font-bold" style={{ color: '#0D2238' }}>Agenda de Hoje</h2>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: '#EBF4FF', color: '#2E6EAB' }}
                  >
                    {data.alertas.atividades_hoje} atividade{data.alertas.atividades_hoje !== 1 ? 's' : ''}
                  </span>
                </div>
                {data.agenda_hoje.length === 0 ? (
                  <p className="p-8 text-center text-xs" style={{ color: '#7AAACB' }}>Nenhuma atividade para hoje</p>
                ) : (
                  <div>
                    {data.agenda_hoje.map(a => {
                      const t = TIPO_LABEL[a.tipo] || { icon: '📌', color: '#6B7280' };
                      return (
                        <div key={a.id} className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #F4F7FB' }}>
                          <span className="text-base flex-shrink-0">{t.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: '#0D2238' }}>{a.titulo}</p>
                            {a.lead?.nome && <p className="text-xs truncate" style={{ color: '#7AAACB' }}>{a.lead.nome}</p>}
                          </div>
                          <span className="text-xs font-medium flex-shrink-0" style={{ color: '#4B8EC8' }}>
                            {new Date(a.data_prevista).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </PsCard>

              <PsCard>
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #EBF4FF' }}>
                  <h2 className="text-sm font-bold" style={{ color: '#0D2238' }}>Atividades Atrasadas</h2>
                  {data.alertas.atividades_atrasadas > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                      {data.alertas.atividades_atrasadas} pendente{data.alertas.atividades_atrasadas !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {data.atividades_atrasadas.length === 0 ? (
                  <p className="p-8 text-center text-xs font-semibold" style={{ color: '#16a34a' }}>✅ Nenhuma atividade atrasada</p>
                ) : (
                  <div>
                    {data.atividades_atrasadas.map(a => {
                      const t = TIPO_LABEL[a.tipo] || { icon: '📌', color: '#6B7280' };
                      const dias = Math.floor((Date.now() - new Date(a.data_prevista).getTime()) / 86400000);
                      return (
                        <div key={a.id} className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #F4F7FB' }}>
                          <span className="text-base flex-shrink-0">{t.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: '#0D2238' }}>{a.titulo}</p>
                            {a.lead && (
                              <p className="text-xs truncate" style={{ color: '#7AAACB' }}>
                                {a.lead.nome}{a.lead.empresa ? ` · ${a.lead.empresa}` : ''}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: '#dc2626' }}>
                            {dias === 0 ? 'hoje' : `${dias}d`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </PsCard>
            </div>

            {/* ── Saúde dos Clientes ──────────────────────────── */}
            <PsCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold" style={{ color: '#0D2238' }}>Saúde dos Clientes</h2>
                <a href="/health-score" className="text-xs font-semibold" style={{ color: '#4B8EC8' }}>
                  Ver todos →
                </a>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Críticos', value: data.kpis.hs_criticos, bg: '#FEF2F2', color: '#991B1B', accent: '#dc2626' },
                  { label: 'Em Risco', value: Math.max(0, data.alertas.hs_em_risco - data.kpis.hs_criticos), bg: '#FFFBEB', color: '#92400E', accent: '#d97706' },
                  { label: 'Renovações Urgentes', value: data.kpis.renovacoes_criticas, bg: '#FFF7ED', color: '#9A3412', accent: '#ea580c' },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="text-center p-4 rounded-xl"
                    style={{ background: stat.bg }}
                  >
                    <p className="text-3xl font-extrabold" style={{ color: stat.accent }}>{stat.value}</p>
                    <p className="text-xs font-medium mt-1" style={{ color: stat.color }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </PsCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
