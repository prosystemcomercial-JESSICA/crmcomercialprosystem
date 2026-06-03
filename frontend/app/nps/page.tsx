'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ExportButton from '@/components/ui/ExportButton';
import { apiClient } from '@/lib/api-client';

interface NpsDashboard {
  nps_score: number;
  total: number;
  promoters: number;
  neutrals: number;
  detractors: number;
  avg_stars: number;
  distribuicao: { score: number; count: number }[];
  recentes: {
    cliente?: { nome: string; empresa?: string };
    score: number;
    stars: number;
    q4: string;
    motivo?: string;
    data: string;
  }[];
}

function NpsGauge({ score }: { score: number }) {
  const color = score >= 50 ? '#22c55e' : score >= 0 ? '#f59e0b' : '#ef4444';
  const label = score >= 50 ? 'Excelente' : score >= 0 ? 'Bom' : 'Crítico';
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-20 overflow-hidden">
        <div className="absolute inset-0 rounded-t-full border-8 border-gray-100" style={{ borderRadius: '50% 50% 0 0 / 100% 100% 0 0' }} />
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-4xl font-bold" style={{ color }}>
          {score}
        </div>
      </div>
      <p className="text-sm font-medium mt-1" style={{ color }}>{label}</p>
      <p className="text-xs text-gray-400">NPS Score</p>
    </div>
  );
}

export default function NpsPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<NpsDashboard | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    apiClient.getNpsDashboard()
      .then(res => setData(res.data.data))
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, [isAuthenticated]);

  const starLabel = (n: number) => '⭐'.repeat(n);
  const q4Label: Record<string, string> = { sim: '✅ Voltaria', nao: '❌ Não voltaria', talvez: '🤔 Talvez' };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard NPS</h1>
            <p className="text-gray-500 mt-1">Net Promoter Score — satisfação dos clientes</p>
          </div>
          {data && (data.recentes?.length ?? 0) > 0 && (
            <ExportButton
              nome="nps-respostas" titulo="NPS — Respostas recentes"
              linhas={data.recentes}
              colunas={[
                { header: 'Cliente', value: (r: any) => r.cliente?.nome || '' },
                { header: 'Empresa', value: (r: any) => r.cliente?.empresa || '' },
                { header: 'Score', value: (r: any) => r.score },
                { header: 'Estrelas', value: (r: any) => r.stars },
                { header: 'Categoria', value: (r: any) => r.q4 },
                { header: 'Motivo', value: (r: any) => r.motivo || '' },
                { header: 'Data', value: (r: any) => r.data ? new Date(r.data).toLocaleDateString('pt-BR') : '' },
              ]}
            />
          )}
        </div>

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Carregando...</div>
        ) : !data || data.total === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-gray-700 font-medium text-lg">Sem respostas de pesquisa ainda</p>
            <p className="text-gray-400 text-sm mt-1">As respostas das pesquisas de churn aparecerão aqui automaticamente</p>
            <p className="text-xs text-gray-400 mt-2">Acesse <strong>Churn & Retenção</strong> para enviar pesquisas a clientes em risco</p>
          </div>
        ) : (
          <>
            {/* Score principal */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center">
                <NpsGauge score={data.nps_score} />
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">😊 Promotores (9-10)</p>
                <p className="text-4xl font-bold text-green-700">{data.promoters}</p>
                <p className="text-xs text-green-600 mt-1">{data.total > 0 ? Math.round((data.promoters / data.total) * 100) : 0}%</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">😐 Neutros (7-8)</p>
                <p className="text-4xl font-bold text-yellow-700">{data.neutrals}</p>
                <p className="text-xs text-yellow-600 mt-1">{data.total > 0 ? Math.round((data.neutrals / data.total) * 100) : 0}%</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">😟 Detratores (1-6)</p>
                <p className="text-4xl font-bold text-red-700">{data.detractors}</p>
                <p className="text-xs text-red-600 mt-1">{data.total > 0 ? Math.round((data.detractors / data.total) * 100) : 0}%</p>
              </div>
            </div>

            {/* Distribuição de scores */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Distribuição de Scores</h2>
              <div className="flex items-end gap-1.5 h-24">
                {data.distribuicao.map(d => {
                  const maxCount = Math.max(...data.distribuicao.map(x => x.count), 1);
                  const height = (d.count / maxCount) * 100;
                  const color = d.score >= 9 ? 'bg-green-500' : d.score >= 7 ? 'bg-yellow-400' : 'bg-red-400';
                  return (
                    <div key={d.score} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">{d.count || ''}</span>
                      <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                        <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(height, d.count > 0 ? 10 : 0)}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{d.score}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Métricas adicionais */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Total de respostas</p>
                <p className="text-3xl font-bold text-gray-700 mt-1">{data.total}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Avaliação média</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{'⭐'.repeat(Math.round(data.avg_stars))} {data.avg_stars}</p>
              </div>
            </div>

            {/* Respostas recentes */}
            {data.recentes.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">Respostas Recentes</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.recentes.map((r, i) => (
                    <div key={i} className="px-5 py-4 flex items-start gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${r.score >= 9 ? 'bg-green-100 text-green-700' : r.score >= 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                        {r.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 text-sm">{r.cliente?.nome || 'Anônimo'}</p>
                          {r.cliente?.empresa && <span className="text-xs text-gray-400">· {r.cliente.empresa}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{starLabel(r.stars)}</span>
                          <span>{q4Label[r.q4] || r.q4}</span>
                          {r.motivo && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{r.motivo}</span>}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 flex-shrink-0">{new Date(r.data).toLocaleDateString('pt-BR')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
