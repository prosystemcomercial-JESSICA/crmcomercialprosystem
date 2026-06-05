'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Parceiro {
  id: string;
  nome: string;
  categoria: string;
  pitch?: string;
  comissao_valor: number;
  tabela_valores?: string;
  ativo: boolean;
}

interface VendaAdicional {
  id: string;
  cliente_id: string;
  parceiro_id: string;
  vendedor_id: string;
  vendedor_nome?: string;
  valor_venda?: number;
  plano_anterior?: string;
  plano_novo?: string;
  comissao_valor: number;
  comissao_paga: boolean;
  comissao_paga_em?: string;
  status: string;
  observacoes?: string;
  created_at: string;
  cliente: { id: string; nome: string; empresa?: string; telefone?: string };
  parceiro: { id: string; nome: string; categoria: string; comissao_valor: number };
}

const CATEGORIA_LABEL: Record<string, string> = {
  FISCAL: 'Fiscal',
  TEF: 'TEF',
  TRIBUTARIO: 'Tributário',
  COMUNICACAO: 'Comunicação',
  UPGRADE: 'Upgrade',
  OUTRO: 'Outro',
};

const CATEGORIA_COLOR: Record<string, string> = {
  FISCAL: 'bg-blue-100 text-blue-700',
  TEF: 'bg-purple-100 text-purple-700',
  TRIBUTARIO: 'bg-amber-100 text-amber-700',
  COMUNICACAO: 'bg-teal-100 text-teal-700',
  UPGRADE: 'bg-green-100 text-green-700',
  OUTRO: 'bg-gray-100 text-gray-600',
};

// Status flow: PENDENTE → CONFIRMADA → PAGA | CANCELADO
const STATUS_COLOR: Record<string, string> = {
  PENDENTE:    'bg-yellow-100 text-yellow-700',
  CONFIRMADA:  'bg-blue-100 text-blue-700',
  PAGA:        'bg-green-100 text-green-700',
  CANCELADO:   'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  PENDENTE:    'Pendente',
  CONFIRMADA:  'Confirmada — A Pagar',
  PAGA:        'Comissão Paga',
  CANCELADO:   'Cancelado',
};

const ROLES_GESTOR = ['CEO', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'ADMIN', 'DIRETOR'];

const PLANOS = ['Basic', 'Pro', 'Plus'];

const MOCK_VENDEDORES = [
  { id: 'jessica', nome: 'Jessica (CEO)' },
  { id: 'vendedor1', nome: 'Vendedor 1' },
  { id: 'vendedor2', nome: 'Vendedor 2' },
];

