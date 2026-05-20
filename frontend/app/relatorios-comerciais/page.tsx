'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

export default function RelatoriosComerciais() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [leadsStats, setLeadsStats] = useState<any>(null);
  const [propostasStats, setPropostasStats] = useState<any>(null);
  const [contratosStats, setContratosStats] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    Promise.all([
      apiClient.getLeadsStats(),
      apiClient.getPropostasStats(),
      apiClient.getContratosStats()
    ]).then(([l, p, c]) => {
      setLeadsStats(l.data.data);
      setPropostasStats(p.data.data);
      setContratosStats(c.data.data);
    }).catch(console.error)
      .finally(() => setDataLoading(false));
  }, [isAuthenticated]);

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios Comerciais</h1>
          <p className="text-gray-500 mt-1">Visão consolidada do pipeline comercial</p>
        </div>

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Carregando relatório...</div>
        ) : (
          <>
            {/* Leads KPIs */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">📊 Leads & Funil</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {leadsStats && [
                  { label: 'Total Leads', value: leadsStats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
                  { label: 'Novos', value: leadsStats.novos, color: 'text-blue-700', bg: 'bg-blue-50' },
                  { label: 'Em Contato', value: leadsStats.emContato, color: 'text-purple-700', bg: 'bg-purple-50' },
                  { label: 'Ganhos', value: leadsStats.ganhos, color: 'text-green-700', bg: 'bg-green-50' },
                  { label: 'Perdidos', value: leadsStats.perdidos, color: 'text-red-700', bg: 'bg-red-50' },
                  { label: 'Conversão', value: `${leadsStats.taxa_conversao}%`, color: 'text-teal-700', bg: 'bg-teal-50' },
                  { label: 'Pipeline', value: `R$ ${(leadsStats.valor_pipeline / 1000).toFixed(1)}k`, color: 'text-orange-700', bg: 'bg-orange-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
                    <p className="text-xs font-medium text-gray-500">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Propostas KPIs */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">📄 Propostas</h2>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {propostasStats && [
                  { label: 'Total', value: propostasStats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
                  { label: 'Enviadas', value: propostasStats.enviadas, color: 'text-blue-700', bg: 'bg-blue-50' },
                  { label: 'Aceitas', value: propostasStats.aceitas, color: 'text-green-700', bg: 'bg-green-50' },
                  { label: 'Recusadas', value: propostasStats.recusadas, color: 'text-red-700', bg: 'bg-red-50' },
                  { label: 'Taxa Aprovação', value: `${propostasStats.taxa_aprovacao}%`, color: 'text-teal-700', bg: 'bg-teal-50' },
                  { label: 'Valor Aceito', value: `R$ ${(propostasStats.valor_aceito / 1000).toFixed(1)}k`, color: 'text-purple-700', bg: 'bg-purple-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
                    <p className="text-xs font-medium text-gray-500">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contratos KPIs */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">📝 Contratos & Receita</h2>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                {contratosStats && [
                  { label: 'Total', value: contratosStats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
                  { label: 'Ativos', value: contratosStats.ativos, color: 'text-green-700', bg: 'bg-green-50' },
                  { label: 'Suspensos', value: contratosStats.suspensos, color: 'text-yellow-700', bg: 'bg-yellow-50' },
                  { label: 'Cancelados', value: contratosStats.cancelados, color: 'text-red-700', bg: 'bg-red-50' },
                  { label: 'Encerrados', value: contratosStats.encerrados, color: 'text-gray-700', bg: 'bg-gray-50' },
                  { label: 'MRR', value: `R$ ${(contratosStats.mrr / 1000).toFixed(1)}k`, color: 'text-blue-700', bg: 'bg-blue-50' },
                  { label: 'ARR Est.', value: `R$ ${(contratosStats.arr / 1000).toFixed(1)}k`, color: 'text-purple-700', bg: 'bg-purple-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
                    <p className="text-xs font-medium text-gray-500">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Funil visual */}
            {leadsStats && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Funil de Conversão</h2>
                <div className="space-y-2">
                  {[
                    { label: 'Leads Totais', value: leadsStats.total, color: 'bg-gray-400', width: 100 },
                    { label: 'Qualificados', value: leadsStats.qualificados || 0, color: 'bg-blue-400', width: leadsStats.total > 0 ? ((leadsStats.qualificados || 0) / leadsStats.total) * 100 : 0 },
                    { label: 'Em Contato', value: leadsStats.emContato, color: 'bg-purple-400', width: leadsStats.total > 0 ? (leadsStats.emContato / leadsStats.total) * 100 : 0 },
                    { label: 'Ganhos', value: leadsStats.ganhos, color: 'bg-green-400', width: leadsStats.total > 0 ? (leadsStats.ganhos / leadsStats.total) * 100 : 0 },
                    { label: 'Contratos Ativos', value: contratosStats?.ativos || 0, color: 'bg-green-600', width: leadsStats.total > 0 ? ((contratosStats?.ativos || 0) / leadsStats.total) * 100 : 0 },
                  ].map(stage => (
                    <div key={stage.label} className="flex items-center gap-4">
                      <span className="text-sm text-gray-600 w-36">{stage.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
                        <div className={`h-5 rounded-full ${stage.color} transition-all flex items-center justify-end pr-2`}
                          style={{ width: `${Math.max(stage.width, 2)}%` }}>
                          {stage.width > 15 && <span className="text-xs text-white font-medium">{stage.value}</span>}
                        </div>
                      </div>
                      {stage.width <= 15 && <span className="text-sm font-medium text-gray-700 w-8">{stage.value}</span>}
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
