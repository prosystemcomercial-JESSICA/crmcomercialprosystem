'use client';

import { useEffect, useState } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';

interface Meta {
  id: string;
  titulo: string;
  responsavel_id: string;
  responsaveis_ids?: string[] | null;
  tipo: string;
  valor_alvo: number;
  valor_atual: number;
  periodo: string;
  status: string;
  modo?: string | null;
  periodo_tipo?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  meta_contratos?: number | null;
  meta_preco_inst?: number | null;
  meta_preco_mensal?: number | null;
  meta_valor_total?: number | null;
  realizado?: {
    contratos: number; valor_total: number; mrr_total: number;
    preco_medio_inst: number; preco_medio_mensal: number;
  } | null;
}

interface UsuarioOpt { id: string; nome: string; cargo?: string }

const CARGO_LABEL: Record<string, string> = {
  CEO: 'CEO', ADMIN: 'Administrador', DIRETOR: 'Diretor',
  SUPERVISAO_COMERCIAL: 'Supervisão Comercial', SUPERVISAO_TECNICA: 'Supervisão Técnica',
  TECNICO_SUPORTE: 'Técnico', VENDEDOR: 'Vendedor',
};
const cargoLabel = (c?: string) => (c && CARGO_LABEL[c]) || c || '';

const fmtBRL = (v?: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function periodoAtual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const emptyForm = {
  titulo: '',
  responsaveis_ids: [] as string[],
  modo: 'INDIVIDUAL',
  periodo_tipo: 'MENSAL',
  periodo: periodoAtual(),
  ano: String(new Date().getFullYear()),
  data_inicio: '',
  data_fim: '',
  meta_contratos: '',
  meta_preco_inst: '',
  meta_preco_mensal: '',
  meta_valor_total: '',
};

export default function MetasPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  // Definir/editar metas é ação de gestão; vendedor só visualiza a própria.
  const isGestor = podeVerTudo(user?.role);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOpt[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const nomeUsuario = (id?: string) => usuarios.find(u => u.id === id)?.nome || id || '—';

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  // Carrega os usuários reais (nome + cargo) para o dropdown de responsável
  useEffect(() => {
    if (isGestor) apiClient.getResponsaveis().then(r => setUsuarios(r.data?.data || [])).catch(() => {});
  }, [isGestor]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      const res = await apiClient.getMetas();
      setMetas(res.data.data);
    } catch (e) { console.error(e); }
    finally { setDataLoading(false); }
  };

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  // Monta o rótulo do período conforme o tipo escolhido
  const buildPeriodo = () => {
    if (form.periodo_tipo === 'ANUAL') return String(form.ano);
    if (form.periodo_tipo === 'PERIODO') return `${form.data_inicio || '?'}..${form.data_fim || '?'}`;
    return form.periodo; // mensal (YYYY-MM)
  };

  const toggleResponsavel = (id: string) => {
    setForm((p: any) => {
      const arr: string[] = p.responsaveis_ids || [];
      return { ...p, responsaveis_ids: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
    });
  };

  const num = (v: any) => (v === '' || v == null ? undefined : parseFloat(v));

  const handleSave = async () => {
    if (!form.titulo?.trim()) { setError('Informe o título.'); return; }
    if (!form.responsaveis_ids?.length) { setError('Selecione ao menos um responsável.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        titulo: form.titulo,
        responsaveis_ids: form.responsaveis_ids,
        modo: form.modo,
        periodo_tipo: form.periodo_tipo,
        periodo: buildPeriodo(),
        data_inicio: form.periodo_tipo === 'PERIODO' && form.data_inicio ? new Date(form.data_inicio).toISOString() : undefined,
        data_fim: form.periodo_tipo === 'PERIODO' && form.data_fim ? new Date(form.data_fim).toISOString() : undefined,
        meta_contratos: num(form.meta_contratos),
        meta_preco_inst: num(form.meta_preco_inst),
        meta_preco_mensal: num(form.meta_preco_mensal),
        meta_valor_total: num(form.meta_valor_total),
      };
      await apiClient.createMeta(payload);
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta meta?')) return;
    try { await apiClient.deleteMeta(id); fetchData(); }
    catch (e) { console.error(e); }
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Metas Comerciais</h1>
            <p className="text-gray-500 mt-1">{isGestor ? 'Acompanhe metas por vendedor e período' : 'Acompanhe a sua meta no período'}</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              nome="metas" titulo="Metas Comerciais — ProSystem CRM"
              linhas={metas}
              colunas={[
                { header: 'Título', value: (m: Meta) => m.titulo },
                { header: 'Período', value: (m: Meta) => m.periodo },
                { header: 'Modo', value: (m: Meta) => m.modo || '' },
                { header: 'Responsáveis', value: (m: Meta) => ((m.responsaveis_ids && m.responsaveis_ids.length) ? m.responsaveis_ids : [m.responsavel_id]).map(nomeUsuario).join(', ') },
                { header: 'Meta contratos', value: (m: Meta) => m.meta_contratos ?? '' },
                { header: 'Realizado contratos', value: (m: Meta) => m.realizado?.contratos ?? 0 },
                { header: 'Meta total (R$)', value: (m: Meta) => m.meta_valor_total ?? '' },
                { header: 'Realizado total (R$)', value: (m: Meta) => m.realizado?.valor_total ?? 0 },
                { header: 'Preço médio instal. (real)', value: (m: Meta) => m.realizado?.preco_medio_inst ?? 0 },
                { header: 'Preço médio mensal. (real)', value: (m: Meta) => m.realizado?.preco_medio_mensal ?? 0 },
              ]}
            />
            {isGestor && (
              <button onClick={() => { setForm(emptyForm); setError(''); setShowModal(true); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                + Nova Meta
              </button>
            )}
          </div>
        </div>

        {/* Metas grid */}
        {dataLoading ? (
          <div className="text-center p-8 text-gray-500">Carregando...</div>
        ) : metas.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-gray-500">{isGestor ? 'Nenhuma meta cadastrada ainda.' : 'Nenhuma meta atribuída a você no momento.'}</p>
            {isGestor && (
              <button onClick={() => { setForm(emptyForm); setShowModal(true); }} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Criar primeira meta</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {metas.map(meta => {
              const rz = meta.realizado || { contratos: 0, valor_total: 0, mrr_total: 0, preco_medio_inst: 0, preco_medio_mensal: 0 };
              const alvo = meta.meta_valor_total ?? meta.valor_alvo ?? 0;
              const pct = alvo > 0 ? Math.min(100, (rz.valor_total / alvo) * 100) : 0;
              const responsaveis = (meta.responsaveis_ids && meta.responsaveis_ids.length)
                ? meta.responsaveis_ids : [meta.responsavel_id];
              return (
                <div key={meta.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{meta.titulo}</p>
                      <p className="text-xs text-gray-500">
                        {meta.periodo} {meta.modo === 'EQUIPE' ? '· Equipe' : '· Individual'}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pct >= 100 ? 'bg-green-100 text-green-700' : pct >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>

                  {/* Responsáveis */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {responsaveis.map(id => (
                      <span key={id} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{nomeUsuario(id)}</span>
                    ))}
                  </div>

                  {/* Alvos comerciais — realizado (automático) × meta */}
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-500">Contratos</p>
                      <p className="font-bold text-gray-800">{rz.contratos}<span className="text-gray-400 font-normal"> / {meta.meta_contratos ?? '—'}</span></p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-500">Total em valores</p>
                      <p className="font-bold text-gray-800">{fmtBRL(rz.valor_total)}<span className="text-gray-400 font-normal"> / {fmtBRL(meta.meta_valor_total)}</span></p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-500">Preço médio instal.</p>
                      <p className="font-bold text-gray-800">{fmtBRL(rz.preco_medio_inst)}<span className="text-gray-400 font-normal"> / {fmtBRL(meta.meta_preco_inst)}</span></p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-500">Preço médio mensal.</p>
                      <p className="font-bold text-gray-800">{fmtBRL(rz.preco_medio_mensal)}<span className="text-gray-400 font-normal"> / {fmtBRL(meta.meta_preco_mensal)}</span></p>
                    </div>
                  </div>

                  {/* Evolução (total em valores) — realizado automático */}
                  <div className="mb-1">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Realizado {fmtBRL(rz.valor_total)}</span>
                      <span>Meta {fmtBRL(alvo)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Atualizado automaticamente pelos fechamentos do período.</p>
                  </div>

                  {isGestor && (
                    <div className="flex justify-end mt-2">
                      <button onClick={() => handleDelete(meta.id)} className="text-red-400 hover:text-red-600 text-xs">Excluir meta</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-5">Nova Meta Comercial</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
                <input value={form.titulo} onChange={e => setForm((p: any) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Meta de fechamento — Junho"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
              </div>

              {/* Responsáveis (usuários reais, 1 ou vários) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsável(is) * <span className="text-gray-400 font-normal">— a meta só aparece para os selecionados</span></label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {usuarios.length === 0 && <p className="text-xs text-gray-400 p-1">Carregando usuários...</p>}
                  {usuarios.map(u => (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={(form.responsaveis_ids || []).includes(u.id)} onChange={() => toggleResponsavel(u.id)} />
                      <span className="text-sm text-gray-800">{u.nome}</span>
                      {u.cargo && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{cargoLabel(u.cargo)}</span>}
                    </label>
                  ))}
                </div>
              </div>

              {/* Modo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modo</label>
                  <select value={form.modo} onChange={e => setForm((p: any) => ({ ...p, modo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm">
                    <option value="INDIVIDUAL">Individual (mesma meta p/ cada um)</option>
                    <option value="EQUIPE">Equipe (meta somada do grupo)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
                  <select value={form.periodo_tipo} onChange={e => setForm((p: any) => ({ ...p, periodo_tipo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm">
                    <option value="MENSAL">Mensal</option>
                    <option value="ANUAL">Anual</option>
                    <option value="PERIODO">Período (datas)</option>
                  </select>
                </div>
              </div>

              {/* Campo de período conforme o tipo */}
              {form.periodo_tipo === 'MENSAL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mês/Ano</label>
                  <input type="month" value={form.periodo} onChange={e => setForm((p: any) => ({ ...p, periodo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm" />
                </div>
              )}
              {form.periodo_tipo === 'ANUAL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                  <input type="number" value={form.ano} onChange={e => setForm((p: any) => ({ ...p, ano: e.target.value }))}
                    placeholder="2026" className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm" />
                </div>
              )}
              {form.periodo_tipo === 'PERIODO' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                    <input type="date" value={form.data_inicio} onChange={e => setForm((p: any) => ({ ...p, data_inicio: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
                    <input type="date" value={form.data_fim} onChange={e => setForm((p: any) => ({ ...p, data_fim: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm" />
                  </div>
                </div>
              )}

              {/* Alvos comerciais */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Alvos da meta</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total de contratos</label>
                    <input type="number" value={form.meta_contratos} onChange={e => setForm((p: any) => ({ ...p, meta_contratos: e.target.value }))}
                      placeholder="Ex: 10" className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total em valores (R$)</label>
                    <input type="number" value={form.meta_valor_total} onChange={e => setForm((p: any) => ({ ...p, meta_valor_total: e.target.value }))}
                      placeholder="Ex: 50000" className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preço médio instalação (R$)</label>
                    <input type="number" value={form.meta_preco_inst} onChange={e => setForm((p: any) => ({ ...p, meta_preco_inst: e.target.value }))}
                      placeholder="Ex: 3000" className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preço médio mensalidade (R$)</label>
                    <input type="number" value={form.meta_preco_mensal} onChange={e => setForm((p: any) => ({ ...p, meta_preco_mensal: e.target.value }))}
                      placeholder="Ex: 450" className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.titulo || !(form.responsaveis_ids || []).length}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {saving ? 'Salvando...' : 'Salvar Meta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
