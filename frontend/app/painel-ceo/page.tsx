'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const PRO = '#417ABC', PRO_DARK = '#2E5A8F';
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

  // 12 KPIs principais (cards grandes, mobile-first).
  const cards = d ? [
    { l: 'MRR Atual', v: fmt(d.mrr_atual), cor: PRO, sub: 'receita recorrente da base' },
    { l: 'Net New MRR', v: `${d.net_new_mrr >= 0 ? '+' : ''}${fmt(d.net_new_mrr)}`, cor: d.net_new_mrr >= 0 ? '#16a34a' : '#dc2626', sub: 'novo + expansão − churn' },
    { l: 'Novos Clientes', v: num(d.novos_clientes), cor: '#16a34a', sub: fmt(d.mrr_novo) + '/mês' },
    { l: 'Cancelamentos', v: num(d.cancelamentos), cor: '#dc2626', sub: fmt(d.mrr_perdido) + ' perdido' },
    { l: 'Churn %', v: `${d.churn_pct}%`, cor: d.churn_pct > 3 ? '#dc2626' : '#16a34a', sub: d.cancelamentos > 0 ? 'da base ativa' : 'nenhuma inativação com data no período' },
    { l: 'Ticket Médio', v: fmt(d.ticket_medio), cor: PRO, sub: 'MRR por cliente' },
    { l: 'Pipeline Total', v: fmt(d.pipeline_mrr), cor: '#7c3aed', sub: `${d.pipeline_qtd} oportunidades` },
    { l: 'Previsão da Meta', v: `${d.previsao_meta_pct}%`, cor: d.previsao_meta_pct >= 100 ? '#16a34a' : d.previsao_meta_pct >= 70 ? '#ca8a04' : '#dc2626', sub: `${d.fechados_mes}/${d.meta_contratos} contratos` },
    { l: 'Leads Gerados', v: num(d.leads), cor: '#4338ca', sub: `${d.leads_campanha} de campanha` },
    { l: 'CAC', v: d.cac != null ? fmt(d.cac) : '— (preencher)', cor: '#0d9488', sub: 'custo de aquisição' },
    { l: 'NPS', v: d.nps != null ? num(d.nps) : '— (sem pesquisas no período)', cor: '#0d9488', sub: d.nps_amostra ? `${d.nps_amostra} resposta(s) no período` : 'satisfação' },
    { l: 'Caixa Disponível', v: d.caixa_disponivel != null ? fmt(d.caixa_disponivel) : '— (preencher)', cor: PRO_DARK, sub: 'saldo em caixa' },
  ] : [];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-3 md:p-5">
        {/* Capa */}
        <div className="rounded-2xl mb-4 overflow-hidden" style={{ background: `linear-gradient(135deg, ${PRO_DARK}, ${PRO})` }}>
          <div className="px-5 py-5 text-white">
            <p className="text-[11px] font-bold tracking-[.2em] uppercase" style={{ color: 'rgba(255,255,255,.7)' }}>Painel Executivo · Prosystem</p>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-1">Visão do CEO</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,.85)' }}>Direção, crescimento, rentabilidade e previsibilidade.</p>
          </div>
        </div>

        {/* Filtros de período (mobile-first) */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            {PERIODOS.map(p => (
              <button key={p.id} onClick={() => setPeriodo(p.id as any)}
                className={`px-3 py-2 text-sm font-medium ${periodo === p.id ? 'text-white' : 'text-gray-600 bg-white'}`}
                style={periodo === p.id ? { background: PRO } : {}}>{p.l}</button>
            ))}
          </div>
          {(periodo === 'mes' || periodo === 'trimestre') && (
            <select value={mes} onChange={e => setMes(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          )}
          <select value={ano} onChange={e => setAno(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {carregando ? (
          <div className="text-center py-16 ">Carregando…</div>
        ) : !d ? (
          <div className="text-center py-16 ">Sem dados para o período.</div>
        ) : (
          <>
            {/* 12 indicadores — grid responsivo (2 col no celular, 3-4 no desktop) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
              {cards.map((c, i) => (
                <div key={i} className="ps-card rounded-2xl p-4 relative overflow-hidden" style={{ border: '1px solid #E3ECF5', boxShadow: '0 1px 3px rgba(13,34,56,.05)' }}>
                  <span className="absolute left-0 top-0 bottom-0" style={{ width: 4, background: c.cor }} />
                  <p className="text-[11px] font-medium  pl-1.5">{c.l}</p>
                  <p className="text-2xl font-extrabold pl-1.5 mt-1" style={{ color: c.cor }}>{c.v}</p>
                  <p className="text-[10px]  pl-1.5 mt-0.5">{c.sub}</p>
                </div>
              ))}
            </div>

            {/* Marketing: gasto × retorno */}
            <div className="ps-card rounded-2xl p-4 mb-5" style={{ border: '1px solid #E3ECF5' }}>
              <h2 className="text-sm font-extrabold uppercase mb-3" style={{ color: PRO_DARK }}>📣 Marketing — gasto × retorno</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mini l="Investido" v={d.marketing_investido != null ? fmt(d.marketing_investido) : '— (preencher)'} />
                <Mini l="Leads de campanha" v={num(d.leads_campanha)} />
                <Mini l="CPL" v={d.cpl != null ? fmt(d.cpl) : '—'} />
                <Mini l="Retorno (MRR novo / investido)" v={d.roi_marketing != null ? `${d.roi_marketing}x` : '—'} cor={d.roi_marketing >= 1 ? '#16a34a' : '#dc2626'} />
              </div>
            </div>

            {/* Financeiro do setor */}
            <div className="ps-card rounded-2xl p-4 mb-5" style={{ border: '1px solid #E3ECF5' }}>
              <h2 className="text-sm font-extrabold uppercase mb-3" style={{ color: PRO_DARK }}>💼 Financeiro</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Mini l="Faturamento" v={d.faturamento != null ? fmt(d.faturamento) : '— (preencher)'} />
                <Mini l="Contas a receber" v={d.contas_a_receber != null ? fmt(d.contas_a_receber) : '—'} />
                <Mini l="Inadimplência" v={d.inadimplencia != null ? fmt(d.inadimplencia) : '—'} cor="#dc2626" />
                <Mini l="Despesas do setor" v={d.despesas_setor != null ? fmt(d.despesas_setor) : '— (preencher)'} cor="#dc2626" />
              </div>
            </div>

            {/* Evolução do ano (tendência) */}
            {serie.length > 0 && (
              <div className="ps-card rounded-2xl p-4 mb-5" style={{ border: '1px solid #E3ECF5' }}>
                <h2 className="text-sm font-extrabold uppercase mb-3" style={{ color: PRO_DARK }}>📈 Evolução do Ano ({ano})</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={serie} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef3f9" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => fmt(v)} /><Legend />
                    <Bar dataKey="mrr_ganho" name="MRR ganho" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="mrr_perdido" name="MRR perdido" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="saldo_mrr" name="Saldo MRR" stroke={PRO} strokeWidth={3} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            <p className="text-xs  text-center">
              Indicadores manuais (CAC, caixa, NPS, marketing, despesas) são lançados mês a mês em <button onClick={() => router.push('/indicadores-ceo')} className="text-blue-600 underline">Indicadores do CEO</button>.
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Mini({ l, v, cor = '#0D2238' }: { l: string; v: any; cor?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#F7FAFD', border: '1px solid #E9F0F7' }}>
      <p className="text-[11px] ">{l}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: cor }}>{v}</p>
    </div>
  );
}
