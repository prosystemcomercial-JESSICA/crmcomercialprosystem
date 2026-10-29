'use client';

// Desempenho unificado do setor: agentes de IA, suas intervenções, compromissos, propostas e uso
// das IAs, no mesmo período. Usado na tela /desempenho e na janela "Métricas da IA" do Escritório.
// Gráficos simples e legíveis: uma cor por gráfico, nome escrito em cada barra, valores visíveis,
// status sempre com ícone + texto, e tabela com os números.
// Interativo (29/10/2026, pedido da Jessica): abas, período "Hoje" que se atualiza sozinho, cartões
// que abrem o detalhe, clique no agente mostra o funil dele, gráfico por dia com fontes ligáveis e
// detalhe do dia, tabelas ordenáveis por coluna.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Agente = { agente: string; nome: string; leads: number; contatados: number; responderam: number; efetivos: number; demos: number; sem_interesse: number; assumidas_por_pessoa: number; taxa_resposta: number; taxa_efetivo: number };
type UsoAgente = { agente: string; nome: string; openai: number; grok: number; whisper: number; groq?: number; groq_reserva?: number; gemini?: number; openrouter?: number; falhas: number; tokens_entrada: number; tokens_saida: number };
type Dados = {
  periodo: { dias: number };
  agentes: Agente[];
  intervencoes: { aprovadas_sem_mudar: number; editadas: number; refeitas: number; conversas_assumidas: number; automaticas: number; pendentes: number };
  compromissos: { marcados: number; realizados: number; nao_compareceu: number; cancelados: number; remarcados: number; pendentes: number };
  outras_atividades: { tipo: string; quantidade: number }[];
  propostas: { mudancas_de_status: number; por_status: { status: string; quantidade: number }[]; criadas: number };
  ia: {
    por_dia: { dia: string; openai: number; grok: number; laya: number; groq?: number }[]; total: { openai: number; grok: number; laya: number; groq?: number }; sem_custo_pct: number;
    por_agente?: UsoAgente[];
    groq?: { respondidas: number; foram_para_paga: number; tokens: number; ligado: boolean; cota: { limite_dia: number | null; restante_dia: number | null; atualizado_em: number } };
  };
  laya: { acionada: number; confirmacoes: number };
};

type Aba = 'geral' | 'agentes' | 'ia' | 'compromissos';
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'geral', rotulo: '📋 Visão geral' }, { id: 'agentes', rotulo: '🤖 Agentes' },
  { id: 'ia', rotulo: '⚡ Uso da IA' }, { id: 'compromissos', rotulo: '📅 Compromissos e propostas' },
];
const PERIODOS = [{ d: 1, r: 'Hoje' }, { d: 7, r: 'Últimos 7 dias' }, { d: 30, r: 'Últimos 30 dias' }, { d: 90, r: 'Últimos 90 dias' }];
const STATUS_PROPOSTA: Record<string, string> = { ENVIADA: 'Enviada', VISUALIZADA: 'Visualizada', EM_NEGOCIACAO: 'Em negociação', ACEITA: 'Aceita', RECUSADA: 'Recusada', PERDIDA: 'Perdida', EXPIRADA: 'Expirada', RASCUNHO: 'Rascunho', CONTRATO_ENVIADO: 'Contrato enviado', CONTRATO_ASSINADO: 'Contrato assinado', CONTRATO_EM_GERACAO: 'Contrato em geração' };
const fmt = (n: number) => n.toLocaleString('pt-BR');
const diaBr = (dia: string) => dia.split('-').reverse().slice(0, 2).join('/');
const TIPO_ATV: Record<string, string> ={ LIGACAO: 'Ligações', EMAIL: 'E-mails', WHATSAPP: 'WhatsApp', VISITA: 'Visitas', TAREFA: 'Tarefas', OUTRO: 'Outros' };
// Fontes do gráfico por dia: as grátis em tons de verde/rosa, as pagas em azul/cinza.
const FONTES = [
  { id: 'openai', rotulo: 'OpenAI (paga)', cor: '#2563eb' },
  { id: 'grok', rotulo: 'Grok (paga)', cor: '#475569' },
  { id: 'groq', rotulo: 'Groq (grátis)', cor: '#16a34a' },
  { id: 'laya', rotulo: 'Laya (grátis)', cor: '#db2777' },
] as const;
type Fonte = typeof FONTES[number]['id'];

