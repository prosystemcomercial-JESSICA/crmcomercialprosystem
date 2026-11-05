'use client';

// Consumo das IAs pagas em reais (pedido da Jessica, 05/11/2026: "quero saber tudo sobre o consumo... passar o
// mouse e ver os gráficos"). Total do mês, média, previsão, dias de pico, por assistente, por IA e por dia da
// semana. Os números vêm prontos de GET /relatorios/desempenho (ia.custo); aqui só se agrupa e desenha.

import { useMemo, useState } from 'react';

export type DiaCusto = { dia: string; brl: number; openai_brl: number; grok_brl: number; estimado: boolean; chamadas_pagas: number; agentes: Record<string, number>; futuro?: boolean };
export type AgenteCusto = { agente: string; nome: string; brl: number; pct: number; openai_brl: number; grok_brl: number; chamadas_pagas: number; tokens: number; brl_por_chamada: number };
export type CustoIa = {
  brl: number; usd: number; openai_brl: number; grok_brl: number; estimado: boolean;
  media_dia: number; dias_medidos: number; dias_com_gasto: number;
  por_dia: DiaCusto[]; top_dias: DiaCusto[]; por_agente: AgenteCusto[];
  mes: {
    mes: string; brl: number; openai_brl: number; grok_brl: number; media_dia: number; dias_decorridos: number; dias_no_mes: number; projecao_brl: number;
    por_dia: DiaCusto[]; anterior: { mes: string; brl: number; dias_com_dados: number; media_dia: number };
  };
  dados_desde: string | null;
  cotacao: { valor: number; em: string; fonte: 'fixa' | 'bcb' | 'frankfurter' | 'guardada' | 'aproximada' };
  precos: { openai: { modelo: string; entrada?: number; saida?: number }; grok: { modelo: string; entrada?: number; saida?: number } };
};

// Mesmas cores do gráfico "Pedidos às IAs por dia": a cor segue a IA, não a posição.
const COR = { openai: '#2563eb', grok: '#475569' };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const reais = (n: number, casas = 2) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmt = (n: number) => n.toLocaleString('pt-BR');
const diaBr = (dia: string) => dia.split('-').reverse().slice(0, 2).join('/');
const diaSemana = (dia: string) => new Date(`${dia}T12:00:00`).getDay();
const nomeMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1] || mes;

type Dica = { x: number; y: number; titulo: string; linhas: { rotulo: string; valor: string; cor?: string }[]; nota?: string };

function Dica({ d }: { d: Dica | null }) {
  if (!d) return null;
  return (
    <div role="tooltip" style={{
      position: 'fixed', left: Math.min(d.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 250), top: d.y + 14, zIndex: 50, pointerEvents: 'none',
      minWidth: 190, maxWidth: 240, padding: '8px 10px', borderRadius: 8, background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)',
      boxShadow: '0 6px 20px rgba(0,0,0,.18)', fontSize: 12, color: 'var(--t-text-secondary)',
    }}>
      <div style={{ fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 4 }}>{d.titulo}</div>
      {d.linhas.map(l => (
        <div key={l.rotulo} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {l.cor && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: l.cor }} />}{l.rotulo}
          </span>
          <strong style={{ color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{l.valor}</strong>
        </div>
      ))}
      {d.nota && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--t-text-muted)' }}>{d.nota}</div>}
    </div>
  );
}

function Tile({ rotulo, valor, sub, destaque }: { rotulo: string; valor: string; sub?: string; destaque?: boolean }) {
  return (
    <div className="ps-card" style={{ padding: 12, borderRadius: 12, minWidth: 0, borderLeft: destaque ? '4px solid #d97706' : undefined }}>
      <div style={{ fontSize: 12, color: 'var(--t-text-muted)', fontWeight: 600 }}>{rotulo}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--t-text-secondary)' }}>{sub}</div>}
    </div>
  );
}

