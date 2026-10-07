'use client';

// Relatório de Retenção (Supervisão Comercial e CEO): ranking dos motivos de saída e LTV
// completo de cada cliente. Dados de GET /clientes/relatorio-retencao.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';
import { AZUL, Barra, CSS_CEO, Numero, brl0, nf, painel, secao } from '@/components/ceo/blocosCeo';

type Aba = 'motivos' | 'ltv';
type Origem = 'todos' | 'casos' | 'base';
type Ordem = 'ltv' | 'meses_de_casa' | 'mensalidade' | 'receita_adicionais' | 'ltv_por_mes' | 'nome';
const brl = (v: number | null | undefined) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const dataBR = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const tempo = (m: number) => (m >= 12 ? `${Math.floor(m / 12)}a ${m % 12}m` : `${m}m`);

function Pilulas<T extends string>({ opcoes, valor, onChange, nome }: { opcoes: [T, string][]; valor: T; onChange: (v: T) => void; nome: string }) {
  return (
    <div role="group" aria-label={nome} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {opcoes.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} aria-pressed={valor === k}
          style={{ fontSize: 13, fontWeight: valor === k ? 600 : 500, padding: '6px 14px', minHeight: 36, borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
            border: `1px solid ${valor === k ? `${AZUL}55` : 'var(--t-card-border)'}`, background: valor === k ? `${AZUL}0f` : 'transparent', color: valor === k ? AZUL : 'var(--t-text-secondary)' }}>{l}</button>
      ))}
    </div>
  );
}

