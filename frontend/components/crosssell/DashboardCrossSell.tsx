'use client';

// Dashboard de cross-sell e up-sell (vendas para a base). Usado na aba "Dashboard"
// do módulo Cross-sell e na página do CEO (/cross-sell-ceo). Os números vêm prontos
// do backend (montarDashboardCrossSell): receita única (setup/serviço) e MRR de
// expansão (aumento da mensalidade) ficam sempre separados.

import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { Download, Loader2, Search, TrendingUp } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const AZUL = '#2E6EAB';
const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const brl0 = (v: number) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotMes = (m?: string | null) => (m ? `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}` : '—');
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dataBR = (s: string) => new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

type Metrica = 'vendas' | 'receita_unica' | 'mrr';
const METRICAS: [Metrica, string][] = [['vendas', 'Vendas'], ['receita_unica', 'Receita única'], ['mrr', 'MRR de expansão']];
const fmtMetrica = (m: Metrica, v: number) => (m === 'vendas' ? String(v) : brl(v));

type Periodo = 'ano' | '12m' | 'tri' | 'custom';
function intervalo(p: Periodo, ini: string, fim: string): { inicio: string; fim: string } {
  const hoje = new Date();
  if (p === '12m') { const i = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1); return { inicio: iso(i), fim: iso(hoje) }; }
  if (p === 'tri') { const i = new Date(hoje.getFullYear(), Math.floor(hoje.getMonth() / 3) * 3, 1); return { inicio: iso(i), fim: iso(hoje) }; }
  if (p === 'custom' && ini && fim) return { inicio: ini, fim };
  return { inicio: `${hoje.getFullYear()}-01-01`, fim: iso(hoje) };
}

const painel: React.CSSProperties = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 10 };
const rotulo: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--t-text-muted)' };
const secao: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--t-text-secondary)' };

function Pilulas<T extends string>({ opcoes, valor, onChange, nome }: { opcoes: [T, string][]; valor: T; onChange: (v: T) => void; nome: string }) {
  return (
    <div role="group" aria-label={nome} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opcoes.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} aria-pressed={valor === k}
          style={{ fontSize: 12, fontWeight: valor === k ? 600 : 500, padding: '6px 12px', minHeight: 32, borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
            border: `1px solid ${valor === k ? `${AZUL}55` : 'var(--t-card-border)'}`, background: valor === k ? `${AZUL}0f` : 'transparent', color: valor === k ? AZUL : 'var(--t-text-secondary)' }}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Indicador({ l, v, s, destaque }: { l: string; v: string; s?: string; destaque?: boolean }) {
  return (
    <div style={{ ...painel, padding: '14px 16px', display: 'grid', gap: 4, borderColor: destaque ? `${AZUL}40` : undefined }}>
      <div style={rotulo}>{l}</div>
      <div style={{ fontSize: 26, fontWeight: 650, lineHeight: 1.15, color: destaque ? AZUL : 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      {s && <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{s}</div>}
    </div>
  );
}

function DicaGrafico({ active, payload, label, linhas }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ ...painel, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,.08)', minWidth: 170 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-primary)', marginBottom: 4 }}>{label ?? p.rotulo}</div>
      {(linhas as [string, string][]).map(([k, l]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: 'var(--t-text-secondary)' }}>
          <span>{l}</span><b style={{ color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtMetrica(k as Metrica, p[k])}</b>
        </div>
      ))}
    </div>
  );
}

