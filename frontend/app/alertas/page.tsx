'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Alerta {
  id: string;
  tipo: string;
  urgencia: 'ALTA' | 'MEDIA' | 'BAIXA';
  titulo: string;
  descricao: string;
  data: string;
  link: string;
}

interface Resumo { total: number; alta: number; media: number; baixa: number; }

const URGENCIA_STYLE: Record<string, string> = {
  ALTA: 'bg-red-50 border-red-200 text-red-700',
  MEDIA: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  BAIXA: 'bg-blue-50 border-blue-200 text-blue-700',
};

const TIPO_ICON: Record<string, string> = {
  ATIVIDADE_ATRASADA: '⏰',
  VENCE_HOJE: '🔔',
  SEM_ATIVIDADE: '💤',
  PROPOSTA_EXPIRANDO: '📄',
};

export default function AlertasPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>('TODOS');

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    apiClient.getAlertas()
      .then(res => {
        setAlertas(res.data.data.alertas);
        setResumo(res.data.data.resumo);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, [isAuthenticated]);

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const alertasFiltrados = filtro === 'TODOS' ? alertas : alertas.filter(a => a.urgencia === filtro);

  const formatData = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alertas e Notificações</h1>
          <p className="text-gray-500 mt-1">Atividades atrasadas, vencimentos e oportunidades em risco</p>
        </div>

        {/* Resumo cards */}
        {resumo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total', value: resumo.total, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
              { label: 'Alta Prioridade', value: resumo.alta, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
              { label: 'Média Prioridade', value: resumo.media, color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
              { label: 'Baixa Prioridade', value: resumo.baixa, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-4`}>
                <p className="text-sm text-gray-500">{c.label}</p>
                <p className={`text-3xl font-bold ${c.color} mt-1`}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2">
          {['TODOS', 'ALTA', 'MEDIA', 'BAIXA'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filtro === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f === 'TODOS' ? 'Todos' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Lista de alertas */}
        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Carregando alertas...</div>
        ) : alertasFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-gray-500 font-medium">Nenhum alerta {filtro !== 'TODOS' ? `de prioridade ${filtro.toLowerCase()}` : ''}</p>
            <p className="text-sm text-gray-400 mt-1">Tudo em dia!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alertasFiltrados.map(alerta => (
              <div key={alerta.id} className={`border rounded-xl p-4 ${URGENCIA_STYLE[alerta.urgencia]} flex items-start gap-4`}>
                <div className="text-2xl flex-shrink-0">{TIPO_ICON[alerta.tipo] || '🔔'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{alerta.titulo}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      alerta.urgencia === 'ALTA' ? 'bg-red-100 text-red-800' :
                      alerta.urgencia === 'MEDIA' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>{alerta.urgencia}</span>
                  </div>
                  <p className="text-sm mt-0.5 opacity-80">{alerta.descricao}</p>
                  <p className="text-xs mt-1 opacity-60">{formatData(alerta.data)}</p>
                </div>
                <button
                  onClick={() => router.push(alerta.link)}
                  className="flex-shrink-0 text-sm underline opacity-70 hover:opacity-100">
                  Ver
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
