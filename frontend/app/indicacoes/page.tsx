'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Indicacao {
  id: string;
  nome_indicado: string;
  email_indicado?: string;
  telefone_indicado?: string;
  empresa_indicado?: string;
  status: string;
  bonus_valor: number;
  bonus_pago: boolean;
  created_at: string;
  cliente_indicador: { id: string; nome: string; empresa?: string };
  lead?: { id: string; nome: string; status: string; valor_estimado?: number };
}

const STATUS_COLOR: Record<string, string> = {
  PENDENTE: 'bg-gray-100 text-gray-600',
  CONTATO: 'bg-blue-100 text-blue-700',
  CONVERTIDO: 'bg-green-100 text-green-700',
  PERDIDO: 'bg-red-100 text-red-700',
};

export default function IndicacoesPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ cliente_indicador_id: '', nome_indicado: '', email_indicado: '', telefone_indicado: '', empresa_indicado: '', bonus_valor: '0', observacoes: '' });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadData = () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    apiClient.getIndicacoes(params)
      .then(res => {
        setIndicacoes(res.data.data.indicacoes);
        setStats(res.data.data.stats);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadData(); }, [isAuthenticated, statusFilter]);

  const openCreate = async () => {
    const cls = await apiClient.getClientes();
    setClientes(cls.data.data.clientes || []);
    setForm({ cliente_indicador_id: '', nome_indicado: '', email_indicado: '', telefone_indicado: '', empresa_indicado: '', bonus_valor: '0', observacoes: '' });
    setShowModal(true);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await apiClient.createIndicacao({ ...form, bonus_valor: parseFloat(form.bonus_valor) });
      setShowModal(false);
      loadData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await apiClient.updateIndicacao(id, { status });
    loadData();
  };

  const handlePagarBonus = async (id: string) => {
    await apiClient.updateIndicacao(id, { bonus_pago: true });
    loadData();
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Programa de Indicações</h1>
            <p className="text-gray-500 mt-1">Clientes que indicam novos clientes para a ProSystem</p>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            + Nova Indicação
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-sm text-gray-500">Total de indicações</p>
              <p className="text-3xl font-bold text-gray-700 mt-1">{stats.total}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <p className="text-sm text-gray-500">Convertidas</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{stats.convertidas}</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
              <p className="text-sm text-gray-500">Pendentes</p>
              <p className="text-3xl font-bold text-yellow-700 mt-1">{stats.pendentes}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <p className="text-sm text-gray-500">Bônus pagos</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">R$ {stats.bonus_total.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {['', 'PENDENTE', 'CONTATO', 'CONVERTIDO', 'PERDIDO'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s === '' ? 'Todas' : s}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {dataLoading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : indicacoes.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🤝</div>
              <p className="text-gray-500">Nenhuma indicação encontrada</p>
              <p className="text-sm text-gray-400 mt-1">Quando um cliente indicar um novo contato, registre aqui</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Indicado</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Quem indicou</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lead criado</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Bônus</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {indicacoes.map(ind => (
                  <tr key={ind.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{ind.nome_indicado}</p>
                      {ind.empresa_indicado && <p className="text-xs text-gray-500">{ind.empresa_indicado}</p>}
                      {ind.email_indicado && <p className="text-xs text-gray-400">{ind.email_indicado}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-900">{ind.cliente_indicador.nome}</p>
                      {ind.cliente_indicador.empresa && <p className="text-xs text-gray-400">{ind.cliente_indicador.empresa}</p>}
                    </td>
                    <td className="px-5 py-4">
                      {ind.lead ? (
                        <div>
                          <p className="text-sm text-gray-700">{ind.lead.nome}</p>
                          <p className="text-xs text-gray-400">{ind.lead.status}</p>
                        </div>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      {ind.bonus_valor > 0 ? (
                        <div>
                          <p className="text-sm font-semibold text-green-700">R$ {ind.bonus_valor.toLocaleString('pt-BR')}</p>
                          <span className={`text-xs ${ind.bonus_pago ? 'text-green-600' : 'text-yellow-600'}`}>
                            {ind.bonus_pago ? '✓ Pago' : 'Pendente'}
                          </span>
                        </div>
                      ) : <span className="text-xs text-gray-400">Sem bônus</span>}
                    </td>
                    <td className="px-5 py-4">
                      <select value={ind.status} onChange={e => handleUpdateStatus(ind.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer border-0 ${STATUS_COLOR[ind.status]}`}>
                        {['PENDENTE', 'CONTATO', 'CONVERTIDO', 'PERDIDO'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {ind.bonus_valor > 0 && !ind.bonus_pago && (
                        <button onClick={() => handlePagarBonus(ind.id)} className="text-xs text-green-600 hover:underline">
                          Marcar bônus pago
                        </button>
                      )}
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
              <h2 className="text-lg font-semibold">Nova Indicação</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Cliente que indicou *</label>
                <select value={form.cliente_indicador_id} onChange={e => setForm((p: any) => ({ ...p, cliente_indicador_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecione...</option>
                  {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` — ${c.empresa}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Nome do indicado *</label>
                <input value={form.nome_indicado} onChange={e => setForm((p: any) => ({ ...p, nome_indicado: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input value={form.email_indicado} onChange={e => setForm((p: any) => ({ ...p, email_indicado: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" type="email" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Telefone</label>
                  <input value={form.telefone_indicado} onChange={e => setForm((p: any) => ({ ...p, telefone_indicado: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Empresa</label>
                <input value={form.empresa_indicado} onChange={e => setForm((p: any) => ({ ...p, empresa_indicado: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Bônus para o indicador (R$)</label>
                <input type="number" value={form.bonus_valor} onChange={e => setForm((p: any) => ({ ...p, bonus_valor: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.cliente_indicador_id || !form.nome_indicado || saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
