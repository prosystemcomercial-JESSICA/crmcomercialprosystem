'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Renovacao {
  id: string;
  status: string;
  data_vencimento: string;
  valor_atual: number;
  valor_novo?: number;
  dias_para_vencer: number;
  observacoes?: string;
  licenca: {
    cliente: { id: string; nome: string; empresa?: string; email: string };
    plano?: { nome: string; segmento: string };
  };
}

const STATUS_COLOR: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  EM_NEGOCIACAO: 'bg-blue-100 text-blue-700',
  RENOVADA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-gray-100 text-gray-500',
  PERDIDA: 'bg-red-100 text-red-700',
};

export default function RenovacoesPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [renovacoes, setRenovacoes] = useState<Renovacao[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadData = () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    apiClient.getRenovacoes(params)
      .then(res => {
        setRenovacoes(res.data.data.renovacoes);
        setStats(res.data.data.stats);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadData(); }, [isAuthenticated, statusFilter]);

  const handleUpdateStatus = async (id: string, status: string) => {
    await apiClient.updateRenovacao(id, { status });
    loadData();
  };

  const urgColor = (dias: number, status: string) => {
    if (status !== 'PENDENTE' && status !== 'EM_NEGOCIACAO') return 'border-gray-100';
    if (dias <= 0) return 'border-red-300 bg-red-50';
    if (dias <= 15) return 'border-orange-300 bg-orange-50';
    if (dias <= 30) return 'border-yellow-200 bg-yellow-50';
    return 'border-gray-100';
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Renovações</h1>
          <p className="text-gray-500 mt-1">Controle de vencimentos e renovações de licenças</p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-3xl font-bold text-gray-700 mt-1">{stats.total}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <p className="text-sm text-gray-500">Críticas (≤15 dias)</p>
              <p className="text-3xl font-bold text-orange-700 mt-1">{stats.criticas}</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
              <p className="text-sm text-gray-500">Pendentes</p>
              <p className="text-3xl font-bold text-yellow-700 mt-1">{stats.pendentes}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <p className="text-sm text-gray-500">Renovadas</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{stats.renovadas}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {['', 'PENDENTE', 'EM_NEGOCIACAO', 'RENOVADA', 'CANCELADA', 'PERDIDA'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s === '' ? 'Todas' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Carregando...</div>
        ) : renovacoes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🔄</div>
            <p className="text-gray-500">Nenhuma renovação encontrada</p>
            <p className="text-sm text-gray-400 mt-1">Crie licenças com data de vencimento para gestão automática de renovações</p>
          </div>
        ) : (
          <div className="space-y-3">
            {renovacoes.map(r => (
              <div key={r.id} className={`bg-white rounded-xl border-2 ${urgColor(r.dias_para_vencer, r.status)} p-4 flex items-center gap-4`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{r.licenca.cliente.nome}</p>
                    {r.licenca.cliente.empresa && <span className="text-xs text-gray-500">· {r.licenca.cliente.empresa}</span>}
                    {r.licenca.plano && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{r.licenca.plano.nome}</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    <span>Vence: {new Date(r.data_vencimento).toLocaleDateString('pt-BR')}</span>
                    <span className={`font-semibold ${r.dias_para_vencer <= 0 ? 'text-red-600' : r.dias_para_vencer <= 15 ? 'text-orange-600' : 'text-gray-600'}`}>
                      {r.dias_para_vencer <= 0 ? `${Math.abs(r.dias_para_vencer)} dias vencida` : `${r.dias_para_vencer} dias restantes`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm">
                    <span className="text-gray-600">Valor atual: <strong>R$ {r.valor_atual.toLocaleString('pt-BR')}</strong></span>
                    {r.valor_novo && <span className="text-green-700">Novo: <strong>R$ {r.valor_novo.toLocaleString('pt-BR')}</strong></span>}
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <select value={r.status} onChange={e => handleUpdateStatus(r.id, e.target.value)}
                    className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer border-0 ${STATUS_COLOR[r.status]}`}>
                    {['PENDENTE', 'EM_NEGOCIACAO', 'RENOVADA', 'CANCELADA', 'PERDIDA'].map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
