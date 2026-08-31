'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  RefreshCw, TrendingUp, TrendingDown,
  Flame, Thermometer, Snowflake,
  AlertTriangle, Heart, ChevronDown,
  Phone, Mail, Users, Car, Bell, FileOutput, Pin, ArrowRight,
} from 'lucide-react';
import { MrrTrendCard } from './components/MrrTrendCard';
import { PipelineFunnelChart } from './components/PipelineFunnelChart';
import { TemperaturaGauge } from './components/TemperaturaGauge';
import AbaTabs from './components/AbaTabs';

// ── Types ──────────────────────────────────────────────────────────────────────
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
  pipeline_funil_propostas: { etapa: string; count: number; valor: number }[];
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

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) => new Intl.NumberFormat('pt-BR').format(v);

const ETAPA_LABEL: Record<string, string> = {
  PROSPECCAO: 'Prospecção', QUALIFICACAO: 'Qualificação',
  APRESENTACAO: 'Apresentação', PROPOSTA: 'Proposta',
  NEGOCIACAO: 'Negociação', FECHAMENTO: 'Fechamento',
};

const ETAPA_PROPOSTA_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho', ENVIADA: 'Enviada',
  EM_NEGOCIACAO: 'Em Negociação', FECHADA: 'Fechada',
};

const TIPO_LABEL: Record<string, { Icon: React.ElementType; label: string }> = {
  LIGACAO:   { Icon: Phone,      label: 'Ligação' },
  EMAIL:     { Icon: Mail,       label: 'E-mail' },
  REUNIAO:   { Icon: Users,      label: 'Reunião' },
  VISITA:    { Icon: Car,        label: 'Visita' },
  FOLLOW_UP: { Icon: Bell,       label: 'Follow-up' },
  PROPOSTA:  { Icon: FileOutput, label: 'Proposta' },
  OUTRO:     { Icon: Pin,        label: 'Outro' },
};

// ── Animated Counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = display;
    const end = value;
    const duration = 900;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString('pt-BR');

  return <>{prefix}{formatted}{suffix}</>;
}

