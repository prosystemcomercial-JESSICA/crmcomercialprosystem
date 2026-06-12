'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v: any) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

function Bloco({ titulo, children }: { titulo: string; children: any }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 border-b border-gray-100 pb-2">{titulo}</h2>
      {children}
    </div>
  );
}
function KPI({ label, valor, cor = 'text-gray-800' }: { label: string; valor: any; cor?: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${cor}`}>{valor}</p>
    </div>
  );
}

export default function RelatorioComercialPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const hoje = new Date();
  const [ano, setAno] = useState(2026);
  const [mes, setMes] = useState(3);
  const [d, setD] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const r = await apiClient.getRelatorioComercial(ano, mes);
      setD(r.data.data);
    } catch (e) { console.error(e); } finally { setDataLoading(false); }
  }, [ano, mes]);
  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  const metaPct = d?.meta_contratos ? Math.round((d.contratos_fechados / d.meta_contratos) * 100) : 0;
  const mrrLiquido = Number(d?.mrr_total || 0) - Number(d?.mrr_perdido || 0);

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-4xl mx-auto">
        {/* Cabeçalho + seletor + imprimir */}
        <div className="flex items-start justify-between gap-3 flex-wrap print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Relatório Comercial</h1>
            <p className="text-gray-500 mt-1">Resultados do mês — visão executiva para a diretoria</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={mes} onChange={e => setMes(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select value={ano} onChange={e => setAno(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">🖨️ Imprimir / PDF</button>
          </div>
        </div>

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Carregando…</div>
        ) : !d ? (
          <div className="text-center p-12 text-gray-400">Sem dados para {MESES[mes]}/{ano}.</div>
        ) : (
          <div id="relatorio">
            {/* Título do relatório (impressão) */}
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">RESULTADOS COMERCIAIS — {MESES[mes].toUpperCase()} {ano}</h2>
              <p className="text-gray-500 text-sm">Supervisora Comercial: {d.supervisor || 'Jessica Cardoso'} · Prosystem</p>
            </div>

            {/* 1. Resumo geral */}
            <Bloco titulo="1. Resumo Geral do Mês">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="Contratos fechados" valor={d.contratos_fechados} cor="text-green-700" />
                <KPI label={`Meta (${d.meta_contratos})`} valor={`${metaPct}%`} cor={metaPct >= 100 ? 'text-green-700' : metaPct >= 70 ? 'text-yellow-600' : 'text-red-600'} />
                <KPI label="Instalações" valor={fmt(d.instalacao_total)} />
                <KPI label="MRR do mês" valor={fmt(d.mrr_total)} cor="text-blue-700" />
                <KPI label="Cancelamentos" valor={d.cancelamentos} cor="text-red-600" />
                <KPI label="MRR perdido" valor={fmt(d.mrr_perdido)} cor="text-red-600" />
                <KPI label="MRR líquido" valor={fmt(mrrLiquido)} cor="text-green-700" />
              </div>
            </Bloco>

            {/* 1B. Métricas reais do mês (leads, fechamentos, perdidos, indicações) */}
            {d.metricas && (
              <>
                <Bloco titulo="📊 Números do Mês">
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
                  </div>
                </Bloco>

                {/* Entrada × Saída — seção gráfica de página inteira */}
                <Bloco titulo="🔄 Entrada × Saída do Mês (página gráfica)">
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
                  {/* Barras comparativas (CSS puro) */}
                  {(() => {
                    const e = d.metricas.entrada_x_saida; const maxC = Math.max(1, e.clientes_entrada, e.clientes_saida);
                    const maxM = Math.max(1, e.mrr_entrada, e.mrr_saida);
                    return (
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Clientes</p>
                          <div className="flex items-center gap-2"><span className="text-xs w-16 text-green-700">Entrada</span><div className="flex-1 h-4 bg-gray-100 rounded"><div className="h-4 rounded bg-green-500" style={{ width: `${(e.clientes_entrada / maxC) * 100}%` }} /></div><b className="text-xs w-8">{e.clientes_entrada}</b></div>
                          <div className="flex items-center gap-2 mt-1"><span className="text-xs w-16 text-red-700">Saída</span><div className="flex-1 h-4 bg-gray-100 rounded"><div className="h-4 rounded bg-red-500" style={{ width: `${(e.clientes_saida / maxC) * 100}%` }} /></div><b className="text-xs w-8">{e.clientes_saida}</b></div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">MRR (R$/mês)</p>
                          <div className="flex items-center gap-2"><span className="text-xs w-16 text-green-700">Entrada</span><div className="flex-1 h-4 bg-gray-100 rounded"><div className="h-4 rounded bg-green-500" style={{ width: `${(e.mrr_entrada / maxM) * 100}%` }} /></div><b className="text-xs w-20">{fmt(e.mrr_entrada)}</b></div>
                          <div className="flex items-center gap-2 mt-1"><span className="text-xs w-16 text-red-700">Saída</span><div className="flex-1 h-4 bg-gray-100 rounded"><div className="h-4 rounded bg-red-500" style={{ width: `${(e.mrr_saida / maxM) * 100}%` }} /></div><b className="text-xs w-20">{fmt(e.mrr_saida)}</b></div>
                        </div>
                      </div>
                    );
                  })()}
                </Bloco>

                {/* Lista de fechamentos do mês (nomes) */}
                {d.metricas.fechamentos.lista.length > 0 && (
                  <Bloco titulo={`✅ Fechamentos do mês (${d.metricas.fechamentos.total})`}>
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-gray-400 border-b"><th className="py-1.5">Cliente</th><th>Vendedor</th><th className="text-right">Setup</th><th className="text-right">MRR</th></tr></thead>
                      <tbody>{d.metricas.fechamentos.lista.map((f: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50"><td className="py-1.5 font-medium text-gray-800">{f.cliente}</td><td className="text-gray-600">{f.vendedor}</td><td className="text-right">{fmt(f.setup)}</td><td className="text-right text-green-700">{fmt(f.mrr)}</td></tr>
                      ))}</tbody>
                    </table>
                  </Bloco>
                )}

                {/* Lista de clientes perdidos (nomes) */}
                {d.metricas.perdidos.lista.length > 0 && (
                  <Bloco titulo={`❌ Clientes perdidos no mês (${d.metricas.perdidos.total})`}>
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-gray-400 border-b"><th className="py-1.5">Cliente</th><th>Motivo</th><th>Técnico</th><th className="text-right">MRR perdido</th></tr></thead>
                      <tbody>{d.metricas.perdidos.lista.map((c: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50"><td className="py-1.5 font-medium text-gray-800">{c.cliente}</td><td className="text-gray-600">{c.motivo}</td><td className="text-gray-500">{c.tecnico}</td><td className="text-right text-red-600">{fmt(c.mrr_perdido)}</td></tr>
                      ))}</tbody>
                    </table>
                  </Bloco>
                )}

                {/* Lista de indicações/vendas adicionais (nomes) */}
                {d.metricas.indicacoes.lista.length > 0 && (
                  <Bloco titulo={`🤝 Indicações / vendas adicionais do mês (${d.metricas.indicacoes.total})`}>
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-gray-400 border-b"><th className="py-1.5">Cliente</th><th>Parceiro</th><th>Vendedor</th><th>Status</th></tr></thead>
                      <tbody>{d.metricas.indicacoes.lista.map((v: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50"><td className="py-1.5 font-medium text-gray-800">{v.cliente}</td><td className="text-gray-600">{v.parceiro}</td><td className="text-gray-500">{v.vendedor}</td><td className="text-xs">{v.status}</td></tr>
                      ))}</tbody>
                    </table>
                  </Bloco>
                )}

                {/* Comissões com pagamento neste mês (pagas + a pagar) */}
                {d.metricas.comissoes && d.metricas.comissoes.total > 0 && (
                  <Bloco titulo={`💰 Comissões a pagar/pagas neste mês (${d.metricas.comissoes.total})`}>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <KPI label="Total do mês" valor={fmt(d.metricas.comissoes.total_valor)} />
                      <KPI label="Já pagas" valor={fmt(d.metricas.comissoes.pagas_valor)} cor="text-green-700" />
                      <KPI label="A pagar" valor={fmt(d.metricas.comissoes.a_pagar_valor)} cor="text-blue-700" />
                    </div>
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-gray-400 border-b"><th className="py-1.5">Responsável</th><th>Descrição</th><th>Papel</th><th>Valor</th><th>Status</th></tr></thead>
                      <tbody>{d.metricas.comissoes.lista.map((c: any, i: number) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-1.5 font-medium text-gray-800">{c.responsavel}</td>
                          <td className="text-gray-600">{c.descricao}</td>
                          <td className="text-gray-500 text-xs">{c.papel}</td>
                          <td className="text-gray-800">{fmt(c.valor)}</td>
                          <td className="text-xs font-semibold" style={{ color: c.paga ? '#16a34a' : '#2563eb' }}>{c.paga ? 'Paga' : 'A pagar'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </Bloco>
                )}
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
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
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
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
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
                  <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
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

            <p className="text-xs text-gray-400 text-center mt-4 print:hidden">
              Pipeline calculado automaticamente das propostas. Dados de receita/marketing/churn podem ser editados via API.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
