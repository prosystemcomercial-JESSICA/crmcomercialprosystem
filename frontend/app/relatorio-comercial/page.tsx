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
