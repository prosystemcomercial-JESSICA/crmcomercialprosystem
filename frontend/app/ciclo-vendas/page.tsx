'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth, useRequireGestorRedirect } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock, TrendingUp, CheckCircle2, Hourglass } from 'lucide-react';
import ExportButton from '@/components/ui/ExportButton';

const ETAPA_LABEL: Record<string, string> = {
  PROSPECCAO: 'Prospecção', QUALIFICACAO: 'Qualificação', APRESENTACAO: 'Apresentação',
  PROPOSTA: 'Proposta', NEGOCIACAO: 'Negociação', FECHAMENTO: 'Fechamento',
};
const fmtEtapa = (e: string) => ETAPA_LABEL[e] || e;

interface Ciclo {
  total_leads: number; fechados: number; em_aberto: number;
  ciclo_medio_dias: number; ciclo_min: number; ciclo_max: number;
  tempo_medio_por_etapa: { etapa: string; dias_medio: number; amostras: number }[];
}

export default function CicloVendasPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { blocked } = useRequireGestorRedirect();   // só supervisão/CEO

  const [data, setData] = useState<Ciclo | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);

  const load = useCallback(() => {
    setDataLoading(true);
    apiClient.getCicloVendas()
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, []);
  useEffect(() => { if (isAuthenticated && !blocked) load(); }, [isAuthenticated, blocked, load]);

  if (loading || !isAuthenticated || blocked) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  const chartData = (data?.tempo_medio_por_etapa || []).map(e => ({ etapa: fmtEtapa(e.etapa), dias: e.dias_medio, amostras: e.amostras }));
  const cores = ['#417ABC', '#00BFD1', '#7c3aed', '#ea580c', '#16a34a', '#dc2626'];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Clock size={24} className="text-blue-600" /> Ciclo de Vendas
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Tempo da entrada do lead até a assinatura — dias corridos por etapa e gargalos.</p>
          </div>
          {data && (
            <ExportButton
              nome="ciclo-de-vendas" titulo="Ciclo de Vendas — ProSystem CRM"
              linhas={data.tempo_medio_por_etapa}
              colunas={[
                { header: 'Etapa', value: (e: any) => fmtEtapa(e.etapa) },
                { header: 'Tempo médio (dias)', value: (e: any) => e.dias_medio },
                { header: 'Amostras', value: (e: any) => e.amostras },
              ]}
            />
          )}
        </div>

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Calculando ciclo de vendas...</div>
        ) : !data ? (
          <div className="text-center p-12 text-gray-500">Sem dados.</div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Ciclo médio (entrada→assinatura)', value: `${data.ciclo_medio_dias} dias`, color: '#417ABC', icon: TrendingUp },
                { label: 'Mais rápido', value: `${data.ciclo_min} dias`, color: '#16a34a', icon: CheckCircle2 },
                { label: 'Mais lento', value: `${data.ciclo_max} dias`, color: '#dc2626', icon: Hourglass },
                { label: 'Fechados (assinados)', value: data.fechados, color: '#00BFD1', icon: CheckCircle2 },
                { label: 'Em aberto', value: data.em_aberto, color: '#ea580c', icon: Clock },
              ].map(k => (
                <div key={k.label} className="bg-white border rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500"><k.icon size={14} /><p className="text-xs">{k.label}</p></div>
                  <p className="text-2xl font-bold mt-1" style={{ color: k.color }}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Tempo médio por etapa */}
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold text-gray-700 mb-4">Tempo médio por etapa (dias corridos)</h3>
              {chartData.length === 0 ? (
                <p className="text-sm text-gray-400">Ainda sem transições de etapa registradas.</p>
              ) : (
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 24, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12 }} unit="d" />
                      <YAxis type="category" dataKey="etapa" tick={{ fontSize: 12 }} width={110} />
                      <Tooltip formatter={(v: any) => [`${v} dias`, 'Tempo médio']} />
                      <Bar dataKey="dias" radius={[0, 6, 6, 0]}>
                        {chartData.map((_, i) => <Cell key={i} fill={cores[i % cores.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Tabela detalhada */}
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b"><h3 className="font-semibold text-gray-700">Detalhe por etapa</h3></div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Etapa</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Tempo médio (dias)</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amostras</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.tempo_medio_por_etapa.map(e => (
                    <tr key={e.etapa} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm text-gray-800">{fmtEtapa(e.etapa)}</td>
                      <td className="px-5 py-3 text-right text-sm font-semibold text-gray-700">{e.dias_medio}</td>
                      <td className="px-5 py-3 text-right text-sm text-gray-500">{e.amostras}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
