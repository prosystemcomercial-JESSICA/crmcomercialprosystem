'use client';

import { useEffect, useState } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  RefreshCw, AlertTriangle, TrendingUp, TrendingDown,
  DollarSign, FileCheck2, BarChart3, Star, Target,
  Percent, FileText, Headphones, Activity, XCircle,
  Flame, Thermometer, Snowflake, CheckCircle2, ClipboardList,
} from 'lucide-react';

interface DashboardPower {
  kpis: {
    mrr: number; mrr_delta: number; leads_mes: number;
    leads_ganhos_mes: number; leads_ganhos_mes_anterior: number;
    leads_perdidos_mes: number; leads_perdidos_mes_anterior: number;
    valor_perdido_mes: number;
    taxa_conversao: number; contratos_ativos: number; contratos_mes: number;
    propostas_abertas: number; propostas_aceitas_mes: number;
    pipeline_valor: number; tickets_abertos: number; tickets_criticos: number;
    renovacoes_criticas: number; hs_criticos: number; nps_score: number | null;
  };
  ranking_motivos_perda: { motivo: string; total: number; valor_total: number; pct: number }[];
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
  pipeline_propostas: {
    total: number;
    fechado: { count: number; mrr: number; setup: number };
    quente:  { count: number; mrr: number; setup: number };
    morno:   { count: number; mrr: number; setup: number };
    frio:    { count: number; mrr: number; setup: number };
    perdido: { count: number };
  };
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
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardPower | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Painel executivo é só de gestão. Vendedor é levado ao seu Radar Comercial.
  const isGestor = podeVerTudo(user?.role);

