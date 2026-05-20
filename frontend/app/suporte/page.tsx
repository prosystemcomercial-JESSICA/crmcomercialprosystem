'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Ticket {
  id: string;
  titulo: string;
  descricao?: string;
  categoria: string;
  prioridade: string;
  status: string;
  created_at: string;
  resolucao_at?: string;
  sla_horas?: number;
  cliente: { id: string; nome: string; empresa?: string };
  licenca?: { plano?: { nome: string } };
}

const PRIORIDADE_COLOR: Record<string, string> = {
  BAIXA: 'bg-gray-100 text-gray-600',
  MEDIA: 'bg-blue-100 text-blue-700',
  ALTA: 'bg-orange-100 text-orange-700',
  CRITICA: 'bg-red-100 text-red-700',
};

const STATUS_COLOR: Record<string, string> = {
  ABERTO: 'bg-yellow-100 text-yellow-700',
  EM_ATENDIMENTO: 'bg-blue-100 text-blue-700',
  AGUARDANDO_CLIENTE: 'bg-purple-100 text-purple-700',
  RESOLVIDO: 'bg-green-100 text-green-700',
  FECHADO: 'bg-gray-100 text-gray-500',
};

const CATEGORIA_ICON: Record<string, string> = {
  TECNICO: '🔧', FISCAL: '🧾', COMERCIAL: '💼', FINANCEIRO: '💰', TREINAMENTO: '📚',
};

export default function SuportePage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [statsData, setStatsData] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [prioFilter, setPrioFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ cliente_id: '', titulo: '', descricao: '', categoria: 'TECNICO', prioridade: 'MEDIA', sla_horas: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadData = () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    if (prioFilter) params.prioridade = prioFilter;
    apiClient.getTickets(params)
      .then(res => {
        setTickets(res.data.data.tickets);
        setTotal(res.data.data.total);
        setStatsData(res.data.data.stats || []);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadData(); }, [isAuthenticated, statusFilter, prioFilter]);

  const openCreate = async () => {
    const cls = await apiClient.getClientes();
    setClientes(cls.data.data.clientes || []);
    setForm({ cliente_id: '', titulo: '', descricao: '', categoria: 'TECNICO', prioridade: 'MEDIA', sla_horas: '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.sla_horas) payload.sla_horas = parseInt(payload.sla_horas);
      else delete payload.sla_horas;
      await apiClient.createTicket(payload);
      setShowModal(false);
      loadData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await apiClient.updateTicket(id, { status });
    loadData();
  };

  const tempoAberto = (dt: string) => {
    const h = Math.floor((Date.now() - new Date(dt).getTime()) / 3600000);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  const statsCount = (status: string) => {
    const s = statsData.find((x: any) => x.status === status);
    return s ? s._count.id : 0;
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Suporte Técnico</h1>
            <p className="text-gray-500 mt-1">Tickets de suporte e atendimento ao cliente</p>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            + Abrir Ticket
          </button>
        </div>

        {/* Stats rápidos */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Abertos', status: 'ABERTO', color: 'text-yellow-700', bg: 'bg-yellow-50' },
            { label: 'Em Atendimento', status: 'EM_ATENDIMENTO', color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Aguardando Cliente', status: 'AGUARDANDO_CLIENTE', color: 'text-purple-700', bg: 'bg-purple-50' },
            { label: 'Resolvidos', status: 'RESOLVIDO', color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Fechados', status: 'FECHADO', color: 'text-gray-600', bg: 'bg-gray-50' },
          ].map(c => (
            <div key={c.status} className={`${c.bg} rounded-xl p-3`}>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color} mt-0.5`}>{statsCount(c.status)}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex gap-1">
            {['', 'ABERTO', 'EM_ATENDIMENTO', 'RESOLVIDO', 'FECHADO'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {s === '' ? 'Todos' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {['', 'CRITICA', 'ALTA', 'MEDIA', 'BAIXA'].map(p => (
              <button key={p} onClick={() => setPrioFilter(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${prioFilter === p ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {p === '' ? 'Todas prioridades' : p}
              </button>
            ))}
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {dataLoading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🎧</div>
              <p className="text-gray-500">Nenhum ticket encontrado</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ticket</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Prioridade</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tempo</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{ticket.titulo}</p>
                      {ticket.descricao && <p className="text-xs text-gray-400 truncate max-w-64">{ticket.descricao}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-900">{ticket.cliente.nome}</p>
                      {ticket.cliente.empresa && <p className="text-xs text-gray-400">{ticket.cliente.empresa}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm">{CATEGORIA_ICON[ticket.categoria]} {ticket.categoria}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${PRIORIDADE_COLOR[ticket.prioridade]}`}>{ticket.prioridade}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{tempoAberto(ticket.created_at)}</td>
                    <td className="px-5 py-4">
                      <select value={ticket.status} onChange={e => handleUpdateStatus(ticket.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer border-0 ${STATUS_COLOR[ticket.status]}`}>
                        {['ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'RESOLVIDO', 'FECHADO'].map(s => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Abrir Ticket</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Cliente *</label>
                <select value={form.cliente_id} onChange={e => setForm((p: any) => ({ ...p, cliente_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecione...</option>
                  {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` — ${c.empresa}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Título *</label>
                <input value={form.titulo} onChange={e => setForm((p: any) => ({ ...p, titulo: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Descreva o problema brevemente" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Categoria</label>
                  <select value={form.categoria} onChange={e => setForm((p: any) => ({ ...p, categoria: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['TECNICO', 'FISCAL', 'COMERCIAL', 'FINANCEIRO', 'TREINAMENTO'].map(c => <option key={c} value={c}>{CATEGORIA_ICON[c]} {c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Prioridade</label>
                  <select value={form.prioridade} onChange={e => setForm((p: any) => ({ ...p, prioridade: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm((p: any) => ({ ...p, descricao: e.target.value }))}
                  rows={3} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Detalhes do problema..." />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">SLA (horas)</label>
                <input type="number" value={form.sla_horas} onChange={e => setForm((p: any) => ({ ...p, sla_horas: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 8, 24, 48" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={!form.cliente_id || !form.titulo || saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Abrindo...' : 'Abrir Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
