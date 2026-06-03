'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';

interface Comissao {
  id: string;
  responsavel_id: string;
  tipo: string;
  descricao?: string;
  valor_base: number;
  percentual: number;
  valor_comissao: number;
  periodo: string;
  status: string;
  regra?: { nome: string };
}

const STATUS_COLOR: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  APROVADA: 'bg-blue-100 text-blue-700',
  PAGA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-gray-100 text-gray-500',
};

const TIPO_LABEL: Record<string, { label: string; color: string }> = {
  CONTRATO:                    { label: 'Contrato',          color: 'bg-blue-100 text-blue-700' },
  PROPOSTA:                    { label: 'Proposta',           color: 'bg-purple-100 text-purple-700' },
  LEAD:                        { label: 'Lead',               color: 'bg-indigo-100 text-indigo-700' },
  MANUAL:                      { label: 'Manual',             color: 'bg-gray-100 text-gray-600' },
  BONUS:                       { label: 'Bônus',              color: 'bg-pink-100 text-pink-700' },
  VENDA_ADICIONAL:             { label: 'Venda Adicional',    color: 'bg-green-100 text-green-700' },
  SUPERVISAO_VENDA_ADICIONAL:  { label: 'Supervisão',         color: 'bg-teal-100 text-teal-700' },
};

const ROLES_GESTOR = ['CEO', 'SUPERVISAO', 'SUPERVISAO_COMERCIAL', 'ADMIN', 'DIRETOR'];

const USUARIOS_NAMES: Record<string, string> = {
  'user-ceo': 'CEO',
  'user-supervisao': 'Supervisão',
  'vendedor-1': 'Vendedor 1',
  'vendedor-2': 'Vendedor 2',
};

function periodoAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ComissoesPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [totais, setTotais] = useState<any>(null);
  const [resumo, setResumo] = useState<any[]>([]);
  const [supervisao, setSupervisao] = useState<any>(null); // comissão 0,5% do setor
  const [periodo, setPeriodo] = useState(periodoAtual());
  const [dataLoading, setDataLoading] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({ responsavel_id: '', tipo: 'MANUAL', descricao: '', valor_base: '', percentual: '', periodo: periodoAtual() });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadData = () => {
    if (!isAuthenticated || !user) return;
    setDataLoading(true);
    // Vendedor vê apenas as próprias comissões; gestor vê todas
    const params: any = { periodo };
    if (!ROLES_GESTOR.includes(user.role || '')) {
      params.responsavel_id = user.id;
    }
    apiClient.getComissoes(params)
      .then(res => {
        setComissoes(res.data.data.comissoes);
        setTotais(res.data.data.totais);
        setResumo(res.data.data.resumo);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));

    // Comissão da Supervisão Comercial (0,5% do faturamento do setor no período).
    apiClient.getComissaoSupervisao(periodo)
      .then(res => setSupervisao(res.data.data))
      .catch(() => setSupervisao(null));
  };

  useEffect(() => { loadData(); }, [isAuthenticated, periodo]);

  const handleCalcular = async () => {
    setCalculando(true);
    try {
      await apiClient.calcularComissoes(periodo);
      loadData();
    } catch (e) { console.error(e); }
    finally { setCalculando(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await apiClient.updateComissao(id, { status });
    loadData();
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await apiClient.createComissao({
        ...form,
        valor_base: parseFloat(form.valor_base),
        percentual: parseFloat(form.percentual)
      });
      setShowModal(false);
      loadData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const nomeVendedor = (id: string) => USUARIOS_NAMES[id] || id;
  const isGestor = ROLES_GESTOR.includes(user?.role || '');
  const isCEO = isGestor; // mantém compatibilidade

  const periods = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Comissões</h1>
            <p className="text-gray-500 mt-1">
              {isGestor ? 'Extrato completo de comissões por vendedor e período' : 'Suas comissões do período'}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <ExportButton
              nome="comissoes" titulo={`Comissões — ${periodo}`}
              linhas={comissoes}
              colunas={[
                { header: 'Vendedor', value: (c: Comissao) => nomeVendedor(c.responsavel_id) },
                { header: 'Tipo', value: (c: Comissao) => c.tipo },
                { header: 'Descrição', value: (c: Comissao) => c.descricao || c.regra?.nome || '' },
                { header: 'Base (R$)', value: (c: Comissao) => c.valor_base },
                { header: 'Percentual (%)', value: (c: Comissao) => c.percentual },
                { header: 'Comissão (R$)', value: (c: Comissao) => c.valor_comissao },
                { header: 'Status', value: (c: Comissao) => c.status },
                { header: 'Período', value: (c: Comissao) => c.periodo },
              ]}
            />
            {isCEO && (
              <>
                <button onClick={handleCalcular} disabled={calculando}
                  className="px-4 py-2 border border-blue-300 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50 transition-colors">
                  {calculando ? 'Calculando...' : '⚡ Calcular mês'}
                </button>
                <button onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  + Manual
                </button>
              </>
            )}
          </div>
        </div>

        {/* Período */}
        <div className="flex gap-2 flex-wrap">
          {periods.map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${periodo === p ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
        </div>

        {/* Totais */}
        {totais && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-sm text-gray-500">Total calculado</p>
              <p className="text-2xl font-bold text-gray-700 mt-1">R$ {totais.total.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
              <p className="text-sm text-gray-500">A pagar</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">R$ {totais.pendente.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <p className="text-sm text-gray-500">Pago</p>
              <p className="text-2xl font-bold text-green-700 mt-1">R$ {totais.pago.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        )}

        {/* Comissão da Supervisão Comercial — 0,5% do faturamento do setor */}
        {supervisao && (isGestor || (user?.role || '').toUpperCase() === 'SUPERVISAO_COMERCIAL') && (
          <div className="bg-white rounded-xl border-2 p-5" style={{ borderColor: '#c7d8ec' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Supervisão Comercial — Override 0,5%</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  0,5% sobre o faturamento do setor (setup dos contratos assinados + vendas adicionais) no período {supervisao.periodo}.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Comissão por supervisor</p>
                <p className="text-2xl font-bold" style={{ color: '#2E6EAB' }}>
                  R$ {Number(supervisao.comissao_por_supervisor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Faturamento do setor</p>
                <p className="text-lg font-bold text-gray-700">R$ {Number(supervisao.faturamento_setor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Setup (contratos assinados)</p>
                <p className="text-lg font-bold text-gray-700">R$ {Number(supervisao.faturamento_contratos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-gray-400">{supervisao.qtd_contratos} contrato(s)</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Vendas adicionais</p>
                <p className="text-lg font-bold text-gray-700">R$ {Number(supervisao.faturamento_vendas_adicionais || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-gray-400">{supervisao.qtd_vendas_adicionais} venda(s)</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-xs text-gray-500">Supervisores</p>
                <p className="text-sm font-semibold text-blue-700">
                  {supervisao.supervisores?.length
                    ? supervisao.supervisores.map((s: any) => s.nome).join(', ')
                    : 'Nenhum ativo'}
                </p>
                <p className="text-[10px] text-gray-400">cada um recebe 0,5% cheios</p>
              </div>
            </div>
          </div>
        )}

        {/* Resumo por vendedor — apenas gestores */}
        {isGestor && resumo.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Por Vendedor / Responsável</h2>
            <div className="space-y-2">
              {resumo.map((r: any) => (
                <div key={r.responsavel_id} className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm flex-shrink-0">
                    {nomeVendedor(r.responsavel_id).charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{nomeVendedor(r.responsavel_id)}</p>
                    <p className="text-xs text-gray-500">{r.count} registros</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">R$ {r.total.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-yellow-600">R$ {r.pendente.toLocaleString('pt-BR')} pendente</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {dataLoading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : comissoes.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">💰</div>
              <p className="text-gray-500">Nenhuma comissão em {periodo}</p>
              {isCEO && <p className="text-sm text-gray-400 mt-1">Clique em "Calcular mês" para gerar automaticamente pelos contratos</p>}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vendedor</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Base</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">%</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Comissão</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comissoes.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">{nomeVendedor(c.responsavel_id)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${(TIPO_LABEL[c.tipo] || TIPO_LABEL.MANUAL).color}`}>
                          {(TIPO_LABEL[c.tipo] || TIPO_LABEL.MANUAL).label}
                        </span>
                        <span className="text-sm text-gray-600">{c.descricao || c.tipo}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-gray-600">R$ {c.valor_base.toLocaleString('pt-BR')}</td>
                    <td className="px-5 py-4 text-right text-sm text-gray-600">{c.percentual}%</td>
                    <td className="px-5 py-4 text-right text-sm font-bold text-green-700">R$ {c.valor_comissao.toLocaleString('pt-BR')}</td>
                    <td className="px-5 py-4">
                      {isCEO ? (
                        <select value={c.status} onChange={e => handleUpdateStatus(c.id, e.target.value)}
                          className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer border-0 ${STATUS_COLOR[c.status]}`}>
                          {['PENDENTE', 'APROVADA', 'PAGA', 'CANCELADA'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLOR[c.status]}`}>{c.status}</span>
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
              <h2 className="text-lg font-semibold">Lançar Comissão Manual</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">ID do Vendedor *</label>
                <input value={form.responsavel_id} onChange={e => setForm((p: any) => ({ ...p, responsavel_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: vendedor-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Descrição</label>
                <input value={form.descricao} onChange={e => setForm((p: any) => ({ ...p, descricao: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Bônus trimestral" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Valor base (R$)</label>
                  <input type="number" value={form.valor_base} onChange={e => setForm((p: any) => ({ ...p, valor_base: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Percentual (%)</label>
                  <input type="number" value={form.percentual} onChange={e => setForm((p: any) => ({ ...p, percentual: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.responsavel_id || !form.valor_base || saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Lançar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
