'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Previsao { otimista: number; realista: number; pessimista: number; }
interface MetaInfo { periodo: string; valor_alvo: number; valor_atual: number; pct_evolucao: number; falta_para_meta: number; }
interface TopOportunidade {
  id: string;
  nome: string;
  empresa?: string;
  valor_estimado: number;
  probabilidade: number;
  valor_ponderado: number;
  etapa: string;
  status: string;
}

// Mesmas chaves de PROB_ETAPA (backend/src/lib/forecast.ts) — até esta correção,
// /leads/previsao retornava `etapa_funil` (valores tipo PROSPECCAO/PROPOSTA) e
// esta tabela batia; agora que a rota foi unificada para usar a mesma fórmula/
// campo que /dashboard/forecast, `op.etapa` vem de `etapa_comercial`.
const ETAPA_LABELS: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead', PRIMEIRO_CONTATO: 'Primeiro Contato', EM_ATENDIMENTO: 'Em Atendimento',
  AGUARDANDO_RETORNO: 'Aguardando Retorno', PROPOSTA_A_GERAR: 'Proposta a Gerar',
  PROPOSTA_ENVIADA: 'Proposta Enviada', EM_NEGOCIACAO: 'Em Negociação', ACEITO: 'Aceito',
  CONTRATO_EM_ANDAMENTO: 'Contrato em Andamento', CONTRATO_ASSINADO: 'Contrato Assinado',
};

