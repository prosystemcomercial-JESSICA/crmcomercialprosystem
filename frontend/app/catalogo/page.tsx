'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Plano {
  id: string;
  nome: string;
  descricao?: string;
  segmento: string;
  preco: number;
  recorrencia: string;
  ativo: boolean;
  features: string[];
  _count?: { licencas: number };
}

const SEGMENTO_COLOR: Record<string, string> = {
  FARMACIA: 'bg-green-50 text-green-700 border-green-200',
  PADARIA: 'bg-orange-50 text-orange-700 border-orange-200',
  VAREJO: 'bg-blue-50 text-blue-700 border-blue-200',
  GERAL: 'bg-opacity-0  border-gray-200',
};

const SEGMENTO_ICON: Record<string, string> = {
  FARMACIA: '💊', PADARIA: '🥐', VAREJO: '🛒', GERAL: '📦',
};

const PLANOS_SEED = [
  { nome: 'ProSystem Farmácias Basic', segmento: 'FARMACIA', preco: 299, recorrencia: 'MENSAL', features: ['PDV Farmácia', 'Controle de Lotes', 'NF-e / NFC-e', 'Relatórios básicos'], descricao: 'Ideal para farmácias de pequeno porte' },
  { nome: 'ProSystem Farmácias Pro', segmento: 'FARMACIA', preco: 499, recorrencia: 'MENSAL', features: ['Tudo do Basic', 'PBM Integrado', 'Manipulados', 'Multi-caixa', 'Suporte prioritário'], descricao: 'Para drogarias e redes' },
  { nome: 'ProSystem Padarias', segmento: 'PADARIA', preco: 349, recorrencia: 'MENSAL', features: ['PDV Padaria', 'Produção e Receitas', 'Controle de Estoque', 'Multi-unidade'], descricao: 'Gestão completa de padarias e confeitarias' },
  { nome: 'ProSystem Varejo', segmento: 'VAREJO', preco: 249, recorrencia: 'MENSAL', features: ['PDV Varejo', 'Estoque', 'NF-e', 'Financeiro básico'], descricao: 'Para lojas de varejo geral' },
];

export default function CatalogoPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ nome: '', descricao: '', segmento: 'GERAL', preco: '', recorrencia: 'MENSAL', features: '' });
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadData = () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    apiClient.getPlanos()
      .then(res => setPlanos(res.data.data))
      .catch(console.error)
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadData(); }, [isAuthenticated]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        preco: parseFloat(form.preco),
        features: form.features ? form.features.split('\n').map((f: string) => f.trim()).filter(Boolean) : []
      };
      if (editingId) await apiClient.updatePlanoServico(editingId, payload);
      else await apiClient.createPlanoServico(payload);
      setShowModal(false);
      loadData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const openCreate = () => {
    setForm({ nome: '', descricao: '', segmento: 'GERAL', preco: '', recorrencia: 'MENSAL', features: '' });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (p: Plano) => {
    setForm({ nome: p.nome, descricao: p.descricao || '', segmento: p.segmento, preco: p.preco.toString(), recorrencia: p.recorrencia, features: p.features.join('\n') });
    setEditingId(p.id);
    setShowModal(true);
  };

  const handleToggleAtivo = async (p: Plano) => {
    await apiClient.updatePlanoServico(p.id, { ativo: !p.ativo });
    loadData();
  };

  const handleSeedPlanos = async () => {
    setSeeding(true);
    for (const plano of PLANOS_SEED) {
      try { await apiClient.createPlanoServico(plano); } catch (e) { /* ignore duplicates */ }
    }
    setSeeding(false);
    loadData();
  };

  const isCEO = user?.role === 'CEO' || user?.role === 'SUPERVISAO';

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-sm font-semibold">Catálogo de Serviços</h1>
            <p className="text-gray-500 mt-1">Planos e soluções ProSystem disponíveis para venda</p>
          </div>
          <div className="flex gap-2">
            {planos.length === 0 && isCEO && (
              <button onClick={handleSeedPlanos} disabled={seeding}
                className="px-4 py-2 border border-blue-300 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50 transition-colors">
                {seeding ? 'Criando...' : '✨ Criar planos ProSystem'}
              </button>
            )}
            {isCEO && (
              <button onClick={openCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                + Novo Plano
              </button>
            )}
          </div>
        </div>

        {dataLoading ? (
          <div className="text-center p-12 ">Carregando catálogo...</div>
        ) : planos.length === 0 ? (
          <div className="ps-card rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-700 font-medium text-lg">Catálogo vazio</p>
            <p className="text-gray-400 text-sm mt-1">Adicione planos ou use o botão "Criar planos ProSystem" para popular com os planos padrão</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {planos.map(plano => (
              <div key={plano.id} className={`bg-white rounded-xl border-2 ${plano.ativo ? 'border-gray-200' : 'border-gray-100 opacity-60'} p-5 flex flex-col`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium mb-2 ${SEGMENTO_COLOR[plano.segmento]}`}>
                      {SEGMENTO_ICON[plano.segmento]} {plano.segmento}
                    </span>
                    <h3 className="font-bold text-sm font-semibold">{plano.nome}</h3>
                    {plano.descricao && <p className="text-xs  mt-0.5">{plano.descricao}</p>}
                  </div>
                  {!plano.ativo && <span className="text-xs bg-opacity-0  px-2 py-0.5 rounded-full">Inativo</span>}
                </div>

                <div className="mb-4">
                  <p className="text-2xl font-bold text-blue-700">
                    R$ {plano.preco.toLocaleString('pt-BR')}
                    <span className="text-sm font-normal ">/{plano.recorrencia.toLowerCase()}</span>
                  </p>
                </div>

                {plano.features.length > 0 && (
                  <ul className="space-y-1.5 flex-1 mb-4">
                    {plano.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm ">
                        <span className="text-green-500 text-xs flex-shrink-0">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                  <p className="text-xs ">{plano._count?.licencas || 0} licenças ativas</p>
                  {isCEO && (
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(plano)} className="text-xs text-blue-600 hover:underline">Editar</button>
                      <button onClick={() => handleToggleAtivo(plano)} className="text-xs  hover:underline">
                        {plano.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="ps-card rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? 'Editar Plano' : 'Novo Plano'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium ">Nome *</label>
                <input value={form.nome} onChange={e => setForm((p: any) => ({ ...p, nome: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium ">Segmento</label>
                  <select value={form.segmento} onChange={e => setForm((p: any) => ({ ...p, segmento: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['FARMACIA', 'PADARIA', 'VAREJO', 'GERAL'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium ">Recorrência</label>
                  <select value={form.recorrencia} onChange={e => setForm((p: any) => ({ ...p, recorrencia: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['MENSAL', 'ANUAL', 'UNICO'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium ">Preço (R$)</label>
                <input type="number" value={form.preco} onChange={e => setForm((p: any) => ({ ...p, preco: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium ">Descrição</label>
                <input value={form.descricao} onChange={e => setForm((p: any) => ({ ...p, descricao: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium ">Features (1 por linha)</label>
                <textarea value={form.features} onChange={e => setForm((p: any) => ({ ...p, features: e.target.value }))}
                  rows={4} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm  hover:opacity-80">Cancelar</button>
              <button onClick={handleSave} disabled={!form.nome || saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