// ── Pulse Dot ─────────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40" style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
// Sem ícone decorativo nem pulse-dot: em uma fileira de 5 métricas, uma caixinha
// colorida por card não distingue nada — só repete o mesmo template. A hierarquia
// vem do tamanho do número e da posição (a métrica mais acionável primeiro).
function KpiCard({
  label, value, sub, accent = 'var(--t-text-primary)', delta, destaque, animate: doAnimate, rawValue,
}: {
  label: string; value: string; sub?: string;
  accent?: string; delta?: number; destaque?: boolean; animate?: boolean; rawValue?: number;
}) {
  return (
    <div className="ps-card rounded-xl p-5 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--t-text-muted)' }}>
          {label}
        </p>
        {delta !== undefined && (
          <span
            className="flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0"
            style={{
              background: delta >= 0 ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.10)',
              color: delta >= 0 ? '#16a34a' : '#dc2626',
            }}
          >
            {delta >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p
        className={`font-bold tracking-tight leading-none ${destaque ? 'text-[28px]' : 'text-[22px]'}`}
        style={{ color: accent }}
      >
        {doAnimate && rawValue !== undefined
          ? <AnimatedNumber value={rawValue} />
          : value}
      </p>
      {sub && (
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--t-text-secondary)' }}>{sub}</p>
      )}
    </div>
  );
}

// ── Alert Strip ───────────────────────────────────────────────────────────────
function AlertStrip({ alertas }: { alertas: DashboardPower['alertas'] }) {
  const items = [
    { count: alertas.atividades_atrasadas, label: 'atividades atrasadas', color: '#dc2626', href: '/atividades' },
    { count: alertas.tickets_criticos, label: 'tickets críticos', color: '#9333ea', href: '/suporte' },
    { count: alertas.hs_em_risco, label: 'clientes em risco', color: '#d97706', href: '/health-score' },
  ].filter(i => i.count > 0);

  if (items.length === 0) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}
    >
      <AlertTriangle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
      <span className="text-xs font-semibold" style={{ color: '#dc2626', flexShrink: 0 }}>Atenção</span>
      <div className="w-px h-4 shrink-0" style={{ background: 'rgba(220,38,38,0.20)' }} />
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <a
            key={item.label}
            href={item.href}
            className="flex items-center gap-1.5 text-[11px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: item.color }}
          >
            <PulseDot color={item.color} />
            {item.count} {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--t-text-muted)' }}>
        {children}
      </span>
      {action}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardPower | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([]);
  const [filtroVendedorId, setFiltroVendedorId] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showFinanceiro, setShowFinanceiro] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'comercial' | 'retencao' | 'equipe' | 'funis' | 'manuais'>('comercial');
  const [painelCeo, setPainelCeo] = useState<any>(null);
  const [relatorioComercial, setRelatorioComercial] = useState<any>(null);
  const [rankingEquipe, setRankingEquipe] = useState<any[]>([]);

  const isGestor = podeVerTudo(user?.role);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (isGestor) apiClient.getVendedores().then(r => setVendedores(r.data?.data || [])).catch(() => {});
  }, [isGestor]);
  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);
  useEffect(() => {
    if (loading || !isAuthenticated || !user) return;
    if (!isGestor) router.replace('/comercial');
  }, [loading, isAuthenticated, user, isGestor, router]);

  useEffect(() => {
    if (!isAuthenticated || !isGestor) return;
    const hoje = new Date();
    apiClient.getPainelCEO({ periodo: 'mes', ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 })
      .then(r => setPainelCeo(r.data?.data?.indicadores || null))
      .catch(() => setPainelCeo(null));
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const isoDia = (d: Date) => d.toISOString().slice(0, 10);
    apiClient.getRelatorioComercial(isoDia(inicioMes), isoDia(fimMes))
      .then(r => setRelatorioComercial(r.data?.data || null))
      .catch(() => setRelatorioComercial(null));
    apiClient.getRanking()
      .then(r => setRankingEquipe(r.data?.data || []))
      .catch(() => setRankingEquipe([]));
  }, [isAuthenticated, isGestor]);

  const loadData = () => {
    if (!isAuthenticated || !isGestor) return;
    setDataLoading(true);
    setLoadError(null);
    apiClient.getDashboardPower(filtroVendedorId || undefined)
      .then(res => { setData(res.data.data); setLastUpdate(new Date()); })
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.message || 'Erro desconhecido';
        setLoadError(msg);
      })
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadData(); }, [isAuthenticated, isGestor, filtroVendedorId]);

  if (loading || !isAuthenticated || (user && !isGestor)) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--t-sidebar-grad-from)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--t-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const maxPipelineVal = data ? Math.max(...data.pipeline_funil.map(p => p.valor), 1) : 1;
  const totalAlertas = data
    ? data.alertas.atividades_atrasadas + data.alertas.tickets_criticos +
      data.alertas.renovacoes_criticas + data.alertas.hs_em_risco
    : 0;

  const nrr = painelCeo && data
    ? (() => {
        const mrrInicial = data.kpis.mrr - (painelCeo.net_new_mrr || 0);
        if (mrrInicial <= 0) return null;
        return Math.round(((mrrInicial + (painelCeo.mrr_novo || 0) - (painelCeo.mrr_perdido || 0)) / mrrInicial) * 100);
      })()
    : null;

  return (
    <DashboardLayout>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .du-fade { animation: fadeUp 0.4s ease both; }
        .du-fade-1 { animation: fadeUp 0.4s 0.05s ease both; }
        .du-fade-2 { animation: fadeUp 0.4s 0.10s ease both; }
        .du-fade-3 { animation: fadeUp 0.4s 0.15s ease both; }
        .du-fade-4 { animation: fadeUp 0.4s 0.20s ease both; }
        .du-fade-5 { animation: fadeUp 0.4s 0.25s ease both; }
        .du-skeleton {
          background: linear-gradient(90deg, var(--t-card-border) 25%, var(--t-primary-light) 50%, var(--t-card-border) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 10px;
        }
        .waterfall { display: flex; align-items: flex-end; gap: 6px; height: 150px; padding-top: 10px; }
        .wf-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
        .wf-bar { width: 100%; max-width: 64px; border-radius: 4px 4px 0 0; }
        .wf-val { font-size: 11px; font-weight: 800; margin-bottom: 4px; }
        .wf-label { font-size: 10px; font-weight: 700; color: var(--t-text-muted); margin-top: 7px; text-align: center; }
        .rank-row { display: flex; align-items: center; gap: 10px; padding: 10px 8px; border-radius: 10px; }
        .rank-row:nth-child(odd) { background: var(--t-content-bg); }
        .rank-name { font-size: 13px; font-weight: 700; }
        .rank-sub { font-size: 10.5px; color: var(--t-text-muted); margin-top: 1px; }
        .rank-val { font-size: 13px; font-weight: 800; color: var(--t-primary-dark); margin-left: auto; text-align: right; }
        .hbar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .hbar-label { font-size: 11px; font-weight: 700; color: var(--t-text-secondary); width: 130px; flex-shrink: 0; text-align: right; }
        .hbar-track { flex: 1; position: relative; height: 22px; }
        .hbar-fill { height: 22px; border-radius: 0 4px 4px 0; }
        .hbar-value { font-size: 11px; font-weight: 800; color: var(--t-text-primary); margin-left: 10px; white-space: nowrap; min-width: 64px; }
      `}</style>

      <div className="space-y-5 pb-10">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="du-fade flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--t-text-primary)' }}>
              Dashboard Executivo
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
              Visão do Negócio
              {lastUpdate && <span className="ml-2">· atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {vendedores.length > 0 && (
              <select
                value={filtroVendedorId}
                onChange={e => setFiltroVendedorId(e.target.value)}
                className="h-8 px-3 rounded-lg text-xs border font-medium"
                style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }}
              >
                <option value="">Todos os vendedores</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            )}
            <button
              onClick={loadData}
              disabled={dataLoading}
              className="ps-btn-primary h-8 flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold disabled:opacity-50 transition-opacity"
            >
              <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* ── Skeleton ───────────────────────────────────────────── */}
        {dataLoading && !data && (
          <div className="space-y-5 du-fade">
            <div className="du-skeleton h-11 w-full" />
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-24 du-skeleton" />)}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 du-skeleton" />)}
            </div>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────── */}
        {!dataLoading && !data && (
          <div className="du-fade ps-card rounded-xl p-10 text-center max-w-md mx-auto" style={{ border: '1px solid rgba(220,38,38,0.20)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(220,38,38,0.10)' }}>
              <AlertTriangle size={22} style={{ color: '#dc2626' }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--t-text-primary)' }}>Não foi possível carregar o dashboard</p>
            <p className="text-xs mb-5" style={{ color: 'var(--t-text-secondary)' }}>{loadError}</p>
            <button onClick={loadData} className="ps-btn-primary px-5 py-2 rounded-lg text-xs font-semibold">
              Tentar novamente
            </button>
          </div>
        )}

        {data && mounted && (
          <>
            {/* ── Alertas ──────────────────────────────────────── */}
            {totalAlertas > 0 && (
              <div className="du-fade-1">
                <AlertStrip alertas={data.alertas} />
              </div>
            )}

            {/* ── KPIs-âncora ──────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 du-fade-2">
              <div className="ps-card rounded-xl p-4 lg:col-span-1" style={{ background: 'linear-gradient(135deg, var(--t-primary-deep), var(--t-primary-dark))' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,.7)' }}>MRR Recorrente</p>
                <p className="text-2xl font-extrabold" style={{ color: '#fff' }}><AnimatedNumber value={data.kpis.mrr} prefix="R$ " /></p>
                {data.kpis.mrr_delta !== undefined && (
                  <p className="text-[11px] mt-1" style={{ color: data.kpis.mrr_delta >= 0 ? '#86EFAC' : '#FCA5A5' }}>
                    {data.kpis.mrr_delta >= 0 ? '↑' : '↓'} {Math.abs(data.kpis.mrr_delta)}% vs. mês anterior
                  </p>
                )}
              </div>
              <KpiCard label="NRR (Retenção Líquida)" value={nrr !== null ? `${nrr}%` : '—'} accent={nrr !== null && nrr >= 100 ? '#16a34a' : '#d97706'} />
              <KpiCard label="Contratos Ativos" value={String(data.kpis.contratos_ativos)} sub={`+${data.kpis.contratos_mes} este mês`} />
              <KpiCard label="Pipeline Total" value={fmt(data.kpis.pipeline_valor)} sub="valor estimado em aberto" />
              <KpiCard label="NPS" value={data.kpis.nps_score !== null ? String(data.kpis.nps_score) : '—'} accent={data.kpis.nps_score !== null && data.kpis.nps_score >= 50 ? '#16a34a' : '#d97706'} />
            </div>

            {/* ── Abas ─────────────────────────────────────────── */}
            <AbaTabs
              abas={[
                { id: 'comercial', label: 'Comercial & Pipeline' },
                { id: 'retencao', label: 'Retenção & Financeiro' },
                { id: 'equipe', label: 'Equipe' },
                { id: 'funis', label: 'Funis' },
                { id: 'manuais', label: 'Indicadores Manuais' },
              ]}
              abaAtiva={abaAtiva}
              onChange={(id) => setAbaAtiva(id as typeof abaAtiva)}
            />

            {abaAtiva === 'comercial' && (
              <div className="space-y-4">
                <div>
                  <SectionLabel>Este Mês</SectionLabel>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <KpiCard label="Taxa de Conversão (mês)" value={`${data.kpis.taxa_conversao}%`} accent={data.kpis.taxa_conversao >= 20 ? '#16a34a' : '#d97706'} sub="ganhos ÷ captados no mês" />
                    <KpiCard label="Win Rate (propostas)" value={relatorioComercial ? `${Math.round((relatorioComercial.metricas.fechamentos.total / Math.max(relatorioComercial.metricas.fechamentos.total + (relatorioComercial.metricas.perdidos?.total || 0), 1)) * 100)}%` : '—'} accent="#16a34a" sub="ganhas ÷ decididas" />
                    <KpiCard label="Leads Captados" value={fmtNum(data.kpis.leads_mes)} sub={`${data.kpis.leads_ganhos_mes} convertidos`} />
                    <KpiCard label="Propostas Abertas" value={fmtNum(data.kpis.propostas_abertas)} />
                  </div>
                </div>

                <MrrTrendCard
                  mrr={data.kpis.mrr}
                  mrrDelta={data.kpis.mrr_delta}
                  contratosAtivos={data.kpis.contratos_ativos}
                  contratosMes={data.kpis.contratos_mes}
                  AnimatedNumber={AnimatedNumber}
                  fmt={fmt}
                />

                {relatorioComercial && (
                  <div className="ps-card rounded-xl p-5">
                    <SectionLabel>Entrada × Saída (este mês)</SectionLabel>
                    <div className="grid grid-cols-3 gap-3">
                      <KpiCard label="Clientes Entrada" value={String(relatorioComercial.metricas.entrada_x_saida.clientes_entrada)} accent="#16a34a" />
                      <KpiCard label="Clientes Saída" value={String(relatorioComercial.metricas.entrada_x_saida.clientes_saida)} accent={relatorioComercial.metricas.entrada_x_saida.clientes_saida > 0 ? '#dc2626' : '#16a34a'} />
                      <KpiCard label="Saldo MRR" value={fmt(relatorioComercial.metricas.entrada_x_saida.saldo_mrr)} accent={relatorioComercial.metricas.entrada_x_saida.saldo_mrr >= 0 ? '#16a34a' : '#dc2626'} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {abaAtiva === 'retencao' && painelCeo && (
              <div className="space-y-4">
                <div className="ps-card rounded-xl p-5">
                  <SectionLabel>Como o NRR foi calculado</SectionLabel>
                  <div className="waterfall">
                    <div className="wf-col">
                      <span className="wf-val">{fmt(data.kpis.mrr - (painelCeo.net_new_mrr || 0))}</span>
                      <div className="wf-bar" style={{ height: '100%', background: 'var(--t-primary)' }} />
                      <span className="wf-label">MRR Inicial</span>
                    </div>
                    <div className="wf-col">
                      <span className="wf-val">+{fmt(painelCeo.mrr_novo || 0)}</span>
                      <div className="wf-bar" style={{ height: `${Math.max(4, Math.min(100, ((painelCeo.mrr_novo || 0) / Math.max(data.kpis.mrr, 1)) * 100))}%`, background: '#16a34a' }} />
                      <span className="wf-label">Expansão</span>
                    </div>
                    <div className="wf-col">
                      <span className="wf-val">−{fmt(painelCeo.mrr_perdido || 0)}</span>
                      <div className="wf-bar" style={{ height: `${Math.max(4, Math.min(100, ((painelCeo.mrr_perdido || 0) / Math.max(data.kpis.mrr, 1)) * 100))}%`, background: '#dc2626' }} />
                      <span className="wf-label">Churn</span>
                    </div>
                    <div className="wf-col">
                      <span className="wf-val">{fmt(data.kpis.mrr)}</span>
                      <div className="wf-bar" style={{ height: '100%', background: 'var(--t-primary)' }} />
                      <span className="wf-label">MRR Final</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <KpiCard label="CAC" value={painelCeo.cac !== null ? fmt(painelCeo.cac) : '— sem dado'} sub={painelCeo.cac === null ? 'nunca lançado' : undefined} />
                  <KpiCard label="LTV Médio" value="— sem dado" sub="base zerada (ver /ltv)" />
                  <KpiCard label="LTV : CAC" value="—" />
                  <KpiCard label="Ticket Médio" value={data.kpis.contratos_ativos > 0 ? fmt(data.kpis.mrr / data.kpis.contratos_ativos) + '/mês' : '—'} />
                </div>
              </div>
            )}
            {abaAtiva === 'equipe' && (
              <div className="space-y-4">
                <div className="ps-card rounded-xl p-5">
                  <SectionLabel>Ranking do Período</SectionLabel>
                  {rankingEquipe.length === 0 ? (
                    <p className="text-xs text-center py-8" style={{ color: 'var(--t-text-secondary)' }}>Nenhum dado de ranking neste período.</p>
                  ) : (
                    rankingEquipe.map((v: any, i: number) => {
                      const cores = ['#F59E0B', '#9CA3AF', '#D97706'];
                      return (
                        <div key={v.responsavel_id} className="rank-row">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: cores[i] || 'var(--t-primary)' }}>
                            {v.posicao}
                          </span>
                          <div className="flex-1">
                            <p className="rank-name">{v.responsavel_nome}</p>
                            <p className="rank-sub">{v.leads_ganhos} leads ganhos · {v.propostas_aceitas} propostas aceitas</p>
                          </div>
                          <span className="rank-val">{fmt(v.valor_total)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            {abaAtiva === 'funis' && (
            <>
            {/* ── Funis: Leads e Propostas ──────────────────────── */}
            <div className="du-fade-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PipelineFunnelChart
                pipelineFunil={data.pipeline_funil}
                etapaLabel={ETAPA_LABEL}
                fmt={fmt}
              />
              <PipelineFunnelChart
                pipelineFunil={data.pipeline_funil_propostas}
                etapaLabel={ETAPA_PROPOSTA_LABEL}
                fmt={fmt}
                titulo="Funil de Propostas Comerciais"
              />
            </div>
            </>
            )}

            {abaAtiva === 'manuais' && (
              <div>
                {!isGestor ? null : (
                  <>
                    <p className="text-[11px] mb-3 p-3 rounded-lg" style={{ background: 'var(--t-primary-light)', color: 'var(--t-text-secondary)' }}>
                      Esta aba só aparece para quem tem permissão de editar Indicadores do CEO.
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <KpiCard label="Caixa Disponível" value={painelCeo?.caixa_disponivel !== null && painelCeo?.caixa_disponivel !== undefined ? fmt(painelCeo.caixa_disponivel) : '— não lançado'} />
                      <KpiCard label="Faturamento" value={painelCeo?.faturamento !== null && painelCeo?.faturamento !== undefined ? fmt(painelCeo.faturamento) : '— não lançado'} />
                      <KpiCard label="Despesas do Setor" value={painelCeo?.despesas_setor !== null && painelCeo?.despesas_setor !== undefined ? fmt(painelCeo.despesas_setor) : '— não lançado'} />
                      <KpiCard label="Marketing Investido" value={painelCeo?.marketing_investido !== null && painelCeo?.marketing_investido !== undefined ? fmt(painelCeo.marketing_investido) : '— não lançado'} />
                    </div>
                  </>
                )}
              </div>
            )}

          </>
        )}
      </div>
    </DashboardLayout>
  );
}
