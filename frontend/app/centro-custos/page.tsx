'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface Lancamento {
  id: string; tipo: 'ENTRADA' | 'SAIDA'; categoria: string; descricao?: string;
  valor: string | number; recorrencia: string; competencia_ano: number; competencia_mes: number;
  vendedor_id?: string | null;
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
  const [fluxoProjetado, setFluxoProjetado] = useState<any | null>(null);
  const [churnMensal, setChurnMensal] = useState<{ mes: string; mrr_perdido: number }[] | null>(null);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [cats, setCats] = useState<{ entrada: string[]; saida: string[] }>({ entrada: [], saida: [] });
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCriterios, setShowCriterios] = useState(false);
  const [form, setForm] = useState<any>({ tipo: 'SAIDA', categoria: 'SALARIO', valor: '', recorrencia: 'MENSAL', descricao: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const [r, l, b, f, c] = await Promise.all([
        apiClient.getFinanceiroResumo(ano, mes || undefined),
        apiClient.getLancamentos({ ano, mes: mes || undefined }),
        apiClient.getFinanceiroBalanco(ano, mes || undefined).catch(() => null),
        apiClient.getFinanceiroFluxoProjetado().catch(() => null),
        apiClient.getFinanceiroChurnMensal().catch(() => null),
      ]);
      setResumo(r.data.data);
      setLancamentos(l.data.data);
      setBalanco(b?.data?.data || null);
      setFluxoProjetado(f?.data?.data || null);
      setChurnMensal(c?.data?.data?.serie || null);
    } catch (e) { console.error(e); } finally { setDataLoading(false); }
  }, [ano, mes]);

  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);
  useEffect(() => { if (isAuthenticated) apiClient.getFinanceiroCategorias().then(r => setCats(r.data.data)).catch(() => {}); }, [isAuthenticated]);
  useEffect(() => { if (isAuthenticated) apiClient.getVendedores().then(r => setVendedores(r.data?.data || [])).catch(() => {}); }, [isAuthenticated]);

  const nomeVendedor = useCallback((id?: string | null) => {
    if (!id) return null;
    return vendedores.find(v => v.id === id)?.nome || null;
  }, [vendedores]);

  const salvar = async () => {
    if (!form.valor || Number(form.valor) <= 0) { console.warn('Informe um valor válido'); return; }
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
      console.error('Erro ao salvar', e);
    } finally { setSaving(false); }
  };

  const remover = async (id: string) => {
    if (!confirm('Remover este lançamento?')) return;
    await apiClient.deleteLancamento(id); load();
  };

  const catsDisponiveis = form.tipo === 'ENTRADA' ? cats.entrada : cats.saida;

  // Lançamentos sem comissões (Salário, Marketing etc.)
  const outrosLancamentos = lancamentos.filter(l => l.categoria !== 'COMISSAO');

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-sm font-semibold">Centro de Custos Comercial</h1>
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
          <div className="ps-card border border-gray-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs  mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value, categoria: (e.target.value === 'ENTRADA' ? cats.entrada : cats.saida)[0] || '' }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="SAIDA">Saída (custo)</option>
                <option value="ENTRADA">Entrada (receita)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs  mb-1">Categoria</label>
              <select value={form.categoria} onChange={e => setForm((f: any) => ({ ...f, categoria: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {catsDisponiveis.map(c => <option key={c} value={c}>{CAT_LABEL[c] || c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs  mb-1">Valor (R$)</label>
              <input type="number" value={form.valor} onChange={e => setForm((f: any) => ({ ...f, valor: e.target.value }))} placeholder="0,00" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs  mb-1">Recorrência</label>
              <select value={form.recorrencia} onChange={e => setForm((f: any) => ({ ...f, recorrencia: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="MENSAL">Mensal</option><option value="ANUAL">Anual</option>
                <option value="PONTUAL">Pontual</option><option value="EXTRAORDINARIO">Extraordinário</option>
              </select>
            </div>
            {form.recorrencia === 'MENSAL' && (
              <div className="md:col-span-2">
                <label className="block text-xs  mb-1">Repetir por quantos meses?</label>
                <select value={form.repetir_meses || 1} onChange={e => setForm((f: any) => ({ ...f, repetir_meses: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  {[1, 2, 3, 6, 12, 18, 24].map(n => <option key={n} value={n}>{n === 1 ? 'Só este mês' : `${n} meses (ex.: salário fixo)`}</option>)}
                </select>
                <p className="text-xs  mt-1">
                  Cria um lançamento por mês a partir da competência. Ex.: R$ {Number(form.valor || 0).toLocaleString('pt-BR')} × {form.repetir_meses || 1} = <strong>R$ {(Number(form.valor || 0) * Number(form.repetir_meses || 1)).toLocaleString('pt-BR')}</strong> no total.
                </p>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-xs  mb-1">Descrição (opcional)</label>
              <input value={form.descricao} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} placeholder="Ex.: salário vendedor João, campanha Meta Ads…" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button onClick={salvar} disabled={saving} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm">
                {saving ? 'Salvando…' : 'Salvar lançamento'}
              </button>
            </div>
            <p className="md:col-span-2 text-xs ">
              Competência inicial: {mes ? `${MESES[mes]}/${ano}` : `escolha um mês para lançar (ano ${ano})`}.
              {form.recorrencia === 'MENSAL' && Number(form.repetir_meses) > 1 ? ` Será lançado em ${form.repetir_meses} meses consecutivos.` : ''}
            </p>
          </div>
        )}

        {dataLoading ? (
          <div className="text-center p-12 ">Carregando…</div>
        ) : (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <p className="text-xs ">Entradas</p>
                <p className="text-2xl font-bold text-green-700">{fmt(resumo?.total_entradas || 0)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <p className="text-xs ">Saídas (custos)</p>
                <p className="text-2xl font-bold text-red-700">{fmt(resumo?.total_saidas || 0)}</p>
              </div>
              <div className={`rounded-xl p-5 border ${(resumo?.resultado || 0) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                <p className="text-xs ">Resultado do período (caixa)</p>
                <p className={`text-2xl font-bold ${(resumo?.resultado || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(resumo?.resultado || 0)}</p>
                <p className="text-[11px]  mt-0.5">entradas imediatas + MRR do mês − custos</p>
              </div>
            </div>

            {/* Entradas imediatas × MRR projetado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="ps-card border border-gray-200 rounded-xl p-4">
                <p className="text-xs ">⚡ Entradas imediatas</p>
                <p className="text-xl font-bold ">{fmt(resumo?.entradas_imediatas || 0)}</p>
                <p className="text-[11px]  mt-0.5">vendas, instalações, serviços (à vista)</p>
              </div>
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                <p className="text-xs ">🔁 MRR do período</p>
                <p className="text-xl font-bold text-cyan-700">{fmt(resumo?.mrr_periodo || 0)}/mês</p>
                <p className="text-[11px]  mt-0.5">mensalidades (novos + acréscimos)</p>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="text-xs ">📈 MRR projetado (12 meses)</p>
                <p className="text-xl font-bold text-indigo-700">{fmt(resumo?.mrr_projetado_12m || 0)}</p>
                <p className="text-[11px]  mt-0.5">MRR do período × 12</p>
              </div>
            </div>

            {/* Médias */}
            <div className="grid grid-cols-2 gap-4">
              <div className="ps-card border border-gray-200 rounded-xl p-4">
                <p className="text-xs ">Média de mensalidade (MRR)</p>
                <p className="text-xl font-bold ">{fmt(resumo?.media_mensalidade || 0)}</p>
              </div>
              <div className="ps-card border border-gray-200 rounded-xl p-4">
                <p className="text-xs ">Média de instalação</p>
                <p className="text-xl font-bold ">{fmt(resumo?.media_instalacao || 0)}</p>
              </div>
            </div>

            {/* Por categoria */}
            {(resumo?.por_categoria?.length ?? 0) > 0 && (
              <div className="ps-card border border-gray-200 rounded-xl p-5">
                <h2 className="text-base font-semibold text-sm font-semibold mb-3">Por categoria</h2>
                <div className="space-y-2">
                  {resumo!.por_categoria.sort((a, b) => b.valor - a.valor).map(c => {
                    const max = Math.max(...resumo!.por_categoria.map(x => x.valor), 1);
                    const ehSaida = cats.saida.includes(c.categoria);
                    return (
                      <div key={c.categoria} className="flex items-center gap-3">
                        <span className="text-xs  w-36 flex-shrink-0">{CAT_LABEL[c.categoria] || c.categoria}</span>
                        <div className="flex-1 bg-opacity-0 rounded-full h-4">
                          <div className={`h-4 rounded-full ${ehSaida ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${(c.valor / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium  w-28 text-right">{fmt(c.valor)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── BALANÇO GERAL DO COMERCIAL ─────────────────────────────────── */}
            {balanco && (
              <div className="ps-card border-2 border-blue-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-lg font-bold flex items-center gap-2">📊 Balanço Geral do Comercial</h2>
                  <span className="text-xs text-blue-100">{mes ? `${MESES[mes]}/${ano}` : `Ano ${ano}`} · venda comercial automática (contratos + base)</span>
                </div>

                <div className="p-5 space-y-5">
                  {/* Entrando (venda comercial) */}
                  <div>
                    <p className="text-xs font-semibold  uppercase tracking-wide mb-2">💰 O que está entrando (venda comercial)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-xs ">⚡ Faturamento imediato</p>
                        <p className="text-xl font-bold text-green-700">{fmt(balanco.faturamento_imediato)}</p>
                        <p className="text-[11px]  mt-0.5">
                          setup de {balanco.qtd_contratos_assinados} contrato(s) + {balanco.qtd_vendas_base} venda(s) à base
                        </p>
                      </div>
                      <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
                        <p className="text-xs ">🔁 MRR do período</p>
                        <p className="text-xl font-bold text-cyan-700">{fmt(balanco.mrr_periodo)}<span className="text-xs font-normal">/mês</span></p>
                        <p className="text-[11px]  mt-0.5">
                          novos: {fmt(balanco.mrr_contratos)} · base: {fmt(balanco.mrr_vendas_base)}
                        </p>
                      </div>
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                        <p className="text-xs ">📈 Projeção MRR (12 meses)</p>
                        <p className="text-xl font-bold text-indigo-700">{fmt(balanco.mrr_projetado_12m)}</p>
                        <p className="text-[11px]  mt-0.5">MRR do período × 12</p>
                      </div>
                    </div>
                  </div>

                  {/* Despesa do setor */}
                  <div>
                    <p className="text-xs font-semibold  uppercase tracking-wide mb-2">📉 Despesa do setor comercial</p>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm ">Despesa total</p>
                        <p className="text-xl font-bold text-red-700">{fmt(balanco.despesa_setor)}</p>
                      </div>
                      {balanco.despesa_por_categoria?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {balanco.despesa_por_categoria.map((c: any) => (
                            <span key={c.categoria} className="text-[11px] ps-card border border-red-100 text-red-700 rounded-full px-2 py-0.5">
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
                      <p className="text-xs ">Resultado de caixa (período)</p>
                      <p className={`text-2xl font-extrabold ${balanco.resultado_caixa >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(balanco.resultado_caixa)}</p>
                      <p className="text-[11px]  mt-0.5">faturamento imediato + 1 mês de MRR − despesa</p>
                    </div>
                    <div className={`rounded-xl p-4 border ${balanco.resultado_projetado >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
                      <p className="text-xs ">Resultado projetado (12 meses)</p>
                      <p className={`text-2xl font-extrabold ${balanco.resultado_projetado >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>{fmt(balanco.resultado_projetado)}</p>
                      <p className="text-[11px]  mt-0.5">imediato + MRR×12 − despesa</p>
                    </div>
                  </div>

                  <p className="text-[11px]  border-t border-gray-100 pt-3">
                    O faturamento e o MRR vêm <b>automaticamente</b> dos contratos assinados e vendas à base do período.
                    As despesas vêm dos lançamentos de saída que você registra acima.
                  </p>
                </div>
              </div>
            )}

            {/* ── DRE SIMPLIFICADO ───────────────────────────────────────────── */}
            {balanco && (
              <div className="ps-card border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-base font-bold">📋 DRE simplificado</h2>
                  <span className="text-xs text-gray-500">{mes ? `${MESES[mes]}/${ano}` : `Ano ${ano}`}</span>
                </div>
                <div className="p-5 space-y-2 text-sm">
                  <div className="flex items-center justify-between py-1.5">
                    <span>Receita comercial (imediato + MRR projetado)</span>
                    <span className="font-semibold text-green-700">{fmt(balanco.receita_comercial_total)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-t border-dashed">
                    <span>(−) Custos e despesas do setor</span>
                    <span className="font-semibold text-red-700">{fmt(balanco.despesa_setor)}</span>
                  </div>
                  {(() => {
                    const comissaoTotal = balanco.despesa_por_categoria?.find((c: any) => c.categoria === 'COMISSAO')?.valor || 0;
                    return comissaoTotal > 0 ? (
                      <div className="flex items-center justify-between py-1.5 pl-4 text-xs text-gray-500">
                        <span>— incluindo comissões</span>
                        <span>{fmt(comissaoTotal)}</span>
                      </div>
                    ) : null;
                  })()}
                  <div className="flex items-center justify-between py-2 border-t-2 border-gray-200 mt-1">
                    <span className="font-bold">Resultado líquido projetado</span>
                    <span className={`font-extrabold text-lg ${balanco.resultado_projetado >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>
                      {fmt(balanco.resultado_projetado)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── FLUXO DE CAIXA PROJETADO (M+1 a M+3) ───────────────────────── */}
            {fluxoProjetado && (
              <div className="ps-card border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b">
                  <h2 className="text-base font-bold">📅 Fluxo de caixa projetado</h2>
                  <p className="text-xs text-gray-500 mt-0.5">MRR contratado atual − despesas já lançadas para cada mês futuro</p>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {fluxoProjetado.pontos.map((p: any) => (
                    <div key={p.mes} className={`rounded-xl p-4 border ${p.resultado >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                      <p className="text-xs font-semibold">{p.mes} · {MESES[p.mes_numero]}/{p.ano}</p>
                      <p className={`text-xl font-extrabold mt-1 ${p.resultado >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(p.resultado)}</p>
                      <p className="text-[11px] text-gray-500 mt-1">MRR: {fmt(p.entrada_mrr)} · despesas: {fmt(p.saida_lancada)}</p>
                      {!p.despesas_lancadas && (
                        <p className="text-[11px] text-amber-600 mt-1">⚠ nenhuma despesa lançada ainda para este mês</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── CHURN FINANCEIRO MENSAL ─────────────────────────────────────── */}
            {churnMensal && (
              <div className="ps-card border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b">
                  <h2 className="text-base font-bold">📉 MRR perdido por mês (churn financeiro)</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Últimos 6 meses — mensalidade perdida na desativação de clientes</p>
                </div>
                <div className="p-5">
                  {churnMensal.every(c => c.mrr_perdido === 0) ? (
                    <p className="text-xs text-center py-6 text-gray-400">Nenhum churn registrado no período</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={churnMensal}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => fmt(Number(v))} />
                        <Bar dataKey="mrr_perdido" name="MRR perdido" fill="#dc2626" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {/* Link para gestão de comissões */}
            <div className="ps-card rounded-xl p-4 flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--t-text-primary)' }}>Comissões</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--t-text-muted)' }}>Gestão completa de comissões (com status de pagamento) fica em Comissões.</p>
              </div>
              <Link href="/comissoes" className="text-[11px] font-semibold" style={{ color: 'var(--t-primary)' }}>
                Ver comissões →
              </Link>
            </div>

            {/* Lista de lançamentos (demais categorias — comissão fica na seção acima) */}
            <div className="ps-card border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 font-semibold text-sm font-semibold">Lançamentos ({outrosLancamentos.length})</div>
              {outrosLancamentos.length === 0 ? (
                <p className="p-8 text-center  text-sm">Nenhum lançamento no período. Clique em "+ Novo lançamento".</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {outrosLancamentos.map(l => (
                    <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${l.tipo === 'ENTRADA' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-sm font-semibold truncate">{CAT_LABEL[l.categoria] || l.categoria} {l.descricao ? <span className="text-gray-400 font-normal">· {l.descricao}</span> : ''}</p>
                          <p className="text-xs ">{MESES[l.competencia_mes]}/{l.competencia_ano} · {l.recorrencia.toLowerCase()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-sm font-bold ${l.tipo === 'ENTRADA' ? 'text-green-700' : 'text-red-700'}`}>{l.tipo === 'ENTRADA' ? '+' : '−'} {fmt(l.valor)}</span>
                        <button onClick={() => remover(l.id)} className="text-xs  hover:text-red-600">remover</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Critério de geração da comissão — menu suspenso no rodapé */}
            <div className="ps-card border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowCriterios(s => !s)}
                className="w-full px-5 py-3 flex items-center justify-between gap-3 text-left"
              >
                <span className="font-semibold text-sm">📋 Como a comissão é calculada</span>
                <span className="text-xs text-gray-400">{showCriterios ? '▲ recolher' : '▼ ver critério'}</span>
              </button>
              {showCriterios && (
                <div className="px-5 pb-5 pt-1 space-y-5 text-sm text-gray-700 border-t border-gray-100">
                  <div>
                    <p className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">1. Contratos novos</p>
                    <p className="mb-2">Gerada no momento em que o contrato é marcado como <b>ASSINADO</b>. A competência (mês em que a comissão "nasce", usada nesta página) é o mês da assinatura.</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr className="text-left">
                            <th className="px-3 py-2">Papel</th><th className="px-3 py-2">Percentual</th><th className="px-3 py-2">Base de cálculo</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-gray-100"><td className="px-3 py-2">Vendedor</td><td className="px-3 py-2 font-semibold">15%</td><td className="px-3 py-2">Valor de setup do contrato</td></tr>
                          <tr className="border-t border-gray-100"><td className="px-3 py-2">Supervisão</td><td className="px-3 py-2 font-semibold">5%</td><td className="px-3 py-2">Mesmo valor de setup (pago a cada supervisor/admin ativo)</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <p className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">2. Vendas adicionais (indicações, upgrades, revendas)</p>
                    <p className="mb-2">A regra varia por categoria do parceiro. A competência usada nesta página é o <b>mês seguinte</b> à confirmação da venda (ou ao 1º vencimento, no caso de Comunicação de Dados) — diferente dos contratos novos.</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                          <tr className="text-left">
                            <th className="px-3 py-2">Categoria do parceiro</th><th className="px-3 py-2">Comissão do vendedor</th><th className="px-3 py-2">Comissão da supervisão</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-gray-100">
                            <td className="px-3 py-2 font-medium">Comunicação de Dados</td>
                            <td className="px-3 py-2">15% sobre o setup</td>
                            <td className="px-3 py-2">5% sobre o setup</td>
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="px-3 py-2 font-medium">Upgrade de Plano</td>
                            <td className="px-3 py-2">Valor fixo (R$ 50)</td>
                            <td className="px-3 py-2">5% sobre o setup</td>
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="px-3 py-2 font-medium">Pacote Fiscal / TEF / Avant / Imendes</td>
                            <td className="px-3 py-2">Valor fixo (R$ 50)</td>
                            <td className="px-3 py-2">5% sobre o acréscimo de mensalidade</td>
                          </tr>
                          <tr className="border-t border-gray-100">
                            <td className="px-3 py-2 font-medium">Demais parceiros</td>
                            <td className="px-3 py-2">Valor fixo (cadastrado por parceiro)</td>
                            <td className="px-3 py-2">Percentual configurável por parceiro</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
                    O lançamento de despesa desta página é criado automaticamente a partir da comissão gerada, na mesma competência (mês) em que ela nasceu — não no mês em que o financeiro efetivamente paga.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
