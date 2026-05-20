'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Caso {
  id: string;
  status: string;
  risk_score: number;
  motivo_principal?: string;
  created_at: string;
  cliente: {
    id: string;
    nome: string;
    empresa?: string;
    email: string;
  };
}

const STATUS_COLORS: Record<string, string> = {
  NOVO: 'bg-gray-100 text-gray-700',
  DIAGNOSTICADO: 'bg-blue-100 text-blue-700',
  PLANEJADO: 'bg-yellow-100 text-yellow-700',
  EXECUTANDO: 'bg-purple-100 text-purple-700',
  RECUPERADO: 'bg-green-100 text-green-700',
  PERDIDO: 'bg-red-100 text-red-700',
};

const RISK_COLOR = (score: number) => {
  if (score >= 70) return 'text-red-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-green-600';
};

const RISK_LABEL = (score: number) => {
  if (score >= 70) return 'ALTO';
  if (score >= 40) return 'MÉDIO';
  return 'BAIXO';
};

export default function CasosPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [casos, setCasos] = useState<Caso[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const fetchCasos = async () => {
    setDataLoading(true);
    try {
      const res = await apiClient.getCasos(page, limit, statusFilter || undefined);
      const data = res.data.data;
      setCasos(data.casos || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchCasos();
  }, [isAuthenticated, page, statusFilter]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await apiClient.updateCaso(id, { status });
      fetchCasos();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const statuses = ['', 'NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO', 'RECUPERADO', 'PERDIDO'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Churn & Retenção</h1>
            <p className="text-gray-500 mt-1">{total} casos registrados</p>
          </div>
          <button
            onClick={() => router.push('/casos/novo')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Novo Caso
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === '' ? 'Todos' : s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {dataLoading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : casos.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-500">Nenhum caso encontrado</p>
              <button onClick={() => router.push('/casos/novo')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Criar primeiro caso
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Risco</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Motivo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {casos.map((caso) => (
                  <tr key={caso.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-semibold">
                          {caso.cliente?.nome?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{caso.cliente?.nome}</p>
                          <p className="text-sm text-gray-500">{caso.cliente?.empresa}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[caso.status] || 'bg-gray-100 text-gray-700'}`}>
                        {caso.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className={`font-semibold text-sm ${RISK_COLOR(caso.risk_score)}`}>
                          {RISK_LABEL(caso.risk_score)}
                        </p>
                        <div className="w-16 bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className={`h-1.5 rounded-full ${caso.risk_score >= 70 ? 'bg-red-500' : caso.risk_score >= 40 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${caso.risk_score}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{Math.round(caso.risk_score)}/100</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 max-w-xs truncate">{caso.motivo_principal || '—'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(caso.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <select
                        value={caso.status}
                        onChange={e => handleUpdateStatus(caso.id, e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        {['NOVO', 'DIAGNOSTICADO', 'PLANEJADO', 'EXECUTANDO', 'RECUPERADO', 'PERDIDO'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Mostrando {page * limit + 1}–{Math.min((page + 1) * limit, total)} de {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Anterior</button>
              <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Próximo</button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
