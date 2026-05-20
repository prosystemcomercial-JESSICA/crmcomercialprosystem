'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface LeadNutricao {
  id: string;
  nome: string;
  empresa?: string;
  email?: string;
  telefone?: string;
  origem: string;
  diasSemContato: number;
  updated_at: string;
  _count: { atividades: number; propostas: number };
}

export default function NutricaoPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<LeadNutricao[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [reativando, setReativando] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadData = () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    apiClient.getNutricao()
      .then(res => setLeads(res.data.data))
      .catch(console.error)
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadData(); }, [isAuthenticated]);

  const handleReativar = async (id: string) => {
    setReativando(id);
    try {
      await apiClient.reativarLead(id);
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setReativando(null);
    }
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const filtered = leads.filter(l =>
    l.nome.toLowerCase().includes(search.toLowerCase()) ||
    (l.empresa || '').toLowerCase().includes(search.toLowerCase())
  );

  const urgColor = (dias: number) =>
    dias >= 60 ? 'text-red-600 bg-red-50' :
    dias >= 30 ? 'text-orange-600 bg-orange-50' :
    'text-yellow-600 bg-yellow-50';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Nutrição / Recontato</h1>
            <p className="text-gray-500 mt-1">Leads em espera para recontato futuro</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-700">{leads.length}</p>
            <p className="text-xs text-gray-500">leads em nutrição</p>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou empresa..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🌱</div>
            <p className="text-gray-500 font-medium">Nenhum lead em nutrição</p>
            <p className="text-sm text-gray-400 mt-1">Leads com status NUTRIÇÃO aparecerão aqui</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lead</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Origem</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Histórico</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sem contato</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{lead.nome}</p>
                      {lead.empresa && <p className="text-xs text-gray-500">{lead.empresa}</p>}
                      {lead.email && <p className="text-xs text-gray-400">{lead.email}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{lead.origem}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      <span>{lead._count.atividades} atividades</span>
                      <span className="mx-1.5 text-gray-300">·</span>
                      <span>{lead._count.propostas} propostas</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${urgColor(lead.diasSemContato)}`}>
                        {lead.diasSemContato} dias
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleReativar(lead.id)}
                        disabled={reativando === lead.id}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {reativando === lead.id ? 'Reativando...' : '↩ Reativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
