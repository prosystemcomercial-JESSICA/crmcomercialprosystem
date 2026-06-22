'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  RefreshCw, TrendingUp, TrendingDown,
  DollarSign, FileCheck2, BarChart3, Star, Target,
  Percent, FileText, Headphones, XCircle,
  Flame, Thermometer, Snowflake, CheckCircle2, ClipboardList,
  AlertTriangle, Zap, Heart, RotateCcw,
} from 'lucide-react';

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

const TIPO_LABEL: Record<string, { icon: string }> = {
  LIGACAO: { icon: '📞' }, EMAIL: { icon: '✉️' }, REUNIAO: { icon: '🤝' },
  VISITA: { icon: '🚗' }, FOLLOW_UP: { icon: '🔔' }, PROPOSTA: { icon: '📄' }, OUTRO: { icon: '📌' },
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
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: color }} />
    </span>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, icon: Icon, accent = '#4B8EC8', delta, pulse, animate: doAnimate, rawValue,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  accent?: string; delta?: number; pulse?: boolean; animate?: boolean; rawValue?: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        background: 'white',
        border: '1px solid #E8F1FB',
        boxShadow: '0 2px 8px rgba(13,34,56,0.06)',
      }}
    >
      {/* Background glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle at 20% 50%, ${accent}08 0%, transparent 70%)` }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
            style={{ background: `${accent}15` }}
          >
            <Icon size={18} style={{ color: accent }} />
          </div>
          <div className="flex items-center gap-2">
            {pulse && <PulseDot color={accent} />}
            {delta !== undefined && (
              <span
                className="flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: delta >= 0 ? '#DCFCE7' : '#FEE2E2',
                  color: delta >= 0 ? '#16a34a' : '#dc2626',
                }}
              >
                {delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(delta)}%
              </span>
            )}
          </div>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>
          {label}
        </p>
        <p className="text-2xl font-black tracking-tight leading-none" style={{ color: '#0D2238' }}>
          {doAnimate && rawValue !== undefined
            ? <AnimatedNumber value={rawValue} />
            : value}
        </p>
        {sub && (
          <p className="text-xs mt-1.5 font-medium" style={{ color: '#7AAACB' }}>{sub}</p>
        )}
      </div>
    </div>
  );
}

// ── Alert Banner ──────────────────────────────────────────────────────────────
function AlertBanner({ alertas }: { alertas: DashboardPower['alertas'] }) {
  const total = alertas.atividades_atrasadas + alertas.tickets_criticos + alertas.renovacoes_criticas + alertas.hs_em_risco;
  if (total === 0) return null;

  const items = [
    { count: alertas.atividades_atrasadas, label: 'atividades atrasadas', color: '#dc2626', bg: '#FEE2E2', href: '/atividades' },
    { count: alertas.tickets_criticos, label: 'tickets críticos', color: '#9333ea', bg: '#F3E8FF', href: '/suporte' },
    { count: alertas.renovacoes_criticas, label: 'renovações urgentes', color: '#ea580c', bg: '#FFEDD5', href: '/renovacoes' },
    { count: alertas.hs_em_risco, label: 'clientes em risco', color: '#d97706', bg: '#FEF3C7', href: '/health-score' },
  ].filter(i => i.count > 0);

  return (
    <div
      className="rounded-2xl px-5 py-4 flex items-center gap-4 flex-wrap animate-pulse-slow"
      style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FEF2F2 100%)', border: '1px solid #FECACA' }}
    >
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#FEE2E2' }}>
          <AlertTriangle size={15} style={{ color: '#dc2626' }} />
        </div>
        <span className="text-sm font-bold" style={{ color: '#7f1d1d' }}>Atenção necessária</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <a
            key={item.label}
            href={item.href}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-80 hover:scale-105"
            style={{ background: item.bg, color: item.color }}
          >
            <PulseDot color={item.color} />
            {item.count} {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ children, href }: { children: React.ReactNode; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="h-4 w-1 rounded-full" style={{ background: 'linear-gradient(to bottom, #4B8EC8, #2E6EAB)' }} />
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#0D2238' }}>{children}</p>
      </div>
      {href && (
        <a href={href} className="text-xs font-semibold transition-colors hover:opacity-70" style={{ color: '#4B8EC8' }}>
          Ver todos →
        </a>
      )}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ background: 'white', border: '1px solid #E8F1FB', boxShadow: '0 2px 8px rgba(13,34,56,0.06)', ...style }}
    >
      {children}
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
    if ((user.role || '').toUpperCase() === 'CEO') { router.replace('/relatorio-comercial'); return; }
    if (!isGestor) router.replace('/comercial');
  }, [loading, isAuthenticated, user, isGestor, router]);

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
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0D2238' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#4B8EC8', borderTopColor: 'transparent' }} />
          <p className="text-sm font-medium" style={{ color: '#7AAACB' }}>Carregando painel...</p>
        </div>
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
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .fade-up { animation: fadeUp 0.5s ease both; }
        .fade-up-1 { animation: fadeUp 0.5s 0.05s ease both; }
        .fade-up-2 { animation: fadeUp 0.5s 0.10s ease both; }
        .fade-up-3 { animation: fadeUp 0.5s 0.15s ease both; }
        .fade-up-4 { animation: fadeUp 0.5s 0.20s ease both; }
        .fade-up-5 { animation: fadeUp 0.5s 0.25s ease both; }
        .fade-up-6 { animation: fadeUp 0.5s 0.30s ease both; }
        .skeleton {
          background: linear-gradient(90deg, #f0f4f8 25%, #e2eaf3 50%, #f0f4f8 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 12px;
        }
      `}</style>

      <div className="space-y-6 pb-10">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="fade-up flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: '#0D2238' }}>
              Dashboard Executivo
            </h1>
            <p className="text-sm mt-0.5 font-medium" style={{ color: '#7AAACB' }}>
              Visão 360° do negócio
              {lastUpdate && (
                <span className="ml-2 text-xs" style={{ color: '#94a3b8' }}>
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
                className="px-3 py-2 rounded-xl text-sm border font-medium"
                style={{ borderColor: '#D8E8F5', color: '#0D2238', background: 'white' }}
              >
                <option value="">👥 Todos os vendedores</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            )}
            <button
              onClick={loadData}
              disabled={dataLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #4B8EC8 0%, #2E6EAB 100%)', boxShadow: '0 4px 14px rgba(75,142,200,0.35)' }}
            >
              <RefreshCw size={14} className={dataLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* ── Skeleton Loading ─────────────────────────────────── */}
        {dataLoading && !data && (
          <div className="space-y-6 fade-up">
            <div className="skeleton h-14 w-full" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28" />)}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28" />)}
            </div>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────── */}
        {!dataLoading && !data && (
          <div className="fade-up" style={{ background: 'white', borderRadius: 20, padding: '40px 32px', textAlign: 'center', border: '1px solid #fca5a5', maxWidth: 560, margin: '40px auto' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={28} style={{ color: '#dc2626' }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0D2238', marginBottom: 8 }}>Não foi possível carregar o dashboard</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>{loadError}</p>
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 20 }}>
              <strong>Seus registros foram preservados</strong> — nenhuma informação foi perdida. Os dashboards apenas leem dados, não modificam.
            </p>
            <button onClick={loadData} style={{ background: 'linear-gradient(135deg, #4B8EC8, #2E6EAB)', color: '#fff', border: 'none', padding: '11px 24px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              ↻ Tentar novamente
            </button>
          </div>
        )}

        {data && mounted && (
          <>
            {/* ── Alertas ─────────────────────────────────────── */}
            {totalAlertas > 0 && (
              <div className="fade-up-1">
                <AlertBanner alertas={data.alertas} />
              </div>
            )}

            {/* ── KPIs Financeiro ─────────────────────────────── */}
            <div className="fade-up-2">
              <SectionHeader>Financeiro & Contratos</SectionHeader>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="MRR Recorrente" value={fmt(data.kpis.mrr)} rawValue={data.kpis.mrr}
                  sub={`${data.kpis.contratos_ativos} contratos ativos`}
                  icon={DollarSign} delta={data.kpis.mrr_delta} accent="#16a34a" pulse animate
                />
                <MetricCard
                  label="Contratos Ativos" value={fmtNum(data.kpis.contratos_ativos)}
                  sub={`+${data.kpis.contratos_mes} este mês`} icon={FileCheck2} accent="#4B8EC8"
                />
                <MetricCard
                  label="Pipeline Total" value={fmt(data.kpis.pipeline_valor)}
                  sub="valor estimado em aberto" icon={BarChart3} accent="#6366F1"
                />
                <MetricCard
                  label="NPS Score"
                  value={data.kpis.nps_score !== null ? String(data.kpis.nps_score) : '—'}
                  sub={data.kpis.nps_score !== null
                    ? (data.kpis.nps_score >= 50 ? '⭐ Excelente' : data.kpis.nps_score >= 0 ? '👍 Bom' : '⚠️ Crítico')
                    : 'sem respostas ainda'}
                  icon={Star}
                  accent={data.kpis.nps_score !== null
                    ? (data.kpis.nps_score >= 50 ? '#16a34a' : data.kpis.nps_score >= 0 ? '#d97706' : '#dc2626')
                    : '#9CA3AF'}
                />
              </div>
            </div>

            {/* ── KPIs Comercial ──────────────────────────────── */}
            <div className="fade-up-3">
              <SectionHeader>Comercial — Este Mês</SectionHeader>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Leads Captados" value={fmtNum(data.kpis.leads_mes)}
                  sub={`${data.kpis.leads_ganhos_mes} convertidos`} icon={Target} accent="#4B8EC8"
                />
                <MetricCard
                  label="Taxa de Conversão" value={`${data.kpis.taxa_conversao}%`}
                  sub={`mês anterior: ${data.kpis.leads_ganhos_mes_anterior} ganhos`}
                  icon={Percent}
                  accent={data.kpis.taxa_conversao >= 20 ? '#16a34a' : '#d97706'}
                  pulse={data.kpis.taxa_conversao < 10}
                />
                <MetricCard
                  label="Propostas Abertas" value={fmtNum(data.kpis.propostas_abertas)}
                  sub={`${data.kpis.propostas_aceitas_mes} aceitas este mês`} icon={FileText} accent="#8B5CF6"
                />
                <MetricCard
                  label="Tickets em Aberto" value={fmtNum(data.kpis.tickets_abertos)}
                  sub={data.kpis.tickets_criticos > 0 ? `⚠️ ${data.kpis.tickets_criticos} críticos` : '✅ Nenhum crítico'}
                  icon={Headphones}
                  accent={data.kpis.tickets_criticos > 0 ? '#dc2626' : '#4B8EC8'}
                  pulse={data.kpis.tickets_criticos > 0}
                />
              </div>
            </div>

            {/* ── Pipeline de Propostas ───────────────────────── */}
            {data.pipeline_propostas && (
              <div className="fade-up-4">
                <SectionHeader>Pipeline de Propostas Comerciais</SectionHeader>

                {/* KPIs row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <MetricCard
                    label="Total de Propostas" value={fmtNum(data.pipeline_propostas.total)}
                    sub={`${data.pipeline_propostas.perdido.count} perdida${data.pipeline_propostas.perdido.count !== 1 ? 's' : ''}`}
                    icon={ClipboardList} accent="#4B8EC8"
                  />
                  <MetricCard
                    label="MRR em Negociação"
                    value={fmt(data.pipeline_propostas.quente.mrr + data.pipeline_propostas.morno.mrr + data.pipeline_propostas.frio.mrr)}
                    sub="mensalidades em aberto" icon={DollarSign} accent="#16a34a"
                  />
                  <MetricCard
                    label="Setup em Negociação"
                    value={fmt(data.pipeline_propostas.quente.setup + data.pipeline_propostas.morno.setup + data.pipeline_propostas.frio.setup)}
                    sub="implantações em aberto" icon={BarChart3} accent="#7c3aed"
                  />
                  <MetricCard
                    label="Já Fechado (Setup)"
                    value={fmt(data.pipeline_propostas.fechado.setup)}
                    sub={`MRR +${fmt(data.pipeline_propostas.fechado.mrr)}/mês · ${data.pipeline_propostas.fechado.count} prop.`}
                    icon={CheckCircle2} accent="#15803d" pulse
                  />
                </div>

                {/* Temperatura breakdown */}
                <Card className="p-6">
                  <p className="text-sm font-black mb-5" style={{ color: '#0D2238' }}>Propostas por Temperatura</p>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {[
                      { label: 'Quente — A Fechar', sub: 'Em negociação ativa', icon: Flame, d: data.pipeline_propostas.quente, accent: '#dc2626', bg: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)' },
                      { label: 'Morno — Aguardando', sub: 'Retorno pendente', icon: Thermometer, d: data.pipeline_propostas.morno, accent: '#d97706', bg: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' },
                      { label: 'Frio — Rascunho', sub: 'Ainda não enviada', icon: Snowflake, d: data.pipeline_propostas.frio, accent: '#2563eb', bg: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)' },
                    ].map(({ label, sub, icon: Icon, d, accent, bg }) => (
                      <div key={label} className="rounded-xl p-4 transition-transform duration-200 hover:scale-105" style={{ background: bg }}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${accent}20` }}>
                              <Icon size={16} style={{ color: accent }} />
                            </div>
                            <div>
                              <p className="text-xs font-bold" style={{ color: accent }}>{label}</p>
                              <p className="text-[10px] font-medium" style={{ color: `${accent}aa` }}>{sub}</p>
                            </div>
                          </div>
                          <span className="text-lg font-black" style={{ color: accent }}>{d.count}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold" style={{ color: '#6b7280' }}>MRR</span>
                            <span className="text-sm font-black" style={{ color: accent }}>{fmt(d.mrr)}</span>
                          </div>
                          <div className="h-px" style={{ background: `${accent}30` }} />
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold" style={{ color: '#6b7280' }}>Setup</span>
                            <span className="text-sm font-black" style={{ color: accent }}>{fmt(d.setup)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Proportion bar */}
                  {(() => {
                    const total = data.pipeline_propostas.quente.count + data.pipeline_propostas.morno.count + data.pipeline_propostas.frio.count;
                    if (total === 0) return null;
                    const pctQ = Math.round((data.pipeline_propostas.quente.count / total) * 100);
                    const pctM = Math.round((data.pipeline_propostas.morno.count / total) * 100);
                    const pctF = 100 - pctQ - pctM;
                    return (
                      <div className="mt-5">
                        <div className="flex rounded-full overflow-hidden h-3 gap-0.5">
                          {pctQ > 0 && <div className="transition-all duration-700" style={{ width: `${pctQ}%`, background: 'linear-gradient(90deg, #dc2626, #ef4444)', borderRadius: 4 }} />}
                          {pctM > 0 && <div className="transition-all duration-700" style={{ width: `${pctM}%`, background: 'linear-gradient(90deg, #d97706, #f59e0b)', borderRadius: 4 }} />}
                          {pctF > 0 && <div className="transition-all duration-700" style={{ width: `${pctF}%`, background: 'linear-gradient(90deg, #2563eb, #3b82f6)', borderRadius: 4 }} />}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          {[{ c: '#ef4444', l: `🔥 Quente ${pctQ}%` }, { c: '#f59e0b', l: `🌡 Morno ${pctM}%` }, { c: '#3b82f6', l: `❄️ Frio ${pctF}%` }].map(({ c, l }) => (
                            <div key={l} className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                              <span className="text-[11px] font-semibold" style={{ color: '#64748b' }}>{l}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              </div>
            )}

            {/* ── Pipeline + Top Leads ────────────────────────── */}
            <div className="fade-up-5 grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Pipeline por etapa */}
              <Card className="p-6">
                <p className="text-sm font-black mb-5" style={{ color: '#0D2238' }}>Pipeline por Etapa</p>
                <div className="space-y-4">
                  {data.pipeline_funil.map((p, i) => {
                    const widthPct = maxPipelineVal > 0 ? (p.valor / maxPipelineVal) * 100 : 0;
                    const colors = ['#4B8EC8', '#2E6EAB', '#1A4E82', '#6366F1', '#8B5CF6', '#7C3AED'];
                    const color = colors[i % colors.length];
                    return (
                      <div key={p.etapa}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold" style={{ color: '#0D2238' }}>
                            {ETAPA_LABEL[p.etapa] || p.etapa}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black" style={{ color }}>{fmt(p.valor)}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${color}15`, color }}>
                              {p.count}
                            </span>
                          </div>
                        </div>
                        <div className="w-full rounded-full h-2" style={{ background: '#F1F5F9' }}>
                          <div
                            className="h-2 rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.max(widthPct, p.valor > 0 ? 3 : 0)}%`,
                              background: `linear-gradient(90deg, ${color}, ${color}88)`,
                              transitionDelay: `${i * 80}ms`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {data.pipeline_funil.every(p => p.count === 0) && (
                    <p className="text-xs text-center py-6 font-medium" style={{ color: '#7AAACB' }}>Nenhum lead ativo no funil</p>
                  )}
                </div>
              </Card>

              {/* Top 5 Leads */}
              <Card className="p-6">
                <p className="text-sm font-black mb-5" style={{ color: '#0D2238' }}>Top 5 Leads — Maior Potencial</p>
                {data.top_leads.length === 0 ? (
                  <p className="text-xs text-center py-8 font-medium" style={{ color: '#7AAACB' }}>Nenhum lead com valor estimado</p>
                ) : (
                  <div className="space-y-3">
                    {data.top_leads.map((l, i) => {
                      const tempColors: Record<string, { bg: string; color: string; emoji: string }> = {
                        MUITO_QUENTE: { bg: '#FEF2F2', color: '#dc2626', emoji: '⚡' },
                        QUENTE:       { bg: '#FEF2F2', color: '#ef4444', emoji: '🔥' },
                        MORNO:        { bg: '#FEF3C7', color: '#d97706', emoji: '🌡' },
                        FRIO:         { bg: '#EFF6FF', color: '#2563eb', emoji: '❄️' },
                      };
                      const tc = tempColors[l.temperatura] || tempColors.FRIO;
                      const rankColors = ['#f59e0b', '#9ca3af', '#d97706', '#7AAACB', '#94a3b8'];
                      return (
                        <div
                          key={l.id}
                          className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:scale-[1.01] cursor-pointer"
                          style={{ background: i === 0 ? '#F0F7FF' : 'transparent', border: i === 0 ? '1px solid #BFDBFE' : '1px solid transparent' }}
                        >
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 text-white"
                            style={{ background: rankColors[i] }}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: '#0D2238' }}>{l.nome}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: tc.bg, color: tc.color }}>
                                {tc.emoji} {l.temperatura.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>{l.probabilidade}% prob.</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-black" style={{ color: '#16a34a' }}>{fmt(l.valor_ponderado)}</p>
                            <p className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>ponderado</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Perda + Motivos ─────────────────────────────── */}
            <div className="fade-up-6">
              <SectionHeader>Negócios Perdidos</SectionHeader>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <MetricCard
                  label="Perdidos no Mês" value={fmtNum(data.kpis.leads_perdidos_mes)}
                  sub={`mês anterior: ${data.kpis.leads_perdidos_mes_anterior}`}
                  icon={XCircle} accent="#dc2626"
                  delta={data.kpis.leads_perdidos_mes_anterior > 0
                    ? Math.round(((data.kpis.leads_perdidos_mes - data.kpis.leads_perdidos_mes_anterior) / data.kpis.leads_perdidos_mes_anterior) * 100)
                    : undefined}
                />
                <MetricCard
                  label="Valor Perdido" value={fmt(data.kpis.valor_perdido_mes)}
                  sub="oportunidades não convertidas" icon={TrendingDown} accent="#dc2626"
                />
                <MetricCard
                  label="Taxa de Perda"
                  value={`${data.kpis.leads_mes > 0 ? Math.round((data.kpis.leads_perdidos_mes / data.kpis.leads_mes) * 100) : 0}%`}
                  sub={`${data.kpis.leads_ganhos_mes} ganhos vs ${data.kpis.leads_perdidos_mes} perdidos`}
                  icon={Percent}
                  accent={data.kpis.leads_perdidos_mes > data.kpis.leads_ganhos_mes ? '#dc2626' : '#d97706'}
                />
              </div>

              {data.ranking_motivos_perda?.length > 0 && (
                <Card className="p-6">
                  <p className="text-sm font-black mb-5" style={{ color: '#0D2238' }}>Por que estamos perdendo negócios?</p>
                  <div className="space-y-3.5">
                    {data.ranking_motivos_perda.map((item, i) => (
                      <div key={item.motivo}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                              style={{ background: i === 0 ? '#dc2626' : i === 1 ? '#ef4444' : '#f87171' }}>
                              {i + 1}
                            </span>
                            <span className="text-xs font-semibold truncate" style={{ color: '#0D2238' }}>{item.motivo}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                            <span className="text-xs font-black" style={{ color: '#dc2626' }}>{item.total}×</span>
                            <span className="text-xs font-semibold" style={{ color: '#7AAACB' }}>{fmt(item.valor_total)}</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#991B1B' }}>
                              {item.pct}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full rounded-full h-2" style={{ background: '#FEF2F2' }}>
                          <div
                            className="h-2 rounded-full transition-all duration-700"
                            style={{ width: `${item.pct}%`, background: 'linear-gradient(90deg, #dc2626, #ef4444)', transitionDelay: `${i * 100}ms` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* ── Atividades ──────────────────────────────────── */}
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
                if (it._atrasada) return { label: 'Atrasada', cor: '#dc2626', bg: '#FEE2E2', ordem: 0 };
                const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
                const dias = Math.floor((new Date(it.data_prevista).getTime() - hoje.getTime()) / 86400000);
                if (dias < 0)  return { label: 'Atrasada',         cor: '#dc2626', bg: '#FEE2E2', ordem: 0 };
                if (dias <= 3) return { label: 'Prioridade máx.',  cor: '#ea580c', bg: '#FFEDD5', ordem: 1 };
                if (dias <= 7) return { label: 'Próxima',          cor: '#d97706', bg: '#FEF3C7', ordem: 2 };
                return                  { label: 'Dentro do prazo', cor: '#16a34a', bg: '#DCFCE7', ordem: 3 };
              };

              const ordered = merged
                .map(it => ({ it, cfg: prioCfg(it) }))
                .sort((a, b) => a.cfg.ordem - b.cfg.ordem || new Date(a.it.data_prevista).getTime() - new Date(b.it.data_prevista).getTime());

              const atrasadas = ordered.filter(o => o.cfg.label === 'Atrasada').length;
              const maxima = ordered.filter(o => o.cfg.label === 'Prioridade máx.').length;

              return (
                <Card>
                  <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid #EBF4FF' }}>
                    <div>
                      <p className="text-sm font-black" style={{ color: '#0D2238' }}>Minhas Atividades</p>
                      <p className="text-[10px] font-medium mt-0.5" style={{ color: '#94a3b8' }}>Ordenadas por prioridade e vencimento</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {atrasadas > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                          <PulseDot color="#dc2626" />{atrasadas} atrasada{atrasadas !== 1 ? 's' : ''}
                        </span>
                      )}
                      {maxima > 0 && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#FFEDD5', color: '#9A3412' }}>
                          {maxima} expirando
                        </span>
                      )}
                      <a href="/atividades" className="text-xs font-bold transition-opacity hover:opacity-70" style={{ color: '#4B8EC8' }}>Ver todas →</a>
                    </div>
                  </div>
                  {ordered.length === 0 ? (
                    <p className="p-8 text-center text-sm font-bold" style={{ color: '#16a34a' }}>✅ Tudo em dia! Sem atividades urgentes.</p>
                  ) : (
                    <div>
                      {ordered.slice(0, 10).map(({ it, cfg }) => {
                        const t = TIPO_LABEL[it.tipo] || { icon: '📌' };
                        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
                        const dias = Math.floor((new Date(it.data_prevista).getTime() - hoje.getTime()) / 86400000);
                        const diasLabel = dias < 0 ? `${Math.abs(dias)}d atrasada` : dias === 0 ? 'hoje' : `em ${dias}d`;
                        return (
                          <a key={it.id} href="/atividades"
                            className="px-6 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                            style={{ borderBottom: '1px solid #F4F7FB', borderLeft: `3px solid ${cfg.cor}` }}>
                            <span className="text-base flex-shrink-0">{t.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold truncate" style={{ color: '#0D2238' }}>{it.titulo}</p>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.cor }}>
                                  {cfg.label}
                                </span>
                              </div>
                              {it.lead && (
                                <p className="text-xs font-medium truncate mt-0.5" style={{ color: '#7AAACB' }}>
                                  {it.lead.nome}{(it.lead as any).empresa ? ` · ${(it.lead as any).empresa}` : ''}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-black flex-shrink-0" style={{ color: cfg.cor }}>{diasLabel}</span>
                          </a>
                        );
                      })}
                      {ordered.length > 10 && (
                        <a href="/atividades" className="block text-center text-xs font-bold py-3.5 hover:bg-slate-50 transition-colors" style={{ color: '#4B8EC8', borderTop: '1px solid #F4F7FB' }}>
                          + {ordered.length - 10} atividades adicionais
                        </a>
                      )}
                    </div>
                  )}
                </Card>
              );
            })()}

            {/* ── Saúde dos Clientes ──────────────────────────── */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-black" style={{ color: '#0D2238' }}>Saúde da Base de Clientes</p>
                <a href="/health-score" className="text-xs font-bold transition-opacity hover:opacity-70" style={{ color: '#4B8EC8' }}>Ver todos →</a>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Críticos', value: data.kpis.hs_criticos, icon: AlertTriangle, bg: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)', color: '#991B1B', accent: '#dc2626', href: '/health-score' },
                  { label: 'Em Risco', value: Math.max(0, data.alertas.hs_em_risco - data.kpis.hs_criticos), icon: Heart, bg: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', color: '#92400E', accent: '#d97706', href: '/health-score' },
                  { label: 'Renovações Urgentes', value: data.kpis.renovacoes_criticas, icon: RotateCcw, bg: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', color: '#9A3412', accent: '#ea580c', href: '/renovacoes' },
                ].map(stat => (
                  <a
                    key={stat.label}
                    href={stat.href}
                    className="text-center p-5 rounded-2xl transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer"
                    style={{ background: stat.bg }}
                  >
                    <div className="flex justify-center mb-2">
                      <stat.icon size={20} style={{ color: stat.accent }} />
                    </div>
                    <p className="text-4xl font-black leading-none mb-2" style={{ color: stat.accent }}>
                      <AnimatedNumber value={stat.value} />
                    </p>
                    <p className="text-xs font-bold" style={{ color: stat.color }}>{stat.label}</p>
                  </a>
                ))}
              </div>
            </Card>

            {/* ── Alertas críticos inline se houver ───────────── */}
            {(data.alertas.atividades_atrasadas > 0 || data.kpis.renovacoes_criticas > 0) && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Atividades Atrasadas', value: data.alertas.atividades_atrasadas, icon: Zap, color: '#dc2626', href: '/atividades' },
                  { label: 'Tickets Críticos', value: data.alertas.tickets_criticos, icon: Headphones, color: '#9333ea', href: '/suporte' },
                  { label: 'Renovações Urgentes', value: data.alertas.renovacoes_criticas, icon: RotateCcw, color: '#ea580c', href: '/renovacoes' },
                  { label: 'Clientes em Risco', value: data.alertas.hs_em_risco, icon: AlertTriangle, color: '#d97706', href: '/health-score' },
                ].filter(a => a.value > 0).map(alert => (
                  <a
                    key={alert.label}
                    href={alert.href}
                    className="flex items-center gap-3 p-4 rounded-2xl transition-all hover:scale-105 hover:shadow-md"
                    style={{ background: `${alert.color}10`, border: `1px solid ${alert.color}30` }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${alert.color}20` }}>
                      <alert.icon size={16} style={{ color: alert.color }} />
                    </div>
                    <div>
                      <p className="text-xl font-black" style={{ color: alert.color }}>{alert.value}</p>
                      <p className="text-[10px] font-semibold leading-tight" style={{ color: alert.color }}>{alert.label}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}

          </>
        )}
      </div>
    </DashboardLayout>
  );
}
