'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Atividade {
  id: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  status: string;
  resultado?: string;
  data_prevista?: string;
  data_realizada?: string;
  created_at: string;
  lead?: { id: string; nome: string; empresa?: string };
}

const TIPO_ICON: Record<string, string> = {
  LIGACAO: '📞', EMAIL: '📧', REUNIAO: '📅', WHATSAPP: '💬',
  VISITA: '🏢', TAREFA: '✅', OUTRO: '📝'
};

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  CONCLUIDA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const emptyForm = {
  lead_id: '', tipo: 'LIGACAO', titulo: '', descricao: '',
  data_prevista: '', responsavel_id: ''
};

export default function AtividadesPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [agenda, setAgenda] = useState<Atividade[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'agenda' | 'todas'>('agenda');

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (tipoFilter) params.tipo = tipoFilter;

      const [atRes, agendaRes, leadsRes] = await Promise.all([
        apiClient.getAtividades(params),
        apiClient.getAgenda(),
        apiClient.getLeads({ limit: 100 })
      ]);
      setAtividades(atRes.data.data.atividades);
      setAgenda(agendaRes.data.data);
      setLeads(leadsRes.data.data.leads);
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, statusFilter, tipoFilter]);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setError(''); setShowModal(true); };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload: any = { ...form };
      if (payload.data_prevista) payload.data_prevista = new Date(payload.data_prevista).toISOString();
      else delete payload.data_prevista;

      if (editingId) await apiClient.updateAtividade(editingId, payload);
      else await apiClient.createAtividade(payload);
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const handleConcluir = async (id: string) => {
    try {
      await apiClient.updateAtividade(id, { status: 'CONCLUIDA', data_realizada: new Date().toISOString() });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover atividade?')) return;
    try { await apiClient.deleteAtividade(id); fetchData(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Erro ao remover'); }
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const displayList = activeTab === 'agenda' ? agenda : atividades;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Atividades</h1>
            <p className="text-gray-500 mt-1">Agenda e histórico de atividades comerciais</p>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            + Nova Atividade
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {[{ key: 'agenda', label: `📅 Agenda (${agenda.length})` }, { key: 'todas', label: `📋 Todas (${atividades.length})` }].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters for "todas" tab */}
        {activeTab === 'todas' && (
          <div className="flex gap-2 flex-wrap">
            {['', 'PENDENTE', 'CONCLUIDA', 'CANCELADA'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {s === '' ? 'Todos status' : s}
              </button>
            ))}
            <div className="h-5 w-px bg-gray-300 self-center" />
            {['', 'LIGACAO', 'EMAIL', 'REUNIAO', 'WHATSAPP', 'VISITA', 'TAREFA'].map(t => (
              <button key={t} onClick={() => setTipoFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tipoFilter === t ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {t === '' ? 'Todos tipos' : `${TIPO_ICON[t]} ${t}`}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        {dataLoading ? (
          <div className="text-center p-8 text-gray-500">Carregando...</div>
        ) : displayList.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">{activeTab === 'agenda' ? '📅' : '📝'}</div>
            <p className="text-gray-500">
              {activeTab === 'agenda' ? 'Nenhuma atividade pendente nos próximos 7 dias' : 'Nenhuma atividade encontrada'}
            </p>
            <button onClick={openCreate} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Criar atividade</button>
          </div>
        ) : (
          <div className="space-y-2">
            {displayList.map(at => (
              <div key={at.id} className={`bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4 hover:shadow-sm transition-shadow ${at.status === 'CONCLUIDA' ? 'opacity-60' : ''}`}>
                <div className="text-2xl pt-0.5">{TIPO_ICON[at.tipo]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className={`font-medium text-gray-900 ${at.status === 'CONCLUIDA' ? 'line-through' : ''}`}>{at.titulo}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[at.status]}`}>
                      {at.status}
                    </span>
                  </div>
                  {at.lead && (
                    <p className="text-sm text-blue-600 mt-0.5">{at.lead.nome} {at.lead.empresa ? `· ${at.lead.empresa}` : ''}</p>
                  )}
                  {at.descricao && <p className="text-sm text-gray-500 mt-0.5">{at.descricao}</p>}
                  {at.resultado && <p className="text-sm text-green-700 mt-1 italic">"{at.resultado}"</p>}
                  {at.data_prevista && (
                    <p className="text-xs text-gray-400 mt-1">
                      📅 {new Date(at.data_prevista).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {at.status === 'PENDENTE' && (
                    <button onClick={() => handleConcluir(at.id)} className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium">
                      ✓ Concluir
                    </button>
                  )}
                  <button onClick={() => handleDelete(at.id)} className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Nova Atividade</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead *</label>
                <select value={form.lead_id} onChange={e => setForm((p: any) => ({ ...p, lead_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                  <option value="">Selecione um lead</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.nome} — {l.empresa}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select value={form.tipo} onChange={e => setForm((p: any) => ({ ...p, tipo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                    {['LIGACAO', 'EMAIL', 'REUNIAO', 'WHATSAPP', 'VISITA', 'TAREFA', 'OUTRO'].map(t => (
                      <option key={t} value={t}>{TIPO_ICON[t]} {t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Prevista</label>
                  <input type="datetime-local" value={form.data_prevista} onChange={e => setForm((p: any) => ({ ...p, data_prevista: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input value={form.titulo} onChange={e => setForm((p: any) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Ligação de follow-up"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm((p: any) => ({ ...p, descricao: e.target.value }))}
                  rows={2} placeholder="Detalhes da atividade..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.lead_id || !form.titulo}
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
