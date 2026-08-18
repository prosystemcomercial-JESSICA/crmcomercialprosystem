'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, Legend, ComposedChart, Line, Area,
} from 'recharts';
import {
  Calendar, Printer, TrendingUp, ArrowUpRight, ArrowDownRight, Scale,
  CheckCircle2, XCircle, PlusCircle, Wallet, Handshake, Radar, Users2, ChevronDown,
} from 'lucide-react';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v: any) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

// Paleta semântica do relatório — todas via tokens do design system (ver DESIGN.md),
// nunca hex solto. Verde/vermelho/âmbar aqui são estado real (ganho/perda/atenção),
// não decoração — ver "The Status Color Reserve Rule".
const SEM = {
  ganho: 'var(--t-success, #16A34A)',
  perda: 'var(--t-error)',
  atencao: 'var(--t-gold, #B4791B)',
  neutro: 'var(--t-text-muted)',
};

// Bloco: card com cabeçalho e número de seção opcional. Numeração é responsabilidade
// exclusiva do componente pai (array SECOES_SECUNDARIAS) — nunca hardcoded no título.
function Bloco({ titulo, icone: Icone, num, children, aberto = true, contador }: {
  titulo: string; icone?: any; num?: number; children: any; aberto?: boolean; contador?: number;
}) {
  const [open, setOpen] = useState(aberto);
  return (
    <div className="ps-card rounded-2xl mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2.5 px-5 py-3.5 text-left"
        style={{ borderBottom: open ? '1px solid var(--t-card-border)' : 'none' }}
      >
        <span className="flex items-center gap-2.5">
          {typeof num === 'number' && (
            <span
              className="flex items-center justify-center text-xs font-bold rounded-md flex-shrink-0"
              style={{ width: 22, height: 22, background: 'var(--t-primary)', color: 'var(--t-text-inverse)' }}
            >
              {num}
            </span>
          )}
          {Icone && <Icone size={16} style={{ color: 'var(--t-primary-dark)' }} />}
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--t-primary-dark)' }}>
            {titulo}
          </h2>
          {typeof contador === 'number' && (
            <span className="text-xs font-medium" style={{ color: 'var(--t-text-muted)' }}>({contador})</span>
          )}
        </span>
        <ChevronDown size={16} style={{ color: 'var(--t-text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && <div className="p-5 pt-4">{children}</div>}
    </div>
  );
}

// KPI: card com faixa lateral de cor semântica, rótulo e número grande.
function KPI({ label, valor, tom = 'neutro' }: { label: string; valor: any; tom?: keyof typeof SEM }) {
  const cor = SEM[tom];
  return (
    <div className="rounded-xl p-3.5 relative overflow-hidden" style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)' }}>
      <span className="absolute left-0 top-0 bottom-0" style={{ width: 3, background: cor }} />
      <p className="text-[11px] font-medium pl-2" style={{ color: 'var(--t-text-muted)' }}>{label}</p>
      <p className="text-xl font-extrabold pl-2 mt-0.5" style={{ color: cor === SEM.neutro ? 'var(--t-text-primary)' : cor }}>{valor}</p>
    </div>
  );
}

