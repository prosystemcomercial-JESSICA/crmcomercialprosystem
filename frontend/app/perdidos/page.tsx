'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Lead {
  id: string;
  nome: string;
  empresa?: string;
  email?: string;
  telefone?: string;
  origem: string;
  etapa_funil: string;
  valor_estimado?: number;
  observacoes?: string;
  updated_at: string;
}

const ETAPA_LABELS: Record<string, string> = {
  PROSPECCAO: 'Prospecção', QUALIFICACAO: 'Qualificação',
  APRESENTACAO: 'Apresentação', PROPOSTA: 'Proposta',
  NEGOCIACAO: 'Negociação', FECHAMENTO: 'Fechamento',
};

export default function PerdidosPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    apiClient.getLeads({ status: 'PERDIDO', limit: 100 })
      .then(res => {
        setLeads(res.data.data.leads);
        setTotal(res.data.data.total);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, [isAuthenticated]);

  const handleReativar = async (id: string) => {
    try {
      await apiClient.updateLead(id, { status: 'NOVO', etapa_funil: 'PROSPECCAO' });
      setLeads(prev => prev.filter(l => l.id !== id));
      setTotal(t => t - 1);
    } catch (e) { console.error(e); }
  };

  const origemCounts = leads.reduce((acc: Record<string, number>, l) => {
    acc[l.origem] = (acc[l.origem] || 0) + 1;
    return acc;
  }, {});

  const etapaPerda = leads.reduce((acc: Record<string, number>, l) => {
    const label = ETAPA_LABELS[l.etapa_funil] || l.etapa_funil;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const valorTotal = leads.reduce((s, l) => s + (l.valor_estimado || 0), 0);

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-sm font-semibold">Perdidos</h1>
          <p className="text-gray-500 mt-1">{total} leads perdidos · R$ {valorTotal.toLocaleString('pt-BR')} em oportunidades perdidas</p>
        </div>

        {/* Analysis */}
        {leads.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="ps-card rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-sm font-semibold mb-4">Perdidos por Etapa</h3>
              <div className="space-y-2">
                {Object.entries(etapaPerda).sort(([, a], [, b]) => b - a).map(([etapa, count]) => (
                  <div key={etapa} className="flex items-center gap-3">
                    <span className="text-sm  w-28">{etapa}</span>
                    <div className="flex-1 bg-opacity-0 rounded-full h-2">
                      <div className="h-2 rounded-full bg-red-400" style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium  w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="ps-card rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-sm font-semibold mb-4">Perdidos por Origem</h3>
              <div className="space-y-2">
                {Object.entries(origemCounts).sort(([, a], [, b]) => b - a).map(([origem, count]) => (
                  <div key={origem} className="flex items-center gap-3">
                    <span className="text-sm  w-24">{origem}</span>
                    <div className="flex-1 bg-opacity-0 rounded-full h-2">
                      <div className="h-2 rounded-full bg-orange-400" style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium  w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* List */}
        <div className="ps-card rounded-xl border border-gray-200 overflow-hidden">
          {dataLoading ? (
            <div className="p-8 text-center ">Carregando...</div>
          ) : leads.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-gray-500">Nenhum lead perdido! Ótimo resultado.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-opacity-0 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold  uppercase">Lead</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold  uppercase">Etapa da Perda</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold  uppercase">Origem</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold  uppercase">Valor Perdido</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold  uppercase">Data</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold  uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map(l => (
                  <tr key={l.id} className="hover:opacity-80 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center text-red-500 font-semibold">
                          {l.nome.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-sm font-semibold">{l.nome}</p>
                          <p className="text-xs ">{l.empresa}</p>
                          <p className="text-xs ">{l.telefone || l.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm ">{ETAPA_LABELS[l.etapa_funil] || l.etapa_funil}</td>
                    <td className="px-5 py-4 text-sm ">{l.origem}</td>
                    <td className="px-5 py-4">
                      {l.valor_estimado
                        ? <span className="text-sm font-semibold text-red-600">R$ {l.valor_estimado.toLocaleString('pt-BR')}</span>
                        : <span className="text-gray-400 text-sm">—</span>}
                    </td>
                    <td className="px-5 py-4 text-sm ">{new Date(l.updated_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => handleReativar(l.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        🔄 Reativar
                      </button>
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
