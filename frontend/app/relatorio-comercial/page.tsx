'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, Legend, ComposedChart, Line, Area,
} from 'recharts';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v: any) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

// ── Design System — Relatório Executivo Prosystem (azul institucional #417ABC) ──
const PRO = '#417ABC';        // azul institucional
const PRO_DARK = '#2E5A8F';   // azul escuro (capa/títulos)
const INK = '#0D2238';        // texto forte

// Bloco: card branco com cabeçalho de barra azul e número de seção opcional.
function Bloco({ titulo, num, children }: { titulo: string; num?: string; children: any }) {
  return (
    <div className="rel-bloco ps-card rounded-2xl mb-4" style={{ border: '1px solid #E3ECF5', boxShadow: '0 1px 3px rgba(13,34,56,.04)' }}>
      <div className="flex items-center gap-2.5 px-5 py-3" style={{ borderBottom: '1px solid #EEF3F9' }}>
        {num && <span className="flex items-center justify-center text-xs font-bold text-white rounded-md" style={{ width: 22, height: 22, background: PRO }}>{num}</span>}
        <h2 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: PRO_DARK }}>{titulo}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
// Mapeia as classes Tailwind usadas nas chamadas existentes p/ hex (cor da faixa+número).
const COR_HEX: Record<string, string> = {
  'text-gray-800': INK, 'text-green-700': '#15803d', 'text-blue-700': '#1d4ed8',
  'text-red-600': '#dc2626', 'text-yellow-600': '#ca8a04', 'text-amber-700': '#b45309',
  'text-indigo-700': '#4338ca', 'text-teal-700': '#0f766e',
};
// KPI: card com faixa lateral de cor, rótulo e número grande.
function KPI({ label, valor, cor = INK }: { label: string; valor: any; cor?: string }) {
  const hex = COR_HEX[cor] || (cor.startsWith('#') ? cor : INK);
  return (
    <div className="rounded-xl p-3.5 relative overflow-hidden" style={{ background: '#F7FAFD', border: '1px solid #E9F0F7' }}>
      <span className="absolute left-0 top-0 bottom-0" style={{ width: 4, background: hex }} />
      <p className="text-[11px] font-medium pl-1.5" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-2xl font-extrabold pl-1.5 mt-0.5" style={{ color: hex }}>{valor}</p>
    </div>
  );
}

