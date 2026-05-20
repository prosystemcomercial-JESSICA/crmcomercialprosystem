'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Onboarding {
  id: string;
  status: string;
  progresso: number;
  etapas: { titulo: string; concluido: boolean; data_conclusao: string | null }[];
  licenca: {
    cliente: { id: string; nome: string; empresa?: string };
    plano?: { nome: string };
  };
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  PENDENTE: 'bg-gray-100 text-gray-600',
  EM_ANDAMENTO: 'bg-blue-100 text-blue-700',
  CONCLUIDO: 'bg-green-100 text-green-700',
  PAUSADO: 'bg-yellow-100 text-yellow-700',
};

export default function OnboardingPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [onboardings, setOnboardings] = useState<Onboarding[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandido, setExpandido] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadData = () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    apiClient.getOnboardings(params)
      .then(res => setOnboardings(res.data.data))
      .catch(console.error)
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadData(); }, [isAuthenticated, statusFilter]);

  const handleToggleEtapa = async (ob: Onboarding, idx: number) => {
    setSaving(true);
    const etapas = ob.etapas.map((e, i) =>
      i === idx ? { ...e, concluido: !e.concluido, data_conclusao: !e.concluido ? new Date().toISOString() : null } : e
    );
    try {
      await apiClient.updateOnboarding(ob.id, { etapas });
      loadData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const stats = {
    total: onboardings.length,
    pendentes: onboardings.filter(o => o.status === 'PENDENTE').length,
    em_andamento: onboardings.filter(o => o.status === 'EM_ANDAMENTO').length,
    concluidos: onboardings.filter(o => o.status === 'CONCLUIDO').length,
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const filtered = statusFilter ? onboardings.filter(o => o.status === statusFilter) : onboardings;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Onboarding de Clientes</h1>
          <p className="text-gray-500 mt-1">Acompanhe a implantação de novos clientes</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
            { label: 'Pendentes', value: stats.pendentes, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
            { label: 'Em Andamento', value: stats.em_andamento, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
            { label: 'Concluídos', value: stats.concluidos, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} border rounded-xl p-4`}>
              <p className="text-sm text-gray-500">{c.label}</p>
              <p className={`text-3xl font-bold ${c.color} mt-1`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {['', 'PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'PAUSADO'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s === '' ? 'Todos' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🚀</div>
            <p className="text-gray-500">Nenhum onboarding em andamento</p>
            <p className="text-sm text-gray-400 mt-1">Os onboardings são criados automaticamente quando uma licença é ativada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ob => (
              <div key={ob.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandido(expandido === ob.id ? null : ob.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{ob.licenca.cliente.nome}</p>
                      {ob.licenca.cliente.empresa && <span className="text-xs text-gray-500">· {ob.licenca.cliente.empresa}</span>}
                      {ob.licenca.plano && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{ob.licenca.plano.nome}</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">Iniciado em {new Date(ob.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{ob.progresso}%</p>
                      <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1">
                        <div className={`h-1.5 rounded-full ${ob.progresso === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${ob.progresso}%` }} />
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLOR[ob.status]}`}>{ob.status.replace('_', ' ')}</span>
                    <span className="text-gray-400">{expandido === ob.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expandido === ob.id && (
                  <div className="border-t border-gray-100 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {ob.etapas.map((etapa, idx) => (
                        <button key={idx} onClick={() => handleToggleEtapa(ob, idx)} disabled={saving}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${etapa.concluido ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${etapa.concluido ? 'bg-green-500 text-white' : 'border-2 border-gray-300'}`}>
                            {etapa.concluido && <span className="text-xs">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${etapa.concluido ? 'text-green-800 line-through' : 'text-gray-900'}`}>{etapa.titulo}</p>
                            {etapa.data_conclusao && <p className="text-xs text-green-600 mt-0.5">{new Date(etapa.data_conclusao).toLocaleDateString('pt-BR')}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