function baixarCsv(lista: any[]) {
  const cab = ['Data', 'Código', 'Cliente', 'Tipo', 'Descrição', 'Receita única', 'MRR de expansão', 'Mensalidade antes', 'Mensalidade depois', 'Vendedor', 'Status'];
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const num = (v: any) => (v == null ? '' : String(v).replace('.', ','));
  const linhas = lista.map(l => [dataBR(l.data), l.codigo, l.cliente, l.rotulo, l.descricao, num(l.receita_unica), num(l.mrr), num(l.antes), num(l.depois), l.vendedor, l.status].map(esc).join(';'));
  const blob = new Blob(['﻿' + [cab.map(esc).join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `cross-sell-${iso(new Date())}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function DashboardCrossSell({ modo = 'modulo' }: { modo?: 'modulo' | 'ceo' }) {
  const [periodo, setPeriodo] = useState<Periodo>('ano');
  const [ini, setIni] = useState(''); const [fim, setFim] = useState('');
  const [d, setD] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [metMes, setMetMes] = useState<Metrica>('receita_unica');
  const [metTipo, setMetTipo] = useState<Metrica>('vendas');
  const [busca, setBusca] = useState(''); const [tipoFiltro, setTipoFiltro] = useState('');

  const faixa = intervalo(periodo, ini, fim);
  useEffect(() => {
    setCarregando(true); setErro(null);
    apiClient.getDashboardCrossSell(faixa).then(r => setD(r.data.data)).catch((e: any) => setErro(e?.response?.data?.message || 'Não foi possível carregar o dashboard.')).finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faixa.inicio, faixa.fim]);

  const tiposOrdenados = useMemo(() => (d ? [...d.por_tipo].sort((a: any, b: any) => b[metTipo] - a[metTipo] || b.vendas - a.vendas) : []), [d, metTipo]);
  const lista = useMemo(() => {
    if (!d) return [];
    const q = busca.trim().toLowerCase();
    return d.lista.filter((l: any) => (!tipoFiltro || l.tipo === tipoFiltro) && (!q || `${l.codigo} ${l.cliente} ${l.descricao} ${l.vendedor}`.toLowerCase().includes(q)));
  }, [d, busca, tipoFiltro]);

  const ceo = modo === 'ceo';
  const t = d?.totais;
  const rotTipo = (k?: string | null) => d?.por_tipo.find((x: any) => x.tipo === k)?.rotulo || '—';

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <style>{`.cs-tab{width:100%;border-collapse:collapse;font-size:13px}.cs-tab th{font-size:12px;font-weight:500;color:var(--t-text-muted);text-align:left;padding:10px 12px;border-bottom:1px solid var(--t-card-border);white-space:nowrap}.cs-tab td{padding:10px 12px;border-top:1px solid var(--t-card-border);color:var(--t-text-primary);vertical-align:top}.cs-tab .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.cs-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}@media (max-width:1100px){.cs-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}@media (max-width:640px){.cs-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}.cs-dois{display:grid;grid-template-columns:3fr 2fr;gap:16px}@media (max-width:1000px){.cs-dois{grid-template-columns:1fr}}`}</style>

      {/* Filtros: uma linha acima de tudo */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pilulas nome="Período" valor={periodo} onChange={setPeriodo} opcoes={[['ano', 'Este ano'], ['12m', 'Últimos 12 meses'], ['tri', 'Este trimestre'], ['custom', 'Personalizado']]} />
          {periodo === 'custom' && (
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--t-text-muted)' }}>
              <input type="date" value={ini} onChange={e => setIni(e.target.value)} className="ps-input" aria-label="Início" /> até
              <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="ps-input" aria-label="Fim" />
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{dataBR(`${faixa.inicio}T12:00:00-03:00`)} a {dataBR(`${faixa.fim}T12:00:00-03:00`)} · pela data da venda</span>
      </div>

      {carregando && !d ? <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={20} /></div>
        : erro ? <div style={{ ...painel, padding: 16, color: '#dc2626', fontSize: 13 }}>{erro}</div>
        : !d || !t.vendas ? <div style={{ ...painel, padding: 24, fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma venda para a base neste período.</div>
        : (
        <>
          <div className="cs-kpis" style={{ opacity: carregando ? 0.6 : 1 }}>
            <Indicador destaque l="MRR de expansão" v={brl0(t.mrr_expansao)} s={`+${brl0(t.arr_expansao)} por ano na mensalidade`} />
            <Indicador l="Receita única" v={brl0(t.receita_unica)} s="setup e serviços" />
            <Indicador l="Vendas para a base" v={String(t.vendas)} s={`${t.clientes} cliente${t.clientes === 1 ? '' : 's'}`} />
            <Indicador l="Ticket médio" v={brl0(t.ticket_medio)} s="receita única por venda" />
            <Indicador l="Comissões a pagar" v={brl0(d.comissoes.a_pagar)} s={`${brl0(d.comissoes.pagas)} já pagas`} />
          </div>

          {/* Destaques do período */}
          <div style={{ ...painel, padding: '12px 16px', display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, color: 'var(--t-text-secondary)' }}>
            <TrendingUp size={16} color={AZUL} style={{ marginTop: 2 }} />
            <span>Mais vendido: <b style={{ color: 'var(--t-text-primary)' }}>{rotTipo(d.destaques.tipo_mais_vendido)}</b></span>
            <span>Maior MRR: <b style={{ color: 'var(--t-text-primary)' }}>{rotTipo(d.destaques.tipo_maior_mrr)}</b></span>
            <span>Melhor mês em vendas: <b style={{ color: 'var(--t-text-primary)' }}>{rotMes(d.destaques.melhor_mes_vendas?.mes)}</b>{d.destaques.melhor_mes_vendas ? ` (${d.destaques.melhor_mes_vendas.vendas})` : ''}</span>
            <span>Melhor mês em receita: <b style={{ color: 'var(--t-text-primary)' }}>{rotMes(d.destaques.melhor_mes_receita?.mes)}</b>{d.destaques.melhor_mes_receita ? ` (${brl0(d.destaques.melhor_mes_receita.valor)})` : ''}</span>
            {d.destaques.melhor_trimestre && <span>Melhor trimestre: <b style={{ color: 'var(--t-text-primary)' }}>{d.destaques.melhor_trimestre}</b></span>}
          </div>

          <div className="cs-dois">
            {/* Mês a mês */}
            <section style={{ ...painel, padding: 16, display: 'grid', gap: 12, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={secao}>Mês a mês · {METRICAS.find(m => m[0] === metMes)![1]}</div>
                <Pilulas nome="Medida do mês a mês" valor={metMes} onChange={setMetMes} opcoes={METRICAS} />
              </div>
              <div style={{ height: ceo ? 300 : 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.meses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--t-card-border)" />
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--t-text-muted)' }} />
                    <YAxis width={metMes === 'vendas' ? 32 : 64} tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--t-text-muted)' }} tickFormatter={v => (metMes === 'vendas' ? v : `R$ ${Number(v).toLocaleString('pt-BR', { notation: 'compact' } as any)}`)} />
                    <Tooltip cursor={{ fill: `${AZUL}0f` }} content={<DicaGrafico linhas={METRICAS} />} />
                    <Bar dataKey={metMes} name={METRICAS.find(m => m[0] === metMes)![1]} fill={AZUL} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Crescimento do MRR */}
            <section style={{ ...painel, padding: 16, display: 'grid', gap: 12, minWidth: 0 }}>
              <div>
                <div style={secao}>Crescimento do MRR (acumulado)</div>
                <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 2 }}>Quanto a mensalidade da base subiu com as vendas, somando mês a mês.</div>
              </div>
              <div style={{ height: ceo ? 270 : 230 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.meses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--t-card-border)" />
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--t-text-muted)' }} />
                    <YAxis width={64} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--t-text-muted)' }} tickFormatter={v => `R$ ${Number(v).toLocaleString('pt-BR', { notation: 'compact' } as any)}`} />
                    <Tooltip content={<DicaGrafico linhas={[['mrr', 'MRR no mês'], ['mrr_acumulado', 'MRR acumulado']]} />} />
                    <Area type="monotone" dataKey="mrr_acumulado" name="MRR acumulado" stroke={AZUL} strokeWidth={2} fill={`${AZUL}1a`} dot={{ r: 3, fill: AZUL, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Ranking por tipo de serviço */}
          <section style={{ ...painel, padding: 16, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={secao}>Ranking por tipo de serviço · {METRICAS.find(m => m[0] === metTipo)![1]}</div>
              <Pilulas nome="Medida do ranking" valor={metTipo} onChange={setMetTipo} opcoes={METRICAS} />
            </div>
            <div className="cs-dois">
              <div style={{ height: Math.max(160, tiposOrdenados.length * 44), minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tiposOrdenados} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="rotulo" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--t-text-secondary)' }} />
                    <Tooltip cursor={{ fill: `${AZUL}0f` }} content={<DicaGrafico linhas={METRICAS} />} />
                    <Bar dataKey={metTipo} fill={AZUL} radius={[0, 4, 4, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="cs-tab">
                  <thead><tr><th>Tipo</th><th className="n">Vendas</th><th className="n">Receita única</th><th className="n">MRR</th><th className="n">% da receita</th></tr></thead>
                  <tbody>
                    {tiposOrdenados.map((x: any) => (
                      <tr key={x.tipo}><td>{x.rotulo}</td><td className="n">{x.vendas}</td><td className="n">{brl(x.receita_unica)}</td><td className="n">{brl(x.mrr)}</td>
                        <td className="n">{t.receita_unica ? `${Math.round((x.receita_unica / t.receita_unica) * 100)}%` : '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Vendedores e comissões */}
          <section style={{ ...painel, padding: 16, display: 'grid', gap: 12 }}>
            <div style={secao}>Vendedores e comissões</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="cs-tab">
                <thead><tr><th>Vendedor</th><th className="n">Vendas</th><th className="n">Receita única</th><th className="n">MRR</th><th className="n">Comissão</th><th className="n">Paga</th><th className="n">A pagar</th></tr></thead>
                <tbody>
                  {d.vendedores.map((v: any) => (
                    <tr key={v.vendedor_id}><td>{v.vendedor}</td><td className="n">{v.vendas}</td><td className="n">{brl(v.receita_unica)}</td><td className="n">{brl(v.mrr)}</td>
                      <td className="n">{brl(v.comissao_total)}</td><td className="n" style={{ color: '#16a34a' }}>{brl(v.comissao_paga)}</td><td className="n">{brl(v.comissao_a_pagar)}</td></tr>
                  ))}
                  <tr><td style={{ color: 'var(--t-text-muted)' }}>Supervisão</td><td /><td /><td /><td className="n">{brl(d.comissoes.supervisao_total)}</td><td /><td /></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Lista de vendas */}
          <section style={{ ...painel, padding: 16, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={secao}>Vendas do período ({lista.length})</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--t-text-muted)' }} />
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Cliente, código, vendedor…" className="ps-input" style={{ paddingLeft: 30, minHeight: 36, width: 220 }} aria-label="Buscar venda" />
                </label>
                <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} className="ps-input" style={{ minHeight: 36 }} aria-label="Tipo">
                  <option value="">Todos os tipos</option>
                  {d.por_tipo.map((x: any) => <option key={x.tipo} value={x.tipo}>{x.rotulo}</option>)}
                </select>
                <button onClick={() => baixarCsv(lista)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, padding: '8px 12px', minHeight: 36, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--t-card-border)', background: 'transparent', color: AZUL }}>
                  <Download size={13} /> Exportar planilha
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: ceo ? 520 : 460, overflowY: 'auto' }}>
              <table className="cs-tab">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--t-card-bg)' }}><tr><th>Data</th><th>Cliente</th><th>Tipo</th><th className="n">Receita única</th><th className="n">MRR</th><th className="n">Mensalidade</th><th>Vendedor</th></tr></thead>
                <tbody>
                  {lista.map((l: any) => (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{dataBR(l.data)}</td>
                      <td style={{ minWidth: 200 }}>{l.codigo ? <span style={{ color: 'var(--t-text-muted)' }}>{l.codigo} · </span> : null}{l.cliente}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{l.rotulo}</td>
                      <td className="n">{l.receita_unica ? brl(l.receita_unica) : '—'}</td>
                      <td className="n">{l.mrr ? `+${brl(l.mrr)}` : '—'}</td>
                      <td className="n" style={{ color: 'var(--t-text-secondary)' }}>{l.mrr && l.antes != null && l.depois != null && l.antes !== l.depois ? `${brl0(l.antes)} → ${brl0(l.depois)}` : '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{l.vendedor || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
