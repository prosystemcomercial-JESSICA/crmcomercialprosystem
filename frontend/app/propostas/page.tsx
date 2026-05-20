'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Proposta {
  id: string;
  titulo: string;
  valor: number;
  status: string;
  validade?: string;
  created_at: string;
  lead?: { id: string; nome: string; empresa?: string };
}

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-700',
  ENVIADA: 'bg-blue-100 text-blue-700',
  VISUALIZADA: 'bg-purple-100 text-purple-700',
  ACEITA: 'bg-green-100 text-green-700',
  RECUSADA: 'bg-red-100 text-red-700',
  EXPIRADA: 'bg-orange-100 text-orange-700',
};

const emptyForm = { lead_id: '', titulo: '', descricao: '', valor: '', validade: '', condicoes: '', observacoes: '' };

export default function PropostasPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showContratoModal, setShowContratoModal] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [contratoForm, setContratoForm] = useState({ data_inicio: '', data_fim: '', recorrencia: 'MENSAL' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;

      const [propRes, statsRes, leadsRes] = await Promise.all([
        apiClient.getPropostas(params),
        apiClient.getPropostasStats(),
        apiClient.getLeads({ limit: 100, status: 'QUALIFICADO' })
      ]);
      setPropostas(propRes.data.data.propostas);
      setStats(statsRes.data.data);
      setLeads(leadsRes.data.data.leads);
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, statusFilter]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload: any = { ...form, valor: parseFloat(form.valor) };
      if (payload.validade) payload.validade = new Date(payload.validade).toISOString();
      else delete payload.validade;
      await apiClient.createProposta(payload);
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try { await apiClient.updateProposta(id, { status }); fetchData(); }
    catch (e) { console.error(e); }
  };

  const handleConverterContrato = async () => {
    if (!showContratoModal) return;
    setSaving(true);
    try {
      const payload: any = { ...contratoForm, data_inicio: new Date(contratoForm.data_inicio).toISOString() };
      if (payload.data_fim) payload.data_fim = new Date(payload.data_fim).toISOString();
      else delete payload.data_fim;
      await apiClient.converterContrato(showContratoModal, payload);
      setShowContratoModal(null);
      fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao converter');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta proposta?')) return;
    try { await apiClient.deleteProposta(id); fetchData(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Erro ao remover'); }
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Propostas</h1>
            <p className="text-gray-500 mt-1">Gerencie propostas comerciais</p>
          </div>
          <button onClick={() => { setForm(emptyForm); setError(''); setShowModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            + Nova Proposta
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
              { label: 'Enviadas', value: stats.enviadas, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Aceitas', value: stats.aceitas, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Recusadas', value: stats.recusadas, color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'Aprovação', value: `${stats.taxa_aprovacao}%`, color: 'text-teal-700', bg: 'bg-teal-50' },
              { label: 'Valor Aceito', value: `R$ ${(stats.valor_aceito / 1000).toFixed(1)}k`, color: 'text-purple-700', bg: 'bg-purple-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2">
          {['', 'RASCUNHO', 'ENVIADA', 'VISUALIZADA', 'ACEITA', 'RECUSADA', 'EXPIRADA'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s === '' ? 'Todas' : s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {dataLoading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : propostas.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-gray-500">Nenhuma proposta encontrada</p>
              <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Criar primeira proposta</button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Proposta</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lead</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Valor</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Validade</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {propostas.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{p.titulo}</p>
                      <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-900">{p.lead?.nome}</p>
                      <p className="text-xs text-gray-500">{p.lead?.empresa}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">R$ {p.valor.toLocaleString('pt-BR')}</p>
                    </td>
                    <td className="px-5 py-4">
                      <select value={p.status} onChange={e => handleUpdateStatus(p.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:ring-1 outline-none cursor-pointer ${STATUS_COLORS[p.status]}`}>
                        {['RASCUNHO', 'ENVIADA', 'VISUALIZADA', 'ACEITA', 'RECUSADA', 'EXPIRADA'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">
                      {p.validade ? new Date(p.validade).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {p.status === 'ACEITA' && (
                        <button onClick={() => setShowContratoModal(p.id)}
                          className="text-green-600 hover:text-green-800 text-xs mr-3 font-medium">
                          🔄 Converter
                        </button>
                      )}
                      <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 text-sm">Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Nova Proposta Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Nova Proposta</h2>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input value={form.titulo} onChange={e => setForm((p: any) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Proposta de licença ProSystem ERP"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
                  <input type="number" value={form.valor} onChange={e => setForm((p: any) => ({ ...p, valor: e.target.value }))}
                    placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Validade</label>
                  <input type="datetime-local" value={form.validade} onChange={e => setForm((p: any) => ({ ...p, validade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm((p: any) => ({ ...p, descricao: e.target.value }))}
                  rows={3} placeholder="Detalhes da proposta..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.lead_id || !form.titulo || !form.valor}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Converter Contrato Modal */}
      {showContratoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Converter em Contrato</h2>
            <p className="text-sm text-gray-500 mb-5">A proposta será marcada como aceita e um contrato será criado.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Início *</label>
                <input type="datetime-local" value={contratoForm.data_inicio}
                  onChange={e => setContratoForm(p => ({ ...p, data_inicio: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recorrência</label>
                <select value={contratoForm.recorrencia} onChange={e => setContratoForm(p => ({ ...p, recorrencia: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                  {['UNICO', 'MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowContratoModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleConverterContrato} disabled={saving || !contratoForm.data_inicio}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                {saving ? 'Convertendo...' : '✓ Converter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