const botaoChip = (ativo: boolean, cor = 'var(--t-primary)'): React.CSSProperties => ({
  minHeight: 34, padding: '0 14px', borderRadius: 17, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${ativo ? cor : 'var(--t-card-border)'}`, background: ativo ? cor : 'var(--t-card-bg)', color: ativo ? '#fff' : 'var(--t-text-secondary)',
});

function Numero({ rotulo, valor, sub, onClick }: { rotulo: string; valor: string | number; sub?: string; onClick?: () => void }) {
  const corpo = (
    <>
      <div style={{ fontSize: 12, color: 'var(--t-text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        <span>{rotulo}</span>{onClick && <span aria-hidden style={{ color: 'var(--t-link)' }}>ver ›</span>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--t-text-secondary)' }}>{sub}</div>}
    </>
  );
  const estilo: React.CSSProperties = { padding: '12px 14px', borderRadius: 12, minWidth: 0, textAlign: 'left', font: 'inherit', width: '100%' };
  return onClick
    ? <button type="button" className="ps-card metr-clicavel" onClick={onClick} style={{ ...estilo, cursor: 'pointer' }}>{corpo}</button>
    : <div className="ps-card" style={estilo}>{corpo}</div>;
}

/** Barras horizontais de uma série só: nome à esquerda, barra com ponta arredondada, valor escrito.
 *  Com `onEscolher`, cada barra vira botão (ex.: clicar no agente abre o funil dele). */
function Barras({ titulo, itens, cor = '#2563eb', sufixo = '', onEscolher, escolhido }: {
  titulo: string; itens: { id?: string; rotulo: string; valor: number; dica?: string }[]; cor?: string; sufixo?: string;
  onEscolher?: (id: string) => void; escolhido?: string | null;
}) {
  const max = Math.max(1, ...itens.map(i => i.valor));
  return (
    <div className="ps-card" style={{ padding: 14, borderRadius: 12, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 10 }}>{titulo}</div>
      {itens.length === 0 && <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Nada no período.</div>}
      <div style={{ display: 'grid', gap: 4 }}>
        {itens.map(i => {
          const id = i.id || i.rotulo;
          const marcado = escolhido === id, apagado = !!escolhido && !marcado;
          const linha = (
            <>
              <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: marcado ? 700 : 400 }}>{i.rotulo}</span>
              <div style={{ height: 14, background: 'var(--t-content-bg)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(i.valor / max) * 100}%`, minWidth: i.valor ? 4 : 0, height: '100%', background: cor, borderRadius: 4, opacity: apagado ? 0.3 : 1, transition: 'width .4s ease, opacity .2s' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)', fontVariantNumeric: 'tabular-nums', minWidth: 32, textAlign: 'right' }}>{i.valor}{sufixo}</span>
            </>
          );
          const grade: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(90px, 32%) 1fr auto', alignItems: 'center', gap: 8, padding: '3px 4px', borderRadius: 6 };
          return onEscolher
            ? <button key={id} type="button" title={i.dica || `${i.rotulo}: ${i.valor}${sufixo}`} aria-pressed={marcado} className="metr-linha" onClick={() => onEscolher(id)}
                style={{ ...grade, border: 'none', background: marcado ? 'var(--t-content-bg)' : 'transparent', cursor: 'pointer', font: 'inherit', textAlign: 'left', width: '100%' }}>{linha}</button>
            : <div key={id} title={i.dica || `${i.rotulo}: ${i.valor}${sufixo}`} style={grade}>{linha}</div>;
        })}
      </div>
    </div>
  );
}

