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
  temperatura: string;
  valor_estimado?: number;
  probabilidade?: number;
  status: string;
  etapa_funil: string;
}

interface FunilEtapa {
  etapa: string;
  leads: Lead[];
  total: number;
  valor_total: number;
}

const ETAPA_LABELS: Record<string, string> = {
  PROSPECCAO: 'Prospecção',
  QUALIFICACAO: 'Qualificação',
  APRESENTACAO: 'Apresentação',
  PROPOSTA: 'Proposta',
  NEGOCIACAO: 'Negociação',
  FECHAMENTO: 'Fechamento',
};

const ETAPA_COLORS: Record<string, string> = {
  PROSPECCAO: 'border-gray-300 bg-gray-50',
  QUALIFICACAO: 'border-blue-300 bg-blue-50',
  APRESENTACAO: 'border-purple-300 bg-purple-50',
  PROPOSTA: 'border-yellow-300 bg-yellow-50',
  NEGOCIACAO: 'border-orange-300 bg-orange-50',
  FECHAMENTO: 'border-green-300 bg-green-50',
};

const ETAPA_HEADER: Record<string, string> = {
  PROSPECCAO: 'bg-gray-200 text-gray-700',
  QUALIFICACAO: 'bg-blue-200 text-blue-800',
  APRESENTACAO: 'bg-purple-200 text-purple-800',
  PROPOSTA: 'bg-yellow-200 text-yellow-800',
  NEGOCIACAO: 'bg-orange-200 text-orange-800',
  FECHAMENTO: 'bg-green-200 text-green-800',
};

const TEMP_ICON: Record<string, string> = { FRIO: '🔵', MORNO: '🟡', QUENTE: '🔴' };

export default function FunilPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [funil, setFunil] = useState<FunilEtapa[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dragging, setDragging] = useState<{ leadId: string; fromEtapa: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const fetchFunil = async () => {
    setDataLoading(true);
    try {
      const res = await apiClient.getLeadsFunil();
      setFunil(res.data.data);
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  };

  useEffect(() => {
    if (isAuthenticated) fetchFunil();
  }, [isAuthenticated]);

  const handleDragStart = (leadId: string, fromEtapa: string) => {
    setDragging({ leadId, fromEtapa });
  };

  const handleDrop = async (toEtapa: string) => {
    if (!dragging || dragging.fromEtapa === toEtapa) { setDragging(null); return; }
    try {
      await apiClient.updateLead(dragging.leadId, { etapa_funil: toEtapa });
      fetchFunil();
    } catch (e) { console.error(e); }
    finally { setDragging(null); }
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const totalLeads = funil.reduce((s, e) => s + e.total, 0);
  const totalValor = funil.reduce((s, e) => s + e.valor_total, 0);

  return (
    <DashboardLayout>
      <div className="space-y-4 h-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Funil Comercial</h1>
            <p className="text-gray-500 mt-1">{totalLeads} leads · R$ {totalValor.toLocaleString('pt-BR')} em pipeline</p>
          </div>
          <button onClick={() => router.push('/leads')} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
            📋 Ver Lista
          </button>
        </div>

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Carregando funil...</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
            {funil.map((etapa) => (
              <div
                key={etapa.etapa}
                className={`flex-shrink-0 w-64 rounded-xl border-2 ${ETAPA_COLORS[etapa.etapa]} flex flex-col`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(etapa.etapa)}
              >
                {/* Column header */}
                <div className={`px-4 py-3 rounded-t-xl ${ETAPA_HEADER[etapa.etapa]}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{ETAPA_LABELS[etapa.etapa]}</p>
                    <span className="text-xs font-bold px-1.5 py-0.5 bg-white/60 rounded-full">{etapa.total}</span>
                  </div>
                  {etapa.valor_total > 0 && (
                    <p className="text-xs mt-0.5 opacity-75">R$ {etapa.valor_total.toLocaleString('pt-BR')}</p>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                  {etapa.leads.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs">Nenhum lead aqui</div>
                  ) : (
                    etapa.leads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => handleDragStart(lead.id, etapa.etapa)}
                        className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{lead.nome}</p>
                            {lead.empresa && <p className="text-xs text-gray-500 truncate">{lead.empresa}</p>}
                          </div>
                          <span className="ml-1 text-sm">{TEMP_ICON[lead.temperatura]}</span>
                        </div>
                        {lead.valor_estimado && (
                          <p className="text-xs font-medium text-green-700 mt-1.5">
                            R$ {lead.valor_estimado.toLocaleString('pt-BR')}
                            {lead.probabilidade ? ` · ${lead.probabilidade}%` : ''}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">Arraste os cards para mover leads entre etapas do funil</p>
      </div>
    </DashboardLayout>
  );
}
