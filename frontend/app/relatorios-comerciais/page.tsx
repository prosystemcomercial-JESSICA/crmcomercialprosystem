'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const ANO_INICIO_AUTO = 2026;
const MES_INICIO_AUTO = 6; // junho

const ROLES_PERMITIDOS = ['SUPERVISAO', 'CEO', 'ADMIN'];

type Vendedor = {
  id?: string;
  vendedor_id?: string;
  vendedor_nome: string;
  contatos_realizados?: number | null;
  leads_qualificados?: number | null;
  propostas_enviadas?: number | null;
  contratos_fechados?: number | null;
  mrr_vendido?: number | null;
};

type RelatorioMes = {
  id?: string;
  ano: number;
  mes: number;
  fonte: 'MANUAL' | 'AUTO' | null;
  meta_contratos?: number;
  contratos_fechados?: number | null;
  propostas_pipeline?: number | null;
  mrr_potencial?: number | null;
  mrr_novo?: number | null;
  ticket_medio?: number | null;
  cancelamentos?: number | null;
  mrr_perdido?: number | null;
  motivos_cancelamento?: string | null;
  observacoes?: string | null;
  vendedores?: Vendedor[];
};

function fmt(v: number | null | undefined, prefix = 'R$ ') {
  if (v == null || v === 0) return '—';
  return `${prefix}${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(fechados: number | null | undefined, meta: number | undefined = 10) {
  if (!fechados) return '—';
  return `${Math.round((fechados / meta) * 100)}%`;
}

function isAutoDisponivel(ano: number, mes: number) {
  return ano > ANO_INICIO_AUTO || (ano === ANO_INICIO_AUTO && mes >= MES_INICIO_AUTO);
}

const emptyVendedor = (): Vendedor => ({
  vendedor_nome: '',
  contatos_realizados: null,
  leads_qualificados: null,
  propostas_enviadas: null,
  contratos_fechados: null,
  mrr_vendido: null
});

export default function RelatoriosComerciaisPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  const [ano, setAno] = useState(2026);
  const [meses, setMeses] = useState<RelatorioMes[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [mesAberto, setMesAberto] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<RelatorioMes | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  const podeAcessar = !loading && isAuthenticated && user && ROLES_PERMITIDOS.includes(user.role);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/');
    if (!loading && isAuthenticated && user && !ROLES_PERMITIDOS.includes(user.role)) router.push('/dashboard');
  }, [isAuthenticated, loading, user]);

  const carregarMeses = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await apiClient.client.get(`/relatorios-comerciais/${ano}`);
      setMeses(res.data.data || []);
    } catch {
      setMeses(Array.from({ length: 12 }, (_, i) => ({ ano, mes: i + 1, fonte: null })));
    } finally {
      setLoadingData(false);
    }
  }, [ano]);

  useEffect(() => { if (podeAcessar) carregarMeses(); }, [podeAcessar, carregarMeses]);

  useEffect(() => {
    if (!podeAcessar) return;
    apiClient.client.get('/relatorios-comerciais/analytics/dados')
      .then(r => setAnalytics(r.data.data))
      .catch(() => setAnalytics(null));
  }, [podeAcessar]);

  function abrirMes(mes: number) {
    const dados = meses.find(m => m.mes === mes) || { ano, mes, fonte: null };
    setMesAberto(mes);
    setForm({ ...dados, vendedores: dados.vendedores?.length ? dados.vendedores : [emptyVendedor(), emptyVendedor()] });
    setEditando(false);
  }

  async function salvarRelatorio() {
    if (!form) return;
    setSaving(true);
    try {
      await apiClient.client.put(`/relatorios-comerciais/${ano}/${form.mes}`, {
        meta_contratos: form.meta_contratos ?? 10,
        contratos_fechados: form.contratos_fechados ?? null,
        propostas_pipeline: form.propostas_pipeline ?? null,
        mrr_potencial: form.mrr_potencial ?? null,
        mrr_novo: form.mrr_novo ?? null,
        ticket_medio: form.ticket_medio ?? null,
        cancelamentos: form.cancelamentos ?? null,
        mrr_perdido: form.mrr_perdido ?? null,
        motivos_cancelamento: form.motivos_cancelamento ?? null,
        observacoes: form.observacoes ?? null,
        vendedores: form.vendedores?.filter(v => v.vendedor_nome.trim()) || []
      });
      await carregarMeses();
      setEditando(false);
    } catch (e) {
      console.warn('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function gerarAutomatico(mes: number) {
    setGenerating(mes);
    try {
      await apiClient.client.post(`/relatorios-comerciais/${ano}/${mes}/gerar`);
      await carregarMeses();
      abrirMes(mes);
    } catch {
      console.warn('Erro ao gerar relatório automático.');
    } finally {
      setGenerating(null);
    }
  }

  function setVendedor(idx: number, campo: keyof Vendedor, valor: any) {
    if (!form) return;
    const novos = [...(form.vendedores || [])];
    novos[idx] = { ...novos[idx], [campo]: valor === '' ? null : valor };
    setForm({ ...form, vendedores: novos });
  }

  function addVendedor() {
    if (!form) return;
    setForm({ ...form, vendedores: [...(form.vendedores || []), emptyVendedor()] });
  }

  function removeVendedor(idx: number) {
    if (!form) return;
    const novos = (form.vendedores || []).filter((_, i) => i !== idx);
    setForm({ ...form, vendedores: novos });
  }

  if (loading || !podeAcessar) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" /></div>;
  }

  const totalContratos = meses.reduce((s, m) => s + (m.contratos_fechados || 0), 0);
  const totalCancelamentos = meses.reduce((s, m) => s + (m.cancelamentos || 0), 0);
  const totalMrrNovo = meses.reduce((s, m) => s + Number(m.mrr_novo || 0), 0);
  const totalMrrPerdido = meses.reduce((s, m) => s + Number(m.mrr_perdido || 0), 0);

  const mesSelecionado = mesAberto ? meses.find(m => m.mes === mesAberto) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Relatório Comercial</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
              Acompanhamento de resultados — Supervisão e CEO
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium" style={{ color: 'var(--t-text-secondary)' }}>Ano:</label>
            <select
              value={ano}
              onChange={e => setAno(parseInt(e.target.value))}
              className="border rounded-lg px-3 py-1.5 text-sm"
              style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}
            >
              {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* KPIs anuais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Contratos Fechados', value: `${totalContratos} / 120`, sub: `${Math.round((totalContratos / 120) * 100)}% da meta anual`, color: 'text-green-600' },
            { label: 'Cancelamentos', value: totalCancelamentos, sub: `Máx. 36/ano`, color: totalCancelamentos > 36 ? 'text-red-600' : 'text-orange-600' },
            { label: 'MRR Novo', value: fmt(totalMrrNovo), sub: 'acumulado no ano', color: 'text-blue-600' },
            { label: 'MRR Perdido', value: fmt(totalMrrPerdido), sub: `Saldo: ${fmt(totalMrrNovo - totalMrrPerdido)}`, color: totalMrrPerdido > 12000 ? 'text-red-600' : 'text-purple-600' }
          ].map(k => (
            <div key={k.label} className="rounded-xl p-4 border" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>{k.label}</p>
              <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabela anual */}
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--t-card-border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>Resultado Mensal {ano}</h2>
            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">Meta: 10 contratos/mês</span>
          </div>

          {loadingData ? (
            <div className="p-10 text-center text-sm" style={{ color: 'var(--t-text-muted)' }}>Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--t-content-bg)', borderBottom: `1px solid var(--t-card-border)` }}>
                    {['Mês','Meta','Fechados','% Meta','Faltaram','Pipeline','MRR Potencial','Cancel.','MRR Perdido','Fonte','Ações'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--t-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {meses.map((m, idx) => {
                    const auto = isAutoDisponivel(ano, m.mes);
                    const temDados = m.fonte !== null;
                    const faltaram = temDados && m.contratos_fechados != null ? Math.max(0, (m.meta_contratos || 10) - m.contratos_fechados) : null;
                    const pctMeta = temDados ? pct(m.contratos_fechados, m.meta_contratos) : '—';
                    const tr70 = temDados && m.contratos_fechados != null && m.meta_contratos ? (m.contratos_fechados / m.meta_contratos) >= 1 : null;

                    return (
                      <tr
                        key={m.mes}
                        className="border-b transition-colors cursor-pointer"
                        style={{ borderColor: 'var(--t-card-border)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--t-content-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                        onClick={() => abrirMes(m.mes)}
                      >
                        <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--t-text-primary)' }}>{MESES[m.mes - 1]}</td>
                        <td className="px-3 py-2.5" style={{ color: 'var(--t-text-secondary)' }}>{m.meta_contratos ?? 10}</td>
                        <td className="px-3 py-2.5 font-semibold" style={{ color: temDados ? 'var(--t-text-primary)' : 'var(--t-text-muted)' }}>
                          {temDados ? (m.contratos_fechados ?? '—') : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {temDados && pctMeta !== '—' ? (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tr70 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{pctMeta}</span>
                          ) : <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: faltaram ? 'var(--t-text-secondary)' : 'var(--t-text-muted)' }}>
                          {faltaram != null ? (faltaram === 0 ? '✓' : `-${faltaram}`) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--t-text-secondary)' }}>{temDados ? (m.propostas_pipeline ?? '—') : '—'}</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--t-text-secondary)' }}>{temDados ? fmt(m.mrr_potencial) : '—'}</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: m.cancelamentos ? 'var(--t-text-secondary)' : 'var(--t-text-muted)' }}>{temDados ? (m.cancelamentos ?? '—') : '—'}</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--t-text-secondary)' }}>{temDados ? fmt(m.mrr_perdido) : '—'}</td>
                        <td className="px-3 py-2.5">
                          {!temDados ? (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-opacity-0 ">sem dados</span>
                          ) : m.fonte === 'AUTO' ? (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">AUTO</span>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">MANUAL</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <button
                              onClick={() => { abrirMes(m.mes); setEditando(true); }}
                              className="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                            >Editar</button>
                            {auto && (
                              <button
                                onClick={() => gerarAutomatico(m.mes)}
                                disabled={generating === m.mes}
                                className="text-xs px-2 py-1 rounded text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                              >{generating === m.mes ? '...' : 'Gerar'}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Linha totais */}
                  <tr style={{ background: 'var(--t-content-bg)', borderTop: `2px solid var(--t-card-border)` }}>
                    <td className="px-3 py-2.5 font-bold text-xs" style={{ color: 'var(--t-text-primary)' }}>TOTAL {ano}</td>
                    <td className="px-3 py-2.5 font-bold text-xs" style={{ color: 'var(--t-text-primary)' }}>120</td>
                    <td className="px-3 py-2.5 font-bold text-xs" style={{ color: 'var(--t-text-primary)' }}>{totalContratos || '—'}</td>
                    <td className="px-3 py-2.5 font-bold text-xs">
                      {totalContratos > 0 && <span className={`px-2 py-0.5 rounded-full ${totalContratos >= 120 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{Math.round((totalContratos / 120) * 100)}%</span>}
                    </td>
                    <td className="px-3 py-2.5 font-bold text-xs" style={{ color: 'var(--t-text-primary)' }}>{totalContratos > 0 ? Math.max(0, 120 - totalContratos) : '—'}</td>
                    <td colSpan={2} className="px-3 py-2.5 text-xs" style={{ color: 'var(--t-text-muted)' }}></td>
                    <td className="px-3 py-2.5 font-bold text-xs" style={{ color: 'var(--t-text-primary)' }}>{totalCancelamentos || '—'}</td>
                    <td className="px-3 py-2.5 font-bold text-xs" style={{ color: 'var(--t-text-primary)' }}>{fmt(totalMrrPerdido)}</td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Nota de rodapé */}
        <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
          Jan–Mai/2026: dados inseridos manualmente. A partir de Jun/2026 o botão "Gerar" calcula automaticamente a partir do CRM.
        </p>

        {/* ===== ANALYTICS / GRÁFICOS ===== */}
        {analytics && (
          <div className="space-y-6 pt-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: 'var(--t-card-border)' }} />
              <h2 className="text-base font-bold px-2" style={{ color: 'var(--t-text-primary)' }}>Análise Comercial — Dados do CRM</h2>
              <div className="h-px flex-1" style={{ background: 'var(--t-card-border)' }} />
            </div>

            {/* Linha 1: Evolução contratos + Evolução cancelamentos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Evolução de Contratos Fechados (12 meses)" sub="Novos contratos por mês">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.evolucao_contratos} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--t-text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--t-text-muted)' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8 }}
                      formatter={(v: any, n: any) => [n === 'mrr' ? `R$ ${Number(v).toLocaleString('pt-BR')}` : v, n === 'mrr' ? 'MRR' : 'Contratos']}
                    />
                    <Bar dataKey="contratos" fill="var(--t-primary)" radius={[4,4,0,0]} name="Contratos" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Cancelamentos por Mês (12 meses)" sub="Contratos cancelados e MRR perdido">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={analytics.cancelados_evolucao} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--t-text-muted)' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--t-text-muted)' }} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--t-text-muted)' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8 }}
                      formatter={(v: any, n: any) => [n === 'mrr_perdido' ? `R$ ${Number(v).toLocaleString('pt-BR')}` : v, n === 'mrr_perdido' ? 'MRR Perdido' : 'Cancelamentos']}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="cancelamentos" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Cancelamentos" />
                    <Line yAxisId="right" type="monotone" dataKey="mrr_perdido" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" name="mrr_perdido" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Linha 2: Origem dos Leads + Conversão por Origem */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Leads por Origem" sub="Volume total por canal de entrada">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.leads_origem} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--t-text-muted)' }} allowDecimals={false} />
                    <YAxis dataKey="nome" type="category" tick={{ fontSize: 11, fill: 'var(--t-text-muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8 }} />
                    <Bar dataKey="total" radius={[0,4,4,0]} name="Leads">
                      {analytics.leads_origem.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Taxa de Conversão por Origem" sub="% de leads convertidos em contratos por canal">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.conversao_por_origem} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                    <XAxis dataKey="nome" tick={{ fontSize: 10, fill: 'var(--t-text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--t-text-muted)' }} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8 }}
                      formatter={(v: any) => [`${v}%`, 'Taxa de conversão']}
                    />
                    <Bar dataKey="taxa" radius={[4,4,0,0]} name="Conversão">
                      {analytics.conversao_por_origem.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Linha 3: Pipeline por Etapa + Leads por Temperatura */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Pipeline por Etapa do Funil" sub="Leads ativos por fase — quantidade e valor estimado">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={analytics.leads_etapa} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                    <XAxis dataKey="etapa" tick={{ fontSize: 9, fill: 'var(--t-text-muted)' }} angle={-30} textAnchor="end" />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--t-text-muted)' }} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--t-text-muted)' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8 }}
                      formatter={(v: any, n: any) => [n === 'valor' ? `R$ ${Number(v).toLocaleString('pt-BR')}` : v, n === 'valor' ? 'Valor Est.' : 'Leads']}
                    />
                    <Bar yAxisId="left" dataKey="count" fill="var(--t-primary)" radius={[4,4,0,0]} name="Leads" />
                    <Bar yAxisId="right" dataKey="valor" fill="#a78bfa" radius={[4,4,0,0]} name="valor" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Leads por Temperatura" sub="Distribuição de leads ativos por temperatura">
                <div className="flex items-center justify-center h-[220px]">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={analytics.leads_temperatura}
                        dataKey="total"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={45}
                        paddingAngle={3}
                        label={({ nome, percent }: any) => `${nome} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {analytics.leads_temperatura.map((entry: any) => (
                          <Cell key={entry.nome} fill={TEMP_COLORS[entry.nome] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8 }} />
                      <Legend formatter={(v) => <span style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            {/* Linha 4: Propostas por Status + Atividades por Tipo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Propostas por Status" sub="Distribuição atual do portfólio de propostas">
                <div className="flex items-center justify-center h-[220px]">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={analytics.propostas_status}
                        dataKey="total"
                        nameKey="nome"
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                        paddingAngle={2}
                        label={({ nome, total }: any) => `${nome} (${total})`}
                        labelLine={{ stroke: 'var(--t-text-muted)' }}
                      >
                        {analytics.propostas_status.map((entry: any) => (
                          <Cell key={entry.nome} fill={PROPOSTA_COLORS[entry.nome] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8 }}
                        formatter={(v: any, n: any, props: any) => [`${v} proposta${v > 1 ? 's' : ''} · R$ ${Number(props.payload.valor || 0).toLocaleString('pt-BR')}`, n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Atividades por Tipo" sub="Volume de contatos registrados no CRM">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.atividades_tipo} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                    <XAxis dataKey="nome" tick={{ fontSize: 10, fill: 'var(--t-text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--t-text-muted)' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8 }} />
                    <Bar dataKey="total" radius={[4,4,0,0]} name="Atividades">
                      {analytics.atividades_tipo.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Linha 5: Leads por Estado */}
            {analytics.leads_estado?.length > 0 && (
              <ChartCard title="Leads por Estado (Top 8)" sub="Distribuição geográfica dos leads">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.leads_estado} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: 'var(--t-text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--t-text-muted)' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8 }} />
                    <Bar dataKey="total" radius={[4,4,0,0]} name="Leads">
                      {analytics.leads_estado.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Tabela de conversão por origem */}
            <ChartCard title="Análise de Conversão por Canal" sub="Volume, ganhos e taxa de conversão de cada canal de aquisição">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid var(--t-card-border)` }}>
                      {['Canal/Origem','Total Leads','Leads Ganhos','Taxa de Conversão','Eficiência'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold" style={{ color: 'var(--t-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.conversao_por_origem
                      .sort((a: any, b: any) => b.taxa - a.taxa)
                      .map((row: any, i: number) => (
                        <tr key={i} style={{ borderBottom: `1px solid var(--t-card-border)` }}>
                          <td className="px-3 py-2 font-medium text-xs">
                            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            {row.nome}
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ color: 'var(--t-text-secondary)' }}>{row.total}</td>
                          <td className="px-3 py-2 text-xs text-green-600 font-medium">{row.ganhos}</td>
                          <td className="px-3 py-2 text-xs">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--t-card-border)' }}>
                                <div className="h-1.5 rounded-full" style={{ width: `${Math.min(row.taxa, 100)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                              </div>
                              <span className="font-semibold w-10 text-right" style={{ color: 'var(--t-text-primary)' }}>{row.taxa}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.taxa >= 20 ? 'bg-green-100 text-green-700' : row.taxa >= 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {row.taxa >= 20 ? 'Excelente' : row.taxa >= 10 ? 'Médio' : 'Baixo'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </div>
        )}
      </div>

      {/* Modal de detalhe / edição */}
      {mesAberto !== null && form && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setMesAberto(null)}>
          <div
            className="w-full max-w-2xl rounded-2xl shadow-2xl my-8"
            style={{ background: 'var(--t-card-bg)', color: 'var(--t-text-primary)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--t-card-border)' }}>
              <div>
                <h2 className="text-lg font-bold">{MESES[mesAberto - 1]} {ano}</h2>
                {form.fonte && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${form.fonte === 'AUTO' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-700'}`}>
                    {form.fonte === 'AUTO' ? 'Gerado automaticamente' : 'Inserido manualmente'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!editando && (
                  <button
                    onClick={() => setEditando(true)}
                    className="text-sm px-4 py-2 rounded-lg border transition-colors"
                    style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}
                  >Editar</button>
                )}
                {isAutoDisponivel(ano, mesAberto) && !editando && (
                  <button
                    onClick={() => gerarAutomatico(mesAberto)}
                    disabled={generating === mesAberto}
                    className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >{generating === mesAberto ? 'Gerando...' : 'Gerar do CRM'}</button>
                )}
                <button onClick={() => setMesAberto(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:opacity-80 ">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Resultado principal */}
              <section>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--t-text-muted)' }}>RESULTADO DO MÊS</h3>
                <div className="grid grid-cols-2 gap-3">
                  {editando ? (
                    <>
                      <Field label="Meta contratos" value={form.meta_contratos ?? 10} onChange={v => setForm({...form, meta_contratos: parseInt(v)||10})} type="number" />
                      <Field label="Contratos fechados" value={form.contratos_fechados ?? ''} onChange={v => setForm({...form, contratos_fechados: v===''?null:parseInt(v)})} type="number" />
                      <Field label="Propostas em pipeline" value={form.propostas_pipeline ?? ''} onChange={v => setForm({...form, propostas_pipeline: v===''?null:parseInt(v)})} type="number" />
                      <Field label="MRR potencial (R$)" value={form.mrr_potencial ?? ''} onChange={v => setForm({...form, mrr_potencial: v===''?null:parseFloat(v)})} type="number" />
                      <Field label="MRR novo fechado (R$)" value={form.mrr_novo ?? ''} onChange={v => setForm({...form, mrr_novo: v===''?null:parseFloat(v)})} type="number" />
                      <Field label="Ticket médio (R$)" value={form.ticket_medio ?? ''} onChange={v => setForm({...form, ticket_medio: v===''?null:parseFloat(v)})} type="number" />
                      <Field label="Cancelamentos" value={form.cancelamentos ?? ''} onChange={v => setForm({...form, cancelamentos: v===''?null:parseInt(v)})} type="number" />
                      <Field label="MRR perdido (R$)" value={form.mrr_perdido ?? ''} onChange={v => setForm({...form, mrr_perdido: v===''?null:parseFloat(v)})} type="number" />
                    </>
                  ) : (
                    <>
                      <Kpi label="Meta" value={String(form.meta_contratos ?? 10)} />
                      <Kpi label="Contratos fechados" value={form.contratos_fechados != null ? String(form.contratos_fechados) : '—'} />
                      <Kpi label="% da meta" value={pct(form.contratos_fechados, form.meta_contratos)} accent />
                      <Kpi label="Faltaram" value={form.contratos_fechados != null ? String(Math.max(0, (form.meta_contratos||10) - form.contratos_fechados)) : '—'} />
                      <Kpi label="Propostas em pipeline" value={form.propostas_pipeline != null ? String(form.propostas_pipeline) : '—'} />
                      <Kpi label="MRR potencial" value={fmt(form.mrr_potencial)} />
                      <Kpi label="MRR novo" value={fmt(form.mrr_novo)} />
                      <Kpi label="Ticket médio" value={fmt(form.ticket_medio)} />
                      <Kpi label="Cancelamentos" value={form.cancelamentos != null ? String(form.cancelamentos) : '—'} />
                      <Kpi label="MRR perdido" value={fmt(form.mrr_perdido)} />
                    </>
                  )}
                </div>
              </section>

              {editando && (
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--t-text-muted)' }}>Motivos cancelamento</label>
                    <input value={form.motivos_cancelamento ?? ''} onChange={e => setForm({...form, motivos_cancelamento: e.target.value||null})}
                      className="w-full border rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}
                      placeholder="ex: suporte, concorrência" />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--t-text-muted)' }}>Observações</label>
                    <textarea value={form.observacoes ?? ''} onChange={e => setForm({...form, observacoes: e.target.value||null})}
                      rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}
                      placeholder="Análise do mês..." />
                  </div>
                </div>
              )}

              {!editando && form.motivos_cancelamento && (
                <p className="text-sm" style={{ color: 'var(--t-text-secondary)' }}><strong>Motivos cancel.:</strong> {form.motivos_cancelamento}</p>
              )}
              {!editando && form.observacoes && (
                <p className="text-sm" style={{ color: 'var(--t-text-secondary)' }}>{form.observacoes}</p>
              )}

              {/* Vendedores */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--t-text-muted)' }}>RESULTADO POR VENDEDOR</h3>
                  {editando && (
                    <button onClick={addVendedor} className="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-50">+ Adicionar</button>
                  )}
                </div>

                {(!form.vendedores || form.vendedores.length === 0) ? (
                  <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>Sem dados por vendedor.</p>
                ) : editando ? (
                  <div className="space-y-3">
                    {form.vendedores.map((v, idx) => (
                      <div key={idx} className="border rounded-xl p-3 space-y-2" style={{ borderColor: 'var(--t-card-border)' }}>
                        <div className="flex items-center justify-between">
                          <input value={v.vendedor_nome} onChange={e => setVendedor(idx, 'vendedor_nome', e.target.value)}
                            className="border rounded-lg px-3 py-1.5 text-sm font-medium w-48" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}
                            placeholder="Nome do vendedor" />
                          <button onClick={() => removeVendedor(idx)} className="text-xs text-red-500 hover:text-red-700">Remover</button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <VField label="Contatos" value={v.contatos_realizados ?? ''} onChange={val => setVendedor(idx, 'contatos_realizados', val===''?null:parseInt(val))} />
                          <VField label="Leads qual." value={v.leads_qualificados ?? ''} onChange={val => setVendedor(idx, 'leads_qualificados', val===''?null:parseInt(val))} />
                          <VField label="Propostas" value={v.propostas_enviadas ?? ''} onChange={val => setVendedor(idx, 'propostas_enviadas', val===''?null:parseInt(val))} />
                          <VField label="Contratos" value={v.contratos_fechados ?? ''} onChange={val => setVendedor(idx, 'contratos_fechados', val===''?null:parseInt(val))} />
                          <VField label="MRR (R$)" value={v.mrr_vendido ?? ''} onChange={val => setVendedor(idx, 'mrr_vendido', val===''?null:parseFloat(val))} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: `1px solid var(--t-card-border)` }}>
                          {['Vendedor','Contatos','Leads qual.','Propostas','Contratos','MRR','Taxa qual.'].map(h => (
                            <th key={h} className="px-2 py-1.5 text-left text-xs font-semibold" style={{ color: 'var(--t-text-muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.vendedores.map((v, idx) => {
                          const taxaQual = v.contatos_realizados && v.leads_qualificados
                            ? `${((v.leads_qualificados / v.contatos_realizados) * 100).toFixed(2)}%`
                            : '—';
                          return (
                            <tr key={idx} style={{ borderBottom: `1px solid var(--t-card-border)` }}>
                              <td className="px-2 py-2 font-medium text-xs">{v.vendedor_nome}</td>
                              <td className="px-2 py-2 text-xs">{v.contatos_realizados?.toLocaleString('pt-BR') ?? '—'}</td>
                              <td className="px-2 py-2 text-xs">{v.leads_qualificados ?? '—'}</td>
                              <td className="px-2 py-2 text-xs">{v.propostas_enviadas ?? '—'}</td>
                              <td className="px-2 py-2 text-xs font-semibold">{v.contratos_fechados ?? '—'}</td>
                              <td className="px-2 py-2 text-xs">{fmt(v.mrr_vendido)}</td>
                              <td className="px-2 py-2 text-xs">{taxaQual}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Botões */}
              {editando && (
                <div className="flex justify-end gap-3 pt-2 border-t" style={{ borderColor: 'var(--t-card-border)' }}>
                  <button onClick={() => setEditando(false)} className="px-4 py-2 text-sm border rounded-lg transition-colors" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }}>Cancelar</button>
                  <button onClick={salvarRelatorio} disabled={saving}
                    className="px-6 py-2 text-sm rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                    style={{ background: 'var(--t-primary)' }}>
                    {saving ? 'Salvando...' : 'Salvar relatório'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ===== Chart helpers =====

const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16'];

const TEMP_COLORS: Record<string, string> = {
  FRIO: '#93c5fd',
  MORNO: '#fbbf24',
  QUENTE: '#ef4444'
};

const PROPOSTA_COLORS: Record<string, string> = {
  RASCUNHO: '#94a3b8',
  ENVIADA: '#3b82f6',
  VISUALIZADA: '#8b5cf6',
  ACEITA: '#10b981',
  RECUSADA: '#ef4444',
  EXPIRADA: '#f97316'
};

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)' }}>
      <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--t-text-primary)' }}>{title}</p>
      {sub && <p className="text-xs mb-4" style={{ color: 'var(--t-text-muted)' }}>{sub}</p>}
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1" style={{ color: 'var(--t-text-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }} />
    </div>
  );
}

function VField({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs block mb-0.5" style={{ color: 'var(--t-text-muted)' }}>{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-full border rounded px-2 py-1 text-xs" style={{ background: 'var(--t-card-bg)', borderColor: 'var(--t-card-border)', color: 'var(--t-text-primary)' }} />
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg p-3 border" style={{ background: 'var(--t-content-bg)', borderColor: 'var(--t-card-border)' }}>
      <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{label}</p>
      <p className={`text-base font-bold mt-0.5 ${accent ? 'text-blue-600' : ''}`} style={accent ? {} : { color: 'var(--t-text-primary)' }}>{value}</p>
    </div>
  );
}
