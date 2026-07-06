'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth, podeVerTudo } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import ExportButton from '@/components/ui/ExportButton';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  PieChart, Pie, BarChart,
} from 'recharts';
import { Target, TrendingUp, Users, Plus, Loader2 } from 'lucide-react';

const CORES = ['var(--t-primary)', '#16a34a', '#d97706', '#7c3aed', '#0d9488', '#dc2626'];

interface Meta {
  id: string; titulo: string; responsavel_id: string; responsaveis_ids?: string[] | null;
  tipo: string; valor_alvo: number; valor_atual: number; periodo: string; status: string;
  modo?: string | null; periodo_tipo?: string | null;
  meta_contratos?: number | null; meta_preco_inst?: number | null; meta_preco_mensal?: number | null; meta_valor_total?: number | null;
  realizado?: { contratos: number; valor_total: number; mrr_total: number; preco_medio_inst: number; preco_medio_mensal: number } | null;
}
interface UsuarioOpt { id: string; nome: string; cargo?: string }

const CARGO_LABEL: Record<string, string> = {
  CEO: 'CEO', ADMIN: 'Administrador', DIRETOR: 'Diretor',
  SUPERVISAO_COMERCIAL: 'Supervisão Comercial', SUPERVISAO_TECNICA: 'Supervisão Técnica',
  TECNICO_SUPORTE: 'Técnico', VENDEDOR: 'Vendedor',
};
const cargoLabel = (c?: string) => (c && CARGO_LABEL[c]) || c || '';
const fmtBRL = (v?: number | null) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function periodoAtual() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; }

const emptyForm = {
  titulo: '', responsaveis_ids: [] as string[], modo: 'INDIVIDUAL', periodo_tipo: 'MENSAL',
  periodo: periodoAtual(), ano: String(new Date().getFullYear()), data_inicio: '', data_fim: '',
  meta_contratos: '', meta_preco_inst: '', meta_preco_mensal: '', meta_valor_total: '',
};