export default function IndicacoesPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<'vendas' | 'parceiros'>('vendas');
  const [vendas, setVendas] = useState<VendaAdicional[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [clientes, setClientes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);

  // Modal venda
  const [showVendaModal, setShowVendaModal] = useState(false);
  const [vendaForm, setVendaForm] = useState<any>({
    cliente_id: '', parceiro_id: '', vendedor_id: '', valor_venda: '',
    plano_anterior: '', plano_novo: '', observacoes: '',
  });
  const [savingVenda, setSavingVenda] = useState(false);

  // Modal parceiro
  const [showParceiroModal, setShowParceiroModal] = useState(false);
  const [parceiroForm, setParceiroForm] = useState<any>({
    nome: '', categoria: 'OUTRO', pitch: '', comissao_valor: '50', tabela_valores: '',
  });
  const [savingParceiro, setSavingParceiro] = useState(false);
  const [editingParceiro, setEditingParceiro] = useState<Parceiro | null>(null);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadVendas = useCallback(async () => {
    setDataLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const res = await apiClient.getVendasAdicionais(params);
      setVendas(res.data.data.vendas);
      setStats(res.data.data.stats);
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  }, [statusFilter]);

  const loadParceiros = useCallback(async () => {
    try {
      const res = await apiClient.getParceiros();
      setParceiros(res.data.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadVendas();
    loadParceiros();
  }, [isAuthenticated, loadVendas, loadParceiros]);

  const openNovaVenda = async () => {
    try {
      const [cls, vends] = await Promise.all([
        apiClient.getClientes(),
        // Vendedores reais cadastrados no CRM (ATIVOS) para a supervisão escolher.
        apiClient.getVendedores().catch(() => ({ data: { data: [] } })),
      ]);
      setClientes(cls.data.data.clientes || []);
      const vendList = vends.data.data || [];
      setUsuarios(vendList.length ? vendList : MOCK_VENDEDORES);
    } catch { setClientes([]); setUsuarios(MOCK_VENDEDORES); }
    setVendaForm({ cliente_id: '', parceiro_id: '', vendedor_id: user?.id || '', valor_venda: '', plano_anterior: '', plano_novo: '', observacoes: '' });
    setShowVendaModal(true);
  };

  const handleCreateVenda = async () => {
    setSavingVenda(true);
    try {
      const payload: any = {
        cliente_id: vendaForm.cliente_id,
        parceiro_id: vendaForm.parceiro_id,
        vendedor_id: vendaForm.vendedor_id,
        observacoes: vendaForm.observacoes || undefined,
      };
      if (vendaForm.valor_venda) payload.valor_venda = parseFloat(vendaForm.valor_venda);
      if (vendaForm.plano_anterior) payload.plano_anterior = vendaForm.plano_anterior;
      if (vendaForm.plano_novo) payload.plano_novo = vendaForm.plano_novo;

      await apiClient.createVendaAdicional(payload);
      setShowVendaModal(false);
      loadVendas();
    } catch (e) { console.error(e); }
    finally { setSavingVenda(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await apiClient.updateVendaAdicional(id, { status });
    loadVendas();
  };

  const handlePagarComissao = async (id: string) => {
    await apiClient.updateVendaAdicional(id, { comissao_paga: true, status: 'PAGA' });
    loadVendas();
  };

  const openNovoParceiro = () => {
    setEditingParceiro(null);
    setParceiroForm({ nome: '', categoria: 'OUTRO', pitch: '', comissao_valor: '50', tabela_valores: '' });
    setShowParceiroModal(true);
  };

  const openEditParceiro = (p: Parceiro) => {
    setEditingParceiro(p);
    setParceiroForm({ nome: p.nome, categoria: p.categoria, pitch: p.pitch || '', comissao_valor: String(p.comissao_valor), tabela_valores: p.tabela_valores || '' });
    setShowParceiroModal(true);
  };

  const handleSaveParceiro = async () => {
    setSavingParceiro(true);
    try {
      const payload = { ...parceiroForm, comissao_valor: parseFloat(parceiroForm.comissao_valor) };
      if (editingParceiro) {
        await apiClient.updateParceiro(editingParceiro.id, payload);
      } else {
        await apiClient.createParceiro(payload);
      }
      setShowParceiroModal(false);
      loadParceiros();
    } catch (e) { console.error(e); }
    finally { setSavingParceiro(false); }
  };

  const handleDesativarParceiro = async (id: string) => {
    if (!confirm('Desativar este parceiro?')) return;
    await apiClient.deleteParceiro(id);
    loadParceiros();
  };

  const parceiroSelecionado = parceiros.find(p => p.id === vendaForm.parceiro_id);
  const isGestor = ROLES_GESTOR.includes((user as any)?.role || '');

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendas Adicionais</h1>
            <p className="text-gray-500 mt-1">Cross-sell para clientes da base — parceiros e comissões do vendedor</p>
          </div>
          {isGestor && (
            <button onClick={openNovaVenda} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              + Registrar Venda
            </button>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <p className="text-xs text-gray-500 uppercase font-semibold">Total</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
              <p className="text-xs text-gray-500 uppercase font-semibold">Pendentes</p>
              <p className="text-3xl font-bold text-yellow-700 mt-1">{stats.pendentes}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <p className="text-xs text-gray-500 uppercase font-semibold">Confirmadas</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{stats.confirmadas}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <p className="text-xs text-gray-500 uppercase font-semibold">Pagas</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{stats.pagas}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
              <p className="text-xs text-gray-500 uppercase font-semibold">Comissões Vendedor</p>
              <p className="text-xl font-bold text-orange-700 mt-1">R$ {(stats.comissoes_a_pagar || 0).toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-400 mt-0.5">a pagar</p>
            </div>
            <div className="bg-teal-50 rounded-xl p-4 border border-teal-200">
              <p className="text-xs text-gray-500 uppercase font-semibold">Comissões Supervisão</p>
              <p className="text-xl font-bold text-teal-700 mt-1">R$ {(stats.supervisao_a_pagar || 0).toLocaleString('pt-BR')}</p>
              <p className="text-xs text-gray-400 mt-0.5">a pagar</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {([['vendas', 'Vendas'], ['parceiros', 'Parceiros & Produtos']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Vendas */}
        {tab === 'vendas' && (
          <>
            <div className="flex gap-2">
              {(['', 'PENDENTE', 'CONFIRMADA', 'PAGA', 'CANCELADO'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {s === '' ? 'Todas' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {dataLoading ? (
                <div className="p-8 text-center text-gray-500">Carregando...</div>
              ) : vendas.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">💰</div>
                  <p className="text-gray-500 font-medium">Nenhuma venda adicional registrada</p>
                  <p className="text-sm text-gray-400 mt-1">Registre vendas de Pacote Fiscal, TEF, Avant/Imendes, Upgrade e mais</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produto / Parceiro</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vendedor</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Comissão</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vendas.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900">{v.cliente.nome}</p>
                          {v.cliente.empresa && <p className="text-xs text-gray-400">{v.cliente.empresa}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORIA_COLOR[v.parceiro.categoria] || 'bg-gray-100 text-gray-600'}`}>
                              {CATEGORIA_LABEL[v.parceiro.categoria] || v.parceiro.categoria}
                            </span>
                            <span className="text-sm text-gray-700">{v.parceiro.nome}</span>
                          </div>
                          {v.plano_anterior && v.plano_novo && (
                            <p className="text-xs text-gray-400 mt-0.5">{v.plano_anterior} → {v.plano_novo}</p>
                          )}
                          {v.valor_venda && (
                            <p className="text-xs text-gray-400 mt-0.5">R$ {v.valor_venda.toLocaleString('pt-BR')}/mês</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-gray-700">
                            {(v as any).vendedor_nome || usuarios.find((u: any) => u.id === v.vendedor_id)?.nome || v.vendedor_id}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Vendedor</p>
                            <p className="text-sm font-semibold text-gray-800">R$ {v.comissao_valor.toLocaleString('pt-BR')}</p>
                          </div>
                          {(v as any).comissao_supervisao_valor > 0 && (
                            <div className="mt-1">
                              <p className="text-xs text-gray-400 mb-0.5">Supervisão</p>
                              <p className="text-sm font-medium text-teal-700">R$ {(v as any).comissao_supervisao_valor.toLocaleString('pt-BR')}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLOR[v.status] || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABEL[v.status] || v.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {isGestor && v.status === 'PENDENTE' && (
                            <button onClick={() => handleUpdateStatus(v.id, 'CONFIRMADA')}
                              className="text-xs text-blue-600 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50 font-medium transition-colors">
                              Confirmar
                            </button>
                          )}
                          {isGestor && v.status === 'CONFIRMADA' && (
                            <button onClick={() => handlePagarComissao(v.id)}
                              className="text-xs text-green-600 border border-green-200 rounded-lg px-2 py-1 hover:bg-green-50 font-medium transition-colors">
                              Marcar paga
                            </button>
                          )}
                          {isGestor && v.status !== 'PAGA' && v.status !== 'CANCELADO' && (
                            <button onClick={() => handleUpdateStatus(v.id, 'CANCELADO')}
                              className="ml-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Tab: Parceiros */}
        {tab === 'parceiros' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={openNovoParceiro}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                + Novo Parceiro
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {parceiros.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORIA_COLOR[p.categoria] || 'bg-gray-100 text-gray-600'}`}>
                        {CATEGORIA_LABEL[p.categoria] || p.categoria}
                      </span>
                      <h3 className="font-semibold text-gray-900 mt-1.5">{p.nome}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-700">R$ {p.comissao_valor.toLocaleString('pt-BR')}</p>
                      <p className="text-xs text-gray-400">comissão/venda</p>
                    </div>
                  </div>

                  {p.pitch && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Abordagem</p>
                      <p className="text-sm text-gray-700 italic">"{p.pitch}"</p>
                    </div>
                  )}

                  {p.tabela_valores && (
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Valor para o cliente:</span> {p.tabela_valores}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => openEditParceiro(p)}
                      className="flex-1 text-xs text-blue-600 border border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 transition-colors">
                      Editar
                    </button>
                    <button onClick={() => handleDesativarParceiro(p.id)}
                      className="flex-1 text-xs text-red-500 border border-red-200 rounded-lg py-1.5 hover:bg-red-50 transition-colors">
                      Desativar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Nova Venda */}
      {showVendaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Registrar Venda Adicional</h2>
              <button onClick={() => setShowVendaModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Cliente da base *</label>
                <select value={vendaForm.cliente_id} onChange={e => setVendaForm((p: any) => ({ ...p, cliente_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecione...</option>
                  {clientes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nome}{c.empresa ? ` — ${c.empresa}` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Produto / Parceiro *</label>
                <select value={vendaForm.parceiro_id} onChange={e => setVendaForm((p: any) => ({ ...p, parceiro_id: e.target.value, plano_anterior: '', plano_novo: '' }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecione...</option>
                  {parceiros.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
                {parceiroSelecionado?.pitch && (
                  <p className="mt-1.5 text-xs text-blue-600 bg-blue-50 rounded p-2 italic">"{parceiroSelecionado.pitch}"</p>
                )}
                {parceiroSelecionado && (
                  <p className="mt-1 text-xs text-gray-500">
                    Comissão: <span className="font-semibold text-green-700">R$ {parceiroSelecionado.comissao_valor.toLocaleString('pt-BR')}</span>
                    {parceiroSelecionado.tabela_valores && ` · ${parceiroSelecionado.tabela_valores}`}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Vendedor *</label>
                {isGestor ? (
                  // Supervisão/CEO: pode indicar qual vendedor fez a venda.
                  <select value={vendaForm.vendedor_id} onChange={e => setVendaForm((p: any) => ({ ...p, vendedor_id: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione o vendedor...</option>
                    {usuarios.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                ) : (
                  // Vendedor logado: registra para si mesmo (nome fixo).
                  <input
                    value={(user as any)?.nome || 'Você'}
                    disabled
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"
                  />
                )}
              </div>

              {parceiroSelecionado?.categoria === 'UPGRADE' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Plano atual</label>
                    <select value={vendaForm.plano_anterior} onChange={e => setVendaForm((p: any) => ({ ...p, plano_anterior: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Selecione...</option>
                      {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Novo plano</label>
                    <select value={vendaForm.plano_novo} onChange={e => setVendaForm((p: any) => ({ ...p, plano_novo: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Selecione...</option>
                      {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-gray-700">Valor para o cliente (R$/mês)</label>
                  <input type="number" value={vendaForm.valor_venda} onChange={e => setVendaForm((p: any) => ({ ...p, valor_venda: e.target.value }))}
                    placeholder="Opcional"
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Observações</label>
                <textarea value={vendaForm.observacoes} onChange={e => setVendaForm((p: any) => ({ ...p, observacoes: e.target.value }))}
                  rows={2} placeholder="Detalhes da conversa, próximos passos..."
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowVendaModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleCreateVenda}
                disabled={!vendaForm.cliente_id || !vendaForm.parceiro_id || !vendaForm.vendedor_id || savingVenda}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingVenda ? 'Registrando...' : 'Registrar Venda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Parceiro */}
      {showParceiroModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingParceiro ? 'Editar Parceiro' : 'Novo Parceiro'}</h2>
              <button onClick={() => setShowParceiroModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Nome *</label>
                <input value={parceiroForm.nome} onChange={e => setParceiroForm((p: any) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: BM Fiscal, Stone TEF..."
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Categoria *</label>
                <select value={parceiroForm.categoria} onChange={e => setParceiroForm((p: any) => ({ ...p, categoria: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Object.entries(CATEGORIA_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Abordagem de venda</label>
                <textarea value={parceiroForm.pitch} onChange={e => setParceiroForm((p: any) => ({ ...p, pitch: e.target.value }))}
                  rows={3} placeholder="Como apresentar para o cliente..."
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Comissão do vendedor (R$)</label>
                  <input type="number" value={parceiroForm.comissao_valor} onChange={e => setParceiroForm((p: any) => ({ ...p, comissao_valor: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Valor para o cliente</label>
                  <input value={parceiroForm.tabela_valores} onChange={e => setParceiroForm((p: any) => ({ ...p, tabela_valores: e.target.value }))}
                    placeholder="Ex: R$ 100/mês"
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowParceiroModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSaveParceiro}
                disabled={!parceiroForm.nome || savingParceiro}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingParceiro ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
