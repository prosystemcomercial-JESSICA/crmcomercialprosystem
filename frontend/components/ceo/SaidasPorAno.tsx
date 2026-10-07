'use client';

// "Quem saiu, ano a ano" (painel de LTV e Relatório de Retenção): comparativo do ano atual com o anterior,
// saídas mês a mês, motivos e a lista de cada cliente que saiu (entrada, saída, tempo ativo, LTV, motivo).
// Ano sem lista de clientes no CRM aparece só com os totais do balanço anual importado.

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { AZUL, Barra, CSS_CEO, Numero, Variacao, brl0, nf, painel, secao } from './blocosCeo';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const dataBR = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const tempo = (m: number | null) => (m == null ? '—' : m >= 12 ? `${Math.floor(m / 12)}a ${m % 12}m` : `${m}m`);
const brl = (v: number | null | undefined) => (v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export function SaidasPorAno({ s }: { s: any }) {
  const anosLista = s.anos.filter((a: any) => a.fonte === 'CRM').map((a: any) => a.ano);
  const [anoLista, setAnoLista] = useState<number | 'todos'>(anosLista[0] ?? 'todos');
  const clientes = useMemo(() => s.clientes.filter((c: any) => anoLista === 'todos' || c.ano_saida === anoLista), [s.clientes, anoLista]);
  const cmp = s.comparativo;
  const atual = s.anos[0];
  const anterior = cmp ? s.anos.find((a: any) => a.ano === cmp.anterior) : s.anos[1];
  const maxMes = atual?.meses ? Math.max(1, ...atual.meses) : 1;

  const exportar = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const cab = ['Ano de saída', 'Código', 'Cliente', 'Segmento', 'Entrada', 'Saída', 'Tempo ativo (meses)', 'Mensalidade', 'LTV', 'Motivo', 'Motivo (texto)'];
    const linhas = clientes.map((c: any) => [c.ano_saida, c.codigo, c.nome, c.segmento, dataBR(c.data_entrada), dataBR(c.inativado_em), c.tempo_ativo_meses ?? '', String(c.mrr).replace('.', ','), String(c.ltv).replace('.', ','), c.motivo_categoria, c.motivo || '']);
    const blob = new Blob(['﻿' + [cab.map(esc).join(';'), ...linhas.map((l: any[]) => l.map(esc).join(';'))].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'clientes-que-sairam.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  if (!s.anos.length) return <div style={{ ...painel, padding: 16, fontSize: 13, color: 'var(--t-text-muted)' }}>Nenhuma saída com data registrada ainda.</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <style>{CSS_CEO}</style>
      {/* Comparativo */}
      <section style={{ ...painel, padding: 16, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--t-text-primary)' }}>{cmp ? `${cmp.atual} × ${cmp.anterior}` : `Saídas em ${atual.ano}`}</div>
          <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginTop: 2 }}>{cmp ? `${cmp.atual} ainda está em andamento.` : ''}{anterior?.fonte === 'BALANCO' ? ` ${anterior.ano}: só os totais do balanço anual (o CRM não tem a lista de quem saiu).` : ''}</div>
        </div>
        <div className="ceo-grid ceo-g4">
          <Numero l={`Clientes que saíram em ${atual.ano}`} v={nf(atual.saidas)} cor={atual.saidas ? '#dc2626' : undefined}
            s={cmp ? <span>{nf(cmp.saidas[1])} em {cmp.anterior} · <Variacao atual={cmp.saidas[0]} anterior={cmp.saidas[1]} sufixo={`vs. ${cmp.anterior}`} /></span> : undefined} />
          <Numero l="Mensalidade perdida" v={`${brl0(atual.mrr_perdido)}/mês`}
            s={cmp ? `${brl0(cmp.mrr[1])}/mês em ${cmp.anterior}` : undefined} />
          <Numero l="Tempo ativo médio de quem saiu" v={atual.tempo_medio_meses != null ? tempo(Math.round(atual.tempo_medio_meses)) : '—'} s={`em ${atual.ano}`} />
          <Numero l="LTV médio de quem saiu" v={brl0(atual.ltv_medio)} s={atual.ltv_total ? `${brl0(atual.ltv_total)} no total` : undefined} />
        </div>
      </section>

      <div className="ceo-grid ceo-g2">
        {atual.meses && (
          <section style={{ ...painel, padding: 16, display: 'grid', gap: 10, alignContent: 'start' }}>
            <div style={secao}>Saídas mês a mês em {atual.ano}</div>
            {atual.meses.map((n: number, i: number) => <Barra key={i} l={MESES[i]} v={n} max={maxMes} />)}
          </section>
        )}
        <section style={{ ...painel, padding: 16, display: 'grid', gap: 12, alignContent: 'start' }}>
          <div style={secao}>Por que saíram</div>
          {[atual, anterior].filter(Boolean).map((a: any) => (
            <div key={a.ano} style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>{a.ano}{a.fonte === 'BALANCO' ? ' (balanço, motivos parciais)' : ''}</div>
              {a.motivos.length ? a.motivos.slice(0, 6).map((m: any) => <Barra key={m.motivo} l={m.motivo} v={m.qtd} max={Math.max(1, ...a.motivos.map((x: any) => x.qtd))} />)
                : <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Sem motivos registrados.</span>}
            </div>
          ))}
        </section>
      </div>

      {/* Todos os anos */}
      <section style={{ ...painel, padding: 16, display: 'grid', gap: 10 }}>
        <div style={secao}>Saídas por ano</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ceo-tab">
            <thead><tr><th>Ano</th><th className="n">Saídas</th><th className="n">Mensalidade perdida</th><th className="n">Tempo ativo médio</th><th className="n">LTV médio</th><th>Principal motivo</th><th>Fonte</th></tr></thead>
            <tbody>{s.anos.map((a: any) => (
              <tr key={a.ano}><td>{a.ano}</td><td className="n">{nf(a.saidas)}</td><td className="n">{brl0(a.mrr_perdido)}/mês</td><td className="n">{a.tempo_medio_meses != null ? tempo(Math.round(a.tempo_medio_meses)) : '—'}</td>
                <td className="n">{brl0(a.ltv_medio)}</td><td>{a.motivos[0]?.motivo || '—'}</td><td style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>{a.fonte === 'CRM' ? 'CRM, cliente a cliente' : 'Balanço anual (totais)'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      {/* Cada cliente que saiu */}
      <section style={{ ...painel, padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={secao}>Cada cliente que saiu ({nf(clientes.length)})</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={String(anoLista)} onChange={e => setAnoLista(e.target.value === 'todos' ? 'todos' : Number(e.target.value))} className="ps-input" style={{ minHeight: 36 }} aria-label="Ano de saída">
              {anosLista.map((a: number) => <option key={a} value={a}>Saíram em {a}</option>)}<option value="todos">Todos os anos</option>
            </select>
            <button onClick={exportar} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, padding: '8px 12px', minHeight: 36, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--t-card-border)', background: 'transparent', color: AZUL }}>
              <Download size={13} /> Exportar planilha
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ceo-tab">
            <thead><tr><th>Cliente</th><th>Segmento</th><th>Entrou</th><th>Saiu</th><th className="n">Tempo ativo</th><th className="n">Mensalidade</th><th className="n">LTV</th><th>Motivo</th></tr></thead>
            <tbody>{clientes.map((c: any) => (
              <tr key={c.id}>
                <td style={{ minWidth: 200 }}><span style={{ color: 'var(--t-text-muted)' }}>{c.codigo} · </span>{c.nome}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{c.segmento}</td>
                <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{dataBR(c.data_entrada)}</td>
                <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{dataBR(c.inativado_em)}</td>
                <td className="n">{tempo(c.tempo_ativo_meses)}</td>
                <td className="n">{brl(c.mrr)}</td>
                <td className="n" style={{ fontWeight: 600 }}>{brl(c.ltv)}</td>
                <td style={{ minWidth: 200, fontSize: 12 }}><b style={{ fontWeight: 600 }}>{c.motivo_categoria}</b>{c.motivo ? <div style={{ color: 'var(--t-text-muted)' }}>{c.motivo}</div> : null}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {s.sem_data > 0 && (
          <div style={{ fontSize: 12, color: '#b45309', lineHeight: 1.6 }}>
            {nf(s.sem_data)} clientes inativos não têm data de saída no cadastro, então não entram no ano a ano. Assim que as datas forem preenchidas (ou importadas), eles passam a aparecer aqui automaticamente.
          </div>
        )}
      </section>
    </div>
  );
}