export default function MetasPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const isGestor = podeVerTudo(user?.role);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOpt[]>([]);
  const [serie, setSerie] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const ano = new Date().getFullYear();
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>(periodoAtual());
  const [filtroVendedor, setFiltroVendedor] = useState<string>('');

  const nomeUsuario = (id?: string) => usuarios.find(u => u.id === id)?.nome || id || '—';

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);
  useEffect(() => { if (isGestor) apiClient.getResponsaveis().then(r => setUsuarios(r.data?.data || [])).catch(() => {}); }, [isGestor]);

  const fetchData = async () => {
    setDataLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        apiClient.getMetas(),
        apiClient.getMetasSerieAnual(ano).catch(() => null),
      ]);
      setMetas(mRes.data.data);
      setSerie(sRes?.data?.data || null);
    } catch (e) { console.error(e); } finally { setDataLoading(false); }
  };
  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated]);

  const periodosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    metas.forEach(m => m.periodo && set.add(m.periodo));
    set.add(periodoAtual());
    set.add(String(ano));
    return Array.from(set).sort().reverse();
  }, [metas]);

  const vendedorasFiltro = useMemo(() => {
    const arr: { id: string; nome: string }[] = serie?.vendedoras?.length
      ? serie.vendedoras.map((v: any) => ({ id: v.id, nome: v.nome }))
      : usuarios.filter(u => (u.cargo || '') === 'VENDEDOR').map(u => ({ id: u.id, nome: u.nome }));
    return arr.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [serie, usuarios]);

  const metasDoPeriodo = useMemo(() => {
    let lista = filtroPeriodo === 'TODOS' ? metas : metas.filter(m => m.periodo === filtroPeriodo);
    if (filtroVendedor) {
      lista = lista.filter(m => {
        const ids = m.responsaveis_ids?.length ? m.responsaveis_ids : [m.responsavel_id];
        return ids.includes(filtroVendedor);
      });
    }
    return lista;
  }, [metas, filtroPeriodo, filtroVendedor]);

  const mesSerie = useMemo(() => {
    if (!serie || !/^\d{4}-\d{2}$/.test(filtroPeriodo)) return null;
    return serie.meses.find((m: any) => m.periodo === filtroPeriodo) || null;
  }, [serie, filtroPeriodo]);

  const agregado = useMemo(() => {
    let realContratos = 0, realValor = 0;
    if (serie?.meses?.length) {
      const mesesAlvo = /^\d{4}-\d{2}$/.test(filtroPeriodo)
        ? serie.meses.filter((m: any) => m.periodo === filtroPeriodo)
        : serie.meses;
      for (const mm of mesesAlvo) {
        if (filtroVendedor) {
          const v = (mm.por_vendedora || []).find((x: any) => x.id === filtroVendedor);
          realContratos += v?.contratos || 0; realValor += v?.valor_total || 0;
        } else { realContratos += mm.contratos || 0; realValor += mm.setup_total || 0; }
      }
    }
    const metaContratos = metasDoPeriodo.reduce((mx, m) => Math.max(mx, m.meta_contratos || 0), 0);
    const metaValor = metasDoPeriodo.reduce((mx, m) => Math.max(mx, m.meta_valor_total || 0), 0);
    return { metaContratos, realContratos, metaValor, realValor };
  }, [metasDoPeriodo, serie, filtroPeriodo, filtroVendedor]);

  const num = (v: any) => (v === '' || v == null ? undefined : parseFloat(v));
  const buildPeriodo = () => form.periodo_tipo === 'ANUAL' ? String(form.ano)
    : form.periodo_tipo === 'PERIODO' ? `${form.data_inicio || '?'}..${form.data_fim || '?'}` : form.periodo;
  const toggleResponsavel = (id: string) => setForm((p: any) => {
    const arr: string[] = p.responsaveis_ids || [];
    return { ...p, responsaveis_ids: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
  });

  const handleSave = async () => {
    if (!form.titulo?.trim()) { setError('Informe o título.'); return; }
    if (!form.responsaveis_ids?.length) { setError('Selecione ao menos um responsável.'); return; }
    setSaving(true); setError('');
    try {
      await apiClient.createMeta({
        titulo: form.titulo, responsaveis_ids: form.responsaveis_ids, modo: form.modo,
        periodo_tipo: form.periodo_tipo, periodo: buildPeriodo(),
        data_inicio: form.periodo_tipo === 'PERIODO' && form.data_inicio ? new Date(form.data_inicio).toISOString() : undefined,
        data_fim: form.periodo_tipo === 'PERIODO' && form.data_fim ? new Date(form.data_fim).toISOString() : undefined,
        meta_contratos: num(form.meta_contratos), meta_preco_inst: num(form.meta_preco_inst),
        meta_preco_mensal: num(form.meta_preco_mensal), meta_valor_total: num(form.meta_valor_total),
      });
      setShowModal(false); fetchData();
    } catch (e: any) { setError(e?.response?.data?.message || 'Erro ao salvar'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleteError('');
    try { await apiClient.deleteMeta(id); fetchData(); } catch (e: any) {
      setDeleteError(e?.response?.data?.message || 'Erro ao remover meta.');
    }
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" style={{ width: 48, height: 48, color: 'var(--t-primary)' }} />
      </div>
    );
  }

  const rotuloPeriodo = filtroPeriodo === 'TODOS' ? 'Todos os períodos'
    : /^\d{4}$/.test(filtroPeriodo) ? `Ano de ${filtroPeriodo}`
    : (() => { const [y, m] = filtroPeriodo.split('-'); return `${MESES[Number(m) - 1]} / ${y}`; })();

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-3 md:p-5 space-y-4">
        {/* Capa */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--t-primary-dark), var(--t-primary))' }}>
          <div className="px-5 py-5 text-white flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-[.2em] uppercase" style={{ color: 'rgba(255,255,255,.7)' }}>Performance · Prosystem</p>
              <h1 className="text-2xl md:text-3xl font-extrabold mt-1">Metas Comerciais</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,.85)' }}>{rotuloPeriodo} · evolução automática pelos fechamentos.</p>
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                nome="metas" titulo="Metas Comerciais — ProSystem CRM" linhas={metasDoPeriodo}
                colunas={[
                  { header: 'Título', value: (m: Meta) => m.titulo },
                  { header: 'Período', value: (m: Meta) => m.periodo },
                  { header: 'Responsáveis', value: (m: Meta) => ((m.responsaveis_ids?.length ? m.responsaveis_ids : [m.responsavel_id]).map(nomeUsuario).join(', ')) },
                  { header: 'Meta contratos', value: (m: Meta) => m.meta_contratos ?? '' },
                  { header: 'Realizado contratos', value: (m: Meta) => m.realizado?.contratos ?? 0 },
                  { header: 'Meta total (R$)', value: (m: Meta) => m.meta_valor_total ?? '' },
                  { header: 'Realizado total (R$)', value: (m: Meta) => m.realizado?.valor_total ?? 0 },
                ]}
              />
              {isGestor && (
                <button onClick={() => { setForm({ ...emptyForm, periodo: /^\d{4}-\d{2}$/.test(filtroPeriodo) ? filtroPeriodo : periodoAtual() }); setError(''); setShowModal(true); }}
                  className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg text-sm font-semibold border border-white/20 flex items-center gap-1.5">
                  <Plus size={14} /> Nova Meta
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Seletor de período */}
        <div className="flex gap-2 flex-wrap items-center">
          {periodosDisponiveis.map(p => {
            const lbl = /^\d{4}$/.test(p) ? p : (() => { const [y, m] = p.split('-'); return `${MESES[Number(m) - 1]}/${String(y).slice(2)}`; })();
            return (
              <button key={p} onClick={() => setFiltroPeriodo(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroPeriodo === p ? 'text-white' : 'border hover:opacity-80'}`}
                style={filtroPeriodo === p
                  ? { background: 'var(--t-primary)' }
                  : { background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
                {lbl}
              </button>
            );
          })}
          <button onClick={() => setFiltroPeriodo('TODOS')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroPeriodo === 'TODOS' ? 'text-white' : 'border hover:opacity-80'}`}
            style={filtroPeriodo === 'TODOS'
              ? { background: 'var(--t-primary-dark)' }
              : { background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-secondary)' }}>
            Todos
          </button>

          {isGestor && vendedorasFiltro.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs font-semibold" style={{ color: 'var(--t-text-muted)' }}>Vendedor:</span>
              <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm border"
                style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}>
                <option value="">Todos</option>
                {vendedorasFiltro.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        {deleteError && (
          <div className="p-3 rounded-lg border text-sm" style={{ background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', color: '#dc2626' }}>
            {deleteError}
          </div>
        )}

        {dataLoading ? (
          <div className="text-center py-16" style={{ color: 'var(--t-text-muted)' }}>Carregando…</div>
        ) : (
          <>
            {/* Evolução anual */}
            {serie?.meses?.length > 0 && (
              <div className="ps-card rounded-2xl p-4" style={{ border: '1px solid var(--t-card-border)' }}>
                <h2 className="text-sm font-bold uppercase mb-3 flex items-center gap-1.5" style={{ color: 'var(--t-primary-dark)' }}>
                  <TrendingUp size={14} /> Evolução do ano ({serie.ano}) — equipe
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={serie.meses} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef3f9" />
                    <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any, n: any) => n === 'Setup' ? fmtBRL(v) : v} />
                    <Legend />
                    <Bar yAxisId="l" dataKey="contratos" name="Contratos" fill="var(--t-primary)" radius={[4, 4, 0, 0]} animationDuration={900} />
                    <Line yAxisId="r" type="monotone" dataKey="setup_total" name="Setup" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} animationDuration={1100} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Donut + Ranking */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="ps-card rounded-2xl p-4" style={{ border: '1px solid var(--t-card-border)' }}>
                <h2 className="text-sm font-bold uppercase mb-2 flex items-center gap-1.5" style={{ color: 'var(--t-primary-dark)' }}>
                  <Target size={14} /> Meta de contratos — {rotuloPeriodo}
                </h2>
                {agregado.metaContratos > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={210}>
                      <PieChart>
                        <Pie dataKey="value" data={[
                          { name: 'Realizado', value: Math.min(agregado.realContratos, agregado.metaContratos) },
                          { name: 'Faltante', value: Math.max(0, agregado.metaContratos - agregado.realContratos) },
                        ]} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} animationDuration={900}>
                          <Cell fill="var(--t-primary)" /><Cell fill="#e5e7eb" />
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <p className="text-center text-sm -mt-2" style={{ color: 'var(--t-text-secondary)' }}>
                      <b className="text-lg" style={{ color: 'var(--t-primary)' }}>{agregado.realContratos}</b> de <b>{agregado.metaContratos}</b> contratos
                      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(65,122,188,0.10)', color: 'var(--t-primary-dark)' }}>
                        {agregado.metaContratos ? Math.round((agregado.realContratos / agregado.metaContratos) * 100) : 0}%
                      </span>
                    </p>
                  </>
                ) : <p className="text-center py-12 text-sm" style={{ color: 'var(--t-text-muted)' }}>Sem meta de contratos definida neste período.</p>}
              </div>

              <div className="ps-card rounded-2xl p-4" style={{ border: '1px solid var(--t-card-border)' }}>
                <h2 className="text-sm font-bold uppercase mb-2 flex items-center gap-1.5" style={{ color: 'var(--t-primary-dark)' }}>
                  <Users size={14} /> Ranking do período
                </h2>
                {mesSerie?.por_vendedora?.some((v: any) => v.contratos > 0) ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart layout="vertical" data={[...mesSerie.por_vendedora].filter((v: any) => !filtroVendedor || v.id === filtroVendedor).sort((a: any, b: any) => b.contratos - a.contratos).map((v: any) => ({ nome: (v.nome || '').split(' ')[0], Contratos: v.contratos }))}
                      margin={{ top: 5, right: 16, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef3f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 12 }} width={70} />
                      <Tooltip />
                      <Bar dataKey="Contratos" radius={[0, 4, 4, 0]} animationDuration={900}>
                        {mesSerie.por_vendedora.map((_: any, i: number) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center py-12 text-sm" style={{ color: 'var(--t-text-muted)' }}>{filtroPeriodo === 'TODOS' || /^\d{4}$/.test(filtroPeriodo) ? 'Selecione um mês para ver o ranking.' : 'Nenhum fechamento neste mês ainda.'}</p>}
              </div>
            </div>

            {/* Cards de metas */}
            {metasDoPeriodo.length === 0 ? (
              <div className="ps-card rounded-2xl p-12 text-center" style={{ border: '1px solid var(--t-card-border)' }}>
                <Target size={40} className="mx-auto mb-3" style={{ color: 'var(--t-text-muted)' }} />
                <p style={{ color: 'var(--t-text-secondary)' }}>Nenhuma meta para {rotuloPeriodo}.</p>
                {isGestor && (
                  <button onClick={() => { setForm({ ...emptyForm, periodo: /^\d{4}-\d{2}$/.test(filtroPeriodo) ? filtroPeriodo : periodoAtual() }); setShowModal(true); }}
                    className="mt-4 px-4 py-2 text-white rounded-lg text-sm flex items-center gap-1.5 mx-auto"
                    style={{ background: 'var(--t-primary)' }}>
                    <Plus size={14} /> Criar meta deste período
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metasDoPeriodo.map(meta => {
                  const rz = meta.realizado || { contratos: 0, valor_total: 0, mrr_total: 0, preco_medio_inst: 0, preco_medio_mensal: 0 };
                  const metaContr = meta.meta_contratos || 0;
                  const pctContr = metaContr > 0 ? Math.min(100, (rz.contratos / metaContr) * 100) : 0;
                  const alvoValor = meta.meta_valor_total ?? meta.valor_alvo ?? 0;
                  const pctValor = alvoValor > 0 ? Math.min(100, (rz.valor_total / alvoValor) * 100) : 0;
                  const responsaveis = (meta.responsaveis_ids?.length ? meta.responsaveis_ids : [meta.responsavel_id]);
                  const corBarra = (p: number) => p >= 100 ? '#16a34a' : p >= 70 ? '#d97706' : 'var(--t-primary)';
                  return (
                    <div key={meta.id} className="ps-card rounded-2xl p-5" style={{ border: '1px solid var(--t-card-border)' }}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>{meta.titulo}</p>
                          <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{meta.periodo} · {meta.modo === 'EQUIPE' ? 'Equipe' : 'Individual'}</p>
                        </div>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: `${corBarra(pctContr || pctValor)}1a`, color: corBarra(pctContr || pctValor) }}>
                          {Math.round(pctContr || pctValor)}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {responsaveis.map(id => (
                          <span key={id} className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(65,122,188,0.10)', color: 'var(--t-text-secondary)' }}>
                            {nomeUsuario(id)}
                          </span>
                        ))}
                      </div>

                      {metaContr > 0 && (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--t-text-muted)' }}>
                            <span>Contratos: <b style={{ color: 'var(--t-text-primary)' }}>{rz.contratos}</b> / {metaContr}</span>
                            <span>{Math.round(pctContr)}%</span>
                          </div>
                          <div className="w-full rounded-full h-2.5" style={{ background: 'var(--t-content-bg)' }}>
                            <div className="h-2.5 rounded-full transition-all" style={{ width: `${pctContr}%`, background: corBarra(pctContr) }} />
                          </div>
                        </div>
                      )}
                      {alvoValor > 0 && (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--t-text-muted)' }}>
                            <span>Setup: <b style={{ color: 'var(--t-text-primary)' }}>{fmtBRL(rz.valor_total)}</b> / {fmtBRL(alvoValor)}</span>
                            <span>{Math.round(pctValor)}%</span>
                          </div>
                          <div className="w-full rounded-full h-2.5" style={{ background: 'var(--t-content-bg)' }}>
                            <div className="h-2.5 rounded-full transition-all" style={{ width: `${pctValor}%`, background: corBarra(pctValor) }} />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg p-2" style={{ background: 'var(--t-content-bg)' }}>
                          <p style={{ color: 'var(--t-text-muted)' }}>Ticket setup (real)</p>
                          <p className="font-bold" style={{ color: 'var(--t-text-primary)' }}>
                            {fmtBRL(rz.preco_medio_inst)}<span style={{ color: 'var(--t-text-muted)', fontWeight: 'normal' }}> / {fmtBRL(meta.meta_preco_inst)}</span>
                          </p>
                        </div>
                        <div className="rounded-lg p-2" style={{ background: 'var(--t-content-bg)' }}>
                          <p style={{ color: 'var(--t-text-muted)' }}>Ticket mensal (real)</p>
                          <p className="font-bold" style={{ color: 'var(--t-text-primary)' }}>
                            {fmtBRL(rz.preco_medio_mensal)}<span style={{ color: 'var(--t-text-muted)', fontWeight: 'normal' }}> / {fmtBRL(meta.meta_preco_mensal)}</span>
                          </p>
                        </div>
                      </div>

                      {isGestor && <div className="flex justify-end mt-2"><button onClick={() => handleDelete(meta.id)} className="text-red-400 hover:text-red-600 text-xs">Excluir</button></div>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'var(--t-card-bg)' }}>
            <h2 className="text-xl font-bold mb-5" style={{ color: 'var(--t-text-primary)' }}>Nova Meta Comercial</h2>
            {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626' }}>{error}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>Título *</label>
                <input value={form.titulo} onChange={e => setForm((p: any) => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Meta de fechamento — Junho"
                  className="w-full px-3 py-2 rounded-lg outline-none text-sm focus:ring-2"
                  style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>
                  Responsável(is) * <span style={{ color: 'var(--t-text-muted)', fontWeight: 'normal' }}>— a meta só aparece para os selecionados</span>
                </label>
                <div className="max-h-40 overflow-y-auto rounded-lg p-2 space-y-1" style={{ border: '1px solid var(--t-card-border)' }}>
                  {usuarios.length === 0 && <p className="text-xs p-1" style={{ color: 'var(--t-text-muted)' }}>Carregando usuários...</p>}
                  {usuarios.map(u => (
                    <label key={u.id} className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:opacity-80">
                      <input type="checkbox" checked={(form.responsaveis_ids || []).includes(u.id)} onChange={() => toggleResponsavel(u.id)} />
                      <span className="text-sm" style={{ color: 'var(--t-text-primary)' }}>{u.nome}</span>
                      {u.cargo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(65,122,188,0.10)', color: 'var(--t-text-muted)' }}>
                          {cargoLabel(u.cargo)}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>Modo</label>
                  <select value={form.modo} onChange={e => setForm((p: any) => ({ ...p, modo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                    style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }}>
                    <option value="INDIVIDUAL">Individual (mesma meta p/ cada um)</option>
                    <option value="EQUIPE">Equipe (meta somada do grupo)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>Período</label>
                  <select value={form.periodo_tipo} onChange={e => setForm((p: any) => ({ ...p, periodo_tipo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                    style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }}>
                    <option value="MENSAL">Mensal</option><option value="ANUAL">Anual</option><option value="PERIODO">Período (datas)</option>
                  </select>
                </div>
              </div>
              {form.periodo_tipo === 'MENSAL' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>Mês/Ano</label>
                  <input type="month" value={form.periodo} onChange={e => setForm((p: any) => ({ ...p, periodo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                    style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                </div>
              )}
              {form.periodo_tipo === 'ANUAL' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>Ano</label>
                  <input type="number" value={form.ano} onChange={e => setForm((p: any) => ({ ...p, ano: e.target.value }))} placeholder="2026"
                    className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                    style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                </div>
              )}
              {form.periodo_tipo === 'PERIODO' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>Início</label>
                    <input type="date" value={form.data_inicio} onChange={e => setForm((p: any) => ({ ...p, data_inicio: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>Fim</label>
                    <input type="date" value={form.data_fim} onChange={e => setForm((p: any) => ({ ...p, data_fim: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                  </div>
                </div>
              )}
              <div className="pt-2" style={{ borderTop: '1px solid var(--t-card-border)' }}>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--t-text-muted)' }}>Alvos da meta</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>Total de contratos</label>
                    <input type="number" value={form.meta_contratos} onChange={e => setForm((p: any) => ({ ...p, meta_contratos: e.target.value }))} placeholder="Ex: 10"
                      className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>Total em valores (R$)</label>
                    <input type="number" value={form.meta_valor_total} onChange={e => setForm((p: any) => ({ ...p, meta_valor_total: e.target.value }))} placeholder="Ex: 50000"
                      className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>Preço médio instalação (R$)</label>
                    <input type="number" value={form.meta_preco_inst} onChange={e => setForm((p: any) => ({ ...p, meta_preco_inst: e.target.value }))} placeholder="Ex: 3000"
                      className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--t-text-secondary)' }}>Preço médio mensalidade (R$)</label>
                    <input type="number" value={form.meta_preco_mensal} onChange={e => setForm((p: any) => ({ ...p, meta_preco_mensal: e.target.value }))} placeholder="Ex: 450"
                      className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                      style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-content-bg)', color: 'var(--t-text-primary)' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg hover:opacity-80"
                style={{ color: 'var(--t-text-secondary)' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.titulo || !(form.responsaveis_ids || []).length}
                className="px-5 py-2 text-white rounded-lg disabled:opacity-50 font-medium"
                style={{ background: 'var(--t-primary)' }}>
                {saving ? 'Salvando...' : 'Salvar Meta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
