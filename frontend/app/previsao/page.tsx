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

const ETAPA_LABELS: Record<string, string> = {
  PROSPECCAO: 'Prospecção', QUALIFICACAO: 'Qualificação', APRESENTACAO: 'Apresentação',
  PROPOSTA: 'Proposta', NEGOCIACAO: 'Negociação', FECHAMENTO: 'Fechamento',
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
            <h1 className="text-3xl font-bold text-gray-900">Previsão de Fechamento</h1>
            <p className="text-gray-500 mt-1">Sua meta do período e a estimativa de receita do seu pipeline</p>
          </div>
          <div className="flex gap-2">
            {[15, 30, 60, 90].map(d => (
              <button key={d} onClick={() => setDias(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${dias === d ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Meta do período (definida pela supervisão) + evolução */}
        {meta && meta.valor_alvo > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Minha meta — {meta.periodo}</h2>
              <span className="text-sm font-bold text-blue-700">{meta.pct_evolucao}% atingido</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 mb-3">
              <div className={`h-4 rounded-full transition-all ${meta.pct_evolucao >= 100 ? 'bg-green-500' : meta.pct_evolucao >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, meta.pct_evolucao)}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-gray-500">Meta</p><p className="font-bold text-gray-800">{fmt(meta.valor_alvo)}</p></div>
              <div><p className="text-gray-500">Realizado</p><p className="font-bold text-green-700">{fmt(meta.valor_atual)}</p></div>
              <div><p className="text-gray-500">Falta</p><p className="font-bold text-gray-800">{fmt(meta.falta_para_meta)}</p></div>
            </div>
          </div>
        )}

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Calculando previsão...</div>
        ) : (
          <>
            {/* KPI summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-500">Oportunidades</p>
                <p className="text-3xl font-bold text-gray-700 mt-1">{totalOps}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-sm text-gray-500">Pipeline Total</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{fmt(pipeline)}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <p className="text-sm text-gray-500">Realista</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{previsao ? fmt(previsao.realista) : '-'}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <p className="text-sm text-gray-500">Otimista</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{previsao ? fmt(previsao.otimista) : '-'}</p>
              </div>
            </div>

            {/* Cenários */}
            {previsao && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Cenários de Fechamento</h2>
                <div className="space-y-4">
                  {[
                    { label: 'Otimista', desc: '100% do pipeline', value: previsao.otimista, color: 'bg-purple-500', pct: 100 },
                    { label: 'Realista', desc: 'Ponderado pela probabilidade', value: previsao.realista, color: 'bg-green-500', pct: pipeline > 0 ? (previsao.realista / previsao.otimista) * 100 : 0 },
                    { label: 'Pessimista', desc: 'Somente alta probabilidade (≥70%)', value: previsao.pessimista, color: 'bg-orange-400', pct: pipeline > 0 ? (previsao.pessimista / previsao.otimista) * 100 : 0 },
                  ].map(c => (
                    <div key={c.label} className="flex items-center gap-4">
                      <div className="w-28 flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-700">{c.label}</p>
                        <p className="text-xs text-gray-400">{c.desc}</p>
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                        <div className={`h-6 rounded-full ${c.color} transition-all flex items-center justify-end pr-3`}
                          style={{ width: `${Math.max(c.pct, 2)}%` }}>
                          {c.pct > 20 && <span className="text-xs text-white font-medium">{fmt(c.value)}</span>}
                        </div>
                      </div>
                      {c.pct <= 20 && <span className="text-sm font-bold text-gray-700 w-24 text-right">{fmt(c.value)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top oportunidades */}
            {top.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900">Top Oportunidades</h2>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lead</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Etapa</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Valor Est.</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Prob.</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ponderado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {top.map(op => (
                      <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900">{op.nome}</p>
                          {op.empresa && <p className="text-xs text-gray-500">{op.empresa}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm text-gray-600">{ETAPA_LABELS[op.etapa] || op.etapa}</span>
                        </td>
                        <td className="px-5 py-4 text-right text-sm text-gray-700">{fmt(op.valor_estimado)}</td>
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
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="text-4xl mb-3">📈</div>
                <p className="text-gray-500">Sem oportunidades com valor estimado no pipeline</p>
                <p className="text-sm text-gray-400 mt-1">Adicione valor estimado e probabilidade aos leads para ver a previsão</p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