/** Colunas empilhadas por dia, com fontes ligáveis e o detalhe do dia ao passar o mouse ou tocar. */
function GraficoDia({ pontos, fontesDisponiveis }: { pontos: Dados['ia']['por_dia']; fontesDisponiveis: Fonte[] }) {
  const [escondidas, setEscondidas] = useState<Fonte[]>([]);
  const [dia, setDia] = useState<string | null>(null);
  const ligadas = fontesDisponiveis.filter(f => !escondidas.includes(f));
  const fontes = FONTES.filter(f => ligadas.includes(f.id));
  const valor = (p: Dados['ia']['por_dia'][number], f: Fonte) => p[f] || 0;
  const max = Math.max(1, ...pontos.map(p => fontes.reduce((s, f) => s + valor(p, f.id), 0)));
  const atual = pontos.find(p => p.dia === dia) || pontos[pontos.length - 1];
  // Esconde/mostra uma fonte; sempre fica pelo menos uma ligada.
  const alternar = (f: Fonte) => setEscondidas(e => e.includes(f) ? e.filter(x => x !== f) : (ligadas.length > 1 ? [...e, f] : e));

  return (
    <div className="ps-card" style={{ padding: 14, borderRadius: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Pedidos às IAs por dia</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-label="Fontes mostradas">
          {FONTES.filter(f => fontesDisponiveis.includes(f.id)).map(f => {
            const on = ligadas.includes(f.id);
            return (
              <button key={f.id} type="button" aria-pressed={on} onClick={() => alternar(f.id)} title={on ? 'Clique para esconder' : 'Clique para mostrar'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28, padding: '0 10px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--t-card-border)', background: on ? 'var(--t-content-bg)' : 'transparent', color: on ? 'var(--t-text-primary)' : 'var(--t-text-muted)', textDecoration: on ? 'none' : 'line-through' }}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: on ? f.cor : 'transparent', border: `2px solid ${f.cor}` }} />{f.rotulo}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140 }} onMouseLeave={() => setDia(null)}>
        {pontos.map(p => {
          const total = fontes.reduce((s, f) => s + valor(p, f.id), 0);
          const marcado = atual?.dia === p.dia;
          return (
            <button key={p.dia} type="button" onMouseEnter={() => setDia(p.dia)} onFocus={() => setDia(p.dia)} onClick={() => setDia(p.dia)}
              aria-label={`${diaBr(p.dia)}: ${total} pedidos`}
              style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column-reverse', justifyContent: 'flex-start', padding: 0, border: 'none', cursor: 'pointer', background: marcado ? 'var(--t-content-bg)' : 'transparent', borderRadius: 3 }}>
              {fontes.map(f => {
                const v = valor(p, f.id);
                return v ? <div key={f.id} style={{ width: '100%', height: `${(v / max) * 100}%`, minHeight: 2, background: f.cor, opacity: marcado || !dia ? 1 : 0.55, transition: 'height .4s ease' }} /> : null;
              })}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t-text-muted)', marginTop: 4 }}>
        <span>{pontos[0] && diaBr(pontos[0].dia)}</span><span>hoje</span>
      </div>
      {atual && (
        <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--t-content-bg)', fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: '4px 14px', color: 'var(--t-text-primary)' }} aria-live="polite">
          <strong>{diaBr(atual.dia)}{atual.dia === pontos[pontos.length - 1]?.dia ? ' (hoje)' : ''}</strong>
          {FONTES.filter(f => fontesDisponiveis.includes(f.id)).map(f => (
            <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: f.cor }} />{f.rotulo}: <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(valor(atual, f.id))}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tabela com ordenação por coluna (clique no título; de novo inverte). */
function TabelaOrdenavel<T>({ colunas, linhas, chave, ordemInicial, destaque, onLinha }: {
  colunas: { id: string; rotulo: string; valor: (l: T) => number | string; mostrar?: (l: T) => React.ReactNode; cor?: (l: T) => string | undefined }[];
  linhas: T[]; chave: (l: T) => string; ordemInicial?: string; destaque?: string | null; onLinha?: (l: T) => void;
}) {
  const [ordem, setOrdem] = useState<{ col: string; desc: boolean }>({ col: ordemInicial || colunas[0].id, desc: !!ordemInicial });
  const col = colunas.find(c => c.id === ordem.col) || colunas[0];
  const ordenadas = [...linhas].sort((a, b) => {
    const va = col.valor(a), vb = col.valor(b);
    const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR');
    return ordem.desc ? -r : r;
  });
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <thead><tr style={{ color: 'var(--t-text-muted)', textAlign: 'left' }}>
          {colunas.map(c => (
            <th key={c.id} style={{ padding: 0 }} aria-sort={ordem.col === c.id ? (ordem.desc ? 'descending' : 'ascending') : 'none'}>
              <button type="button" onClick={() => setOrdem(o => ({ col: c.id, desc: o.col === c.id ? !o.desc : c.id !== colunas[0].id }))}
                style={{ padding: '6px 8px', whiteSpace: 'nowrap', border: 'none', background: 'transparent', cursor: 'pointer', font: 'inherit', fontWeight: 700, color: ordem.col === c.id ? 'var(--t-text-primary)' : 'inherit' }}>
                {c.rotulo} <span aria-hidden style={{ opacity: ordem.col === c.id ? 1 : 0.3 }}>{ordem.col === c.id ? (ordem.desc ? '▼' : '▲') : '↕'}</span>
              </button>
            </th>
          ))}
        </tr></thead>
        <tbody>{ordenadas.map(l => (
          <tr key={chave(l)} onClick={onLinha ? () => onLinha(l) : undefined} className={onLinha ? 'metr-linha' : undefined}
            style={{ borderTop: '1px solid var(--t-card-border)', color: 'var(--t-text-primary)', cursor: onLinha ? 'pointer' : undefined, background: destaque === chave(l) ? 'var(--t-content-bg)' : undefined }}>
            {colunas.map((c, i) => <td key={c.id} style={{ padding: '6px 8px', fontWeight: i === 0 ? 600 : undefined, color: c.cor?.(l) }}>{c.mostrar ? c.mostrar(l) : typeof c.valor(l) === 'number' ? fmt(c.valor(l) as number) : c.valor(l)}</td>)}
          </tr>))}</tbody>
      </table>
    </div>
  );
}

/** Funil de um agente: contatados → responderam → efetivos → demos, com a % de cada passo. */
function FunilAgente({ a, onFechar }: { a: Agente; onFechar: () => void }) {
  const passos = [
    { rotulo: 'Leads com o agente', valor: a.leads, cor: '#94a3b8' },
    { rotulo: 'Contatados', valor: a.contatados, cor: '#60a5fa' },
    { rotulo: 'Responderam', valor: a.responderam, cor: '#2563eb' },
    { rotulo: 'Efetivos', valor: a.efetivos, cor: '#16a34a' },
    { rotulo: 'Demonstrações', valor: a.demos, cor: '#7c3aed' },
  ];
  const max = Math.max(1, passos[0].valor);
  return (
    <div className="ps-card" style={{ padding: 14, borderRadius: 12, minWidth: 0, borderLeft: '4px solid #2563eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Funil de {a.nome}</div>
        <button type="button" onClick={onFechar} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--t-link)', fontSize: 12, fontWeight: 600 }}>Ver todos</button>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {passos.map((p, i) => {
          const ant = i > 0 ? passos[i - 1].valor : 0;
          return (
            <div key={p.rotulo} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 30%) 1fr auto', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{p.rotulo}</span>
              <div style={{ height: 20, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: `${Math.max(p.valor ? 3 : 0, (p.valor / max) * 100)}%`, height: '100%', background: p.cor, borderRadius: 4, transition: 'width .4s ease' }} />
              </div>
              <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', minWidth: 90, textAlign: 'right', color: 'var(--t-text-primary)' }}>
                <b>{fmt(p.valor)}</b>{i > 0 && <span style={{ color: 'var(--t-text-muted)' }}> · {ant ? Math.round((p.valor / ant) * 100) : 0}%</span>}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 8 }}>
        A % é em relação ao passo de cima. {a.sem_interesse} sem interesse · {a.assumidas_por_pessoa} conversas assumidas por uma pessoa.
      </div>
    </div>
  );
}

export default function PainelDesempenho({ compacto = false }: { compacto?: boolean }) {
  const [dias, setDias] = useState(30);
  const [aba, setAba] = useState<Aba>('geral');
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<{ pedido: string; texto: string } | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  // Cada busca tem uma chave (período + nº do pedido); "carregando" = a última chave ainda não voltou.
  const [tique, setTique] = useState(0);
  const [respondido, setRespondido] = useState<string | null>(null);
  const pedido = `${dias}-${tique}`;
  const carregando = respondido !== pedido;
  const carregar = useCallback(() => setTique(t => t + 1), []);
  const [agenteSel, setAgenteSel] = useState<string | null>(null);
  const [usoSel, setUsoSel] = useState<string | null>(null);
  const [soFalhas, setSoFalhas] = useState(false);

  useEffect(() => {
    let vivo = true;
    apiClient.relatorioDesempenho(dias)
      .then(r => { if (vivo) { setD(r.data.data); setAtualizadoEm(new Date()); setErro(null); } })
      .catch(e => { if (vivo) setErro({ pedido, texto: e?.response?.status === 403 ? 'Só a gestão vê o desempenho.' : 'Não foi possível carregar agora.' }); })
      .finally(() => { if (vivo) setRespondido(pedido); });
    return () => { vivo = false; };
  }, [dias, pedido]);
  // "Hoje" se atualiza sozinho a cada minuto (só com a aba do navegador visível).
  useEffect(() => {
    if (dias !== 1) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') carregar(); }, 60000);
    return () => clearInterval(t);
  }, [dias, carregar]);

  const fontesDisponiveis = useMemo<Fonte[]>(() => (d?.ia.groq?.ligado ? ['openai', 'grok', 'groq', 'laya'] : ['openai', 'grok', 'laya']), [d?.ia.groq?.ligado]);

  const grade = (min: number): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`, gap: 10 });
  const totalIntervencoes = d ? d.intervencoes.editadas + d.intervencoes.refeitas + d.intervencoes.conversas_assumidas : 0;
  const agente = d?.agentes.find(a => a.agente === agenteSel) || null;
  const verAgente = (id: string) => { setAgenteSel(s => (s === id ? null : id)); setAba('agentes'); };
  const usoAgentes = (d?.ia.por_agente || []).filter(a => !soFalhas || a.falhas);
  const usoEscolhido = (d?.ia.por_agente || []).find(a => a.agente === usoSel) || null;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <style>{`
        .metr-clicavel { transition: transform .15s ease, box-shadow .15s ease; }
        .metr-clicavel:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,.08); }
        .metr-linha:hover { background: var(--t-content-bg) !important; }
        @media (prefers-reduced-motion: reduce) { .metr-clicavel, .metr-clicavel:hover { transition: none; transform: none; } }
      `}</style>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="tablist" aria-label="Período" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PERIODOS.map(p => (
            <button key={p.d} role="tab" aria-selected={dias === p.d} onClick={() => setDias(p.d)} style={botaoChip(dias === p.d)}>{p.r}</button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
          {carregando ? 'Atualizando…' : atualizadoEm ? `Atualizado às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${dias === 1 ? ' · atualiza sozinho a cada minuto' : ''}` : ''}
        </span>
        <button type="button" onClick={carregar} disabled={carregando} aria-label="Atualizar agora" title="Atualizar agora" style={{ ...botaoChip(false), opacity: carregando ? 0.6 : 1 }}>↻ Atualizar</button>
      </div>

      {erro && <div style={{ color: '#dc2626', fontSize: 13 }}>{erro.texto} <button type="button" onClick={carregar} style={{ border: 'none', background: 'transparent', color: 'var(--t-link)', cursor: 'pointer', fontWeight: 600 }}>Tentar de novo</button></div>}
      {!d && !erro && <div style={{ color: 'var(--t-text-muted)', fontSize: 13 }}>Carregando…</div>}
      {d && (
        <>
          <section style={{ ...grade(150), opacity: carregando ? 0.6 : 1, transition: 'opacity .2s' }}>
            <Numero rotulo="Leads com os agentes" valor={fmt(d.agentes.reduce((s, a) => s + a.leads, 0))} sub={`${d.agentes.reduce((s, a) => s + a.contatados, 0)} contatados`} onClick={() => { setAgenteSel(null); setAba('agentes'); }} />
            <Numero rotulo="Efetivos" valor={fmt(d.agentes.reduce((s, a) => s + a.efetivos, 0))} sub="demo, vendedora ou nota ≥ 60" onClick={() => { setAgenteSel(null); setAba('agentes'); }} />
            <Numero rotulo="Demonstrações marcadas" valor={d.compromissos.marcados} sub={`${d.compromissos.realizados} realizadas · ${d.compromissos.nao_compareceu} não compareceu`} onClick={() => setAba('compromissos')} />
            <Numero rotulo="Suas intervenções" valor={totalIntervencoes} sub={`${d.intervencoes.editadas} editadas · ${d.intervencoes.refeitas} refeitas · ${d.intervencoes.conversas_assumidas} assumidas`} onClick={() => setAba('geral')} />
            <Numero rotulo="Laya acionada" valor={fmt(d.laya.acionada)} sub={`${d.laya.confirmacoes} confirmações suas`} onClick={() => setAba('ia')} />
            <Numero rotulo="IA sem custo" valor={`${d.ia.sem_custo_pct}%`} sub={`${d.ia.total.openai} chamadas à OpenAI (paga)`} onClick={() => setAba('ia')} />
            {d.ia.groq?.ligado && <Numero rotulo="Groq (grátis) respondeu" valor={fmt(d.ia.groq.respondidas)} onClick={() => setAba('ia')}
              sub={`${fmt(d.ia.groq.tokens)} tokens sem custo · ${fmt(d.ia.groq.foram_para_paga)} foram para a paga${d.ia.groq.cota.restante_dia != null && d.ia.groq.cota.limite_dia ? ` · cota: ${fmt(d.ia.groq.cota.restante_dia)} de ${fmt(d.ia.groq.cota.limite_dia)} pedidos/dia` : ''}`} />}
          </section>

          <div role="tablist" aria-label="Assunto" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--t-card-border)' }}>
            {ABAS.map(a => (
              <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
                style={{ padding: '8px 14px', border: 'none', borderBottom: `3px solid ${aba === a.id ? 'var(--t-primary)' : 'transparent'}`, marginBottom: -1, background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: aba === a.id ? 800 : 600, color: aba === a.id ? 'var(--t-text-primary)' : 'var(--t-text-muted)' }}>
                {a.rotulo}
              </button>
            ))}
          </div>

          {aba === 'geral' && (
            <section style={grade(300)}>
              <Barras titulo="Leads que responderam, por agente (clique para ver o funil)" onEscolher={verAgente} escolhido={agenteSel}
                itens={d.agentes.map(a => ({ id: a.agente, rotulo: a.nome, valor: a.responderam, dica: `${a.nome}: ${a.responderam} de ${a.contatados} contatados (${a.taxa_resposta}%)` }))} />
              <Barras titulo="Mensagens dos agentes: sua decisão" cor="#475569" itens={[
                { rotulo: 'Aprovadas sem mudar', valor: d.intervencoes.aprovadas_sem_mudar },
                { rotulo: 'Editadas por você', valor: d.intervencoes.editadas },
                { rotulo: 'Refeitas', valor: d.intervencoes.refeitas },
                { rotulo: 'Enviadas sozinhas', valor: d.intervencoes.automaticas },
              ]} />
              <GraficoDia pontos={d.ia.por_dia} fontesDisponiveis={fontesDisponiveis} />
            </section>
          )}

          {aba === 'agentes' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} aria-label="Escolher agente">
                <button type="button" onClick={() => setAgenteSel(null)} aria-pressed={!agenteSel} style={botaoChip(!agenteSel)}>Todos</button>
                {d.agentes.map(a => <button key={a.agente} type="button" aria-pressed={agenteSel === a.agente} onClick={() => setAgenteSel(s => s === a.agente ? null : a.agente)} style={botaoChip(agenteSel === a.agente)}>{a.nome}</button>)}
              </div>
              <section style={grade(300)}>
                {agente && <FunilAgente a={agente} onFechar={() => setAgenteSel(null)} />}
                <Barras titulo="Leads que responderam, por agente" onEscolher={verAgente} escolhido={agenteSel} itens={d.agentes.map(a => ({ id: a.agente, rotulo: a.nome, valor: a.responderam, dica: `${a.nome}: ${a.responderam} de ${a.contatados} contatados (${a.taxa_resposta}%)` }))} />
                <Barras titulo="Leads efetivos, por agente" cor="#16a34a" onEscolher={verAgente} escolhido={agenteSel} itens={d.agentes.map(a => ({ id: a.agente, rotulo: a.nome, valor: a.efetivos, dica: `${a.nome}: ${a.efetivos} efetivos (${a.taxa_efetivo}% dos contatados)` }))} />
                {!agente && <Barras titulo="% de resposta, por agente" cor="#0891b2" sufixo="%" onEscolher={verAgente} escolhido={agenteSel} itens={d.agentes.map(a => ({ id: a.agente, rotulo: a.nome, valor: a.taxa_resposta }))} />}
              </section>
              <div className="ps-card" style={{ padding: 12, borderRadius: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 6 }}>Os números de cada agente <span style={{ fontWeight: 400, color: 'var(--t-text-muted)', fontSize: 11 }}>· clique no título da coluna para ordenar, na linha para ver o funil</span></div>
                <TabelaOrdenavel<Agente> linhas={d.agentes} chave={a => a.agente} destaque={agenteSel} onLinha={a => setAgenteSel(s => s === a.agente ? null : a.agente)} ordemInicial="efetivos" colunas={[
                  { id: 'nome', rotulo: 'Agente', valor: a => a.nome },
                  { id: 'leads', rotulo: 'Leads', valor: a => a.leads },
                  { id: 'contatados', rotulo: 'Contatados', valor: a => a.contatados },
                  { id: 'responderam', rotulo: 'Responderam', valor: a => a.responderam },
                  { id: 'taxa_resposta', rotulo: '% resposta', valor: a => a.taxa_resposta, mostrar: a => `${a.taxa_resposta}%` },
                  { id: 'efetivos', rotulo: 'Efetivos', valor: a => a.efetivos, cor: a => a.efetivos ? '#16a34a' : undefined },
                  { id: 'taxa_efetivo', rotulo: '% efetivo', valor: a => a.taxa_efetivo, mostrar: a => `${a.taxa_efetivo}%` },
                  { id: 'demos', rotulo: 'Demos', valor: a => a.demos },
                  { id: 'sem_interesse', rotulo: 'Sem interesse', valor: a => a.sem_interesse },
                  { id: 'assumidas', rotulo: 'Assumidas por pessoa', valor: a => a.assumidas_por_pessoa },
                ]} />
              </div>
            </div>
          )}

          {aba === 'ia' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <GraficoDia pontos={d.ia.por_dia} fontesDisponiveis={fontesDisponiveis} />
              {/* Uso da IA por assistente (contado desde 29/10/2026): quem fez cada requisição, falhas e tokens. */}
              <section style={grade(300)}>
                <Barras titulo="Requisições à OpenAI (paga) por assistente" onEscolher={id => setUsoSel(s => s === id ? null : id)} escolhido={usoSel}
                  itens={(d.ia.por_agente || []).filter(a => a.openai).sort((a, b) => b.openai - a.openai).map(a => ({ id: a.agente, rotulo: a.nome, valor: a.openai, dica: `${a.nome}: ${a.openai} requisições à OpenAI · ${fmt(a.tokens_entrada + a.tokens_saida)} tokens` }))} />
                {usoEscolhido ? (
                  <Barras titulo={`${usoEscolhido.nome}: de onde vieram as respostas`} cor="#16a34a" itens={[
                    { rotulo: 'Groq (grátis)', valor: usoEscolhido.groq || 0 },
                    { rotulo: 'OpenRouter (grátis)', valor: usoEscolhido.openrouter || 0 },
                    { rotulo: 'Whisper (grátis)', valor: usoEscolhido.whisper },
                    { rotulo: 'Gemini', valor: usoEscolhido.gemini || 0 },
                    { rotulo: 'OpenAI (paga)', valor: usoEscolhido.openai },
                    { rotulo: 'Grok (paga)', valor: usoEscolhido.grok },
                    { rotulo: '⚠️ Falhas', valor: usoEscolhido.falhas },
                  ]} />
                ) : (
                  <Barras titulo="Tokens usados por assistente (enviados + recebidos)" cor="#7c3aed" onEscolher={id => setUsoSel(id)} escolhido={usoSel}
                    itens={(d.ia.por_agente || []).filter(a => a.tokens_entrada + a.tokens_saida).sort((a, b) => (b.tokens_entrada + b.tokens_saida) - (a.tokens_entrada + a.tokens_saida)).map(a => ({ id: a.agente, rotulo: a.nome, valor: a.tokens_entrada + a.tokens_saida }))} />
                )}
              </section>
              <div className="ps-card" style={{ padding: 14, borderRadius: 12, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Uso da IA por assistente</div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--t-text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={soFalhas} onChange={e => setSoFalhas(e.target.checked)} /> Só quem teve falhas
                  </label>
                </div>
                <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 8 }}>Contado desde 29/10/2026. Falha = a IA não respondeu ou recusou o pedido. Groq → paga = o Groq grátis não deu conta e o pedido foi para a IA paga. Clique na linha para ver de onde vieram as respostas do assistente.</div>
                {!usoAgentes.length && <div style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>{soFalhas ? 'Nenhum assistente com falhas no período.' : 'Nada no período.'}</div>}
                {!!usoAgentes.length && (
                  <TabelaOrdenavel<UsoAgente> linhas={usoAgentes} chave={a => a.agente} destaque={usoSel} onLinha={a => setUsoSel(s => s === a.agente ? null : a.agente)} ordemInicial="openai" colunas={[
                    { id: 'nome', rotulo: 'Assistente', valor: a => a.nome },
                    { id: 'groq', rotulo: 'Groq (grátis)', valor: a => a.groq || 0, cor: a => a.groq ? '#16a34a' : undefined },
                    { id: 'groq_reserva', rotulo: 'Groq → paga', valor: a => a.groq_reserva || 0 },
                    { id: 'openrouter', rotulo: 'OpenRouter (grátis)', valor: a => a.openrouter || 0, cor: a => a.openrouter ? '#16a34a' : undefined },
                    { id: 'gemini', rotulo: 'Gemini', valor: a => a.gemini || 0 },
                    { id: 'openai', rotulo: 'OpenAI', valor: a => a.openai },
                    { id: 'grok', rotulo: 'Grok', valor: a => a.grok },
                    { id: 'whisper', rotulo: 'Whisper (grátis)', valor: a => a.whisper },
                    { id: 'falhas', rotulo: 'Falhas', valor: a => a.falhas, cor: a => a.falhas ? '#dc2626' : undefined },
                    { id: 'tokens_entrada', rotulo: 'Tokens enviados', valor: a => a.tokens_entrada },
                    { id: 'tokens_saida', rotulo: 'Tokens recebidos', valor: a => a.tokens_saida },
                  ]} />
                )}
              </div>
            </div>
          )}

          {aba === 'compromissos' && (
            <section style={grade(300)}>
              <Barras titulo="Compromissos marcados: o que aconteceu" cor="#7c3aed" itens={[
                { rotulo: '✅ Realizados', valor: d.compromissos.realizados },
                { rotulo: '⚠️ Não compareceu', valor: d.compromissos.nao_compareceu },
                { rotulo: '🔁 Remarcados', valor: d.compromissos.remarcados },
                { rotulo: '❌ Cancelados', valor: d.compromissos.cancelados },
                { rotulo: '⏳ Pendentes', valor: d.compromissos.pendentes },
              ]} />
              <Barras titulo={`Propostas: mudanças de status (${d.propostas.criadas} criadas no período)`} cor="#ea580c" itens={d.propostas.por_status.slice(0, 8).map(p => ({ rotulo: STATUS_PROPOSTA[p.status] || p.status, valor: p.quantidade }))} />
              {!compacto && <Barras titulo="Outras atividades registradas" cor="#0891b2" itens={d.outras_atividades.map(o => ({ rotulo: TIPO_ATV[o.tipo] || o.tipo, valor: o.quantidade }))} />}
            </section>
          )}
        </>
      )}
    </div>
  );
}