function baixarCsv(nome: string, cab: string[], linhas: (string | number | null | undefined)[][]) {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob(['﻿' + [cab.map(esc).join(';'), ...linhas.map(l => l.map(v => (typeof v === 'number' ? String(v).replace('.', ',') : esc(v))).join(';'))].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function AbaMotivos({ d }: { d: any }) {
  const [origem, setOrigem] = useState<Origem>('todos');
  const [aberto, setAberto] = useState<string | null>(null);
  const r = d.ranking[origem];
  const max = Math.max(1, ...r.ranking.map((x: any) => x.saidas));
  const naoInformou = r.ranking.find((x: any) => x.categoria === 'Não informou o motivo');
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Pilulas nome="Origem" valor={origem} onChange={setOrigem} opcoes={[['todos', 'Todas as saídas'], ['casos', 'Casos de churn'], ['base', 'Base histórica (inativos)']]} />
        <button onClick={() => baixarCsv('motivos-de-saida.csv', ['Posição', 'Motivo', 'Saídas', '% do total', 'Casos de churn', 'Base histórica', 'MRR perdido', 'Recuperados', 'Taxa de recuperação', 'Exemplos'],
          r.ranking.map((x: any, i: number) => [i + 1, x.categoria, x.saidas, x.pct, x.casos, x.base, x.mrr_perdido, x.recuperados, x.taxa_recuperacao ?? '', x.exemplos.join(' | ')]))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, padding: '8px 12px', minHeight: 36, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--t-card-border)', background: 'transparent', color: AZUL }}>
          <Download size={13} /> Exportar planilha
        </button>
      </div>
      <div style={{ ...painel, padding: 16 }} className="ceo-grid ceo-g3">
        <Numero l="Clientes que saíram" v={nf(r.total_saidas)} s={origem === 'todos' ? 'casos de churn + inativados da base' : undefined} />
        <Numero l="Mensalidade perdida (registrada)" v={brl0(r.mrr_perdido_total)} cor={r.mrr_perdido_total ? '#dc2626' : undefined} s="só onde o valor foi informado" />
        <Numero l="Principal motivo" v={r.ranking.find((x: any) => x.categoria !== 'Não informou o motivo')?.categoria || '—'} />
      </div>
      {naoInformou && naoInformou.pct >= 15 && (
        <div style={{ ...painel, padding: '10px 14px', fontSize: 13, color: '#b45309', borderColor: '#d9770655', background: '#d977060a' }}>
          {naoInformou.pct}% das saídas estão sem motivo informado. Registrar o motivo em todo cancelamento deixa este ranking mais confiável.
        </div>
      )}
      <section style={{ ...painel, padding: 16, display: 'grid', gap: 12 }}>
        <div style={secao}>Ranking dos motivos de saída</div>
        {r.ranking.map((x: any, i: number) => (
          <div key={x.categoria} style={{ display: 'grid', gap: 6, borderTop: i ? '1px solid var(--t-card-border)' : 'none', paddingTop: i ? 10 : 0 }}>
            <button onClick={() => setAberto(aberto === x.categoria ? null : x.categoria)} style={{ all: 'unset', cursor: 'pointer', display: 'block' }} aria-expanded={aberto === x.categoria}>
              <Barra l={`${i + 1}º · ${x.categoria}`} v={x.saidas} max={max}
                extra={`${x.pct}%${x.mrr_perdido ? ` · ${brl0(x.mrr_perdido)}/mês` : ''}${x.recuperados ? ` · ${x.recuperados} recuperado(s)` : ''}`} />
            </button>
            {aberto === x.categoria && (
              <div style={{ fontSize: 12, color: 'var(--t-text-secondary)', display: 'grid', gap: 4, paddingLeft: 4 }}>
                <span>Casos de churn: <b>{x.casos}</b> · Base histórica: <b>{x.base}</b>{x.taxa_recuperacao != null ? <> · Taxa de recuperação: <b>{x.taxa_recuperacao}%</b></> : null}</span>
                {x.exemplos.length > 0 && <span>Como foi escrito: {x.exemplos.map((e: string) => `“${e}”`).join(' · ')}</span>}
              </div>
            )}
          </div>
        ))}
        <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Toque num motivo para ver de onde veio e como foi escrito. Os textos livres foram agrupados por assunto (ex.: “Fechamento da loja” e “Cliente fechou a loja.”).</div>
      </section>
    </div>
  );
}

function AbaLtv({ d }: { d: any }) {
  const { resumo: rs, faixas, por_segmento, clientes } = d.ltv;
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<'ATIVA' | 'INATIVA' | 'TODAS'>('ATIVA');
  const [segmento, setSegmento] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('ltv');
  const [limite, setLimite] = useState(100);
  const segmentos = useMemo(() => [...new Set(clientes.map((c: any) => c.segmento))].sort() as string[], [clientes]);
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes
      .filter((c: any) => (situacao === 'TODAS' || c.situacao === situacao) && (!segmento || c.segmento === segmento)
        && (!q || `${c.codigo} ${c.nome} ${c.razao_social} ${c.cidade}`.toLowerCase().includes(q)))
      .sort((a: any, b: any) => (ordem === 'nome' ? String(a.nome).localeCompare(String(b.nome)) : Number(b[ordem] || 0) - Number(a[ordem] || 0)));
  }, [clientes, busca, situacao, segmento, ordem]);
  const maxFaixa = Math.max(1, ...faixas.map((f: any) => f.clientes));
  const exportar = () => baixarCsv('ltv-por-cliente.csv',
    ['Código', 'Cliente', 'Razão social', 'Segmento', 'Cidade', 'Plano', 'Situação', 'Entrada', 'Saída', 'Meses de casa', 'Mensalidade atual', 'Mensalidades pagas', 'Instalação', 'Vendas adicionais', 'LTV', 'LTV por mês', 'Motivo de saída', 'Motivo (texto)'],
    lista.map((c: any) => [c.codigo, c.nome, c.razao_social, c.segmento, c.cidade, c.plano, c.situacao, dataBR(c.data_entrada), c.inativado_em ? dataBR(c.inativado_em) : '', c.meses_de_casa, c.mensalidade, c.receita_mensalidades, c.instalacao, c.receita_adicionais, c.ltv, c.ltv_por_mes ?? '', c.motivo_saida || '', c.motivo_texto || '']));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ ...painel, padding: 16 }} className="ceo-grid ceo-g4">
        <Numero l="LTV médio por cliente ativo" v={brl0(rs.ltv_medio_ativos)} cor={AZUL} s={`${nf(rs.ativos)} clientes ativos`} />
        <Numero l="LTV total da base ativa" v={brl0(rs.ltv_total_ativos)} s="o que a base ativa já pagou" />
        <Numero l="Tempo médio de casa" v={`${Math.floor(rs.tempo_medio_meses / 12)} anos e ${Math.round(rs.tempo_medio_meses % 12)} meses`} s="clientes ativos" />
        <Numero l="Mensalidade média" v={brl0(rs.ticket_medio)} s={`MRR ${brl0(rs.mrr_ativos)}`} />
      </div>
      <div className="ceo-grid ceo-g2">
        <section style={{ ...painel, padding: 16, display: 'grid', gap: 12, alignContent: 'start' }}>
          <div style={secao}>Tempo de casa dos clientes ativos</div>
          {faixas.map((f: any) => <Barra key={f.faixa} l={f.faixa} v={f.clientes} max={maxFaixa} extra={f.clientes ? `LTV médio ${brl0(f.ltv_medio)}` : undefined} />)}
        </section>
        <section style={{ ...painel, padding: 16, display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
          <div style={secao}>LTV por segmento (ativos)</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="ceo-tab">
              <thead><tr><th>Segmento</th><th className="n">Clientes</th><th className="n">MRR</th><th className="n">LTV médio</th><th className="n">LTV total</th></tr></thead>
              <tbody>{por_segmento.map((s: any) => <tr key={s.segmento}><td>{s.segmento}</td><td className="n">{nf(s.ativos)}</td><td className="n">{brl0(s.mrr)}</td><td className="n">{brl0(s.ltv_medio)}</td><td className="n">{brl0(s.ltv_total)}</td></tr>)}</tbody>
            </table>
          </div>
          <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Segmento vazio no cadastro é deduzido pelo nome (farmácia, drogaria, padaria, panificadora).</div>
        </section>
      </div>

      <section style={{ ...painel, padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={secao}>LTV de cada cliente ({nf(lista.length)})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--t-text-muted)' }} />
              <input value={busca} onChange={e => { setBusca(e.target.value); setLimite(100); }} placeholder="Código, nome ou cidade" className="ps-input" style={{ paddingLeft: 30, minHeight: 36, width: 200 }} aria-label="Buscar cliente" />
            </label>
            <select value={situacao} onChange={e => { setSituacao(e.target.value as any); setLimite(100); }} className="ps-input" style={{ minHeight: 36 }} aria-label="Situação">
              <option value="ATIVA">Ativos</option><option value="INATIVA">Inativos</option><option value="TODAS">Todos</option>
            </select>
            <select value={segmento} onChange={e => { setSegmento(e.target.value); setLimite(100); }} className="ps-input" style={{ minHeight: 36 }} aria-label="Segmento">
              <option value="">Todos os segmentos</option>{segmentos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={ordem} onChange={e => setOrdem(e.target.value as Ordem)} className="ps-input" style={{ minHeight: 36 }} aria-label="Ordenar por">
              <option value="ltv">Maior LTV</option><option value="meses_de_casa">Mais tempo de casa</option><option value="mensalidade">Maior mensalidade</option>
              <option value="receita_adicionais">Mais vendas adicionais</option><option value="ltv_por_mes">Maior LTV por mês</option><option value="nome">Nome (A–Z)</option>
            </select>
            <button onClick={exportar} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, padding: '8px 12px', minHeight: 36, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--t-card-border)', background: 'transparent', color: AZUL }}>
              <Download size={13} /> Exportar planilha
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ceo-tab">
            <thead><tr><th>#</th><th>Cliente</th><th>Segmento</th><th>Entrada</th><th className="n">Tempo de casa</th><th className="n">Mensalidade</th><th className="n">Mensalidades pagas</th><th className="n">Instalação</th><th className="n">Vendas adicionais</th><th className="n">LTV</th><th className="n">Por mês</th>{situacao !== 'ATIVA' && <th>Motivo de saída</th>}</tr></thead>
            <tbody>
              {lista.slice(0, limite).map((c: any, i: number) => (
                <tr key={c.id}>
                  <td className="n" style={{ color: 'var(--t-text-muted)' }}>{i + 1}</td>
                  <td style={{ minWidth: 220 }}><span style={{ color: 'var(--t-text-muted)' }}>{c.codigo} · </span>{c.nome}{c.cidade ? <div style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{c.cidade}{c.plano ? ` · ${c.plano}` : ''}</div> : null}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.segmento}</td>
                  <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{c.sem_data_entrada ? <span style={{ color: '#b45309' }}>sem data</span> : dataBR(c.data_entrada)}</td>
                  <td className="n">{c.sem_data_entrada ? '—' : tempo(c.meses_de_casa)}</td>
                  <td className="n">{brl(c.mensalidade)}</td>
                  <td className="n">{brl(c.receita_mensalidades)}</td>
                  <td className="n">{c.instalacao ? brl(c.instalacao) : '—'}</td>
                  <td className="n">{c.receita_adicionais ? `${brl(c.receita_adicionais)} (${c.vendas_adicionais})` : '—'}</td>
                  <td className="n" style={{ fontWeight: 600 }}>{brl(c.ltv)}</td>
                  <td className="n">{brl(c.ltv_por_mes)}</td>
                  {situacao !== 'ATIVA' && <td style={{ minWidth: 180, fontSize: 12 }}>{c.motivo_saida ? <span title={c.motivo_texto || ''}>{c.motivo_saida}</span> : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lista.length > limite && (
          <button onClick={() => setLimite(l => l + 200)} style={{ justifySelf: 'center', fontSize: 13, fontWeight: 500, padding: '8px 16px', minHeight: 40, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--t-card-border)', background: 'transparent', color: AZUL }}>
            Mostrar mais ({nf(lista.length - limite)} restantes)
          </button>
        )}
        <div style={{ fontSize: 12, color: 'var(--t-text-muted)', lineHeight: 1.6 }}>
          LTV = o que o cliente já pagou: mensalidade atual × meses de casa + instalação + vendas adicionais (setup e acréscimos). Como usa a mensalidade de hoje, clientes antigos que pagavam menos no passado ficam um pouco acima do real.
          {rs.inativos_sem_data ? ` ${nf(rs.inativos_sem_data)} dos ${nf(rs.inativos)} inativos não têm data de entrada ou de saída no cadastro, então o LTV deles fica incompleto.` : ''}
        </div>
      </section>
    </div>
  );
}

export default function RelatorioRetencaoPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [aba, setAba] = useState<Aba>('motivos');
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get('aba');
    if (a === 'ltv' || a === 'motivos') setAba(a);
  }, []);
  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.getRelatorioRetencao().then(r => setD(r.data.data)).catch((e: any) => setErro(e?.response?.data?.message || 'Não foi possível carregar o relatório.'));
  }, [isAuthenticated]);
  if (loading || !isAuthenticated) return null;

  return (
    <DashboardLayout>
      <style>{CSS_CEO}</style>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 16px', display: 'grid', gap: 20 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--t-text-primary)' }}>Relatório de Retenção</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t-text-muted)' }}>Por que os clientes saem e quanto cada cliente já pagou à Prosystem (LTV).</p>
          </div>
          <Pilulas nome="Relatório" valor={aba} onChange={setAba} opcoes={[['motivos', 'Motivos de saída'], ['ltv', 'LTV por cliente']]} />
        </header>
        {erro ? <div style={{ ...painel, padding: 16, color: '#dc2626', fontSize: 13 }}>{erro}</div>
          : !d ? <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={22} /></div>
          : aba === 'motivos' ? <AbaMotivos d={d} /> : <AbaLtv d={d} />}
      </div>
    </DashboardLayout>
  );
}