  // Filtro por vendedor (gestor): '' = todos
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([]);
  const [filtroVendedorId, setFiltroVendedorId] = useState('');
  useEffect(() => {
    if (isGestor) apiClient.getVendedores().then(r => setVendedores(r.data?.data || [])).catch(() => {});
  }, [isGestor]);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (!loading && isAuthenticated && user && !isGestor) router.replace('/comercial');
  }, [loading, isAuthenticated, user, isGestor, router]);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = () => {
    if (!isAuthenticated || !isGestor) return;  // vendedor não chama o /dashboard/power
    setDataLoading(true);
    setLoadError(null);
    apiClient.getDashboardPower(filtroVendedorId || undefined)
      .then(res => { setData(res.data.data); setLastUpdate(new Date()); })
      .catch((err) => {
        console.error('[Dashboard] erro:', err);
        const msg = err?.response?.data?.message || err?.message || 'Erro desconhecido';
        setLoadError(msg);
      })
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadData(); }, [isAuthenticated, isGestor, filtroVendedorId]);

  // Enquanto carrega, não autenticado, ou redirecionando vendedor → spinner.
  if (loading || !isAuthenticated || (user && !isGestor)) {
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
          <div className="flex items-center gap-2">
            {vendedores.length > 0 && (
              <select
                value={filtroVendedorId}
                onChange={e => setFiltroVendedorId(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm border bg-white"
                style={{ borderColor: '#D8E8F5', color: '#0D2238' }}
                title="Filtrar por vendedor"
              >
                <option value="">👥 Todos os vendedores</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            )}
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
        </div>

        {/* ── Loading ───────────────────────────────────────── */}
        {dataLoading && !data ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4B8EC8', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: '#7AAACB' }}>Carregando dados...</p>
          </div>
        ) : !data ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: '32px 28px', textAlign: 'center', border: '1px solid #fca5a5', maxWidth: 560, margin: '40px auto' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <span style={{ fontSize: 28 }}>⚠️</span>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0D2238', marginBottom: 6 }}>Não foi possível carregar o dashboard</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              {loadError || 'Algum dado pode estar temporariamente indisponível.'}
            </p>
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 18 }}>
              <strong>Seus registros foram preservados</strong> — nenhuma informação foi perdida.
              Os dashboards apenas leem dados, não modificam.
            </p>
            <button onClick={loadData}
              style={{
                background: 'linear-gradient(135deg, #4B8EC8, #2E6EAB)',
                color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}>
              ↻ Tentar novamente
            </button>
          </div>
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

            {/* ── Pipeline de Propostas ──────────────────────── */}
            {data.pipeline_propostas && (
              <div>
                <SectionLabel>Pipeline de Propostas Comerciais</SectionLabel>

                {/* Overview KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <KpiCard
                    label="Total de Propostas"
                    value={fmtNum(data.pipeline_propostas.total)}
                    sub={`${data.pipeline_propostas.perdido.count} perdida${data.pipeline_propostas.perdido.count !== 1 ? 's' : ''}`}
                    icon={ClipboardList}
                    accent="#4B8EC8"
                  />
                  <KpiCard
                    label="MRR em Pipeline"
                    value={fmt(
                      data.pipeline_propostas.fechado.mrr +
                      data.pipeline_propostas.quente.mrr +
                      data.pipeline_propostas.morno.mrr +
                      data.pipeline_propostas.frio.mrr
                    )}
                    sub="mensalidades em negociação"
                    icon={DollarSign}
                    accent="#16a34a"
                  />
                  <KpiCard
                    label="SETUP em Pipeline"
                    value={fmt(
                      data.pipeline_propostas.fechado.setup +
                      data.pipeline_propostas.quente.setup +
                      data.pipeline_propostas.morno.setup +
                      data.pipeline_propostas.frio.setup
                    )}
                    sub="implantações em negociação"
                    icon={BarChart3}
                    accent="#7c3aed"
                  />
                  <KpiCard
                    label="Já Fechado"
                    value={fmt(data.pipeline_propostas.fechado.setup)}
                    sub={`MRR +${fmt(data.pipeline_propostas.fechado.mrr)}/mês · ${data.pipeline_propostas.fechado.count} prop.`}
                    icon={CheckCircle2}
                    accent="#15803d"
                  />
                </div>

                {/* Breakdown por temperatura */}
                <PsCard className="p-5">
                  <h2 className="text-sm font-bold mb-4" style={{ color: '#0D2238' }}>
                    Breakdown por Temperatura
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                    {/* Quente — Em Negociação */}
                    {[
                      {
                        label: 'Quente — A Fechar',
                        sub: 'Em Negociação',
                        icon: Flame,
                        data: data.pipeline_propostas.quente,
                        bg: '#FEF2F2',
                        border: '#FECACA',
                        accent: '#dc2626',
                        dot: '#ef4444',
                      },
                      {
                        label: 'Morno — Enviada',
                        sub: 'Aguardando retorno',
                        icon: Thermometer,
                        data: data.pipeline_propostas.morno,
                        bg: '#FFFBEB',
                        border: '#FDE68A',
                        accent: '#d97706',
                        dot: '#f59e0b',
                      },
                      {
                        label: 'Frio — Rascunho',
                        sub: 'Ainda não enviada',
                        icon: Snowflake,
                        data: data.pipeline_propostas.frio,
                        bg: '#EFF6FF',
                        border: '#BFDBFE',
                        accent: '#2563eb',
                        dot: '#3b82f6',
                      },
                    ].map(({ label, sub, icon: Icon, data: d, bg, border, accent, dot }) => (
                      <div
                        key={label}
                        className="rounded-xl p-4"
                        style={{ background: bg, border: `1px solid ${border}` }}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}20` }}>
                            <Icon size={14} style={{ color: accent }} />
                          </div>
                          <div>
                            <p className="text-xs font-bold" style={{ color: accent }}>{label}</p>
                            <p className="text-[10px]" style={{ color: `${accent}99` }}>{sub}</p>
                          </div>
                          <span
                            className="ml-auto text-xs font-extrabold px-2 py-0.5 rounded-full"
                            style={{ background: `${accent}18`, color: accent }}
                          >
                            {d.count}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium" style={{ color: '#6B7280' }}>MRR</span>
                            <span className="text-sm font-extrabold" style={{ color: accent }}>{fmt(d.mrr)}</span>
                          </div>
                          <div className="w-full h-px" style={{ background: border }} />
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium" style={{ color: '#6B7280' }}>SETUP</span>
                            <span className="text-sm font-extrabold" style={{ color: accent }}>{fmt(d.setup)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Barra visual de proporção */}
                  {(() => {
                    const total = data.pipeline_propostas.quente.count + data.pipeline_propostas.morno.count + data.pipeline_propostas.frio.count;
                    if (total === 0) return null;
                    const pctQ = Math.round((data.pipeline_propostas.quente.count / total) * 100);
                    const pctM = Math.round((data.pipeline_propostas.morno.count / total) * 100);
                    const pctF = 100 - pctQ - pctM;
                    return (
                      <div className="mt-4">
                        <div className="flex rounded-full overflow-hidden h-2">
                          {pctQ > 0 && <div style={{ width: `${pctQ}%`, background: '#ef4444' }} />}
                          {pctM > 0 && <div style={{ width: `${pctM}%`, background: '#f59e0b' }} />}
                          {pctF > 0 && <div style={{ width: `${pctF}%`, background: '#3b82f6' }} />}
                        </div>
                        <div className="flex items-center gap-4 mt-1.5">
                          {[
                            { color: '#ef4444', label: `Quente ${pctQ}%` },
                            { color: '#f59e0b', label: `Morno ${pctM}%` },
                            { color: '#3b82f6', label: `Frio ${pctF}%` },
                          ].map(({ color, label }) => (
                            <div key={label} className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                              <span className="text-[10px]" style={{ color: '#7AAACB' }}>{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </PsCard>
              </div>
            )}

            {/* ── Negócios Perdidos ───────────────────────────── */}
            <div>
              <SectionLabel>Negócios Perdidos</SectionLabel>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* KPIs de perda */}
                <KpiCard
                  label="Perdidos no Mês"
                  value={fmtNum(data.kpis.leads_perdidos_mes)}
                  sub={`anterior: ${data.kpis.leads_perdidos_mes_anterior}`}
                  icon={XCircle}
                  accent="#dc2626"
                  delta={data.kpis.leads_perdidos_mes_anterior > 0
                    ? Math.round(((data.kpis.leads_perdidos_mes - data.kpis.leads_perdidos_mes_anterior) / data.kpis.leads_perdidos_mes_anterior) * 100)
                    : undefined}
                />
                <KpiCard
                  label="Valor Perdido no Mês"
                  value={fmt(data.kpis.valor_perdido_mes)}
                  sub="oportunidades não convertidas"
                  icon={TrendingDown}
                  accent="#dc2626"
                />
                <KpiCard
                  label="Taxa de Perda"
                  value={`${data.kpis.leads_mes > 0 ? Math.round((data.kpis.leads_perdidos_mes / data.kpis.leads_mes) * 100) : 0}%`}
                  sub={`${data.kpis.leads_ganhos_mes} ganhos vs ${data.kpis.leads_perdidos_mes} perdidos`}
                  icon={Percent}
                  accent={data.kpis.leads_perdidos_mes > data.kpis.leads_ganhos_mes ? '#dc2626' : '#d97706'}
                />
              </div>

              {/* Ranking de motivos */}
              {data.ranking_motivos_perda && data.ranking_motivos_perda.length > 0 && (
                <PsCard className="mt-4 p-5">
                  <h2 className="text-sm font-bold mb-4" style={{ color: '#0D2238' }}>
                    Ranking de Motivos de Perda
                  </h2>
                  <div className="space-y-3">
                    {data.ranking_motivos_perda.map((item, i) => (
                      <div key={item.motivo}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                              style={{ background: i === 0 ? '#dc2626' : i === 1 ? '#ef4444' : i === 2 ? '#f87171' : '#fca5a5' }}
                            >
                              {i + 1}
                            </span>
                            <span className="text-xs font-medium truncate" style={{ color: '#0D2238' }}>{item.motivo}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            <span className="text-xs font-bold" style={{ color: '#dc2626' }}>
                              {item.total}x
                            </span>
                            <span className="text-xs" style={{ color: '#7AAACB' }}>
                              {fmt(item.valor_total)}
                            </span>
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full w-10 text-center"
                              style={{ background: '#FEF2F2', color: '#991B1B' }}
                            >
                              {item.pct}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full rounded-full h-1.5" style={{ background: '#FEF2F2' }}>
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${item.pct}%`, background: 'linear-gradient(90deg, #dc2626, #ef4444)' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] mt-3" style={{ color: '#7AAACB' }}>
                    Baseado em todos os negócios perdidos registrados no funil comercial.
                  </p>
                </PsCard>
              )}
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

            {/* ── Minhas Atividades (unificado por prioridade + vencimento) ── */}
            {(() => {
              type Item = {
                id: string; tipo: string; titulo: string; data_prevista: string;
                lead?: { nome: string; empresa?: string };
                _atrasada: boolean;
              };
              const seen = new Set<string>();
              const merged: Item[] = [];
              data.atividades_atrasadas.forEach(a => { if (!seen.has(a.id)) { merged.push({ ...a, _atrasada: true }); seen.add(a.id); } });
              data.agenda_hoje.forEach(a => { if (!seen.has(a.id)) { merged.push({ ...a, _atrasada: false }); seen.add(a.id); } });

              const prioCfg = (it: Item) => {
                if (it._atrasada) return { label: 'Atrasada',           cor: '#dc2626', bg: '#FEE2E2', ordem: 0 };
                const hoje = new Date(); hoje.setHours(0,0,0,0);
                const prazo = new Date(it.data_prevista);
                const dias = Math.floor((prazo.getTime() - hoje.getTime()) / 86400000);
                if (dias < 0)  return { label: 'Atrasada',          cor: '#dc2626', bg: '#FEE2E2', ordem: 0 };
                if (dias <= 3) return { label: 'Prioridade máxima', cor: '#ea580c', bg: '#FFEDD5', ordem: 1 };
                if (dias <= 7) return { label: 'Próxima',           cor: '#d97706', bg: '#FEF3C7', ordem: 2 };
                return                  { label: 'Dentro do prazo', cor: '#16a34a', bg: '#DCFCE7', ordem: 3 };
              };

              const ordered = merged
                .map(it => ({ it, cfg: prioCfg(it) }))
                .sort((a, b) => {
                  const o = a.cfg.ordem - b.cfg.ordem;
                  if (o !== 0) return o;
                  return new Date(a.it.data_prevista).getTime() - new Date(b.it.data_prevista).getTime();
                });

              const totais = {
                atrasadas: ordered.filter(o => o.cfg.label === 'Atrasada').length,
                maxima:    ordered.filter(o => o.cfg.label === 'Prioridade máxima').length,
              };

              return (
                <PsCard>
                  <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #EBF4FF' }}>
                    <div>
                      <h2 className="text-sm font-bold" style={{ color: '#0D2238' }}>Minhas Atividades</h2>
                      <p className="text-[10px] mt-0.5" style={{ color: '#7AAACB' }}>
                        Ordenadas por prioridade automática e vencimento
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {totais.atrasadas > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                          {totais.atrasadas} atrasada{totais.atrasadas !== 1 ? 's' : ''}
                        </span>
                      )}
                      {totais.maxima > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#FFEDD5', color: '#9A3412' }}>
                          {totais.maxima} expirando
                        </span>
                      )}
                      <a href="/atividades" className="text-xs font-semibold" style={{ color: '#4B8EC8' }}>Ver todas →</a>
                    </div>
                  </div>
                  {ordered.length === 0 ? (
                    <p className="p-8 text-center text-xs font-semibold" style={{ color: '#16a34a' }}>✅ Sem atividades urgentes</p>
                  ) : (
                    <div>
                      {ordered.slice(0, 10).map(({ it, cfg }) => {
                        const t = TIPO_LABEL[it.tipo] || { icon: '📌', color: '#6B7280' };
                        const hoje = new Date(); hoje.setHours(0,0,0,0);
                        const prazo = new Date(it.data_prevista);
                        const dias = Math.floor((prazo.getTime() - hoje.getTime()) / 86400000);
                        const diasLabel = dias < 0 ? `${Math.abs(dias)}d atrasada` : dias === 0 ? 'hoje' : `em ${dias}d`;
                        return (
                          <a key={it.id} href="/atividades"
                            className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                            style={{ borderBottom: '1px solid #F4F7FB', borderLeft: `3px solid ${cfg.cor}` }}>
                            <span className="text-base flex-shrink-0">{t.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium truncate" style={{ color: '#0D2238' }}>{it.titulo}</p>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: cfg.bg, color: cfg.cor }}>
                                  {cfg.label}
                                </span>
                              </div>
                              {it.lead && (
                                <p className="text-xs truncate" style={{ color: '#7AAACB' }}>
                                  {it.lead.nome}{it.lead.empresa ? ` · ${it.lead.empresa}` : ''}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-bold flex-shrink-0" style={{ color: cfg.cor }}>
                              {diasLabel}
                            </span>
                          </a>
                        );
                      })}
                      {ordered.length > 10 && (
                        <a href="/atividades" className="block text-center text-xs font-semibold py-3 hover:bg-gray-50" style={{ color: '#4B8EC8', borderTop: '1px solid #F4F7FB' }}>
                          + {ordered.length - 10} atividades adicionais — ver todas
                        </a>
                      )}
                    </div>
                  )}
                </PsCard>
              );
            })()}

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
