'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Lead {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  cargo?: string;
  origem: string;
  status: string;
  etapa_funil: string;
  temperatura: string;
  valor_estimado?: number;
  probabilidade?: number;
  responsavel_id?: string;
  created_at: string;
  _count?: { atividades: number; propostas: number };
}

const STATUS_COLORS: Record<string, string> = {
  NOVO: 'bg-gray-100 text-gray-700',
  QUALIFICADO: 'bg-blue-100 text-blue-700',
  EM_CONTATO: 'bg-purple-100 text-purple-700',
  PROPOSTA: 'bg-yellow-100 text-yellow-700',
  NEGOCIACAO: 'bg-orange-100 text-orange-700',
  GANHO: 'bg-green-100 text-green-700',
  PERDIDO: 'bg-red-100 text-red-700',
  NUTRICAO: 'bg-teal-100 text-teal-700',
};

const TEMP_ICON: Record<string, string> = { FRIO: '🔵', MORNO: '🟡', QUENTE: '🔴' };

const emptyForm = {
  nome: '', email: '', telefone: '', empresa: '', cargo: '',
  cidade: '', estado: '', origem: 'MANUAL', temperatura: 'FRIO',
  valor_estimado: '', probabilidade: '', observacoes: ''
};

export default function LeadsPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [historicoModal, setHistoricoModal] = useState(false);
  const [historicoLead, setHistoricoLead] = useState<Lead | null>(null);
  const [historicoData, setHistoricoData] = useState<any>(null);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const limit = 20;

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      const params: any = { page, limit };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const [leadsRes, statsRes] = await Promise.all([
        apiClient.getLeads(params),
        apiClient.getLeadsStats()
      ]);
      setLeads(leadsRes.data.data.leads);
      setTotal(leadsRes.data.data.total);
      setStats(statsRes.data.data);
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, page, search, statusFilter]);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setError(''); setShowModal(true); };
  const openEdit = (l: Lead) => {
    setForm({
      nome: l.nome, email: l.email || '', telefone: l.telefone || '',
      empresa: l.empresa || '', cargo: l.cargo || '', cidade: '',
      estado: '', origem: l.origem, temperatura: l.temperatura,
      valor_estimado: l.valor_estimado?.toString() || '', probabilidade: l.probabilidade?.toString() || '',
      observacoes: ''
    });
    setEditingId(l.id);
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload: any = { ...form };
      if (payload.valor_estimado) payload.valor_estimado = parseFloat(payload.valor_estimado);
      else delete payload.valor_estimado;
      if (payload.probabilidade) payload.probabilidade = parseInt(payload.probabilidade);
      else delete payload.probabilidade;
      if (!payload.email) delete payload.email;

      if (editingId) await apiClient.updateLead(editingId, payload);
      else await apiClient.createLead(payload);
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este lead?')) return;
    try { await apiClient.deleteLead(id); fetchData(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Erro ao remover'); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try { await apiClient.updateLead(id, { status }); fetchData(); }
    catch (e) { console.error(e); }
  };

  const openHistorico = async (lead: Lead) => {
    setHistoricoLead(lead);
    setHistoricoModal(true);
    setHistoricoData(null);
    setHistoricoLoading(true);
    try {
      const res = await apiClient.getLeadHistorico(lead.id);
      setHistoricoData(res.data.data);
    } catch (e) { console.error(e); }
    finally { setHistoricoLoading(false); }
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
            <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
            <p className="text-gray-500 mt-1">{total} leads no pipeline</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/funil')} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              🎯 Ver Funil
            </button>
            <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              + Novo Lead
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
              { label: 'Novos', value: stats.novos, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Em Contato', value: stats.emContato, color: 'text-purple-700', bg: 'bg-purple-50' },
              { label: 'Ganhos', value: stats.ganhos, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Perdidos', value: stats.perdidos, color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'Pipeline', value: `R$ ${(stats.valor_pipeline / 1000).toFixed(1)}k`, color: 'text-orange-700', bg: 'bg-orange-50' },
              { label: 'Conversão', value: `${stats.taxa_conversao}%`, color: 'text-teal-700', bg: 'bg-teal-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + Filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <input type="text" placeholder="Buscar leads..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {['', 'NOVO', 'QUALIFICADO', 'EM_CONTATO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
                className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {s === '' ? 'Todos' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {dataLoading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : leads.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🎯</div>
              <p className="text-gray-500">Nenhum lead encontrado</p>
              <button onClick={openCreate} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Adicionar primeiro lead</button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Temperatura</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Atividades</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-semibold">
                          {lead.nome.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{lead.nome}</p>
                          <p className="text-xs text-gray-500">{lead.empresa} {lead.cargo ? `· ${lead.cargo}` : ''}</p>
                          <p className="text-xs text-gray-400">{lead.telefone || lead.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-lg" title={lead.temperatura}>{TEMP_ICON[lead.temperatura]}</span>
                      <p className="text-xs text-gray-500">{lead.origem}</p>
                    </td>
                    <td className="px-5 py-4">
                      <select value={lead.status} onChange={e => handleUpdateStatus(lead.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer ${STATUS_COLORS[lead.status]}`}>
                        {['NOVO', 'QUALIFICADO', 'EM_CONTATO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO', 'NUTRICAO'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      {lead.valor_estimado ? (
                        <div>
                          <p className="text-sm font-semibold text-gray-900">R$ {lead.valor_estimado.toLocaleString('pt-BR')}</p>
                          {lead.probabilidade && <p className="text-xs text-gray-400">{lead.probabilidade}% prob.</p>}
                        </div>
                      ) : <span className="text-gray-400 text-sm">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">{lead._count?.atividades || 0} ativ. · {lead._count?.propostas || 0} prop.</p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => openHistorico(lead)} className="text-gray-500 hover:text-gray-700 text-sm mr-3">Histórico</button>
                      <button onClick={() => openEdit(lead)} className="text-blue-600 hover:text-blue-800 text-sm mr-3">Editar</button>
                      <button onClick={() => handleDelete(lead.id)} className="text-red-500 hover:text-red-700 text-sm">Remover</button>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-5">{editingId ? 'Editar Lead' : 'Novo Lead'}</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'nome', label: 'Nome *', placeholder: 'Nome do lead', colSpan: 2 },
                { key: 'empresa', label: 'Empresa', placeholder: 'Nome da empresa', colSpan: 1 },
                { key: 'cargo', label: 'Cargo', placeholder: 'Cargo / função', colSpan: 1 },
                { key: 'telefone', label: 'Telefone', placeholder: '(27) 99999-0000', colSpan: 1 },
                { key: 'email', label: 'Email', placeholder: 'email@empresa.com', colSpan: 1 },
                { key: 'cidade', label: 'Cidade', placeholder: 'Vitória', colSpan: 1 },
                { key: 'estado', label: 'Estado', placeholder: 'ES', colSpan: 1 },
                { key: 'valor_estimado', label: 'Valor Estimado (R$)', placeholder: '0.00', colSpan: 1 },
                { key: 'probabilidade', label: 'Probabilidade (%)', placeholder: '50', colSpan: 1 },
              ].map(f => (
                <div key={f.key} className={f.colSpan === 2 ? 'col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input value={form[f.key]} onChange={e => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                <select value={form.origem} onChange={e => setForm((p: any) => ({ ...p, origem: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                  {['MANUAL', 'SITE', 'INDICACAO', 'CAMPANHA', 'EVENTO', 'OUTRO'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temperatura</label>
                <select value={form.temperatura} onChange={e => setForm((p: any) => ({ ...p, temperatura: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                  {['FRIO', 'MORNO', 'QUENTE'].map(t => <option key={t} value={t}>{TEMP_ICON[t]} {t}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm((p: any) => ({ ...p, observacoes: e.target.value }))}
                  rows={2} placeholder="Notas sobre o lead..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" />
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
      {/* Modal Histórico */}
      {historicoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Histórico do Lead</h2>
                {historicoLead && <p className="text-sm text-gray-500">{historicoLead.nome}{historicoLead.empresa ? ` · ${historicoLead.empresa}` : ''}</p>}
              </div>
              <button onClick={() => setHistoricoModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {historicoLoading ? (
                <div className="text-center py-8 text-gray-400">Carregando timeline...</div>
              ) : !historicoData ? (
                <div className="text-center py-8 text-gray-400">Sem dados disponíveis</div>
              ) : (
                <div className="space-y-3">
                  {historicoData.timeline.map((item: any, idx: number) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0 pb-3 border-b border-gray-50 last:border-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-gray-900 text-sm">{item.titulo}</p>
                          {item.status && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded flex-shrink-0">{item.status}</span>
                          )}
                        </div>
                        {item.descricao && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.descricao}</p>}
                        <p className="text-xs text-gray-400 mt-1">{new Date(item.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                  {historicoData.timeline.length === 0 && (
                    <p className="text-center text-gray-400 py-6 text-sm">Nenhuma atividade registrada ainda</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
