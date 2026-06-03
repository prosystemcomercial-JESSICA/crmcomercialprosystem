'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ExportButton from '@/components/ui/ExportButton';
import { apiClient } from '@/lib/api-client';

interface HealthScore {
  id: string;
  score: number;
  nivel: string;
  fatores: any;
  calculado_at: string;
  cliente: { id: string; nome: string; empresa?: string; email: string };
}

const NIVEL_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  EXCELENTE: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: '💚' },
  SAUDAVEL: { color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', icon: '🟢' },
  ATENCAO: { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: '🟡' },
  RISCO: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: '🟠' },
  CRITICO: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: '🔴' },
};

export default function HealthScorePage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [scores, setScores] = useState<HealthScore[]>([]);
  const [distribuicao, setDistribuicao] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [nivelFilter, setNivelFilter] = useState('');
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadData = () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    const params: any = {};
    if (nivelFilter) params.nivel = nivelFilter;
    apiClient.getHealthScores(params)
      .then(res => {
        setScores(res.data.data.scores);
        setTotal(res.data.data.total);
        setDistribuicao(res.data.data.distribuicao || []);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadData(); }, [isAuthenticated, nivelFilter]);

  const handleCalcularTodos = async () => {
    setCalculando(true);
    try {
      await apiClient.calcularHealthScores();
      loadData();
    } catch (e) { console.error(e); }
    finally { setCalculando(false); }
  };

  const scoreBarColor = (nivel: string) => {
    const map: Record<string, string> = {
      EXCELENTE: 'bg-green-500', SAUDAVEL: 'bg-teal-500',
      ATENCAO: 'bg-yellow-500', RISCO: 'bg-orange-500', CRITICO: 'bg-red-500'
    };
    return map[nivel] || 'bg-gray-400';
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const distCount = (nivel: string) => {
    const d = distribuicao.find(x => x.nivel === nivel);
    return d ? d._count.id : 0;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Health Score</h1>
            <p className="text-gray-500 mt-1">Saúde dos clientes baseada em múltiplos indicadores</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              nome="health-score" titulo="Health Score — Clientes"
              linhas={scores}
              colunas={[
                { header: 'Cliente', value: (s: HealthScore) => s.cliente?.nome || '' },
                { header: 'Empresa', value: (s: HealthScore) => s.cliente?.empresa || '' },
                { header: 'E-mail', value: (s: HealthScore) => s.cliente?.email || '' },
                { header: 'Score', value: (s: HealthScore) => s.score },
                { header: 'Nível', value: (s: HealthScore) => s.nivel },
                { header: 'Calculado em', value: (s: HealthScore) => s.calculado_at ? new Date(s.calculado_at).toLocaleString('pt-BR') : '' },
              ]}
            />
            <button onClick={handleCalcularTodos} disabled={calculando}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {calculando ? 'Calculando...' : '⚡ Calcular todos'}
            </button>
          </div>
        </div>

        {/* Distribuição */}
        <div className="grid grid-cols-5 gap-3">
          {['CRITICO', 'RISCO', 'ATENCAO', 'SAUDAVEL', 'EXCELENTE'].map(nivel => {
            const cfg = NIVEL_CONFIG[nivel];
            const count = distCount(nivel);
            return (
              <button key={nivel} onClick={() => setNivelFilter(nivelFilter === nivel ? '' : nivel)}
                className={`${cfg.bg} border-2 ${nivelFilter === nivel ? cfg.border : 'border-transparent'} rounded-xl p-4 text-center transition-all hover:opacity-90`}>
                <div className="text-2xl mb-1">{cfg.icon}</div>
                <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
                <p className="text-xs text-gray-500 mt-0.5">{nivel}</p>
              </button>
            );
          })}
        </div>

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Calculando health scores...</div>
        ) : scores.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">💊</div>
            <p className="text-gray-500 font-medium">Nenhum health score calculado</p>
            <p className="text-sm text-gray-400 mt-1">Clique em "Calcular todos" para gerar os scores dos seus clientes</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Score</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nível</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fatores</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scores.map(hs => {
                  const cfg = NIVEL_CONFIG[hs.nivel] || NIVEL_CONFIG.ATENCAO;
                  return (
                    <tr key={hs.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900">{hs.cliente.nome}</p>
                        {hs.cliente.empresa && <p className="text-xs text-gray-500">{hs.cliente.empresa}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <p className={`text-xl font-bold ${cfg.color}`}>{hs.score}</p>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div className={`h-2 rounded-full ${scoreBarColor(hs.nivel)}`} style={{ width: `${hs.score}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                          {cfg.icon} {hs.nivel}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2 flex-wrap">
                          {hs.fatores.licencas_ativas !== undefined && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${hs.fatores.licencas_ativas > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                              🔑 {hs.fatores.licencas_ativas} lic.
                            </span>
                          )}
                          {hs.fatores.tickets_abertos > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-700">
                              🎧 {hs.fatores.tickets_abertos} tickets
                            </span>
                          )}
                          {hs.fatores.tem_caso_churn && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700">⚠ Churn</span>
                          )}
                          {hs.fatores.dias_sem_interacao >= 30 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700">
                              💤 {hs.fatores.dias_sem_interacao}d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400">
                        {new Date(hs.calculado_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
