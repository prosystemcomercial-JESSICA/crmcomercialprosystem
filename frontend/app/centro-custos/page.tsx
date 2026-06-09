'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Lancamento {
  id: string; tipo: 'ENTRADA' | 'SAIDA'; categoria: string; descricao?: string;
  valor: string | number; recorrencia: string; competencia_ano: number; competencia_mes: number;
}
interface Resumo {
  total_entradas: number; total_saidas: number; resultado: number;
  entradas_imediatas?: number; mrr_periodo?: number; mrr_projetado_12m?: number;
  receita_periodo?: number; resultado_projetado?: number;
  por_categoria: { categoria: string; valor: number }[];
  media_mensalidade: number; media_instalacao: number; qtd_lancamentos: number;
}

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CAT_LABEL: Record<string, string> = {
  SALARIO: 'Salário', BENEFICIO: 'Benefício', AJUDA_CUSTO: 'Ajuda de custo', MARKETING: 'Marketing',
  COMISSAO: 'Comissão', OUTRO_CUSTO: 'Outro custo', MENSALIDADE: 'Mensalidade (MRR)',
  INSTALACAO: 'Instalação', SERVICO: 'Serviço', VENDA: 'Venda', OUTRA_ENTRADA: 'Outra entrada',
};
const fmt = (v: number | string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function CentroCustosPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState<number | 0>(hoje.getMonth() + 1);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [balanco, setBalanco] = useState<any | null>(null);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [cats, setCats] = useState<{ entrada: string[]; saida: string[] }>({ entrada: [], saida: [] });
  const [dataLoading, setDataLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ tipo: 'SAIDA', categoria: 'SALARIO', valor: '', recorrencia: 'MENSAL', descricao: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const [r, l, b] = await Promise.all([
        apiClient.getFinanceiroResumo(ano, mes || undefined),
        apiClient.getLancamentos({ ano, mes: mes || undefined }),
        apiClient.getFinanceiroBalanco(ano, mes || undefined).catch(() => null),
      ]);
      setResumo(r.data.data);
      setLancamentos(l.data.data);
      setBalanco(b?.data?.data || null);
    } catch (e) { console.error(e); } finally { setDataLoading(false); }
  }, [ano, mes]);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);
  useEffect(() => { if (isAuthenticated) apiClient.getFinanceiroCategorias().then(r => setCats(r.data.data)).catch(() => {}); }, [isAuthenticated]);

  const salvar = async () => {
    if (!form.valor || Number(form.valor) <= 0) { alert('Informe um valor válido'); return; }
    setSaving(true);
    try {
      const repetir = form.recorrencia === 'MENSAL' ? Number(form.repetir_meses || 1) : 1;
      // Mês inicial: o selecionado; se "Ano inteiro" e vai repetir, começa em janeiro.
      const mesInicial = mes || (repetir > 1 ? 1 : hoje.getMonth() + 1);
      await apiClient.createLancamento({
        tipo: form.tipo, categoria: form.categoria, descricao: form.descricao || undefined,
        valor: Number(form.valor), recorrencia: form.recorrencia,
        competencia_ano: ano, competencia_mes: mesInicial,
        repetir_meses: repetir,
      });
      setShowForm(false);
      setForm({ tipo: 'SAIDA', categoria: 'SALARIO', valor: '', recorrencia: 'MENSAL', descricao: '', repetir_meses: 1 });
      load();
    } catch (e: any) {
      alert('Erro ao salvar: ' + (e?.response?.data?.message || e.message));
    } finally { setSaving(false); }
  };

  const remover = async (id: string) => {
    if (!confirm('Remover este lançamento?')) return;
    await apiClient.deleteLancamento(id); load();
  };

  const catsDisponiveis = form.tipo === 'ENTRADA' ? cats.entrada : cats.saida;

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Centro de Custos Comercial</h1>
            <p className="text-gray-500 mt-1">Entradas, custos e resultado do setor comercial</p>
          </div>
          <button onClick={() => setShowForm(s => !s)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg">
            {showForm ? 'Cancelar' : '+ Novo lançamento'}
          </button>
        </div>

        {/* Filtros período */}
        <div className="flex items-center gap-2 flex-wrap">
          <select value={ano} onChange={e => setAno(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            {[hoje.getFullYear() - 2, hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value={0}>Ano inteiro</option>
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>

        {/* Formulário */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value, categoria: (e.target.value === 'ENTRADA' ? cats.entrada : cats.saida)[0] || '' }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="SAIDA">Saída (custo)</option>
                <option value="ENTRADA">Entrada (receita)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Categoria</label>
              <select value={form.categoria} onChange={e => setForm((f: any) => ({ ...f, categoria: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {catsDisponiveis.map(c => <option key={c} value={c}>{CAT_LABEL[c] || c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Valor (R$)</label>
              <input type="number" value={form.valor} onChange={e => setForm((f: any) => ({ ...f, valor: e.target.value }))} placeholder="0,00" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Recorrência</label>
              <select value={form.recorrencia} onChange={e => setForm((f: any) => ({ ...f, recorrencia: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="MENSAL">Mensal</option><option value="ANUAL">Anual</option>
                <option value="PONTUAL">Pontual</option><option value="EXTRAORDINARIO">Extraordinário</option>
              </select>
            </div>
            {form.recorrencia === 'MENSAL' && (
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Repetir por quantos meses?</label>
                <select value={form.repetir_meses || 1} onChange={e => setForm((f: any) => ({ ...f, repetir_meses: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  {[1, 2, 3, 6, 12, 18, 24].map(n => <option key={n} value={n}>{n === 1 ? 'Só este mês' : `${n} meses (ex.: salário fixo)`}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Cria um lançamento por mês a partir da competência. Ex.: R$ {Number(form.valor || 0).toLocaleString('pt-BR')} × {form.repetir_meses || 1} = <strong>R$ {(Number(form.valor || 0) * Number(form.repetir_meses || 1)).toLocaleString('pt-BR')}</strong> no total.
                </p>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Descrição (opcional)</label>
              <input value={form.descricao} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} placeholder="Ex.: salário vendedor João, campanha Meta Ads…" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button onClick={salvar} disabled={saving} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm">
                {saving ? 'Salvando…' : 'Salvar lançamento'}
              </button>
            </div>
            <p className="md:col-span-2 text-xs text-gray-400">
              Competência inicial: {mes ? `${MESES[mes]}/${ano}` : `escolha um mês para lançar (ano ${ano})`}.
              {form.recorrencia === 'MENSAL' && Number(form.repetir_meses) > 1 ? ` Será lançado em ${form.repetir_meses} meses consecutivos.` : ''}
            </p>
          </div>
        )}

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Carregando…</div>
        ) : (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <p className="text-xs text-gray-500">Entradas</p>
                <p className="text-2xl font-bold text-green-700">{fmt(resumo?.total_entradas || 0)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <p className="text-xs text-gray-500">Saídas (custos)</p>
                <p className="text-2xl font-bold text-red-700">{fmt(resumo?.total_saidas || 0)}</p>
              </div>
              <div className={`rounded-xl p-5 border ${(resumo?.resultado || 0) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                <p className="text-xs text-gray-500">Resultado do período (caixa)</p>
                <p className={`text-2xl font-bold ${(resumo?.resultado || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(resumo?.resultado || 0)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">entradas imediatas + MRR do mês − custos</p>
              </div>
            </div>

            {/* Entradas imediatas × MRR projetado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">⚡ Entradas imediatas</p>
                <p className="text-xl font-bold text-gray-800">{fmt(resumo?.entradas_imediatas || 0)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">vendas, instalações, serviços (à vista)</p>
              </div>
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">🔁 MRR do período</p>
                <p className="text-xl font-bold text-cyan-700">{fmt(resumo?.mrr_periodo || 0)}/mês</p>
                <p className="text-[11px] text-gray-400 mt-0.5">mensalidades (novos + acréscimos)</p>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">📈 MRR projetado (12 meses)</p>
                <p className="text-xl font-bold text-indigo-700">{fmt(resumo?.mrr_projetado_12m || 0)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">MRR do período × 12</p>
              </div>
            </div>

            {/* Médias */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">Média de mensalidade (MRR)</p>
                <p className="text-xl font-bold text-gray-800">{fmt(resumo?.media_mensalidade || 0)}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">Média de instalação</p>
                <p className="text-xl font-bold text-gray-800">{fmt(resumo?.media_instalacao || 0)}</p>
              </div>
            </div>

            {/* Por categoria */}
            {(resumo?.por_categoria?.length ?? 0) > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-3">Por categoria</h2>
                <div className="space-y-2">
                  {resumo!.por_categoria.sort((a, b) => b.valor - a.valor).map(c => {
                    const max = Math.max(...resumo!.por_categoria.map(x => x.valor), 1);
                    return (
                      <div key={c.categoria} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-36 flex-shrink-0">{CAT_LABEL[c.categoria] || c.categoria}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4"><div className="bg-blue-500 h-4 rounded-full" style={{ width: `${(c.valor / max) * 100}%` }} /></div>
                        <span className="text-xs font-medium text-gray-700 w-28 text-right">{fmt(c.valor)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── BALANÇO GERAL DO COMERCIAL ─────────────────────────────────── */}
            {balanco && (
              <div className="bg-white border-2 border-blue-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-lg font-bold flex items-center gap-2">📊 Balanço Geral do Comercial</h2>
                  <span className="text-xs text-blue-100">{mes ? `${MESES[mes]}/${ano}` : `Ano ${ano}`} · venda comercial automática (contratos + base)</span>
                </div>

                <div className="p-5 space-y-5">
                  {/* Entrando (venda comercial) */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">💰 O que está entrando (venda comercial)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-xs text-gray-500">⚡ Faturamento imediato</p>
                        <p className="text-xl font-bold text-green-700">{fmt(balanco.faturamento_imediato)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          setup de {balanco.qtd_contratos_assinados} contrato(s) + {balanco.qtd_vendas_base} venda(s) à base
                        </p>
                      </div>
                      <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                        <p className="text-xs text-gray-500">🔁 MRR do período</p>
                        <p className="text-xl font-bold text-cyan-700">{fmt(balanco.mrr_periodo)}<span className="text-xs font-normal">/mês</span></p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          novos: {fmt(balanco.mrr_contratos)} · base: {fmt(balanco.mrr_vendas_base)}
                        </p>
                      </div>
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                        <p className="text-xs text-gray-500">📈 Projeção MRR (12 meses)</p>
                        <p className="text-xl font-bold text-indigo-700">{fmt(balanco.mrr_projetado_12m)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">MRR do período × 12</p>
                      </div>
                    </div>
                  </div>

                  {/* Despesa do setor */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">📉 Despesa do setor comercial</p>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm text-gray-600">Despesa total</p>
                        <p className="text-xl font-bold text-red-700">{fmt(balanco.despesa_setor)}</p>
                      </div>
                      {balanco.despesa_por_categoria?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {balanco.despesa_por_categoria.map((c: any) => (
                            <span key={c.categoria} className="text-[11px] bg-white border border-red-100 text-red-700 rounded-full px-2 py-0.5">
                              {CAT_LABEL[c.categoria] || c.categoria}: {fmt(c.valor)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resultado consolidado */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className={`rounded-xl p-4 border ${balanco.resultado_caixa >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                      <p className="text-xs text-gray-500">Resultado de caixa (período)</p>
                      <p className={`text-2xl font-extrabold ${balanco.resultado_caixa >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(balanco.resultado_caixa)}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">faturamento imediato + 1 mês de MRR − despesa</p>
                    </div>
                    <div className={`rounded-xl p-4 border ${balanco.resultado_projetado >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
                      <p className="text-xs text-gray-500">Resultado projetado (12 meses)</p>
                      <p className={`text-2xl font-extrabold ${balanco.resultado_projetado >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>{fmt(balanco.resultado_projetado)}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">imediato + MRR×12 − despesa</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
                    O faturamento e o MRR vêm <b>automaticamente</b> dos contratos assinados e vendas à base do período.
                    As despesas vêm dos lançamentos de saída que você registra acima.
                  </p>
                </div>
              </div>
            )}

            {/* Lista de lançamentos */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-900">Lançamentos ({lancamentos.length})</div>
              {lancamentos.length === 0 ? (
                <p className="p-8 text-center text-gray-400 text-sm">Nenhum lançamento no período. Clique em "+ Novo lançamento".</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {lancamentos.map(l => (
                    <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${l.tipo === 'ENTRADA' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{CAT_LABEL[l.categoria] || l.categoria} {l.descricao ? <span className="text-gray-400 font-normal">· {l.descricao}</span> : ''}</p>
                          <p className="text-xs text-gray-400">{MESES[l.competencia_mes]}/{l.competencia_ano} · {l.recorrencia.toLowerCase()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-sm font-bold ${l.tipo === 'ENTRADA' ? 'text-green-700' : 'text-red-700'}`}>{l.tipo === 'ENTRADA' ? '+' : '−'} {fmt(l.valor)}</span>
                        <button onClick={() => remover(l.id)} className="text-xs text-gray-400 hover:text-red-600">remover</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
