'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface KPIData {
  total_casos: number;
  casos_por_status: Record<string, number>;
  risco_distribution: { BAIXO: number; MÉDIO: number; ALTO: number };
  taxa_diagnosticados: number;
  taxa_planejados: number;
  taxa_recuperados: number;
  valor_total_em_risco: number;
  acoes_pendentes: number;
}

const PERIOD_OPTIONS = [
  { value: '7dias', label: 'Últimos 7 dias' },
  { value: '30dias', label: 'Últimos 30 dias' },
  { value: '90dias', label: 'Últimos 90 dias' },
  { value: '6meses', label: 'Últimos 6 meses' },
];

const STATUS_COLORS: Record<string, string> = {
  NOVO: '#94a3b8',
  DIAGNOSTICADO: '#3b82f6',
  PLANEJADO: '#f59e0b',
  EXECUTANDO: '#8b5cf6',
  RECUPERADO: '#22c55e',
  PERDIDO: '#ef4444',
};

export default function RelatoriosPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState('30dias');
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [topRisco, setTopRisco] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchData = async () => {
      setDataLoading(true);
      try {
        const [kpiRes, riscoRes] = await Promise.all([
          apiClient.getDashboardKPIs(period),
          apiClient.getTopRiscoClientes(10)
        ]);
        setKpis(kpiRes.data.data);
        setTopRisco(riscoRes.data.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, [isAuthenticated, period]);

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const totalRisco = kpis ? (kpis.risco_distribution.BAIXO + kpis.risco_distribution.MÉDIO + kpis.risco_distribution.ALTO) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-sm font-semibold">Relatórios</h1>
            <p className="text-gray-500 mt-1">Análise de performance e retenção</p>
          </div>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          >
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {dataLoading ? (
          <div className="text-center p-12 ">Carregando relatório...</div>
        ) : kpis ? (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="ps-card rounded-xl border border-gray-200 p-5">
                <p className="text-sm ">Total de Casos</p>
                <p className="text-3xl font-bold text-sm font-semibold mt-1">{kpis.total_casos}</p>
              </div>
              <div className="ps-card rounded-xl border border-gray-200 p-5">
                <p className="text-sm ">Taxa de Recuperação</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{kpis.taxa_recuperados.toFixed(1)}%</p>
              </div>
              <div className="ps-card rounded-xl border border-gray-200 p-5">
                <p className="text-sm ">Ações Pendentes</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{kpis.acoes_pendentes}</p>
              </div>
              <div className="ps-card rounded-xl border border-gray-200 p-5">
                <p className="text-sm ">Valor em Risco</p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {kpis.valor_total_em_risco > 0
                    ? `R$ ${(kpis.valor_total_em_risco / 1000).toFixed(1)}k`
                    : '—'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status por caso */}
              <div className="ps-card rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-sm font-semibold mb-4">Casos por Status</h2>
                <div className="space-y-3">
                  {Object.entries(kpis.casos_por_status).map(([status, count]) => {
                    const pct = kpis.total_casos > 0 ? (count / kpis.total_casos) * 100 : 0;
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium ">{status}</span>
                          <span className="text-gray-500">{count} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-opacity-0 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[status] || '#94a3b8' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Distribuição de risco */}
              <div className="ps-card rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-sm font-semibold mb-4">Distribuição de Risco</h2>
                <div className="space-y-4">
                  {[
                    { label: 'Baixo Risco', value: kpis.risco_distribution.BAIXO, color: 'bg-green-500', text: 'text-green-700' },
                    { label: 'Médio Risco', value: kpis.risco_distribution.MÉDIO, color: 'bg-yellow-500', text: 'text-yellow-700' },
                    { label: 'Alto Risco', value: kpis.risco_distribution.ALTO, color: 'bg-red-500', text: 'text-red-700' },
                  ].map(r => {
                    const pct = totalRisco > 0 ? (r.value / totalRisco) * 100 : 0;
                    return (
                      <div key={r.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className={`font-medium ${r.text}`}>{r.label}</span>
                          <span className="text-gray-500">{r.value} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-opacity-0 rounded-full h-3">
                          <div className={`h-3 rounded-full ${r.color} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs ">Diagnosticados</p>
                    <p className="text-lg font-bold text-blue-600">{kpis.taxa_diagnosticados.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs ">Planejados</p>
                    <p className="text-lg font-bold text-yellow-600">{kpis.taxa_planejados.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs ">Recuperados</p>
                    <p className="text-lg font-bold text-green-600">{kpis.taxa_recuperados.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Top clientes em risco */}
            {topRisco.length > 0 && (
              <div className="ps-card rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-sm font-semibold mb-4">Top 10 Clientes em Risco</h2>
                <div className="space-y-3">
                  {topRisco.map((item: any, idx: number) => (
                    <div key={item.id || idx} className="flex items-center gap-4">
                      <span className="text-sm font-medium  w-5">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-sm font-semibold truncate">{item.cliente?.nome || item.nome}</p>
                        <p className="text-xs ">{item.cliente?.empresa || item.empresa}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${item.risk_score >= 70 ? 'text-red-600' : item.risk_score >= 40 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {Math.round(item.risk_score)}/100
                        </p>
                        <p className="text-xs ">{item.status}</p>
                      </div>
                      <div className="w-20 bg-opacity-0 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${item.risk_score >= 70 ? 'bg-red-500' : item.risk_score >= 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${item.risk_score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center p-12 ">Sem dados disponíveis</div>
        )}
      </div>
    </DashboardLayout>
  );
}