export default function RelatorioComercialPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [d, setD] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [serie, setSerie] = useState<any[]>([]); // evolução mês a mês do ano
  const [sensor, setSensor] = useState<any>(null); // Sensor de Mercado (Task 8)
  const [sdrs, setSdrs] = useState<any[]>([]); // Desempenho comparativo por SDR (Task 8)

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading]);

  const load = useCallback(async () => {
    setDataLoading(true);
    setLoadError(false);
    try {
      const r = await apiClient.getRelatorioComercial(ano, mes);
      setD(r.data.data);
    } catch (e) {
      console.error(e);
      setD(null);
      setLoadError(true);
    } finally {
      setDataLoading(false);
    }
  }, [ano, mes]);
  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated, load]);
  // Série anual (evolução) — recarrega ao trocar o ano.
  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.getRelatorioSerieAnual(ano).then(r => setSerie(r.data?.data?.serie || [])).catch(() => setSerie([]));
  }, [isAuthenticated, ano]);
  // Sensor de Mercado + comparativo de SDRs (Task 8) — mesmo período selecionado
  // (ano inteiro quando mes=0, senão o mês específico).
  useEffect(() => {
    if (!isAuthenticated) return;
    const dataInicio = mes === 0 ? new Date(ano, 0, 1) : new Date(ano, mes - 1, 1);
    const dataFim = mes === 0 ? new Date(ano, 11, 31, 23, 59, 59) : new Date(ano, mes, 0, 23, 59, 59);
    const iso = (dt: Date) => dt.toISOString();
    apiClient.getRelatorioSensorMercado(iso(dataInicio), iso(dataFim)).then(r => setSensor(r.data?.data || null)).catch(() => setSensor(null));
    apiClient.getRelatorioSdrs(iso(dataInicio), iso(dataFim)).then(r => setSdrs(r.data?.data || [])).catch(() => setSdrs([]));
  }, [isAuthenticated, ano, mes]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--t-content-bg)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--t-primary)' }} />
      </div>
    );
  }

  // Tudo vem dos dados REAIS (metricas): capa e números do mês usam a MESMA fonte
  // (fechamentos por data_aceite no mês), então sempre batem entre si.
  const mt = d?.metricas;
  const rContratos = mt ? mt.fechamentos.total : (d?.contratos_fechados || 0);
  const rMrr = mt ? mt.fechamentos.mrr_total : (d?.mrr_total || 0);
  const rPerdidos = mt ? mt.perdidos.total : (d?.cancelamentos || 0);
  const rMrrPerdido = mt ? mt.perdidos.mrr_perdido_total : (d?.mrr_perdido || 0);
  // Meta de contratos: mensal vem de d.meta_contratos (fallback 10 = equipe).
  // No relatório ANUAL (mes=0), a meta é a mensal × 12.
  const metaMensal = d?.meta_contratos || 10;
  const metaContratos = mes === 0 ? metaMensal * 12 : metaMensal;
  const metaPct = metaContratos ? Math.round((rContratos / metaContratos) * 100) : 0;
  const mrrLiquido = Number(rMrr) - Number(rMrrPerdido);
  // Sufixo dos títulos: "do ano" no anual, "do mês" no mensal.
  const sufPeriodo = mes === 0 ? 'do ano' : 'do mês';
  const SufPeriodo = mes === 0 ? 'do Ano' : 'do Mês';

  return (
    <DashboardLayout>
      {/* Impressão executiva A4: cores fiéis, esconde o que tem print:hidden, evita
          cortar cards no meio da página, e expande tudo (mesmo seções colapsadas
          na tela) já que impressão é leitura linear, não navegação. */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
          .rel-bloco { break-inside: avoid; page-break-inside: avoid; box-shadow: none !important; }
          .rel-bloco-conteudo { display: block !important; }
          aside, nav, header { display: none !important; }
        }
      `}</style>
      <div className="space-y-3 max-w-4xl mx-auto">
        {/* Cabeçalho + seletor + imprimir */}
        <div className="flex items-start justify-between gap-3 flex-wrap print:hidden">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Relatório Comercial</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--t-text-muted)' }}>Resultados {sufPeriodo} — visão executiva para a diretoria</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--t-text-muted)' }} />
              <select
                value={mes} onChange={e => setMes(Number(e.target.value))}
                className="pl-8 pr-3 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }}
              >
                <option value={0}>Ano inteiro</option>
                {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <select
              value={ano} onChange={e => setAno(Number(e.target.value))}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', background: 'var(--t-card-bg)' }}
            >
              {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, var(--t-primary-dark) 0%, var(--t-primary-deep) 100%)' }}
            >
              <Printer size={14} /> Imprimir / PDF
            </button>
          </div>
        </div>

        {dataLoading ? (
          <div className="text-center p-12" style={{ color: 'var(--t-text-muted)' }}>Carregando…</div>
        ) : loadError ? (
          <div className="text-center p-12 rounded-xl" style={{ background: 'var(--t-error-bg)', border: '1px solid var(--t-error-border)' }}>
            <p className="font-semibold" style={{ color: 'var(--t-error)' }}>Não foi possível carregar o relatório.</p>
            <p className="text-sm mt-1" style={{ color: 'var(--t-error)' }}>Tente novamente em instantes. Se persistir, avise o suporte técnico.</p>
            <button onClick={load} className="mt-3 text-sm font-semibold underline" style={{ color: 'var(--t-error)' }}>Tentar novamente</button>
          </div>
        ) : !d ? (
          <div className="text-center p-12" style={{ color: 'var(--t-text-muted)' }}>Sem dados para {mes === 0 ? `${ano}` : `${MESES[mes]}/${ano}`}.</div>
        ) : (
          <div id="relatorio">
            {/* Capa executiva — única fonte dos KPIs de topo (sem duplicar "Visão Geral" abaixo) */}
            <div className="rounded-2xl mb-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--t-primary-dark) 0%, var(--t-primary-deep) 100%)' }}>
              <div className="px-7 py-6" style={{ color: 'var(--t-text-inverse)' }}>
                <p className="text-[11px] font-bold tracking-[.2em] uppercase" style={{ color: 'color-mix(in srgb, var(--t-text-inverse) 70%, transparent)' }}>Relatório Comercial · Prosystem</p>
                <h2 className="text-2xl font-extrabold mt-1">Resultados de {mes === 0 ? `${ano} (ano inteiro)` : `${MESES[mes]} / ${ano}`}</h2>
                <p className="text-sm mt-1" style={{ color: 'color-mix(in srgb, var(--t-text-inverse) 85%, transparent)' }}>Visão executiva para a diretoria{d.supervisor ? ` · Supervisora: ${d.supervisor}` : ''}</p>

                {mt && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                    <div className="rounded-xl px-3.5 py-3" style={{ background: 'color-mix(in srgb, var(--t-text-inverse) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--t-text-inverse) 18%, transparent)' }}>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'color-mix(in srgb, var(--t-text-inverse) 75%, transparent)' }}>Contratos fechados</p>
                      <p className="text-xl font-extrabold mt-0.5">{rContratos}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'color-mix(in srgb, var(--t-text-inverse) 65%, transparent)' }}>{metaPct}% da meta ({metaContratos})</p>
                    </div>
                    <div className="rounded-xl px-3.5 py-3" style={{ background: 'color-mix(in srgb, var(--t-text-inverse) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--t-text-inverse) 18%, transparent)' }}>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'color-mix(in srgb, var(--t-text-inverse) 75%, transparent)' }}>MRR ganho</p>
                      <p className="text-xl font-extrabold mt-0.5">{fmt(rMrr)}</p>
                    </div>
                    <div className="rounded-xl px-3.5 py-3" style={{ background: 'color-mix(in srgb, var(--t-text-inverse) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--t-text-inverse) 18%, transparent)' }}>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'color-mix(in srgb, var(--t-text-inverse) 75%, transparent)' }}>Clientes perdidos</p>
                      <p className="text-xl font-extrabold mt-0.5">{rPerdidos}</p>
                    </div>
                    <div className="rounded-xl px-3.5 py-3" style={{ background: 'color-mix(in srgb, var(--t-text-inverse) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--t-text-inverse) 18%, transparent)' }}>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'color-mix(in srgb, var(--t-text-inverse) 75%, transparent)' }}>Saldo MRR líquido</p>
                      <p className="text-xl font-extrabold mt-0.5">{mrrLiquido >= 0 ? '+' : ''}{fmt(mrrLiquido)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {mt && (
              <>
                {/* Entrada × Saída — o número que mais importa depois da capa: quem entrou vs. quem saiu */}
                <Bloco titulo={`Entrada × Saída ${SufPeriodo}`} icone={Scale} aberto>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="rounded-xl p-4" style={{ background: 'var(--t-success-bg, #F0FDF4)', border: '1px solid color-mix(in srgb, var(--t-success, #16A34A) 30%, transparent)' }}>
                      <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: SEM.ganho }}><ArrowUpRight size={13} /> ENTRADA</p>
                      <p className="text-2xl font-extrabold mt-1" style={{ color: SEM.ganho }}>+{mt.entrada_x_saida.clientes_entrada} clientes</p>
                      <p className="text-sm" style={{ color: SEM.ganho }}>{fmt(mt.entrada_x_saida.mrr_entrada)}/mês de MRR</p>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: 'var(--t-error-bg)', border: '1px solid color-mix(in srgb, var(--t-error) 30%, transparent)' }}>
                      <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: SEM.perda }}><ArrowDownRight size={13} /> SAÍDA</p>
                      <p className="text-2xl font-extrabold mt-1" style={{ color: SEM.perda }}>-{mt.entrada_x_saida.clientes_saida} clientes</p>
                      <p className="text-sm" style={{ color: SEM.perda }}>{fmt(mt.entrada_x_saida.mrr_saida)}/mês de MRR</p>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: 'var(--t-primary-light)', border: '1px solid var(--t-primary-border)' }}>
                      <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--t-primary-dark)' }}><Scale size={13} /> SALDO</p>
                      <p className="text-2xl font-extrabold mt-1" style={{ color: 'var(--t-primary-dark)' }}>
                        {mt.entrada_x_saida.saldo_clientes >= 0 ? '+' : ''}{mt.entrada_x_saida.saldo_clientes} clientes
                      </p>
                      <p className="text-sm" style={{ color: 'var(--t-primary-dark)' }}>{mt.entrada_x_saida.saldo_mrr >= 0 ? '+' : ''}{fmt(mt.entrada_x_saida.saldo_mrr)}/mês</p>
                    </div>
                  </div>
                  {(() => {
                    const e = mt.entrada_x_saida;
                    const dadosClientes = [
                      { name: 'Entrada', value: e.clientes_entrada, fill: '#16a34a' },
                      { name: 'Saída', value: e.clientes_saida, fill: '#dc2626' },
                    ].filter(x => x.value > 0);
                    const dadosMRR = [
                      { name: 'Entrada', MRR: e.mrr_entrada, fill: '#16a34a' },
                      { name: 'Saída', MRR: e.mrr_saida, fill: '#dc2626' },
                    ];
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
                        <div>
                          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--t-text-muted)' }}>Clientes (entrada × saída)</p>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie data={dadosClientes.length ? dadosClientes : [{ name: 'Sem dados', value: 1, fill: '#e5e7eb' }]}
                                dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={78}
                                paddingAngle={3} label={(p: any) => `${p.name}: ${p.value}`}>
                                {(dadosClientes.length ? dadosClientes : [{ fill: '#e5e7eb' }]).map((x: any, i) => <Cell key={i} fill={x.fill} />)}
                              </Pie>
                              <Tooltip /><Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div>
                          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--t-text-muted)' }}>MRR (R$/mês)</p>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={dadosMRR} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                              <Tooltip formatter={(v: any) => fmt(v)} />
                              <Bar dataKey="MRR" radius={[6, 6, 0, 0]} label={{ position: 'top', formatter: (v: any) => fmt(v), fontSize: 11 }}>
                                {dadosMRR.map((x, i) => <Cell key={i} fill={x.fill} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })()}
                </Bloco>

                {/* Números do período — grid único, sem duplicar a capa */}
                <Bloco titulo={`Números ${SufPeriodo}`} icone={TrendingUp} aberto>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KPI label="Leads captados" valor={mt.total_leads} />
                    <KPI label="Ticket médio (setup)" valor={fmt(mt.fechamentos.setup_medio)} />
                    <KPI label="MRR médio" valor={`${fmt(mt.fechamentos.mrr_medio)}/mês`} />
                    <KPI label="Setup total fechado" valor={fmt(mt.fechamentos.setup_total)} tom="ganho" />
                    <KPI label="Mensalidade perdida" valor={`${fmt(mt.perdidos.mrr_perdido_total)}/mês`} tom="perda" />
                    <KPI label="Total de indicações" valor={mt.indicacoes.total} />
                    {mt.vendas_adicionais && (
                      <>
                        <KPI label="Setup (vendas adicionais)" valor={fmt(mt.vendas_adicionais.setup_total)} tom="ganho" />
                        <KPI label="↑ Mensalidade (adicionais)" valor={`+${fmt(mt.vendas_adicionais.acrescimo_mrr_total)}/mês`} />
                      </>
                    )}
                  </div>
                </Bloco>

                {/* Evolução anual — colapsada por padrão, é contexto histórico, não o número do dia */}
                {serie.length > 0 && (
                  <Bloco titulo={`Evolução do Ano (${ano})`} icone={TrendingUp} aberto={false}>
                    <div className="print:hidden rel-bloco-conteudo">
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--t-text-muted)' }}>MRR ganho × perdido e saldo por mês</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <ComposedChart data={serie} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(v: any) => fmt(v)} />
                          <Legend />
                          <Bar dataKey="mrr_ganho" name="MRR ganho" fill="#16a34a" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="mrr_perdido" name="MRR perdido" fill="#dc2626" radius={[4, 4, 0, 0]} />
                          <Line type="monotone" dataKey="saldo_mrr" name="Saldo MRR" stroke="#4B8EC8" strokeWidth={3} dot={{ r: 3 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <p className="text-xs font-semibold mb-1 mt-4" style={{ color: 'var(--t-text-muted)' }}>Fechamentos × Perdidos por mês</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={serie} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Area type="monotone" dataKey="leads" name="Leads" fill="#e0e7ff" stroke="#6366f1" />
                          <Bar dataKey="fechamentos" name="Fechamentos" fill="#16a34a" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="perdidos" name="Perdidos" fill="#dc2626" radius={[4, 4, 0, 0]} />
                          <Line type="monotone" dataKey="indicacoes" name="Indicações" stroke="#0d9488" strokeWidth={2} dot={{ r: 2 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </Bloco>
                )}

                {/* Fechamentos do período — lista de nomes, colapsada (o número já está acima) */}
                {mt.fechamentos.lista.length > 0 && (
                  <Bloco titulo={`Fechamentos ${sufPeriodo}`} icone={CheckCircle2} contador={mt.fechamentos.total} aberto={false}>
                    <div className="rel-bloco-conteudo overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs border-b" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-muted)' }}><th className="py-1.5">Cliente</th><th>Vendedor</th><th className="text-right">Setup</th><th className="text-right">MRR</th></tr></thead>
                        <tbody>{mt.fechamentos.lista.map((f: any, i: number) => (
                          <tr key={i} className="border-b" style={{ borderColor: 'var(--t-card-border)' }}>
                            <td className="py-1.5 font-medium" style={{ color: 'var(--t-text-primary)' }}>{f.cliente}</td>
                            <td style={{ color: 'var(--t-text-secondary)' }}>{f.vendedor}</td>
                            <td className="text-right">{fmt(f.setup)}</td>
                            <td className="text-right font-semibold" style={{ color: SEM.ganho }}>{fmt(f.mrr)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </Bloco>
                )}

                {/* Clientes perdidos — colapsada, o resumo já apareceu em Entrada×Saída */}
                {mt.perdidos.lista.length > 0 && (
                  <Bloco titulo={`Clientes perdidos ${sufPeriodo}`} icone={XCircle} contador={mt.perdidos.total} aberto={false}>
                    <div className="space-y-2 rel-bloco-conteudo">
                      {mt.perdidos.lista.map((c: any, i: number) => (
                        <div key={i} className="rounded-lg p-3" style={{ border: '1px solid var(--t-card-border)', background: 'var(--t-error-bg)' }}>
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <p className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>{c.cliente}</p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
                                Fila/Técnico: <b style={{ color: 'var(--t-text-secondary)' }}>{c.tecnico}</b>
                                {c.data ? ` · Inativado em ${new Date(c.data).toLocaleDateString('pt-BR')}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>MRR perdido</p>
                              <p className="font-bold" style={{ color: SEM.perda }}>{fmt(c.mrr_perdido)}/mês</p>
                              {Number(c.valor_devedor) > 0 && (
                                <p className="text-xs mt-0.5" style={{ color: SEM.atencao }}>Devedor: <b>{fmt(c.valor_devedor)}</b>{c.dias_atraso ? ` (${c.dias_atraso}d)` : ''}</p>
                              )}
                            </div>
                          </div>
                          <p className="text-sm mt-2"><span className="text-xs font-bold uppercase" style={{ color: 'var(--t-text-muted)' }}>Motivo:</span> <span style={{ color: 'var(--t-text-secondary)' }}>{c.motivo}</span>{c.fin_situacao ? <span className="text-xs" style={{ color: SEM.atencao }}> · {c.fin_situacao}</span> : null}</p>
                          {c.resumo && (
                            <p className="text-sm mt-1" style={{ color: 'var(--t-text-secondary)' }}><span className="text-xs font-bold uppercase" style={{ color: 'var(--t-text-muted)' }}>Relato:</span> {c.resumo}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Bloco>
                )}

                {/* Vendas adicionais — resultado SEPARADO: setup entrando + aumento de mensalidade */}
                {(() => {
                  const va = mt.vendas_adicionais;
                  if (!va || va.total === 0) return null;
                  const tipoLabel: Record<string, string> = { INDICACAO: 'Indicações', REVENDA: 'Revendas', COMUNICACAO: 'Comunicação', TROCA_CNPJ: 'Troca de CNPJ' };
                  return (
                    <Bloco titulo={`Vendas adicionais ${sufPeriodo}`} icone={PlusCircle} contador={va.total} aberto={false}>
                      <div className="rel-bloco-conteudo">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <KPI label="Setup entrando" valor={fmt(va.setup_total)} tom="ganho" />
                          <KPI label="Setup médio" valor={fmt(va.setup_medio)} />
                          <KPI label="Aumento de mensalidade" valor={`+${fmt(va.acrescimo_mrr_total)}/mês`} />
                          <KPI label="Aumento médio" valor={`+${fmt(va.acrescimo_medio)}/mês`} />
                        </div>
                        {va.por_tipo?.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm mb-3">
                              <thead><tr className="text-left text-xs border-b" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-muted)' }}><th className="py-1.5">Tipo</th><th className="text-right">Qtd</th><th className="text-right">Setup</th><th className="text-right">Aumento</th></tr></thead>
                              <tbody>{va.por_tipo.map((t: any) => (
                                <tr key={t.tipo} className="border-b" style={{ borderColor: 'var(--t-card-border)' }}>
                                  <td className="py-1.5 font-medium" style={{ color: 'var(--t-text-primary)' }}>{tipoLabel[t.tipo] || t.tipo}</td>
                                  <td className="text-right">{t.qtd}</td>
                                  <td className="text-right" style={{ color: SEM.ganho }}>{fmt(t.setup)}</td>
                                  <td className="text-right">+{fmt(t.acrescimo)}/mês</td>
                                </tr>
                              ))}</tbody>
                              <tfoot><tr className="border-t-2 font-bold" style={{ borderColor: 'var(--t-text-primary)' }}><td className="py-1.5">Total</td><td className="text-right">{va.total}</td><td className="text-right" style={{ color: SEM.ganho }}>{fmt(va.setup_total)}</td><td className="text-right">+{fmt(va.acrescimo_mrr_total)}/mês</td></tr></tfoot>
                            </table>
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead><tr className="text-left text-xs border-b" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-muted)' }}><th className="py-1.5">Cliente</th><th>Parceiro</th><th>Vendedor</th><th className="text-right">Setup</th><th className="text-right">+Mensalidade</th></tr></thead>
                            <tbody>{va.lista.map((v: any, i: number) => (
                              <tr key={i} className="border-b" style={{ borderColor: 'var(--t-card-border)' }}>
                                <td className="py-1.5 font-medium" style={{ color: 'var(--t-text-primary)' }}>{v.cliente}</td>
                                <td style={{ color: 'var(--t-text-secondary)' }}>{v.parceiro}</td>
                                <td style={{ color: 'var(--t-text-muted)' }}>{v.vendedor}</td>
                                <td className="text-right" style={{ color: SEM.ganho }}>{fmt(v.setup)}</td>
                                <td className="text-right">{v.acrescimo > 0 ? `+${fmt(v.acrescimo)}` : '—'}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </div>
                    </Bloco>
                  );
                })()}

                {/* Comissão gerada no mês — vai automaticamente para o Centro de Custos */}
                {(() => {
                  const cg = mt.comissao_gerada;
                  if (!cg || cg.total_geral === 0) return null;
                  return (
                    <Bloco titulo={`Comissão gerada a pagar ${sufPeriodo}`} icone={Wallet} aberto={false}>
                      <div className="rel-bloco-conteudo">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <KPI label="Total gerado" valor={fmt(cg.total_geral)} tom="atencao" />
                          <KPI label="Comissão vendedor" valor={fmt(cg.total_vendedor)} />
                          <KPI label="Comissão supervisão" valor={fmt(cg.total_supervisao)} />
                          <KPI label="Sobre contratos novos" valor={fmt(cg.total_contratos_novos)} tom="ganho" />
                          <KPI label="Sobre vendas adicionais" valor={fmt(cg.total_vendas_adicionais)} />
                        </div>
                        <p className="text-xs mt-3" style={{ color: 'var(--t-text-muted)' }}>
                          Esses valores entram automaticamente como despesa (categoria "Comissão") no Centro de Custos, na competência {sufPeriodo}.
                        </p>
                      </div>
                    </Bloco>
                  );
                })()}

                {/* Indicações / vendas adicionais (nomes) */}
                {mt.indicacoes.lista.length > 0 && (
                  <Bloco titulo={`Indicações ${sufPeriodo}`} icone={Handshake} contador={mt.indicacoes.total} aberto={false}>
                    <div className="overflow-x-auto rel-bloco-conteudo">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs border-b" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-muted)' }}><th className="py-1.5">Cliente</th><th>Parceiro</th><th>Vendedor</th><th>Status</th></tr></thead>
                        <tbody>{mt.indicacoes.lista.map((v: any, i: number) => (
                          <tr key={i} className="border-b" style={{ borderColor: 'var(--t-card-border)' }}>
                            <td className="py-1.5 font-medium" style={{ color: 'var(--t-text-primary)' }}>{v.cliente}</td>
                            <td style={{ color: 'var(--t-text-secondary)' }}>{v.parceiro}</td>
                            <td style={{ color: 'var(--t-text-muted)' }}>{v.vendedor}</td>
                            <td className="text-xs">{v.status}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </Bloco>
                )}
              </>
            )}

            {/* Pipeline geral */}
            <Bloco titulo="Pipeline Geral" num={2} aberto={false}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rel-bloco-conteudo">
                <KPI label="Total propostas" valor={d.propostas_total} />
                <KPI label="Em negociação" valor={d.propostas_negociacao} tom="atencao" />
                <KPI label="Fechadas" valor={d.propostas_fechadas} tom="ganho" />
                <KPI label="Declinadas" valor={d.propostas_declinadas} tom="perda" />
                <KPI label="Setup potencial" valor={fmt(d.setup_potencial)} />
                <KPI label="MRR potencial" valor={`${fmt(d.mrr_potencial)}/mês`} />
                <KPI label="ARR potencial" valor={fmt(Number(d.mrr_potencial || 0) * 12)} />
              </div>
            </Bloco>

            {/* Por vendedor */}
            {Array.isArray(d.por_vendedor) && d.por_vendedor.length > 0 && (
              <Bloco titulo="Pipeline por Vendedor" num={3} aberto={false}>
                <div className="rel-bloco-conteudo">
                  <div className="print:hidden">
                    <ResponsiveContainer width="100%" height={Math.max(160, d.por_vendedor.length * 46)}>
                      <BarChart layout="vertical" data={d.por_vendedor.slice(0, 10).map((v: any) => ({ nome: v.nome, Fechadas: v.fechadas, 'Em negociação': v.em_negociacao }))}
                        margin={{ top: 6, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip /><Legend />
                        <Bar dataKey="Fechadas" fill="#16a34a" radius={[0, 5, 5, 0]} />
                        <Bar dataKey="Em negociação" fill="#4B8EC8" radius={[0, 5, 5, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm mt-3">
                      <thead><tr className="text-left text-xs border-b" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-muted)' }}>
                        <th className="py-2">Vendedor</th><th>Propostas</th><th>Setup pot.</th><th>MRR pot.</th><th>Em neg.</th><th>Fechadas</th><th>Part.</th>
                      </tr></thead>
                      <tbody>
                        {d.por_vendedor.map((v: any, i: number) => (
                          <tr key={i} className="border-b" style={{ borderColor: 'var(--t-card-border)' }}>
                            <td className="py-2 font-medium" style={{ color: 'var(--t-text-primary)' }}>{v.nome}</td><td>{v.propostas}</td><td>{fmt(v.setup_potencial)}</td>
                            <td>{fmt(v.mrr_potencial)}</td><td>{v.em_negociacao}</td><td className="font-semibold" style={{ color: SEM.ganho }}>{v.fechadas}</td><td>{v.participacao}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Bloco>
            )}

            {/* Por segmento */}
            {Array.isArray(d.por_segmento) && d.por_segmento.length > 0 && (
              <Bloco titulo="Pipeline por Segmento" num={4} aberto={false}>
                <div className="rel-bloco-conteudo">
                  <div className="print:hidden mb-3">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                        <Pie data={d.por_segmento.map((s: any) => ({ name: s.segmento, value: Number(s.mrr_total || 0), pct: s.participacao }))}
                          dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                          paddingAngle={2}
                          labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                          label={(p: any) => `${p.name} ${p.pct}%`}>
                          {d.por_segmento.map((_: any, i: number) => {
                            const cores = ['#4B8EC8', '#16a34a', '#d97706', '#7c3aed', '#0d9488', '#dc2626', '#64748b'];
                            return <Cell key={i} fill={cores[i % cores.length]} />;
                          })}
                        </Pie>
                        <Tooltip formatter={(v: any) => `${fmt(v)}/mês`} /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs border-b" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-muted)' }}>
                        <th className="py-2">Segmento</th><th>Propostas</th><th>Setup total</th><th>MRR total</th><th>Ticket MRR</th><th>Part. MRR</th>
                      </tr></thead>
                      <tbody>
                        {d.por_segmento.map((s: any, i: number) => (
                          <tr key={i} className="border-b" style={{ borderColor: 'var(--t-card-border)' }}>
                            <td className="py-2 font-medium" style={{ color: 'var(--t-text-primary)' }}>{s.segmento}</td><td>{s.propostas}</td><td>{fmt(s.setup_total)}</td>
                            <td>{fmt(s.mrr_total)}</td><td>{fmt(s.ticket_mrr)}</td><td>{s.participacao}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Bloco>
            )}

            {/* Contratos fechados */}
            {Array.isArray(d.contratos_lista) && d.contratos_lista.length > 0 && (
              <Bloco titulo="Contratos Fechados" num={5} aberto={false}>
                <div className="overflow-x-auto rel-bloco-conteudo">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs border-b" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-muted)' }}>
                      <th className="py-2">Empresa</th><th>Segmento</th><th>Instalação</th><th>MRR</th><th>Origem</th>
                    </tr></thead>
                    <tbody>
                      {d.contratos_lista.map((c: any, i: number) => (
                        <tr key={i} className="border-b" style={{ borderColor: 'var(--t-card-border)' }}>
                          <td className="py-2 font-medium" style={{ color: 'var(--t-text-primary)' }}>{c.empresa}</td><td>{c.segmento}</td><td>{fmt(c.instalacao)}</td><td>{fmt(c.mrr)}</td><td style={{ color: 'var(--t-text-muted)' }}>{c.origem}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Bloco>
            )}

            {/* Marketing */}
            {d.marketing && (
              <Bloco titulo="Marketing" num={6} aberto={false}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rel-bloco-conteudo">
                  <KPI label="Investido" valor={fmt(d.marketing.investido)} />
                  <KPI label="Resultados" valor={d.marketing.resultados} />
                  <KPI label="Impressões" valor={Number(d.marketing.impressoes || 0).toLocaleString('pt-BR')} />
                  <KPI label="ROI" valor={d.marketing.roi ? `${d.marketing.roi}x` : '—'} tom="ganho" />
                </div>
              </Bloco>
            )}

            {/* Cancelamentos */}
            {Array.isArray(d.cancelamentos_lista) && d.cancelamentos_lista.length > 0 && (
              <Bloco titulo="Cancelamentos" num={7} aberto={false}>
                <div className="rel-bloco-conteudo">
                  {d.cancelamentos_lista.map((c: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b" style={{ borderColor: 'var(--t-card-border)' }}>
                      <span style={{ color: 'var(--t-text-secondary)' }}>{c.motivo}</span><span className="font-semibold" style={{ color: SEM.perda }}>{c.qtd} cliente(s)</span>
                    </div>
                  ))}
                </div>
              </Bloco>
            )}

            {/* Resumo executivo */}
            {Array.isArray(d.resumo_executivo) && d.resumo_executivo.length > 0 && (
              <Bloco titulo="Resumo Executivo" aberto>
                <ul className="space-y-1 text-sm">
                  {d.resumo_executivo.map((r: string, i: number) => <li key={i} style={{ color: 'var(--t-text-secondary)' }}>{r}</li>)}
                </ul>
              </Bloco>
            )}

            {/* Sensor de Mercado: objeções de perda + concorrentes mencionados */}
            {sensor && (sensor.objecoes?.length > 0 || sensor.concorrentes?.length > 0) && (
              <Bloco titulo="Sensor de Mercado" num={8} icone={Radar} aberto={false}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rel-bloco-conteudo">
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--t-text-muted)' }}>Motivos de perda de leads</p>
                    {sensor.objecoes?.length > 0 ? (
                      <>
                        <div className="print:hidden">
                          <ResponsiveContainer width="100%" height={Math.max(140, sensor.objecoes.length * 40)}>
                            <BarChart layout="vertical" data={sensor.objecoes} margin={{ top: 6, right: 20, left: 10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--t-card-border)" horizontal={false} />
                              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                              <YAxis type="category" dataKey="motivo" width={140} tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Bar dataKey="total" name="Leads perdidos" fill="#dc2626" radius={[0, 5, 5, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm mt-2">
                            <thead><tr className="text-left text-xs border-b" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-muted)' }}><th className="py-1.5">Motivo</th><th className="text-right">Leads</th></tr></thead>
                            <tbody>{sensor.objecoes.map((o: any, i: number) => (
                              <tr key={i} className="border-b" style={{ borderColor: 'var(--t-card-border)' }}><td className="py-1.5">{o.motivo}</td><td className="text-right font-semibold" style={{ color: SEM.perda }}>{o.total}</td></tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </>
                    ) : <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>Sem leads perdidos no período.</p>}
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--t-text-muted)' }}>Concorrentes mais mencionados</p>
                    {sensor.concorrentes?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="text-left text-xs border-b" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-muted)' }}><th className="py-1.5">Sistema atual</th><th className="text-right">Menções</th></tr></thead>
                          <tbody>{sensor.concorrentes.map((c: any, i: number) => (
                            <tr key={i} className="border-b" style={{ borderColor: 'var(--t-card-border)' }}><td className="py-1.5">{c.nome}</td><td className="text-right font-semibold" style={{ color: 'var(--t-text-primary)' }}>{c.total}</td></tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ) : <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>Nenhum concorrente informado no período.</p>}
                  </div>
                </div>
              </Bloco>
            )}

            {/* Desempenho por SDR: comparativo entre todos os SDRs ativos */}
            {sdrs.length > 0 && (
              <Bloco titulo="Desempenho por SDR" num={9} icone={Users2} aberto={false}>
                <div className="rel-bloco-conteudo">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs border-b" style={{ borderColor: 'var(--t-card-border)', color: 'var(--t-text-muted)' }}>
                        <th className="py-2">SDR</th><th>Leads cadastrados</th><th>Taxa qualificação</th><th>Leads distribuídos</th><th>Vendas originadas</th>
                      </tr></thead>
                      <tbody>
                        {sdrs.map((s: any, i: number) => (
                          <tr key={i} className="border-b" style={{ borderColor: 'var(--t-card-border)' }}>
                            <td className="py-2 font-medium" style={{ color: 'var(--t-text-primary)' }}>{s.sdr_nome}</td>
                            <td>{s.funil?.leads_cadastrados ?? 0}</td>
                            <td>{s.taxas?.taxa_qualificacao ?? 0}%</td>
                            <td>{s.funil?.leads_distribuidos ?? 0}</td>
                            <td className="font-semibold" style={{ color: SEM.ganho }}>{s.funil?.vendas_originadas ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs mt-2 font-medium" style={{ color: SEM.atencao }}>
                    "Leads distribuídos" reflete o histórico de auditoria dos últimos 60 dias — pode subestimar períodos mais longos.
                  </p>
                </div>
              </Bloco>
            )}

            <p className="text-xs text-center mt-4 print:hidden" style={{ color: 'var(--t-text-muted)' }}>
              Pipeline calculado automaticamente das propostas. Dados de receita/marketing/churn podem ser editados via API.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
