'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Contrato {
  id: string;
  valor: number;
  recorrencia: string;
  status: string;
  data_inicio: string;
  data_fim?: string;
  created_at: string;
  lead?: { id: string; nome: string; empresa?: string; telefone?: string; email?: string };
  proposta?: { id: string; titulo: string; valor: number };
}

const STATUS_COLORS: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-700',
  SUSPENSO: 'bg-yellow-100 text-yellow-700',
  CANCELADO: 'bg-red-100 text-red-700',
  ENCERRADO: 'bg-gray-100 text-gray-700',
};

const RECORRENCIA_LABEL: Record<string, string> = {
  UNICO: 'Pagamento único',
  MENSAL: 'Mensal',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};

export default function ContratosPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('ATIVO');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const [res, statsRes] = await Promise.all([
        apiClient.getContratos(params),
        apiClient.getContratosStats()
      ]);
      setContratos(res.data.data.contratos);
      setStats(statsRes.data.data);
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, statusFilter]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try { await apiClient.updateContrato(id, { status }); fetchData(); }
    catch (e) { console.error(e); }
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contratos Fechados</h1>
          <p className="text-gray-500 mt-1">Clientes com contrato ativo ProSystem</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
              { label: 'Ativos', value: stats.ativos, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Suspensos', value: stats.suspensos, color: 'text-yellow-700', bg: 'bg-yellow-50' },
              { label: 'Cancelados', value: stats.cancelados, color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'Encerrados', value: stats.encerrados, color: 'text-gray-700', bg: 'bg-gray-50' },
              { label: 'MRR', value: `R$ ${(stats.mrr / 1000).toFixed(1)}k`, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'ARR Est.', value: `R$ ${(stats.arr / 1000).toFixed(1)}k`, color: 'text-purple-700', bg: 'bg-purple-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2">
          {['', 'ATIVO', 'SUSPENSO', 'CANCELADO', 'ENCERRADO'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s === '' ? 'Todos' : s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {dataLoading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : contratos.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-gray-500">Nenhum contrato encontrado</p>
              <p className="text-sm text-gray-400 mt-1">Converta propostas aceitas em contratos em <a href="/propostas" className="text-blue-600 underline">Propostas</a></p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Valor</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Recorrência</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Início</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contratos.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                          {c.lead?.nome?.charAt(0) || 'C'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{c.lead?.nome}</p>
                          <p className="text-xs text-gray-500">{c.lead?.empresa}</p>
                          <p className="text-xs text-gray-400">{c.lead?.telefone || c.lead?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-gray-900">R$ {c.valor.toLocaleString('pt-BR')}</p>
                      {c.proposta && <p className="text-xs text-gray-400">{c.proposta.titulo}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-600">{RECORRENCIA_LABEL[c.recorrencia]}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {new Date(c.data_inicio).toLocaleDateString('pt-BR')}
                      {c.data_fim && <p className="text-xs text-gray-400">até {new Date(c.data_fim).toLocaleDateString('pt-BR')}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <select value={c.status} onChange={e => handleUpdateStatus(c.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none">
                        {['ATIVO', 'SUSPENSO', 'CANCELADO', 'ENCERRADO'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
