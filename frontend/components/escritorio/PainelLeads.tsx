'use client';

// Painel de Leads da Laya (pedido da Jessica, 13/11/2026): por qual canal os leads chegam, até onde vão no funil,
// quanto convertem, quem está rendendo e o que precisa melhorar. A Laya mede (regras, sem IA); o Rafael explica
// o porquê do gargalo lendo as conversas (sexta 15h ou no botão); a Vitória usa o resumo na reunião de segunda.

import { Fragment, useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Etapa = { k: string; rotulo: string; n: number; do_total: number | null; da_anterior: number | null };
type Contagem = { chegaram: number; contatados: number; responderam: number; interessados: number; demonstracoes: number; propostas: number; contratos: number; valor: number; perdidos: number; sem_contato: number };
type Canal = Contagem & { canal: string; parte: number | null; resposta: number | null; conversao: number | null; ate_demo: number | null; horas_ate_contato: number | null; campanhas: { campanha: string; chegaram: number; responderam: number; demonstracoes: number; contratos: number }[] };
type Melhoria = { nivel: 'alta' | 'media' | 'info'; titulo: string; detalhe: string; quem: string };
type Porque = { em: string; canal: string; etapa: string; resumo: string; causas: string[]; acoes: { quem: string; o_que: string }[]; conversas_lidas: number };
type Dados = {
  dias: number; gerado_em: string; atual: Contagem; anterior: Contagem;
  taxas: { resposta: number | null; conversao: number | null; conversao_anterior: number | null; interesse_para_demo: number | null; proposta_para_contrato: number | null; horas_ate_contato: number | null };
  funil: { etapas: Etapa[]; gargalo: { de: string; para: string; taxa: number; perdidos: number } | null };
  canais: Canal[];
  agentes: { agente: string; leads: number; contatados: number; responderam: number; interessados: number; demonstracoes: number; contratos: number; resposta: number | null; ate_demo: number | null }[];
  vendedoras: { vendedora: string; propostas: number; contratos: number; valor: number; fechamento: number | null }[];
  semanas: { semana: string; chegaram: number; responderam: number; demonstracoes: number; contratos: number }[];
  perdas: { id: string; rotulo: string; n: number; parte: number | null }[];
  temperatura: { temperatura: string; n: number }[];
  melhorias: Melhoria[]; porque: Porque | null;
};

const COR = '#db2777'; // a cor da Laya: única série em todos os gráficos
const NOME_AGENTE: Record<string, string> = { caroline: 'Caroline', julio: 'Julio', luiz_felipe: 'Luiz Felipe', heitor: 'Heitor', bia: 'Bia' };
const NOME_TEMP: Record<string, string> = { MUITO_QUENTE: 'Muito quente', QUENTE: 'Quente', MORNO: 'Morno', FRIO: 'Frio' };
const NIVEL: Record<Melhoria['nivel'], { r: string; i: string; c: string; f: string }> = {
  alta: { r: 'Urgente', i: '⚠', c: '#991b1b', f: '#fee2e2' }, media: { r: 'Melhorar', i: '●', c: '#92400e', f: '#fef3c7' }, info: { r: 'Atenção', i: 'ℹ', c: '#1e3a8a', f: '#dbeafe' },
};
const n0 = (v: number) => v.toLocaleString('pt-BR');
const p0 = (v: number | null) => (v === null ? '–' : `${v.toLocaleString('pt-BR')}%`);
const real = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const dataBr = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const horas = (h: number | null) => (h === null ? '–' : h < 1 ? 'menos de 1 h' : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} dias`);

const card: React.CSSProperties = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 12, padding: 12, display: 'grid', gap: 8, minWidth: 0 };
const muted: React.CSSProperties = { fontSize: 12, color: 'var(--t-text-muted)' };
const h3: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: 'var(--t-text-primary)', margin: 0 };

/** Diferença contra o período anterior, em texto (a cor não carrega o sentido sozinha). */
function Variacao({ a, b }: { a: number; b: number }) {
  if (!b) return <span style={muted}>antes: {n0(b)}</span>;
  const d = Math.round(((a - b) / b) * 100);
  return <span style={{ ...muted, fontWeight: 600 }}>{d > 0 ? '▲' : d < 0 ? '▼' : '='} {Math.abs(d)}% · antes {n0(b)}</span>;
}

export default function PainelLeads() {
  const [dias, setDias] = useState(30);
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [rafael, setRafael] = useState<'parado' | 'lendo'>('parado');
  const [msg, setMsg] = useState('');

  const carregar = useCallback(() => {
    setErro('');
    apiClient.painelLeads(dias).then(r => setD(r.data.data)).catch(() => setErro('Não deu para carregar o painel agora.'));
  }, [dias]);
  useEffect(() => { setD(null); carregar(); }, [carregar]);

  const pedirRafael = async () => {
    setRafael('lendo'); setMsg('O Rafael está lendo as conversas (1 a 2 minutos)…');
    try { const r = await apiClient.painelLeadsPorque(); setMsg(r.data?.message || 'Pronto.'); carregar(); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Não deu certo agora.'); }
    setRafael('parado');
  };

  if (erro) return <p style={{ fontSize: 13, color: '#b91c1c' }}>{erro}</p>;
  if (!d) return <p style={muted}>A Laya está somando os leads…</p>;

  const a = d.atual, b = d.anterior;
  const maxSemana = Math.max(1, ...d.semanas.map(s => s.chegaram));
  const maxPerda = Math.max(1, ...d.perdas.map(p => p.n));
  const ativos = d.temperatura.reduce((s, t) => s + t.n, 0);

  return (
    <div style={{ display: 'grid', gap: 12 }} aria-label="Painel de Leads">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={muted}>Medido pela Laya · leads que chegaram nos últimos {d.dias} dias, comparados com os {d.dias} dias anteriores · atualizado {dataBr(d.gerado_em)}</span>
        <select value={dias} onChange={e => setDias(Number(e.target.value))} aria-label="Período" style={{ marginLeft: 'auto', minHeight: 36, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 13 }}>
          {[7, 30, 60, 90].map(x => <option key={x} value={x}>últimos {x} dias</option>)}
        </select>
      </div>

      {/* Números principais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {[
          { r: 'Leads que chegaram', v: n0(a.chegaram), c: <Variacao a={a.chegaram} b={b.chegaram} /> },
          { r: 'Responderam', v: n0(a.responderam), c: <span style={muted}>{p0(d.taxas.resposta)} de quem recebeu contato</span> },
          { r: 'Demonstrações', v: n0(a.demonstracoes), c: <Variacao a={a.demonstracoes} b={b.demonstracoes} /> },
          { r: 'Contratos', v: n0(a.contratos), c: <Variacao a={a.contratos} b={b.contratos} /> },
          { r: 'Conversão (lead → contrato)', v: p0(d.taxas.conversao), c: <span style={muted}>antes {p0(d.taxas.conversao_anterior)}</span> },
          { r: 'Valor fechado', v: real(a.valor), c: <Variacao a={a.valor} b={b.valor} /> },
          { r: 'Tempo até o 1º contato', v: horas(d.taxas.horas_ate_contato), c: <span style={muted}>metade dos leads é chamada antes disso</span> },
          { r: 'Sem contato há +2 dias', v: n0(a.sem_contato), c: <span style={muted}>{a.perdidos} perdidos no período</span> },
        ].map(k => (
          <div key={k.r} style={card}>
            <span style={muted}>{k.r}</span>
            <b style={{ fontSize: 24, color: 'var(--t-text-primary)', lineHeight: 1.1 }}>{k.v}</b>
            {k.c}
          </div>
        ))}
      </div>

      {/* O que melhorar */}
      <section style={card} aria-label="O que melhorar">
        <h3 style={h3}>O que precisa melhorar</h3>
        {d.melhorias.length === 0 && <span style={muted}>Nada fora do normal neste período.</span>}
        {d.melhorias.map((m, i) => (
          <div key={i} style={{ display: 'grid', gap: 2, padding: 10, borderRadius: 10, background: NIVEL[m.nivel].f, color: NIVEL[m.nivel].c }}>
            <b style={{ fontSize: 14 }}>{NIVEL[m.nivel].i} {NIVEL[m.nivel].r}: {m.titulo}</b>
            <span style={{ fontSize: 13, color: '#1f2937' }}>{m.detalhe}</span>
            <span style={{ fontSize: 12, color: '#374151' }}>Quem age: {m.quem}</span>
          </div>
        ))}
      </section>

      {/* Funil */}
      <section style={card} aria-label="Funil">
        <h3 style={h3}>Funil</h3>
        {d.funil.gargalo && <span style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>Maior perda: de <b>{d.funil.gargalo.de}</b> para <b>{d.funil.gargalo.para}</b>: só {p0(d.funil.gargalo.taxa)} passam ({n0(d.funil.gargalo.perdidos)} ficaram para trás).</span>}
        <div style={{ display: 'grid', gap: 6 }}>
          {d.funil.etapas.map(e => (
            <div key={e.k} title={`${e.rotulo}: ${n0(e.n)} (${p0(e.do_total)} do total; ${p0(e.da_anterior)} da etapa anterior)`}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 160px) 1fr minmax(120px, auto)', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{e.rotulo}</span>
              <div style={{ height: 18, background: 'var(--t-card-border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(e.do_total ?? 0, e.n ? 1 : 0)}%`, height: '100%', background: COR, borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--t-text-primary)', textAlign: 'right' }}><b>{n0(e.n)}</b>{e.da_anterior !== null && <span style={muted}> · {p0(e.da_anterior)} passam</span>}</span>
            </div>
          ))}
        </div>
        <span style={muted}>Cada lead conta em todas as etapas até a mais longe que alcançou. Interessado: nota 35+ do agente, temperatura quente ou qualificado.</span>
      </section>

      {/* Por canal */}
      <section style={card} aria-label="Por canal">
        <h3 style={h3}>Por canal: de onde vêm e quanto convertem</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--t-text-muted)' }}>
                {['Canal', 'Leads', '% do total', 'Responderam', 'Interessados', 'Demos', 'Propostas', 'Contratos', 'Conversão', '1º contato'].map(c =>
                  <th key={c} style={{ padding: '6px 6px', borderBottom: '1px solid var(--t-card-border)', whiteSpace: 'nowrap' }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.canais.map(c => (
                <Fragment key={c.canal}>
                  <tr style={{ color: 'var(--t-text-primary)' }}>
                    <td style={{ padding: '6px 6px', borderBottom: '1px solid var(--t-card-border)' }}>
                      <button onClick={() => setAberto(aberto === c.canal ? null : c.canal)} aria-expanded={aberto === c.canal}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--t-text-primary)', fontWeight: 700, fontSize: 13, textAlign: 'left' }}>
                        {aberto === c.canal ? '▲' : '▼'} {c.canal}
                      </button>
                    </td>
                    <td style={{ padding: 6, borderBottom: '1px solid var(--t-card-border)' }}>{n0(c.chegaram)}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid var(--t-card-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={`${p0(c.parte)} dos leads`}>
                        <div style={{ width: 60, height: 8, background: 'var(--t-card-border)', borderRadius: 4 }}><div style={{ width: `${c.parte ?? 0}%`, height: '100%', background: COR, borderRadius: 4 }} /></div>
                        {p0(c.parte)}
                      </div>
                    </td>
                    <td style={{ padding: 6, borderBottom: '1px solid var(--t-card-border)' }}>{n0(c.responderam)} <span style={muted}>({p0(c.resposta)})</span></td>
                    <td style={{ padding: 6, borderBottom: '1px solid var(--t-card-border)' }}>{n0(c.interessados)}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid var(--t-card-border)' }}>{n0(c.demonstracoes)}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid var(--t-card-border)' }}>{n0(c.propostas)}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid var(--t-card-border)', fontWeight: 700 }}>{n0(c.contratos)}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid var(--t-card-border)', fontWeight: 700 }}>{p0(c.conversao)}</td>
                    <td style={{ padding: 6, borderBottom: '1px solid var(--t-card-border)' }}>{horas(c.horas_ate_contato)}</td>
                  </tr>
                  {aberto === c.canal && c.campanhas.map(k => (
                    <tr key={`${c.canal}|${k.campanha}`} style={{ color: 'var(--t-text-muted)' }}>
                      <td style={{ padding: '4px 6px 4px 24px' }} colSpan={2}>{k.campanha}</td>
                      <td style={{ padding: 4 }}>{n0(k.chegaram)} leads</td>
                      <td style={{ padding: 4 }}>{n0(k.responderam)}</td>
                      <td style={{ padding: 4 }} />
                      <td style={{ padding: 4 }}>{n0(k.demonstracoes)}</td>
                      <td style={{ padding: 4 }} />
                      <td style={{ padding: 4 }}>{n0(k.contratos)}</td>
                      <td colSpan={2} />
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <span style={muted}>Clique no canal para ver as campanhas. Conversão: contratos ÷ leads que chegaram.</span>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        {/* Por semana */}
        <section style={card} aria-label="Leads por semana">
          <h3 style={h3}>Leads por semana de chegada</h3>
          {d.semanas.length === 0 ? <span style={muted}>Sem leads no período.</span> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140, paddingTop: 16 }}>
              {d.semanas.map(s => (
                <div key={s.semana} title={`Semana de ${s.semana.split('-').reverse().slice(0, 2).join('/')}: ${s.chegaram} chegaram, ${s.responderam} responderam, ${s.demonstracoes} demonstrações, ${s.contratos} contratos`}
                  style={{ flex: 1, minWidth: 14, display: 'grid', gap: 2, alignItems: 'end', height: '100%', gridTemplateRows: '1fr auto' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                    <span style={{ fontSize: 10, textAlign: 'center', color: 'var(--t-text-muted)' }}>{s.chegaram}</span>
                    <div style={{ height: `${(s.chegaram / maxSemana) * 100}%`, minHeight: s.chegaram ? 2 : 0, background: COR, borderRadius: '4px 4px 0 0' }} />
                  </div>
                  <span style={{ fontSize: 10, textAlign: 'center', color: 'var(--t-text-muted)' }}>{s.semana.split('-').reverse().slice(0, 2).join('/')}</span>
                </div>
              ))}
            </div>
          )}
          <span style={muted}>Passe o mouse para ver respostas, demonstrações e contratos da semana.</span>
        </section>

        {/* Motivos de perda */}
        <section style={card} aria-label="Motivos de perda">
          <h3 style={h3}>Por que perdemos</h3>
          {d.perdas.length === 0 ? <span style={muted}>Nenhum lead perdido no período.</span> : d.perdas.map(p => (
            <div key={p.id} title={`${p.rotulo}: ${p.n} (${p0(p.parte)})`} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr auto', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{p.rotulo}</span>
              <div style={{ height: 12, background: 'var(--t-card-border)', borderRadius: 4 }}><div style={{ width: `${(p.n / maxPerda) * 100}%`, height: '100%', background: COR, borderRadius: 4 }} /></div>
              <span style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{p.n}</span>
            </div>
          ))}
          <span style={muted}>Leads marcados como perdidos no período, pelo motivo anotado.</span>
        </section>

        {/* Temperatura */}
        <section style={card} aria-label="Temperatura dos leads em aberto">
          <h3 style={h3}>Temperatura dos leads em aberto</h3>
          {d.temperatura.map(t => (
            <div key={t.temperatura} style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 8, alignItems: 'center' }} title={`${NOME_TEMP[t.temperatura]}: ${t.n}`}>
              <span style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{NOME_TEMP[t.temperatura]}</span>
              <div style={{ height: 12, background: 'var(--t-card-border)', borderRadius: 4 }}><div style={{ width: `${ativos ? (t.n / ativos) * 100 : 0}%`, height: '100%', background: COR, borderRadius: 4 }} /></div>
              <span style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{n0(t.n)}</span>
            </div>
          ))}
          <span style={muted}>Termômetro da Laya, só dos leads do período que não foram perdidos nem fecharam.</span>
        </section>
      </div>

      {/* Desempenho */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <section style={card} aria-label="Agentes de primeiro contato">
          <h3 style={h3}>Agentes: do contato à demonstração</h3>
          {d.agentes.length === 0 ? <span style={muted}>Nenhum lead com agente no período.</span> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--t-text-muted)' }}>{['Agente', 'Leads', 'Responderam', 'Interessados', 'Demos'].map(c => <th key={c} style={{ padding: 6, borderBottom: '1px solid var(--t-card-border)' }}>{c}</th>)}</tr></thead>
                <tbody>{d.agentes.map(g => (
                  <tr key={g.agente} style={{ color: 'var(--t-text-primary)' }}>
                    <td style={{ padding: 6, fontWeight: 700 }}>{NOME_AGENTE[g.agente] || g.agente}</td>
                    <td style={{ padding: 6 }}>{n0(g.leads)}</td>
                    <td style={{ padding: 6 }}>{n0(g.responderam)} <span style={muted}>({p0(g.resposta)})</span></td>
                    <td style={{ padding: 6 }}>{n0(g.interessados)}</td>
                    <td style={{ padding: 6 }}>{n0(g.demonstracoes)} <span style={muted}>({p0(g.ate_demo)} de quem respondeu)</span></td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </section>
        <section style={card} aria-label="Vendedoras">
          <h3 style={h3}>Vendedoras: propostas e fechamento</h3>
          {d.vendedoras.length === 0 ? <span style={muted}>Nenhuma proposta no período.</span> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--t-text-muted)' }}>{['Vendedora', 'Propostas', 'Contratos', 'Fechamento', 'Valor'].map(c => <th key={c} style={{ padding: 6, borderBottom: '1px solid var(--t-card-border)' }}>{c}</th>)}</tr></thead>
                <tbody>{d.vendedoras.map(v => (
                  <tr key={v.vendedora} style={{ color: 'var(--t-text-primary)' }}>
                    <td style={{ padding: 6, fontWeight: 700 }}>{v.vendedora}</td><td style={{ padding: 6 }}>{n0(v.propostas)}</td>
                    <td style={{ padding: 6 }}>{n0(v.contratos)}</td><td style={{ padding: 6 }}>{p0(v.fechamento)}</td><td style={{ padding: 6 }}>{real(v.valor)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
          <span style={muted}>Propostas enviadas no período (rascunhos não contam).</span>
        </section>
      </div>

      {/* O porquê, pelo Rafael */}
      <section style={{ ...card, borderColor: '#1e40af' }} aria-label="Por que trava, pelo Rafael">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={h3}>Por que trava · Rafael</h3>
          <button onClick={pedirRafael} disabled={rafael === 'lendo'}
            style={{ marginLeft: 'auto', minHeight: 36, padding: '0 12px', borderRadius: 10, border: 'none', background: '#1e40af', color: '#fff', fontSize: 13, fontWeight: 700, cursor: rafael === 'lendo' ? 'wait' : 'pointer', opacity: rafael === 'lendo' ? 0.7 : 1 }}>
            {rafael === 'lendo' ? 'Lendo as conversas…' : 'Pedir ao Rafael agora'}
          </button>
        </div>
        {msg && <span style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>{msg}</span>}
        {!d.porque ? <span style={muted}>Toda sexta às 15h o Rafael lê as conversas do canal que mais trava e explica aqui. Ainda não há leitura.</span> : (
          <>
            <span style={muted}>{d.porque.canal} · {d.porque.etapa} · {d.porque.conversas_lidas} conversas lidas em {dataBr(d.porque.em)}</span>
            <p style={{ fontSize: 14, color: 'var(--t-text-primary)', margin: 0 }}>{d.porque.resumo}</p>
            {d.porque.causas.length > 0 && <><b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>O que se repete</b>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--t-text-primary)', display: 'grid', gap: 4 }}>{d.porque.causas.map((c, i) => <li key={i}>{c}</li>)}</ul></>}
            {d.porque.acoes.length > 0 && <><b style={{ fontSize: 13, color: 'var(--t-text-primary)' }}>O que fazer</b>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--t-text-primary)', display: 'grid', gap: 4 }}>{d.porque.acoes.map((x, i) => <li key={i}><b>{x.quem}:</b> {x.o_que}</li>)}</ul></>}
          </>
        )}
        <span style={muted}>A Vitória recebe este painel e a leitura do Rafael na reunião de segunda e decide as providências.</span>
      </section>
    </div>
  );
}
