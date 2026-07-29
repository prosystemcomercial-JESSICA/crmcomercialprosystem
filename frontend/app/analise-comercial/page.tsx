'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  RefreshCw, TrendingUp, Target, Percent, Users, Clock, Repeat, Star,
  Flame, AlertTriangle, Calendar, DollarSign, TrendingDown, ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend, Tooltip, AreaChart, Area,
} from 'recharts';
import { ChartTooltip } from '../dashboard/components/ChartTooltip';

// ── Types (espelha a resposta de GET /analise-comercial) ───────────────────
interface AnaliseComercial {
  periodo_meses: number;
  escopo: 'individual' | 'todos';
  funil: { etapa: string; label: string; qtd: number; taxa_avanco: number | null }[];
  win_rate: {
    geral: number | null; ganhas: number; perdidas: number;
    por_segmento: { segmento: string; ganhas: number; perdidas: number; win_rate: number | null }[];
    por_vendedor: { vendedor_id: string; vendedor_nome: string; ganhas: number; perdidas: number; win_rate: number | null }[];
  };
  atingimento_meta: {
    vendedor_id: string; vendedor_nome: string; realizado_valor: number; meta_valor: number; percentual: number | null;
    dias_decorridos_pct: number; ritmo: 'acima' | 'no_ritmo' | 'abaixo' | null; projecao_fim_mes: number | null;
  }[];
  forecast_comparativo: { vendedor_id: string; vendedor_nome: string; valor_ponderado: number; oportunidades: number }[];
  ticket_medio_historico: { mes: string; ticket_medio_setup: number; ticket_medio_mrr: number; qtd: number }[];
  sazonalidade: { mes: number; ano_atual: number; ano_anterior: number }[];
  churn_mrr: { taxa_percentual: number | null; mrr_perdido_periodo: number; mrr_base_ativo: number };
  expansao_mrr: { taxa_percentual: number | null; mrr_expansao: number; mrr_novo: number };
  projecao_mrr: { mrr_atual: number; pontos: { mes: string; mrr_projetado: number }[] };
  leads_priorizados: { lead_id: string; nome: string; etapa: string; etapa_label: string; temperatura: string; score_pct: number; valor_estimado: number; valor_ponderado: number }[];
  clientes_em_risco: { cliente_id: string; nome: string; score: number; nivel: string; mrr_em_risco: number; tendencia: 'piorando' | 'estavel' | 'melhorando' | null }[];
  nps_segmentado: {
    por_plano: { plano: string; nps: number | null; respostas: number }[];
    por_tempo_casa: { faixa: string; nps: number | null; respostas: number }[];
  };
  sla_resposta_lead: { media_horas: number | null; mediana_horas: number | null; amostra: number };
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const pct = (v: number | null) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`);
const horas = (v: number | null) => {
  if (v === null || v === undefined) return '—';
  if (v < 1) return `${Math.round(v * 60)} min`;
  if (v < 24) return `${v.toFixed(1)}h`;
  return `${(v / 24).toFixed(1)} dias`;
};

const MES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Intervalo real de datas coberto pelo filtro "últimos N meses" (mês corrente incluso).
function intervaloPeriodo(meses: number): string {
  const hoje = new Date();
  const fmtMes = (d: Date) => `${MES_LABEL[d.getMonth()]}/${d.getFullYear()}`;
  if (meses <= 1) return fmtMes(hoje);
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1);
  return `${fmtMes(inicio)} – ${fmtMes(hoje)}`;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${className}`}
      style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} style={{ color: 'var(--t-primary)' }} />
      <div>
        <h3 className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>{title}</h3>
        {subtitle && <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyState({ label = 'Sem dados suficientes neste período' }: { label?: string }) {
  return <p className="text-xs text-center py-6" style={{ color: 'var(--t-text-muted)' }}>{label}</p>;
}

export default function AnaliseComercialPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const gestor = podeVerTudo(user?.role);

  const [data, setData] = useState<AnaliseComercial | null>(null);
  const [fetching, setFetching] = useState(true);
  const [periodoMeses, setPeriodoMeses] = useState(12);
  const [vendedorId, setVendedorId] = useState('');
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const res = await apiClient.getAnaliseComercial({
        vendedor_id: vendedorId || undefined,
        periodo_meses: periodoMeses,
      });
      setData(res.data?.data || null);
    } catch (e) {
      console.error('[ANALISE-COMERCIAL] erro ao carregar:', e);
    } finally {
      setFetching(false);
    }
  }, [vendedorId, periodoMeses]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!gestor) return;
    apiClient.client.get('/usuarios').then(res => {
      const arr = res.data?.data;
      if (Array.isArray(arr)) {
        setVendedores(arr.filter((u: any) => u.cargo === 'VENDEDOR' && u.status === 'ATIVO').map((u: any) => ({ id: u.id, nome: u.nome })));
      }
    }).catch(() => {});
  }, [gestor]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--t-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const sazonalidadeChart = data?.sazonalidade.map(s => ({
    mes: MES_LABEL[s.mes - 1],
    'Este ano': s.ano_atual,
    'Ano anterior': s.ano_anterior,
  })) || [];

  const ticketChart = data?.ticket_medio_historico.map(t => ({
    mes: MES_LABEL[parseInt(t.mes.split('-')[1], 10) - 1],
    Setup: t.ticket_medio_setup,
    'Receita Recorrente': t.ticket_medio_mrr,
  })) || [];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* ─── Header ─────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Análise Comercial</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
              Visão executiva do comercial — funil, conversão, forecast e retenção, período a período.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {gestor && (
              <select value={vendedorId} onChange={e => setVendedorId(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
                style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                <option value="">Todos os vendedores</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            )}
            <select value={periodoMeses} onChange={e => setPeriodoMeses(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: 'var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
              <option value={1}>Mês atual</option>
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
              <option value={24}>Últimos 24 meses</option>
            </select>
            <button onClick={fetchData} disabled={fetching}
              className="p-2 rounded-lg border" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
              <RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ─── Faixa de período selecionado ────── */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium w-fit"
          style={{ background: 'var(--t-content-bg)', color: 'var(--t-text-secondary)', border: '1px solid var(--t-card-border)' }}>
          <Calendar size={14} style={{ color: 'var(--t-primary)' }} />
          Período analisado: <span style={{ color: 'var(--t-text-primary)', fontWeight: 700 }}>{intervaloPeriodo(periodoMeses)}</span>
          {vendedorId && vendedores.find(v => v.id === vendedorId) && (
            <span>· vendedor: <span style={{ color: 'var(--t-text-primary)', fontWeight: 700 }}>{vendedores.find(v => v.id === vendedorId)?.nome}</span></span>
          )}
        </div>

        {fetching && !data ? (
          <Card><EmptyState label="Carregando..." /></Card>
        ) : !data ? (
          <Card><EmptyState label="Não foi possível carregar os dados" /></Card>
        ) : (
          <>
            {/* ─── Resumo executivo (leitura rápida para a diretoria) ── */}
            <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #1A4E82, #2E6EAB)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80 mb-3">Resumo executivo</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 opacity-80 text-xs mb-1"><DollarSign size={13} /> Receita Recorrente Mensal atual</div>
                  <p className="text-2xl font-extrabold">{fmt(data.projecao_mrr.mrr_atual)}</p>
                  <p className="text-[11px] opacity-70 mt-0.5">projeção em 3 meses: {fmt(data.projecao_mrr.pontos[2]?.mrr_projetado ?? data.projecao_mrr.mrr_atual)}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 opacity-80 text-xs mb-1"><Target size={13} /> Win rate geral</div>
                  <p className="text-2xl font-extrabold">{pct(data.win_rate.geral)}</p>
                  <p className="text-[11px] opacity-70 mt-0.5">{data.win_rate.ganhas} fechadas de {data.win_rate.ganhas + data.win_rate.perdidas} propostas</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 opacity-80 text-xs mb-1"><TrendingDown size={13} /> Churn (Receita Recorrente)</div>
                  <p className="text-2xl font-extrabold">{pct(data.churn_mrr.taxa_percentual)}</p>
                  <p className="text-[11px] opacity-70 mt-0.5">{fmt(data.churn_mrr.mrr_perdido_periodo)} perdidos no período</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 opacity-80 text-xs mb-1"><ShieldAlert size={13} /> Clientes em risco</div>
                  <p className="text-2xl font-extrabold">{data.clientes_em_risco.length}</p>
                  <p className="text-[11px] opacity-70 mt-0.5">{fmt(data.clientes_em_risco.reduce((s, c) => s + c.mrr_em_risco, 0))} de receita recorrente em risco</p>
                </div>
              </div>
            </div>

            {/* ─── KPIs de resumo ─────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Win rate (propostas)</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--t-text-primary)' }}>{pct(data.win_rate.geral)}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--t-text-muted)' }}>{data.win_rate.ganhas} ganhas / {data.win_rate.perdidas} perdidas</p>
              </Card>
              <Card>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Churn (Receita Recorrente)</p>
                <p className="text-2xl font-bold" style={{ color: (data.churn_mrr.taxa_percentual || 0) > 5 ? '#dc2626' : 'var(--t-text-primary)' }}>{pct(data.churn_mrr.taxa_percentual)}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--t-text-muted)' }}>Geral: {fmt(data.churn_mrr.mrr_perdido_periodo)} perdidos no período</p>
              </Card>
              <Card>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>Taxa de expansão (upsell)</p>
                <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>{pct(data.expansao_mrr.taxa_percentual)}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--t-text-muted)' }}>{fmt(data.expansao_mrr.mrr_expansao)} de receita recorrente expandida</p>
              </Card>
              <Card>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--t-text-muted)' }}>SLA de resposta ao lead</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--t-text-primary)' }}>{horas(data.sla_resposta_lead.media_horas)}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--t-text-muted)' }}>mediana {horas(data.sla_resposta_lead.mediana_horas)} · {data.sla_resposta_lead.amostra} leads</p>
              </Card>
            </div>

            {/* ─── Funil etapa-a-etapa ────────────── */}
            <Card>
              <SectionTitle icon={Target} title="Funil comercial — taxa de avanço entre etapas" subtitle="Leads ativos hoje, por etapa, e % que avançou da etapa anterior" />
              {data.funil.every(f => f.qtd === 0) ? <EmptyState /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                        <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Etapa</th>
                        <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Leads</th>
                        <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--t-text-muted)' }}>Taxa de avanço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.funil.map(f => (
                        <tr key={f.etapa} style={{ borderBottom: '1px solid var(--t-card-border)' }}>
                          <td className="py-2 px-2" style={{ color: 'var(--t-text-primary)' }}>{f.label}</td>
                          <td className="py-2 px-2 text-right font-semibold" style={{ color: 'var(--t-text-primary)' }}>{f.qtd}</td>
                          <td className="py-2 px-2 text-right" style={{ color: f.taxa_avanco !== null && f.taxa_avanco < 40 ? '#dc2626' : 'var(--t-text-secondary)' }}>
                            {f.taxa_avanco === null ? '—' : pct(f.taxa_avanco)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* ─── Win rate por segmento ──────────── */}
              <Card>
                <SectionTitle icon={Percent} title="Win rate por segmento" />
                {data.win_rate.por_segmento.length === 0 ? <EmptyState /> : (
                  <div className="space-y-2">
                    {data.win_rate.por_segmento.slice(0, 8).map(s => (
                      <div key={s.segmento} className="flex items-center justify-between text-xs">
                        <span style={{ color: 'var(--t-text-secondary)' }}>{s.segmento}</span>
                        <span className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>
                          {pct(s.win_rate)} <span style={{ color: 'var(--t-text-muted)' }}>({s.ganhas}/{s.ganhas + s.perdidas})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* ─── Win rate / forecast por vendedor (só gestor) ── */}
              {gestor && !vendedorId ? (
                <Card>
                  <SectionTitle icon={Users} title="Win rate por vendedor" />
                  {data.win_rate.por_vendedor.length === 0 ? <EmptyState /> : (
                    <div className="space-y-2">
                      {data.win_rate.por_vendedor.map(v => (
                        <div key={v.vendedor_id} className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--t-text-secondary)' }}>{v.vendedor_nome}</span>
                          <span className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>
                            {pct(v.win_rate)} <span style={{ color: 'var(--t-text-muted)' }}>({v.ganhas}/{v.ganhas + v.perdidas})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ) : (
                <Card>
                  <SectionTitle icon={Star} title="NPS por plano" />
                  {data.nps_segmentado.por_plano.length === 0 ? <EmptyState /> : (
                    <div className="space-y-2">
                      {data.nps_segmentado.por_plano.map(p => (
                        <div key={p.plano} className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--t-text-secondary)' }}>{p.plano}</span>
                          <span className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>
                            {p.nps === null ? '—' : p.nps.toFixed(0)} <span style={{ color: 'var(--t-text-muted)' }}>({p.respostas})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* ─── % de atingimento de meta + ritmo ── */}
            <Card>
              <SectionTitle icon={Target} title="% de atingimento de meta (mês atual)" subtitle="Ranking justo: percentual da meta batida, comparado ao ritmo do mês" />
              {data.atingimento_meta.length === 0 ? <EmptyState /> : (
                <div className="space-y-3">
                  {data.atingimento_meta.map(m => {
                    const corRitmo = m.ritmo === 'acima' ? '#16a34a' : m.ritmo === 'abaixo' ? '#dc2626' : '#d97706';
                    const labelRitmo = m.ritmo === 'acima' ? 'Acima do ritmo' : m.ritmo === 'abaixo' ? 'Abaixo do ritmo' : m.ritmo === 'no_ritmo' ? 'No ritmo' : null;
                    return (
                      <div key={m.vendedor_id}>
                        <div className="flex items-center gap-3">
                          <span className="text-xs w-32 truncate" style={{ color: 'var(--t-text-secondary)' }}>{m.vendedor_nome}</span>
                          <div className="flex-1 h-2 rounded-full overflow-hidden relative" style={{ background: 'var(--t-content-bg)' }}>
                            <div className="h-full rounded-full" style={{
                              width: `${Math.min(100, m.percentual ?? 0)}%`,
                              background: (m.percentual ?? 0) >= 100 ? '#16a34a' : (m.percentual ?? 0) >= 60 ? '#d97706' : '#dc2626',
                            }} />
                            <div className="absolute top-0 bottom-0 w-0.5" style={{ left: `${Math.min(100, m.dias_decorridos_pct)}%`, background: 'var(--t-text-muted)' }} title="Ritmo esperado (dia do mês)" />
                          </div>
                          <span className="text-xs font-semibold w-16 text-right" style={{ color: 'var(--t-text-primary)' }}>{pct(m.percentual)}</span>
                        </div>
                        {labelRitmo && (
                          <p className="text-[11px] mt-0.5 ml-[8.5rem]" style={{ color: corRitmo }}>
                            {labelRitmo} · projeção fim do mês: {m.projecao_fim_mes !== null ? fmt(m.projecao_fim_mes) : '—'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* ─── Forecast comparativo ───────────── */}
            {gestor && !vendedorId && (
              <Card>
                <SectionTitle icon={TrendingUp} title="Forecast comparativo por vendedor" subtitle="Receita ponderada pelo pipeline atual (mesma lógica do forecast geral)" />
                {data.forecast_comparativo.length === 0 ? <EmptyState /> : (
                  <div className="space-y-2">
                    {data.forecast_comparativo.map(f => (
                      <div key={f.vendedor_id} className="flex items-center justify-between text-xs">
                        <span style={{ color: 'var(--t-text-secondary)' }}>{f.vendedor_nome}</span>
                        <span className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>
                          {fmt(f.valor_ponderado)} <span style={{ color: 'var(--t-text-muted)' }}>({f.oportunidades} oport.)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* ─── Projeção de Receita Recorrente futura ── */}
            <Card>
              <SectionTitle icon={TrendingUp} title="Projeção de Receita Recorrente Mensal — próximos 3 meses" subtitle="Receita recorrente atual + pipeline ponderado esperado − churn esperado (clientes em risco)" />
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={[{ mes: 'Hoje', mrr: data.projecao_mrr.mrr_atual }, ...data.projecao_mrr.pontos.map(p => ({ mes: p.mes, mrr: p.mrr_projetado }))]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="var(--t-text-muted)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--t-text-muted)" />
                  <Tooltip content={<ChartTooltip formatter={(v) => fmt(Number(v))} />} />
                  <Area type="monotone" dataKey="mrr" name="Receita recorrente projetada" stroke="#16a34a" fill="#16a34a" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* ─── Leads priorizados por score ────── */}
              <Card>
                <SectionTitle icon={Flame} title="Leads priorizados" subtitle="Score de fechamento por sinais históricos (etapa + temperatura), ordenado por valor ponderado" />
                {data.leads_priorizados.length === 0 ? <EmptyState /> : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {data.leads_priorizados.map(l => (
                      <div key={l.lead_id} className="flex items-center justify-between text-xs gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium" style={{ color: 'var(--t-text-primary)' }}>{l.nome}</p>
                          <p style={{ color: 'var(--t-text-muted)' }}>{l.etapa_label} · {l.temperatura}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>{fmt(l.valor_ponderado)}</p>
                          <p style={{ color: 'var(--t-text-muted)' }}>{pct(l.score_pct)} score</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* ─── Clientes em risco de churn (visão geral) ── */}
              <Card>
                <SectionTitle icon={AlertTriangle} title="Clientes em risco de churn" subtitle="Health Score crítico/em risco — visão geral" />
                {data.clientes_em_risco.length === 0 ? <EmptyState label="Nenhum cliente em risco crítico no momento" /> : (
                  <div className="flex items-center justify-center h-full py-6">
                    <div className="text-center">
                      <p className="text-4xl font-extrabold" style={{ color: '#dc2626' }}>{data.clientes_em_risco.length}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--t-text-muted)' }}>
                        {data.clientes_em_risco.length === 1 ? 'cliente em risco' : 'clientes em risco'}
                      </p>
                      <p className="text-lg font-bold mt-4" style={{ color: 'var(--t-text-primary)' }}>
                        {fmt(data.clientes_em_risco.reduce((s, c) => s + c.mrr_em_risco, 0))}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--t-text-muted)' }}>Geral de receita recorrente em risco</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* ─── Ticket médio histórico ─────────── */}
            <Card>
              <SectionTitle icon={TrendingUp} title="Ticket médio histórico" subtitle="Setup e mensalidade médios dos fechamentos, mês a mês" />
              {ticketChart.every(t => t.Setup === 0 && t['Receita Recorrente'] === 0) ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={ticketChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="var(--t-text-muted)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--t-text-muted)" />
                    <Tooltip content={<ChartTooltip formatter={(v) => fmt(Number(v))} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Setup" stroke="#4B8EC8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Receita Recorrente" stroke="#16a34a" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* ─── Sazonalidade YoY ────────────────── */}
            <Card>
              <SectionTitle icon={Repeat} title="Sazonalidade — fechamentos por mês (ano a ano)" />
              {sazonalidadeChart.every(s => s['Este ano'] === 0 && s['Ano anterior'] === 0) ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sazonalidadeChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="var(--t-text-muted)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--t-text-muted)" />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--t-content-bg)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Ano anterior" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Este ano" fill="#4B8EC8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* ─── NPS por tempo de casa ───────────── */}
            <Card>
              <SectionTitle icon={Clock} title="NPS por tempo de casa" subtitle="Satisfação do cliente ao longo do ciclo de vida — sinal de retenção" />
              {data.nps_segmentado.por_tempo_casa.every(t => t.respostas === 0) ? <EmptyState /> : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {data.nps_segmentado.por_tempo_casa.map(t => (
                    <div key={t.faixa} className="rounded-xl p-3 text-center" style={{ background: 'var(--t-content-bg)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--t-text-muted)' }}>{t.faixa}</p>
                      <p className="text-xl font-bold" style={{ color: 'var(--t-text-primary)' }}>{t.nps === null ? '—' : t.nps.toFixed(0)}</p>
                      <p className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>{t.respostas} respostas</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