export default function PrevisaoPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [previsao, setPrevisao] = useState<Previsao | null>(null);
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [top, setTop] = useState<TopOportunidade[]>([]);
  const [totalOps, setTotalOps] = useState(0);
  const [pipeline, setPipeline] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [dias, setDias] = useState(30);
  const [forecast, setForecast] = useState<{ receita_esperada: number; valor_pipeline_bruto: number; etapas: { etapa: string; label: string; prob: number; qtd: number; valor_ponderado: number }[] } | null>(null);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    apiClient.getPrevisao(dias)
      .then(res => {
        const d = res.data.data;
        setPrevisao(d.previsao);
        setMeta(d.meta || null);
        setTop(d.top_oportunidades);
        setTotalOps(d.total_oportunidades);
        setPipeline(d.valor_total_pipeline);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
    apiClient.getForecast()
      .then(res => setForecast(res.data.data))
      .catch(console.error);
  }, [isAuthenticated, dias]);

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-sm font-semibold">Previsão de Fechamento</h1>
            <p className="text-gray-500 mt-1">Sua meta do período e a estimativa de receita do seu pipeline</p>
          </div>
          <div className="flex gap-2">
            {[15, 30, 60, 90].map(d => (
              <button key={d} onClick={() => setDias(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${dias === d ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200  hover:bg-opacity-0'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Meta do período (definida pela supervisão) + evolução */}
        {meta && meta.valor_alvo > 0 && (
          <div className="ps-card rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-sm font-semibold">Minha meta — {meta.periodo}</h2>
              <span className="text-sm font-bold text-blue-700">{meta.pct_evolucao}% atingido</span>
            </div>
            <div className="w-full bg-opacity-0 rounded-full h-4 mb-3">
              <div className={`h-4 rounded-full transition-all ${meta.pct_evolucao >= 100 ? 'bg-green-500' : meta.pct_evolucao >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, meta.pct_evolucao)}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-gray-500">Meta</p><p className="font-bold ">{fmt(meta.valor_alvo)}</p></div>
              <div><p className="text-gray-500">Realizado</p><p className="font-bold text-green-700">{fmt(meta.valor_atual)}</p></div>
              <div><p className="text-gray-500">Falta</p><p className="font-bold ">{fmt(meta.falta_para_meta)}</p></div>
            </div>
          </div>
        )}

        {/* Forecast ponderado (EVO-5): receita esperada = Σ valor × probabilidade da etapa */}
        {forecast && (
          <div className="ps-card rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-sm font-semibold mb-1">Forecast de Receita (ponderado)</h2>
            <p className="text-sm  mb-4">Receita esperada do pipeline considerando a probabilidade de cada etapa.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-xs  mb-1">💰 Receita esperada (ponderada)</p>
                <p className="text-3xl font-bold text-green-700">{fmt(forecast.receita_esperada)}</p>
              </div>
              <div className="bg-opacity-0 border border-gray-200 rounded-xl p-4">
                <p className="text-xs  mb-1">📊 Pipeline bruto (sem ponderar)</p>
                <p className="text-3xl font-bold ">{fmt(forecast.valor_pipeline_bruto)}</p>
              </div>
            </div>
            <div className="space-y-2">
              {forecast.etapas.map(e => {
                const max = Math.max(...forecast.etapas.map(x => x.valor_ponderado), 1);
                return (
                  <div key={e.etapa} className="flex items-center gap-3">
                    <span className="text-xs  w-40 flex-shrink-0 truncate">{e.label} <span className="text-gray-400">({Math.round(e.prob * 100)}%)</span></span>
                    <div className="flex-1 bg-opacity-0 rounded-full h-5 relative">
                      <div className="bg-blue-500 h-5 rounded-full" style={{ width: `${(e.valor_ponderado / max) * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium  w-28 text-right flex-shrink-0">{fmt(e.valor_ponderado)}</span>
                    <span className="text-xs  w-10 text-right flex-shrink-0">{e.qtd}×</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {dataLoading ? (
          <div className="text-center p-12 ">Calculando previsão...</div>
        ) : (
          <>
            {/* KPI summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-opacity-0 rounded-xl p-4 border border-gray-200">
                <p className="text-sm ">Oportunidades</p>
                <p className="text-3xl font-bold  mt-1">{totalOps}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-sm ">Pipeline Total</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{fmt(pipeline)}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <p className="text-sm ">Realista</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{previsao ? fmt(previsao.realista) : '-'}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <p className="text-sm ">Otimista</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{previsao ? fmt(previsao.otimista) : '-'}</p>
              </div>
            </div>

            {/* Cenários */}
            {previsao && (
              <div className="ps-card rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-sm font-semibold mb-4">Cenários de Fechamento</h2>
                <div className="space-y-4">
                  {[
                    { label: 'Otimista', desc: '100% do pipeline', value: previsao.otimista, color: 'bg-purple-500', pct: 100 },
                    { label: 'Realista', desc: 'Ponderado pela probabilidade', value: previsao.realista, color: 'bg-green-500', pct: pipeline > 0 ? (previsao.realista / previsao.otimista) * 100 : 0 },
                    { label: 'Pessimista', desc: 'Somente alta probabilidade (≥70%)', value: previsao.pessimista, color: 'bg-orange-400', pct: pipeline > 0 ? (previsao.pessimista / previsao.otimista) * 100 : 0 },
                  ].map(c => (
                    <div key={c.label} className="flex items-center gap-4">
                      <div className="w-28 flex-shrink-0">
                        <p className="text-sm font-semibold ">{c.label}</p>
                        <p className="text-xs ">{c.desc}</p>
                      </div>
                      <div className="flex-1 bg-opacity-0 rounded-full h-6 relative">
                        <div className={`h-6 rounded-full ${c.color} transition-all flex items-center justify-end pr-3`}
                          style={{ width: `${Math.max(c.pct, 2)}%` }}>
                          {c.pct > 20 && <span className="text-xs text-white font-medium">{fmt(c.value)}</span>}
                        </div>
                      </div>
                      {c.pct <= 20 && <span className="text-sm font-bold  w-24 text-right">{fmt(c.value)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top oportunidades */}
            {top.length > 0 && (
              <div className="ps-card rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-sm font-semibold">Top Oportunidades</h2>
                </div>
                <table className="w-full">
                  <thead className="bg-opacity-0 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold  uppercase">Lead</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold  uppercase">Etapa</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold  uppercase">Valor Est.</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold  uppercase">Prob.</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold  uppercase">Ponderado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {top.map(op => (
                      <tr key={op.id} className="hover:opacity-80 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-sm font-semibold">{op.nome}</p>
                          {op.empresa && <p className="text-xs ">{op.empresa}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm ">{ETAPA_LABELS[op.etapa] || op.etapa}</span>
                        </td>
                        <td className="px-5 py-4 text-right text-sm ">{fmt(op.valor_estimado)}</td>
                        <td className="px-5 py-4 text-right">
                          <span className={`text-sm font-medium ${op.probabilidade >= 70 ? 'text-green-600' : op.probabilidade >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {op.probabilidade}%
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-sm font-bold text-green-700">{fmt(Math.round(op.valor_ponderado))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {top.length === 0 && (
              <div className="ps-card rounded-xl border border-gray-200 p-12 text-center">
                <div className="text-4xl mb-3">📈</div>
                <p className="text-gray-500">Sem oportunidades com valor estimado no pipeline</p>
                <p className="text-sm  mt-1">Adicione valor estimado e probabilidade aos leads para ver a previsão</p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
