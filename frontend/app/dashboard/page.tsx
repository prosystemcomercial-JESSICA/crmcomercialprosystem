'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  RefreshCw, TrendingUp, TrendingDown,
  DollarSign, FileCheck2, BarChart3, Star, Target,
  Percent, FileText, Headphones, XCircle,
  Flame, Thermometer, Snowflake, CheckCircle2, ClipboardList,
  AlertTriangle, Zap, Heart, ChevronDown,
  Phone, Mail, Users, Car, Bell, FileOutput, Pin, ArrowRight,
} from 'lucide-react';
import { MrrTrendCard } from './components/MrrTrendCard';
import { PipelineFunnelChart } from './components/PipelineFunnelChart';
import { TemperaturaGauge } from './components/TemperaturaGauge';

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
function KpiCard({
  label, value, sub, icon: Icon, accent = 'var(--t-primary)', delta, pulse, animate: doAnimate, rawValue,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  accent?: string; delta?: number; pulse?: boolean; animate?: boolean; rawValue?: number;
}) {
  return (
    <div className="ps-card rounded-xl p-5 group transition-all duration-200 hover:shadow-md relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-20 h-20 opacity-[0.04] pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
      />
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}14` }}
        >
          <Icon size={16} style={{ color: accent }} />
        </div>
        <div className="flex items-center gap-1.5">
          {pulse && <PulseDot color={accent} />}
          {delta !== undefined && (
            <span
              className="flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
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
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--t-text-muted)' }}>
        {label}
      </p>
      <p className="text-[22px] font-bold tracking-tight leading-none" style={{ color: 'var(--t-text-primary)' }}>
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
      `}</style>

      <div className="space-y-5 pb-10">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="du-fade flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--t-text-primary)' }}>
              Dashboard Executivo
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
              Visão 360° do negócio
              {lastUpdate && (
                <span className="ml-2">
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

            {/* ── Hero MRR ─────────────────────────────────────── */}
            <MrrTrendCard
              mrr={data.kpis.mrr}
              mrrDelta={data.kpis.mrr_delta}
              contratosAtivos={data.kpis.contratos_ativos}
              contratosMes={data.kpis.contratos_mes}
              AnimatedNumber={AnimatedNumber}
              fmt={fmt}
            />

            {/* ── KPIs Comercial ───────────────────────────────── */}
            <div className="du-fade-2">
              <SectionLabel>Comercial — Este Mês</SectionLabel>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <KpiCard
                  label="Leads Captados" value={fmtNum(data.kpis.leads_mes)}
                  sub={`${data.kpis.leads_ganhos_mes} convertidos`} icon={Target} accent="#4B8EC8"
                />
                <KpiCard
                  label="Taxa de Conversão" value={`${data.kpis.taxa_conversao}%`}
                  sub={`mês anterior: ${data.kpis.leads_ganhos_mes_anterior} ganhos`}
                  icon={Percent}
                  accent={data.kpis.taxa_conversao >= 20 ? '#16a34a' : '#d97706'}
                  pulse={data.kpis.taxa_conversao < 10}
                />
                <KpiCard
                  label="Pipeline Total" value={fmt(data.kpis.pipeline_valor)}
                  sub="valor estimado em aberto" icon={BarChart3} accent="#6366F1"
                />
                <KpiCard
                  label="Propostas Abertas" value={fmtNum(data.kpis.propostas_abertas)}
                  sub={`${data.kpis.propostas_aceitas_mes} aceitas este mês`} icon={FileText} accent="#8B5CF6"
                />
                <KpiCard
                  label="Perdidos no Mês" value={fmtNum(data.kpis.leads_perdidos_mes)}
                  sub={`mês anterior: ${data.kpis.leads_perdidos_mes_anterior}`}
                  icon={XCircle}
                  accent={data.kpis.leads_perdidos_mes > 0 ? '#dc2626' : '#16a34a'}
                />
              </div>
            </div>

            {/* ── Pipeline de Propostas ───────────────────────── */}
            {data.pipeline_propostas && (
              <div className="du-fade-3">
                <SectionLabel>Pipeline de Propostas</SectionLabel>

                {/* KPIs row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                  <KpiCard
                    label="Total de Propostas" value={fmtNum(data.pipeline_propostas.total)}
                    sub={`${data.pipeline_propostas.perdido.count} perdida${data.pipeline_propostas.perdido.count !== 1 ? 's' : ''}`}
                    icon={ClipboardList} accent="#4B8EC8"
                  />
                  <KpiCard
                    label="MRR em Negociação"
                    value={fmt(data.pipeline_propostas.quente.mrr + data.pipeline_propostas.morno.mrr + data.pipeline_propostas.frio.mrr)}
                    sub="mensalidades em aberto" icon={DollarSign} accent="#16a34a"
                  />
                  <KpiCard
                    label="Setup em Negociação"
                    value={fmt(data.pipeline_propostas.quente.setup + data.pipeline_propostas.morno.setup + data.pipeline_propostas.frio.setup)}
                    sub="implantações em aberto" icon={BarChart3} accent="#7c3aed"
                  />
                  <KpiCard
                    label="Já Fechado (Setup)"
                    value={fmt(data.pipeline_propostas.fechado.setup)}
                    sub={`MRR +${fmt(data.pipeline_propostas.fechado.mrr)}/mês · ${data.pipeline_propostas.fechado.count} prop.`}
                    icon={CheckCircle2} accent="#15803d" pulse
                  />
                </div>

                {/* Temperatura breakdown */}
                <div className="ps-card rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>Propostas por Temperatura</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {[
                      { label: 'Quente', sub: 'Em negociação ativa', icon: Flame, d: data.pipeline_propostas.quente, accent: '#dc2626', bg: 'rgba(220,38,38,0.06)' },
                      { label: 'Morno', sub: 'Retorno pendente', icon: Thermometer, d: data.pipeline_propostas.morno, accent: '#d97706', bg: 'rgba(217,119,6,0.06)' },
                      { label: 'Frio', sub: 'Ainda não enviada', icon: Snowflake, d: data.pipeline_propostas.frio, accent: '#2563eb', bg: 'rgba(37,99,235,0.06)' },
                    ].map(({ label, sub, icon: Icon, d, accent, bg }) => (
                      <div key={label} className="rounded-lg p-4" style={{ background: bg, border: `1px solid ${accent}18` }}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}18` }}>
                              <Icon size={14} style={{ color: accent }} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold" style={{ color: accent }}>{label}</p>
                              <p className="text-[10px]" style={{ color: `${accent}99` }}>{sub}</p>
                            </div>
                          </div>
                          <span className="text-xl font-bold" style={{ color: accent }}>{d.count}</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-medium" style={{ color: 'var(--t-text-muted)' }}>MRR</span>
                            <span className="text-xs font-bold" style={{ color: accent }}>{fmt(d.mrr)}</span>
                          </div>
                          <div className="h-px" style={{ background: `${accent}20` }} />
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-medium" style={{ color: 'var(--t-text-muted)' }}>Setup</span>
                            <span className="text-xs font-bold" style={{ color: accent }}>{fmt(d.setup)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Distribuição por temperatura */}
                  <TemperaturaGauge
                    quente={data.pipeline_propostas.quente.count}
                    morno={data.pipeline_propostas.morno.count}
                    frio={data.pipeline_propostas.frio.count}
                  />
                </div>
              </div>
            )}

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

            {/* ── Top 5 Leads ──────────────────────────────────── */}
            <div className="du-fade-4">
              <div className="ps-card rounded-xl p-5">
                <p className="text-xs font-semibold mb-4" style={{ color: 'var(--t-text-primary)' }}>Top 5 Leads — Maior Potencial</p>
                {data.top_leads.length === 0 ? (
                  <p className="text-xs text-center py-8" style={{ color: 'var(--t-text-secondary)' }}>Nenhum lead com valor estimado</p>
                ) : (
                  <div className="space-y-2">
                    {data.top_leads.map((l, i) => {
                      const tempColors: Record<string, { bg: string; color: string; label: string }> = {
                        MUITO_QUENTE: { bg: 'rgba(220,38,38,0.10)', color: '#dc2626', label: 'Muito Quente' },
                        QUENTE:       { bg: 'rgba(239,68,68,0.10)', color: '#ef4444', label: 'Quente' },
                        MORNO:        { bg: 'rgba(217,119,6,0.10)',  color: '#d97706', label: 'Morno' },
                        FRIO:         { bg: 'rgba(37,99,235,0.10)',  color: '#2563eb', label: 'Frio' },
                      };
                      const tc = tempColors[l.temperatura] || tempColors.FRIO;
                      const rankColors = ['#f59e0b', '#9ca3af', '#d97706', 'var(--t-primary)', '#94a3b8'];
                      return (
                        <div
                          key={l.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer"
                          style={{
                            background: i === 0 ? 'var(--t-primary-light)' : 'transparent',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-primary-light)')}
                          onMouseLeave={e => (e.currentTarget.style.background = i === 0 ? 'var(--t-primary-light)' : 'transparent')}
                        >
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-white"
                            style={{ background: rankColors[i] }}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--t-text-primary)' }}>{l.nome}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[9px] font-semibold px-1.5 py-px rounded" style={{ background: tc.bg, color: tc.color }}>
                                {tc.label}
                              </span>
                              <span className="text-[9px]" style={{ color: 'var(--t-text-muted)' }}>{l.probabilidade}% prob.</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-bold" style={{ color: '#16a34a' }}>{fmt(l.valor_ponderado)}</p>
                            <p className="text-[9px]" style={{ color: 'var(--t-text-muted)' }}>ponderado</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Análise de Perdas ────────────────────────────── */}
            {data.kpis.leads_perdidos_mes > 0 && (
              <div className="du-fade-5">
                <SectionLabel>Análise de Negócios Perdidos</SectionLabel>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                  <KpiCard
                    label="Valor Perdido no Mês" value={fmt(data.kpis.valor_perdido_mes)}
                    sub="oportunidades não convertidas" icon={TrendingDown} accent="#dc2626"
                  />
                  <KpiCard
                    label="Taxa de Perda"
                    value={`${data.kpis.leads_mes > 0 ? Math.round((data.kpis.leads_perdidos_mes / data.kpis.leads_mes) * 100) : 0}%`}
                    sub={`${data.kpis.leads_ganhos_mes} ganhos vs ${data.kpis.leads_perdidos_mes} perdidos`}
                    icon={Percent}
                    accent={data.kpis.leads_perdidos_mes > data.kpis.leads_ganhos_mes ? '#dc2626' : '#d97706'}
                  />
                </div>
              </div>
            )}

            {/* ── Atividades em Aberto ─────────────────────────── */}
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
                if (it._atrasada) return { label: 'Atrasada', cor: '#dc2626', bg: 'rgba(220,38,38,0.10)', ordem: 0 };
                const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
                const dias = Math.floor((new Date(it.data_prevista).getTime() - hoje.getTime()) / 86400000);
                if (dias < 0)  return { label: 'Atrasada',         cor: '#dc2626', bg: 'rgba(220,38,38,0.10)', ordem: 0 };
                if (dias <= 3) return { label: 'Prioridade máx.',  cor: '#ea580c', bg: 'rgba(234,88,12,0.10)',  ordem: 1 };
                if (dias <= 7) return { label: 'Próxima',          cor: '#d97706', bg: 'rgba(217,119,6,0.10)',  ordem: 2 };
                return                  { label: 'Dentro do prazo', cor: '#16a34a', bg: 'rgba(22,163,74,0.10)', ordem: 3 };
              };

              const ordered = merged
                .map(it => ({ it, cfg: prioCfg(it) }))
                .sort((a, b) => a.cfg.ordem - b.cfg.ordem || new Date(a.it.data_prevista).getTime() - new Date(b.it.data_prevista).getTime());

              const atrasadas = ordered.filter(o => o.cfg.label === 'Atrasada').length;
              const maxima = ordered.filter(o => o.cfg.label === 'Prioridade máx.').length;

              return (
                <div className="ps-card rounded-xl overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>Atividades em Aberto</p>
                      <div className="flex items-center gap-1.5">
                        {atrasadas > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(220,38,38,0.10)', color: '#dc2626' }}>
                            <PulseDot color="#dc2626" />{atrasadas} atrasada{atrasadas !== 1 ? 's' : ''}
                          </span>
                        )}
                        {maxima > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,88,12,0.10)', color: '#ea580c' }}>
                            {maxima} expirando
                          </span>
                        )}
                      </div>
                    </div>
                    <a href="/atividades" className="flex items-center gap-1 text-[11px] font-semibold transition-opacity hover:opacity-70" style={{ color: 'var(--t-primary)' }}>
                      Ver todas <ArrowRight size={11} />
                    </a>
                  </div>
                  {ordered.length === 0 ? (
                    <p className="p-8 text-center text-xs font-medium" style={{ color: '#16a34a' }}>Tudo em dia — sem atividades urgentes.</p>
                  ) : (
                    <div>
                      {ordered.slice(0, 10).map(({ it, cfg }) => {
                        const t = TIPO_LABEL[it.tipo] || { Icon: Pin, label: 'Outro' };
                        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
                        const dias = Math.floor((new Date(it.data_prevista).getTime() - hoje.getTime()) / 86400000);
                        const diasLabel = dias < 0 ? `${Math.abs(dias)}d atrasada` : dias === 0 ? 'hoje' : `em ${dias}d`;
                        return (
                          <a key={it.id} href="/atividades"
                            className="px-5 py-3 flex items-center gap-3 transition-colors"
                            style={{
                              borderBottom: '1px solid var(--t-card-border)',
                              borderLeft: `2px solid ${cfg.cor}`,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-primary-light)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span className="flex-shrink-0 rounded-md flex items-center justify-center" style={{ width: 26, height: 26, background: `${cfg.cor}12`, color: cfg.cor }}>
                              <t.Icon size={13} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-medium truncate" style={{ color: 'var(--t-text-primary)' }}>{it.titulo}</p>
                                <span className="text-[9px] font-semibold px-1.5 py-px rounded" style={{ background: cfg.bg, color: cfg.cor }}>
                                  {cfg.label}
                                </span>
                              </div>
                              {it.lead && (
                                <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>
                                  {it.lead.nome}{(it.lead as any).empresa ? ` · ${(it.lead as any).empresa}` : ''}
                                </p>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: cfg.cor }}>{diasLabel}</span>
                          </a>
                        );
                      })}
                      {ordered.length > 10 && (
                        <a href="/atividades" className="flex items-center justify-center gap-1 py-3 text-[11px] font-semibold transition-opacity hover:opacity-70" style={{ color: 'var(--t-primary)', borderTop: '1px solid var(--t-card-border)' }}>
                          + {ordered.length - 10} atividades
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Financeiro & Base ────────────────────────────── */}
            {(() => {
              const temMrr = data.kpis.mrr > 0;
              const temContratos = data.kpis.contratos_ativos > 0;
              const temNps = data.kpis.nps_score !== null;
              const temSaude = data.alertas.hs_em_risco > 0 || data.kpis.hs_criticos > 0 || data.kpis.renovacoes_criticas > 0;
              const temDados = temMrr || temContratos || temNps || temSaude;
              const aberto = showFinanceiro || temDados;
              return (
                <div className="ps-card rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowFinanceiro(p => !p)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors"
                    style={{ borderBottom: aberto ? '1px solid var(--t-card-border)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-primary-light)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>
                        Financeiro, Contratos & Base de Clientes
                      </span>
                      {!temDados && (
                        <span className="text-[10px] px-2 py-px rounded" style={{ background: 'var(--t-card-border)', color: 'var(--t-text-muted)' }}>
                          Sem dados ainda
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      size={14}
                      style={{ color: 'var(--t-text-muted)', transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
                    />
                  </button>

                  {aberto && (
                    <div className="px-5 pb-5 pt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <KpiCard
                          label="NPS Score"
                          value={temNps ? String(data.kpis.nps_score) : '—'}
                          sub={temNps
                            ? (data.kpis.nps_score! >= 50 ? 'Excelente' : data.kpis.nps_score! >= 0 ? 'Bom' : 'Crítico')
                            : 'sem respostas ainda'}
                          icon={Star}
                          accent={temNps
                            ? (data.kpis.nps_score! >= 50 ? '#16a34a' : data.kpis.nps_score! >= 0 ? '#d97706' : '#dc2626')
                            : '#9CA3AF'}
                        />
                        <KpiCard
                          label="Tickets em Aberto" value={fmtNum(data.kpis.tickets_abertos)}
                          sub={data.kpis.tickets_criticos > 0 ? `${data.kpis.tickets_criticos} críticos` : 'Nenhum crítico'}
                          icon={Headphones}
                          accent={data.kpis.tickets_criticos > 0 ? '#dc2626' : '#4B8EC8'}
                          pulse={data.kpis.tickets_criticos > 0}
                        />
                      </div>

                      {temSaude && (
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Críticos',           value: data.kpis.hs_criticos, icon: AlertTriangle, bg: 'rgba(220,38,38,0.06)', color: '#b91c1c', accent: '#dc2626', href: '/health-score' },
                            { label: 'Em Risco',            value: Math.max(0, data.alertas.hs_em_risco - data.kpis.hs_criticos), icon: Heart, bg: 'rgba(217,119,6,0.06)', color: '#92400e', accent: '#d97706', href: '/health-score' },
                          ].map(stat => (
                            <a key={stat.label} href={stat.href}
                              className="text-center p-4 rounded-xl transition-all duration-150 hover:scale-[1.02]"
                              style={{ background: stat.bg }}>
                              <div className="flex justify-center mb-2"><stat.icon size={18} style={{ color: stat.accent }} /></div>
                              <p className="text-3xl font-bold leading-none mb-1.5" style={{ color: stat.accent }}>
                                <AnimatedNumber value={stat.value} />
                              </p>
                              <p className="text-[10px] font-semibold" style={{ color: stat.color }}>{stat.label}</p>
                            </a>
                          ))}
                        </div>
                      )}

                      {!temDados && (
                        <p className="text-center text-xs py-3" style={{ color: 'var(--t-text-muted)' }}>
                          Estes dados aparecem quando os módulos de Contratos, NPS e Health Score forem utilizados.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

          </>
        )}
      </div>
    </DashboardLayout>
  );
}
