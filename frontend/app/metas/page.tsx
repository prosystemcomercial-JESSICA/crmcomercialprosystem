'use client';

import { useEffect, useState } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Meta {
  id: string;
  titulo: string;
  responsavel_id: string;
  tipo: string;
  valor_alvo: number;
  valor_atual: number;
  periodo: string;
  status: string;
}

const TIPO_ICON: Record<string, string> = {
  RECEITA: '💰', LEADS: '🎯', PROPOSTAS: '📄', CONTRATOS: '📝', ATIVIDADES: '📞'
};

const TIPO_UNIT: Record<string, string> = {
  RECEITA: 'R$', LEADS: 'leads', PROPOSTAS: 'propostas', CONTRATOS: 'contratos', ATIVIDADES: 'atividades'
};

const USUARIOS_MOCK = [
  { id: 'user-ceo', nome: 'CEO' },
  { id: 'user-supervisao', nome: 'Supervisão' },
  { id: 'vendedor-1', nome: 'Vendedor 1' },
  { id: 'vendedor-2', nome: 'Vendedor 2' },
  { id: 'vendedor-3', nome: 'Vendedor 3' },
];

function periodoAtual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const emptyForm = { titulo: '', responsavel_id: '', tipo: 'RECEITA', valor_alvo: '', periodo: periodoAtual() };

export default function MetasPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  // Definir/editar metas é ação de gestão; vendedor só visualiza a própria.
  const isGestor = podeVerTudo(user?.role);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [periodoFilter, setPeriodoFilter] = useState(periodoAtual());
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      const res = await apiClient.getMetas({ periodo: periodoFilter });
      setMetas(res.data.data);
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, periodoFilter]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, valor_alvo: parseFloat(form.valor_alvo) };
      await apiClient.createMeta(payload);
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const handleUpdateProgress = async (id: string, valor_atual: number) => {
    try { await apiClient.updateMeta(id, { valor_atual }); fetchData(); }
    catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta meta?')) return;
    try { await apiClient.deleteMeta(id); fetchData(); }
    catch (e) { console.error(e); }
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  // Periods — last 6 months
  const periods = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const nomeResponsavel = (id: string) => USUARIOS_MOCK.find(u => u.id === id)?.nome || id;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Metas Comerciais</h1>
            <p className="text-gray-500 mt-1">{isGestor ? 'Acompanhe metas por vendedor e período' : 'Acompanhe a sua meta no período'}</p>
          </div>
          {isGestor && (
            <button onClick={() => { setForm(emptyForm); setError(''); setShowModal(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              + Nova Meta
            </button>
          )}
        </div>

        {/* Period selector */}
        <div className="flex gap-2 overflow-x-auto">
          {periods.map(p => (
            <button key={p} onClick={() => setPeriodoFilter(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${periodoFilter === p ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
        </div>

        {/* Metas grid */}
        {dataLoading ? (
          <div className="text-center p-8 text-gray-500">Carregando...</div>
        ) : metas.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-gray-500">Nenhuma meta definida para {periodoFilter}</p>
            {isGestor && (
              <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Criar primeira meta</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {metas.map(meta => {
              const pct = Math.min(100, (meta.valor_atual / meta.valor_alvo) * 100);
              const isReceita = meta.tipo === 'RECEITA';
              return (
                <div key={meta.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{TIPO_ICON[meta.tipo]}</span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{meta.titulo}</p>
                        <p className="text-xs text-gray-500">{nomeResponsavel(meta.responsavel_id)} · {meta.tipo}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pct >= 100 ? 'bg-green-100 text-green-700' : pct >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{isReceita ? `R$ ${meta.valor_atual.toLocaleString('pt-BR')}` : meta.valor_atual} {!isReceita && TIPO_UNIT[meta.tipo]}</span>
                      <span>{isReceita ? `R$ ${meta.valor_alvo.toLocaleString('pt-BR')}` : meta.valor_alvo} {!isReceita && TIPO_UNIT[meta.tipo]}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="number" defaultValue={meta.valor_atual}
                      onBlur={e => handleUpdateProgress(meta.id, parseFloat(e.target.value))}
                      className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="Atualizar progresso" />
                    {isGestor && (
                      <button onClick={() => handleDelete(meta.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Nova Meta</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input value={form.titulo} onChange={e => setForm((p: any) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Meta de receita mensal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsável *</label>
                  <select value={form.responsavel_id} onChange={e => setForm((p: any) => ({ ...p, responsavel_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                    <option value="">Selecione</option>
                    {USUARIOS_MOCK.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select value={form.tipo} onChange={e => setForm((p: any) => ({ ...p, tipo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                    {['RECEITA', 'LEADS', 'PROPOSTAS', 'CONTRATOS', 'ATIVIDADES'].map(t => (
                      <option key={t} value={t}>{TIPO_ICON[t]} {t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Alvo *</label>
                  <input type="number" value={form.valor_alvo} onChange={e => setForm((p: any) => ({ ...p, valor_alvo: e.target.value }))}
                    placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Período *</label>
                  <input type="month" value={form.periodo} onChange={e => setForm((p: any) => ({ ...p, periodo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.titulo || !form.responsavel_id || !form.valor_alvo}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
