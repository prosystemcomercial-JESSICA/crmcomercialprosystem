'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { TrendingUp, TrendingDown, Settings } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmt = (v: any) => v == null ? '—' : `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
const num = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR');

export default function PainelCEOPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const hoje = new Date();
  const [periodo, setPeriodo] = useState<'hoje' | 'mes' | 'trimestre' | 'ano'>('mes');
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [d, setD] = useState<any>(null);
  const [serie, setSerie] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const load = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await apiClient.getPainelCEO({ periodo, ano, mes });
      setD(r.data?.data?.indicadores || null);
    } catch { setD(null); } finally { setCarregando(false); }
  }, [periodo, ano, mes]);
  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);
  useEffect(() => {
    if (isAuthenticated) apiClient.getRelatorioSerieAnual(ano).then(r => setSerie(r.data?.data?.serie || [])).catch(() => setSerie([]));
  }, [isAuthenticated, ano]);

  if (loading || !isAuthenticated) return null;

  const PERIODOS = [{ id: 'hoje', l: 'Hoje' }, { id: 'mes', l: 'Mês' }, { id: 'trimestre', l: 'Trimestre' }, { id: 'ano', l: 'Ano' }];

  // Últimos 6 meses até o mês selecionado — janela curta o bastante para caber
  // num sparkline de card sem virar um gráfico completo.
  const mesAteAgora = periodo === 'ano' ? 12 : mes;
  const ultimos6 = serie.slice(Math.max(0, mesAteAgora - 6), mesAteAgora);

  // KPIs secundários. Sparkline só entra quando existe série mensal real por
  // trás (fechamentos/perdidos vêm de serie-anual) — sem inventar tendência
  // para métricas que não têm histórico mensal armazenado (pipeline, leads,
  // ticket médio ainda não são calculados mês a mês em nenhuma rota).
  const kpisSecundarios = d ? [
    { l: 'Novos Clientes', v: num(d.novos_clientes), sub: `${fmt(d.mrr_novo)}/mês`, spark: ultimos6.map(s => s.fechamentos), sparkCor: 'var(--t-success)' },
    { l: 'Cancelamentos', v: num(d.cancelamentos), sub: `${fmt(d.mrr_perdido)} perdido`, spark: ultimos6.map(s => s.perdidos), sparkCor: 'var(--t-error)' },
    { l: 'Churn %', v: `${d.churn_pct}%`, sub: d.cancelamentos > 0 ? 'da base ativa' : 'sem inativação no período', cor: d.churn_pct > 3 ? 'var(--t-error)' : 'var(--t-success)' },
    { l: 'Ticket Médio', v: fmt(d.ticket_medio), sub: 'MRR por cliente' },
    { l: 'Pipeline Total', v: fmt(d.pipeline_mrr), sub: `${d.pipeline_qtd} oportunidades`, cor: '#7c3aed' },
    { l: 'Leads Gerados', v: num(d.leads), sub: `${d.leads_campanha} de campanha` },
    { l: 'CAC', v: d.cac != null ? fmt(d.cac) : '— preencher', sub: 'custo de aquisição', vazio: d.cac == null },
    { l: 'NPS', v: d.nps != null ? num(d.nps) : 'sem dados', sub: d.nps_amostra ? `${d.nps_amostra} resposta(s) no período` : 'satisfação', vazio: d.nps == null },
  ] : [];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-3 md:p-5">
        {/* ── Capa com hero: os 3 números que definem o mês, sem precisar rolar ── */}
        <div className="rounded-2xl mb-4 overflow-hidden relative" style={{ background: `linear-gradient(135deg, var(--ps-navy), var(--t-primary-deep))` }}>
          <div
            className="absolute pointer-events-none"
            style={{ top: -60, right: -60, width: 220, height: 220, borderRadius: 999, background: 'radial-gradient(circle, color-mix(in srgb, var(--t-primary) 35%, transparent), transparent 70%)' }}
          />
          <div className="px-5 py-5 text-white relative z-10">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[.2em] uppercase" style={{ color: 'color-mix(in srgb, var(--t-primary) 55%, white)' }}>Painel Executivo · Prosystem</p>
                <h1 className="text-2xl md:text-3xl font-extrabold mt-1">Visão do CEO</h1>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,.7)' }}>Direção, crescimento, rentabilidade e previsibilidade.</p>
              </div>
              <div className="flex rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                {PERIODOS.map(p => (
                  <button key={p.id} onClick={() => setPeriodo(p.id as any)}
                    className="px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{ background: periodo === p.id ? 'rgba(255,255,255,.18)' : 'transparent', color: periodo === p.id ? '#fff' : 'rgba(255,255,255,.65)' }}>
                    {p.l}
                  </button>
                ))}
              </div>
            </div>

            {d && (
              <div className="flex flex-wrap gap-8 mt-4 relative z-10">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,.55)' }}>MRR Atual</p>
                  <p className="text-3xl font-extrabold tracking-tight mt-0.5">{fmt(d.mrr_atual)}</p>
                  {d.mrr_crescimento_pct != null && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold mt-1" style={{ color: d.mrr_crescimento_pct >= 0 ? '#4ADE80' : '#FCA5A5' }}>
                      {d.mrr_crescimento_pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {d.mrr_crescimento_pct >= 0 ? '+' : ''}{d.mrr_crescimento_pct}% vs. início do período
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,.55)' }}>Previsão da Meta</p>
                  <p className="text-2xl font-extrabold tracking-tight mt-0.5">{d.previsao_meta_pct}%</p>
                  <span className="text-xs font-semibold mt-1 block" style={{ color: d.previsao_meta_pct >= 100 ? '#4ADE80' : d.previsao_meta_pct >= 70 ? '#FCD34D' : '#FCA5A5' }}>
                    {d.fechados_mes} de {d.meta_contratos} contratos
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,.55)' }}>Net New MRR</p>
                  <p className="text-2xl font-extrabold tracking-tight mt-0.5">{d.net_new_mrr >= 0 ? '+' : ''}{fmt(d.net_new_mrr)}</p>
                  <span className="text-xs mt-1 block" style={{ color: 'rgba(255,255,255,.6)' }}>novo + expansão − churn</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Seletor de mês/ano (só quando período exige) */}
        {(periodo === 'mes' || periodo === 'trimestre' || periodo === 'ano') && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(periodo === 'mes' || periodo === 'trimestre') && (
              <select value={mes} onChange={e => setMes(Number(e.target.value))} className="px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
                {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            )}
            <select value={ano} onChange={e => setAno(Number(e.target.value))} className="px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}>
              {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}

        {carregando ? (
          <div className="text-center py-16" style={{ color: 'var(--t-text-secondary)' }}>Carregando…</div>
        ) : !d ? (
          <div className="text-center py-16" style={{ color: 'var(--t-text-secondary)' }}>Sem dados para o período.</div>
        ) : (
          <>
            {/* KPIs secundários — faixa única dividida por linhas finas, sparkline
                onde há série mensal real por trás. */}
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden mb-5"
              style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-card-border)' }}
            >
              {kpisSecundarios.map(k => (
                <div key={k.l} style={{ background: 'var(--t-card-bg)' }} className="p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--t-text-muted)' }}>{k.l}</p>
                  <div className="flex items-end justify-between gap-2 mt-1">
                    <p className={`font-extrabold leading-none ${k.vazio ? 'text-sm' : 'text-lg'}`} style={{ color: k.vazio ? 'var(--t-text-muted)' : (k.cor || 'var(--t-text-primary)') }}>{k.v}</p>
                    {k.spark && k.spark.some((v: number) => v > 0) && (
                      <Sparkline data={k.spark} color={k.sparkCor || 'var(--t-primary)'} />
                    )}
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--t-text-muted)' }}>{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Evolução do ano — sobe pra logo após os KPIs, é o conteúdo mais rico da tela */}
            {serie.length > 0 && (
              <div className="ps-card rounded-2xl p-4 mb-5" style={{ border: '1px solid var(--t-card-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-extrabold" style={{ color: 'var(--t-text-primary)' }}>Evolução do MRR — {ano}</h2>
                  <span className="text-[11px]" style={{ color: 'var(--t-text-muted)' }}>ganho · perdido · saldo acumulado</span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={serie} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => fmt(v)} /><Legend />
                    <Bar dataKey="mrr_ganho" name="MRR ganho" fill="var(--t-success)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="mrr_perdido" name="MRR perdido" fill="var(--t-error)" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="saldo_mrr" name="Saldo MRR" stroke="var(--t-primary-dark)" strokeWidth={3} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Marketing: gasto × retorno */}
            <div className="ps-card rounded-2xl p-4 mb-5" style={{ border: '1px solid var(--t-card-border)' }}>
              <h2 className="text-sm font-extrabold uppercase mb-3" style={{ color: 'var(--t-primary-dark)' }}>Marketing — gasto × retorno</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mini l="Investido" v={d.marketing_investido != null ? fmt(d.marketing_investido) : '— preencher'} />
                <Mini l="Leads de campanha" v={num(d.leads_campanha)} />
                <Mini l="CPL" v={d.cpl != null ? fmt(d.cpl) : '—'} />
                <Mini l="Retorno (MRR novo / investido)" v={d.roi_marketing != null ? `${d.roi_marketing}x` : '—'} cor={d.roi_marketing >= 1 ? 'var(--t-success)' : 'var(--t-error)'} />
              </div>
            </div>

            {/* Financeiro do setor */}
            <div className="ps-card rounded-2xl p-4 mb-5" style={{ border: '1px solid var(--t-card-border)' }}>
              <h2 className="text-sm font-extrabold uppercase mb-3" style={{ color: 'var(--t-primary-dark)' }}>Financeiro</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mini l="Faturamento" v={d.faturamento != null ? fmt(d.faturamento) : '— preencher'} />
                <Mini l="Contas a receber" v={d.contas_a_receber != null ? fmt(d.contas_a_receber) : '—'} />
                <Mini l="Inadimplência" v={d.inadimplencia != null ? fmt(d.inadimplencia) : '—'} cor="var(--t-error)" />
                <Mini l="Despesas do setor" v={d.despesas_setor != null ? fmt(d.despesas_setor) : '— preencher'} cor="var(--t-error)" />
              </div>
            </div>

            <button
              onClick={() => router.push('/indicadores-ceo')}
              className="ps-btn-primary mx-auto flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white"
            >
              <Settings size={13} /> Lançar indicadores manuais (CAC, caixa, NPS, marketing, despesas)
            </button>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Mini({ l, v, cor = 'var(--t-text-primary)' }: { l: string; v: any; cor?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
      <p className="text-[11px]" style={{ color: 'var(--t-text-secondary)' }}>{l}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: cor }}>{v}</p>
    </div>
  );
}

// Sparkline minimalista via SVG puro — evita o overhead de um componente
// Recharts completo para um traço de 46×20px dentro de um card de KPI.
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 46, h = 20, pad = 2;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
