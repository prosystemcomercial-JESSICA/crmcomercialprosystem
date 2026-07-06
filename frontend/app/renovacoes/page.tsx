'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ExportButton from '@/components/ui/ExportButton';
import { apiClient } from '@/lib/api-client';
import { RotateCcw } from 'lucide-react';

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
  PENDENTE:      'bg-yellow-100 text-yellow-700',
  EM_NEGOCIACAO: 'bg-blue-100 text-blue-700',
  RENOVADA:      'bg-green-100 text-green-700',
  CANCELADA:     'bg-opacity-0 ',
  PERDIDA:       'bg-red-100 text-red-700',
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--t-primary)' }} />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Renovações</h1>
            <p style={{ color: 'var(--t-text-muted)' }} className="mt-1">Controle de vencimentos e renovações de licenças</p>
          </div>
          <ExportButton
            nome="renovacoes" titulo="Renovações — Licenças"
            linhas={renovacoes}
            colunas={[
              { header: 'Cliente', value: (r: Renovacao) => r.licenca?.cliente?.nome || '' },
              { header: 'Empresa', value: (r: Renovacao) => r.licenca?.cliente?.empresa || '' },
              { header: 'Plano', value: (r: Renovacao) => r.licenca?.plano?.nome || '' },
              { header: 'Status', value: (r: Renovacao) => r.status },
              { header: 'Vencimento', value: (r: Renovacao) => r.data_vencimento ? new Date(r.data_vencimento).toLocaleDateString('pt-BR') : '' },
              { header: 'Dias p/ vencer', value: (r: Renovacao) => r.dias_para_vencer },
              { header: 'Valor atual (R$)', value: (r: Renovacao) => r.valor_atual },
              { header: 'Valor novo (R$)', value: (r: Renovacao) => r.valor_novo ?? '' },
            ]}
          />
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="ps-card rounded-xl p-4">
              <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>Total</p>
              <p className="text-3xl font-bold mt-1" style={{ color: 'var(--t-text-secondary)' }}>{stats.total}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>Críticas (≤15 dias)</p>
              <p className="text-3xl font-bold text-orange-700 mt-1">{stats.criticas}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
              <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>Pendentes</p>
              <p className="text-3xl font-bold text-yellow-700 mt-1">{stats.pendentes}</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>Renovadas</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{stats.renovadas}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {['', 'PENDENTE', 'EM_NEGOCIACAO', 'RENOVADA', 'CANCELADA', 'PERDIDA'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={
                statusFilter === s
                  ? { background: 'var(--t-primary)', color: '#fff' }
                  : { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', color: 'var(--t-text-secondary)' }
              }>
              {s === '' ? 'Todas' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {dataLoading ? (
          <div className="text-center p-12" style={{ color: 'var(--t-text-muted)' }}>Carregando...</div>
        ) : renovacoes.length === 0 ? (
          <div className="ps-card rounded-xl p-12 text-center">
            <div className="flex justify-center mb-3">
              <RotateCcw size={36} style={{ color: 'var(--t-text-muted)', opacity: 0.5 }} />
            </div>
            <p style={{ color: 'var(--t-text-muted)' }}>Nenhuma renovação encontrada</p>
            <p className="text-sm mt-1" style={{ color: 'var(--t-text-muted)', opacity: 0.7 }}>Crie licenças com data de vencimento para gestão automática de renovações</p>
          </div>
        ) : (
          <div className="space-y-3">
            {renovacoes.map(r => (
              <div key={r.id} className={`bg-white rounded-xl border-2 ${urgColor(r.dias_para_vencer, r.status)} p-4 flex items-center gap-4`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>{r.licenca.cliente.nome}</p>
                    {r.licenca.cliente.empresa && (
                      <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>· {r.licenca.cliente.empresa}</span>
                    )}
                    {r.licenca.plano && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--t-primary-light)', color: 'var(--t-primary)' }}>
                        {r.licenca.plano.nome}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm" style={{ color: 'var(--t-text-secondary)' }}>
                    <span>Vence: {new Date(r.data_vencimento).toLocaleDateString('pt-BR')}</span>
                    <span className={`font-semibold ${r.dias_para_vencer <= 0 ? 'text-red-600' : r.dias_para_vencer <= 15 ? 'text-orange-600' : ''}`}
                      style={r.dias_para_vencer > 15 ? { color: 'var(--t-text-secondary)' } : undefined}>
                      {r.dias_para_vencer <= 0
                        ? `${Math.abs(r.dias_para_vencer)} dias vencida`
                        : `${r.dias_para_vencer} dias restantes`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm">
                    <span style={{ color: 'var(--t-text-secondary)' }}>
                      Valor atual: <strong>R$ {r.valor_atual.toLocaleString('pt-BR')}</strong>
                    </span>
                    {r.valor_novo && (
                      <span className="text-green-700">Novo: <strong>R$ {r.valor_novo.toLocaleString('pt-BR')}</strong></span>
                    )}
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
