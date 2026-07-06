'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Licenca {
  id: string;
  status: string;
  valor: number;
  data_inicio: string;
  data_fim?: string;
  cliente: { id: string; nome: string; empresa?: string; email: string };
  plano?: { id: string; nome: string; segmento: string };
  _count?: { tickets: number; renovacoes: number };
}

const STATUS_COLOR: Record<string, string> = {
  ATIVA: 'bg-green-100 text-green-700',
  SUSPENSA: 'bg-yellow-100 text-yellow-700',
  EXPIRADA: 'bg-red-100 text-red-700',
  CANCELADA: 'bg-opacity-0 ',
};

export default function LicencasPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [licencas, setLicencas] = useState<Licenca[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [planos, setPlanos] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ cliente_id: '', plano_id: '', valor: '', data_inicio: new Date().toISOString().split('T')[0], data_fim: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadData = () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    apiClient.getLicencas(params)
      .then(res => {
        setLicencas(res.data.data.licencas);
        setTotal(res.data.data.total);
        setStats(res.data.data.stats);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadData(); }, [isAuthenticated, statusFilter]);

  const openCreate = async () => {
    const [cls, pls] = await Promise.all([apiClient.getClientes(), apiClient.getPlanos()]);
    setClientes(cls.data.data.clientes || []);
    setPlanos(pls.data.data || []);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, valor: parseFloat(form.valor) };
      if (!payload.plano_id) delete payload.plano_id;
      if (!payload.data_fim) delete payload.data_fim;
      await apiClient.createLicenca(payload);
      setShowModal(false);
      loadData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await apiClient.updateLicenca(id, { status });
    loadData();
  };

  const diasParaVencer = (d?: string) => {
    if (!d) return null;
    return Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-sm font-semibold">Licenças</h1>
            <p className="text-gray-500 mt-1">Controle de licenças ativas por cliente</p>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            + Nova Licença
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <p className="text-sm ">Ativas</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{stats.ativas}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <p className="text-sm ">Vencendo em 30 dias</p>
              <p className="text-3xl font-bold text-orange-700 mt-1">{stats.expirando}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <p className="text-sm ">Expiradas</p>
              <p className="text-3xl font-bold text-red-700 mt-1">{stats.expiradas}</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2">
          {['', 'ATIVA', 'SUSPENSA', 'EXPIRADA', 'CANCELADA'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200  hover:bg-opacity-0'}`}>
              {s === '' ? 'Todas' : s}
            </button>
          ))}
        </div>

        {/* Tabela */}
        <div className="ps-card rounded-xl border border-gray-200 overflow-hidden">
          {dataLoading ? (
            <div className="p-8 text-center ">Carregando...</div>
          ) : licencas.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🔑</div>
              <p className="text-gray-500">Nenhuma licença encontrada</p>
              <button onClick={openCreate} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Nova licença</button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-opacity-0 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold  uppercase">Cliente</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold  uppercase">Plano</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold  uppercase">Valor</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold  uppercase">Validade</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold  uppercase">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold  uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {licencas.map(lic => {
                  const dias = diasParaVencer(lic.data_fim);
                  const vencendo = lic.status === 'ATIVA' && dias !== null && dias <= 30 && dias > 0;
                  return (
                    <tr key={lic.id} className={`hover:bg-opacity-0 transition-colors ${vencendo ? 'bg-orange-50' : ''}`}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-sm font-semibold">{lic.cliente.nome}</p>
                        {lic.cliente.empresa && <p className="text-xs ">{lic.cliente.empresa}</p>}
                      </td>
                      <td className="px-5 py-4">
                        {lic.plano ? (
                          <div>
                            <p className="text-sm text-sm font-semibold">{lic.plano.nome}</p>
                            <p className="text-xs ">{lic.plano.segmento}</p>
                          </div>
                        ) : <span className="text-gray-400 text-sm">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-sm font-semibold">R$ {lic.valor.toLocaleString('pt-BR')}</p>
                      </td>
                      <td className="px-5 py-4">
                        {lic.data_fim ? (
                          <div>
                            <p className="text-sm ">{new Date(lic.data_fim).toLocaleDateString('pt-BR')}</p>
                            {vencendo && <p className="text-xs text-orange-600 font-medium">⚠ {dias} dias restantes</p>}
                            {dias !== null && dias <= 0 && <p className="text-xs text-red-600 font-medium">Vencida</p>}
                          </div>
                        ) : <span className="text-xs ">Sem vencimento</span>}
                      </td>
                      <td className="px-5 py-4">
                        <select value={lic.status} onChange={e => handleUpdateStatus(lic.id, e.target.value)}
                          className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer border-0 focus:ring-1 ${STATUS_COLOR[lic.status]}`}>
                          {['ATIVA', 'SUSPENSA', 'EXPIRADA', 'CANCELADA'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-4 text-right text-sm ">
                        {lic._count?.tickets || 0} tickets
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="ps-card rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nova Licença</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium ">Cliente *</label>
                <select value={form.cliente_id} onChange={e => setForm((p: any) => ({ ...p, cliente_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecione...</option>
                  {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` — ${c.empresa}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium ">Plano</label>
                <select value={form.plano_id} onChange={e => setForm((p: any) => ({ ...p, plano_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Sem plano</option>
                  {planos.map((p: any) => <option key={p.id} value={p.id}>{p.nome} — R$ {p.preco}/{p.recorrencia.toLowerCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium ">Valor (R$) *</label>
                <input type="number" value={form.valor} onChange={e => setForm((p: any) => ({ ...p, valor: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium ">Início</label>
                  <input type="date" value={form.data_inicio} onChange={e => setForm((p: any) => ({ ...p, data_inicio: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium ">Vencimento</label>
                  <input type="date" value={form.data_fim} onChange={e => setForm((p: any) => ({ ...p, data_fim: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm  hover:opacity-80">Cancelar</button>
              <button onClick={handleSave} disabled={!form.cliente_id || !form.valor || saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Criar Licença'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