const cartao: React.CSSProperties = { padding: 14, borderRadius: 12, minWidth: 0 };
const titulo: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' };
const chip = (ativo: boolean): React.CSSProperties => ({
  minHeight: 30, padding: '0 12px', borderRadius: 15, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${ativo ? 'var(--t-primary)' : 'var(--t-card-border)'}`, background: ativo ? 'var(--t-primary)' : 'var(--t-card-bg)', color: ativo ? '#fff' : 'var(--t-text-secondary)',
});

export function ConsumoIa({ c, diasPeriodo }: { c: CustoIa; diasPeriodo: number }) {
  const [visao, setVisao] = useState<'mes' | 'periodo'>('mes');
  const [agenteSel, setAgenteSel] = useState<string | null>(null);
  const [diaHover, setDiaHover] = useState<string | null>(null);
  const [dica, setDica] = useState<Dica | null>(null);

  const nomes = useMemo(() => Object.fromEntries(c.por_agente.map(a => [a.agente, a.nome])), [c.por_agente]);
  const nome = (id: string) => nomes[id] || id;
  const dias = visao === 'mes' ? c.mes.por_dia : c.por_dia;
  const passados = dias.filter(d => !d.futuro);
  const valorDia = (d: DiaCusto) => (agenteSel ? d.agentes[agenteSel] || 0 : d.brl);
  const totalVisao = passados.reduce((s, d) => s + valorDia(d), 0);
  const medidos = passados.filter(d => c.dados_desde && d.dia >= c.dados_desde);
  const mediaVisao = medidos.length ? totalVisao / medidos.length : 0;
  const maxDia = Math.max(0.01, ...passados.map(valorDia));

  // Ranking "no que mais gastamos" a partir dos dias da visão (vale para o mês e para o período).
  const ranking = useMemo(() => {
    const soma: Record<string, number> = {};
    for (const d of passados) for (const [a, v] of Object.entries(d.agentes)) soma[a] = (soma[a] || 0) + v;
    const total = Object.values(soma).reduce((s, v) => s + v, 0);
    return Object.entries(soma).map(([agente, brl]) => ({ agente, brl, pct: total ? (brl / total) * 100 : 0 })).sort((a, b) => b.brl - a.brl);
  }, [passados]);
  const maxRank = Math.max(0.01, ...ranking.map(r => r.brl));
  const detalheAgente = (id: string) => (visao === 'periodo' ? c.por_agente.find(a => a.agente === id) : undefined);

  const openaiVisao = passados.reduce((s, d) => s + d.openai_brl, 0), grokVisao = passados.reduce((s, d) => s + d.grok_brl, 0);
  const topDias = [...passados].filter(d => valorDia(d) > 0).sort((a, b) => valorDia(b) - valorDia(a)).slice(0, 5);
  const pico = topDias[0];

  // Média por dia da semana (só dias já medidos).
  const semana = SEMANA.map((_, i) => {
    const ds = medidos.filter(d => diaSemana(d.dia) === i);
    return { i, media: ds.length ? ds.reduce((s, d) => s + valorDia(d), 0) / ds.length : 0, n: ds.length };
  });
  const maxSemana = Math.max(0.01, ...semana.map(s => s.media));

  const variacao = c.mes.anterior.media_dia ? ((c.mes.media_dia - c.mes.anterior.media_dia) / c.mes.anterior.media_dia) * 100 : null;
  const quem = ranking[0];
  const chamadasPagas = passados.reduce((s, d) => s + d.chamadas_pagas, 0);
  const porChamada = chamadasPagas ? (openaiVisao + grokVisao) / chamadasPagas : 0;

  const mover = (e: React.MouseEvent | React.FocusEvent, d: Omit<Dica, 'x' | 'y'>) => {
    const r = 'clientX' in e ? { x: e.clientX, y: e.clientY } : (() => { const b = (e.target as HTMLElement).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top }; })();
    setDica({ ...d, ...r });
  };
  const sair = () => { setDica(null); setDiaHover(null); };

  const dicaDia = (d: DiaCusto): Omit<Dica, 'x' | 'y'> => {
    const top = Object.entries(d.agentes).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return {
      titulo: `${SEMANA[diaSemana(d.dia)]}, ${diaBr(d.dia)}`,
      linhas: d.futuro ? [{ rotulo: 'Ainda não chegou', valor: '' }] : [
        ...(agenteSel ? [{ rotulo: nome(agenteSel), valor: reais(d.agentes[agenteSel] || 0) }] : []),
        { rotulo: 'Total do dia', valor: reais(d.brl) },
        { rotulo: 'OpenAI', valor: reais(d.openai_brl), cor: COR.openai },
        { rotulo: 'Grok', valor: reais(d.grok_brl), cor: COR.grok },
        { rotulo: 'Chamadas pagas', valor: fmt(d.chamadas_pagas) },
        ...top.map(([a, v], i) => ({ rotulo: `${i + 1}º ${nome(a)}`, valor: reais(v) })),
      ],
      nota: d.futuro ? undefined : `${d.brl > mediaVisao * 1.5 && mediaVisao > 0 ? '⬆ bem acima da média. ' : ''}${d.estimado ? 'Valor estimado (antes da medição).' : ''}`.trim() || undefined,
    };
  };

  const cot = c.cotacao.fonte === 'fixa' ? 'cotação fixa do servidor' : c.cotacao.fonte === 'aproximada' ? 'cotação aproximada (sem internet)'
    : `${c.cotacao.fonte === 'frankfurter' ? 'Banco Central Europeu' : 'Banco Central'}${c.cotacao.em ? `, ${c.cotacao.em.length > 10 ? new Date(c.cotacao.em.replace(' ', 'T')).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : diaBr(c.cotacao.em)}` : ''}`;
  const preco = (p: { modelo: string; entrada?: number; saida?: number }) => (p.entrada != null ? `${p.modelo}: US$ ${p.entrada} (enviados) e US$ ${p.saida} (recebidos) por milhão de tokens` : `${p.modelo}: sem preço cadastrado`);
  const rotuloVisao = visao === 'mes' ? `${nomeMes(c.mes.mes)}` : diasPeriodo === 1 ? 'hoje' : `últimos ${diasPeriodo} dias`;

  return (
    <div style={{ display: 'grid', gap: 10 }} onMouseLeave={sair}>
      <Dica d={dica} />

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ ...titulo, fontSize: 15 }}>💰 Consumo das IAs pagas em reais</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="O que mostrar">
          <button type="button" style={chip(visao === 'mes')} aria-pressed={visao === 'mes'} onClick={() => setVisao('mes')}>Este mês ({nomeMes(c.mes.mes)})</button>
          <button type="button" style={chip(visao === 'periodo')} aria-pressed={visao === 'periodo'} onClick={() => setVisao('periodo')}>Período escolhido ({diasPeriodo === 1 ? 'hoje' : `${diasPeriodo} dias`})</button>
          {agenteSel && <button type="button" style={chip(true)} onClick={() => setAgenteSel(null)} aria-label="Tirar o filtro do assistente">Só {nome(agenteSel)} ✕</button>}
        </div>
      </div>

      <section style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Tile destaque rotulo={`Gasto em ${nomeMes(c.mes.mes)}`} valor={reais(c.mes.brl)}
          sub={`OpenAI ${reais(c.mes.openai_brl)} · Grok ${reais(c.mes.grok_brl)}`} />
        <Tile rotulo="Média por dia (mês)" valor={reais(c.mes.media_dia)}
          sub={variacao == null ? `${c.mes.dias_decorridos} dias até hoje` : `${variacao >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(variacao))}% vs ${nomeMes(c.mes.anterior.mes)} (${reais(c.mes.anterior.media_dia)}/dia)`} />
        <Tile rotulo="Previsão do mês" valor={reais(c.mes.projecao_brl)} sub={`no ritmo atual, ${c.mes.dias_no_mes} dias`} />
        <Tile rotulo={`${nomeMes(c.mes.anterior.mes)[0].toUpperCase()}${nomeMes(c.mes.anterior.mes).slice(1)} (mês passado)`} valor={reais(c.mes.anterior.brl)}
          sub={c.mes.anterior.dias_com_dados ? `${c.mes.anterior.dias_com_dados} dias com contagem` : 'sem contagem nesse mês'} />
        <Tile rotulo={`Dia de maior gasto (${rotuloVisao})`} valor={pico ? reais(valorDia(pico)) : '—'}
          sub={pico ? `${SEMANA[diaSemana(pico.dia)]}, ${diaBr(pico.dia)}${!agenteSel && Object.keys(pico.agentes).length ? ` · mais: ${nome(Object.entries(pico.agentes).sort((a, b) => b[1] - a[1])[0][0])}` : ''}` : 'nenhum gasto'} />
        <Tile rotulo={`Quem mais gastou (${rotuloVisao})`} valor={quem ? nome(quem.agente) : '—'} sub={quem ? `${reais(quem.brl)} · ${Math.round(quem.pct)}% do total` : 'nenhum gasto'} />
        <Tile rotulo="Custo por chamada paga" valor={reais(porChamada, 4)} sub={`${fmt(chamadasPagas)} chamadas pagas (${rotuloVisao})`} />
      </section>

      {/* Gasto por dia: colunas OpenAI + Grok, linha da média, passe o mouse para o detalhe. */}
      <div className="ps-card" style={cartao}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <div style={titulo}>Gasto por dia{agenteSel ? `: ${nome(agenteSel)}` : ''} <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--t-text-muted)' }}>· {rotuloVisao} · total {reais(totalVisao)} · média {reais(mediaVisao)}/dia</span></div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--t-text-secondary)' }}>
            {!agenteSel && <><span><span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: COR.openai, marginRight: 4 }} />OpenAI</span>
              <span><span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: COR.grok, marginRight: 4 }} />Grok</span></>}
            <span><span aria-hidden style={{ display: 'inline-block', width: 14, borderTop: '2px dashed #d97706', marginRight: 4, verticalAlign: 'middle' }} />média</span>
          </div>
        </div>
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '52px 1fr', gap: 6, marginTop: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 10, color: 'var(--t-text-muted)', textAlign: 'right', height: 180, fontVariantNumeric: 'tabular-nums' }}>
            <span>{reais(maxDia)}</span><span>{reais(maxDia / 2)}</span><span>R$ 0</span>
          </div>
          <div style={{ position: 'relative', height: 180, borderBottom: '1px solid var(--t-card-border)' }}>
            {[0.5, 1].map(f => <div key={f} aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: `${f * 100}%`, borderTop: '1px solid var(--t-card-border)', opacity: 0.5 }} />)}
            {mediaVisao > 0 && <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: `${(mediaVisao / maxDia) * 100}%`, borderTop: '2px dashed #d97706', zIndex: 2, pointerEvents: 'none' }} />}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: dias.length > 45 ? 1 : 3 }}>
              {dias.map(d => {
                const v = valorDia(d), alto = (v / maxDia) * 100;
                const ehPico = pico && d.dia === pico.dia;
                const ativo = diaHover === d.dia;
                const pOpenai = agenteSel ? 1 : d.brl ? d.openai_brl / d.brl : 1;
                return (
                  <button key={d.dia} type="button" aria-label={`${diaBr(d.dia)}: ${reais(v)}`}
                    onMouseMove={e => { setDiaHover(d.dia); mover(e, dicaDia(d)); }} onFocus={e => { setDiaHover(d.dia); mover(e, dicaDia(d)); }} onBlur={sair}
                    style={{ flex: 1, minWidth: 0, height: '100%', padding: 0, border: 'none', background: ativo ? 'var(--t-surface-hover, rgba(0,0,0,.05))' : 'transparent', cursor: 'default', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'stretch', position: 'relative', borderRadius: 4 }}>
                    {ehPico && v > 0 && <span style={{ position: 'absolute', bottom: `calc(${alto}% + 2px)`, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: 'var(--t-text-primary)', whiteSpace: 'nowrap' }}>{reais(v)}</span>}
                    {d.futuro ? <div style={{ height: 2, background: 'var(--t-card-border)', borderRadius: 2 }} /> : (
                      <div style={{ height: `${Math.max(v > 0 ? 2 : 0, alto)}%`, display: 'flex', flexDirection: 'column', borderRadius: '4px 4px 0 0', overflow: 'hidden', opacity: d.estimado ? 0.55 : 1, outline: ativo ? '2px solid var(--t-text-primary)' : undefined }}>
                        {!agenteSel && d.grok_brl > 0 && <div style={{ flex: 1 - pOpenai, background: COR.grok, borderBottom: '2px solid var(--t-card-bg)' }} />}
                        <div style={{ flex: pOpenai, background: agenteSel ? '#d97706' : COR.openai }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t-text-muted)' }}>
            <span>{dias[0] && diaBr(dias[0].dia)}</span>{dias.length > 2 && <span>{diaBr(dias[Math.floor(dias.length / 2)].dia)}</span>}<span>{dias.length > 1 && diaBr(dias[dias.length - 1].dia)}</span>
          </div>
        </div>
        {passados.some(d => d.estimado) && <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 6 }}>Colunas mais claras = valor estimado (antes de 05/11/2026 o custo não era gravado). {c.dados_desde ? `Contagem desde ${diaBr(c.dados_desde)}/${c.dados_desde.slice(0, 4)}.` : ''}</div>}
      </div>

      <section style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* No que mais gastamos: clique para ver só aquele assistente no gráfico de dias. */}
        <div className="ps-card" style={cartao}>
          <div style={titulo}>No que mais gastamos <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--t-text-muted)' }}>· clique para ver o dia a dia</span></div>
          {!ranking.length && <div style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 8 }}>Nenhum gasto em {rotuloVisao}.</div>}
          <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
            {ranking.map(r => {
              const det = detalheAgente(r.agente);
              const marcado = agenteSel === r.agente;
              return (
                <button key={r.agente} type="button" aria-pressed={marcado} onClick={() => setAgenteSel(s => (s === r.agente ? null : r.agente))}
                  onMouseMove={e => mover(e, { titulo: nome(r.agente), linhas: [
                    { rotulo: 'Gasto', valor: reais(r.brl) }, { rotulo: 'Parte do total', valor: `${r.pct.toFixed(1).replace('.', ',')}%` },
                    ...(det ? [{ rotulo: 'OpenAI', valor: reais(det.openai_brl), cor: COR.openai }, { rotulo: 'Grok', valor: reais(det.grok_brl), cor: COR.grok }, { rotulo: 'Chamadas pagas', valor: fmt(det.chamadas_pagas) }, { rotulo: 'Por chamada', valor: reais(det.brl_por_chamada, 4) }, { rotulo: 'Tokens (todas as IAs)', valor: fmt(det.tokens) }] : []),
                  ], nota: 'Clique para ver só este assistente no gráfico.' })}
                  onMouseLeave={() => setDica(null)}
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 140px) 1fr 92px', gap: 8, alignItems: 'center', padding: '4px 6px', borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left', background: marcado ? 'var(--t-surface-hover, rgba(0,0,0,.06))' : 'transparent', outline: marcado ? '2px solid #d97706' : undefined }}>
                  <span style={{ fontSize: 12, color: 'var(--t-text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome(r.agente)}</span>
                  <span style={{ height: 12, background: 'var(--t-card-border)', borderRadius: 4, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${(r.brl / maxRank) * 100}%`, background: '#d97706', borderRadius: 4 }} /></span>
                  <span style={{ fontSize: 12, color: 'var(--t-text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{reais(r.brl)} <span style={{ color: 'var(--t-text-muted)' }}>{Math.round(r.pct)}%</span></span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dias de maior gasto: passe o mouse para destacar a coluna no gráfico. */}
        <div className="ps-card" style={cartao}>
          <div style={titulo}>Dias de maior gasto <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--t-text-muted)' }}>· {rotuloVisao}</span></div>
          {!topDias.length && <div style={{ fontSize: 13, color: 'var(--t-text-muted)', marginTop: 8 }}>Nenhum gasto em {rotuloVisao}.</div>}
          <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 4 }}>
            {topDias.map((d, i) => {
              const principal = Object.entries(d.agentes).sort((a, b) => b[1] - a[1])[0];
              return (
                <li key={d.dia} tabIndex={0} onMouseMove={e => { setDiaHover(d.dia); mover(e, dicaDia(d)); }} onFocus={e => { setDiaHover(d.dia); mover(e, dicaDia(d)); }} onMouseLeave={sair} onBlur={sair}
                  style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: 8, alignItems: 'center', padding: '6px 8px', borderRadius: 6, background: diaHover === d.dia ? 'var(--t-surface-hover, rgba(0,0,0,.06))' : 'transparent', cursor: 'default' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? '#d97706' : 'var(--t-text-muted)' }}>{i + 1}º</span>
                  <span style={{ fontSize: 12, color: 'var(--t-text-primary)' }}>{SEMANA[diaSemana(d.dia)]}, {diaBr(d.dia)}{principal && !agenteSel ? <span style={{ color: 'var(--t-text-muted)' }}> · {nome(principal[0])}</span> : null}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{reais(valorDia(d))}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Por IA paga: uma barra dividida, com a parte de cada uma. */}
        <div className="ps-card" style={cartao}>
          <div style={titulo}>Por IA paga <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--t-text-muted)' }}>· {rotuloVisao}</span></div>
          {(() => {
            const t = openaiVisao + grokVisao;
            const partes = [{ id: 'openai', rotulo: 'OpenAI', v: openaiVisao, cor: COR.openai, modelo: c.precos.openai.modelo }, { id: 'grok', rotulo: 'Grok', v: grokVisao, cor: COR.grok, modelo: c.precos.grok.modelo }];
            return (
              <>
                <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', marginTop: 10, background: 'var(--t-card-border)', gap: t && openaiVisao && grokVisao ? 2 : 0 }}>
                  {partes.filter(p => p.v > 0).map(p => (
                    <div key={p.id} style={{ width: `${(p.v / (t || 1)) * 100}%`, background: p.cor }}
                      onMouseMove={e => mover(e, { titulo: `${p.rotulo} (${p.modelo})`, linhas: [{ rotulo: 'Gasto', valor: reais(p.v), cor: p.cor }, { rotulo: 'Parte', valor: `${Math.round((p.v / (t || 1)) * 100)}%` }] })} onMouseLeave={() => setDica(null)} />
                  ))}
                </div>
                <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                  {partes.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t-text-secondary)' }}>
                      <span><span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: p.cor, marginRight: 6 }} />{p.rotulo} <span style={{ color: 'var(--t-text-muted)' }}>({p.modelo})</span></span>
                      <strong style={{ color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{reais(p.v)} · {t ? Math.round((p.v / t) * 100) : 0}%</strong>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
          <div style={{ ...titulo, fontSize: 13, marginTop: 14 }}>Média por dia da semana</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, alignItems: 'end', height: 90, marginTop: 6 }}>
            {semana.map(s => (
              <div key={s.i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-end', height: '100%' }}
                onMouseMove={e => mover(e, { titulo: SEMANA[s.i], linhas: [{ rotulo: 'Média do dia', valor: reais(s.media) }, { rotulo: 'Dias contados', valor: fmt(s.n) }] })} onMouseLeave={() => setDica(null)}>
                <div style={{ height: `${(s.media / maxSemana) * 100}%`, minHeight: s.media ? 2 : 0, background: '#d97706', borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, fontSize: 10, color: 'var(--t-text-muted)', textAlign: 'center', marginTop: 2 }}>
            {SEMANA_CURTA.map(s => <span key={s}>{s}</span>)}
          </div>
        </div>
      </section>

      <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
        Dólar a {reais(c.cotacao.valor)} ({cot}). Valor calculado pelo preço de tabela × tokens gastos ({preco(c.precos.openai)}; {preco(c.precos.grok)}). A fatura da OpenAI e da xAI pode vir um pouco menor, por desconto de cache. As IAs grátis (Groq, OpenRouter, Gemini, Whisper, Laya) não entram.
      </div>
    </div>
  );
}