export default function RelatorioComercialPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [d, setD] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [serie, setSerie] = useState<any[]>([]); // evolução mês a mês do ano

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const r = await apiClient.getRelatorioComercial(ano, mes);
      setD(r.data.data);
    } catch (e) { console.error(e); } finally { setDataLoading(false); }
  }, [ano, mes]);
  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);
  // Série anual (evolução) — recarrega ao trocar o ano.
  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.getRelatorioSerieAnual(ano).then(r => setSerie(r.data?.data?.serie || [])).catch(() => setSerie([]));
  }, [isAuthenticated, ano]);

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  // Tudo vem dos dados REAIS (metricas): capa, visão geral e números do mês usam a
  // MESMA fonte (fechamentos por data_aceite no mês), então sempre batem entre si.
  const mt = d?.metricas;
  const rContratos = mt ? mt.fechamentos.total : (d?.contratos_fechados || 0);
  const rSetup = mt ? mt.fechamentos.setup_total : (d?.instalacao_total || 0);
  const rMrr = mt ? mt.fechamentos.mrr_total : (d?.mrr_total || 0);
  const rPerdidos = mt ? mt.perdidos.total : (d?.cancelamentos || 0);
  const rMrrPerdido = mt ? mt.perdidos.mrr_perdido_total : (d?.mrr_perdido || 0);
  // Meta de contratos: mensal vem de d.meta_contratos (fallback 10 = equipe).
  // No relatório ANUAL (mes=0), a meta é a mensal × 12.
  const metaMensal = d?.meta_contratos || 10;
  const metaContratos = mes === 0 ? metaMensal * 12 : metaMensal;
  const metaPct = metaContratos ? Math.round((rContratos / metaContratos) * 100) : 0;
  const mrrLiquido = Number(rMrr) - Number(rMrrPerdido);
  // Rótulo do período: "Ano de 2026" quando mes=0, senão "Março / 2026".
  const periodoLabel = mes === 0 ? `Ano de ${ano}` : `${MESES[mes]} / ${ano}`;
  // Sufixo dos títulos: "do ano" no anual, "do mês" no mensal.
  const sufPeriodo = mes === 0 ? 'do ano' : 'do mês';
  const SufPeriodo = mes === 0 ? 'do Ano' : 'do Mês';

  return (
    <DashboardLayout>
      {/* Impressão executiva A4: cores fiéis, esconde o que tem print:hidden, evita
          cortar cards no meio da página. */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
          .rel-bloco { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important; }
          aside, nav, header { display: none !important; }
        }
      `}</style>
      <div className="space-y-4 max-w-4xl mx-auto">
        {/* Cabeçalho + seletor + imprimir */}
        <div className="flex items-start justify-between gap-3 flex-wrap print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-sm font-semibold">Relatório Comercial</h1>
            <p className="text-gray-500 mt-1">Resultados {sufPeriodo} — visão executiva para a diretoria</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={mes} onChange={e => setMes(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value={0}>📅 Ano inteiro</option>
              {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select value={ano} onChange={e => setAno(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">🖨️ Imprimir / PDF</button>
          </div>
        </div>

        {dataLoading ? (
          <div className="text-center p-12 ">Carregando…</div>
        ) : !d ? (
          <div className="text-center p-12 ">Sem dados para {periodoLabel}.</div>
        ) : (
          <div id="relatorio">
            {/* Capa executiva (azul institucional Prosystem) */}
            <div className="rounded-2xl mb-5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${PRO_DARK} 0%, ${PRO} 100%)`, boxShadow: '0 8px 24px rgba(46,90,143,.25)' }}>
              <div className="px-7 py-6 text-white">
                <p className="text-[11px] font-bold tracking-[.2em] uppercase" style={{ color: 'rgba(255,255,255,.7)' }}>Relatório Comercial · Prosystem</p>
                <h2 className="text-3xl font-extrabold mt-1">Resultados de {mes === 0 ? `${ano} (ano inteiro)` : `${MESES[mes]} / ${ano}`}</h2>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,.85)' }}>Visão executiva para a diretoria · Supervisora: {d.supervisor || 'Jessica Cardoso'}</p>
                {/* Faixa de KPIs-destaque na capa */}
                {d.metricas && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    {[
                      { l: 'Fechamentos', v: d.metricas.fechamentos.total },
                      { l: 'MRR ganho', v: `${fmt(d.metricas.fechamentos.mrr_total)}` },
                      { l: 'Clientes perdidos', v: d.metricas.perdidos.total },
                      { l: 'Saldo MRR', v: `${d.metricas.entrada_x_saida.saldo_mrr >= 0 ? '+' : ''}${fmt(d.metricas.entrada_x_saida.saldo_mrr)}` },
                    ].map((k, i) => (
                      <div key={i} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)' }}>
                        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,.75)' }}>{k.l}</p>
                        <p className="text-xl font-extrabold text-white mt-0.5">{k.v}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Resumo geral */}
            <Bloco titulo={`Visão Geral ${SufPeriodo}`}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="Contratos fechados" valor={rContratos} cor="text-green-700" />
                <KPI label={`Meta (${metaContratos})`} valor={`${metaPct}%`} cor={metaPct >= 100 ? 'text-green-700' : metaPct >= 70 ? 'text-yellow-600' : 'text-red-600'} />
                <KPI label="Instalações (setup)" valor={fmt(rSetup)} />
                <KPI label={`MRR ${sufPeriodo}`} valor={fmt(rMrr)} cor="text-blue-700" />
                <KPI label="Cancelamentos" valor={rPerdidos} cor="text-red-600" />
                <KPI label="MRR perdido" valor={fmt(rMrrPerdido)} cor="text-red-600" />
                <KPI label="MRR líquido" valor={fmt(mrrLiquido)} cor="text-green-700" />
              </div>
            </Bloco>

            {/* 1B. Métricas reais do mês (leads, fechamentos, perdidos, indicações) */}
            {d.metricas && (
              <>
                <Bloco num="1" titulo={`📊 Números ${SufPeriodo}`}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KPI label="Leads gerados" valor={d.metricas.total_leads} cor="text-indigo-700" />
                    <KPI label="Fechamentos" valor={d.metricas.fechamentos.total} cor="text-green-700" />
                    <KPI label="Ticket médio (setup)" valor={fmt(d.metricas.fechamentos.setup_medio)} />
                    <KPI label="MRR médio" valor={`${fmt(d.metricas.fechamentos.mrr_medio)}/mês`} cor="text-blue-700" />
                    <KPI label="Setup total fechado" valor={fmt(d.metricas.fechamentos.setup_total)} />
                    <KPI label="MRR ganho" valor={`${fmt(d.metricas.fechamentos.mrr_total)}/mês`} cor="text-green-700" />
                    <KPI label="Clientes perdidos" valor={d.metricas.perdidos.total} cor="text-red-600" />
                    <KPI label="Mensalidade perdida" valor={`${fmt(d.metricas.perdidos.mrr_perdido_total)}/mês`} cor="text-red-600" />
                    <KPI label="Total de indicações" valor={d.metricas.indicacoes.total} cor="text-teal-700" />
                    {d.metricas.vendas_adicionais && (
                      <>
                        <KPI label="Setup (vendas adicionais)" valor={fmt(d.metricas.vendas_adicionais.setup_total)} cor="text-green-700" />
                        <KPI label="↑ Mensalidade (adicionais)" valor={`+${fmt(d.metricas.vendas_adicionais.acrescimo_mrr_total)}/mês`} cor="text-blue-700" />
                      </>
                    )}
                  </div>
                </Bloco>

                {/* Evolução anual (tendência mês a mês) */}
                {serie.length > 0 && (
                  <Bloco titulo={`📈 Evolução do Ano (${ano})`}>
                    <div className="print:hidden">
                      <p className="text-xs font-semibold  mb-1">MRR ganho × perdido e saldo por mês</p>
                      <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart data={serie} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eef3f9" />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(v: any) => fmt(v)} />
                          <Legend />
                          <Bar dataKey="mrr_ganho" name="MRR ganho" fill="#16a34a" radius={[4, 4, 0, 0]} animationDuration={900} />
                          <Bar dataKey="mrr_perdido" name="MRR perdido" fill="#dc2626" radius={[4, 4, 0, 0]} animationDuration={900} />
                          <Line type="monotone" dataKey="saldo_mrr" name="Saldo MRR" stroke={PRO} strokeWidth={3} dot={{ r: 3 }} animationDuration={1100} />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <p className="text-xs font-semibold  mb-1 mt-4">Fechamentos × Perdidos por mês</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={serie} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eef3f9" />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Area type="monotone" dataKey="leads" name="Leads" fill="#e0e7ff" stroke="#6366f1" animationDuration={1000} />
                          <Bar dataKey="fechamentos" name="Fechamentos" fill="#16a34a" radius={[4, 4, 0, 0]} animationDuration={900} />
                          <Bar dataKey="perdidos" name="Perdidos" fill="#dc2626" radius={[4, 4, 0, 0]} animationDuration={900} />
                          <Line type="monotone" dataKey="indicacoes" name="Indicações" stroke="#0d9488" strokeWidth={2} dot={{ r: 2 }} animationDuration={1100} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </Bloco>
                )}

                {/* Entrada × Saída — seção gráfica de página inteira */}
                <Bloco num="2" titulo={`🔄 Entrada × Saída ${SufPeriodo}`}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="rounded-xl p-4 text-center" style={{ background: '#dcfce7', border: '1px solid #86efac' }}>
                      <p className="text-xs text-green-800 font-semibold">ENTRADA</p>
                      <p className="text-2xl font-extrabold text-green-700 mt-1">+{d.metricas.entrada_x_saida.clientes_entrada} clientes</p>
                      <p className="text-sm text-green-700">{fmt(d.metricas.entrada_x_saida.mrr_entrada)}/mês de MRR</p>
                    </div>
                    <div className="rounded-xl p-4 text-center" style={{ background: '#fee2e2', border: '1px solid #fca5a5' }}>
                      <p className="text-xs text-red-800 font-semibold">SAÍDA</p>
                      <p className="text-2xl font-extrabold text-red-700 mt-1">-{d.metricas.entrada_x_saida.clientes_saida} clientes</p>
                      <p className="text-sm text-red-700">{fmt(d.metricas.entrada_x_saida.mrr_saida)}/mês de MRR</p>
                    </div>
                    <div className="rounded-xl p-4 text-center" style={{ background: d.metricas.entrada_x_saida.saldo_mrr >= 0 ? '#dbeafe' : '#fef3c7', border: '1px solid #93c5fd' }}>
                      <p className="text-xs text-blue-800 font-semibold">SALDO</p>
                      <p className={`text-2xl font-extrabold mt-1 ${d.metricas.entrada_x_saida.saldo_clientes >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                        {d.metricas.entrada_x_saida.saldo_clientes >= 0 ? '+' : ''}{d.metricas.entrada_x_saida.saldo_clientes} clientes
                      </p>
                      <p className="text-sm text-blue-700">{d.metricas.entrada_x_saida.saldo_mrr >= 0 ? '+' : ''}{fmt(d.metricas.entrada_x_saida.saldo_mrr)}/mês</p>
                    </div>
                  </div>
                  {/* Gráficos animados (Recharts): donut de clientes + barras de MRR */}
                  {(() => {
                    const e = d.metricas.entrada_x_saida;
                    const dadosClientes = [
                      { name: 'Entrada', value: e.clientes_entrada, fill: '#16a34a' },
                      { name: 'Saída', value: e.clientes_saida, fill: '#dc2626' },
                    ].filter(x => x.value > 0);
                    const dadosMRR = [
                      { name: 'Entrada', MRR: e.mrr_entrada, fill: '#16a34a' },
                      { name: 'Saída', MRR: e.mrr_saida, fill: '#dc2626' },
                    ];
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
                        <div>
                          <p className="text-xs font-semibold  mb-1">Clientes (entrada × saída)</p>
                          <ResponsiveContainer width="100%" height={210}>
                            <PieChart>
                              <Pie data={dadosClientes.length ? dadosClientes : [{ name: 'Sem dados', value: 1, fill: '#e5e7eb' }]}
                                dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                                paddingAngle={3} animationDuration={900} label={(p: any) => `${p.name}: ${p.value}`}>
                                {(dadosClientes.length ? dadosClientes : [{ fill: '#e5e7eb' }]).map((x: any, i) => <Cell key={i} fill={x.fill} />)}
                              </Pie>
                              <Tooltip /><Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div>
                          <p className="text-xs font-semibold  mb-1">MRR (R$/mês)</p>
                          <ResponsiveContainer width="100%" height={210}>
                            <BarChart data={dadosMRR} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#eef3f9" />
                              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                              <Tooltip formatter={(v: any) => fmt(v)} />
                              <Bar dataKey="MRR" radius={[6, 6, 0, 0]} animationDuration={900} label={{ position: 'top', formatter: (v: any) => fmt(v), fontSize: 11 }}>
                                {dadosMRR.map((x, i) => <Cell key={i} fill={x.fill} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })()}
                </Bloco>

                {/* Lista de fechamentos do mês (nomes) */}
                {d.metricas.fechamentos.lista.length > 0 && (
                  <Bloco titulo={`✅ Fechamentos ${sufPeriodo} (${d.metricas.fechamentos.total})`}>
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs  border-b"><th className="py-1.5">Cliente</th><th>Vendedor</th><th className="text-right">Setup</th><th className="text-right">MRR</th></tr></thead>
                      <tbody>{d.metricas.fechamentos.lista.map((f: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50"><td className="py-1.5 font-medium ">{f.cliente}</td><td className="text-gray-600">{f.vendedor}</td><td className="text-right">{fmt(f.setup)}</td><td className="text-right text-green-700">{fmt(f.mrr)}</td></tr>
                      ))}</tbody>
                    </table>
                  </Bloco>
                )}

                {/* Lista de clientes perdidos (nomes) */}
                {d.metricas.perdidos.lista.length > 0 && (
                  <Bloco titulo={`❌ Clientes perdidos ${sufPeriodo} (${d.metricas.perdidos.total})`}>
                    <div className="space-y-2">
                      {d.metricas.perdidos.lista.map((c: any, i: number) => (
                        <div key={i} className="border border-gray-100 rounded-lg p-3" style={{ background: '#fff8f8' }}>
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <p className="font-semibold ">{c.cliente}</p>
                              <p className="text-xs  mt-0.5">
                                Fila/Técnico: <b className="text-gray-700">{c.tecnico}</b>
                                {c.data ? ` · Inativado em ${new Date(c.data).toLocaleDateString('pt-BR')}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs ">MRR perdido</p>
                              <p className="text-red-600 font-bold">{fmt(c.mrr_perdido)}/mês</p>
                              {Number(c.valor_devedor) > 0 && (
                                <p className="text-xs text-amber-700 mt-0.5">Devedor: <b>{fmt(c.valor_devedor)}</b>{c.dias_atraso ? ` (${c.dias_atraso}d)` : ''}</p>
                              )}
                            </div>
                          </div>
                          <p className="text-sm mt-2"><span className="text-xs font-bold  uppercase">Motivo:</span> <span className="text-gray-700">{c.motivo}</span>{c.fin_situacao ? <span className="text-xs text-amber-700"> · {c.fin_situacao}</span> : null}</p>
                          {c.resumo && (
                            <p className="text-sm  mt-1"><span className="text-xs font-bold  uppercase">Relato:</span> {c.resumo}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Bloco>
                )}

                {/* Vendas adicionais — resultado SEPARADO: setup entrando + aumento de mensalidade */}
                {(() => {
                  const va = d.metricas.vendas_adicionais;
                  if (!va || va.total === 0) return null;
                  const tipoLabel: Record<string, string> = { INDICACAO: 'Indicações', REVENDA: 'Revendas', COMUNICACAO: 'Comunicação', TROCA_CNPJ: 'Troca de CNPJ' };
                  return (
                    <Bloco titulo={`➕ Vendas adicionais ${sufPeriodo} (${va.total}) — resultado separado`}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <KPI label="Setup entrando" valor={fmt(va.setup_total)} cor="text-green-700" />
                        <KPI label="Setup médio" valor={fmt(va.setup_medio)} />
                        <KPI label="Aumento de mensalidade" valor={`+${fmt(va.acrescimo_mrr_total)}/mês`} cor="text-blue-700" />
                        <KPI label="Aumento médio (valor médio)" valor={`+${fmt(va.acrescimo_medio)}/mês`} cor="text-blue-700" />
                      </div>
                      {va.por_tipo?.length > 0 && (
                        <table className="w-full text-sm mb-3">
                          <thead><tr className="text-left text-xs  border-b"><th className="py-1.5">Tipo</th><th className="text-right">Qtd</th><th className="text-right">Setup</th><th className="text-right">Aumento de mensalidade</th></tr></thead>
                          <tbody>{va.por_tipo.map((t: any) => (
                            <tr key={t.tipo} className="border-b border-gray-50"><td className="py-1.5 font-medium ">{tipoLabel[t.tipo] || t.tipo}</td><td className="text-right">{t.qtd}</td><td className="text-right text-green-700">{fmt(t.setup)}</td><td className="text-right text-blue-700">+{fmt(t.acrescimo)}/mês</td></tr>
                          ))}</tbody>
                          <tfoot><tr className="border-t-2 font-bold"><td className="py-1.5">Total</td><td className="text-right">{va.total}</td><td className="text-right text-green-700">{fmt(va.setup_total)}</td><td className="text-right text-blue-700">+{fmt(va.acrescimo_mrr_total)}/mês</td></tr></tfoot>
                        </table>
                      )}
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs  border-b"><th className="py-1.5">Cliente</th><th>Parceiro</th><th>Vendedor</th><th className="text-right">Setup</th><th className="text-right">+Mensalidade</th></tr></thead>
                        <tbody>{va.lista.map((v: any, i: number) => (
                          <tr key={i} className="border-b border-gray-50"><td className="py-1.5 font-medium ">{v.cliente}</td><td className="text-gray-600">{v.parceiro}</td><td className="text-gray-500">{v.vendedor}</td><td className="text-right text-green-700">{fmt(v.setup)}</td><td className="text-right text-blue-700">{v.acrescimo > 0 ? `+${fmt(v.acrescimo)}` : '—'}</td></tr>
                        ))}</tbody>
                      </table>
                    </Bloco>
                  );
                })()}

                {/* Lista de indicações/vendas adicionais (nomes) */}
                {d.metricas.indicacoes.lista.length > 0 && (
                  <Bloco titulo={`🤝 Indicações / vendas adicionais ${sufPeriodo} (${d.metricas.indicacoes.total})`}>
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs  border-b"><th className="py-1.5">Cliente</th><th>Parceiro</th><th>Vendedor</th><th>Status</th></tr></thead>
                      <tbody>{d.metricas.indicacoes.lista.map((v: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50"><td className="py-1.5 font-medium ">{v.cliente}</td><td className="text-gray-600">{v.parceiro}</td><td className="text-gray-500">{v.vendedor}</td><td className="text-xs">{v.status}</td></tr>
                      ))}</tbody>
                    </table>
                  </Bloco>
                )}

                {/* Comissões e Vendas Adicionais/Indicações foram movidas para o
                    módulo próprio "Comissões & Vendas" (menu). Não ficam mais aqui. */}
              </>
            )}

            {/* 2. Pipeline geral */}
            <Bloco titulo="2. Pipeline Geral">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="Total propostas" valor={d.propostas_total} />
                <KPI label="Em negociação" valor={d.propostas_negociacao} cor="text-yellow-600" />
                <KPI label="Fechadas" valor={d.propostas_fechadas} cor="text-green-700" />
                <KPI label="Declinadas" valor={d.propostas_declinadas} cor="text-red-600" />
                <KPI label="Setup potencial" valor={fmt(d.setup_potencial)} />
                <KPI label="MRR potencial" valor={`${fmt(d.mrr_potencial)}/mês`} cor="text-blue-700" />
                <KPI label="ARR potencial" valor={fmt(Number(d.mrr_potencial || 0) * 12)} />
              </div>
            </Bloco>

            {/* 3. Por vendedor */}
            {Array.isArray(d.por_vendedor) && d.por_vendedor.length > 0 && (
              <Bloco titulo="3. Pipeline por Vendedor">
                {/* Gráfico animado: fechadas × em negociação por vendedor */}
                <div className="print:hidden">
                  <ResponsiveContainer width="100%" height={Math.max(160, d.por_vendedor.length * 46)}>
                    <BarChart layout="vertical" data={d.por_vendedor.slice(0, 10).map((v: any) => ({ nome: v.nome, Fechadas: v.fechadas, 'Em negociação': v.em_negociacao }))}
                      margin={{ top: 6, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef3f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip /><Legend />
                      <Bar dataKey="Fechadas" fill="#16a34a" radius={[0, 5, 5, 0]} animationDuration={900} />
                      <Bar dataKey="Em negociação" fill={PRO} radius={[0, 5, 5, 0]} animationDuration={900} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="w-full text-sm mt-3">
                  <thead><tr className="text-left text-xs  border-b border-gray-100">
                    <th className="py-2">Vendedor</th><th>Propostas</th><th>Setup pot.</th><th>MRR pot.</th><th>Em neg.</th><th>Fechadas</th><th>Part.</th>
                  </tr></thead>
                  <tbody>
                    {d.por_vendedor.map((v: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 font-medium">{v.nome}</td><td>{v.propostas}</td><td>{fmt(v.setup_potencial)}</td>
                        <td>{fmt(v.mrr_potencial)}</td><td>{v.em_negociacao}</td><td className="text-green-700 font-semibold">{v.fechadas}</td><td>{v.participacao}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Bloco>
            )}

            {/* 4. Por segmento */}
            {Array.isArray(d.por_segmento) && d.por_segmento.length > 0 && (
              <Bloco titulo="4. Pipeline por Segmento">
                {/* Rosca animada: participação de MRR por segmento */}
                <div className="print:hidden mb-3">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={d.por_segmento.map((s: any) => ({ name: s.segmento, value: Number(s.mrr_total || 0) }))}
                        dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                        paddingAngle={2} animationDuration={900} label={(p: any) => p.name}>
                        {d.por_segmento.map((_: any, i: number) => {
                          const cores = [PRO, '#16a34a', '#d97706', '#7c3aed', '#0d9488', '#dc2626', '#64748b'];
                          return <Cell key={i} fill={cores[i % cores.length]} />;
                        })}
                      </Pie>
                      <Tooltip formatter={(v: any) => `${fmt(v)}/mês`} /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs  border-b border-gray-100">
                    <th className="py-2">Segmento</th><th>Propostas</th><th>Setup total</th><th>MRR total</th><th>Ticket MRR</th><th>Part. MRR</th>
                  </tr></thead>
                  <tbody>
                    {d.por_segmento.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 font-medium">{s.segmento}</td><td>{s.propostas}</td><td>{fmt(s.setup_total)}</td>
                        <td>{fmt(s.mrr_total)}</td><td>{fmt(s.ticket_mrr)}</td><td>{s.participacao}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Bloco>
            )}

            {/* 5. Contratos fechados */}
            {Array.isArray(d.contratos_lista) && d.contratos_lista.length > 0 && (
              <Bloco titulo="5. Contratos Fechados">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs  border-b border-gray-100">
                    <th className="py-2">Empresa</th><th>Segmento</th><th>Instalação</th><th>MRR</th><th>Origem</th>
                  </tr></thead>
                  <tbody>
                    {d.contratos_lista.map((c: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 font-medium">{c.empresa}</td><td>{c.segmento}</td><td>{fmt(c.instalacao)}</td><td>{fmt(c.mrr)}</td><td className="text-gray-500">{c.origem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Bloco>
            )}

            {/* 6. Marketing */}
            {d.marketing && (
              <Bloco titulo="6. Marketing">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPI label="Investido" valor={fmt(d.marketing.investido)} />
                  <KPI label="Resultados" valor={d.marketing.resultados} />
                  <KPI label="Impressões" valor={Number(d.marketing.impressoes || 0).toLocaleString('pt-BR')} />
                  <KPI label="ROI" valor={d.marketing.roi ? `${d.marketing.roi}x` : '—'} cor="text-green-700" />
                </div>
              </Bloco>
            )}

            {/* 7. Cancelamentos */}
            {Array.isArray(d.cancelamentos_lista) && d.cancelamentos_lista.length > 0 && (
              <Bloco titulo="7. Cancelamentos">
                {d.cancelamentos_lista.map((c: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-50">
                    <span className="text-gray-700">{c.motivo}</span><span className="font-semibold text-red-600">{c.qtd} cliente(s)</span>
                  </div>
                ))}
              </Bloco>
            )}

            {/* 8. Resumo executivo */}
            {Array.isArray(d.resumo_executivo) && d.resumo_executivo.length > 0 && (
              <Bloco titulo="Resumo Executivo">
                <ul className="space-y-1 text-sm">
                  {d.resumo_executivo.map((r: string, i: number) => <li key={i} className="text-gray-700">{r}</li>)}
                </ul>
              </Bloco>
            )}

            <p className="text-xs  text-center mt-4 print:hidden">
              Pipeline calculado automaticamente das propostas. Dados de receita/marketing/churn podem ser editados via API.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
