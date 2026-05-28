'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Campanha {
  id: string;
  nome: string;
  descricao?: string;
  status: string;
  data_inicio: string;
  data_fim: string;
  created_at: string;
  _count?: { disparos: number; acoes: number };
}

interface CampanhaForm {
  nome: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
}

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-700',
  ATIVA: 'bg-green-100 text-green-700',
  PAUSADA: 'bg-yellow-100 text-yellow-700',
  FINALIZADA: 'bg-blue-100 text-blue-700',
  ARQUIVADA: 'bg-red-100 text-red-700',
};

const today = new Date();
const nextMonth = new Date(today);
nextMonth.setMonth(nextMonth.getMonth() + 1);

const emptyForm: CampanhaForm = {
  nome: '',
  descricao: '',
  data_inicio: today.toISOString().slice(0, 16),
  data_fim: nextMonth.toISOString().slice(0, 16)
};

const ROLES_GERENCIAR_CAMPANHAS = ['CEO', 'ADMIN', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO_TECNICA', 'GERENTE', 'DIRETOR'];

export default function CampanhasPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const podeGerenciar = ROLES_GERENCIAR_CAMPANHAS.includes((user?.role || '').toUpperCase());
  const router = useRouter();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampanhaForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        apiClient.getCampanhas(0, 50, statusFilter || undefined),
        apiClient.getCampanhasStats()
      ]);
      setCampanhas(res.data.data.campanhas);
      setTotal(res.data.data.total);
      setStats(statsRes.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, statusFilter]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setShowModal(true);
  };

  const openEdit = (c: Campanha) => {
    setForm({
      nome: c.nome,
      descricao: c.descricao || '',
      data_inicio: new Date(c.data_inicio).toISOString().slice(0, 16),
      data_fim: new Date(c.data_fim).toISOString().slice(0, 16)
    });
    setEditingId(c.id);
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        data_inicio: new Date(form.data_inicio).toISOString(),
        data_fim: new Date(form.data_fim).toISOString()
      };
      if (editingId) {
        await apiClient.updateCampanha(editingId, payload);
      } else {
        await apiClient.createCampanha(payload);
      }
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (id: string, status: string) => {
    try {
      await apiClient.updateCampanha(id, { status });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta campanha?')) return;
    try {
      await apiClient.deleteCampanha(id);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao remover');
    }
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Campanhas</h1>
            <p className="text-gray-500 mt-1">
              {podeGerenciar
                ? 'Gerencie campanhas de engajamento e retenção'
                : 'Acompanhe as campanhas ativas e seus detalhes'}
            </p>
          </div>
          {podeGerenciar && (
            <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              + Nova Campanha
            </button>
          )}
        </div>

        {/* Aviso para vendedor */}
        {!podeGerenciar && (
          <div style={{ background: '#EBF4FF', border: '1px solid #C3DCFC', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>📢</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#4B8EC8' }}>Visualização da equipe comercial</div>
              <div style={{ fontSize: 12, color: '#4A6E8A' }}>Apenas CEO, Diretor e Supervisores podem criar ou editar campanhas. Acompanhe abaixo as campanhas ativas no momento.</div>
            </div>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
              { label: 'Ativas', value: stats.ativas, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Rascunhos', value: stats.rascunhos, color: 'text-yellow-700', bg: 'bg-yellow-50' },
              { label: 'Finalizadas', value: stats.finalizadas, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Disparos', value: stats.totalDisparos, color: 'text-purple-700', bg: 'bg-purple-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color} mt-1`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Status filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['', 'RASCUNHO', 'ATIVA', 'PAUSADA', 'FINALIZADA', 'ARQUIVADA'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === '' ? 'Todas' : s}
            </button>
          ))}
        </div>

        {/* Cards */}
        {dataLoading ? (
          <div className="text-center p-8 text-gray-500">Carregando...</div>
        ) : campanhas.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">📣</div>
            <p className="text-gray-500">Nenhuma campanha encontrada</p>
            <button onClick={openCreate} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              Criar primeira campanha
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campanhas.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{c.nome}</h3>
                    {c.descricao && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{c.descricao}</p>}
                  </div>
                  <span className={`ml-2 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                    {c.status}
                  </span>
                </div>

                <div className="text-xs text-gray-500 space-y-1 mb-4">
                  <p>📅 Início: {new Date(c.data_inicio).toLocaleDateString('pt-BR')}</p>
                  <p>📅 Fim: {new Date(c.data_fim).toLocaleDateString('pt-BR')}</p>
                  <p>📨 {c._count?.disparos || 0} disparos • {c._count?.acoes || 0} ações</p>
                </div>

                {podeGerenciar ? (
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <select
                      value={c.status}
                      onChange={e => handleChangeStatus(c.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 flex-1 focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      {['RASCUNHO', 'ATIVA', 'PAUSADA', 'FINALIZADA', 'ARQUIVADA'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button onClick={() => openEdit(c)} className="px-3 py-1 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="px-3 py-1 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">
                      Remover
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-700'}`}>
                      {c.status === 'ATIVA' ? '🟢 Ativa' : c.status === 'PAUSADA' ? '⏸ Pausada' : c.status === 'FINALIZADA' ? '🏁 Finalizada' : c.status === 'RASCUNHO' ? '📝 Rascunho' : '📦 Arquivada'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-5">{editingId ? 'Editar Campanha' : 'Nova Campanha'}</h2>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nome da campanha" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Objetivo da campanha..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Início *</label>
                  <input type="datetime-local" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim *</label>
                  <input type="datetime-local" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.nome}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
